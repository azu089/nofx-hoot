/**
 * CcxtAdapter — CCXT 统一适配器
 *
 * 支持所有 CCXT 兼容的交易所:
 *   CEX: Binance, OKX, Bybit, Gate, Bitget, Coinbase
 *   DEX: Hyperliquid (CCXT 原生支持)
 *
 * 从 ai-execution.service.ts 提取并统一化
 *
 */

import * as ccxt from 'ccxt';
import * as fs from 'fs';
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

// CCXT 期货子类映射（binance 映射到专用的 binanceusdm 永续合约类）
const FUTURES_CLASS_MAP: Record<string, string> = {
  binance: 'binanceusdm',
  okx: 'okx',
  bybit: 'bybit',
  gate: 'gate',
  bitget: 'bitget',
  coinbase: 'coinbase',
  hyperliquid: 'hyperliquid',
};

/**
 * 各交易所的 defaultType：
 *   binanceusdm — 专用类，无需 defaultType
 *   okx/bybit/gate/bitget/hyperliquid — 永续合约用 'swap'
 *   coinbase — 无期货
 */
const DEFAULT_TYPE_MAP: Record<string, string> = {
  binanceusdm: 'future',   // binanceusdm 类内部已经是 USDT-M，此字段无实际影响
  okx: 'swap',             // OKX 永续合约（USDT-M）
  bybit: 'swap',           // Bybit 线性永续
  gate: 'swap',            // Gate 永续
  bitget: 'swap',          // Bitget 永续
  coinbase: 'spot',
  hyperliquid: 'swap',
};

// CCXT 订单状态 → 统一状态映射
function mapOrderStatus(status: string | undefined): OrderStatus {
  switch (status) {
    case 'open':
      return 'NEW';
    case 'closed':
      return 'FILLED';
    case 'canceled':
    case 'cancelled':
      return 'CANCELED';
    case 'expired':
      return 'EXPIRED';
    case 'rejected':
      return 'REJECTED';
    case 'partially_filled':
      return 'PARTIALLY_FILLED';
    default:
      return 'NEW';
  }
}

export interface CcxtAdapterConfig {
  exchangeType: string;
  apiKey?: string;
  apiSecret?: string;
  /** OKX 等交易所需要的 passphrase（CCXT 内部字段名为 password） */
  passphrase?: string;
  walletAddress?: string;
  privateKey?: string;
  isTestnet: boolean;
}

export class CcxtAdapter implements ExchangeAdapter, GridExchangeAdapter {
  readonly exchangeType: string;
  readonly category: ExchangeCategory;
  readonly isDex: boolean;
  readonly isTestnet: boolean;

  private exchange: ccxt.Exchange | null = null;
  private config: CcxtAdapterConfig;
  private readonly logger = new Logger(CcxtAdapter.name);

  constructor(config: CcxtAdapterConfig) {
    this.config = config;
    this.exchangeType = config.exchangeType;
    this.isDex = config.exchangeType === 'hyperliquid';
    this.isTestnet = config.isTestnet;
    this.category = this.isDex ? 'dex' : 'cex';
  }

  async initialize(): Promise<void> {
    const className =
      FUTURES_CLASS_MAP[this.exchangeType] || this.exchangeType;
    const ExchangeClass = (ccxt as any)[className];

    if (!ExchangeClass) {
      throw new Error(`CCXT 不支持交易所: ${className}`);
    }

    const defaultType = DEFAULT_TYPE_MAP[className] || 'swap';

    const options: any = {
      enableRateLimit: true,
      timeout: 60000,
      options: { defaultType, fetchCurrencies: false },
    };

    // CEX: API Key + Secret
    if (this.config.apiKey) {
      options.apiKey = this.config.apiKey;
      options.secret = this.config.apiSecret;
    }

    // OKX 等交易所需要 passphrase（CCXT 内部字段名为 password）
    if (this.config.passphrase) {
      options.password = this.config.passphrase;
    }

    // DEX (Hyperliquid): wallet + private key
    if (this.config.walletAddress) {
      options.walletAddress = this.config.walletAddress;
    }
    if (this.config.privateKey) {
      options.privateKey = this.config.privateKey;
    }

    // 测试网
    if (this.isTestnet) {
      options.sandbox = true;
    }

    this.exchange = new ExchangeClass(options);

    // 市场数据加载策略：缓存优先 → 网络回退
    // 原因：loadMarkets() 调用 exchangeInfo（60s超时 × 3次 = 最坏3分钟阻塞）
    // 优化：优先用 MarketDataService 已定期刷新的本地缓存（< 2h 视为新鲜），直接跳过网络请求
    const cacheFile = '/tmp/binance_exchangeinfo.json';
    let marketsLoaded = false;
    let lastLoadError: string = '';

    // Step 1：优先从本地缓存加载（2小时内有效）
    if (this.exchangeType === 'binance') {
      marketsLoaded = this.tryLoadMarketsFromCache(cacheFile, 2);
      if (marketsLoaded) {
        this.logger.debug(`[CcxtAdapter] 使用本地缓存市场数据（优先策略，无网络请求）`);
      }
    }

    // Step 2：缓存不可用时走网络（最多 2 次重试，延迟缩短）
    if (!marketsLoaded) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await this.exchange.loadMarkets();
          marketsLoaded = true;
          break;
        } catch (e: any) {
          lastLoadError = e.message;
          this.logger.warn(`加载市场数据失败(${attempt}/2): ${e.message}`);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }
    }

    // Step 3：网络也失败，使用宽松缓存（48h内均可用）
    if (!marketsLoaded) {
      marketsLoaded = this.tryLoadMarketsFromCache(cacheFile, 48);
      if (marketsLoaded) {
        this.logger.warn(`[CcxtAdapter] loadMarkets 网络失败，已降级到本地缓存`);
      }
    }

    if (!marketsLoaded) {
      throw new Error(
        `${this.exchangeType} loadMarkets 失败: ${lastLoadError}`,
      );
    }
  }

  isReady(): boolean {
    return this.exchange !== null;
  }

  async dispose(): Promise<void> {
    if (this.exchange) {
      try {
        // 关闭 WebSocket 连接（CCXT Pro / 支持 close() 的实例）
        if (typeof (this.exchange as any).close === 'function') {
          await (this.exchange as any).close();
        }
      } catch {
        // 忽略关闭错误
      }
      this.exchange = null;
    }
  }

  /** 获取底层 CCXT 实例（供内部使用） */
  getExchange(): ccxt.Exchange {
    if (!this.exchange) {
      throw new Error('适配器未初始化，请先调用 initialize()');
    }
    return this.exchange;
  }

  // ========================= 账户查询 =========================

  async getBalance(): Promise<ExchangeBalance> {
    const ex = this.getExchange();
    const balance = await ex.fetchBalance();
    const total = Number(balance.total?.['USDT'] || balance.total?.['USDC'] || 0);
    const free = Number(balance.free?.['USDT'] || balance.free?.['USDC'] || 0);
    const usedMargin = total - free;
    // 尝试从交易所原始数据提取未实现盈亏（Binance: totalUnrealizedProfit，OKX: totalUpl）
    const unrealizedPnl = Number(
      balance.info?.totalUnrealizedProfit ||
      balance.info?.totalUpl ||
      0,
    );
    return {
      totalEquity: total + unrealizedPnl,
      availableBalance: free,
      usedMargin,
      unrealizedPnl,
      marginUsedPct: (total + unrealizedPnl) > 0
        ? (usedMargin / (total + unrealizedPnl)) * 100
        : 0,
    };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const ex = this.getExchange();
    const positions = await ex.fetchPositions();
    return positions
      .filter((p: any) => Math.abs(Number(p.contracts || 0)) > 0)
      .map((p: any) => ({
        symbol: p.symbol,
        side: (p.side || 'long') as 'long' | 'short',
        quantity: Math.abs(Number(p.contracts || 0)),
        entryPrice: Number(p.entryPrice || 0),
        markPrice: Number(p.markPrice || 0),
        unrealizedPnl: Number(p.unrealizedPnl || 0),
        leverage: Math.max(1, Number(p.leverage) || parseInt(String(p.info?.leverage ?? ''), 10) || 1),
        marginMode: (p.marginMode || 'cross') as 'cross' | 'isolated',
        // 保证金：优先 positionInitialMargin (Binance)，次选 CCXT 标准 initialMargin，
        // 不使用 collateral（全仓时等于账户总权益，非持仓保证金）
        margin: Number(p.info?.positionInitialMargin || p.initialMargin || 0),
        // 交易所原始保证金比率（维持保证金/保证金余额），Binance 显示的风险比率
        marginRatio: Number(p.marginRatio || 0),
        liquidationPrice: p.liquidationPrice
          ? Number(p.liquidationPrice)
          : undefined,
      }));
  }

  // ========================= 开仓 / 平仓 =========================

  async openLong(
    symbol: string,
    quantity: number,
    _leverage: number,
  ): Promise<OrderResult> {
    // 注意：调用方（ai-execution.service / grid-trading.service）负责在调用前设置杠杆，
    // 此处不重复调用 setLeverage 以避免双重 API 调用。
    const ex = this.getExchange();
    const order = await ex.createMarketOrder(symbol, 'buy', quantity);
    return this.mapOrderResult(order);
  }

  async openShort(
    symbol: string,
    quantity: number,
    _leverage: number,
  ): Promise<OrderResult> {
    const ex = this.getExchange();
    const order = await ex.createMarketOrder(symbol, 'sell', quantity);
    return this.mapOrderResult(order);
  }

  async closeLong(symbol: string, quantity: number): Promise<OrderResult> {
    if (!quantity || quantity <= 0) {
      throw new Error(`closeLong 数量无效: ${quantity}，请传入正数`);
    }
    const ex = this.getExchange();
    const params: any = { reduceOnly: true };
    const order = await ex.createMarketOrder(symbol, 'sell', quantity, undefined, params);
    return this.mapOrderResult(order);
  }

  async closeShort(symbol: string, quantity: number): Promise<OrderResult> {
    if (!quantity || quantity <= 0) {
      throw new Error(`closeShort 数量无效: ${quantity}，请传入正数`);
    }
    const ex = this.getExchange();
    const params: any = { reduceOnly: true };
    const order = await ex.createMarketOrder(symbol, 'buy', quantity, undefined, params);
    return this.mapOrderResult(order);
  }

  // ========================= 杠杆 / 保证金 =========================

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    const ex = this.getExchange();
    try {
      await ex.setLeverage(leverage, symbol);
    } catch (e: any) {
      // 忽略"已设置"错误（Binance / Bybit 等均有此类响应）
      const msg: string = e.message || '';
      if (
        msg.includes('No need to change leverage') ||
        msg.includes('leverage not modified') ||
        msg.includes('Leverage should change')
      ) {
        return;
      }
      throw e;
    }
  }

  async setMarginMode(
    symbol: string,
    isCrossMargin: boolean,
  ): Promise<void> {
    const ex = this.getExchange();
    const mode = isCrossMargin ? 'cross' : 'isolated';
    try {
      await ex.setMarginMode(mode, symbol);
    } catch (e: any) {
      // 忽略"已设置"或"有持仓"错误
      const msg = e.message || '';
      if (
        msg.includes('No need to change margin type') ||
        msg.includes('-4046') ||
        msg.includes('-4048')
      ) {
        return;
      }
      throw e;
    }
  }

  // ========================= 市场数据 =========================

  async getMarketPrice(symbol: string): Promise<number> {
    const ex = this.getExchange();
    const ticker = await ex.fetchTicker(symbol);
    const price = ticker.last ?? ticker.close ?? ticker.bid ?? 0;
    if (!price || price <= 0) {
      throw new Error(
        `无法获取 ${symbol} 市场价格，ticker.last=${ticker.last}，请检查交易对是否正确`,
      );
    }
    return price;
  }

  // ========================= 止盈止损 =========================

  async setStopLoss(
    symbol: string,
    positionSide: string,
    quantity: number,
    stopPrice: number,
  ): Promise<void> {
    const ex = this.getExchange();
    const side = positionSide === 'long' ? 'sell' : 'buy';
    const exchangeId = (ex.id ?? '').toLowerCase();

    if (exchangeId === 'okx') {
      // OKX 对冲模式：需要 posSide，不支持 reduceOnly
      const params: Record<string, any> = {
        triggerPrice: stopPrice,
        posSide: positionSide === 'long' ? 'long' : 'short',
      };
      await ex.createOrder(symbol, 'stop_market', side, quantity, undefined, params);

    } else if (exchangeId === 'bybit') {
      // Bybit 线性永续：positionIdx 区分单向/对冲
      const params: Record<string, any> = {
        triggerPrice: stopPrice,
        triggerBy: 'MarkPrice',
        reduceOnly: true,
        positionIdx: positionSide === 'long' ? 1 : 2,
      };
      await ex.createOrder(symbol, 'stop_market', side, quantity, undefined, params);

    } else {
      // Binance USDM / Gate / Bitget 通用参数
      const params: Record<string, any> = {
        stopPrice,
        reduceOnly: true,
      };
      await ex.createOrder(symbol, 'stop_market', side, quantity, undefined, params);
    }
  }

  async setTakeProfit(
    symbol: string,
    positionSide: string,
    quantity: number,
    takeProfitPrice: number,
  ): Promise<void> {
    const ex = this.getExchange();
    const side = positionSide === 'long' ? 'sell' : 'buy';
    const exchangeId = (ex.id ?? '').toLowerCase();

    if (exchangeId === 'okx') {
      const params: Record<string, any> = {
        triggerPrice: takeProfitPrice,
        posSide: positionSide === 'long' ? 'long' : 'short',
      };
      await ex.createOrder(symbol, 'take_profit_market', side, quantity, undefined, params);

    } else if (exchangeId === 'bybit') {
      const params: Record<string, any> = {
        triggerPrice: takeProfitPrice,
        triggerBy: 'MarkPrice',
        reduceOnly: true,
        positionIdx: positionSide === 'long' ? 1 : 2,
      };
      await ex.createOrder(symbol, 'take_profit_market', side, quantity, undefined, params);

    } else {
      const params: Record<string, any> = {
        stopPrice: takeProfitPrice,
        reduceOnly: true,
      };
      await ex.createOrder(symbol, 'take_profit_market', side, quantity, undefined, params);
    }
  }

  // ========================= 订单管理 =========================

  async cancelAllOrders(symbol: string): Promise<void> {
    const ex = this.getExchange();
    try {
      await ex.cancelAllOrders(symbol);
    } catch (e: any) {
      const msg: string = e.message || '';
      // 交易所在没有挂单时有些会抛错（如 Gate、Bitget），属于正常情况，静默处理
      if (
        msg.includes('No orders') ||
        msg.includes('no orders') ||
        msg.includes('order not found') ||
        msg.includes('Order does not exist')
      ) {
        return;
      }
      this.logger.warn(`cancelAllOrders(${symbol}) 失败（可忽略）: ${msg}`);
    }
  }

  async cancelStopOrders(symbol: string): Promise<void> {
    const ex = this.getExchange();
    const openOrders = await ex.fetchOpenOrders(symbol);
    const stopOrders = openOrders.filter(
      (o: any) =>
        o.type?.includes('stop') || o.type?.includes('take_profit'),
    );
    for (const order of stopOrders) {
      try {
        await ex.cancelOrder(order.id, symbol);
      } catch {
        // 订单可能已被取消
      }
    }
  }

  async getOrderStatus(
    symbol: string,
    orderId: string,
  ): Promise<OrderStatusDetail> {
    const ex = this.getExchange();
    const order = await ex.fetchOrder(orderId, symbol);
    return {
      status: mapOrderStatus(order.status),
      avgPrice: Number(order.average || order.price || 0),
      filledQuantity: Number(order.filled || 0),
      fee: Number(order.fee?.cost || 0),
    };
  }

  async getOpenOrders(symbol: string): Promise<OpenOrder[]> {
    const ex = this.getExchange();
    const orders = await ex.fetchOpenOrders(symbol);
    return orders.map((o: any) => {
      // 尝试从交易所原始字段中读取真实的 positionSide
      // Binance: o.info.positionSide ('LONG'/'SHORT'/'BOTH')
      // OKX: o.info.posSide ('long'/'short'/'net')
      const rawPosSide: string =
        o.info?.positionSide?.toLowerCase() ||
        o.info?.posSide?.toLowerCase() ||
        '';
      const positionSide: 'long' | 'short' =
        rawPosSide === 'long' || rawPosSide === 'short'
          ? rawPosSide
          : (o.side === 'sell' ? 'long' : 'short'); // sell 减仓 → 原仓为 long

      return {
        orderId: o.id,
        symbol: o.symbol,
        side: (o.side || 'buy') as 'buy' | 'sell',
        positionSide,
        type: (o.type || 'limit') as OpenOrder['type'],
        price: o.price ? Number(o.price) : undefined,
        stopPrice: o.stopPrice ? Number(o.stopPrice) : undefined,
        quantity: Number(o.amount || 0),
        status: o.status || 'open',
      };
    });
  }

  // ========================= 精度 =========================

  async formatQuantity(symbol: string, quantity: number): Promise<string> {
    const ex = this.getExchange();

    // 3 层精度降级策略（移植自 ai-execution.service.ts）
    try {
      return ex.amountToPrecision(symbol, quantity);
    } catch {
      const market = ex.market(symbol);
      // step size：优先 precision.amount（CCXT 标准，表示小数位数或步长），
      // 次选 limits.amount.step，最后降级到 limits.amount.min（语义不同但通常接近）
      const precisionAmount = market?.precision?.amount;
      if (precisionAmount !== undefined) {
        if (typeof precisionAmount === 'number' && precisionAmount < 1) {
          // precisionAmount 为步长值（如 0.001）
          const adjusted = Math.floor(quantity / precisionAmount) * precisionAmount;
          return adjusted.toFixed(
            Math.max(0, -Math.floor(Math.log10(precisionAmount))),
          );
        }
        if (typeof precisionAmount === 'number' && precisionAmount >= 1) {
          // precisionAmount 为小数位数
          return quantity.toFixed(precisionAmount);
        }
      }
      const step = (market?.limits?.amount as any)?.step || market?.limits?.amount?.min;
      if (step) {
        const adjusted = Math.floor(quantity / step) * step;
        return adjusted.toString();
      }
      // fallback 3: 3 位小数
      return quantity.toFixed(3);
    }
  }

  async getMarketPrecision(symbol: string): Promise<MarketPrecision> {
    const ex = this.getExchange();
    const market = ex.market(symbol);
    const precisionAmount = market?.precision?.amount;
    const quantityPrecision =
      typeof precisionAmount === 'number' && precisionAmount >= 1
        ? precisionAmount
        : 3;
    // stepSize：优先 precision.amount（步长值），次选 limits.amount.step，最后降级到 min
    const stepSize =
      (typeof precisionAmount === 'number' && precisionAmount < 1 ? precisionAmount : null) ||
      (market?.limits?.amount as any)?.step ||
      market?.limits?.amount?.min ||
      0.001;

    return {
      symbol,
      pricePrecision:
        typeof market.precision?.price === 'number'
          ? market.precision.price
          : 2,
      quantityPrecision,
      minQuantity: market.limits?.amount?.min || 0,
      minNotional: market.limits?.cost?.min || 0,
      tickSize:
        typeof market.precision?.price === 'number'
          ? Math.pow(10, -market.precision.price)
          : 0.01,
      stepSize,
    };
  }

  // ========================= 限价单（网格交易专用） =========================

  async placeLimitOrder(req: LimitOrderRequest): Promise<LimitOrderResult> {
    const ex = this.getExchange();
    const params: any = {};

    // 对冲模式下设置 positionSide
    if (req.positionSide) {
      params.positionSide = req.positionSide;
    }
    if (req.postOnly) {
      params.postOnly = true;
    }
    if (req.reduceOnly) {
      params.reduceOnly = true;
    }
    if (req.clientId) {
      params.clientOrderId = req.clientId;
    }

    const order = await ex.createOrder(
      req.symbol,
      'limit',
      req.side,
      req.quantity,
      req.price,
      params,
    );

    return {
      orderId: order.id,
      clientId: req.clientId,
      symbol: order.symbol || req.symbol,
      side: req.side,
      positionSide: req.positionSide,
      price: req.price,
      quantity: req.quantity,
      status: order.status || 'open',
    };
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    const ex = this.getExchange();
    await ex.cancelOrder(orderId, symbol);
  }

  async getOrderBook(symbol: string, depth: number): Promise<OrderBookSnapshot> {
    const ex = this.getExchange();
    const book = await ex.fetchOrderBook(symbol, depth);
    return {
      bids: (book.bids || []).map((b: any) => [Number(b[0]), Number(b[1])]),
      asks: (book.asks || []).map((a: any) => [Number(a[0]), Number(a[1])]),
      timestamp: book.timestamp || Date.now(),
    };
  }

  // ========================= 历史数据 =========================

  async getClosedPnl(
    _startTime: Date,
    _limit: number,
  ): Promise<ClosedPnlRecord[]> {
    // CCXT 不统一支持此接口，返回空数组
    return [];
  }

  // ========================= 内部辅助 =========================

  /**
   * 尝试从本地缓存文件加载市场数据。
   * exchangeInfo 是结构性数据（精度/最小量/合约规格），Binance 极少变更，缓存安全。
   * @param cacheFile 缓存文件路径
   * @param maxAgeHours 最大允许缓存年龄（小时）
   * @returns 是否加载成功
   */
  private tryLoadMarketsFromCache(cacheFile: string, maxAgeHours: number): boolean {
    try {
      if (!fs.existsSync(cacheFile)) return false;
      const stat = fs.statSync(cacheFile);
      const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
      if (ageHours > maxAgeHours) return false;

      const raw = fs.readFileSync(cacheFile, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.symbols || data.symbols.length < 100) return false;

      const ex = this.exchange as any;
      if (typeof ex.parseMarkets === 'function') {
        const markets = ex.parseMarkets(data.symbols);
        this.exchange!.setMarkets(markets);
      } else {
        const marketDict: Record<string, any> = {};
        for (const s of data.symbols) {
          const sym = `${s.baseAsset}/${s.quoteAsset}:${s.marginAsset || s.quoteAsset}`;
          marketDict[sym] = {
            id: s.symbol, symbol: sym,
            base: s.baseAsset, quote: s.quoteAsset,
            baseId: s.baseAsset, quoteId: s.quoteAsset,
            active: s.status === 'TRADING',
            type: 'swap', spot: false, future: true, linear: true,
            info: s,
            precision: { amount: s.quantityPrecision, price: s.pricePrecision },
            limits: { amount: { min: undefined, max: undefined }, price: { min: undefined, max: undefined } },
          };
        }
        this.exchange!.setMarkets(Object.values(marketDict));
      }
      return true;
    } catch {
      return false;
    }
  }

  private mapOrderResult(order: ccxt.Order): OrderResult {
    return {
      orderId: order.id,
      symbol: order.symbol || '',
      side: (order.side || 'buy') as 'buy' | 'sell',
      avgPrice: Number(order.average || order.price || 0),
      quantity: Number(order.amount || 0),
      filledQuantity: Number(order.filled || 0),
      fee: Number(order.fee?.cost || 0),
      status: mapOrderStatus(order.status),
    };
  }
}
