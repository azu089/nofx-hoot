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

export interface ResearchReport {
  sessionId: string;
  symbol: string;
  depth: string;
  status: string;
  stages: ResearchStage[];
  finalDecision: ResearchDecision | null;
  executedTradeId: string | null;
  totalCost: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface StartResearchBody {
  symbol: string;
  depth?: 'quick' | 'standard' | 'deep';
  autoExecute?: boolean;
}

export interface StartResearchResponse {
  sessionId: string;
  symbol: string;
  depth: string;
  autoExecute: boolean;
  status: string;
  message: string;
}

// ========================= 产品 B: 策略 =========================

export interface AiStrategy {
  id: string;
  userId: string;
  name: string;
  strategyType: string;
  tradingMode: string;
  coinSourceConfig: any;
  indicatorConfig: any;
  riskControlConfig: any;
  promptSections: any;
  gridConfig: any;
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

export interface StrategyDetailResponse {
  strategy: AiStrategy;
  nextCycleAt: string | null;
  todayPnl: number;
  gridState: any;
}

export interface StrategyListResponse {
  data: AiStrategy[];
  pagination: Pagination;
}

export interface CreateStrategyBody {
  name: string;
  strategyType?: string;
  tradingMode?: string;
  coinSourceConfig: any;
  indicatorConfig: any;
  riskControlConfig: any;
  promptSections?: any;
  gridConfig?: any;
  intervalMinutes?: number;
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

export interface StrategyLog {
  id: string;
  strategyId: string;
  symbol: string;
  decision: {
    action: string;
    confidence?: number;
    leverage?: number;
    positionSizePercent?: number;
    reasoning?: string;
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
