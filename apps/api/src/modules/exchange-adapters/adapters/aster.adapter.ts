/**
 * AsterAdapter — Aster DEX 适配器
 *
 *
 * Aster = Binance 兼容 API 格式的去中心化永续合约 DEX
 * - 认证: userAddress + signerAddress + privateKey (ECDSA 签名)
 * - API: https://fapi.asterdex.com (Binance Futures V3 兼容)
 * - 持仓模式: 单向 (BOTH)，从 positionAmt 正负推断多空
 * - 订单: LIMIT 类型 + ±1% 市价 模拟市价单
 * - 签名: ABI 编码 → keccak256 → Ethereum Signed Message → ECDSA
 *
 * 依赖: ethers v6 (已安装)
 */

import { Logger } from '@nestjs/common';
import {
  ExchangeAdapter,
  GridExchangeAdapter,
  LimitOrderRequest,
  LimitOrderResult,
  OrderBookSnapshot,
} from '../types/adapter.interface';
import {
  ExchangeBalance,
  ExchangePosition,
  OrderResult,
  OrderStatus,
  OrderStatusDetail,
  OpenOrder,
  ClosedPnlRecord,
  MarketPrecision,
  ExchangeCategory,
} from '../types/exchange.types';
import {
  AsterAdapterConfig,
  AsterPrecisionInfo,
  AsterExchangeInfo,
  AsterBalanceEntry,
  AsterPositionEntry,
  AsterOrderResponse,
  AsterTradeRecord,
  ASTER_BASE_URL,
  ASTER_POSITION_SIDE,
} from './aster/types';
import { signAsterRequest } from './aster/signing';

const logger = new Logger('AsterAdapter');

// 重试包装
async function retryCall<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> {
  let lastError: Error = new Error('retryCall: no attempts made');
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      // 不重试 4xx 错误（除了 429）
      if (e.status >= 400 && e.status < 500 && e.status !== 429) {
        throw e;
      }
      if (i < retries - 1) {
        logger.warn(`重试 ${i + 1}/${retries}: ${e.message}`);
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastError;
}

export class AsterAdapter implements ExchangeAdapter, GridExchangeAdapter {
  readonly exchangeType = 'aster';
  readonly category: ExchangeCategory = 'dex';
  readonly isDex = true;
  readonly isTestnet: boolean;

  private config: AsterAdapterConfig;
  private baseUrl: string;

  // 精度缓存 (24h TTL)
  private precisionCache: Map<string, AsterPrecisionInfo> = new Map();
  private precisionCacheTime = 0;
  private readonly PRECISION_CACHE_TTL = 24 * 60 * 60 * 1000;

  constructor(config: AsterAdapterConfig) {
    this.config = config;
    this.isTestnet = config.isTestnet;
    this.baseUrl = config.isTestnet
      ? ASTER_BASE_URL.testnet
      : ASTER_BASE_URL.mainnet;
  }

  // ========================= 生命周期 =========================

  async initialize(): Promise<void> {
    logger.log(
      `初始化 Aster 适配器: ${this.isTestnet ? '测试网' : '主网'}, user: ${this.config.userAddress.slice(0, 10)}...`,
    );

    // 加载交易所信息（精度缓存）
    await this.loadExchangeInfo();

    // 验证连通性: 获取余额
    try {
      await this.getBalance();
      logger.log('Aster 连通性验证通过');
    } catch (e: any) {
      logger.warn(`Aster 连通性验证失败: ${e.message}`);
    }

    logger.log(`Aster 初始化完成: ${this.precisionCache.size} 个交易对`);
  }

  isReady(): boolean {
    return this.precisionCache.size > 0;
  }

  async dispose(): Promise<void> {
    this.precisionCache.clear();
  }

  // ========================= 账户查询 =========================

  async getBalance(): Promise<ExchangeBalance> {
    const body = await this.request('GET', '/fapi/v3/balance', {});
    const balances = JSON.parse(body) as AsterBalanceEntry[];

    // 找 USDT 余额
    const usdtBalance = balances.find(
      (b) => b.asset === 'USDT' || b.asset === 'USDC',
    );

    const totalEquity = parseFloat(usdtBalance?.balance || '0');
    const availableBalance = parseFloat(
      usdtBalance?.availableBalance || '0',
    );

    // crossUnPnl 可能不准确，从持仓重新计算
    let unrealizedPnl = 0;
    try {
      const positions = await this.getPositions();
      unrealizedPnl = positions.reduce(
        (sum, p) => sum + p.unrealizedPnl,
        0,
      );
    } catch (e) {
      logger.debug(`Aster adapter non-critical error (getBalance positions): ${e instanceof Error ? e.message : e}`);
      unrealizedPnl = parseFloat(usdtBalance?.crossUnPnl || '0');
    }

    const usedMarginAster = totalEquity - availableBalance;
    return {
      totalEquity,
      availableBalance,
      usedMargin: usedMarginAster,
      unrealizedPnl,
      marginUsedPct: totalEquity > 0 ? (usedMarginAster / totalEquity) * 100 : 0,
    };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const body = await this.request('GET', '/fapi/v3/positionRisk', {});
    const positions = JSON.parse(body) as AsterPositionEntry[];

    return positions
      .filter((p) => parseFloat(p.positionAmt) !== 0)
      .map((p) => {
        const posAmt = parseFloat(p.positionAmt);
        // 单向模式: positionAmt 正=多, 负=空
        const side: 'long' | 'short' = posAmt > 0 ? 'long' : 'short';

        return {
          symbol: p.symbol,
          side,
          quantity: Math.abs(posAmt),
          entryPrice: parseFloat(p.entryPrice) || 0,
          markPrice: parseFloat(p.markPrice) || 0,
          unrealizedPnl: parseFloat(p.unRealizedProfit) || 0,
          leverage: parseFloat(p.leverage) || 1,
          marginMode: (p.marginType === 'isolated'
            ? 'isolated'
            : 'cross') as 'cross' | 'isolated',
          margin: parseFloat(p.isolatedMargin) || 0,
          liquidationPrice: parseFloat(p.liquidationPrice) || undefined,
        };
      });
  }

  // ========================= 开仓 / 平仓 =========================

  async openLong(
    symbol: string,
    quantity: number,
    leverage: number,
  ): Promise<OrderResult> {
    symbol = this.toAsterSymbol(symbol);
    // 1. 设置杠杆
    await this.setLeverage(symbol, leverage);

    // 2. 获取市场价 + 精度
    const price = await this.getMarketPrice(symbol);
    const prec = await this.getPrecision(symbol);

    // LIMIT 买单: 市价 +1%（模拟市价单）
    const orderPrice = this.roundToTickSize(price * 1.01, prec.tickSize);
    const orderQty = this.roundToStepSize(quantity, prec.stepSize);

    const priceStr = this.formatWithPrecision(orderPrice, prec.pricePrecision);
    const qtyStr = this.formatWithPrecision(orderQty, prec.quantityPrecision);

    const params: Record<string, any> = {
      symbol,
      positionSide: ASTER_POSITION_SIDE,
      type: 'LIMIT',
      side: 'BUY',
      timeInForce: 'GTC',
      quantity: qtyStr,
      price: priceStr,
    };

    const body = await this.request('POST', '/fapi/v3/order', params);
    return this.parseOrderResponse(body);
  }

  async openShort(
    symbol: string,
    quantity: number,
    leverage: number,
  ): Promise<OrderResult> {
    symbol = this.toAsterSymbol(symbol);
    await this.setLeverage(symbol, leverage);

    const price = await this.getMarketPrice(symbol);
    const prec = await this.getPrecision(symbol);

    // LIMIT 卖单: 市价 -1%
    const orderPrice = this.roundToTickSize(price * 0.99, prec.tickSize);
    const orderQty = this.roundToStepSize(quantity, prec.stepSize);

    const priceStr = this.formatWithPrecision(orderPrice, prec.pricePrecision);
    const qtyStr = this.formatWithPrecision(orderQty, prec.quantityPrecision);

    const params: Record<string, any> = {
      symbol,
      positionSide: ASTER_POSITION_SIDE,
      type: 'LIMIT',
      side: 'SELL',
      timeInForce: 'GTC',
      quantity: qtyStr,
      price: priceStr,
    };

    const body = await this.request('POST', '/fapi/v3/order', params);
    return this.parseOrderResponse(body);
  }

  async closeLong(symbol: string, quantity: number): Promise<OrderResult> {
    symbol = this.toAsterSymbol(symbol);
    // 如果 quantity=0，获取当前持仓数量
    let closeQty = quantity;
    if (closeQty === 0) {
      const positions = await this.getPositions();
      const pos = positions.find(
        (p) => p.symbol === symbol && p.side === 'long',
      );
      if (!pos) throw new Error(`无 ${symbol} 多头持仓`);
      closeQty = pos.quantity;
    }

    const price = await this.getMarketPrice(symbol);
    const prec = await this.getPrecision(symbol);

    // 平多 = 卖出, 市价 -1%
    const orderPrice = this.roundToTickSize(price * 0.99, prec.tickSize);
    const orderQty = this.roundToStepSize(closeQty, prec.stepSize);

    const priceStr = this.formatWithPrecision(orderPrice, prec.pricePrecision);
    const qtyStr = this.formatWithPrecision(orderQty, prec.quantityPrecision);

    const params: Record<string, any> = {
      symbol,
      positionSide: ASTER_POSITION_SIDE,
      type: 'LIMIT',
      side: 'SELL',
      timeInForce: 'GTC',
      quantity: qtyStr,
      price: priceStr,
      reduceOnly: 'true',
    };

    const body = await this.request('POST', '/fapi/v3/order', params);

    // 平仓后清理残留 SL/TP 订单
    await this.cancelStopOrders(symbol).catch(() => {});

    return this.parseOrderResponse(body);
  }

  async closeShort(symbol: string, quantity: number): Promise<OrderResult> {
    symbol = this.toAsterSymbol(symbol);
    let closeQty = quantity;
    if (closeQty === 0) {
      const positions = await this.getPositions();
      const pos = positions.find(
        (p) => p.symbol === symbol && p.side === 'short',
      );
      if (!pos) throw new Error(`无 ${symbol} 空头持仓`);
      closeQty = pos.quantity;
    }

    const price = await this.getMarketPrice(symbol);
    const prec = await this.getPrecision(symbol);

    // 平空 = 买入, 市价 +1%
    const orderPrice = this.roundToTickSize(price * 1.01, prec.tickSize);
    const orderQty = this.roundToStepSize(closeQty, prec.stepSize);

    const priceStr = this.formatWithPrecision(orderPrice, prec.pricePrecision);
    const qtyStr = this.formatWithPrecision(orderQty, prec.quantityPrecision);

    const params: Record<string, any> = {
      symbol,
      positionSide: ASTER_POSITION_SIDE,
      type: 'LIMIT',
      side: 'BUY',
      timeInForce: 'GTC',
      quantity: qtyStr,
      price: priceStr,
      reduceOnly: 'true',
    };

    const body = await this.request('POST', '/fapi/v3/order', params);
    await this.cancelStopOrders(symbol).catch(() => {});

    return this.parseOrderResponse(body);
  }

  // ========================= 杠杆 / 保证金 =========================

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    symbol = this.toAsterSymbol(symbol);
    try {
      await this.request('POST', '/fapi/v3/leverage', {
        symbol,
        leverage,
      });
      logger.log(`${symbol} 杠杆设置为 ${leverage}x`);
    } catch (e: any) {
      // 忽略 -2030 (有持仓时无法修改)
      if (e.message?.includes('-2030')) {
        logger.log(`${symbol} 杠杆已设置或有持仓，跳过`);
        return;
      }
      throw e;
    }
  }

  async setMarginMode(
    symbol: string,
    isCrossMargin: boolean,
  ): Promise<void> {
    symbol = this.toAsterSymbol(symbol);
    const marginType = isCrossMargin ? 'CROSSED' : 'ISOLATED';
    try {
      await this.request('POST', '/fapi/v3/marginType', {
        symbol,
        marginType,
      });
      logger.log(`${symbol} 保证金模式设置为 ${marginType}`);
    } catch (e: any) {
      const msg = e.message || '';
      // 忽略"已设置"、有持仓、多资产模式错误
      if (
        msg.includes('No need to change') ||
        msg.includes('Margin type cannot be changed') ||
        msg.includes('Multi-Assets mode') ||
        msg.includes('-4168')
      ) {
        logger.log(`${symbol} 保证金模式已为 ${marginType} 或无法修改`);
        return;
      }
      // 统一账户错误
      if (
        msg.includes('unified') ||
        msg.includes('portfolio') ||
        msg.includes('Portfolio')
      ) {
        throw new Error(
          "请使用 'Spot & Futures Trading' API 权限，非统一账户 API",
        );
      }
      // 其他错误不阻塞交易
      logger.warn(`设置保证金模式失败: ${msg}`);
    }
  }

  // ========================= 市场数据 =========================

  async getMarketPrice(symbol: string): Promise<number> {
    symbol = this.toAsterSymbol(symbol);
    // 公开端点，无需签名
    const resp = await retryCall(() =>
      fetch(`${this.baseUrl}/fapi/v3/ticker/price?symbol=${symbol}`),
    );
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    }
    const data = (await resp.json()) as { price: string };
    return parseFloat(data.price);
  }

  // ========================= 止盈止损 =========================

  async setStopLoss(
    symbol: string,
    positionSide: string,
    quantity: number,
    stopPrice: number,
  ): Promise<void> {
    symbol = this.toAsterSymbol(symbol);
    const side = positionSide === 'short' ? 'BUY' : 'SELL';
    const prec = await this.getPrecision(symbol);

    const priceStr = this.formatWithPrecision(
      this.roundToTickSize(stopPrice, prec.tickSize),
      prec.pricePrecision,
    );
    const qtyStr = this.formatWithPrecision(
      this.roundToStepSize(quantity, prec.stepSize),
      prec.quantityPrecision,
    );

    await this.request('POST', '/fapi/v3/order', {
      symbol,
      positionSide: ASTER_POSITION_SIDE,
      type: 'STOP_MARKET',
      side,
      stopPrice: priceStr,
      quantity: qtyStr,
      timeInForce: 'GTC',
    });

    logger.log(`${symbol} 止损设置: ${stopPrice}`);
  }

  async setTakeProfit(
    symbol: string,
    positionSide: string,
    quantity: number,
    takeProfitPrice: number,
  ): Promise<void> {
    symbol = this.toAsterSymbol(symbol);
    const side = positionSide === 'short' ? 'BUY' : 'SELL';
    const prec = await this.getPrecision(symbol);

    const priceStr = this.formatWithPrecision(
      this.roundToTickSize(takeProfitPrice, prec.tickSize),
      prec.pricePrecision,
    );
    const qtyStr = this.formatWithPrecision(
      this.roundToStepSize(quantity, prec.stepSize),
      prec.quantityPrecision,
    );

    await this.request('POST', '/fapi/v3/order', {
      symbol,
      positionSide: ASTER_POSITION_SIDE,
      type: 'TAKE_PROFIT_MARKET',
      side,
      stopPrice: priceStr,
      quantity: qtyStr,
      timeInForce: 'GTC',
    });

    logger.log(`${symbol} 止盈设置: ${takeProfitPrice}`);
  }

  // ========================= 订单管理 =========================

  async cancelAllOrders(symbol: string): Promise<void> {
    symbol = this.toAsterSymbol(symbol);
    await this.request('DELETE', '/fapi/v3/allOpenOrders', { symbol });
  }

  async cancelStopOrders(symbol: string): Promise<void> {
    symbol = this.toAsterSymbol(symbol);
    const ordersBody = await this.request('GET', '/fapi/v3/openOrders', {
      symbol,
    });
    const orders = JSON.parse(ordersBody) as AsterOrderResponse[];

    const stopTypes = [
      'STOP_MARKET',
      'TAKE_PROFIT_MARKET',
      'STOP',
      'TAKE_PROFIT',
    ];

    let canceledCount = 0;
    for (const order of orders) {
      if (stopTypes.includes(order.type)) {
        try {
          await this.request('DELETE', '/fapi/v3/order', {
            symbol,
            orderId: order.orderId,
          });
          canceledCount++;
        } catch (e: any) {
          logger.warn(`取消订单 ${order.orderId} 失败: ${e.message}`);
        }
      }
    }

    if (canceledCount > 0) {
      logger.log(`${symbol} 已取消 ${canceledCount} 个止损/止盈单`);
    }
  }

  async getOrderStatus(
    symbol: string,
    orderId: string,
  ): Promise<OrderStatusDetail> {
    symbol = this.toAsterSymbol(symbol);
    const body = await this.request('GET', '/fapi/v3/order', {
      symbol,
      orderId,
    });
    const order = JSON.parse(body) as AsterOrderResponse;

    return {
      status: this.mapOrderStatus(order.status),
      avgPrice: parseFloat(order.avgPrice) || 0,
      filledQuantity: parseFloat(order.executedQty) || 0,
      fee: 0, // Aster 可能需要单独查询
    };
  }

  async getOpenOrders(symbol: string): Promise<OpenOrder[]> {
    symbol = this.toAsterSymbol(symbol);
    const body = await this.request('GET', '/fapi/v3/openOrders', {
      symbol,
    });
    const orders = JSON.parse(body) as AsterOrderResponse[];

    return orders.map((o) => ({
      orderId: String(o.orderId),
      symbol: o.symbol,
      side: (o.side === 'BUY' ? 'buy' : 'sell') as 'buy' | 'sell',
      positionSide: 'long' as 'long' | 'short',
      type: this.mapAsterOrderType(o.type),
      price: o.price ? parseFloat(o.price) : undefined,
      stopPrice: o.stopPrice ? parseFloat(o.stopPrice) : undefined,
      quantity: parseFloat(o.origQty) || 0,
      status: o.status,
    }));
  }

  // ========================= 精度 =========================

  async formatQuantity(symbol: string, quantity: number): Promise<string> {
    symbol = this.toAsterSymbol(symbol);
    const prec = await this.getPrecision(symbol);
    const adjusted = this.roundToStepSize(quantity, prec.stepSize);
    return this.formatWithPrecision(adjusted, prec.quantityPrecision);
  }

  async getMarketPrecision(symbol: string): Promise<MarketPrecision> {
    symbol = this.toAsterSymbol(symbol);
    const prec = await this.getPrecision(symbol);
    return {
      symbol,
      pricePrecision: prec.pricePrecision,
      quantityPrecision: prec.quantityPrecision,
      minQuantity: prec.minQty,
      minNotional: prec.minNotional,
      tickSize: prec.tickSize,
      stepSize: prec.stepSize,
    };
  }

  // ========================= 历史数据 =========================

  async getClosedPnl(
    startTime: Date,
    limit: number,
  ): Promise<ClosedPnlRecord[]> {
    try {
      const body = await this.request('GET', '/fapi/v3/userTrades', {
        startTime: startTime.getTime(),
        limit: limit || 500,
      });

      const trades = JSON.parse(body) as AsterTradeRecord[];

      return trades
        .filter((t) => parseFloat(t.realizedPnl) !== 0)
        .map((t) => {
          const price = parseFloat(t.price);
          const qty = parseFloat(t.qty);
          const pnl = parseFloat(t.realizedPnl);

          // 从 PnL 推算入场价
          const isSell = t.side === 'SELL';
          let side: 'long' | 'short';
          let entryPrice: number;

          if (t.positionSide === 'BOTH' || !t.positionSide) {
            side = isSell ? 'long' : 'short';
          } else {
            side = t.positionSide === 'SHORT' ? 'short' : 'long';
          }

          if (qty > 0) {
            entryPrice =
              side === 'long' ? price - pnl / qty : price + pnl / qty;
          } else {
            entryPrice = price;
          }

          return {
            symbol: t.symbol,
            side,
            entryPrice,
            exitPrice: price,
            quantity: qty,
            realizedPnl: pnl,
            fee: parseFloat(t.commission) || 0,
            leverage: 1,
            entryTime: new Date(t.time),
            exitTime: new Date(t.time),
            orderId: String(t.id),
            closeType: 'unknown' as const,
            exchangeId: String(t.id),
          };
        });
    } catch (e) {
      logger.debug(`Aster adapter non-critical error (getClosedPnl): ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  // ========================= GridExchangeAdapter =========================

  async placeLimitOrder(
    request: LimitOrderRequest,
  ): Promise<LimitOrderResult> {
    request.symbol = this.toAsterSymbol(request.symbol);
    const prec = await this.getPrecision(request.symbol);
    const priceStr = this.formatWithPrecision(
      this.roundToTickSize(request.price, prec.tickSize),
      prec.pricePrecision,
    );
    const qtyStr = this.formatWithPrecision(
      this.roundToStepSize(request.quantity, prec.stepSize),
      prec.quantityPrecision,
    );

    const side = request.side === 'buy' ? 'BUY' : 'SELL';
    const params: Record<string, any> = {
      symbol: request.symbol,
      positionSide: ASTER_POSITION_SIDE,
      type: 'LIMIT',
      side,
      timeInForce: 'GTC',
      quantity: qtyStr,
      price: priceStr,
    };

    if (request.reduceOnly) {
      params.reduceOnly = 'true';
    }

    const body = await this.request('POST', '/fapi/v3/order', params);
    const resp = JSON.parse(body) as AsterOrderResponse;

    return {
      orderId: String(resp.orderId),
      clientId: resp.clientOrderId,
      symbol: request.symbol,
      side: request.side,
      positionSide: request.positionSide,
      price: request.price,
      quantity: request.quantity,
      status: 'NEW',
    };
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    symbol = this.toAsterSymbol(symbol);
    await this.request('DELETE', '/fapi/v3/order', {
      symbol,
      orderId,
    });
  }

  async getOrderBook(
    symbol: string,
    depth: number,
  ): Promise<OrderBookSnapshot> {
    symbol = this.toAsterSymbol(symbol);
    // 公开端点
    const resp = await retryCall(() =>
      fetch(
        `${this.baseUrl}/fapi/v3/depth?symbol=${symbol}&limit=${depth || 20}`,
      ),
    );

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    }

    const data = (await resp.json()) as {
      bids: [string, string][];
      asks: [string, string][];
    };

    const bids: [number, number][] = (data.bids || []).map(
      ([p, q]: [string, string]) => [parseFloat(p), parseFloat(q)],
    );
    const asks: [number, number][] = (data.asks || []).map(
      ([p, q]: [string, string]) => [parseFloat(p), parseFloat(q)],
    );

    return { bids, asks, timestamp: Date.now() };
  }

  // ========================= 内部方法：HTTP 请求 =========================

  /**
   * 发送签名请求
   */
  private async request(
    method: string,
    path: string,
    params: Record<string, any>,
  ): Promise<string> {
    const jsonStr = JSON.stringify(params);

    // ECDSA 签名
    const { signature, nonce } = signAsterRequest(
      jsonStr,
      this.config.userAddress,
      this.config.signerAddress,
      this.config.privateKey,
    );

    const headers: Record<string, string> = {
      'ASTER-KEY': this.config.signerAddress,
      'ASTER-SIGN': signature,
      'ASTER-USER': this.config.userAddress,
      'ASTER-NONCE': nonce,
      Accept: 'application/json',
    };

    let url: string;
    let body: string | undefined;

    if (method === 'POST') {
      // POST: form body
      url = `${this.baseUrl}${path}`;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ).toString();
    } else if (method === 'DELETE') {
      // DELETE: query string for some endpoints, form body for others
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ).toString();
      url = `${this.baseUrl}${path}${qs ? '?' + qs : ''}`;
    } else {
      // GET: query string
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ).toString();
      url = `${this.baseUrl}${path}${qs ? '?' + qs : ''}`;
    }

    const resp = await retryCall(() =>
      fetch(url, {
        method,
        headers,
        body,
      }),
    );

    const text = await resp.text();

    if (!resp.ok) {
      const error: any = new Error(
        `Aster API 错误 (${resp.status}): ${text}`,
      );
      error.status = resp.status;
      throw error;
    }

    return text;
  }

  // ========================= 内部方法：精度 =========================

  /** 加载交易所信息 */
  private async loadExchangeInfo(): Promise<void> {
    if (
      this.precisionCache.size > 0 &&
      Date.now() - this.precisionCacheTime < this.PRECISION_CACHE_TTL
    ) {
      return;
    }

    const resp = await retryCall(() =>
      fetch(`${this.baseUrl}/fapi/v3/exchangeInfo`),
    );
    if (!resp.ok) {
      throw new Error(`交易所信息获取失败: ${resp.status}`);
    }

    const data = (await resp.json()) as AsterExchangeInfo;

    this.precisionCache.clear();
    for (const sym of data.symbols) {
      let tickSize = 0;
      let stepSize = 0;
      let minQty = 0;
      let minNotional = 0;

      for (const filter of sym.filters) {
        if (filter.filterType === 'PRICE_FILTER') {
          tickSize = parseFloat((filter as any).tickSize) || 0;
        } else if (filter.filterType === 'LOT_SIZE') {
          stepSize = parseFloat((filter as any).stepSize) || 0;
          minQty = parseFloat((filter as any).minQty) || 0;
        } else if (filter.filterType === 'MIN_NOTIONAL') {
          minNotional = parseFloat((filter as any).notional) || 0;
        }
      }

      this.precisionCache.set(sym.symbol, {
        symbol: sym.symbol,
        pricePrecision: sym.pricePrecision,
        quantityPrecision: sym.quantityPrecision,
        tickSize,
        stepSize,
        minQty,
        minNotional,
      });
    }

    this.precisionCacheTime = Date.now();
    logger.log(`Aster 交易所信息已加载: ${this.precisionCache.size} 个交易对`);
  }

  /** 获取交易对精度信息 */
  private async getPrecision(symbol: string): Promise<AsterPrecisionInfo> {
    await this.loadExchangeInfo();
    const prec = this.precisionCache.get(symbol);
    if (!prec) {
      throw new Error(
        `Aster 不支持交易对: ${symbol} (可用: ${Array.from(this.precisionCache.keys()).slice(0, 5).join(', ')}...)`,
      );
    }
    return prec;
  }

  // ========================= 内部方法：符号转换 =========================

  /**
   * 统一符号 → Aster 符号
   * "BTC/USDT:USDT" or "BTC/USDT" → "BTCUSDT"
   * "BTCUSDT" → "BTCUSDT" (pass-through)
   */
  private toAsterSymbol(symbol: string): string {
    // 去掉 CCXT 合约后缀 ":USDT"
    let s = symbol;
    if (s.includes(':')) {
      s = s.split(':')[0];
    }
    // "BTC/USDT" → "BTCUSDT"
    s = s.replace('/', '');
    return s.toUpperCase();
  }

  // ========================= 内部方法：精度处理 =========================

  /**
   * 按 tickSize 取整价格
   */
  private roundToTickSize(value: number, tickSize: number): number {
    if (tickSize <= 0) return value;
    return Math.round(value / tickSize) * tickSize;
  }

  /**
   * 按 stepSize 取整数量
   */
  private roundToStepSize(value: number, stepSize: number): number {
    if (stepSize <= 0) return value;
    return Math.floor(value / stepSize) * stepSize;
  }

  /**
   * 按精度位数格式化数字
   */
  private formatWithPrecision(value: number, precision: number): string {
    return value.toFixed(precision);
  }

  // ========================= 内部方法：解析 =========================

  private parseOrderResponse(body: string): OrderResult {
    const order = JSON.parse(body) as AsterOrderResponse;
    return {
      orderId: String(order.orderId),
      symbol: order.symbol,
      side: (order.side === 'BUY' ? 'buy' : 'sell') as 'buy' | 'sell',
      avgPrice: parseFloat(order.avgPrice) || 0,
      quantity: parseFloat(order.origQty) || 0,
      filledQuantity: parseFloat(order.executedQty) || 0,
      fee: 0,
      status: this.mapOrderStatus(order.status),
    };
  }

  private mapOrderStatus(status: string): OrderStatus {
    switch (status) {
      case 'NEW':
        return 'NEW';
      case 'PARTIALLY_FILLED':
        return 'PARTIALLY_FILLED';
      case 'FILLED':
        return 'FILLED';
      case 'CANCELED':
        return 'CANCELED';
      case 'EXPIRED':
        return 'EXPIRED';
      case 'REJECTED':
        return 'REJECTED';
      default:
        return 'NEW';
    }
  }

  private mapAsterOrderType(
    type: string,
  ): 'limit' | 'stop_market' | 'take_profit_market' | 'stop' | 'take_profit' {
    switch (type) {
      case 'STOP_MARKET':
      case 'STOP':
        return 'stop_market';
      case 'TAKE_PROFIT_MARKET':
      case 'TAKE_PROFIT':
        return 'take_profit_market';
      default:
        return 'limit';
    }
  }
}
