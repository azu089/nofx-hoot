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

    // OKX 特殊处理：初始化时检测并设置双向持仓模式
    // 1. 检测当前 posMode (long_short_mode | net_mode)
    // 2. 若非双向持仓，尝试切换（有仓位时交易所会拒绝，属正常）
    // 3. 缓存结果，下单时按 mode 决定是否发 posSide
    if (this.exchangeType === 'okx') {
      await this.detectAndSetOkxPositionMode();
    }
  }

  /** 检测并尝试设置 OKX 双向持仓模式 */
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
    const activePositions = positions.filter((p: any) => Math.abs(Number(p.contracts || 0)) > 0);

    // Binance 全仓模式 fetchPositions 不返回 leverage — 通过 positionRisk 原生 API 补充
    // leverageMap: symbol → leverage（仅在需要时才调用 API）
    let leverageMap: Map<string, number> | undefined;
    const needsLeverage = activePositions.some(
      (p: any) => p.leverage == null && (p.info?.leverage == null),
    );
    if (needsLeverage && ex.id?.includes('binance')) {
      try {
        // Binance 原生 API: GET /fapi/v2/positionRisk — 始终返回 leverage 字段
        const riskData: any[] = await (ex as any).fapiPrivateV2GetPositionRisk();
        leverageMap = new Map();
        for (const r of riskData) {
          if (r.symbol && r.leverage) {
            leverageMap.set(r.symbol, parseInt(String(r.leverage), 10) || 1);
          }
        }
        this.logger.debug(`[CcxtAdapter] positionRisk 补充杠杆: ${leverageMap.size} 个交易对`);
      } catch (e: any) {
        this.logger.warn(`[CcxtAdapter] positionRisk 获取失败: ${e.message}`);
      }
    }

    return activePositions.map((p: any) => {
        // OKX 单向模式返回 side='net'，contracts 正值=多头，负值=空头；统一归一化为 long/short
        const rawSide = p.side as string;
        const rawQty = Number(p.contracts || 0);
        let normSide: 'long' | 'short';
        if (rawSide === 'net' || !rawSide) {
          normSide = rawQty >= 0 ? 'long' : 'short';
        } else {
          normSide = (rawSide as 'long' | 'short');
        }

        // 杠杆优先级：p.info.leverage > p.leverage > positionRisk API > 1
        const ccxtSymbol = p.symbol as string; // 'SOL/USDT:USDT'
        const rawSymbol = p.info?.symbol as string; // 'SOLUSDT'
        let leverage = parseInt(String(p.info?.leverage ?? ''), 10) || Number(p.leverage) || 0;
        if (!leverage && leverageMap) {
          leverage = leverageMap.get(rawSymbol) ?? 0;
          if (leverage) {
            this.logger.log(`[CcxtAdapter] ${ccxtSymbol} leverage 从 positionRisk 补充: ${leverage}x`);
          }
        }
        leverage = Math.max(1, leverage);

        return {
        symbol: p.symbol,
        side: normSide,
        quantity: Math.abs(rawQty),
        entryPrice: Number(p.entryPrice || 0),
        markPrice: Number(p.markPrice || 0),
        unrealizedPnl: Number(p.unrealizedPnl || 0),
        leverage,
        marginMode: (p.marginMode || 'cross') as 'cross' | 'isolated',
        // 保证金：优先 positionInitialMargin (Binance)，次选 CCXT 标准 initialMargin，
        // 不使用 collateral（全仓时等于账户总权益，非持仓保证金）
        margin: Number(p.info?.positionInitialMargin || p.initialMargin || 0),
        // 交易所原始保证金比率（维持保证金/保证金余额），Binance 显示的风险比率
        marginRatio: Number(p.marginRatio || 0),
        liquidationPrice: p.liquidationPrice
          ? Number(p.liquidationPrice)
          : undefined,
        };
      });
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
      // 对齐 nofx: 先判断 positionMode，再决定是否带 posSide，不靠 try/catch 容错
      // net_mode 下 posSide='long' 会被 OKX 解读为"开多"而非"平多"，触发 51008 保证金错误
      if (this.okxPositionMode === 'long_short_mode') {
        // 双向持仓模式：sell + posSide=long = 平多仓
        const order = await ex.createMarketOrder(symbol, 'sell', quantity, undefined, { posSide: 'long' });
        return this.fetchPnlFromFills(order, symbol);
      } else {
        // net_mode（单向持仓）：reduceOnly=true 告知 OKX 仅减仓，绕过开多保证金检查（51008）
        const order = await ex.createMarketOrder(symbol, 'sell', quantity, undefined, { reduceOnly: true });
        return this.fetchPnlFromFills(order, symbol);
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
      // 对齐 nofx: 先判断 positionMode，再决定是否带 posSide，不靠 try/catch 容错
      // net_mode 下 posSide='short' 会被 OKX 解读为"开空"而非"平空"，触发 51008 保证金错误
      if (this.okxPositionMode === 'long_short_mode') {
        // 双向持仓模式：buy + posSide=short = 平空仓
        const order = await ex.createMarketOrder(symbol, 'buy', quantity, undefined, { posSide: 'short' });
        return this.fetchPnlFromFills(order, symbol);
      } else {
        // net_mode（单向持仓）：reduceOnly=true 告知 OKX 仅减仓，绕过开空保证金检查（51008）
        const order = await ex.createMarketOrder(symbol, 'buy', quantity, undefined, { reduceOnly: true });
        return this.fetchPnlFromFills(order, symbol);
      }
    }

    const order = await ex.createMarketOrder(symbol, 'buy', quantity, undefined, { reduceOnly: true });
    return this.mapOrderResult(order);
  }

  /**
   * OKX 专用：平仓订单创建后，从 fills 取准确的 realizedPnl
   * OKX 市价单创建响应中 info.pnl 通常为 '0'，需查 fills 取实际已实现盈亏
   * 仅用于 closeLong / closeShort（平仓操作），开仓不需要
   */
  private async fetchPnlFromFills(order: ccxt.Order, symbol: string): Promise<OrderResult> {
    const result = this.mapOrderResult(order);
    // 若 mapOrderResult 已拿到非零 pnl，直接返回
    if (result.realizedPnl !== undefined && result.realizedPnl !== 0) return result;

    try {
      const ex = this.getExchange();
      // fetchOrderTrades: 获取该订单的所有成交明细（包含 info.pnl）
      const fills = await ex.fetchOrderTrades(order.id, symbol);
      if (fills && fills.length > 0) {
        const totalPnl = fills.reduce((sum: number, f: any) => {
          return sum + Number((f.info as any)?.pnl ?? 0);
        }, 0);
        if (totalPnl !== 0) {
          result.realizedPnl = totalPnl;
        }
      }
    } catch {
      // best-effort：失败不影响平仓流程，PnL 回退到 grid-trading.service 本地计算
    }
    return result;
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
      // Binance USDM: 对齐 nofx，使用 Algo Order API + closePosition=true
      // closePosition=true 表示触发时平掉整个持仓，AI主动平仓后持仓=0，条件单自动失效
      // 不需要手动清理条件单，避免 cancelAllOrders 误删网格限价单
      const marketId = ex.marketId(symbol);
      // 单向持仓模式用 BOTH，双向用 LONG/SHORT
      const posSide = 'BOTH';
      try {
        await (ex as any).fapiPrivatePostAlgoOrder({
          symbol: marketId,
          side: side.toUpperCase(),
          positionSide: posSide,
          type: 'STOP_MARKET',
          triggerPrice: String(stopPrice),
          workingType: 'CONTRACT_PRICE',
          closePosition: 'true',
          newClientOrderId: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        });
      } catch (e: any) {
        // 降级：Algo Order 不可用时，用普通 STOP_MARKET
        this.logger.warn(`[CcxtAdapter] Algo SL 失败(${e.message})，降级普通 STOP_MARKET`);
        await ex.createOrder(symbol, 'stop_market', side, quantity, undefined, {
          stopPrice,
          reduceOnly: true,
        });
      }
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
      // Binance USDM: 对齐 nofx，使用 Algo Order API + closePosition=true
      const marketId = ex.marketId(symbol);
      const posSide = 'BOTH'; // 单向持仓模式
      try {
        await (ex as any).fapiPrivatePostAlgoOrder({
          symbol: marketId,
          side: side.toUpperCase(),
          positionSide: posSide,
          type: 'TAKE_PROFIT_MARKET',
          triggerPrice: String(takeProfitPrice),
          workingType: 'CONTRACT_PRICE',
          closePosition: 'true',
          newClientOrderId: `tp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        });
      } catch (e: any) {
        // 降级：普通 TAKE_PROFIT_MARKET
        this.logger.warn(`[CcxtAdapter] Algo TP 失败(${e.message})，降级普通 TAKE_PROFIT_MARKET`);
        await ex.createOrder(symbol, 'take_profit_market', side, quantity, undefined, {
          stopPrice: takeProfitPrice,
          reduceOnly: true,
        });
      }
    }
  }

  // ========================= 订单管理 =========================

  async cancelAllOrders(symbol: string): Promise<void> {
    const ex = this.getExchange();
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (this.exchangeType === 'okx') {
          // OKX: cancelAllOrders 不支持，直接逐个取消
          const openOrders = await ex.fetchOpenOrders(symbol);
          for (const order of openOrders) {
            try { await ex.cancelOrder(order.id, symbol); } catch { /* 可能已取消 */ }
          }
        } else {
          await ex.cancelAllOrders(symbol);
        }
      } catch (e: any) {
        const msg: string = e.message || '';
        // 交易所在没有挂单时有些会抛错（如 Gate、Bitget），属于正常情况，静默处理
        if (
          msg.includes('No orders') ||
          msg.includes('no orders') ||
          msg.includes('order not found') ||
          msg.includes('Order does not exist')
        ) {
          break; // 跳出重试循环，继续清理算法单
        }
        this.logger.warn(`cancelAllOrders(${symbol}) attempt ${attempt} 失败: ${msg}`);
      }

      // 验证：检查是否还有残留挂单
      try {
        const remaining = await ex.fetchOpenOrders(symbol);
        if (!remaining || remaining.length === 0) {
          if (attempt > 1) {
            this.logger.log(`cancelAllOrders(${symbol}): 第${attempt}轮成功，全部清理完毕`);
          }
          break; // 普通单已清完，继续清理算法单
        }

        if (attempt < MAX_RETRIES) {
          this.logger.warn(
            `cancelAllOrders(${symbol}): 第${attempt}轮后仍有 ${remaining.length} 个残留挂单，重试...`,
          );
          // 逐个取消残留订单（兜底）
          for (const order of remaining) {
            try {
              await ex.cancelOrder(order.id, symbol);
            } catch {
              // 订单可能已被取消或成交，忽略
            }
          }
        } else {
          this.logger.error(
            `cancelAllOrders(${symbol}): ${MAX_RETRIES}轮后仍有 ${remaining.length} 个残留挂单，放弃重试`,
          );
        }
      } catch (verifyErr: any) {
        this.logger.warn(`cancelAllOrders(${symbol}): 验证残留挂单失败: ${verifyErr.message}`);
        break; // 无法验证，跳出循环，继续清理算法单
      }
    }

    // OKX 算法单（条件委托）使用独立 API，cancelAllOrders 不会覆盖
    if (this.exchangeType === 'okx') {
      await this.cancelOkxAlgoOrders(symbol);
    }

    // 对齐 nofx CancelAllOrders: Binance Algo Order 也要清理
    // nofx binance/futures.go L704: t.client.NewCancelAllAlgoOpenOrdersService()
    if (this.exchangeType === 'binance' || this.exchangeType === 'binanceusdm') {
      await this.cancelBinanceAlgoOrders(symbol);
    }
  }

  async cancelStopOrders(symbol: string): Promise<void> {
    const ex = this.getExchange();

    // Binance/Bybit: 清理条件单（普通 STOP/TP + Algo Order），保留限价基础单
    // 对齐 nofx binance/futures.go CancelStopLossOrders + CancelTakeProfitOrders
    if (this.exchangeType === 'binance' || this.exchangeType === 'binanceusdm' || this.exchangeType === 'bybit') {
      // 1. 清理普通条件单（legacy API）
      try {
        const rawOrders = await ex.fapiPrivateGetOpenOrders({ symbol: ex.marketId(symbol) });
        const stopOrders = (Array.isArray(rawOrders) ? rawOrders : []).filter(
          (o: any) => ['STOP_MARKET', 'TAKE_PROFIT_MARKET', 'STOP', 'TAKE_PROFIT', 'TRAILING_STOP_MARKET'].includes(o.type),
        );
        if (stopOrders.length > 0) {
          for (const o of stopOrders) {
            try {
              await ex.cancelOrder(o.orderId, symbol);
            } catch (e: any) {
              if (!e.message?.includes('-2011')) {
                this.logger.warn(`[CcxtAdapter] cancelStopOrder(${o.orderId}) 失败: ${e.message}`);
              }
            }
          }
          this.logger.log(`[CcxtAdapter] cancelStopOrders: ${symbol} 已清除 ${stopOrders.length} 个普通条件单（保留限价单）`);
        }
      } catch (e: any) {
        this.logger.warn(`[CcxtAdapter] cancelStopOrders(${symbol}) 普通条件单清理失败: ${e.message}`);
      }

      // 2. 清理 Algo Order（Binance 已迁移 SL/TP 到 Algo 系统）
      // 对齐 nofx binance/futures.go L573-594: Cancel Algo stop-loss/take-profit orders
      if (this.exchangeType === 'binance' || this.exchangeType === 'binanceusdm') {
        await this.cancelBinanceAlgoOrders(symbol);
      }
      return;
    }

    // OKX: 只清理算法单（条件委托/止盈止损），保留限价基础单
    if (this.exchangeType === 'okx') {
      // OKX 的条件单走算法单 API，普通 fetchOpenOrders 不返回条件单
      // 所以只需要清算法单，不碰普通限价单
      await this.cancelOkxAlgoOrders(symbol);
      return;
    }

    // 其他交易所：只清条件单类型，保留限价单
    const openOrders = await ex.fetchOpenOrders(symbol);
    const stopOrders = openOrders.filter(
      (o: any) => {
        const t = (o.type || '').toLowerCase();
        return t.includes('stop') || t.includes('take_profit') || t.includes('trailing');
      },
    );
    for (const order of stopOrders) {
      try { await ex.cancelOrder(order.id, symbol); } catch { /* 已取消 */ }
    }
  }

  /** OKX 算法单（条件委托/止盈止损）使用独立 API，普通 cancelAllOrders 无法取消 */
  private async cancelOkxAlgoOrders(symbol: string): Promise<void> {
    try {
      const ex = this.getExchange();
      const market = ex.market(symbol);
      const instId = market?.id || symbol;

      // 拉取所有待执行的算法单（条件单、OCO、触发单等）
      const response = await (ex as any).privateGetTradeOrdersAlgoPending({
        instId,
        ordType: 'conditional,oco,trigger,move_order_stop,iceberg,twap',
      });

      const algoOrders: any[] = response?.data ?? [];
      if (algoOrders.length === 0) return;

      this.logger.log(`[OKX] 发现 ${algoOrders.length} 个算法单，逐个取消...`);

      // OKX 逐个取消算法单（批量 API 参数格式易出错，逐个更可靠）
      for (const o of algoOrders) {
        try {
          await (ex as any).privatePostTradeCancelAlgos([{
            algoId: o.algoId,
            instId,
          }]);
        } catch (e: any) {
          this.logger.warn(`[OKX] 取消算法单 ${o.algoId} 失败: ${e.message}`);
        }
      }

      this.logger.log(`[OKX] 已取消 ${algoOrders.length} 个算法单`);
    } catch (e: any) {
      this.logger.warn(`[OKX] 取消算法单失败(非致命): ${e.message}`);
    }
  }

  /**
   * Binance Algo Order 清理（对齐 nofx binance/futures.go L573-594, L649-670, L700-714）
   * Binance 已将 SL/TP 迁移到 Algo Order 系统（error -4120 STOP_ORDER_SWITCH_ALGO）
   * 普通 cancelAllOrders (DELETE /fapi/v1/allOpenOrders) 不会清理 Algo Orders
   * 必须用 Algo API: GET /fapi/v1/algo/openOrders + DELETE /fapi/v1/algo/order
   */
  private async cancelBinanceAlgoOrders(symbol: string): Promise<void> {
    try {
      const ex = this.getExchange();
      const marketId = ex.marketId(symbol);

      // 1. 查询该 symbol 的活跃 Algo Orders
      let algoOrders: any[];
      try {
        const response = await (ex as any).fapiPrivateGetOpenAlgoOrders({ symbol: marketId });
        algoOrders = Array.isArray(response?.orders) ? response.orders
          : Array.isArray(response) ? response : [];
      } catch (e: any) {
        // API 可能不存在（旧版本 Binance），静默降级
        this.logger.debug(`[CcxtAdapter] Binance Algo openOrders 查询失败(降级): ${e.message}`);
        return;
      }

      if (algoOrders.length === 0) return;

      // 2. 逐个取消 SL/TP 类型的 Algo Orders
      let canceled = 0;
      for (const order of algoOrders) {
        const orderType = (order.type || order.orderType || '').toUpperCase();
        if (['STOP_MARKET', 'TAKE_PROFIT_MARKET', 'STOP', 'TAKE_PROFIT'].includes(orderType)) {
          try {
            await (ex as any).fapiPrivateDeleteAlgoOrder({ algoId: order.algoId });
            canceled++;
          } catch (e: any) {
            // 可能已触发或已取消
            if (!e.message?.includes('NOT_FOUND') && !e.message?.includes('already')) {
              this.logger.warn(`[CcxtAdapter] 取消 Algo Order ${order.algoId} 失败: ${e.message}`);
            }
          }
        }
      }

      if (canceled > 0) {
        this.logger.log(`[CcxtAdapter] cancelBinanceAlgoOrders: ${symbol} 已清除 ${canceled} 个 Algo SL/TP 条件单`);
      }
    } catch (e: any) {
      this.logger.warn(`[CcxtAdapter] cancelBinanceAlgoOrders(${symbol}) 失败(非致命): ${e.message}`);
    }
  }

  async fetchMyTrades(symbol: string, since: number, limit: number): Promise<Array<{
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    timestamp: number;
    orderId: string;
  }>> {
    const ex = this.getExchange();
    const trades = await ex.fetchMyTrades(symbol, since, limit);
    return (trades ?? [])
      .filter((t: any) => {
        // Binance hedge mode: 只保留 LONG 方向的成交（排除开空的 buy/平空的 sell）
        // one-way mode: positionSide = 'BOTH'（默认包含）
        // OKX: posSide = 'net' / 'long'
        const ps = (t.info?.positionSide || t.info?.posSide || '').toUpperCase();
        return !ps || ps === 'LONG' || ps === 'BOTH' || ps === 'NET';
      })
      .map((t: any) => ({
        side: t.side === 'sell' ? 'sell' : 'buy',
        price: Number(t.price || 0),
        amount: Number(t.amount || 0),
        timestamp: Number(t.timestamp || 0),
        orderId: String(t.info?.orderId || t.order || ''),
      }));
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

    // OKX 合约价格保护带 ±2%（OKX 不在 market.info.filters 中暴露）
    if (!percentPriceDown && !percentPriceUp && this.exchangeType === 'okx') {
      percentPriceDown = 0.98;
      percentPriceUp = 1.02;
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
    startTime: Date,
    limit: number,
  ): Promise<ClosedPnlRecord[]> {
    try {
      switch (this.exchangeType) {
        case 'binance':
        case 'gate':
          return await this.getClosedPnlBinance(startTime, limit);
        case 'okx':
          return await this.getClosedPnlOkx(startTime, limit);
        case 'bybit':
          return await this.getClosedPnlBybit(startTime, limit);
        default:
          return [];
      }
    } catch (e: any) {
      this.logger.debug(`getClosedPnl (${this.exchangeType}) 非致命错误: ${e.message}`);
      return [];
    }
  }

  /**
   * Binance/Gate: 聚合持仓级别的平仓记录
   * Step 1: fapiPrivateGetIncome(REALIZED_PNL) 获取有盈亏的 symbol 列表
   * Step 2: fapiPrivateGetUserTrades(symbol) 获取完整成交详情
   * Step 3: 按 symbol+side 聚合逐笔成交为持仓级别记录（对齐 OKX/Bybit 粒度）
   *
   * 注意：fetchMyTrades(undefined) 在本地缓存模式下会报 'contract' undefined 错误，
   *       因此必须使用原始 API 绕过 CCXT market 解析
   */
  /**
   * Binance 仓位历史重建（Binance 无原生 position history API）
   *
   * 行业标准算法（Freqtrade / Hummingbot / CCXT PR#21942 / OctoBot 共识）：
   *   1. income API (REALIZED_PNL) 发现有 PnL 的 symbol
   *   2. userTrades 拉逐笔成交（回看 7 天 — Binance 单次最大窗口）
   *   3. 按 symbol 追踪 netQty，qty 归零 = 一条完整仓位生命周期
   *
   * 关键改进（v3 - 2026-03-19）：
   *   - 回看从 48h → 7天，覆盖更长周期的开仓记录
   *   - entry 价格从 Binance realizedPnl 反算（保证与 Binance 数学一致）
   *   - 处理仓位翻转（平仓 qty > 持仓 qty 时自动开反向仓）
   *   - 单向模式支持 break-even close（pnl=0 但 qty 减少）
   */
  private async getClosedPnlBinance(startTime: Date, limit: number): Promise<ClosedPnlRecord[]> {
    const ex = this.getExchange();
    const startMs = startTime.getTime();

    // Step 1: income API 找到近期有平仓 PnL 的 symbol
    const incomeResp: any[] = await (ex as any).fapiPrivateGetIncome({
      incomeType: 'REALIZED_PNL',
      startTime: startMs,
      limit: 1000,
    });
    if (!incomeResp || incomeResp.length === 0) return [];

    const symbolSet = new Set<string>();
    for (const inc of incomeResp) {
      if (inc.symbol) symbolSet.add(inc.symbol);
    }

    // Step 2: 找到最早 income 时间，从更早开始拉 trades（覆盖开仓记录）
    // Binance userTrades limit=1000，时间窗口太大会丢失最新数据
    // 策略：从 income 最早时间 - 48h 开始拉，分段避免超 1000 条
    let earliestIncomeMs = startMs;
    for (const inc of incomeResp) {
      const t = Number(inc.time || 0);
      if (t > 0 && t < earliestIncomeMs) earliestIncomeMs = t;
    }
    const LOOKBACK_48H = 48 * 60 * 60 * 1000;
    const lookbackMs = Math.max(earliestIncomeMs - LOOKBACK_48H, startMs - 7 * 24 * 60 * 60 * 1000);

    const allTrades: any[] = [];
    for (const rawSymbol of symbolSet) {
      try {
        // 分段拉取：如果时间跨度 > 3天，先拉后半段（最新的），再拉前半段
        const now = Date.now();
        const totalSpan = now - lookbackMs;
        if (totalSpan > 3 * 24 * 60 * 60 * 1000) {
          // 后半段（最近 48h，最重要）
          const recentStart = now - LOOKBACK_48H;
          const recentTrades: any[] = await (ex as any).fapiPrivateGetUserTrades({
            symbol: rawSymbol, startTime: recentStart, limit: 1000,
          });
          if (recentTrades?.length) allTrades.push(...recentTrades);

          // 前半段（覆盖更早的开仓）
          const olderTrades: any[] = await (ex as any).fapiPrivateGetUserTrades({
            symbol: rawSymbol, startTime: lookbackMs, endTime: recentStart, limit: 1000,
          });
          if (olderTrades?.length) allTrades.push(...olderTrades);
        } else {
          const trades: any[] = await (ex as any).fapiPrivateGetUserTrades({
            symbol: rawSymbol, startTime: lookbackMs, limit: 1000,
          });
          if (trades?.length) allTrades.push(...trades);
        }
      } catch (e: any) {
        this.logger.debug(`getClosedPnlBinance: ${rawSymbol} userTrades 失败: ${e.message}`);
      }
    }

    if (allTrades.length === 0) return [];

    // Step 3: 按 symbol 分组，时间排序
    const bySymbol = new Map<string, any[]>();
    for (const t of allTrades) {
      const sym = t.symbol || '';
      if (!bySymbol.has(sym)) bySymbol.set(sym, []);
      bySymbol.get(sym)!.push(t);
    }

    // Step 4: 每个 symbol 重建仓位生命周期
    const results: ClosedPnlRecord[] = [];

    for (const [rawSymbol, trades] of bySymbol) {
      trades.sort((a: any, b: any) => Number(a.time) - Number(b.time));

      // ── 多头追踪 ──
      let longQty = 0, longOpenTime = 0;
      let longClosedQty = 0, longExitNotional = 0, longTotalPnl = 0, longTotalFee = 0;
      let longLastCloseTime = 0, longLastOrderId = '';
      let longFirstCloseTradeId = ''; // 首笔平仓 tradeId → 构造稳定 exchangeRef

      // ── 空头追踪 ──
      let shortQty = 0, shortOpenTime = 0;
      let shortClosedQty = 0, shortExitNotional = 0, shortTotalPnl = 0, shortTotalFee = 0;
      let shortLastCloseTime = 0, shortLastOrderId = '';
      let shortFirstCloseTradeId = ''; // 首笔平仓 tradeId → 构造稳定 exchangeRef

      const emitLong = () => {
        if (longClosedQty <= 0) return;
        const avgExit = longExitNotional / longClosedQty;
        const avgEntry = avgExit - longTotalPnl / longClosedQty;
        results.push(this.buildBinancePositionRecord(
          rawSymbol, 'long', avgEntry, avgExit, longClosedQty,
          longTotalPnl, longTotalFee, longOpenTime, longLastCloseTime,
          longLastOrderId, longFirstCloseTradeId,
        ));
      };
      const resetLong = () => {
        longQty = 0; longOpenTime = 0;
        longClosedQty = 0; longExitNotional = 0; longTotalPnl = 0; longTotalFee = 0;
        longLastCloseTime = 0; longLastOrderId = ''; longFirstCloseTradeId = '';
      };

      const emitShort = () => {
        if (shortClosedQty <= 0) return;
        const avgExit = shortExitNotional / shortClosedQty;
        const avgEntry = avgExit + shortTotalPnl / shortClosedQty;
        results.push(this.buildBinancePositionRecord(
          rawSymbol, 'short', avgEntry, avgExit, shortClosedQty,
          shortTotalPnl, shortTotalFee, shortOpenTime, shortLastCloseTime,
          shortLastOrderId, shortFirstCloseTradeId,
        ));
      };
      const resetShort = () => {
        shortQty = 0; shortOpenTime = 0;
        shortClosedQty = 0; shortExitNotional = 0; shortTotalPnl = 0; shortTotalFee = 0;
        shortLastCloseTime = 0; shortLastOrderId = ''; shortFirstCloseTradeId = '';
      };

      for (const t of trades) {
        const qty = parseFloat(t.qty || '0');
        const price = parseFloat(t.price || '0');
        const pnl = parseFloat(t.realizedPnl ?? '0');
        const fee = Math.abs(parseFloat(t.commission ?? '0'));
        const tradeTime = Number(t.time || 0);
        const side = (t.side || '').toUpperCase();     // BUY / SELL
        const posSide = (t.positionSide || 'BOTH').toUpperCase(); // LONG / SHORT / BOTH

        // ── 判断开仓 vs 平仓 ──
        // 对冲模式：positionSide 直接决定
        // 单向模式（BOTH）：realizedPnl != 0 = 平仓，== 0 = 开仓
        let isClosing = false;
        let closingSide: 'long' | 'short' | null = null;

        if (posSide === 'LONG') {
          if (side === 'BUY') { /* 加多 */ }
          else { isClosing = true; closingSide = 'long'; }
        } else if (posSide === 'SHORT') {
          if (side === 'SELL') { /* 加空 */ }
          else { isClosing = true; closingSide = 'short'; }
        } else {
          // 单向模式：realizedPnl != 0 → 平仓（含 break-even 用阈值 0）
          if (Math.abs(pnl) > 0) {
            isClosing = true;
            closingSide = side === 'SELL' ? 'long' : 'short';
          }
        }

        if (isClosing && closingSide === 'long') {
          // ── 平多 ──
          if (longQty <= 0) {
            if (!longOpenTime) longOpenTime = tradeTime;
          }
          const closedQty = Math.min(qty, Math.max(longQty, qty));
          longClosedQty += closedQty;
          longExitNotional += closedQty * price;
          longTotalPnl += pnl;
          longTotalFee += fee;
          longLastCloseTime = tradeTime;
          longLastOrderId = t.orderId || longLastOrderId;
          if (!longFirstCloseTradeId) longFirstCloseTradeId = t.id || t.tradeId || t.orderId || String(tradeTime);
          longQty = Math.max(longQty - closedQty, 0);

          // qty 归零 → 仓位完全平仓 → 生成记录
          if (longQty <= 0.00001) {
            emitLong();
            resetLong();

            // 仓位翻转：平仓 qty 大于持仓 qty，多出部分开反向仓
            const overflow = qty - closedQty;
            if (overflow > 0.00001) {
              shortOpenTime = tradeTime;
              shortQty += overflow;
            }
          }
        } else if (isClosing && closingSide === 'short') {
          // ── 平空 ──
          if (shortQty <= 0) {
            if (!shortOpenTime) shortOpenTime = tradeTime;
          }
          const closedQty = Math.min(qty, Math.max(shortQty, qty));
          shortClosedQty += closedQty;
          shortExitNotional += closedQty * price;
          shortTotalPnl += pnl;
          shortTotalFee += fee;
          shortLastCloseTime = tradeTime;
          shortLastOrderId = t.orderId || shortLastOrderId;
          if (!shortFirstCloseTradeId) shortFirstCloseTradeId = t.id || t.tradeId || t.orderId || String(tradeTime);
          shortQty = Math.max(shortQty - closedQty, 0);

          if (shortQty <= 0.00001) {
            emitShort();
            resetShort();

            const overflow = qty - closedQty;
            if (overflow > 0.00001) {
              longOpenTime = tradeTime;
              longQty += overflow;
            }
          }
        } else {
          // ── 开仓 / 加仓 ──
          if (side === 'BUY') {
            if (!longOpenTime) longOpenTime = tradeTime;
            longQty += qty;
          } else {
            if (!shortOpenTime) shortOpenTime = tradeTime;
            shortQty += qty;
          }
        }
      }
    }

    // 只返回在 startTime 之后平仓的记录
    const filtered = results.filter(r => r.exitTime.getTime() >= startMs);
    if (results.length > 0 && filtered.length === 0) {
      this.logger.warn(`[仓位重建] ${results.length}条全被时间过滤: first=${results[0].exitTime.toISOString()}, start=${new Date(startMs).toISOString()}`);
    }
    return filtered
      .sort((a, b) => b.exitTime.getTime() - a.exitTime.getTime())
      .slice(0, limit);
  }

  /** 构建一条仓位历史记录（Binance/Gate 共用） */
  private buildBinancePositionRecord(
    rawSymbol: string, side: 'long' | 'short',
    entryPrice: number, exitPrice: number, quantity: number,
    realizedPnl: number, fee: number,
    openTime: number, closeTime: number, orderId: string,
    firstCloseTradeId: string,
  ): ClosedPnlRecord {
    const unifiedSymbol = this.binanceRawSymbolToUnified(rawSymbol);
    // 稳定 exchangeRef：用首笔平仓 tradeId 做锚点
    // tradeId 是交易所分配的全局唯一值，无论重跑多少次算法都不变
    const exchangePrefix = this.exchangeType || 'binance';
    const exchangeId = `${exchangePrefix}_${rawSymbol}_${side}_${firstCloseTradeId}`;
    return {
      symbol: unifiedSymbol,
      side,
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl,
      fee,
      leverage: 1,
      entryTime: new Date(openTime || closeTime),
      exitTime: new Date(closeTime),
      orderId: String(orderId || ''),
      closeType: 'manual' as const,
      exchangeId,
    };
  }

  /** Binance 原始 symbol "SOLUSDT" → 统一 "SOL/USDT:USDT" */
  private binanceRawSymbolToUnified(raw: string): string {
    // 常见 quote 货币，按长度倒序匹配
    const quotes = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'BNB'];
    for (const q of quotes) {
      if (raw.endsWith(q)) {
        const base = raw.slice(0, -q.length);
        return `${base}/${q}:${q}`;
      }
    }
    return raw;
  }

  /** OKX: positions-history API */
  private async getClosedPnlOkx(startTime: Date, limit: number): Promise<ClosedPnlRecord[]> {
    const ex = this.getExchange();
    // OKX before/after 是 posId 分页游标，不是时间戳
    // 不传 before，拉最近 N 条，客户端按时间过滤
    const params: any = {
      instType: 'SWAP',
      limit: String(Math.min(limit, 100)),
    };
    const resp: any = await (ex as any).privateGetAccountPositionsHistory(params);
    const data = resp?.data || resp || [];
    if (!Array.isArray(data)) return [];

    const sinceMs = startTime.getTime();
    return data
      .filter((pos: any) => {
        // 按更新时间过滤：只取 startTime 之后的记录
        const uTime = parseInt(pos.uTime || '0');
        return uTime >= sinceMs;
      })
      .map((pos: any) => {
      const closeType = pos.type === '3' || pos.type === '4' ? 'liquidation' : 'manual';
      return {
        symbol: this.okxInstIdToUnified(pos.instId || ''),
        side: (pos.direction === 'short' ? 'short' : 'long') as 'long' | 'short',
        entryPrice: parseFloat(pos.openAvgPx || '0'),
        exitPrice: parseFloat(pos.closeAvgPx || '0'),
        quantity: parseFloat(pos.closeTotalPos || '0'),
        realizedPnl: parseFloat(pos.realizedPnl || pos.pnl || '0'),
        fee: Math.abs(parseFloat(pos.fee || '0')),
        leverage: parseInt(pos.lever || '1', 10),
        entryTime: new Date(parseInt(pos.cTime || '0')),
        exitTime: new Date(parseInt(pos.uTime || '0')),
        orderId: pos.posId || '',
        closeType: closeType as 'manual' | 'liquidation',
        exchangeId: `okx_${pos.posId}`,
      };
    });
  }

  /** Bybit: closed-pnl API */
  private async getClosedPnlBybit(startTime: Date, limit: number): Promise<ClosedPnlRecord[]> {
    const ex = this.getExchange();
    const params: any = {
      category: 'linear',
      limit: String(Math.min(limit, 200)),
    };
    if (startTime.getTime() > 0) {
      params.startTime = String(startTime.getTime());
    }
    const resp: any = await (ex as any).privateGetV5PositionClosedPnl(params);
    const list = resp?.result?.list || [];
    if (!Array.isArray(list)) return [];

    return list.map((item: any) => ({
      symbol: item.symbol ? `${item.symbol.replace('USDT', '')}/USDT` : '',
      side: (item.side === 'Sell' ? 'short' : 'long') as 'long' | 'short',
      entryPrice: parseFloat(item.avgEntryPrice || '0'),
      exitPrice: parseFloat(item.avgExitPrice || '0'),
      quantity: parseFloat(item.closedSize || item.qty || '0'),
      realizedPnl: parseFloat(item.closedPnl || '0'),
      fee: 0,
      leverage: parseInt(item.leverage || '1', 10),
      entryTime: new Date(parseInt(item.createdTime || '0')),
      exitTime: new Date(parseInt(item.updatedTime || '0')),
      orderId: item.orderId || '',
      closeType: 'unknown' as const,
      exchangeId: `bybit_${item.orderId || item.createdTime}`,
    }));
  }

  /** Binance symbol SOLUSDT → SOL/USDT */
  private binanceSymbolToUnified(symbol: string): string {
    if (symbol.includes('/')) return symbol;
    const stables = ['USDT', 'BUSD', 'USDC'];
    for (const s of stables) {
      if (symbol.endsWith(s)) return `${symbol.slice(0, -s.length)}/${s}`;
    }
    return symbol;
  }

  /** OKX instId SOL-USDT-SWAP → SOL/USDT */
  private okxInstIdToUnified(instId: string): string {
    if (instId.includes('/')) return instId;
    const parts = instId.split('-');
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return instId;
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
    // Binance USDM 平仓订单在 info.realizedPnl；OKX 平仓订单在 info.pnl
    const rawPnl = (order.info as any)?.realizedPnl ?? (order.info as any)?.pnl;
    const realizedPnl = rawPnl != null && rawPnl !== '' ? Number(rawPnl) : undefined;

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
