/**
 * Lighter DEX — 类型定义
 *
 * 移植自 NoFx trader/lighter/types.go
 * Lighter V2 REST API 响应结构
 */

// ========================= API 响应 =========================

/** 账户信息 (GET /api/v1/account) */
export interface LighterAccountResponse {
  account_index: number;
  l1_address: string;
  l2_address?: string;
  is_registered: boolean;
}

/** 完整账户信息 (GET /api/v1/account?full_account_info=1) */
export interface LighterFullAccountResponse {
  account_index: number;
  l1_address: string;
  balances: LighterBalanceEntry[];
  positions: LighterPositionEntry[];
  open_orders: LighterOrderEntry[];
}

/** 余额条目 */
export interface LighterBalanceEntry {
  token: string;
  balance: string;
  locked: string;
  available: string;
}

/** 持仓条目 */
export interface LighterPositionEntry {
  order_book_symbol: string;
  sign: number; // 1=多, -1=空, 0=无持仓
  base_amount: string;
  quote_amount: string;
  entry_price: string;
  mark_price: string;
  unrealized_pnl: string;
  leverage: string;
  initial_margin_fraction: string;
  maintenance_margin: string;
  liquidation_price: string;
}

/** 订单条目 */
export interface LighterOrderEntry {
  order_id: number;
  order_book_index: number;
  order_book_symbol: string;
  side: string; // 'buy' | 'sell'
  type: number; // 0=limit, 1=market, 2=stopLoss, 3=stopLossLimit, 4=takeProfit, 5=takeProfitLimit
  base_amount: string;
  price: string;
  stop_price?: string;
  status: string;
  reduce_only: boolean;
  time_in_force: string;
  created_at: string;
}

// ========================= 市场数据 =========================

/** 订单簿列表 (GET /api/v1/orderBooks) */
export interface LighterOrderBooksResponse {
  order_books: LighterOrderBook[];
}

/** 单个订单簿 */
export interface LighterOrderBook {
  order_book_index: number;
  order_book_symbol: string;
  base_token: string;
  quote_token: string;
  size_decimals: number;
  price_decimals: number;
  min_base_amount: string;
  tick_size: string;
  best_bid: string;
  best_ask: string;
  last_price: string;
  mark_price: string;
  index_price: string;
  open_interest: string;
}

/** 订单簿详情 (GET /api/v1/orderBookDetail) */
export interface LighterOrderBookDetailResponse {
  order_book_index: number;
  order_book_symbol: string;
  best_bid: string;
  best_ask: string;
  last_price: string;
  mark_price: string;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

// ========================= 交易数据 =========================

/** 订单响应 */
export interface LighterOrderResponse {
  order_id: number;
  status: string;
  filled_base_amount: string;
  filled_quote_amount: string;
  avg_fill_price: string;
  fee: string;
  tx_hash?: string;
}

/** 交易记录 */
export interface LighterTradeResponse {
  trades: LighterTrade[];
}

export interface LighterTrade {
  trade_id: string;
  order_id: number;
  order_book_symbol: string;
  side: string;
  base_amount: string;
  quote_amount: string;
  price: string;
  fee: string;
  realized_pnl: string;
  is_maker: boolean;
  timestamp: string;
}

// ========================= 认证 =========================

/** Auth Token 请求 */
export interface LighterAuthRequest {
  account_index: number;
  message: string;
  signature: string;
}

/** Auth Token 响应 */
export interface LighterAuthResponse {
  token: string;
  expires_at: string;
}

// ========================= 市场精度缓存 =========================

export interface LighterMarketInfo {
  orderBookIndex: number;
  symbol: string;
  baseToken: string;
  quoteToken: string;
  sizeDecimals: number;
  priceDecimals: number;
  minBaseAmount: number;
  tickSize: number;
}

// ========================= 适配器配置 =========================

export interface LighterAdapterConfig {
  /** 主钱包地址 (L1) */
  walletAddress: string;
  /** API Key 私钥 (40字节 hex) */
  apiKeyPrivateKey: string;
  /** API Key 索引 (0-255) */
  apiKeyIndex: number;
  /** 是否测试网 */
  isTestnet: boolean;
}

// ========================= 常量 =========================

/** Lighter 链 ID */
export const LIGHTER_CHAIN_ID = {
  mainnet: 304,
  testnet: 300,
} as const;

/** Lighter API 基础 URL */
export const LIGHTER_BASE_URL = {
  mainnet: 'https://mainnet.lighter.xyz',
  testnet: 'https://testnet.lighter.xyz',
} as const;

/** 订单类型 */
export const LIGHTER_ORDER_TYPE = {
  LIMIT: 0,
  MARKET: 1,
  STOP_LOSS: 2,
  STOP_LOSS_LIMIT: 3,
  TAKE_PROFIT: 4,
  TAKE_PROFIT_LIMIT: 5,
} as const;

/** 订单方向 */
export const LIGHTER_ORDER_SIDE = {
  BUY: 'buy',
  SELL: 'sell',
} as const;

/** Time In Force */
export const LIGHTER_TIF = {
  GTC: 'GTC',
  IOC: 'IOC',
  FOK: 'FOK',
} as const;
