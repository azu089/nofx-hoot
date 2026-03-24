/**
 * LighterAdapter — Lighter DEX 适配器
 *
 *
 * Lighter V2 = ZK 永续合约 DEX
 * - 认证: walletAddress + apiKeyPrivateKey + apiKeyIndex
 * - 市场数据: REST API (无需签名)
 * - 账户数据: REST API + Auth Token
 * - 交易: REST API + TxClient 签名 (需要 lighter-sdk)
 *
 * 签名模块: 通过 LighterTxSigner 接口注入
 * 当前状态: 市场数据可用，交易操作需等待签名模块集成
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
  LighterAdapterConfig,
  LighterMarketInfo,
  LighterFullAccountResponse,
  LighterOrderBooksResponse,
  LighterOrderBookDetailResponse,
  LighterOrderResponse,
  LighterTradeResponse,
  LighterOrderEntry,
  LIGHTER_BASE_URL,
  LIGHTER_CHAIN_ID,
  LIGHTER_ORDER_TYPE,
} from './lighter/types';
import {
  LighterTxSigner,
  PlaceholderLighterSigner,
  floatToPriceX18,
  quantityToBaseAmount,
  toChecksumAddress,
} from './lighter/signing';

const logger = new Logger('LighterAdapter');

// 重试包装（移植自 ai-execution retryCall）
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
      if (i < retries - 1) {
        logger.warn(`重试 ${i + 1}/${retries}: ${e.message}`);
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastError;
}

export class LighterAdapter implements ExchangeAdapter, GridExchangeAdapter {
  readonly exchangeType = 'lighter';
  readonly category: ExchangeCategory = 'dex';
  readonly isDex = true;
  readonly isTestnet: boolean;

  private config: LighterAdapterConfig;
  private baseUrl: string;
  private chainId: number;
  private accountIndex = -1;
  private signer: LighterTxSigner;

  // Auth token
  private authToken = '';
  private tokenExpiry = new Date(0);

  // 市场信息缓存 (1h TTL)
  private marketCache: Map<string, LighterMarketInfo> = new Map();
  private marketCacheTime = 0;
  private readonly MARKET_CACHE_TTL = 60 * 60 * 1000; // 1h

  constructor(config: LighterAdapterConfig, signer?: LighterTxSigner) {
    this.config = config;
    this.isTestnet = config.isTestnet;
    this.baseUrl = config.isTestnet
      ? LIGHTER_BASE_URL.testnet
      : LIGHTER_BASE_URL.mainnet;
    this.chainId = config.isTestnet
      ? LIGHTER_CHAIN_ID.testnet
      : LIGHTER_CHAIN_ID.mainnet;
    this.signer = signer || new PlaceholderLighterSigner();
  }

  // ========================= 生命周期 =========================

  async initialize(): Promise<void> {
    logger.log(
      `初始化 Lighter 适配器: ${this.isTestnet ? '测试网' : '主网'}, 钱包: ${this.config.walletAddress.slice(0, 10)}...`,
    );

    // 1. 加载市场信息
    await this.fetchMarketList();

    // 2. 获取账户索引
    await this.initializeAccount();

    // 3. 初始化签名器
    await this.signer.initialize(
      this.config.apiKeyPrivateKey,
      this.chainId,
      this.accountIndex,
      this.config.apiKeyIndex,
    );

    // 4. 尝试获取 Auth Token（可能失败，签名器未就绪时）
    try {
      await this.ensureAuthToken();
    } catch (e: any) {
      logger.warn(`Auth Token 获取失败（签名器可能未就绪）: ${e.message}`);
    }

    logger.log(
      `Lighter 初始化完成: accountIndex=${this.accountIndex}, markets=${this.marketCache.size}`,
    );
  }

  isReady(): boolean {
    return this.marketCache.size > 0;
  }

  async dispose(): Promise<void> {
    this.authToken = '';
    this.marketCache.clear();
  }

  // ========================= 账户查询 =========================

  async getBalance(): Promise<ExchangeBalance> {
    const fullAccount = await this.getFullAccountInfo();

    let totalEquity = 0;
    let availableBalance = 0;

    for (const b of fullAccount.balances) {
      if (b.token === 'USDC' || b.token === 'USDT') {
        totalEquity += parseFloat(b.balance) || 0;
        availableBalance += parseFloat(b.available) || 0;
      }
    }

    // 加上未实现盈亏
    let unrealizedPnl = 0;
    for (const p of fullAccount.positions) {
      if (p.sign !== 0) {
        unrealizedPnl += parseFloat(p.unrealized_pnl) || 0;
      }
    }

    const finalEquity = totalEquity + unrealizedPnl;
    const usedMarginLighter = totalEquity - availableBalance;
    return {
      totalEquity: finalEquity,
      availableBalance,
      usedMargin: usedMarginLighter,
      unrealizedPnl,
      marginUsedPct: finalEquity > 0 ? (usedMarginLighter / finalEquity) * 100 : 0,
    };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const fullAccount = await this.getFullAccountInfo();

    return fullAccount.positions
      .filter((p) => p.sign !== 0)
      .map((p) => ({
        symbol: this.toUnifiedSymbol(p.order_book_symbol),
        side: (p.sign === 1 ? 'long' : 'short') as 'long' | 'short',
        quantity: Math.abs(parseFloat(p.base_amount) || 0),
        entryPrice: parseFloat(p.entry_price) || 0,
        markPrice: parseFloat(p.mark_price) || 0,
        unrealizedPnl: parseFloat(p.unrealized_pnl) || 0,
        leverage: parseFloat(p.leverage) || 1,
        marginMode: 'cross' as const,
        margin: parseFloat(p.maintenance_margin) || 0,
        liquidationPrice: parseFloat(p.liquidation_price) || undefined,
      }));
  }

  // ========================= 开仓 / 平仓 =========================

  async openLong(
    symbol: string,
    quantity: number,
    leverage: number,
  ): Promise<OrderResult> {
    this.ensureSignerReady();

    const lighterSymbol = this.normalizeSymbol(symbol);

    // 1. 取消同方向活跃订单
    await this.cancelAllOrders(symbol).catch(() => {});

    // 2. 设置杠杆
    await this.setLeverage(symbol, leverage);

    // 3. 获取市场价格
    const price = await this.getMarketPrice(symbol);
    // 价格保护: 买单 ≤ 105% 市价
    const orderPrice = price * 1.05;

    // 4. 创建市价买单
    return this.createOrder(lighterSymbol, quantity, orderPrice, true, false);
  }

  async openShort(
    symbol: string,
    quantity: number,
    leverage: number,
  ): Promise<OrderResult> {
    this.ensureSignerReady();

    const lighterSymbol = this.normalizeSymbol(symbol);

    await this.cancelAllOrders(symbol).catch(() => {});
    await this.setLeverage(symbol, leverage);

    const price = await this.getMarketPrice(symbol);
    // 价格保护: 卖单 ≥ 95% 市价
    const orderPrice = price * 0.95;

    return this.createOrder(lighterSymbol, quantity, orderPrice, false, false);
  }

  async closeLong(symbol: string, quantity: number): Promise<OrderResult> {
    this.ensureSignerReady();

    const lighterSymbol = this.normalizeSymbol(symbol);

    // 如果 quantity=0，获取当前持仓数量
    let closeQty = quantity;
    if (closeQty === 0) {
      const positions = await this.getPositions();
      const pos = positions.find(
        (p) =>
          this.normalizeSymbol(p.symbol) === lighterSymbol && p.side === 'long',
      );
      if (!pos) throw new Error(`无 ${symbol} 多头持仓`);
      closeQty = pos.quantity;
    }

    const price = await this.getMarketPrice(symbol);
    const orderPrice = price * 0.95; // 卖出用低价保护

    return this.createOrder(lighterSymbol, closeQty, orderPrice, false, true);
  }

  async closeShort(symbol: string, quantity: number): Promise<OrderResult> {
    this.ensureSignerReady();

    const lighterSymbol = this.normalizeSymbol(symbol);

    let closeQty = quantity;
    if (closeQty === 0) {
      const positions = await this.getPositions();
      const pos = positions.find(
        (p) =>
          this.normalizeSymbol(p.symbol) === lighterSymbol &&
          p.side === 'short',
      );
      if (!pos) throw new Error(`无 ${symbol} 空头持仓`);
      closeQty = pos.quantity;
    }

    const price = await this.getMarketPrice(symbol);
    const orderPrice = price * 1.05;

    return this.createOrder(lighterSymbol, closeQty, orderPrice, true, true);
  }

  // ========================= 杠杆 / 保证金 =========================

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.ensureAuthToken();
    const lighterSymbol = this.normalizeSymbol(symbol);
    const market = await this.getMarket(lighterSymbol);

    // Lighter 杠杆通过 InitialMarginFraction 设置
    // IMF = (100 / leverage) * 100 (百分比的百分之一)
    const imf = Math.round((100 / leverage) * 100);

    const params = new URLSearchParams({
      account_index: String(this.accountIndex),
      order_book_index: String(market.orderBookIndex),
      initial_margin_fraction: String(imf),
    });

    await retryCall(() =>
      this.fetchApi(`/api/v1/setLeverage?${params.toString()}`, {
        method: 'POST',
      }),
    );

    logger.log(`${symbol} 杠杆设置为 ${leverage}x (IMF=${imf})`);
  }

  async setMarginMode(
    _symbol: string,
    _isCrossMargin: boolean,
  ): Promise<void> {
    // Lighter 只支持交叉保证金，无需操作
    logger.log('Lighter 仅支持交叉保证金模式');
  }

  // ========================= 市场数据 =========================

  async getMarketPrice(symbol: string): Promise<number> {
    const lighterSymbol = this.normalizeSymbol(symbol);

    const resp = await retryCall(() =>
      this.fetchPublicApi(
        `/api/v1/orderBookDetail?order_book_symbol=${lighterSymbol}`,
      ),
    );

    const data = resp as LighterOrderBookDetailResponse;
    const markPrice = parseFloat(data.mark_price);
    if (markPrice > 0) return markPrice;

    const lastPrice = parseFloat(data.last_price);
    if (lastPrice > 0) return lastPrice;

    // fallback: 中间价
    const bestBid = parseFloat(data.best_bid);
    const bestAsk = parseFloat(data.best_ask);
    if (bestBid > 0 && bestAsk > 0) return (bestBid + bestAsk) / 2;

    throw new Error(`无法获取 ${symbol} 价格`);
  }

  // ========================= 止盈止损 =========================

  async setStopLoss(
    symbol: string,
    positionSide: string,
    quantity: number,
    stopPrice: number,
  ): Promise<void> {
    this.ensureSignerReady();
    const lighterSymbol = this.normalizeSymbol(symbol);
    const market = await this.getMarket(lighterSymbol);
    const isBuy = positionSide === 'short'; // 空头止损 = 买入

    const baseAmount = quantityToBaseAmount(quantity, market.sizeDecimals);
    const priceX18 = floatToPriceX18(stopPrice);
    const triggerPriceX18 = floatToPriceX18(stopPrice);

    const signedTx = await this.signer.signCreateOrder({
      orderBookIndex: market.orderBookIndex,
      baseAmount,
      priceX18,
      isBuy,
      orderType: LIGHTER_ORDER_TYPE.STOP_LOSS,
      timeInForce: 'GTC',
      reduceOnly: true,
      triggerPrice: triggerPriceX18,
    });

    await this.submitSignedTx(signedTx);
    logger.log(`${symbol} 止损设置: ${stopPrice}`);
  }

  async setTakeProfit(
    symbol: string,
    positionSide: string,
    quantity: number,
    takeProfitPrice: number,
  ): Promise<void> {
    this.ensureSignerReady();
    const lighterSymbol = this.normalizeSymbol(symbol);
    const market = await this.getMarket(lighterSymbol);
    const isBuy = positionSide === 'short';

    const baseAmount = quantityToBaseAmount(quantity, market.sizeDecimals);
    const priceX18 = floatToPriceX18(takeProfitPrice);
    const triggerPriceX18 = floatToPriceX18(takeProfitPrice);

    const signedTx = await this.signer.signCreateOrder({
      orderBookIndex: market.orderBookIndex,
      baseAmount,
      priceX18,
      isBuy,
      orderType: LIGHTER_ORDER_TYPE.TAKE_PROFIT,
      timeInForce: 'GTC',
      reduceOnly: true,
      triggerPrice: triggerPriceX18,
    });

    await this.submitSignedTx(signedTx);
    logger.log(`${symbol} 止盈设置: ${takeProfitPrice}`);
  }

  // ========================= 订单管理 =========================

  async cancelAllOrders(symbol: string): Promise<void> {
    this.ensureSignerReady();
    await this.ensureAuthToken();

    const orders = await this.getActiveOrdersRaw(symbol);
    if (orders.length === 0) return;

    const orderIds = orders.map((o) => o.order_id);
    const signedTx = await this.signer.signCancelOrders({ orderIds });
    await this.submitSignedTx(signedTx);

    logger.log(`${symbol} 已取消 ${orderIds.length} 个订单`);
  }

  async cancelStopOrders(symbol: string): Promise<void> {
    this.ensureSignerReady();
    await this.ensureAuthToken();

    const orders = await this.getActiveOrdersRaw(symbol);
    const stopOrders = orders.filter(
      (o) =>
        o.type === LIGHTER_ORDER_TYPE.STOP_LOSS ||
        o.type === LIGHTER_ORDER_TYPE.STOP_LOSS_LIMIT ||
        o.type === LIGHTER_ORDER_TYPE.TAKE_PROFIT ||
        o.type === LIGHTER_ORDER_TYPE.TAKE_PROFIT_LIMIT,
    );

    if (stopOrders.length === 0) return;

    const orderIds = stopOrders.map((o) => o.order_id);
    const signedTx = await this.signer.signCancelOrders({ orderIds });
    await this.submitSignedTx(signedTx);

    logger.log(`${symbol} 已取消 ${orderIds.length} 个止损/止盈单`);
  }

  async fetchMyTrades(_symbol: string, _since: number, _limit: number): Promise<Array<{
    side: 'buy' | 'sell'; price: number; amount: number; timestamp: number; orderId: string;
  }>> {
    return []; // Lighter 暂不支持，由 fallback 处理
  }

  async getOrderStatus(
    _symbol: string,
    orderId: string,
  ): Promise<OrderStatusDetail> {
    await this.ensureAuthToken();

    const resp = await retryCall(() =>
      this.fetchApi(`/api/v1/order/${orderId}`),
    );

    const order = resp as LighterOrderResponse;
    return {
      status: this.mapOrderStatus(order.status),
      avgPrice: parseFloat(order.avg_fill_price) || 0,
      filledQuantity: parseFloat(order.filled_base_amount) || 0,
      fee: parseFloat(order.fee) || 0,
    };
  }

  async getOpenOrders(symbol: string): Promise<OpenOrder[]> {
    const orders = await this.getActiveOrdersRaw(symbol);
    return orders.map((o) => ({
      orderId: String(o.order_id),
      symbol: this.toUnifiedSymbol(o.order_book_symbol),
      side: (o.side === 'buy' ? 'buy' : 'sell') as 'buy' | 'sell',
      positionSide: 'long' as 'long' | 'short',
      type: this.mapOrderType(o.type),
      price: o.price ? parseFloat(o.price) : undefined,
      stopPrice: o.stop_price ? parseFloat(o.stop_price) : undefined,
      quantity: parseFloat(o.base_amount) || 0,
      status: o.status,
    }));
  }

  // ========================= 精度 =========================

  async formatQuantity(symbol: string, quantity: number): Promise<string> {
    const lighterSymbol = this.normalizeSymbol(symbol);
    const market = await this.getMarket(lighterSymbol);
    const decimals = market.sizeDecimals;
    const step = Math.pow(10, -decimals);
    const adjusted = Math.floor(quantity / step) * step;
    return adjusted.toFixed(decimals);
  }

  async getMarketPrecision(symbol: string): Promise<MarketPrecision> {
    const lighterSymbol = this.normalizeSymbol(symbol);
    const market = await this.getMarket(lighterSymbol);
    return {
      symbol,
      pricePrecision: market.priceDecimals,
      quantityPrecision: market.sizeDecimals,
      minQuantity: market.minBaseAmount,
      minNotional: 0,
      tickSize: market.tickSize,
      stepSize: Math.pow(10, -market.sizeDecimals),
    };
  }

  // ========================= 历史数据 =========================

  async getClosedPnl(
    startTime: Date,
    limit: number,
  ): Promise<ClosedPnlRecord[]> {
    try {
      await this.ensureAuthToken();
      const params = new URLSearchParams({
        account_index: String(this.accountIndex),
        start_time: startTime.toISOString(),
        limit: String(limit),
      });

      const resp = await this.fetchApi(
        `/api/v1/accountTrades?${params.toString()}`,
      );
      const data = resp as LighterTradeResponse;

      return (data.trades || [])
        .filter((t) => parseFloat(t.realized_pnl) !== 0)
        .map((t) => ({
          symbol: this.toUnifiedSymbol(t.order_book_symbol),
          side: (t.side === 'buy' ? 'long' : 'short') as 'long' | 'short',
          entryPrice: 0,
          exitPrice: parseFloat(t.price) || 0,
          quantity: parseFloat(t.base_amount) || 0,
          realizedPnl: parseFloat(t.realized_pnl) || 0,
          fee: parseFloat(t.fee) || 0,
          leverage: 1,
          entryTime: new Date(t.timestamp),
          exitTime: new Date(t.timestamp),
          orderId: String(t.order_id),
          closeType: 'unknown' as const,
          exchangeId: `lighter_${t.trade_id}`,
        }));
    } catch (e) {
      logger.debug(`Lighter adapter non-critical error (getClosedPnl): ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async getIncomePnl(startTime: Date): Promise<number> {
    const records = await this.getClosedPnl(startTime, 200);
    return records.reduce((sum, r) => sum + (r.realizedPnl || 0), 0);
  }

  // ========================= GridExchangeAdapter =========================

  async placeLimitOrder(request: LimitOrderRequest): Promise<LimitOrderResult> {
    this.ensureSignerReady();
    const lighterSymbol = this.normalizeSymbol(request.symbol);
    const market = await this.getMarket(lighterSymbol);

    const baseAmount = quantityToBaseAmount(
      request.quantity,
      market.sizeDecimals,
    );
    const priceX18 = floatToPriceX18(request.price);

    const signedTx = await this.signer.signCreateOrder({
      orderBookIndex: market.orderBookIndex,
      baseAmount,
      priceX18,
      isBuy: request.side === 'buy',
      orderType: LIGHTER_ORDER_TYPE.LIMIT,
      timeInForce: 'GTC',
      reduceOnly: request.reduceOnly || false,
    });

    const resp = await this.submitSignedTx(signedTx);

    return {
      orderId: String(resp?.order_id || ''),
      symbol: request.symbol,
      side: request.side,
      positionSide: request.positionSide,
      price: request.price,
      quantity: request.quantity,
      status: 'NEW',
    };
  }

  async cancelOrder(_symbol: string, orderId: string): Promise<void> {
    this.ensureSignerReady();
    const signedTx = await this.signer.signCancelOrders({
      orderIds: [parseInt(orderId)],
    });
    await this.submitSignedTx(signedTx);
  }

  async getOrderBook(symbol: string, depth: number): Promise<OrderBookSnapshot> {
    const lighterSymbol = this.normalizeSymbol(symbol);

    const resp = (await this.fetchPublicApi(
      `/api/v1/orderBookDetail?order_book_symbol=${lighterSymbol}&depth=${depth}`,
    )) as LighterOrderBookDetailResponse;

    const bids: [number, number][] = (resp.bids || []).map(([p, q]) => [
      parseFloat(p),
      parseFloat(q),
    ]);
    const asks: [number, number][] = (resp.asks || []).map(([p, q]) => [
      parseFloat(p),
      parseFloat(q),
    ]);

    return { bids, asks, timestamp: Date.now() };
  }

  // ========================= 内部方法 =========================

  /** 获取账户索引 */
  private async initializeAccount(): Promise<void> {
    const address = toChecksumAddress(this.config.walletAddress);
    const resp = await retryCall(() =>
      this.fetchPublicApi(
        `/api/v1/account?by=l1_address&value=${address}`,
      ),
    );

    const data = resp as { account_index: number };
    if (!data.account_index && data.account_index !== 0) {
      throw new Error(
        `Lighter 账户未找到: ${this.config.walletAddress.slice(0, 10)}...`,
      );
    }

    this.accountIndex = data.account_index;
    logger.log(`Lighter accountIndex: ${this.accountIndex}`);
  }

  /** 获取完整账户信息（余额+持仓） */
  private async getFullAccountInfo(): Promise<LighterFullAccountResponse> {
    await this.ensureAuthToken();
    const address = toChecksumAddress(this.config.walletAddress);

    return (await retryCall(() =>
      this.fetchApi(
        `/api/v1/account?by=l1_address&value=${address}&full_account_info=1`,
      ),
    )) as LighterFullAccountResponse;
  }

  /** 加载市场信息列表 */
  private async fetchMarketList(): Promise<void> {
    if (
      this.marketCache.size > 0 &&
      Date.now() - this.marketCacheTime < this.MARKET_CACHE_TTL
    ) {
      return;
    }

    const resp = (await retryCall(() =>
      this.fetchPublicApi('/api/v1/orderBooks'),
    )) as LighterOrderBooksResponse;

    this.marketCache.clear();
    for (const ob of resp.order_books) {
      this.marketCache.set(ob.order_book_symbol, {
        orderBookIndex: ob.order_book_index,
        symbol: ob.order_book_symbol,
        baseToken: ob.base_token,
        quoteToken: ob.quote_token,
        sizeDecimals: ob.size_decimals,
        priceDecimals: ob.price_decimals,
        minBaseAmount: parseFloat(ob.min_base_amount) || 0,
        tickSize: parseFloat(ob.tick_size) || 0,
      });
    }
    this.marketCacheTime = Date.now();
    logger.log(`Lighter 市场列表已加载: ${this.marketCache.size} 个交易对`);
  }

  /** 获取指定市场信息 */
  private async getMarket(lighterSymbol: string): Promise<LighterMarketInfo> {
    await this.fetchMarketList();
    const market = this.marketCache.get(lighterSymbol);
    if (!market) {
      throw new Error(
        `Lighter 不支持交易对: ${lighterSymbol} (可用: ${Array.from(this.marketCache.keys()).slice(0, 5).join(', ')}...)`,
      );
    }
    return market;
  }

  /** 创建订单（通过 TxClient 签名） */
  private async createOrder(
    lighterSymbol: string,
    quantity: number,
    price: number,
    isBuy: boolean,
    reduceOnly: boolean,
  ): Promise<OrderResult> {
    const market = await this.getMarket(lighterSymbol);
    const baseAmount = quantityToBaseAmount(quantity, market.sizeDecimals);
    const priceX18 = floatToPriceX18(price);

    const signedTx = await this.signer.signCreateOrder({
      orderBookIndex: market.orderBookIndex,
      baseAmount,
      priceX18,
      isBuy,
      orderType: LIGHTER_ORDER_TYPE.LIMIT,
      timeInForce: 'IOC', // 市价单用 IOC
      reduceOnly,
    });

    const resp = await this.submitSignedTx(signedTx);
    const orderResp = resp as LighterOrderResponse | undefined;

    return {
      orderId: String(orderResp?.order_id || ''),
      symbol: this.toUnifiedSymbol(lighterSymbol),
      side: (isBuy ? 'buy' : 'sell') as 'buy' | 'sell',
      avgPrice: parseFloat(orderResp?.avg_fill_price || '0'),
      quantity,
      filledQuantity: parseFloat(orderResp?.filled_base_amount || '0'),
      fee: parseFloat(orderResp?.fee || '0'),
      status: this.mapOrderStatus(orderResp?.status || 'open'),
      txHash: orderResp?.tx_hash,
    };
  }

  /** 提交签名交易 */
  private async submitSignedTx(signedTx: Buffer): Promise<any> {
    const formData = new FormData();
    formData.append(
      'tx',
      new Blob([new Uint8Array(signedTx)]),
      'tx.bin',
    );

    const resp = await retryCall(() =>
      fetch(`${this.baseUrl}/api/v1/sendTx`, {
        method: 'POST',
        body: formData,
        headers: this.authToken
          ? { Authorization: `Bearer ${this.authToken}` }
          : {},
      }),
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Lighter sendTx 失败 (${resp.status}): ${text}`);
    }

    return resp.json();
  }

  /** 获取活跃订单（原始格式） */
  private async getActiveOrdersRaw(
    symbol: string,
  ): Promise<LighterOrderEntry[]> {
    await this.ensureAuthToken();
    const lighterSymbol = this.normalizeSymbol(symbol);

    const params = new URLSearchParams({
      account_index: String(this.accountIndex),
    });

    const resp = await retryCall(() =>
      this.fetchApi(`/api/v1/accountActiveOrders?${params.toString()}`),
    );

    const data = resp as { orders: LighterOrderEntry[] };
    return (data.orders || []).filter(
      (o) => o.order_book_symbol === lighterSymbol,
    );
  }

  // ========================= Auth Token =========================

  /** 确保 Auth Token 有效（30 分钟前刷新） */
  private async ensureAuthToken(): Promise<void> {
    const now = new Date();
    const thirtyMinBefore = new Date(
      this.tokenExpiry.getTime() - 30 * 60 * 1000,
    );
    if (this.authToken && now < thirtyMinBefore) {
      return;
    }
    await this.refreshAuthToken();
  }

  /** 刷新 Auth Token */
  private async refreshAuthToken(): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const address = toChecksumAddress(this.config.walletAddress);
    const message =
      `lighter.xyz wants you to sign in with your Lighter account:\n` +
      `${address}\n\n${timestamp}`;

    // 需要签名器签名认证消息
    const signature = await this.signer.signAuthMessage({ message });

    const resp = await fetch(`${this.baseUrl}/api/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_index: this.accountIndex,
        message,
        signature,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Auth Token 获取失败 (${resp.status}): ${text}`);
    }

    const data = (await resp.json()) as { token: string };
    this.authToken = data.token;
    this.tokenExpiry = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7h
    logger.log('Lighter Auth Token 已刷新');
  }

  // ========================= HTTP 工具 =========================

  /** 公开 API 调用（无需 Auth） */
  private async fetchPublicApi(path: string): Promise<any> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Lighter API 错误 (${resp.status}): ${text}`);
    }
    return resp.json();
  }

  /** 认证 API 调用（需要 Auth Token） */
  private async fetchApi(
    path: string,
    options?: RequestInit,
  ): Promise<any> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options?.headers as Record<string, string>),
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Lighter API 错误 (${resp.status}): ${text}`);
    }
    return resp.json();
  }

  // ========================= 符号转换 =========================

  /**
   * 统一符号 → Lighter 符号
   * "BTC/USDT:USDT" or "BTCUSDT" → "BTC"
   */
  private normalizeSymbol(symbol: string): string {
    let s = symbol;
    // 去掉 CCXT 格式
    if (s.includes('/')) {
      s = s.split('/')[0];
    }
    // 去掉后缀
    for (const suffix of ['USDT', 'USDC', 'PERP', ':USDT', ':USDC']) {
      if (s.endsWith(suffix)) {
        s = s.slice(0, -suffix.length);
      }
    }
    return s.toUpperCase();
  }

  /**
   * Lighter 符号 → 统一符号
   * "BTC" → "BTC/USDT:USDT"
   */
  private toUnifiedSymbol(lighterSymbol: string): string {
    return `${lighterSymbol}/USDT:USDT`;
  }

  // ========================= 状态映射 =========================

  private mapOrderStatus(status: string): OrderStatus {
    switch (status?.toLowerCase()) {
      case 'open':
      case 'new':
      case 'pending':
        return 'NEW';
      case 'filled':
      case 'closed':
        return 'FILLED';
      case 'partially_filled':
        return 'PARTIALLY_FILLED';
      case 'canceled':
      case 'cancelled':
        return 'CANCELED';
      case 'expired':
        return 'EXPIRED';
      case 'rejected':
        return 'REJECTED';
      default:
        return 'NEW';
    }
  }

  private mapOrderType(
    type: number,
  ): 'limit' | 'stop_market' | 'take_profit_market' | 'stop' | 'take_profit' {
    switch (type) {
      case LIGHTER_ORDER_TYPE.STOP_LOSS:
      case LIGHTER_ORDER_TYPE.STOP_LOSS_LIMIT:
        return 'stop_market';
      case LIGHTER_ORDER_TYPE.TAKE_PROFIT:
      case LIGHTER_ORDER_TYPE.TAKE_PROFIT_LIMIT:
        return 'take_profit_market';
      default:
        return 'limit';
    }
  }

  /** 确认签名器就绪 */
  private ensureSignerReady(): void {
    if (!this.signer.isReady()) {
      throw new Error(
        'Lighter 签名模块未就绪：无法执行交易操作。' +
          '请安装并配置 lighter-sdk npm 包。',
      );
    }
  }
}
