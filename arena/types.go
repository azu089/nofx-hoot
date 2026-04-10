// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

// Package arena 实现 TradingAgents 多 AI 辩论策略（Arena 模式）。
// 13 个角色（4分析师 + 2研究员 + 1研究管理 + 1交易员 + 3风控辩论 + 1投资组合管理 + 1信号处理）
// 通过结构化辩论流程产出交易信号。
package arena

import (
	"time"
)

// ---------------------------------------------------------------------------
// ArenaConfig 策略配置（对应前端配置项）
// ---------------------------------------------------------------------------

type ArenaConfig struct {
	// 基础配置
	Symbols         []string `json:"symbols"`          // 交易币种列表 ["BTCUSDT", "ETHUSDT"]
	IntervalMinutes int      `json:"interval_minutes"`  // 决策频率（15/30/60）

	// AI 模型配置
	DeepThinkModel  string `json:"deep_think_model"`  // 深度思考模型（GPT/Claude/DeepSeek）
	QuickThinkModel string `json:"quick_think_model"` // 快速思考模型

	// 辩论配置
	SelectedAnalysts []string `json:"selected_analysts"` // 启用的分析师 ["market","social","news","fundamentals"]
	MaxDebateRounds  int      `json:"max_debate_rounds"` // 研究辩论轮数（默认1）
	MaxRiskRounds    int      `json:"max_risk_rounds"`   // 风控辩论轮数（默认1）

	// 风险偏好（映射到风控辩论者权重）
	RiskPreference string `json:"risk_preference"` // "aggressive" / "balanced" / "conservative"

	// 执行配置
	MaxLeverage     int     `json:"max_leverage"`      // 最大杠杆
	PositionSizeUSD float64 `json:"position_size_usd"` // 单笔仓位大小（USD notional）

	// 风控约束（AI 决策时可见，与 RiskControlConfig 核心字段对齐）
	MaxPositions      int     `json:"max_positions"`       // 最大并发持仓数
	PositionSizeRatio float64 `json:"position_size_ratio"` // 单笔仓位占余额比例 0-1
	MaxMarginUsage    float64 `json:"max_margin_usage"`    // 最大保证金使用率 0-1
	MinRiskReward     float64 `json:"min_risk_reward"`     // 最小风险回报比（止盈/止损）
	MinConfidence     int     `json:"min_confidence"`      // 最小 AI 置信度 0-100

	// 输出语言
	OutputLanguage string `json:"output_language"` // "Chinese" / "English"
}

// DefaultArenaConfig 返回默认配置
func DefaultArenaConfig() *ArenaConfig {
	return &ArenaConfig{
		Symbols:           []string{"BTCUSDT"},
		IntervalMinutes:   30,
		DeepThinkModel:    "gpt-4o",
		QuickThinkModel:   "gpt-4o-mini",
		SelectedAnalysts:  []string{"market", "social", "news", "fundamentals"},
		MaxDebateRounds:   1,
		MaxRiskRounds:     1,
		RiskPreference:    "balanced",
		MaxLeverage:       3,
		PositionSizeUSD:   1000,
		MaxPositions:      3,
		PositionSizeRatio: 0.3,  // 单笔 30% 余额
		MaxMarginUsage:    0.8,  // 最大 80% 保证金
		MinRiskReward:     1.5,  // 1:1.5 风险回报比
		MinConfidence:     60,   // 最小 60% 置信度
		OutputLanguage:    "Chinese",
	}
}

// ---------------------------------------------------------------------------
// ArenaState 辩论状态（对应 Python 的 AgentState）
// ---------------------------------------------------------------------------

type ArenaState struct {
	// 输入
	Symbol    string `json:"symbol"`
	TradeDate string `json:"trade_date"`

	// 执行上下文（供 AI 角色决策参考）
	AccountBalance     float64            `json:"account_balance"`       // = TotalEquity = wallet + unrealized
	AvailableMargin    float64            `json:"available_margin"`      // 可用保证金
	WalletBalance      float64            `json:"wallet_balance"`        // 钱包余额（未含未实现 PnL）
	TotalUnrealizedPnL float64            `json:"total_unrealized_pnl"`  // 总未实现盈亏
	MarginUsedPct      float64            `json:"margin_used_pct"`       // 保证金使用率 0-1
	CurrentPositions   []PositionSnapshot `json:"current_positions"`
	RiskConfig         RiskConfigSnapshot `json:"risk_config"`
	ExchangeType       string             `json:"exchange_type"`

	// 分析师报告
	MarketReport       string `json:"market_report"`
	SentimentReport    string `json:"sentiment_report"`
	NewsReport         string `json:"news_report"`
	FundamentalsReport string `json:"fundamentals_report"`

	// 研究辩论（Bull vs Bear）
	InvestDebate   InvestDebateState `json:"invest_debate"`
	InvestmentPlan string            `json:"investment_plan"`

	// 交易员计划
	TraderPlan string `json:"trader_plan"`

	// 风控辩论（Aggressive vs Conservative vs Neutral）
	RiskDebate RiskDebateState `json:"risk_debate"`

	// 最终决策
	FinalDecision string `json:"final_decision"`
	Signal        string `json:"signal"`     // BUY/OVERWEIGHT/HOLD/UNDERWEIGHT/SELL
	Confidence    int    `json:"confidence"` // 0-100

	// 历史交易统计（由 Runner 通过 TradeStatsProvider 注入；Trader 角色 prompt 使用）
	TradeStats string `json:"trade_stats"`

	// 开发者信息（累加每个 Agent 的 prompt + 响应，供前端展示）
	SystemPrompt     string `json:"system_prompt"`
	UserPrompt       string `json:"user_prompt"`
	CoTTrace         string `json:"cot_trace"`
	AICallDurationMs int64  `json:"ai_call_duration_ms"`
}

// PositionSnapshot 持仓快照（供 AI 角色参考）
type PositionSnapshot struct {
	Symbol        string  `json:"symbol"`
	Side          string  `json:"side"` // "LONG" / "SHORT"
	Quantity      float64 `json:"quantity"`
	EntryPrice    float64 `json:"entry_price"`
	MarkPrice     float64 `json:"mark_price"`
	UnrealizedPnL float64 `json:"unrealized_pnl"`
	Leverage      int     `json:"leverage"`
	MarginUsed    float64 `json:"margin_used"`
}

// RiskConfigSnapshot 风控约束快照
type RiskConfigSnapshot struct {
	MaxLeverage       int     `json:"max_leverage"`
	MaxPositions      int     `json:"max_positions"`
	PositionSizeRatio float64 `json:"position_size_ratio"` // 单笔仓位占余额比例
	MaxMarginUsage    float64 `json:"max_margin_usage"`    // 最大保证金使用率
	MinRiskReward     float64 `json:"min_risk_reward"`     // 最小风险回报比
	MinConfidence     int     `json:"min_confidence"`      // 最小置信度
}

// InvestDebateState 研究辩论状态（Bull vs Bear + Judge）
type InvestDebateState struct {
	BullHistory   string `json:"bull_history"`
	BearHistory   string `json:"bear_history"`
	History       string `json:"history"`        // 完整辩论记录
	CurrentResponse string `json:"current_response"` // 最后一个发言
	JudgeDecision string `json:"judge_decision"` // 管理器裁决
	Count         int    `json:"count"`          // 辩论轮数计数
}

// RiskDebateState 风控辩论状态（Aggressive vs Conservative vs Neutral + Judge）
type RiskDebateState struct {
	AggressiveHistory  string `json:"aggressive_history"`
	ConservativeHistory string `json:"conservative_history"`
	NeutralHistory     string `json:"neutral_history"`
	History            string `json:"history"`         // 完整辩论记录
	LatestSpeaker      string `json:"latest_speaker"`  // 最后发言者
	JudgeDecision      string `json:"judge_decision"`  // 投资组合管理器裁决
	Count              int    `json:"count"`           // 辩论轮数计数

	// 各角色最新发言（用于交叉引用辩论）
	CurrentAggressiveResponse  string `json:"current_aggressive_response"`
	CurrentConservativeResponse string `json:"current_conservative_response"`
	CurrentNeutralResponse     string `json:"current_neutral_response"`
}

// ---------------------------------------------------------------------------
// ArenaSignal 输出信号（供 Gatekeeper 和执行层消费）
// ---------------------------------------------------------------------------

type ArenaSignal struct {
	Symbol            string    `json:"symbol"`
	Signal            string    `json:"signal"`     // BUY/OVERWEIGHT/HOLD/UNDERWEIGHT/SELL
	Confidence        int       `json:"confidence"` // 0-100
	BullArgument      string    `json:"bull_argument"`
	BearArgument      string    `json:"bear_argument"`
	RiskDebateSummary string    `json:"risk_debate_summary"`
	PortfolioDecision string    `json:"portfolio_decision"`
	Timestamp         time.Time `json:"timestamp"`

	// 交易细节（由 parseTradingDetails 从 final_decision 解析）
	EntryPrice      float64 `json:"entry_price"`
	StopLoss        float64 `json:"stop_loss"`
	TakeProfit      float64 `json:"take_profit"`
	Leverage        int     `json:"leverage"`
	Quantity        float64 `json:"quantity"`
	PositionSizeUSD float64 `json:"position_size_usd"`
	RiskRewardRatio float64 `json:"risk_reward_ratio"`

	// 4 分析师报告 + 交易员计划（用于展示）
	MarketReport       string `json:"market_report"`
	SentimentReport    string `json:"sentiment_report"`
	NewsReport         string `json:"news_report"`
	FundamentalsReport string `json:"fundamentals_report"`
	TraderPlan         string `json:"trader_plan"`

	// 开发者信息
	SystemPrompt     string `json:"system_prompt"`
	UserPrompt       string `json:"user_prompt"`
	CoTTrace         string `json:"cot_trace"`
	AICallDurationMs int64  `json:"ai_call_duration_ms"`
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

// 信号类型
const (
	SignalBuy         = "BUY"
	SignalOverweight  = "OVERWEIGHT"
	SignalHold        = "HOLD"
	SignalUnderweight = "UNDERWEIGHT"
	SignalSell        = "SELL"
)

// 分析师类型
const (
	AnalystMarket       = "market"
	AnalystSocial       = "social"
	AnalystNews         = "news"
	AnalystFundamentals = "fundamentals"
)

// 风险偏好
const (
	RiskAggressive  = "aggressive"
	RiskBalanced    = "balanced"
	RiskConservative = "conservative"
)
