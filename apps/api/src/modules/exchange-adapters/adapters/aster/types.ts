/**
 * Aster DEX — 类型定义
 *
 * Aster API 格式类似 Binance Futures V3
 */

// ========================= API 响应 =========================

/** 余额响应 (GET /fapi/v3/balance) */
export interface AsterBalanceEntry {
  accountAlias: string;
  asset: string;
  balance: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  marginAvailable: boolean;
  updateTime: number;
}

/** 持仓响应 (GET /fapi/v3/positionRisk) */
export interface AsterPositionEntry {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  maxNotionalValue: string;
  marginType: string; // 'cross' | 'isolated'
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: string; // 'BOTH' | 'LONG' | 'SHORT'
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

/** 订单响应 */
export interface AsterOrderResponse {
  orderId: number;
  symbol: string;
  status: string;
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: string;
  type: string;
  reduceOnly: boolean;
  side: string;
  positionSide: string;
  stopPrice: string;
  workingType: string;
  origType: string;
  updateTime: number;
}

/** 交易记录 */
export interface AsterTradeRecord {
  id: number;
  symbol: string;
  orderId: number;
  side: string;
  positionSide: string;
  price: string;
  qty: string;
  realizedPnl: string;
  commission: string;
  time: number;
  buyer: boolean;
  maker: boolean;
}

// ========================= 交易所信息 =========================

/** 交易所信息 (GET /fapi/v3/exchangeInfo) */
export interface AsterExchangeInfo {
  symbols: AsterSymbolInfo[];
}

export interface AsterSymbolInfo {
  symbol: string;
  pair: string;
  contractType: string;
  deliveryDate: number;
  onboardDate: number;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  marginAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  baseAssetPrecision: number;
  quotePrecision: number;
  filters: AsterFilter[];
}

export type AsterFilter =
  | AsterPriceFilter
  | AsterLotSizeFilter
  | AsterMinNotionalFilter
  | AsterOtherFilter;

export interface AsterPriceFilter {
  filterType: 'PRICE_FILTER';
  minPrice: string;
  maxPrice: string;
  tickSize: string;
}

export interface AsterLotSizeFilter {
  filterType: 'LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
}

export interface AsterMinNotionalFilter {
  filterType: 'MIN_NOTIONAL';
  notional: string;
}

export interface AsterOtherFilter {
  filterType: string;
  [key: string]: string;
}

// ========================= 精度缓存 =========================

export interface AsterPrecisionInfo {
  symbol: string;
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
}

// ========================= 适配器配置 =========================

export interface AsterAdapterConfig {
  /** 主钱包地址 (user) */
  userAddress: string;
  /** 签名钱包地址 (signer) */
  signerAddress: string;
  /** 签名钱包私钥 (hex, with or without 0x prefix) */
  privateKey: string;
  /** 是否测试网 (Aster 目前仅 mainnet) */
  isTestnet: boolean;
}

// ========================= 常量 =========================

/** Aster API 基础 URL */
export const ASTER_BASE_URL = {
  mainnet: 'https://fapi.asterdex.com',
  testnet: 'https://testnet-fapi.asterdex.com',
} as const;

/** 订单类型 */
export const ASTER_ORDER_TYPE = {
  LIMIT: 'LIMIT',
  MARKET: 'MARKET',
  STOP_MARKET: 'STOP_MARKET',
  TAKE_PROFIT_MARKET: 'TAKE_PROFIT_MARKET',
  STOP: 'STOP',
  TAKE_PROFIT: 'TAKE_PROFIT',
} as const;

/** 持仓方向（Aster 单向模式） */
export const ASTER_POSITION_SIDE = 'BOTH';
