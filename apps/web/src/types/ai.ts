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
  locale?: string;
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
  locale?: string;
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
  exchangeName?: string | null;
  exchangeLabel?: string | null;
}

export interface ResearchDecision {
  action: string;
  confidence: number;
  leverage?: number;
  positionSizePercent?: number;
  capitalUSD?: number;
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
  // 循环/活动字段（后端动态附加）
  rootSessionId?: string | null;
  model?: string;
  cyclingConfig?: ResearchCyclingConfig | null;
}

/** 研究循环配置（后端动态附加到 ResearchStatus） */
export interface ResearchCyclingConfig {
  intervalMinutes?: number;
  maxCycles?: number;
  profitTargetPercent?: number;
  maxLossPercent?: number;
  riskControlConfig?: {
    allocatedCapital?: number;
    maxLeverage?: number;
    maxPositions?: number;
    maxDailyDrawdown?: number;
    maxDailyTrades?: number;
    cooldownMinutes?: number;
    circuitBreaker?: number;
  };
}

/** 研究阶段结果 — 各阶段返回结构不同，联合所有已知属性 */
export interface ResearchStageResult {
  // 分析师阶段
  reports?: Record<string, string>;
  // 辩论阶段
  entries?: Array<Record<string, unknown>> | number;
  consensus?: ResearchStageResult;
  // 交易决策阶段 (proposal 可以是 string 或 parsed object)
  proposal?: ResearchStageResult | string;
  action?: string;
  confidence?: number;
  leverage?: number;
  positionSizePercent?: number;
  capitalUSD?: number;
  stopLoss?: string | number;
  takeProfit?: string | number;
  reasoning?: string;
  // 风控阶段
  riskResult?: ResearchStageResult;
  approved?: boolean;
  riskRating?: string;
  adjustedLeverage?: number;
  adjustedSL?: string | number;
  adjustedTP?: string | number;
  debateHistory?: Array<{ role?: string; content?: string; chainOfThought?: string }>;
  skipped?: boolean;
  // 最终决策阶段
  decision?: {
    action?: string;
    confidence?: number;
    leverage?: number;
    reasoning?: string;
    direction?: string;
    positionSizePercent?: number;
    stopLoss?: string | number;
    takeProfit?: string | number;
  };
  safetyPassed?: boolean;
  riskApproved?: boolean;
  executedTradeId?: string;
  direction?: string;
  // 辩论/提示阶段
  systemPrompt?: string;
  userPrompt?: string;
  chainOfThought?: string;
}

export interface ResearchStage {
  stage: number;
  name: string;
  status: string;
  result?: ResearchStageResult;
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
    minPositionSize?: number;
    minConfidence?: number;
    minRiskRewardRatio?: number;
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
  minRiskRewardRatio?: number;
  amountPerTrade?: number;
  // 风控扩展字段
  maxDailyTrades?: number;
  cooldownMinutes?: number;
  circuitBreaker?: number;
  allocatedCapital?: number;
  btcEthMaxPositionValueRatio?: number;
  altcoinMaxPositionValueRatio?: number;
  btcEthMaxLeverage?: number;
  altcoinMaxLeverage?: number;
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
  upperBoundPct?: number;  // 上界原始百分比（如 0.5 表示 +0.5%），避免 Math.round 损精度
  lowerBoundPct?: number;  // 下界原始百分比
  leverage: number;
  direction?: 'neutral' | 'long' | 'short' | 'long_bias' | 'short_bias'; // 网格初始方向
  distribution?: 'uniform' | 'gaussian' | 'pyramid';  // 格线分布
  useAtrBounds?: boolean;
  atrMultiplier?: number;
  maxDrawdownPct?: number;
  stopLossPct?: number;
  autoAdjustThreshold?: number;  // 网格重建阈值（小数，如 0.20 = 20%）
  dailyLossLimitPct?: number;
  breakoutPct?: number;          // 突破边界暂停阈值%
  useMakerOnly?: boolean;        // PostOnly 限价单（省 maker 手续费）
  autoPauseOnTrend?: boolean;    // 趋势市场自动软暂停（默认 true）
  enableDirectionAdjust?: boolean; // 启用方向自适应（默认 false）
  directionBiasRatio?: number;     // 偏向比例（小数，如 0.70 = 70%）
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
  quickModel?: string;
  coinSourceConfig: CoinSourceConfig;
  indicatorConfig: IndicatorConfig;
  riskControlConfig: RiskControlConfig;
  promptSections: PromptSections;
  gridConfig: GridConfig;
  debateConfig?: {
    maxRounds?: number;
    riskRounds?: number;
    temperature?: number;
  };
  intervalMinutes: number;
  stopConditions?: {
    maxCycles?: number;
    profitTargetPercent?: number;
    maxLossPercent?: number;
  };
  exchangeApiKeyId?: string | null;
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
  rangeSource?: string;   // '用户指定' | 'ATR×5.0' | '±3.0%兜底' 等
  isPaused?: boolean;
  pauseSource?: string;
  pauseReason?: string;
}

export interface StrategyDetailResponse {
  strategy: AiStrategy;
  nextCycleAt: string | null;
  todayPnl: number;
  gridState: GridState | null;
  exchangeLabel?: string | null;
  exchangeName?: string | null;
}

export interface AiStrategyWithPnl extends AiStrategy {
  todayPnl?: number;
  exchangeName?: string | null;
  exchangeLabel?: string | null;
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
  models?: string[];
  coinSourceConfig: CoinSourceConfig;
  indicatorConfig: IndicatorConfig;
  riskControlConfig: RiskControlConfig;
  promptSections?: PromptSections;
  gridConfig?: GridConfig;
  debateConfig?: { maxRounds?: number; riskRounds?: number; temperature?: number };
  intervalMinutes?: number;
  exchangeApiKeyId?: string; // 指定交易所账号
  stopConditions?: { maxCycles?: number; profitTargetPercent?: number; maxLossPercent?: number };
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
  // Per-vote 交易参数
  leverage?: number;
  positionSizePercent?: number;
  stopLoss?: number | null;    // 绝对价格 (如 $62000)
  takeProfit?: number | null;  // 绝对价格 (如 $72000)
  stopLossPct?: number;        // 向后兼容（历史数据可能有）
  takeProfitPct?: number;
}

export interface StrategyLog {
  id: string;
  strategyId: string;
  symbol: string;
  decision: {
    action?: string;
    confidence?: number;
    leverage?: number;
    positionSizePercent?: number;
    capitalUSD?: number;
    stopLoss?: number;
    takeProfit?: number;
    stopLossPct?: number;      // 百分比形式 (如 0.03 = 3%)
    takeProfitPct?: number;    // 百分比形式 (如 0.06 = 6%)
    reasoning?: string;
    modelId?: string; // Solo 模式使用的模型 (后端增强后生效)
    votes?: StrategyLogVote[];
    // Grid 策略: decisions 数组替代 action
    decisions?: Array<{ action: string; reasoning?: string; lowerPrice?: number; upperPrice?: number; level_index?: number; price?: number; quantity?: number; order_id?: string; confidence?: number }>;
    gridSummary?: string; // Grid 操作摘要 (如 "5买/5卖")
    cost?: number;
    aiThinking?: string; // AI 思考链（DeepSeek-Reasoner / Claude 扩展思考）
    // Grid 状态快照
    gridSnapshot?: {
      upperPrice: number;
      lowerPrice: number;
      gridSpacing?: number;
      direction: string;
      regime: string;
      totalLevels: number;
      filledLevels: number;
      pendingLevels: number;
      activeOrders: number;
      totalProfit: number;
      totalPnl?: number;
      unrealizedPnl?: number;
      totalTrades: number;
      winRate: number;
      maxDrawdown: number;
      dailyPnl: number;
      leverage?: number;
      userFixedLeverage?: boolean;
      breakoutLevel: string;
      lastPrice: number;
      rangeSource?: string;  // 网格范围来源: 'AI决策' | 'ATR×5' | '用户指定' | '±8%兜底' 等
      gridLines?: Array<{
        lv: number;    // 层号（1-based）
        p: number;     // 价格
        s: string;     // side: 'buy'|'sell'
        st: string;    // state: 'filled'|'pending'|'empty'
        qty?: number;  // filled: 持仓量 / pending: 挂单量
        ep?: number;   // filled: 建仓价
        oid?: string;  // pending: 订单ID末8位
      }>;
    };
    // auto_disabled_failure 格式
    reason?: string;
    lastError?: string;
    // 系统日志结构化参数（i18n 渲染用）
    from?: string;          // direction_change: 旧方向
    to?: string;            // direction_change: 新方向
    limitPct?: number;      // daily_loss_pause: 日亏损限制
    actualPct?: number;     // daily_loss_pause: 实际亏损
    pnlAmount?: number;     // daily_loss_pause: PnL 金额
    totalDailyPnl?: number; // circuit_breaker: 当日总 PnL
    maxDailyDrawdown?: number; // circuit_breaker: 最大回撤限制
    attempted?: number;     // grid_exec_failed: 尝试下单数
    categories?: string[];  // grid_exec_failed / grid_idle: 错误分类
    skipReasons?: string[]; // grid_idle: 空转原因
    isExecFailed?: boolean; // grid_idle vs grid_exec_failed 区分
    gridCount?: number;     // grid_initialized: 网格数量
    lower?: number;         // grid_initialized: 下边界
    upper?: number;         // grid_initialized: 上边界
    minConfFilter?: boolean; // wait: minConfidence 过滤
    actual?: number;        // wait: 实际置信度
    required?: number;      // wait: 要求置信度
  };
  executed: boolean;
  executionResult: {
    blocked?: boolean;
    blockedBy?: string;
    reason?: string;
    skipped?: boolean;
    orderId?: string;
    positionId?: string;
    price?: number;
    amount?: number;
    error?: string;
  } | null;
  createdAt: string;
  // 日志透明化字段（Solo 模式）
  rawResponse?: string;   // LLM 原始输出
  systemPrompt?: string;  // 发给 AI 的系统提示词
  userPrompt?: string;    // 发给 AI 的用户消息（含市场数据快照）
}

export interface StrategyLogsResponse {
  data: StrategyLog[];
  pagination: Pagination;
  totalAll?: number;
  skippedCount?: number;
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
  strategy: { id: string; name: string; tradingMode: string; models?: string[] };
}

export interface TimelineDebateLog {
  entryType: 'debate_log';
  log: StrategyLog;
  strategy: { id: string; name: string; tradingMode: string; models?: string[] };
}

export interface TimelineResearch {
  entryType: 'research';
  session: ResearchSession;
}

export interface TimelineGridLog {
  entryType: 'grid_log';
  log: StrategyLog;
  strategy: { id: string; name: string; tradingMode: string; models?: string[] };
}

export type TimelineEntry = TimelineSoloLog | TimelineDebateLog | TimelineResearch | TimelineGridLog;

export interface TimelineResponse {
  data: TimelineEntry[];
  pagination: Pagination;
  totalAll?: number;
  skippedCount?: number;
}

export interface ResearchStagesResponse {
  stages: ResearchStage[];
  finalDecision: ResearchDecision | null;
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
  // 后端动态附加的循环配置
  cyclingConfig?: ResearchCyclingConfig | null;
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
