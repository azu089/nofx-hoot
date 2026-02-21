/**
 * AI 模块共享类型定义
 *
 * 产品 A（AI 研究团队）和产品 B（AI 自动交易）的通用类型
 */

// ========================= 通用决策类型 =========================

/**
 * AI 6-Action 系统
 */
export type AiAction =
  | 'open_long'
  | 'open_short'
  | 'close_long'
  | 'close_short'
  | 'hold'
  | 'wait';

/**
 * AI 阵营
 */
export type AiCamp = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

/**
 * AI 交易决策（结构化输出）
 */
export interface AiTradeDecision {
  action: AiAction;
  confidence: number; // 0-100
  leverage: number;
  positionSizePercent: number; // 仓位百分比
  stopLoss: number | null;
  takeProfit: number | null;
  reasoning: string;
}

// ========================= 市场上下文 =========================

/**
 * 市场数据上下文
 */
export interface MarketContext {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  ohlcv: number[][];
  indicators: Record<string, any>;
  fundingRate?: number;
  openInterest?: number;
}

/**
 * 双时间框架市场上下文（产品 B 使用）
 */
export interface DualTimeframeContext extends MarketContext {
  secondaryTimeframe: string;
  secondaryOhlcv: number[][];
  secondaryIndicators: Record<string, any>;
}

// ========================= 产品 A: 研究团队类型 =========================

/**
 * TradingAgents 投资辩论状态
 */
export interface InvestDebateState {
  bullHistory: string;
  bearHistory: string;
  fullHistory: string;
  count: number;
  judgeDecision?: string;
}

/**
 * TradingAgents 风控三方辩论状态
 */
export interface RiskDebateState {
  aggressiveHistory: string;
  conservativeHistory: string;
  neutralHistory: string;
  fullHistory: string;
  latestSpeaker: 'aggressive' | 'conservative' | 'neutral' | 'judge';
  count: number;
  judgeDecision?: string;
}

/**
 * 分析师报告集合
 */
export interface AnalystReports {
  marketReport?: string;
  technicalReport?: string;
  fundamentalsReport?: string;
  newsReport?: string;
  sentimentReport?: string;
}

/**
 * 研究会话阶段状态
 */
export interface ResearchStage {
  stage: number; // 1-5
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  cost?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/**
 * 研究深度级别
 */
export type ResearchDepth = 'quick' | 'standard' | 'deep';

/**
 * 研究结果
 */
export interface ResearchResult {
  sessionId: string;
  stages: ResearchStage[];
  finalDecision: AiTradeDecision | null;
  totalCost: number;
  totalLatencyMs: number;
}

// ========================= 产品 B: 自动交易类型 =========================

/**
 * 币种来源配置（参考 NoFx CoinSourceConfig）
 */
export interface CoinSourceConfig {
  mode: 'static' | 'manual' | 'ai' | 'oi_top' | 'oi_low' | 'mixed';
  coins?: string[]; // static 模式
  maxCoins?: number; // ai/oi_top/oi_low/mixed 模式
  criteria?: string; // ai 模式
  minOiChange?: number; // oi_top 模式
  excludedCoins?: string[]; // 排除币种列表
}

/**
 * 指标配置
 */
export interface IndicatorConfig {
  timeframe: string;
  secondaryTimeframe?: string;
  selectedTimeframes?: string[];
  primaryTimeframe?: string;
  klineCount?: number;
  indicators: string[]; // ['RSI', 'MACD', 'BB', 'ATR', ...]
  enableEma?: boolean; emaPeriods?: string;
  enableMacd?: boolean;
  enableRsi?: boolean; rsiPeriods?: string;
  enableAtr?: boolean; atrPeriods?: string;
  enableBoll?: boolean; bollPeriods?: string;
  enableVolume?: boolean;
  enableOi?: boolean;
  enableFundingRate?: boolean;
}

/**
 * 风控配置
 */
export interface RiskControlConfig {
  maxPositions: number;
  minPositionSize: number; // USDT
  maxLeverage: number;
  maxDailyDrawdown: number; // USDT
  maxDailyTrades: number;
  cooldownMinutes: number;
  circuitBreaker: number;
  maxTradeAmountUSD?: number; // 单笔交易金额上限（USDT），不设则由 AI + 余额自动计算
  allocatedCapital?: number; // AI 资金池上限（USDT），仓位百分比基于此值计算而非交易所全部余额
  // 对齐 NoFx RiskControlConfig (store/strategy.go):
  btcEthMaxPositionValueRatio?: number;  // BTC/ETH 仓位价值倍数上限，默认 5.0
  altcoinMaxPositionValueRatio?: number; // 山寨币仓位价值倍数上限，默认 1.0
  excludedCoins?: string[]; // 排除币种列表（不开仓）
}

/**
 * 自动交易循环结果
 */
export interface CycleResult {
  strategyId: string;
  analyzed: number;
  executed: number;
  errors: number;
  decisions: Array<{
    symbol: string;
    action: AiAction;
    confidence: number;
    executed: boolean;
    result?: any;
  }>;
}

// ========================= 进化系统 =========================

/**
 * 进化等级
 */
export type EvolutionTier = 0 | 1 | 2 | 3;

/**
 * 进化状态
 */
export interface EvolutionState {
  tier: EvolutionTier;
  sharpe: number | null;
  description: string;
}
