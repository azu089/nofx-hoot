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

  /** OKX 持仓模式：long_short_mode（双向）或 net_mode（单向）。undefined = 非 OKX 或未检测 */
  okxPositionMode?: 'long_short_mode' | 'net_mode';

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

    // OKX 网格策略必须禁用 CCXT 的 hedged 自动 posSide 注入
    // CCXT OKX createOrderRequest() 内部：
    //   [hedged, params] = this.handleOptionAndParams(params, 'createOrder', 'hedged');
    //   if (hedged) { request['posSide'] = isBuy ? 'long' : 'short'; }  ← 触发 51000
    // 设 hedged=false 彻底阻断此路径，net_mode 下不需要 posSide
    if (this.exchangeType === 'okx') {
      options.options.hedged = false;
    }

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

    // OKX 特殊处理：对齐 nofx okx/trader.go 初始化逻辑
    // 1. 检测当前 posMode (long_short_mode | net_mode)
    // 2. 若非双向持仓，尝试切换（有仓位时交易所会拒绝，属正常）
    // 3. 缓存结果，下单时按 mode 决定是否发 posSide
    if (this.exchangeType === 'okx') {
      await this.detectAndSetOkxPositionMode();
    }
  }

  /** 检测并尝试设置 OKX 双向持仓模式（对齐 nofx okx/trader.go） */
  private async detectAndSetOkxPositionMode(): Promise<void> {
    const ex = this.exchange!;
    try {
      // GET /api/v5/account/config
      const resp = await (ex as any).privateGetAccountConfig({});
      const configs = resp?.data as Array<{ posMode: string }> | undefined;
      if (configs && configs.length > 0) {
        const detected = configs[0].posMode as 'long_short_mode' | 'net_mode';
        this.okxPositionMode = detected;
        this.logger.log(`[OKX] 检测到持仓模式: ${detected}`);
      } else {
        this.okxPositionMode = 'net_mode'; // 无数据时保守默认 net_mode
        this.logger.warn(`[OKX] 持仓模式数据为空，默认 net_mode`);
      }
    } catch (e: any) {
      // 无法检测时默认 net_mode（网格策略用 net_mode 更安全）
      this.logger.warn(`[OKX] 持仓模式检测失败，默认 net_mode: ${e.message}`);
      this.okxPositionMode = 'net_mode';
    }

    // 网格策略需要 net_mode（单向持仓）：
    // - net_mode 可自由下买卖单，无需 posSide
    // - long_short_mode 下，卖单 = 平多，空网格里没有多头会被 OKX 51000 拒绝
    // 若当前是双向持仓（long_short_mode），尝试切换到单向
    if (this.okxPositionMode === 'long_short_mode') {
      try {
        await (ex as any).privatePostAccountSetPositionMode({ posMode: 'net_mode' });
        this.okxPositionMode = 'net_mode';
        this.logger.log(`[OKX] 已自动切换到单向持仓模式 (net_mode)，网格策略兼容`);
      } catch (e: any) {
        // 有仓位时切换会失败，保持 long_short_mode
        this.logger.warn(`[OKX] 切换 net_mode 失败（可能有未平仓位），维持 long_short_mode: ${e.message}`);
      }
    } else {
      this.logger.log(`[OKX] 已在 net_mode，网格策略无需 posSide`);
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
        // 优先使用 Binance 原始字段 p.info.leverage（合约杠杆倍数字符串），
        // CCXT 标准化的 p.leverage 在全仓模式下可能被错误归一化为 1
        leverage: Math.max(1, parseInt(String(p.info?.leverage ?? ''), 10) || Number(p.leverage) || 1),
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

    if (this.exchangeType === 'okx') {
      // OKX：先尝试双向持仓模式（posSide=long）
      // 参照 nofx okx/trader.go CloseShort：明确指定 posSide 确保平仓语义
      try {
        const order = await ex.createMarketOrder(symbol, 'sell', quantity, undefined, { posSide: 'long' });
        return this.mapOrderResult(order);
      } catch (e: any) {
        const msg = (e?.message ?? '').toLowerCase();
        // 51015: Redundant position side — 账户为单向持仓模式，posSide 不适用
        // 51017: posSide parameter error
        // 51170: reduceOnly 在单向持仓模式下与持仓方向冲突
        if (
          msg.includes('51015') || msg.includes('51017') || msg.includes('51170') ||
          msg.includes('position mode') || msg.includes('possid')
        ) {
          this.logger.warn(`[CcxtAdapter] OKX closeLong: 双向模式失败，回退单向模式（无 reduceOnly）: ${e.message}`);
          // 单向持仓(net_mode)：直接普通市价卖单即可平多，OKX 自动减少多头
          // 禁止加 reduceOnly=true，否则触发 51170 错误
          const order = await ex.createMarketOrder(symbol, 'sell', quantity, undefined, {});
          return this.mapOrderResult(order);
        }
        throw e;
      }
    }

    const order = await ex.createMarketOrder(symbol, 'sell', quantity, undefined, { reduceOnly: true });
    return this.mapOrderResult(order);
  }

  async closeShort(symbol: string, quantity: number): Promise<OrderResult> {
    if (!quantity || quantity <= 0) {
      throw new Error(`closeShort 数量无效: ${quantity}，请传入正数`);
    }
    const ex = this.getExchange();

    if (this.exchangeType === 'okx') {
      // OKX：先尝试双向持仓模式（posSide=short）
      // 参照 nofx okx/trader.go CloseShort：buy + posSide=short = 平空，不需要额外保证金
      try {
        const order = await ex.createMarketOrder(symbol, 'buy', quantity, undefined, { posSide: 'short' });
        return this.mapOrderResult(order);
      } catch (e: any) {
        const msg = (e?.message ?? '').toLowerCase();
        // 51015: Redundant position side — 账户为单向持仓模式
        // 51017: posSide parameter error
        // 51170: reduceOnly 在单向持仓模式下与持仓方向冲突
        if (
          msg.includes('51015') || msg.includes('51017') || msg.includes('51170') ||
          msg.includes('position mode') || msg.includes('possid')
        ) {
          this.logger.warn(`[CcxtAdapter] OKX closeShort: 双向模式失败，回退单向模式（无 reduceOnly）: ${e.message}`);
          // 单向持仓(net_mode)：直接普通市价买单即可平空，OKX 自动减少空头
          // 禁止加 reduceOnly=true，否则触发 51170 错误
          const order = await ex.createMarketOrder(symbol, 'buy', quantity, undefined, {});
          return this.mapOrderResult(order);
        }
        throw e;
      }
    }

    const order = await ex.createMarketOrder(symbol, 'buy', quantity, undefined, { reduceOnly: true });
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
      // OKX 止损：优先单向持仓模式（reduceOnly，不带 posSide）
      // 若失败 (51015/51017) 则回退到对冲持仓模式（带 posSide: long/short）
      const params: Record<string, any> = {
        triggerPrice: stopPrice,
        reduceOnly: true,  // 单向持仓模式
      };
      try {
        await ex.createOrder(symbol, 'stop_market', side, quantity, undefined, params);
      } catch (e: any) {
        const eMsgLower = (e.message ?? '').toLowerCase();
        if (eMsgLower.includes('51015') || eMsgLower.includes('51017') || eMsgLower.includes('possid')) {
          // 对冲持仓模式：必须指定 posSide
          delete params.reduceOnly;
          params.posSide = positionSide === 'long' ? 'long' : 'short';
          await ex.createOrder(symbol, 'stop_market', side, quantity, undefined, params);
        } else {
          throw e;
        }
      }

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
      // OKX 止盈：同止损，优先单向持仓模式，失败回退到对冲模式
      const params: Record<string, any> = {
        triggerPrice: takeProfitPrice,
        reduceOnly: true,
      };
      try {
        await ex.createOrder(symbol, 'take_profit_market', side, quantity, undefined, params);
      } catch (e: any) {
        const eMsgLower = (e.message ?? '').toLowerCase();
        if (eMsgLower.includes('51015') || eMsgLower.includes('51017') || eMsgLower.includes('possid')) {
          delete params.reduceOnly;
          params.posSide = positionSide === 'long' ? 'long' : 'short';
          await ex.createOrder(symbol, 'take_profit_market', side, quantity, undefined, params);
        } else {
          throw e;
        }
      }

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

    // 提取 PERCENT_PRICE 过滤器（Binance 合约特有，限制订单价格偏离标记价范围）
    let percentPriceDown: number | undefined;
    let percentPriceUp: number | undefined;
    if (market.info?.filters && Array.isArray(market.info.filters)) {
      const ppf = (market.info.filters as any[]).find(
        (f: any) => f.filterType === 'PERCENT_PRICE',
      );
      if (ppf) {
        const d = parseFloat(ppf.multiplierDown);
        const u = parseFloat(ppf.multiplierUp);
        if (d > 0 && d < 10) percentPriceDown = d;
        if (u > 0 && u < 100) percentPriceUp = u;
      }
    }

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
      percentPriceDown,
      percentPriceUp,
    };
  }

  // ========================= 限价单（网格交易专用） =========================

  async placeLimitOrder(req: LimitOrderRequest): Promise<LimitOrderResult> {
    const ex = this.getExchange();
    const params: any = {};

    // 对冲模式下设置 positionSide
    // OKX API 参数名为 posSide（小写 'long'/'short'）
    // Binance API 参数名为 positionSide（大写 'LONG'/'SHORT'）
    if (req.positionSide) {
      if (this.exchangeType === 'okx') {
        params.posSide = req.positionSide;           // OKX: 小写
      } else {
        params.positionSide = req.positionSide.toUpperCase(); // Binance: 大写
      }
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
    // Binance USDM 平仓订单在 info.realizedPnl 中携带已实现盈亏
    const rawPnl = (order.info as any)?.realizedPnl;
    const realizedPnl = rawPnl != null ? Number(rawPnl) : undefined;

    return {
      orderId: order.id,
      symbol: order.symbol || '',
      side: (order.side || 'buy') as 'buy' | 'sell',
      avgPrice: Number(order.average || order.price || 0),
      quantity: Number(order.amount || 0),
      filledQuantity: Number(order.filled || 0),
      fee: Number(order.fee?.cost || 0),
      status: mapOrderStatus(order.status),
      ...(realizedPnl !== undefined ? { realizedPnl } : {}),
    };
  }
}
