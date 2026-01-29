/**
 * 前端类型定义
 * 与后端 API 响应对应
 */

// API 响应格式
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

// 用户
export interface User {
  id: string;
  email: string;
  nickname?: string;
  createdAt: string;
}

// API Key
export interface ApiKey {
  id: string;
  exchange: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

// 策略
export interface Strategy {
  id: string;
  name: string;
  description: string;
  freqtradeId: string;
  isActive: boolean;
  createdAt: string;
}

// 策略订阅
export interface StrategySubscription {
  id: string;
  strategyId: string;
  strategy?: Strategy;
  apiKeyId: string;
  amountPerTrade: string;
  maxPositions: number;
  isActive: boolean;
  createdAt: string;
}

// 交易信号
export interface Signal {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: string;
  distributedAt?: string;
  createdAt: string;
}

// 持仓
export interface Position {
  id: string;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: string;
  amount: string;
  exchangeOrderId?: string;
  status: 'open' | 'closed' | 'failed';
  closedAt?: string;
  closePrice?: string;
  pnl?: string;
  createdAt: string;
}

// 分页
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
