/**
 * ExchangeAdapter — 统一交易所适配器接口
 *
 * 移植自 NoFx trader/types/interface.go 的 Trader 接口
 * 所有交易所（CEX + DEX）统一实现此接口
 *
 * 实现：
 *   CcxtAdapter       → Binance/OKX/Bybit/Gate/Bitget/Coinbase/Hyperliquid (CCXT原生)
 *   LighterAdapter    → Lighter DEX (REST + TxClient签名)
 *   AsterAdapter      → Aster DEX (ABI编码 + ECDSA签名)
 */

import {
  ExchangeBalance,
  ExchangePosition,
  OrderResult,
  OrderStatusDetail,
  OpenOrder,
  ClosedPnlRecord,
  MarketPrecision,
  ExchangeCategory,
} from './exchange.types';

/**
 * 统一交易所适配器接口
 *
 * 设计原则：
 * 1. 方法签名对齐 NoFx Go Trader 接口
 * 2. 返回类型使用强类型替代 map[string]interface{}
 * 3. 额外提供 DEX 特有方法（如 txHash）
 */
export interface ExchangeAdapter {
  // ========================= 元信息 =========================

  /** 交易所标识 (e.g., 'binance', 'hyperliquid', 'lighter', 'aster') */
  readonly exchangeType: string;

  /** 交易所分类 */
  readonly category: ExchangeCategory;

  /** 是否为 DEX */
  readonly isDex: boolean;

  /** 是否测试网 */
  readonly isTestnet: boolean;

  // ========================= 账户查询 =========================

  /**
   * 获取账户余额
   * NoFx: GetBalance() (map[string]interface{}, error)
   */
  getBalance(): Promise<ExchangeBalance>;

  /**
   * 获取当前持仓
   * NoFx: GetPositions() ([]map[string]interface{}, error)
   */
  getPositions(): Promise<ExchangePosition[]>;

  // ========================= 开仓 / 平仓 =========================

  /**
   * 开多
   * NoFx: OpenLong(symbol string, quantity float64, leverage int) (map[string]interface{}, error)
   *
   * @param symbol 交易对 (e.g., "BTC/USDT:USDT")
   * @param quantity 数量（已经过精度处理）
   * @param leverage 杠杆倍数
   */
  openLong(symbol: string, quantity: number, leverage: number): Promise<OrderResult>;

  /**
   * 开空
   * NoFx: OpenShort(symbol string, quantity float64, leverage int) (map[string]interface{}, error)
   */
  openShort(symbol: string, quantity: number, leverage: number): Promise<OrderResult>;

  /**
   * 平多（quantity=0 表示全平）
   * NoFx: CloseLong(symbol string, quantity float64) (map[string]interface{}, error)
   */
  closeLong(symbol: string, quantity: number): Promise<OrderResult>;

  /**
   * 平空（quantity=0 表示全平）
   * NoFx: CloseShort(symbol string, quantity float64) (map[string]interface{}, error)
   */
  closeShort(symbol: string, quantity: number): Promise<OrderResult>;

  // ========================= 杠杆 / 保证金 =========================

  /**
   * 设置杠杆
   * NoFx: SetLeverage(symbol string, leverage int) error
   */
  setLeverage(symbol: string, leverage: number): Promise<void>;

  /**
   * 设置保证金模式
   * NoFx: SetMarginMode(symbol string, isCrossMargin bool) error
   *
   * @param isCrossMargin true=全仓, false=逐仓
   */
  setMarginMode(symbol: string, isCrossMargin: boolean): Promise<void>;

  // ========================= 市场数据 =========================

  /**
   * 获取市场最新价格
   * NoFx: GetMarketPrice(symbol string) (float64, error)
   */
  getMarketPrice(symbol: string): Promise<number>;

  // ========================= 止盈止损 =========================

  /**
   * 设置止损
   * NoFx: SetStopLoss(symbol string, positionSide string, quantity, stopPrice float64) error
   *
   * @param positionSide "long" 或 "short"
   */
  setStopLoss(symbol: string, positionSide: string, quantity: number, stopPrice: number): Promise<void>;

  /**
   * 设置止盈
   * NoFx: SetTakeProfit(symbol string, positionSide string, quantity, takeProfitPrice float64) error
   */
  setTakeProfit(symbol: string, positionSide: string, quantity: number, takeProfitPrice: number): Promise<void>;

  // ========================= 订单管理 =========================

  /**
   * 取消指定交易对的所有挂单
   * NoFx: CancelAllOrders(symbol string) error
   */
  cancelAllOrders(symbol: string): Promise<void>;

  /**
   * 取消止损/止盈单
   * NoFx: CancelStopOrders(symbol string) error
   */
  cancelStopOrders(symbol: string): Promise<void>;

  /**
   * 获取订单状态
   * NoFx: GetOrderStatus(symbol string, orderID string) (map[string]interface{}, error)
   */
  getOrderStatus(symbol: string, orderId: string): Promise<OrderStatusDetail>;

  /**
   * 获取挂单列表
   * NoFx: GetOpenOrders(symbol string) ([]OpenOrder, error)
   */
  getOpenOrders(symbol: string): Promise<OpenOrder[]>;

  // ========================= 精度 =========================

  /**
   * 格式化数量精度
   * NoFx: FormatQuantity(symbol string, quantity float64) (string, error)
   *
   * 按交易所要求格式化数量（小数位数、步长）
   */
  formatQuantity(symbol: string, quantity: number): Promise<string>;

  /**
   * 获取市场精度信息
   */
  getMarketPrecision(symbol: string): Promise<MarketPrecision>;

  // ========================= 历史数据 =========================

  /**
   * 获取已平仓盈亏记录
   * NoFx: GetClosedPnL(startTime time.Time, limit int) ([]ClosedPnLRecord, error)
   *
   * @param startTime 查询起始时间
   * @param limit 最大返回数量
   */
  getClosedPnl(startTime: Date, limit: number): Promise<ClosedPnlRecord[]>;

  // ========================= 生命周期 =========================

  /**
   * 初始化适配器（加载市场信息、建立连接等）
   * CEX: loadMarkets()
   * DEX: 获取 accountIndex / refreshToken 等
   */
  initialize(): Promise<void>;

  /**
   * 检查适配器是否已初始化且可用
   * 用于缓存命中时验证适配器状态
   */
  isReady(): boolean;

  /**
   * 清理资源
   */
  dispose(): Promise<void>;
}

/**
 * 限价单扩展接口（用于网格交易等高级策略）
 *
 * 移植自 NoFx GridTrader 接口
 * 仅需要限价单功能的适配器实现此接口
 */
export interface GridExchangeAdapter extends ExchangeAdapter {
  /**
   * 下限价单
   */
  placeLimitOrder(request: LimitOrderRequest): Promise<LimitOrderResult>;

  /**
   * 取消指定订单
   */
  cancelOrder(symbol: string, orderId: string): Promise<void>;

  /**
   * 获取订单簿
   * @param depth 深度
   */
  getOrderBook(symbol: string, depth: number): Promise<OrderBookSnapshot>;
}

/**
 * 限价单请求（移植自 NoFx LimitOrderRequest）
 */
export interface LimitOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  positionSide?: 'long' | 'short';
  price: number;
  quantity: number;
  leverage: number;
  postOnly?: boolean;
  reduceOnly?: boolean;
  clientId?: string;
}

/**
 * 限价单结果（移植自 NoFx LimitOrderResult）
 */
export interface LimitOrderResult {
  orderId: string;
  clientId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  positionSide?: 'long' | 'short';
  price: number;
  quantity: number;
  status: string;
}

/**
 * 订单簿快照
 */
export interface OrderBookSnapshot {
  /** [price, quantity][] — 从高到低 */
  bids: [number, number][];
  /** [price, quantity][] — 从低到高 */
  asks: [number, number][];
  timestamp: number;
}

/**
 * 类型守卫：判断适配器是否支持限价单
 */
export function isGridAdapter(adapter: ExchangeAdapter): adapter is GridExchangeAdapter {
  return 'placeLimitOrder' in adapter && typeof (adapter as GridExchangeAdapter).placeLimitOrder === 'function';
}
