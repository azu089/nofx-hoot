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
  // R3: SL/TP 百分比（执行时用最新价格重算绝对值）
  stopLossPct?: number;   // 如 0.03 = 3%
  takeProfitPct?: number; // 如 0.06 = 6%
  symbol?: string;        // 多币种模式: LLM 输出的 symbol (用于逐币匹配)
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
 * 投资辩论状态
 */
export interface InvestDebateState {
  bullHistory: string;
  bearHistory: string;
  fullHistory: string;
  count: number;
  judgeDecision?: string;
}

/**
 * 风控三方辩论状态
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
 * 币种来源配置
 */
export interface CoinSourceConfig {
  mode: 'static' | 'manual' | 'ai' | 'oi_top' | 'oi_low' | 'mixed';
  coins?: string[]; // static 模式
  maxCoins?: number; // ai/oi_top/oi_low/mixed 模式
  criteria?: string; // ai 模式
  minOiChange?: number; // oi_top 模式
  excludedCoins?: string[]; // 排除币种列表
  models?: string[]; // 策略级模型列表（创建策略时由前端写入）
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
  // 仓位价值比例控制:
  btcEthMaxPositionValueRatio?: number;  // BTC/ETH 仓位价值倍数上限，默认 5.0
  altcoinMaxPositionValueRatio?: number; // 山寨币仓位价值倍数上限，默认 1.0
  excludedCoins?: string[]; // 排除币种列表（不开仓）
  // R4: 仓位百分比上限，默认 20（保守风控），用户可按策略调大
  maxPositionPct?: number;
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

// ========================= 增强市场数据类型（Phase 11: 数据源增强） =========================

/** Binance 多空账户比 */
export interface LongShortRatioData {
  longShortRatio: number;   // >1偏多, <1偏空
  longAccount: number;      // 多头账户占比 0-1
  shortAccount: number;     // 空头账户占比 0-1
  timestamp: number;
}

/** Binance Taker 买卖比 */
export interface TakerFlowData {
  buySellRatio: number;     // >1主动买入多, <1主动卖出多
  buyVol: number;
  sellVol: number;
  timestamp: number;
}

/** Binance OI 历史数据点 */
export interface OIHistoryData {
  sumOpenInterest: number;
  sumOpenInterestValue: number;  // USD
  timestamp: number;
}

/** DeFiLlama 稳定币资金流 */
export interface StablecoinFlowData {
  totalMarketCap: number;
  usdtCirculating: number;
  usdcCirculating: number;
  change24h: number;        // 24h 变化百分比
  change7d: number;         // 7d 变化百分比
  netMinted24h: number;     // 正=铸造(资金流入), 负=销毁(资金流出)
  timestamp: number;
}

/** Deribit 期权市场数据 */
export interface OptionsMarketData {
  putCallRatio: number;     // <0.7偏多, >1.3偏空
  totalCallOI: number;      // USD
  totalPutOI: number;       // USD
  maxPainPrice: number;
  impliedVolatility: number; // 加权平均 IV
  timestamp: number;
}

/** FRED 宏观经济数据 */
export interface MacroData {
  fedFundsRate: number;
  cpiYoY: number;
  yieldCurveSpread: number;  // 10Y-2Y 收益率差
  vix: number;
  lastUpdated: string;
  timestamp: number;
}

/** CoinGlass 清算热力图 */
export interface LiquidationHeatmapData {
  total24hLiquidation: number;    // USD
  longLiquidation24h: number;     // USD
  shortLiquidation24h: number;    // USD
  nearestUpLiqZone: number;       // 最近上方清算密集区价格
  nearestDownLiqZone: number;     // 最近下方清算密集区价格
  timestamp: number;
}

/** CoinGlass ETF 资金流 */
export interface ETFFlowData {
  btcEtfNetFlow24h: number;   // USD
  ethEtfNetFlow24h: number;   // USD
  trend: 'inflow' | 'outflow' | 'neutral';
  timestamp: number;
}

/** CFTC COT 机构持仓报告 */
export interface COTReportData {
  btcNetSpeculative: number;  // 投机净头寸 (long - short)
  reportDate: string;
  timestamp: number;
}

/** 所有增强数据的聚合（单一入口） */
export interface EnhancedMarketData {
  longShortRatio?: LongShortRatioData;
  takerFlow?: TakerFlowData;
  oiHistory?: OIHistoryData[];
  stablecoinFlows?: StablecoinFlowData;
  optionsData?: OptionsMarketData;
  macroData?: MacroData;
  liquidationHeatmap?: LiquidationHeatmapData;
  etfFlows?: ETFFlowData;
  cotReport?: COTReportData;
}
