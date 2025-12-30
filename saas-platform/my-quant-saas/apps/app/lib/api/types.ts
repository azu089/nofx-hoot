/**
 * API 通用响应类型
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  request_id?: string;
}

// ============= 用户相关 =============

export interface User {
  id: string;
  email: string;
  vip_level: number;
  usdt_balance: string;
  point_balance: string;
}

export interface Wallet {
  id: string;
  usdt_balance: string;
  point_balance: string;
  frozen_balance: string;
}

// ============= VPS 实例 =============

export interface Instance {
  id: string;
  status: string;
  ip_address: string;
  region: string;
  cpu_usage: string | null;
  memory_usage: string | null;
  last_heartbeat: string | null;
}

export interface InstanceHeartbeat {
  cpu_usage?: string;
  memory_usage?: string;
}

// ============= 计费相关 =============

export interface TodayPnL {
  todayPnl: string;
  todayProfit: string;
  todayLoss: string;
  todayTrades: number;
  todayWinRate: string;
  todayGasFee: string;
}

export interface PnLCurve {
  curve: Array<{
    date: string;
    pnl: string;
    cumulativePnl: string;
    trades: number;
  }>;
  totalPnl: string;
  maxDrawdown: string;
}

export interface BillingLog {
  id: string;
  billing_type: string;
  amount: string;
  description: string;
  created_at: string;
}

// ============= 充值/提现 =============

export interface Deposit {
  id: string;
  amount: string;
  method: string;
  status: string;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  amount: string;
  chain: string;
  to_address: string;
  status: string;
  created_at: string;
}

// ============= 备份相关 =============

export interface Backup {
  id: string;
  instanceId: string;
  s3Key: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
}

// ============= 策略相关 =============

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: string;
  risk_level: string;
  min_capital: string;
  expected_return: string;
  win_rate: string;
  max_drawdown: string;
  status: string;
  created_at: string;
}

export interface StrategyDetail extends Strategy {
  params: Record<string, unknown>;
}

export interface MyStrategy {
  id: string;
  strategy_id: string;
  strategy_name: string;
  status: string;
  allocated_capital: string;
  total_pnl: string;
  subscribed_at: string;
}

// ============= API Key 相关 =============

export interface ApiKey {
  id: string;
  exchange: string;
  label: string;
  created_at: string;
}

export interface ApiKeyVerification {
  valid: boolean;
  balances?: Record<string, string>;
}

// ============= 交易相关 =============

export interface Position {
  id: string;
  symbol: string;
  side: string;
  size: string;
  entry_price: string;
  current_price: string;
  unrealized_pnl: string;
  leverage: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: string;
  type: string;
  size: string;
  price: string;
  status: string;
  created_at: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: string;
  size: string;
  price: string;
  pnl: string;
  fee: string;
  executed_at: string;
}

export interface BotStatus {
  running: boolean;
  strategy_id?: string;
  uptime?: number;
  trades_today?: number;
}

// ============= GameFi 相关 =============

export interface Stake {
  id: string;
  stake_type: string;
  amount: string;
  lock_days: number;
  weight: string;
  unlocks_at: string;
  status: string;
  created_at: string;
}

export interface PointsHistory {
  id: string;
  type: string;
  amount: string;
  description: string;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  nickname: string;
  total_points: string;
  stake_weight: string;
}
