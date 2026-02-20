/**
 * AI 模块前端类型定义
 *
 * 与后端 ai.controller.ts 返回结构精确对齐
 */

// ========================= 通用 =========================

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ========================= AI Config =========================

export interface AiConfig {
  isEnabled: boolean;
  mode: string;
  models: string[];
  symbols: string[];
  timeframes: string[];
  rolePrompts: Record<string, string> | null;
  roleModels: Record<string, string> | null;
  minConfidence: number;
  maxPositionSize: number;
  maxLeverage: number;
  maxPositions: number;
  maxDailyTrades: number;
  maxDailyDrawdown: number;
  cooldownMinutes: number;
  monthlyBudget: number;
  currentSpend: number;
  amountPerTrade: number;
  autoEnabled: boolean;
  autoStatus: string;
  autoStatusReason?: string;
  evolutionTier: number;
  rollingSharpe: number;
  exchangeApiKeyId: string | null;
  hasApiKeys: boolean;
}

export interface UpdateAiConfigBody {
  isEnabled?: boolean;
  mode?: string;
  models?: string[];
  symbols?: string[];
  timeframes?: string[];
  rolePrompts?: Record<string, string>;
  roleModels?: Record<string, string>;
  minConfidence?: number;
  maxPositionSize?: number;
  maxLeverage?: number;
  maxPositions?: number;
  maxDailyTrades?: number;
  maxDailyDrawdown?: number;
  cooldownMinutes?: number;
  monthlyBudget?: number;
  amountPerTrade?: number;
  exchangeApiKeyId?: string;
  apiKeys?: Record<string, string>;
}

export interface UpdateAiConfigResponse {
  success: boolean;
  config: {
    isEnabled: boolean;
    mode: string;
    autoEnabled: boolean;
    autoStatus: string;
  };
}

// ========================= Budget =========================

export interface AiBudget {
  monthlyBudget: number;
  currentSpend: number;
  usagePercent: number;
  remaining: number;
  monthlyAnalyses: number;
  monthlyStrategyCycles: number;
  resetDate: string;
  status: 'normal' | 'warning' | 'exceeded';
}

// ========================= Performance =========================

export interface AiPerformance {
  modelRankings: Array<{
    modelId: string;
    totalAnalyses: number;
    avgConfidence: number;
    successRate: number;
    avgLatencyMs: number;
    totalCost: number;
    tier: number;
    sharpe: number;
  }>;
  roleAccuracy: Record<string, {
    total: number;
    correct: number;
    accuracy: number;
  }>;
  overview: {
    totalAnalyses: number;
    totalCost: number;
    avgConfidence: number;
    overallWinRate: number;
  };
}

// ========================= 产品 A: 研究 =========================

export interface ResearchSession {
  id: string;
  symbol: string;
  depth: string;
  status: string;
  autoExecute: boolean;
  finalDecision: ResearchDecision | null;
  executedTradeId: string | null;
  totalCost: number;
  errorMessage: string | null;
  createdAt: string;
  decision?: {
    action: string;
    confidence: number;
  } | null;
  // 循环字段
  cycleNumber?: number;
  rootSessionId?: string | null;
  cyclingConfig?: CyclingConfig | null;
  campaignStatus?: string | null;
  exchangeApiKeyId?: string | null;
  cycleCount?: number; // 后端附加的子会话数量
  cumulativePnl?: number;
  cumulativeCost?: number;
  totalCycles?: number;
}

export interface ResearchDecision {
  action: string;
  confidence: number;
  leverage?: number;
  positionSizePercent?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  reasoning?: string;
}

export interface ResearchStatus {
  sessionId: string;
  symbol: string;
  depth: string;
  status: string;
  autoExecute: boolean;
  currentStage: {
    stage: number;
    name: string;
    status: string;
  };
  stagesCompleted: number;
  totalStages: number;
  totalCost: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchStage {
  stage: number;
  name: string;
  status: string;
  result?: any;
  cost?: number;
  durationMs?: number;
}

export interface PositionSummary {
  positionId: string;
  status: string;
  side: string;
  entryPrice: number;
  markPrice: number | null;
  amount: number;
  leverage: number;
  margin: number;
  unrealizedPnl: number | null;
  realizedPnl: number | null;
  closeReason: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface ResearchReport {
  sessionId: string;
  symbol: string;
  depth: string;
  status: string;
  stages: ResearchStage[];
  finalDecision: ResearchDecision | null;
  executedTradeId: string | null;
  positionSummary: PositionSummary | null;
  totalCost: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  rootSessionId: string | null;
  campaignStatus: string | null;
  cycleNumber: number;
}

export interface ResearchHistoryResponse {
  data: ResearchSession[];
  pagination: Pagination;
}

export interface ExecuteResearchResponse {
  success: boolean;
  sessionId: string;
  symbol: string;
  action: string;
  orderId?: string;
  positionId?: string;
  error?: string;
}

// 循环配置
export interface CyclingConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxCycles: number;           // 0 = 无限
  profitTargetPercent: number; // 0 = 不限
  maxLossPercent: number;      // 0 = 不限
}

export interface StartResearchBody {
  symbol: string;
  depth?: 'quick' | 'standard' | 'deep';
  autoExecute?: boolean;
  quickModel?: string; // 快速模型（分析师用）
  deepModel?: string; // 深度模型（裁判用）
  exchangeApiKeyId?: string; // 指定交易所账号（覆盖全局配置）
  cyclingConfig?: CyclingConfig; // 自动循环配置
  riskControlConfig?: {
    maxPositions?: number;
    maxLeverage?: number;
    maxDailyDrawdown?: number;
    allocatedCapital?: number;
    maxDailyTrades?: number;
    cooldownMinutes?: number;
    circuitBreaker?: number;
  };
}

export interface StartResearchResponse {
  sessionId: string;
  symbol: string;
  depth: string;
  autoExecute: boolean;
  status: string;
  message: string;
}

// ========================= 产品 B: 结构化配置接口 =========================

export interface CoinSourceConfig {
  mode: 'static' | 'ai' | 'oi_top' | 'oi_low' | 'mixed';
  coins?: string[];
  maxCoins?: number;
  excludedCoins?: string[];
  criteria?: string;
  models?: string[];
}

export interface RiskControlConfig {
  maxPositions: number;
  minPositionSize: number;
  maxLeverage: number;
  maxDailyDrawdown: number;
  maxMarginUsage?: number;
  maxPositionPercent?: number;
  minConfidence?: number;
  minRiskReward?: number;
  amountPerTrade?: number;
  // NoFx 对齐新增
  maxDailyTrades?: number;
  cooldownMinutes?: number;
  circuitBreaker?: number;
  allocatedCapital?: number;
  btcEthMaxPositionValueRatio?: number;
  altcoinMaxPositionValueRatio?: number;
}

export interface PromptSections {
  role?: string;
  mode?: 'aggressive' | 'conservative' | 'scalping';
  custom?: string;
  tradingFrequency?: string;
  entryStandards?: string;
}

export interface GridConfig {
  symbol: string;
  gridCount: number;
  totalInvestment: number;
  upperBound: number;
  lowerBound: number;
  leverage: number;
  useAtrBounds?: boolean;
  atrMultiplier?: number;
  maxDrawdownPct?: number;
  stopLossPct?: number;
}

export interface IndicatorConfig {
  timeframe: string;
  secondaryTimeframe?: string;
  selectedTimeframes?: string[];
  primaryTimeframe?: string;
  klineCount?: number;
  indicators: string[];
  enableEma?: boolean; emaPeriods?: string;
  enableMacd?: boolean;
  enableRsi?: boolean; rsiPeriods?: string;
  enableAtr?: boolean; atrPeriods?: string;
  enableBoll?: boolean; bollPeriods?: string;
  enableVolume?: boolean;
  enableOi?: boolean;
  enableFundingRate?: boolean;
}

export interface PromptPreviewResponse {
  systemPrompt: string;
  sections: string[];
  estimatedTokens: number;
}

export interface TriggerCycleResponse {
  success: boolean;
  message: string;
  cycle: { analyzed: number; executed: number; errors: number; totalCost: number };
}

// ========================= 产品 B: 策略 =========================

export interface AiStrategy {
  id: string;
  userId: string;
  name: string;
  strategyType: string;
  tradingMode: string;
  models?: string[];
  coinSourceConfig: CoinSourceConfig | any;
  indicatorConfig: IndicatorConfig | any;
  riskControlConfig: RiskControlConfig | any;
  promptSections: PromptSections | any;
  gridConfig: GridConfig | any;
  debateConfig?: {
    maxRounds?: number;
    riskRounds?: number;
    temperature?: number;
  };
  intervalMinutes: number;
  isActive: boolean;
  isPublic: boolean;
  totalTrades: number;
  totalPnl: number;
  winRate: number;
  sharpe: number;
  lastCycleAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GridState {
  activeOrders: number;
  filledOrders: number;
  gridLevels: number;
  upperPrice?: number;
  lowerPrice?: number;
  gridSpacing?: number;
  totalInvestment?: number;
  leverage?: number;
  isInitialized?: boolean;
}

export interface StrategyDetailResponse {
  strategy: AiStrategy;
  nextCycleAt: string | null;
  todayPnl: number;
  gridState: GridState | null;
}

export interface AiStrategyWithPnl extends AiStrategy {
  todayPnl?: number;
}

export interface StrategyListResponse {
  data: AiStrategyWithPnl[];
  pagination: Pagination;
}

export interface StrategyPosition {
  id: string;
  symbol: string;
  side: string;
  leverage: number;
  entryPrice: number;
  exitPrice: number | null;
  amount: number;
  margin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  closeReason: string | null;
  source: string | null; // ai_strategy, ai_research, ai_analysis, strategy, manual
  status: string;
  createdAt: string;
  closedAt: string | null;
}

export interface StrategyPositionsResponse {
  data: StrategyPosition[];
  total: number;
}

/** 用户级持仓（独立于策略，含已删除策略的历史） */
export interface UserPosition extends StrategyPosition {
  strategyId: string | null;
  strategyName: string | null;
}

export interface UserPositionsResponse {
  data: UserPosition[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateStrategyBody {
  name: string;
  strategyType?: string;
  tradingMode?: string;
  coinSourceConfig: CoinSourceConfig;
  indicatorConfig: IndicatorConfig | any;
  riskControlConfig: RiskControlConfig;
  promptSections?: PromptSections;
  gridConfig?: GridConfig;
  intervalMinutes?: number;
  exchangeApiKeyId?: string; // 指定交易所账号
}

export interface CreateStrategyResponse {
  success: boolean;
  strategy: AiStrategy;
}

export interface StrategyControlResponse {
  success: boolean;
  strategy: AiStrategy;
  message: string;
}

export interface StrategyLogVote {
  modelId: string;
  action: string;
  confidence: number;
  weight: number;
  success: boolean;
  error?: string;
  reasoning?: string;
  personality?: string;
}

export interface StrategyLog {
  id: string;
  strategyId: string;
  symbol: string;
  decision: {
    action: string;
    confidence?: number;
    leverage?: number;
    positionSizePercent?: number;
    stopLoss?: number;
    takeProfit?: number;
    reasoning?: string;
    votes?: StrategyLogVote[];
  };
  executed: boolean;
  executionResult: any;
  createdAt: string;
}

export interface StrategyLogsResponse {
  data: StrategyLog[];
  pagination: Pagination;
}

export interface StrategyPnlChartResponse {
  strategyId: string;
  days: number;
  totalClosedTrades: number;
  finalPnl: number;
  dataPoints: Array<{ date: string; pnl: number }>;
}

export interface CompetitionEntry {
  rank: number;
  strategyId: string;
  name: string;
  type: string;
  mode: string;
  totalTrades: number;
  roi?: number;
  totalPnl?: number;
  winRate: number;
  sharpe: number;
  username: string;
  createdAt?: string;
}

export interface CompetitionResponse {
  period: string;
  snapshotAt: string | null;
  data: CompetitionEntry[];
  pagination: Pagination;
}

// ========================= 统一时间线 =========================

export interface TimelineSoloLog {
  entryType: 'solo_log';
  log: StrategyLog;
  strategy: { id: string; name: string; tradingMode: string };
}

export interface TimelineDebateLog {
  entryType: 'debate_log';
  log: StrategyLog;
  strategy: { id: string; name: string; tradingMode: string };
}

export interface TimelineResearch {
  entryType: 'research';
  session: ResearchSession;
}

export type TimelineEntry = TimelineSoloLog | TimelineDebateLog | TimelineResearch;

export interface TimelineResponse {
  data: TimelineEntry[];
  pagination: Pagination;
}

export interface ResearchStagesResponse {
  stages: any;
  finalDecision: any;
  status: string;
}

// ========================= 产品 A: 循环统计 =========================

export interface CampaignStats {
  rootSessionId: string;
  totalCycles: number;
  currentCycle: number;
  cumulativePnl: number;
  cumulativeCost: number;
  status: string;
  startedAt: string;
  lastCycleAt: string | null;
  childSessions: Array<{
    id: string;
    cycleNumber: number;
    status: string;
    finalDecision: ResearchDecision | null;
    executedTradeId: string | null;
    totalCost: number;
    pnl: number | null;
    positionStatus: string | null;
    createdAt: string;
  }>;
}
