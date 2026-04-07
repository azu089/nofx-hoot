/**
 * Agent state types - 1:1 mapping from Python TradingAgents
 */

// Researcher team state (Bull vs Bear debate)
export interface InvestDebateState {
  bull_history: string;
  bear_history: string;
  history: string;
  current_response: string;
  judge_decision: string;
  count: number;
}

// Risk management team state (Aggressive vs Conservative vs Neutral)
export interface RiskDebateState {
  aggressive_history: string;
  conservative_history: string;
  neutral_history: string;
  history: string;
  latest_speaker: string;
  current_aggressive_response: string;
  current_conservative_response: string;
  current_neutral_response: string;
  judge_decision: string;
  count: number;
}

// Main agent state (extends LangGraph MessagesState)
export interface AgentState {
  messages: unknown[];
  company_of_interest: string;
  trade_date: string;
  sender: string;

  // Research step reports
  market_report: string;
  sentiment_report: string;
  news_report: string;
  fundamentals_report: string;

  // Researcher team discussion
  investment_debate_state: InvestDebateState;
  investment_plan: string;

  // Trader planning
  trader_investment_plan: string;

  // Risk management team discussion
  risk_debate_state: RiskDebateState;
  final_trade_decision: string;

  // 交易上下文（可选，从 nofx-ts 传入）
  trading_context?: TradingContextForArena;
}

// 交易上下文（从 nofx-ts KernelContext 传入，供 Trader/Risk/PM 使用）
export interface TradingContextForArena {
  // 账户信息
  account_equity: number;
  available_balance: number;
  total_pnl_pct: number;
  margin_used_pct: number;
  position_count: number;

  // 当前持仓
  positions: Array<{
    symbol: string;
    side: string;
    entry_price: number;
    mark_price: number;
    quantity: number;
    unrealized_pnl_pct: number;
    leverage: number;
  }>;

  // 风控参数
  max_positions: number;
  btc_eth_max_leverage: number;
  altcoin_max_leverage: number;
  btc_eth_max_position_value: number;
  altcoin_max_position_value: number;
  max_margin_usage_pct: number;
  min_position_size: number;
  min_risk_reward_ratio: number;
  min_confidence: number;

  // 交易统计（可选）
  win_rate?: number;
  profit_factor?: number;
  max_drawdown_pct?: number;
}

// Analyst type identifiers
export type AnalystType = 'market' | 'social' | 'news' | 'fundamentals';
