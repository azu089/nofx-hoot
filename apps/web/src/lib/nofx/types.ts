/**
 * nofx 代理接口类型透传层。
 *
 * 原则：现阶段（P4）不重新设计字段语义，直接 mirror nofx upstream 的 JSON shape，
 * 避免在 P4 把 PM 还没确认的字段定义"焊死"。后续（P6）前端 UI 稳定后再做白名单 reshape。
 *
 * 所有字段标 `unknown` 或 narrow 到必需的最小集合，宽松类型让 TS 不阻塞展示，
 * 同时让真正需要的字段显式声明 — 任何从这里取出的字段都视为信任边界。
 */

export interface NofxTraderListItem {
  trader_id: string;
  strategy_id?: string;
  strategy_name?: string;
  ai_model?: string;
  exchange_id?: string;
  initial_balance?: number;
  is_running?: boolean;
  show_in_competition?: boolean;
  // 其他字段透传
  [key: string]: unknown;
}

export interface NofxPosition {
  symbol?: string;
  side?: string;
  size?: number | string;
  entry_price?: number | string;
  unrealized_pnl?: number | string;
  [key: string]: unknown;
}

export interface NofxAccount {
  total_equity?: number | string;
  available_balance?: number | string;
  used_margin?: number | string;
  [key: string]: unknown;
}

export interface NofxLatestDecision {
  symbol?: string;
  action?: string;
  reasoning?: string;
  timestamp?: string | number;
  [key: string]: unknown;
}

export interface NofxStatistics {
  total_trades?: number;
  win_rate?: number;
  total_pnl?: number | string;
  daily_pnl?: number | string;
  [key: string]: unknown;
}

export interface NofxEquityPoint {
  timestamp?: string | number;
  equity?: number | string;
  [key: string]: unknown;
}

export interface NofxStrategy {
  id: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface NofxAiModel {
  id: string;
  name?: string;
  provider?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface NofxExchange {
  id: string;
  exchange_type?: string;
  enabled?: boolean;
  testnet?: boolean;
  [key: string]: unknown;
}
