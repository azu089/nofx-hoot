/**
 * Exchange Adapters — 共享类型定义
 *
 * 移植自 NoFx trader/types/interface.go + store/exchange.go
 * 统一 CEX (CCXT) 和 DEX (Hyperliquid/Lighter/Aster) 的数据结构
 */

// ========================= 交易所元数据 =========================

/**
 * 支持的交易所列表
 */
export const SUPPORTED_CEX = ['binance', 'okx', 'bybit', 'gate', 'bitget', 'coinbase'] as const;
export const SUPPORTED_DEX = ['hyperliquid', 'lighter', 'aster'] as const;
export const ALL_SUPPORTED_EXCHANGES = [...SUPPORTED_CEX, ...SUPPORTED_DEX] as const;

export type CexExchange = (typeof SUPPORTED_CEX)[number];
export type DexExchange = (typeof SUPPORTED_DEX)[number];
export type SupportedExchange = (typeof ALL_SUPPORTED_EXCHANGES)[number];

/**
 * 认证类型
 */
export type AuthType = 'api_key' | 'wallet';

/**
 * 交易所分类
 */
export type ExchangeCategory = 'cex' | 'dex';

/**
 * 判断交易所是否为 DEX
 */
export function isDexExchange(exchange: string): exchange is DexExchange {
  return (SUPPORTED_DEX as readonly string[]).includes(exchange);
}

/**
 * 获取交易所分类
 */
export function getExchangeCategory(exchange: string): ExchangeCategory {
  return isDexExchange(exchange) ? 'dex' : 'cex';
}

// ========================= 余额 =========================

/**
 * 统一余额结构
 */
export interface ExchangeBalance {
  /** 总权益 (USDT) */
  totalEquity: number;
  /** 可用余额 (USDT) */
  availableBalance: number;
  /** 已用保证金 */
  usedMargin: number;
  /** 未实现盈亏 */
  unrealizedPnl: number;
  /** 原始数据（交易所特定格式） */
  raw?: Record<string, unknown>;
}

// ========================= 持仓 =========================

/**
 * 统一持仓结构
 */
export interface ExchangePosition {
  /** 交易对 (e.g., "BTCUSDT") */
  symbol: string;
  /** 方向 */
  side: 'long' | 'short';
  /** 持仓数量（正数） */
  quantity: number;
  /** 入场均价 */
  entryPrice: number;
  /** 当前标记价 */
  markPrice: number;
  /** 未实现盈亏 */
  unrealizedPnl: number;
  /** 杠杆倍数 */
  leverage: number;
  /** 保证金模式 */
  marginMode: 'cross' | 'isolated';
  /** 持仓保证金 */
  margin: number;
  /** 强平价格 */
  liquidationPrice?: number;
  /** 交易所持仓 ID */
  exchangePositionId?: string;
}

// ========================= 订单 =========================

/**
 * 下单结果
 */
export interface OrderResult {
  /** 订单 ID */
  orderId: string;
  /** 交易对 */
  symbol: string;
  /** 方向 */
  side: 'buy' | 'sell';
  /** 成交均价 */
  avgPrice: number;
  /** 下单数量 */
  quantity: number;
  /** 实际成交数量 */
  filledQuantity: number;
  /** 手续费 */
  fee: number;
  /** 订单状态 */
  status: OrderStatus;
  /** DEX 链上交易哈希 */
  txHash?: string;
  /** 原始数据 */
  raw?: Record<string, unknown>;
}

/**
 * 订单状态
 */
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';

/**
 * 挂单信息
 */
export interface OpenOrder {
  /** 订单 ID */
  orderId: string;
  /** 交易对 */
  symbol: string;
  /** 买/卖 */
  side: 'buy' | 'sell';
  /** 持仓方向 */
  positionSide: 'long' | 'short';
  /** 订单类型 */
  type: 'limit' | 'stop_market' | 'take_profit_market' | 'stop' | 'take_profit';
  /** 限价 */
  price?: number;
  /** 触发价 */
  stopPrice?: number;
  /** 数量 */
  quantity: number;
  /** 状态 */
  status: string;
}

/**
 * 订单状态详情（用于 getOrderStatus 返回）
 */
export interface OrderStatusDetail {
  /** 订单状态 */
  status: OrderStatus;
  /** 成交均价 */
  avgPrice: number;
  /** 已成交数量 */
  filledQuantity: number;
  /** 手续费 */
  fee: number;
}

// ========================= 已平仓记录 =========================

/**
 * 已平仓盈亏记录（移植自 NoFx ClosedPnLRecord）
 */
export interface ClosedPnlRecord {
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnl: number;
  fee: number;
  leverage: number;
  entryTime: Date;
  exitTime: Date;
  orderId: string;
  closeType: 'manual' | 'stop_loss' | 'take_profit' | 'liquidation' | 'unknown';
  exchangeId?: string;
}

// ========================= 市场信息 =========================

/**
 * 市场精度信息
 */
export interface MarketPrecision {
  /** 交易对 */
  symbol: string;
  /** 数量精度（小数位数） */
  quantityPrecision: number;
  /** 价格精度（小数位数） */
  pricePrecision: number;
  /** 最小下单量 */
  minQuantity: number;
  /** 最小名义价值 (USDT) */
  minNotional?: number;
  /** 量步长 */
  stepSize?: number;
  /** 价格步长 */
  tickSize?: number;
}

// ========================= DEX 凭证 =========================

/**
 * Hyperliquid 凭证（CCXT 原生支持）
 */
export interface HyperliquidCredentials {
  /** 主钱包地址 */
  walletAddress: string;
  /** Agent 私钥（用于签名交易） */
  privateKey: string;
  /** 是否测试网 */
  testnet: boolean;
}

/**
 * Lighter 凭证（移植自 NoFx）
 */
export interface LighterCredentials {
  /** 钱包地址 */
  walletAddress: string;
  /** 钱包私钥 */
  privateKey: string;
  /** API Key 私钥（40字节） */
  apiKeyPrivateKey: string;
  /** API Key 索引 (0-255) */
  apiKeyIndex: number;
}

/**
 * Aster 凭证（移植自 NoFx）
 */
export interface AsterCredentials {
  /** 主钱包地址 (user) */
  userAddress: string;
  /** 签名钱包地址 (signer) */
  signerAddress: string;
  /** 签名钱包私钥 */
  privateKey: string;
}

/**
 * CEX 凭证
 */
export interface CexCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

/**
 * 统一凭证类型
 */
export type ExchangeCredentials =
  | { authType: 'api_key'; exchange: CexExchange; cex: CexCredentials }
  | { authType: 'wallet'; exchange: 'hyperliquid'; hyperliquid: HyperliquidCredentials }
  | { authType: 'wallet'; exchange: 'lighter'; lighter: LighterCredentials }
  | { authType: 'wallet'; exchange: 'aster'; aster: AsterCredentials };

// ========================= 适配器初始化选项 =========================

/**
 * 适配器创建选项
 */
export interface AdapterOptions {
  /** 凭证 */
  credentials: ExchangeCredentials;
  /** 是否测试网 */
  testnet?: boolean;
  /** 日志标签（用于区分多账户） */
  logTag?: string;
}
