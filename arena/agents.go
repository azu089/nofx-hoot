package arena

import (
	"encoding/json"
	"fmt"
	"nofx/kernel"
	"nofx/market"
	"nofx/mcp"
	"strings"
	"time"
)

// ExtractedDecision is the structured JSON tail produced by Portfolio Manager.
// Confidence is the LLM's self-reported 0-100 conviction (no code mapping).
type ExtractedDecision struct {
	Rating     string  `json:"rating"`
	Confidence int     `json:"confidence"`
	EntryPrice float64 `json:"entry_price"`
	StopLoss   float64 `json:"stop_loss"`
	TakeProfit float64 `json:"take_profit"`
	Leverage   int     `json:"leverage"`
	Reasoning  string  `json:"reasoning"`
}

// appendAgentTrace 累加 system prompt / user prompt / response 到 state
// 用于前端展示开发者信息（system_prompt / user_prompt / cot_trace）
func appendAgentTrace(state *ArenaState, agentName, sys, user, response string) {
	sep := fmt.Sprintf("\n\n=== %s ===\n", agentName)
	if sys != "" {
		state.SystemPrompt += sep + sys
	}
	if user != "" {
		state.UserPrompt += sep + user
	}
	if response != "" {
		state.CoTTrace += sep + response
	}
}

// ---------------------------------------------------------------------------
// agents.go — 13 个 Agent 函数
// 每个 Agent = prompt（从 Python 原版 1:1 翻译）+ LLM 调用 + 写入 state
//
// 角色列表：
//   4 分析师:  RunMarketAnalyst, RunSocialAnalyst, RunNewsAnalyst, RunFundamentalsAnalyst
//   2 研究员:  RunBullResearcher, RunBearResearcher
//   1 研究管理: RunResearchManager
//   1 交易员:  RunTrader
//   3 风控:    RunAggressiveDebater, RunConservativeDebater, RunNeutralDebater
//   1 投资组合: RunPortfolioManager
//   1 信号:    ExtractSignal
// ---------------------------------------------------------------------------

// langInstruction 1:1 对应 Python agent_utils.py::get_language_instruction
//
// Python 原版:
//
//	def get_language_instruction() -> str:
//	    lang = get_config().get("output_language", "English")
//	    if lang.strip().lower() == "english":
//	        return ""
//	    return f" Write your entire response in {lang}."
//
// 返回值以空格开头，因为会直接拼到 system_message 末尾的句号之后。
func langInstruction(config *ArenaConfig) string {
	if config == nil {
		return ""
	}
	lang := strings.TrimSpace(config.OutputLanguage)
	if lang == "" || strings.EqualFold(lang, "English") {
		return ""
	}
	// 标准化：Chinese / chinese / zh-CN / zh → "Chinese"
	if strings.EqualFold(lang, "chinese") || strings.EqualFold(lang, "zh") || strings.EqualFold(lang, "zh-CN") {
		lang = "Chinese"
	}
	return " Write your entire response in " + lang + "."
}

// buildAnalystSystemPrompt 拼装分析师的完整 system prompt
// 1:1 对应 Python ChatPromptTemplate.from_messages([("system", "...")]).partial(...)
//
// 组装方式：
//   prefix = "You are a helpful AI assistant... You have access to the following tools: {tool_names}.\n{system_message}For your reference, the current date is {current_date}. {instrument_context}"
//   replace {tool_names}, {system_message}, {current_date}, {instrument_context}
//   最后追加 langInstruction（中文时追加中文指令）
func buildAnalystSystemPrompt(roleSystemMessage, analystType, symbol, tradeDate string, config *ArenaConfig) string {
	toolNames := ToolNamesForAnalyst(analystType)
	// 1:1 对应 Python 原版：langInstruction 追加到 system_message 末尾
	// （Python: `system_message = "..." + get_language_instruction()`）
	// 这样展开后位置是：
	//   "... tools: {tool_names}.\n[role msg][markdown][lang]For your reference, {date}. {instrument}"
	// 而不是把 lang 放到 instrument 之后。
	roleMessageWithLang := roleSystemMessage + langInstruction(config)
	return fillTemplate(AnalystSystemPromptPrefix, map[string]string{
		"tool_names":         toolNames,
		"system_message":     roleMessageWithLang,
		"current_date":       tradeDate,
		"instrument_context": buildInstrumentContext(symbol),
	})
}

// buildInstrumentContext 构建交易标的上下文说明
//
// 源：Python agent_utils.py::build_instrument_context（股票市场版，引用 .TO/.L/.HK/.T 后缀）
//
// 加密货币适配：这是整个 Arena 系统**唯一的 prompt 文本改动点** ——
// 把 Python 原版的股票交易所后缀 (.TO, .L, .HK, .T) 替换为加密货币 USDT 永续合约说明。
// 其他所有分析师 prompt（AnalystSystemPromptPrefix + 4 个 SystemMessage）均与 Python 原版一字不差。
func buildInstrumentContext(symbol string) string {
	return fmt.Sprintf(
		"The instrument to analyze is `%s`. Use this exact ticker in every tool call, report, and recommendation, preserving the exchange-qualified format (e.g. BTCUSDT, ETHUSDT for Binance Futures perpetual contracts).",
		symbol,
	)
}

// ============================= 4 个分析师 ====================================

// RunMarketAnalyst 市场分析师 — 技术指标分析（tool calling 模式）
// 对应 Python: agents/analysts/market_analyst.py
// LLM 自主调用 get_stock_data + get_indicators 探索数据
func RunMarketAnalyst(client mcp.AIClient, state *ArenaState, data *market.Data,
	signals *kernel.MarketSignals, events []kernel.EventSignal, config *ArenaConfig) error {

	systemPrompt := buildAnalystSystemPrompt(
		MarketAnalystSystemMessage, AnalystMarket,
		state.Symbol, state.TradeDate, config,
	)

	// 初始 user message：对应 Python Propagator.create_initial_state() 塞入的第一个 human message
	// Python 原版只用 company_name 作为初始消息，我们加上简要持仓供 LLM 参考
	userPrompt := fmt.Sprintf("%s\n\n%s",
		state.Symbol,
		FormatPositionsBrief(state.CurrentPositions),
	)

	startTime := time.Now()
	report, err := RunAnalystWithTools(client, &AnalystLoopConfig{
		RoleName:     "MarketAnalyst",
		SystemPrompt: systemPrompt,
		UserPrompt:   userPrompt,
		Tools:        AnalystToolSets[AnalystMarket],
		ToolCtx: &ToolContext{
			Symbol:     state.Symbol,
			TradeDate:  state.TradeDate,
			MarketData: data,
			Signals:    signals,
			Events:     events,
		},
	})
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("market analyst failed: %w", err)
	}
	state.MarketReport = report
	appendAgentTrace(state, "MarketAnalyst", systemPrompt, userPrompt, report)
	return nil
}

// RunSocialAnalyst 社交媒体/情绪分析师（tool calling 模式）
// 对应 Python: agents/analysts/social_media_analyst.py
// LLM 自主调用 get_news 探索社交媒体相关信息
func RunSocialAnalyst(client mcp.AIClient, state *ArenaState, data *market.Data,
	signals *kernel.MarketSignals, events []kernel.EventSignal, config *ArenaConfig) error {

	systemPrompt := buildAnalystSystemPrompt(
		SocialAnalystSystemMessage, AnalystSocial,
		state.Symbol, state.TradeDate, config,
	)

	userPrompt := fmt.Sprintf("%s\n\n%s",
		state.Symbol,
		FormatPositionsBrief(state.CurrentPositions),
	)

	startTime := time.Now()
	report, err := RunAnalystWithTools(client, &AnalystLoopConfig{
		RoleName:     "SocialAnalyst",
		SystemPrompt: systemPrompt,
		UserPrompt:   userPrompt,
		Tools:        AnalystToolSets[AnalystSocial],
		ToolCtx: &ToolContext{
			Symbol:     state.Symbol,
			TradeDate:  state.TradeDate,
			MarketData: data,
			Signals:    signals,
			Events:     events,
		},
	})
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("social analyst failed: %w", err)
	}
	state.SentimentReport = report
	appendAgentTrace(state, "SocialAnalyst", systemPrompt, userPrompt, report)
	return nil
}

// RunNewsAnalyst 新闻分析师（tool calling 模式）
// 对应 Python: agents/analysts/news_analyst.py
// LLM 自主调用 get_news + get_global_news 探索新闻事件
func RunNewsAnalyst(client mcp.AIClient, state *ArenaState, data *market.Data,
	signals *kernel.MarketSignals, events []kernel.EventSignal, config *ArenaConfig) error {

	systemPrompt := buildAnalystSystemPrompt(
		NewsAnalystSystemMessage, AnalystNews,
		state.Symbol, state.TradeDate, config,
	)

	userPrompt := fmt.Sprintf("%s\n\n%s",
		state.Symbol,
		FormatPositionsBrief(state.CurrentPositions),
	)

	startTime := time.Now()
	report, err := RunAnalystWithTools(client, &AnalystLoopConfig{
		RoleName:     "NewsAnalyst",
		SystemPrompt: systemPrompt,
		UserPrompt:   userPrompt,
		Tools:        AnalystToolSets[AnalystNews],
		ToolCtx: &ToolContext{
			Symbol:     state.Symbol,
			TradeDate:  state.TradeDate,
			MarketData: data,
			Signals:    signals,
			Events:     events,
		},
	})
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("news analyst failed: %w", err)
	}
	state.NewsReport = report
	appendAgentTrace(state, "NewsAnalyst", systemPrompt, userPrompt, report)
	return nil
}

// RunFundamentalsAnalyst 基本面分析师（tool calling 模式）
// 对应 Python: agents/analysts/fundamentals_analyst.py
// LLM 自主调用 get_fundamentals + get_balance_sheet + get_cashflow + get_income_statement
// 加密货币适配：get_balance_sheet/get_cashflow/get_income_statement 返回 "not applicable"，
//            LLM 会自动改用 get_fundamentals 获取加密货币专用基本面（OI/资金费率/成交量/市场状态）
func RunFundamentalsAnalyst(client mcp.AIClient, state *ArenaState, data *market.Data,
	signals *kernel.MarketSignals, events []kernel.EventSignal, config *ArenaConfig) error {

	systemPrompt := buildAnalystSystemPrompt(
		FundamentalsAnalystSystemMessage, AnalystFundamentals,
		state.Symbol, state.TradeDate, config,
	)

	userPrompt := fmt.Sprintf("%s\n\n%s",
		state.Symbol,
		FormatPositionsBrief(state.CurrentPositions),
	)

	startTime := time.Now()
	report, err := RunAnalystWithTools(client, &AnalystLoopConfig{
		RoleName:     "FundamentalsAnalyst",
		SystemPrompt: systemPrompt,
		UserPrompt:   userPrompt,
		Tools:        AnalystToolSets[AnalystFundamentals],
		ToolCtx: &ToolContext{
			Symbol:     state.Symbol,
			TradeDate:  state.TradeDate,
			MarketData: data,
			Signals:    signals,
			Events:     events,
		},
	})
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("fundamentals analyst failed: %w", err)
	}
	state.FundamentalsReport = report
	appendAgentTrace(state, "FundamentalsAnalyst", systemPrompt, userPrompt, report)
	return nil
}

// ============================= 2 个研究员 ====================================

// RunBullResearcher 看多研究员 — 辩论看多立场
// 对应 Python: agents/researchers/bull_researcher.py
func RunBullResearcher(client mcp.AIClient, state *ArenaState, memory *FinancialMemory, config *ArenaConfig) error {
	debate := &state.InvestDebate

	// 检索历史记忆
	currSituation := state.MarketReport + "\n\n" + state.SentimentReport + "\n\n" + state.NewsReport + "\n\n" + state.FundamentalsReport
	pastMemoryStr := formatMemories(memory, currSituation, 2)

	systemPrompt := BullResearcherSystemPrompt

	userPrompt := fillTemplate(BullResearcherUserPromptTpl, map[string]string{
		"symbol":              state.Symbol,
		"market_report":       state.MarketReport,
		"sentiment_report":    state.SentimentReport,
		"news_report":         state.NewsReport,
		"fundamentals_report": state.FundamentalsReport,
		"debate_history":      debate.History,
		"last_bear_argument":  debate.CurrentResponse,
		"past_memories":       pastMemoryStr,
		"positions_brief":     FormatPositionsBrief(state.CurrentPositions),
	})

	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, userPrompt)
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("bull researcher LLM call failed: %w", err)
	}
	appendAgentTrace(state, "BullResearcher", systemPrompt, userPrompt, response)

	argument := "Bull Analyst: " + response
	debate.History += "\n" + argument
	debate.BullHistory += "\n" + argument
	debate.CurrentResponse = argument
	debate.Count++
	return nil
}

// RunBearResearcher 看空研究员 — 辩论看空立场
// 对应 Python: agents/researchers/bear_researcher.py
func RunBearResearcher(client mcp.AIClient, state *ArenaState, memory *FinancialMemory, config *ArenaConfig) error {
	debate := &state.InvestDebate

	currSituation := state.MarketReport + "\n\n" + state.SentimentReport + "\n\n" + state.NewsReport + "\n\n" + state.FundamentalsReport
	pastMemoryStr := formatMemories(memory, currSituation, 2)

	systemPrompt := BearResearcherSystemPrompt

	userPrompt := fillTemplate(BearResearcherUserPromptTpl, map[string]string{
		"symbol":              state.Symbol,
		"market_report":       state.MarketReport,
		"sentiment_report":    state.SentimentReport,
		"news_report":         state.NewsReport,
		"fundamentals_report": state.FundamentalsReport,
		"debate_history":      debate.History,
		"last_bull_argument":  debate.CurrentResponse,
		"past_memories":       pastMemoryStr,
		"positions_brief":     FormatPositionsBrief(state.CurrentPositions),
	})

	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, userPrompt)
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("bear researcher LLM call failed: %w", err)
	}
	appendAgentTrace(state, "BearResearcher", systemPrompt, userPrompt, response)

	argument := "Bear Analyst: " + response
	debate.History += "\n" + argument
	debate.BearHistory += "\n" + argument
	debate.CurrentResponse = argument
	debate.Count++
	return nil
}

// ============================= 1 个研究管理器 =================================

// RunResearchManager 研究管理器 — 裁决 Bull vs Bear 辩论，输出投资计划
// 对应 Python: agents/managers/research_manager.py
func RunResearchManager(client mcp.AIClient, state *ArenaState, memory *FinancialMemory, config *ArenaConfig) error {
	debate := &state.InvestDebate

	currSituation := state.MarketReport + "\n\n" + state.SentimentReport + "\n\n" + state.NewsReport + "\n\n" + state.FundamentalsReport
	pastMemoryStr := formatMemories(memory, currSituation, 2)

	systemPrompt := ResearchManagerSystemPrompt

	userPrompt := fillTemplate(ResearchManagerUserPromptTpl, map[string]string{
		"past_memories":       pastMemoryStr,
		"symbol":              state.Symbol,
		"debate_history":      debate.History,
		"market_report":       state.MarketReport,
		"sentiment_report":    state.SentimentReport,
		"news_report":         state.NewsReport,
		"fundamentals_report": state.FundamentalsReport,
	})

	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, userPrompt)
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("research manager LLM call failed: %w", err)
	}
	appendAgentTrace(state, "ResearchManager", systemPrompt, userPrompt, response)

	debate.JudgeDecision = response
	debate.CurrentResponse = response
	state.InvestmentPlan = response
	return nil
}

// ============================= 1 个交易员 ====================================

// formatTradeStatsForPrompt 兜底:空字符串时返回 "No recent trade history available."
func formatTradeStatsForPrompt(s string) string {
	if s == "" {
		return "No recent trade history available."
	}
	return s
}

// RunTrader 交易员 — 基于投资计划制定交易方案
// 对应 Python: agents/trader/trader.py
func RunTrader(client mcp.AIClient, state *ArenaState, memory *FinancialMemory, config *ArenaConfig) error {
	currSituation := state.MarketReport + "\n\n" + state.SentimentReport + "\n\n" + state.NewsReport + "\n\n" + state.FundamentalsReport
	pastMemoryStr := formatMemories(memory, currSituation, 2)

	systemPrompt := fillTemplate(TraderSystemPromptTpl, map[string]string{
		"past_memories": pastMemoryStr,
	})

	userPrompt := fillTemplate(TraderUserPromptTpl, map[string]string{
		"symbol":              state.Symbol,
		"investment_plan":     state.InvestmentPlan,
		"account_context":     FormatAccountContext(state),
		"trade_stats":         formatTradeStatsForPrompt(state.TradeStats),
		"risk_constraints":    FormatRiskConstraints(state.RiskConfig),
		"market_report":       state.MarketReport,
		"sentiment_report":    state.SentimentReport,
		"news_report":         state.NewsReport,
		"fundamentals_report": state.FundamentalsReport,
	})

	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, userPrompt)
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("trader LLM call failed: %w", err)
	}
	state.TraderPlan = response
	appendAgentTrace(state, "Trader", systemPrompt, userPrompt, response)
	return nil
}

// ============================= 3 个风控辩论者 =================================

// RunAggressiveDebater 激进风控 — 主张高回报高风险策略
// 对应 Python: agents/risk_mgmt/aggressive_debater.py
func RunAggressiveDebater(client mcp.AIClient, state *ArenaState, config *ArenaConfig) error {
	risk := &state.RiskDebate

	systemPrompt := AggressiveDebaterSystemPrompt

	userPrompt := fillTemplate(AggressiveDebaterUserPromptTpl, map[string]string{
		"trader_plan":                state.TraderPlan,
		"market_report":              state.MarketReport,
		"sentiment_report":           state.SentimentReport,
		"news_report":                state.NewsReport,
		"fundamentals_report":        state.FundamentalsReport,
		"risk_debate_history":        risk.History,
		"last_conservative_response": risk.CurrentConservativeResponse,
		"last_neutral_response":      risk.CurrentNeutralResponse,
		"positions_brief":            FormatPositionsBrief(state.CurrentPositions),
		"risk_constraints":           FormatRiskConstraints(state.RiskConfig),
	})

	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, userPrompt)
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("aggressive debater LLM call failed: %w", err)
	}
	appendAgentTrace(state, "AggressiveDebater", systemPrompt, userPrompt, response)

	argument := "Aggressive Analyst: " + response
	risk.History += "\n" + argument
	risk.AggressiveHistory += "\n" + argument
	risk.LatestSpeaker = "Aggressive"
	risk.CurrentAggressiveResponse = argument
	risk.Count++
	return nil
}

// RunConservativeDebater 保守风控 — 主张低风险稳定策略
// 对应 Python: agents/risk_mgmt/conservative_debater.py
func RunConservativeDebater(client mcp.AIClient, state *ArenaState, config *ArenaConfig) error {
	risk := &state.RiskDebate

	systemPrompt := ConservativeDebaterSystemPrompt

	userPrompt := fillTemplate(ConservativeDebaterUserPromptTpl, map[string]string{
		"trader_plan":              state.TraderPlan,
		"market_report":            state.MarketReport,
		"sentiment_report":         state.SentimentReport,
		"news_report":              state.NewsReport,
		"fundamentals_report":      state.FundamentalsReport,
		"risk_debate_history":      risk.History,
		"last_aggressive_response": risk.CurrentAggressiveResponse,
		"last_neutral_response":    risk.CurrentNeutralResponse,
		"positions_brief":          FormatPositionsBrief(state.CurrentPositions),
		"risk_constraints":         FormatRiskConstraints(state.RiskConfig),
	})

	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, userPrompt)
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("conservative debater LLM call failed: %w", err)
	}
	appendAgentTrace(state, "ConservativeDebater", systemPrompt, userPrompt, response)

	argument := "Conservative Analyst: " + response
	risk.History += "\n" + argument
	risk.ConservativeHistory += "\n" + argument
	risk.LatestSpeaker = "Conservative"
	risk.CurrentConservativeResponse = argument
	risk.Count++
	return nil
}

// RunNeutralDebater 中立风控 — 平衡视角
// 对应 Python: agents/risk_mgmt/neutral_debater.py
func RunNeutralDebater(client mcp.AIClient, state *ArenaState, config *ArenaConfig) error {
	risk := &state.RiskDebate

	systemPrompt := NeutralDebaterSystemPrompt

	userPrompt := fillTemplate(NeutralDebaterUserPromptTpl, map[string]string{
		"trader_plan":                state.TraderPlan,
		"market_report":              state.MarketReport,
		"sentiment_report":           state.SentimentReport,
		"news_report":                state.NewsReport,
		"fundamentals_report":        state.FundamentalsReport,
		"risk_debate_history":        risk.History,
		"last_aggressive_response":   risk.CurrentAggressiveResponse,
		"last_conservative_response": risk.CurrentConservativeResponse,
		"positions_brief":            FormatPositionsBrief(state.CurrentPositions),
		"risk_constraints":           FormatRiskConstraints(state.RiskConfig),
	})

	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, userPrompt)
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("neutral debater LLM call failed: %w", err)
	}
	appendAgentTrace(state, "NeutralDebater", systemPrompt, userPrompt, response)

	argument := "Neutral Analyst: " + response
	risk.History += "\n" + argument
	risk.NeutralHistory += "\n" + argument
	risk.LatestSpeaker = "Neutral"
	risk.CurrentNeutralResponse = argument
	risk.Count++
	return nil
}

// ============================= 1 个投资组合管理器 ==============================

// RunPortfolioManager 投资组合管理器 — 综合风控辩论，做最终决策
// 对应 Python: agents/managers/portfolio_manager.py
func RunPortfolioManager(client mcp.AIClient, state *ArenaState, memory *FinancialMemory, config *ArenaConfig) error {
	risk := &state.RiskDebate

	currSituation := state.MarketReport + "\n\n" + state.SentimentReport + "\n\n" + state.NewsReport + "\n\n" + state.FundamentalsReport
	pastMemoryStr := formatMemories(memory, currSituation, 2)

	systemPrompt := PortfolioManagerSystemPrompt

	userPrompt := fillTemplate(PortfolioManagerUserPromptTpl, map[string]string{
		"instrument_context":         buildInstrumentContext(state.Symbol),
		"trader_plan":                state.TraderPlan,
		"past_memories":              pastMemoryStr,
		"risk_debate_history":        risk.History,
		"account_context":            FormatAccountContext(state),
		"risk_constraints":           FormatRiskConstraints(state.RiskConfig),
		"market_report":              state.MarketReport,
		"sentiment_report":           state.SentimentReport,
		"news_report":                state.NewsReport,
		"fundamentals_report":        state.FundamentalsReport,
		"bull_argument":              state.InvestDebate.BullHistory,
		"bear_argument":              state.InvestDebate.BearHistory,
		"research_manager_decision":  state.InvestDebate.JudgeDecision,
	}) + langInstruction(config)

	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, userPrompt)
	state.AICallDurationMs += time.Since(startTime).Milliseconds()
	if err != nil {
		return fmt.Errorf("portfolio manager LLM call failed: %w", err)
	}
	appendAgentTrace(state, "PortfolioManager", systemPrompt, userPrompt, response)

	risk.JudgeDecision = response
	risk.LatestSpeaker = "Judge"
	state.FinalDecision = response
	return nil
}

// ============================= 1 个信号处理器 =================================

// ExtractSignal 从完整决策文本中提取交易信号 + 结构化字段
//
// 优先级:
//  1. 解析 Portfolio Manager 末尾的 fenced JSON（含 LLM 自报 confidence + 交易细节）
//  2. fallback: 调用 SignalExtractor LLM 抽取枚举（旧逻辑）
//
// 返回的 ExtractedDecision.Confidence 为 LLM 自报值（0 表示未提供，由调用方 fallback 到 signalToConfidence）。
func ExtractSignal(client mcp.AIClient, fullDecision string, state *ArenaState) (string, ExtractedDecision, error) {
	var extracted ExtractedDecision

	// Layer 1: 直接从 PM final_decision 抽 JSON
	if jsonStr, err := kernel.ExtractFirstJSON(fullDecision); err == nil {
		var dec ExtractedDecision
		if jerr := json.Unmarshal([]byte(jsonStr), &dec); jerr == nil {
			rating := normalizeSignal(dec.Rating)
			if rating != "" {
				extracted = dec
				if state != nil {
					appendAgentTrace(state, "SignalExtractor",
						"(json-extract from PM final_decision)", fullDecision, jsonStr)
				}
				return rating, extracted, nil
			}
		}
	}

	// Layer 2: fallback to LLM enum extraction
	systemPrompt := SignalExtractorSystemPrompt
	startTime := time.Now()
	response, err := client.CallWithMessages(systemPrompt, fullDecision)
	if state != nil {
		state.AICallDurationMs += time.Since(startTime).Milliseconds()
		appendAgentTrace(state, "SignalExtractor", systemPrompt, fullDecision, response)
	}
	if err != nil {
		return SignalHold, extracted, fmt.Errorf("extract signal LLM call failed: %w", err)
	}

	rating := normalizeSignal(response)
	if rating == "" {
		rating = SignalHold
	}
	return rating, extracted, nil
}

// normalizeSignal 将任意文本规范化为 5 个标准信号枚举之一，无法识别返回 ""。
func normalizeSignal(raw string) string {
	signal := strings.TrimSpace(strings.ToUpper(raw))
	switch signal {
	case SignalBuy, SignalOverweight, SignalHold, SignalUnderweight, SignalSell:
		return signal
	}
	if strings.Contains(signal, "OVERWEIGHT") {
		return SignalOverweight
	}
	if strings.Contains(signal, "UNDERWEIGHT") {
		return SignalUnderweight
	}
	if strings.Contains(signal, "BUY") {
		return SignalBuy
	}
	if strings.Contains(signal, "SELL") {
		return SignalSell
	}
	if strings.Contains(signal, "HOLD") {
		return SignalHold
	}
	return ""
}

// ---------------------------------------------------------------------------
// 内部辅助
// ---------------------------------------------------------------------------

// formatMemories 检索记忆并格式化为文本
func formatMemories(memory *FinancialMemory, situation string, n int) string {
	if memory == nil {
		return "No past memories found."
	}
	matches := memory.GetMemories(situation, n)
	if len(matches) == 0 {
		return "No past memories found."
	}
	var b strings.Builder
	for _, m := range matches {
		b.WriteString(m.Recommendation)
		b.WriteString("\n\n")
	}
	return b.String()
}
