package arena

import (
	"fmt"
	"log"
	"nofx/kernel"
	"nofx/market"
	"nofx/mcp"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// parseTradingDetails 从最终决策文本中解析交易细节（中英文兼容）
// 返回 (entryPrice, stopLoss, takeProfit, leverage)，未找到时为 0。
func parseTradingDetails(text string) (float64, float64, float64, int) {
	if text == "" {
		return 0, 0, 0, 0
	}
	// (?i) 不区分大小写；允许 $ / : / = / 中文冒号
	// 数字模式：支持负号、小数、科学计数法
	numPat := `(-?[\d.]+(?:[eE][+-]?\d+)?)`
	entryRe := regexp.MustCompile(`(?i)(?:入场[价格]?|entry(?:\s*price)?)\s*[=：:]\s*\$?` + numPat)
	slRe := regexp.MustCompile(`(?i)(?:止损|stop\s*loss|sl)\s*[=：:]\s*\$?` + numPat)
	tpRe := regexp.MustCompile(`(?i)(?:止盈|take\s*profit|tp)\s*[=：:]\s*\$?` + numPat)
	levRe := regexp.MustCompile(`(?i)(?:杠杆|leverage)\s*[=：:]\s*` + numPat + `x?`)

	parseFloat := func(re *regexp.Regexp) float64 {
		m := re.FindStringSubmatch(text)
		if len(m) < 2 {
			return 0
		}
		v, _ := strconv.ParseFloat(m[1], 64)
		return v
	}
	parseInt := func(re *regexp.Regexp) int {
		m := re.FindStringSubmatch(text)
		if len(m) < 2 {
			return 0
		}
		// 兼容 "5", "5.0", "1e1" 等格式
		f, err := strconv.ParseFloat(m[1], 64)
		if err != nil {
			return 0
		}
		return int(f)
	}

	return parseFloat(entryRe), parseFloat(slRe), parseFloat(tpRe), parseInt(levRe)
}

// ---------------------------------------------------------------------------
// ArenaEngine 编排 13 角色顺序执行，产出 ArenaSignal
// 1:1 对应 Python TradingAgents/graph/trading_graph.py 的 propagate()
// + TradingAgents/graph/reflection.py 的 reflect_and_remember()
// ---------------------------------------------------------------------------

// ArenaEngine 辩论引擎
type ArenaEngine struct {
	Config   *ArenaConfig
	aiClient mcp.AIClient

	// 5 个独立记忆实例（对应 Python 的 5 个 memory）
	bullMemory      *FinancialMemory
	bearMemory      *FinancialMemory
	traderMemory    *FinancialMemory
	judgeMemory     *FinancialMemory
	portfolioMemory *FinancialMemory

	// 统计
	TotalRuns   int
	LastRunTime time.Duration
}

// NewArenaEngine 创建引擎实例
func NewArenaEngine(config *ArenaConfig, aiClient mcp.AIClient) *ArenaEngine {
	if config == nil {
		config = DefaultArenaConfig()
	}
	return &ArenaEngine{
		Config:          config,
		aiClient:        aiClient,
		bullMemory:      NewFinancialMemory("bull_memory"),
		bearMemory:      NewFinancialMemory("bear_memory"),
		traderMemory:    NewFinancialMemory("trader_memory"),
		judgeMemory:     NewFinancialMemory("invest_judge_memory"),
		portfolioMemory: NewFinancialMemory("portfolio_manager_memory"),
	}
}

// RunFullDebate 完整辩论流程（6 个阶段）
// 1:1 对应 Python TradingAgentsGraph.propagate()
//
// accountInfo 包含 total equity / available balance / unrealized PnL / margin used pct,
// 全部塞进 state 供 Trader / PortfolioManager 的 FormatAccountContext 使用。
func (e *ArenaEngine) RunFullDebate(
	symbol string,
	marketData *market.Data,
	signals *kernel.MarketSignals,
	events []kernel.EventSignal,
	accountInfo AccountInfo,
	positions []PositionSnapshot,
	riskConfig RiskConfigSnapshot,
	exchangeType string,
) (*ArenaSignal, error) {
	start := time.Now()
	defer func() {
		e.LastRunTime = time.Since(start)
		e.TotalRuns++
	}()

	// 规范化 symbol（处理 BTC / btcusdt / BTC_USDT 等 LLM 或外部传入的各种格式）
	// 规范化后 state.Symbol 是 "BTCUSDT" 标准格式，tool_executor 里的 normalizeSymbolArgs
	// 会把 LLM 传入的参数也规范化后与这个标准对比
	symbol = market.Normalize(symbol)

	// 初始化状态
	state := buildInitialState(symbol, time.Now().UTC().Format("2006-01-02 15:04"))
	state.AccountBalance = accountInfo.TotalEquity
	state.AvailableMargin = accountInfo.AvailableBalance
	state.WalletBalance = accountInfo.WalletBalance
	state.TotalUnrealizedPnL = accountInfo.TotalUnrealizedProfit
	state.MarginUsedPct = accountInfo.MarginUsedPct
	state.CurrentPositions = positions
	state.RiskConfig = riskConfig
	state.ExchangeType = exchangeType

	// ─── Phase 1: 分析师阶段 ────────────────────────────────────────
	log.Printf("[Arena] Phase 1: Analysts for %s", symbol)
	for _, analyst := range e.Config.SelectedAnalysts {
		var err error
		switch analyst {
		case AnalystMarket:
			log.Printf("[Arena]   → Running Market Analyst")
			err = RunMarketAnalyst(e.aiClient, state, marketData, signals, events, e.Config)
			if err == nil {
				log.Printf("[Arena]     Market report: %d chars", len(state.MarketReport))
			}
		case AnalystSocial:
			log.Printf("[Arena]   → Running Social Analyst")
			err = RunSocialAnalyst(e.aiClient, state, marketData, signals, events, e.Config)
			if err == nil {
				log.Printf("[Arena]     Sentiment report: %d chars", len(state.SentimentReport))
			}
		case AnalystNews:
			log.Printf("[Arena]   → Running News Analyst")
			err = RunNewsAnalyst(e.aiClient, state, marketData, signals, events, e.Config)
			if err == nil {
				log.Printf("[Arena]     News report: %d chars", len(state.NewsReport))
			}
		case AnalystFundamentals:
			log.Printf("[Arena]   → Running Fundamentals Analyst")
			err = RunFundamentalsAnalyst(e.aiClient, state, marketData, signals, events, e.Config)
			if err == nil {
				log.Printf("[Arena]     Fundamentals report: %d chars", len(state.FundamentalsReport))
			}
		default:
			log.Printf("[Arena]   ⚠ Unknown analyst type: %s, skipping", analyst)
			continue
		}
		if err != nil {
			log.Printf("[Arena]   ✗ %s analyst failed: %v", analyst, err)
			// 分析师失败不中断流程，继续下一个
		}
	}

	// ─── Phase 2: 研究辩论（Bull vs Bear） ─────────────────────────────
	log.Printf("[Arena] Phase 2: Investment Debate (%d rounds)", e.Config.MaxDebateRounds)
	for round := 0; round < e.Config.MaxDebateRounds; round++ {
		log.Printf("[Arena]   Round %d/%d", round+1, e.Config.MaxDebateRounds)

		if err := RunBullResearcher(e.aiClient, state, e.bullMemory, e.Config); err != nil {
			log.Printf("[Arena]   ✗ Bull researcher failed: %v", err)
		}
		if err := RunBearResearcher(e.aiClient, state, e.bearMemory, e.Config); err != nil {
			log.Printf("[Arena]   ✗ Bear researcher failed: %v", err)
		}
	}

	// 研究管理器裁决
	log.Printf("[Arena]   → Research Manager judging")
	if err := RunResearchManager(e.aiClient, state, e.judgeMemory, e.Config); err != nil {
		log.Printf("[Arena]   ✗ Research manager failed: %v", err)
	}

	// ─── Phase 3: 交易计划 ──────────────────────────────────────────
	log.Printf("[Arena] Phase 3: Trader")
	if err := RunTrader(e.aiClient, state, e.traderMemory, e.Config); err != nil {
		log.Printf("[Arena]   ✗ Trader failed: %v", err)
	}

	// ─── Phase 4: 风控辩论（Aggressive vs Conservative vs Neutral） ───
	log.Printf("[Arena] Phase 4: Risk Debate (%d rounds)", e.Config.MaxRiskRounds)
	for round := 0; round < e.Config.MaxRiskRounds; round++ {
		log.Printf("[Arena]   Round %d/%d", round+1, e.Config.MaxRiskRounds)

		if err := RunAggressiveDebater(e.aiClient, state, e.Config); err != nil {
			log.Printf("[Arena]   ✗ Aggressive debater failed: %v", err)
		}
		if err := RunConservativeDebater(e.aiClient, state, e.Config); err != nil {
			log.Printf("[Arena]   ✗ Conservative debater failed: %v", err)
		}
		if err := RunNeutralDebater(e.aiClient, state, e.Config); err != nil {
			log.Printf("[Arena]   ✗ Neutral debater failed: %v", err)
		}
	}

	// 投资组合管理器最终决策
	log.Printf("[Arena]   → Portfolio Manager final decision")
	if err := RunPortfolioManager(e.aiClient, state, e.portfolioMemory, e.Config); err != nil {
		log.Printf("[Arena]   ✗ Portfolio manager failed: %v", err)
	}

	// ─── Phase 5: 信号提取 ──────────────────────────────────────────
	log.Printf("[Arena] Phase 5: Signal Extraction")
	signal, extracted, err := ExtractSignal(e.aiClient, state.FinalDecision, state)
	if err != nil {
		log.Printf("[Arena]   ⚠ Signal extraction error (defaulting to HOLD): %v", err)
	}
	state.Signal = signal
	// 优先使用 LLM 自报 confidence；为 0 时 fallback 到旧映射
	if extracted.Confidence > 0 {
		state.Confidence = extracted.Confidence
	} else {
		state.Confidence = signalToConfidence(signal)
	}
	log.Printf("[Arena]   Signal: %s (confidence: %d, source: %s)",
		signal, state.Confidence,
		map[bool]string{true: "llm-self-report", false: "code-fallback"}[extracted.Confidence > 0])

	// ─── Phase 6: 反思 + 记忆存储 ──────────────────────────────────
	log.Printf("[Arena] Phase 6: Store Reflections")
	e.storeReflections(state)

	// 解析交易细节：优先用 LLM JSON 自报值，缺失字段 fallback 到正则解析
	entryPrice, stopLoss, takeProfit, leverage := parseTradingDetails(state.FinalDecision)
	if extracted.EntryPrice > 0 {
		entryPrice = extracted.EntryPrice
	}
	if extracted.StopLoss > 0 {
		stopLoss = extracted.StopLoss
	}
	if extracted.TakeProfit > 0 {
		takeProfit = extracted.TakeProfit
	}
	if extracted.Leverage > 0 {
		leverage = extracted.Leverage
	}
	var rrr float64
	if entryPrice > 0 && stopLoss > 0 && takeProfit > 0 {
		slDist := entryPrice - stopLoss
		if slDist < 0 {
			slDist = -slDist
		}
		tpDist := takeProfit - entryPrice
		if tpDist < 0 {
			tpDist = -tpDist
		}
		if slDist > 0 {
			rrr = tpDist / slDist
		}
	}

	// 构建输出
	result := &ArenaSignal{
		Symbol:            symbol,
		Signal:            signal,
		Confidence:        state.Confidence,
		BullArgument:      state.InvestDebate.BullHistory,
		BearArgument:      state.InvestDebate.BearHistory,
		RiskDebateSummary: state.RiskDebate.History,
		PortfolioDecision: state.FinalDecision,
		Timestamp:         time.Now().UTC(),

		EntryPrice:      entryPrice,
		StopLoss:        stopLoss,
		TakeProfit:      takeProfit,
		Leverage:        leverage,
		RiskRewardRatio: rrr,

		MarketReport:       state.MarketReport,
		SentimentReport:    state.SentimentReport,
		NewsReport:         state.NewsReport,
		FundamentalsReport: state.FundamentalsReport,
		TraderPlan:         state.TraderPlan,

		SystemPrompt:     state.SystemPrompt,
		UserPrompt:       state.UserPrompt,
		CoTTrace:         state.CoTTrace,
		AICallDurationMs: state.AICallDurationMs,
	}

	log.Printf("[Arena] Complete: %s → %s (%.1fs, %d LLM calls total)",
		symbol, signal, e.LastRunTime.Seconds(), countLLMCalls(e.Config))

	return result, nil
}

// ReflectWithReturns 在获得实际收益后执行反思（对应 Python reflect_and_remember）
// returnsLosses 是实际盈亏结果描述
func (e *ArenaEngine) ReflectWithReturns(state *ArenaState, returnsLosses string) error {
	situation := extractSituation(state)

	reflectionPrompt := `You are an expert financial analyst tasked with reviewing trading decisions/analysis and providing a comprehensive analysis.
Your goal is to deliver detailed insights into investment decisions and highlight opportunities for improvement:

1. Reasoning: For each trading decision, determine whether it was correct or incorrect. Analyze contributing factors.
2. Improvement: For incorrect decisions, propose revisions to maximize returns.
3. Summary: Summarize lessons learned and how they can be adapted for future scenarios.
4. Query: Extract key insights into a concise sentence of no more than 1000 tokens.`

	// 反思 5 个组件（bull / bear / trader / judge / portfolio）
	components := []struct {
		name   string
		report string
		memory *FinancialMemory
	}{
		{"bull", state.InvestDebate.BullHistory, e.bullMemory},
		{"bear", state.InvestDebate.BearHistory, e.bearMemory},
		{"trader", state.TraderPlan, e.traderMemory},
		{"judge", state.InvestDebate.JudgeDecision, e.judgeMemory},
		{"portfolio", state.FinalDecision, e.portfolioMemory},
	}

	for _, comp := range components {
		userPrompt := fmt.Sprintf("Returns: %s\n\nAnalysis/Decision: %s\n\nObjective Market Reports for Reference: %s",
			returnsLosses, comp.report, situation)

		reflection, err := e.aiClient.CallWithMessages(reflectionPrompt, userPrompt)
		if err != nil {
			log.Printf("[Arena] Reflection failed for %s: %v", comp.name, err)
			continue
		}
		comp.memory.AddSituation(situation, reflection)
	}

	return nil
}

// storeReflections 将本轮辩论结果存入 5 个记忆（无收益数据时的简单存储）
// 对应 Python 的反思但不需要 LLM — 直接存储原始辩论内容供下次 BM25 检索
func (e *ArenaEngine) storeReflections(state *ArenaState) {
	situation := extractSituation(state)

	// 存储各角色的辩论历史（供下次 BM25 检索相似情境）
	if state.InvestDebate.BullHistory != "" {
		e.bullMemory.AddSituation(situation, state.InvestDebate.BullHistory)
	}
	if state.InvestDebate.BearHistory != "" {
		e.bearMemory.AddSituation(situation, state.InvestDebate.BearHistory)
	}
	if state.TraderPlan != "" {
		e.traderMemory.AddSituation(situation, state.TraderPlan)
	}
	if state.InvestDebate.JudgeDecision != "" {
		e.judgeMemory.AddSituation(situation, state.InvestDebate.JudgeDecision)
	}
	if state.FinalDecision != "" {
		e.portfolioMemory.AddSituation(situation, state.FinalDecision)
	}
}

// GetState 返回引擎内部的记忆统计
func (e *ArenaEngine) GetMemoryStats() map[string]int {
	return map[string]int{
		"bull":      e.bullMemory.Count(),
		"bear":      e.bearMemory.Count(),
		"trader":    e.traderMemory.Count(),
		"judge":     e.judgeMemory.Count(),
		"portfolio": e.portfolioMemory.Count(),
	}
}

// ---------------------------------------------------------------------------
// 内部辅助函数
// ---------------------------------------------------------------------------

// buildInitialState 构建初始辩论状态
// 对应 Python Propagator.create_initial_state()
func buildInitialState(symbol, tradeDate string) *ArenaState {
	return &ArenaState{
		Symbol:    symbol,
		TradeDate: tradeDate,
	}
}

// extractSituation 拼接 4 份报告为情境描述（用于记忆存储/检索）
func extractSituation(state *ArenaState) string {
	parts := []string{
		state.MarketReport,
		state.SentimentReport,
		state.NewsReport,
		state.FundamentalsReport,
	}
	return strings.Join(parts, "\n\n")
}

// signalToConfidence 将信号映射为置信度
func signalToConfidence(signal string) int {
	switch signal {
	case SignalBuy:
		return 85
	case SignalOverweight:
		return 70
	case SignalHold:
		return 50
	case SignalUnderweight:
		return 30
	case SignalSell:
		return 15
	default:
		return 50
	}
}

// countLLMCalls 估算本轮 LLM 调用次数
func countLLMCalls(config *ArenaConfig) int {
	// 分析师（每个 1 次）+ 研究辩论（每轮 2 次 + 1 管理器）+ 交易员 + 风控辩论（每轮 3 次 + 1 管理器）+ 信号提取
	analysts := len(config.SelectedAnalysts)
	debateRounds := config.MaxDebateRounds
	riskRounds := config.MaxRiskRounds
	return analysts + debateRounds*2 + 1 + 1 + riskRounds*3 + 1 + 1
}
