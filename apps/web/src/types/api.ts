/**
 * API 响应通用类型定义
 */

// API 通用响应结构
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 错误响应
export interface ApiError {
  code: number;
  message: string;
  details?: Record<string, unknown>;
  request_id: string;
}

// 用户相关类型
export interface User {
  id: string;
  email: string;
  vip_level: number;
  created_at: string;
  updated_at: string;
}

// 钱包相关类型
export interface WalletBalance {
  usdt_balance: string;
  points_balance: string;
  usdt_frozen: string;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'profit' | 'fee' | 'stake' | 'unstake';
  amount: string;
  status: 'pending' | 'completed' | 'failed' | 'rejected';
  created_at: string;
  updated_at: string;
  note?: string;
}

export interface DepositAddress {
  address: string;
  chain: 'TRC20' | 'ERC20' | 'BEP20';
  qrCode?: string;
}

// 交易相关类型
export interface Trade {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  open_time: number;
  close_time?: number;
  open_rate: number;
  close_rate?: number;
  amount: number;
  profit?: number;
  profit_percent?: number;
  is_open: boolean;
  strategy_id?: string;
}

export interface TradingInstance {
  id: string;
  strategy_id: string;
  status: 'running' | 'stopped' | 'paused' | 'error';
  created_at: string;
  last_heartbeat?: string;
  config?: Record<string, unknown>;
}

// 策略相关类型
export interface Strategy {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'arbitrage' | 'grid' | 'ai' | 'custom';
  risk_level: 'low' | 'medium' | 'high';
  min_balance: string;
  subscription_type: 'free' | 'vip_only' | 'premium';
  monthly_fee?: string;
  performance: {
    total_return: string;
    monthly_return: string;
    max_drawdown: string;
    sharpe_ratio: number;
  };
  is_active: boolean;
}

// VPS 实例相关类型
export interface VpsInstance {
  id: string;
  droplet_id: string;
  ip_address: string;
  status: 'creating' | 'running' | 'stopped' | 'destroyed';
  region: string;
  size: string;
  created_at: string;
  destroyed_at?: string;
  monthly_cost: string;
}

// GameFi 相关类型
export interface StakingPool {
  id: string;
  type: 'A' | 'B';
  min_stake: string;
  lock_days: number;
  apy: string;
  total_staked: string;
  available_slots: number;
}

export interface StakingRecord {
  id: string;
  pool_id: string;
  amount: string;
  start_date: string;
  unlock_date: string;
  status: 'active' | 'unlocked' | 'withdrawn';
  rewards_earned: string;
}

export interface ExchangeRate {
  points_to_usdt: number; // 多少积分 = 1 USDT
  mode: 'standard' | 'instant';
  fee_rate: number; // 手续费率
}

// K 线数据类型
export interface KLineData {
  time: number; // Unix timestamp (秒)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// AI 解读数据类型
export interface AiInsight {
  daily_summary: string;
  emotional_score: number; // 1-100
  risk_score: number; // 1-100
  recommendations: string[];
  updated_at: string;
}

// WebSocket 事件类型
export interface LogEvent {
  instanceId: string;
  log: {
    message: string;
    level: 'info' | 'warn' | 'error';
    meta?: Record<string, unknown>;
    timestamp: string;
  };
  timestamp: string;
}

export interface StatusEvent {
  status: {
    type: string;
    instanceId?: string;
    status?: string;
    reason?: string;
    timestamp: string;
  };
  timestamp: string;
}

export interface TradeEvent {
  trade: {
    id: string;
    pair: string;
    side: 'buy' | 'sell';
    amount: string;
    price: string;
    pnl: string;
    timestamp: string;
  };
  timestamp: string;
}
