/**
 * 共享类型定义
 * 前后端通用
 */

// ========== API 响应 ==========

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

// ========== 用户 ==========

export interface User {
  id: string;
  email: string;
  nickname?: string;
  createdAt: string;
  updatedAt: string;
}

// ========== API Key ==========

export type Exchange = 'binance' | 'okx' | 'bybit';

export interface ApiKey {
  id: string;
  userId: string;
  exchange: Exchange;
  label: string;
  isActive: boolean;
  createdAt: string;
}

// ========== 策略 ==========

export interface Strategy {
  id: string;
  name: string;
  description: string;
  freqtradeId: string;
  isActive: boolean;
  createdAt: string;
}

// ========== 策略订阅 ==========

export interface StrategySubscription {
  id: string;
  userId: string;
  strategyId: string;
  apiKeyId: string;
  amountPerTrade: string; // Decimal 用 string 传输
  maxPositions: number;
  isActive: boolean;
  createdAt: string;
}

// ========== 交易信号 ==========

export type SignalSide = 'buy' | 'sell';

export interface Signal {
  id: string;
  strategyId: string;
  symbol: string;
  side: SignalSide;
  price: string;
  distributedAt?: string;
  createdAt: string;
}

// ========== 持仓 ==========

export type PositionSide = 'long' | 'short';
export type PositionStatus = 'open' | 'closed' | 'failed';

export interface Position {
  id: string;
  userId: string;
  exchange: Exchange;
  symbol: string;
  side: PositionSide;
  entryPrice: string;
  amount: string;
  exchangeOrderId?: string;
  status: PositionStatus;
  closedAt?: string;
  closePrice?: string;
  pnl?: string;
  signalId?: string;
  createdAt: string;
  updatedAt: string;
}

// ========== 分页 ==========

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

// ========== 认证 ==========

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nickname?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ========== Webhook 信号 ==========

export interface FreqtradeWebhookPayload {
  strategy: string;
  symbol: string;
  side: SignalSide;
  price: string;
  timestamp?: string;
}
