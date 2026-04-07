package arena

import (
	"fmt"
	"log"
	"nofx/kernel"
	"nofx/market"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// ArenaRunner 策略循环 — 定时执行辩论 + 信号→下单映射
// 对应 nofx 的 AutoTrader.Run() / runCycle() 模式
// ---------------------------------------------------------------------------

// TraderInterface 交易执行接口（在 arena 包内定义，由 trader 包实现，避免循环依赖）
//
// 关键语义约定：
//   OpenLong/OpenShort 的 quantity 参数 = **合约数量**（如 0.01 BTC），不是 USD notional
//   runner 调用前必须用当前价做 USD → 数量的换算
type TraderInterface interface {
	OpenLong(symbol string, quantity float64) error
	OpenShort(symbol string, quantity float64) error
	CloseLong(symbol string, quantity float64) error
	CloseShort(symbol string, quantity float64) error
	// GetAccountInfo 返回完整账户状态（推荐使用）
	// 如果底层交易所不区分 total/available，两者相等
	GetAccountInfo() (AccountInfo, error)
	GetPositions() ([]PositionInfo, error)
	SetLeverage(symbol string, leverage int) error
	// SetStopLoss / SetTakeProfit 提交独立的条件单到交易所
	// positionSide: "LONG" 或 "SHORT"（对应开仓方向）
	// 失败仅返回 error，调用方 log warning 不回滚开仓（与 AutoTrader 行为一致）
	SetStopLoss(symbol string, positionSide string, quantity, stopPrice float64) error
	SetTakeProfit(symbol string, positionSide string, quantity, takeProfitPrice float64) error
	// GetExchangeType 返回交易所类型（binance/okx/bybit/...）
	GetExchangeType() string
}

// AccountInfo 账户快照（交易所返回的真实完整数据）
type AccountInfo struct {
	TotalEquity           float64 `json:"total_equity"`            // 账户净值 = 钱包余额 + 未实现 PnL
	WalletBalance         float64 `json:"wallet_balance"`          // 钱包余额（未含未实现 PnL）
	AvailableBalance      float64 `json:"available_balance"`       // 可用保证金（开新仓用）
	TotalUnrealizedProfit float64 `json:"total_unrealized_profit"` // 总未实现 PnL
	MarginUsedPct         float64 `json:"margin_used_pct"`         // 保证金使用率 0-1
}

// PositionInfo 持仓信息
// 字段与 Binance/OKX/Bybit GetPositions 返回格式对齐（runner 只读字段，不依赖 map key）
type PositionInfo struct {
	Symbol        string  `json:"symbol"`
	Side          string  `json:"side"` // "long" | "short"
	Quantity      float64 `json:"quantity"`
	EntryPrice    float64 `json:"entry_price"`
	MarkPrice     float64 `json:"mark_price"`
	UnrealizedPnL float64 `json:"unrealized_pnl"`
	Leverage      int     `json:"leverage"`
	MarginUsed    float64 `json:"margin_used"` // = quantity * entryPrice / leverage
}

// DataProvider 市场数据获取接口（由外部注入，避免 arena 直接依赖 market.Get）
type DataProvider interface {
	GetMarketData(symbol string) (*market.Data, error)
	GetMarketSignals() (*kernel.MarketSignals, error)
	GetActiveEvents() ([]kernel.EventSignal, error)
}

// GatekeeperFunc 风控检查函数类型（可选注入）
type GatekeeperFunc func(symbol, action string, confidence int) (bool, string)

// TradeStatsProvider 历史交易统计数据源（由 trader 包实现，避免循环依赖）
// 返回的字符串将作为 Trader 角色 user prompt 的 {trade_stats} 段
type TradeStatsProvider interface {
	GetTradeStats(traderID string) string
}

// ArenaRunner 策略循环管理器
type ArenaRunner struct {
	engine       *ArenaEngine
	trader       TraderInterface
	dataProvider DataProvider
	gatekeeper   GatekeeperFunc  // 可选，nil 时跳过风控
	recordStore  ArenaRecordSaver // 可选，nil 时不持久化
	statsProvider TradeStatsProvider // 可选，nil 时 trade_stats 段为空

	// traderID 用于持久化记录（由外部传入）
	traderID string

	// 运行状态（mu 同时保护 isRunning 和 lastSignals）
	isRunning bool
	stopCh    chan struct{}

	// 最新信号缓存（供看板读取）
	mu          sync.RWMutex
	lastSignals map[string]*ArenaSignal

	// 并发保护：正在运行中的 symbol（防止同一 symbol 被并发触发辩论）
	// 由 activeMu 独立保护，不与 mu 共用，避免 RunOneRound 持有 mu 期间阻塞
	// 看板读取 lastSignals
	activeMu     sync.Mutex
	activeRounds map[string]bool

	// 周期计数（每次 RunOneRound 自增，用于 ArenaDecisionRecordData.CycleNumber）
	cycleMu    sync.Mutex
	cycleCount int64
}

// NewArenaRunner 创建 Runner
// recordStore 可为 nil（不持久化）；traderID 用于记录关联。
func NewArenaRunner(
	engine *ArenaEngine,
	trader TraderInterface,
	dataProvider DataProvider,
	gatekeeper GatekeeperFunc,
	recordStore ArenaRecordSaver,
	traderID string,
) *ArenaRunner {
	return &ArenaRunner{
		engine:       engine,
		trader:       trader,
		dataProvider: dataProvider,
		gatekeeper:   gatekeeper,
		recordStore:  recordStore,
		traderID:     traderID,
		lastSignals:  make(map[string]*ArenaSignal),
		activeRounds: make(map[string]bool),
	}
}

// SetTradeStatsProvider 注入历史交易统计数据源（可选，需在 Start 前调用）
func (r *ArenaRunner) SetTradeStatsProvider(p TradeStatsProvider) {
	r.statsProvider = p
}

// Start 启动策略循环（异步）
func (r *ArenaRunner) Start(symbols []string) error {
	r.mu.Lock()
	if r.isRunning {
		r.mu.Unlock()
		return fmt.Errorf("arena runner already running")
	}
	r.isRunning = true
	r.stopCh = make(chan struct{})
	r.mu.Unlock()

	interval := time.Duration(r.engine.Config.IntervalMinutes) * time.Minute
	if interval < time.Minute {
		interval = 30 * time.Minute
	}

	log.Printf("[ArenaRunner] Starting: %d symbols, interval=%v", len(symbols), interval)

	go func() {
		// 首轮立即执行
		r.runAllSymbols(symbols)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-r.stopCh:
				log.Printf("[ArenaRunner] Stopped")
				return
			case <-ticker.C:
				r.runAllSymbols(symbols)
			}
		}
	}()

	return nil
}

// Stop 停止策略循环
func (r *ArenaRunner) Stop() {
	r.mu.Lock()
	if !r.isRunning {
		r.mu.Unlock()
		return
	}
	r.isRunning = false
	ch := r.stopCh
	r.mu.Unlock()

	// close 在锁外调用，避免持锁期间阻塞
	close(ch)
	log.Printf("[ArenaRunner] Stop signal sent")
}

// IsRunning 返回运行状态
func (r *ArenaRunner) IsRunning() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.isRunning
}

// RunOneRound 执行单个 symbol 的完整流程（可手动调用）
//
// 并发保护：同一 symbol 不能同时运行多个辩论周期。
// 触发源可能有 3 个：
//   1) Start() 首轮自动执行
//   2) Start() 里的 ticker 定时触发
//   3) API /arena/run/:traderID 手动触发（前端按钮）
// 任何一个路径都会走这里，所以并发 guard 放在这里是唯一的"防火墙"。
//
// 规范化 symbol 后检查 activeRounds，已在运行则直接 skip，不报错（避免前端误以为失败）。
func (r *ArenaRunner) RunOneRound(symbol string) error {
	startTime := time.Now()

	// 规范化 symbol 后再检查 active 状态，避免 "BTC" 和 "BTCUSDT" 两次触发绕过 guard
	normSym := market.Normalize(symbol)

	r.activeMu.Lock()
	if r.activeRounds[normSym] {
		r.activeMu.Unlock()
		log.Printf("[ArenaRunner] ⏭ %s round already in progress, skipping duplicate trigger", normSym)
		return nil
	}
	r.activeRounds[normSym] = true
	r.activeMu.Unlock()

	// 自增本轮周期号（仅在真正进入执行流程后递增）
	r.cycleMu.Lock()
	r.cycleCount++
	currentCycle := r.cycleCount
	r.cycleMu.Unlock()

	defer func() {
		r.activeMu.Lock()
		delete(r.activeRounds, normSym)
		r.activeMu.Unlock()
	}()

	log.Printf("[ArenaRunner] RunOneRound: %s", normSym)
	symbol = normSym // 下游用规范化后的值

	// 1. 获取市场数据
	// N4: 失败时 log warn 后跳过本轮，与 GetMarketSignals/GetActiveEvents 容错风格一致
	marketData, err := r.dataProvider.GetMarketData(symbol)
	if err != nil || marketData == nil {
		log.Printf("[ArenaRunner] ⚠ GetMarketData failed for %s: %v, skipping round", symbol, err)
		return nil
	}

	// 2. 获取信号
	signals, err := r.dataProvider.GetMarketSignals()
	if err != nil {
		log.Printf("[ArenaRunner] ⚠ GetMarketSignals failed: %v, using empty", err)
		signals = kernel.NewMarketSignals()
	}

	// 3. 获取事件
	events, err := r.dataProvider.GetActiveEvents()
	if err != nil {
		log.Printf("[ArenaRunner] ⚠ GetActiveEvents failed: %v, using empty", err)
		events = nil
	}

	// 4. 获取账户/持仓上下文
	var accountInfo AccountInfo
	var posSnapshots []PositionSnapshot
	exchangeType := ""
	if r.trader != nil {
		exchangeType = r.trader.GetExchangeType()
		if info, err := r.trader.GetAccountInfo(); err == nil {
			accountInfo = info
		} else {
			log.Printf("[ArenaRunner] ⚠ GetAccountInfo failed: %v", err)
		}
		if positions, err := r.trader.GetPositions(); err == nil {
			for _, p := range positions {
				posSnapshots = append(posSnapshots, PositionSnapshot{
					Symbol:        p.Symbol,
					Side:          p.Side,
					Quantity:      p.Quantity,
					EntryPrice:    p.EntryPrice,
					MarkPrice:     p.MarkPrice,
					UnrealizedPnL: p.UnrealizedPnL,
					Leverage:      p.Leverage,
					MarginUsed:    p.MarginUsed,
				})
			}
		} else {
			log.Printf("[ArenaRunner] ⚠ GetPositions failed: %v", err)
		}
	}

	// 从 ArenaConfig 读取全部风控约束（替代之前硬编码的 MaxPositions: 5）
	riskConfig := RiskConfigSnapshot{
		MaxLeverage:       r.engine.Config.MaxLeverage,
		MaxPositions:      r.engine.Config.MaxPositions,
		PositionSizeRatio: r.engine.Config.PositionSizeRatio,
		MaxMarginUsage:    r.engine.Config.MaxMarginUsage,
		MinRiskReward:     r.engine.Config.MinRiskReward,
		MinConfidence:     r.engine.Config.MinConfidence,
	}

	// 4b. 历史交易统计（注入到 Trader prompt）
	tradeStats := ""
	if r.statsProvider != nil {
		tradeStats = r.statsProvider.GetTradeStats(r.traderID)
	}

	// 5. 运行辩论（把完整账户信息塞进 state）
	arenaSignal, err := r.engine.RunFullDebate(symbol, marketData, signals, events,
		accountInfo, posSnapshots, riskConfig, exchangeType, tradeStats)
	if err != nil {
		return fmt.Errorf("arena debate for %s: %w", symbol, err)
	}

	// 6. 缓存信号
	r.mu.Lock()
	r.lastSignals[symbol] = arenaSignal
	r.mu.Unlock()

	// 7. 信号→决策映射 + 执行（把 marketData 传入,用于 USD→数量换算）
	executed, blockReason, executeErr := r.executeSignal(symbol, arenaSignal, marketData)
	if executeErr != nil {
		log.Printf("[ArenaRunner] ✗ Execute signal for %s: %v", symbol, executeErr)
	}

	// 8. N1: 持久化决策记录（失败仅 log，不返回 error）
	debateDurationMs := time.Since(startTime).Milliseconds()
	r.saveRecord(symbol, arenaSignal, executed, blockReason, executeErr, debateDurationMs, currentCycle)

	return executeErr
}

// saveRecord 将本轮辩论结果保存到数据库（失败仅 log，不中断主流程）
//
// executed: 调用方显式告知是否真正下到交易所（gatekeeper 拦截/qty=0/hold 均为 false）
// blockReason: 被 gatekeeper 或前置检查拦截时的原因，executed=false 时非空
// executeErr: 下单 API 返回的错误（非 blocked 情况）
func (r *ArenaRunner) saveRecord(symbol string, sig *ArenaSignal, executed bool, blockReason string, executeErr error, durationMs int64, cycleNumber int64) {
	if r.recordStore == nil || sig == nil {
		return
	}

	// Bookkeeping fix: 以调用方显式传入的 executed 为准，而不是从 err==nil 反推。
	// 旧逻辑 `executeErr == nil && sig.Signal != SignalHold` 会把 gatekeeper
	// 拦截（返回 nil）错误地标记为 ActionExecuted=true，导致审计上看到 conf=15
	// 的 open_short "被执行" 的假象。
	actionExecuted := executed
	rejectReason := blockReason
	if rejectReason == "" && executeErr != nil {
		rejectReason = executeErr.Error()
	}

	// 从缓存信号反推 action（与 mapSignalToAction 逻辑一致，此处简化不重查持仓）
	action := "hold"
	switch sig.Signal {
	case SignalBuy, SignalOverweight:
		action = "open_long"
	case SignalSell, SignalUnderweight:
		action = "open_short"
	}

	errMsg := ""
	if executeErr != nil {
		errMsg = executeErr.Error()
	}

	record := &ArenaDecisionRecordData{
		TraderID:           r.traderID,
		Symbol:             symbol,
		Signal:             sig.Signal,
		Confidence:         sig.Confidence,
		Action:             action,
		ActionExecuted:     actionExecuted,
		RejectReason:       rejectReason,
		MarketReport:       sig.MarketReport,
		SentimentReport:    sig.SentimentReport,
		NewsReport:         sig.NewsReport,
		FundamentalsReport: sig.FundamentalsReport,
		BullArgument:       sig.BullArgument,
		BearArgument:       sig.BearArgument,
		TraderPlan:         sig.TraderPlan,
		RiskDebate:         sig.RiskDebateSummary,
		FinalDecision:      sig.PortfolioDecision,
		EntryPrice:         sig.EntryPrice,
		StopLoss:           sig.StopLoss,
		TakeProfit:         sig.TakeProfit,
		Quantity:           sig.Quantity,
		PositionSizeUSD:    sig.PositionSizeUSD,
		Leverage:           sig.Leverage,
		RiskRewardRatio:    sig.RiskRewardRatio,
		SystemPrompt:       sig.SystemPrompt,
		UserPrompt:         sig.UserPrompt,
		CoTTrace:           sig.CoTTrace,
		AICallDurationMs:   sig.AICallDurationMs,
		ErrorMessage:       errMsg,
		DebateDurationMs:   durationMs,
		CycleNumber:        cycleNumber,
	}

	if err := r.recordStore.SaveRecord(record); err != nil {
		log.Printf("[ArenaRunner] ⚠ SaveRecord failed for %s: %v", symbol, err)
	}
}

// GetLastSignal 获取某个 symbol 的最新信号（供 API/看板）
func (r *ArenaRunner) GetLastSignal(symbol string) *ArenaSignal {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.lastSignals[symbol]
}

// GetAllSignals 获取所有 symbol 的最新信号
func (r *ArenaRunner) GetAllSignals() map[string]*ArenaSignal {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make(map[string]*ArenaSignal, len(r.lastSignals))
	for k, v := range r.lastSignals {
		result[k] = v
	}
	return result
}

// ---------------------------------------------------------------------------
// 内部方法
// ---------------------------------------------------------------------------

// runAllSymbols 遍历所有 symbol 执行
func (r *ArenaRunner) runAllSymbols(symbols []string) {
	for _, symbol := range symbols {
		if err := r.RunOneRound(symbol); err != nil {
			log.Printf("[ArenaRunner] ✗ %s round failed: %v", symbol, err)
		}
	}
}

// executeSignal 将 ArenaSignal 映射为实际交易操作
//
// 返回值:
//   - executed: 是否真正下到交易所(gatekeeper 拦截/qty=0/hold/no-trader 均为 false)
//   - blockReason: 未执行时的显式原因(便于审计区分"拦截" vs "API 错误")
//   - err: 下单 API 返回的错误
func (r *ArenaRunner) executeSignal(symbol string, signal *ArenaSignal, marketData *market.Data) (executed bool, blockReason string, err error) {
	if r.trader == nil {
		log.Printf("[ArenaRunner] No trader attached, signal only: %s → %s", symbol, signal.Signal)
		return false, "no trader attached", nil
	}

	// 查询当前持仓
	positions, posErr := r.trader.GetPositions()
	if posErr != nil {
		return false, "", fmt.Errorf("get positions: %w", posErr)
	}

	currentPos := findPosition(positions, symbol)
	action := mapSignalToAction(signal.Signal, currentPos)

	if action == "hold" {
		log.Printf("[ArenaRunner] %s: HOLD (no action)", symbol)
		return false, "signal resolved to hold", nil
	}

	// Gatekeeper 风控检查
	if r.gatekeeper != nil {
		allowed, reason := r.gatekeeper(symbol, action, signal.Confidence)
		if !allowed {
			log.Printf("[ArenaRunner] %s: Gatekeeper BLOCKED %s — %s", symbol, action, reason)
			return false, reason, nil
		}
	}

	// ── 开仓校验守卫：open_long/open_short 必须带 entry/stop/tp ──
	if action == "open_long" || action == "open_short" {
		if signal.EntryPrice <= 0 {
			reason := "arena validator: open action with entry_price=0"
			log.Printf("[ArenaRunner] %s: %s BLOCKED — %s", symbol, action, reason)
			return false, reason, nil
		}
		if signal.StopLoss <= 0 || signal.TakeProfit <= 0 {
			reason := "arena validator: open action missing stop_loss or take_profit"
			log.Printf("[ArenaRunner] %s: %s BLOCKED — %s", symbol, action, reason)
			return false, reason, nil
		}
	}

	// ── Leverage 决策优先级：LLM signal → config → 硬兜底 ──
	// 优先用 LLM 自报的 leverage；超过配置上限则 cap；LLM 未给或无效则回退到 config；
	// config 也 <=0 时硬 fallback 到 3，避免把 0 传给 SetLeverage 触发 Binance -4028。
	cfgMax := r.engine.Config.MaxLeverage
	lev := signal.Leverage
	if lev <= 0 {
		lev = cfgMax
	}
	if cfgMax > 0 && lev > cfgMax {
		log.Printf("[ArenaRunner] %s: LLM leverage %d exceeds config max %d, capping",
			symbol, signal.Leverage, cfgMax)
		lev = cfgMax
	}
	if lev <= 0 {
		log.Printf("[ArenaRunner] %s: WARN both signal(%d) and config(%d) leverage invalid, using default 3",
			symbol, signal.Leverage, cfgMax)
		lev = 3
	}
	// 回写实际使用的 leverage，便于 saveRecord 审计
	signal.Leverage = lev

	// 设置杠杆
	if err := r.trader.SetLeverage(symbol, lev); err != nil {
		log.Printf("[ArenaRunner] ⚠ SetLeverage(%s, %d) failed: %v", symbol, lev, err)
	}

	// 计算数量 — 必须把 USD notional 换算为合约数量
	qty := r.calculateQuantity(symbol, signal, marketData)
	if qty <= 0 {
		log.Printf("[ArenaRunner] %s: qty=0, skipping (price data missing or signal too weak)", symbol)
		return false, "qty=0 after sizing", nil
	}

	// 执行
	log.Printf("[ArenaRunner] %s: %s qty=%.6f (signal=%s, confidence=%d)",
		symbol, action, qty, signal.Signal, signal.Confidence)

	var apiErr error
	switch action {
	case "open_long":
		apiErr = r.trader.OpenLong(symbol, qty)
	case "open_short":
		apiErr = r.trader.OpenShort(symbol, qty)
	case "close_long":
		apiErr = r.trader.CloseLong(symbol, currentPos.Quantity)
	case "close_short":
		apiErr = r.trader.CloseShort(symbol, currentPos.Quantity)
	default:
		return false, "unsupported action: " + action, nil
	}
	if apiErr != nil {
		return false, "", apiErr
	}

	// 提交 SL/TP 条件单（仅对开仓动作；失败 warning，不回滚开仓 — 与 AutoTrader 一致）
	if action == "open_long" || action == "open_short" {
		posSide := "LONG"
		if action == "open_short" {
			posSide = "SHORT"
		}
		if signal.StopLoss > 0 {
			if slErr := r.trader.SetStopLoss(symbol, posSide, qty, signal.StopLoss); slErr != nil {
				log.Printf("[ArenaRunner] ⚠ SetStopLoss failed for %s (%s): %v", symbol, posSide, slErr)
			}
		}
		if signal.TakeProfit > 0 {
			if tpErr := r.trader.SetTakeProfit(symbol, posSide, qty, signal.TakeProfit); tpErr != nil {
				log.Printf("[ArenaRunner] ⚠ SetTakeProfit failed for %s (%s): %v", symbol, posSide, tpErr)
			}
		}
	}

	return true, "", nil
}

// mapSignalToAction 将信号 + 当前持仓映射为操作。
//
// 设计原则：单周期只做一件事（原子性）。
// 当需要反向切换时（如从多头切换到空头），本周期只执行平仓，
// 下一周期再由新信号触发开仓。这避免了单周期内连续两次下单带来的：
//   - 滑点叠加（平仓成交价 ≠ 开仓入场价）
//   - 风控误判（短时间内资金异动）
//   - 部分失败时状态不一致（平仓成功但开仓失败，净敞口错误）
//
// 延迟代价：最多额外等一个 interval（通常 30 分钟），
// 换取更安全、可审计的执行路径。
func mapSignalToAction(signal string, pos *PositionInfo) string {
	hasLong := pos != nil && pos.Side == "long" && pos.Quantity > 0
	hasShort := pos != nil && pos.Side == "short" && pos.Quantity > 0

	switch signal {
	case SignalBuy, SignalOverweight:
		if hasLong {
			return "hold" // 已持多，不重复开仓
		}
		if hasShort {
			// 反向切换：本周期先平空，下一周期再开多 (close first, open next round)
			log.Printf("[mapSignalToAction] BUY signal with existing short → close_short first, open_long next round")
			return "close_short"
		}
		return "open_long"

	case SignalSell, SignalUnderweight:
		if hasShort {
			return "hold" // 已持空，不重复开仓
		}
		if hasLong {
			// 反向切换：本周期先平多，下一周期再开空 (close first, open next round)
			log.Printf("[mapSignalToAction] SELL signal with existing long → close_long first, open_short next round")
			return "close_long"
		}
		return "open_short"

	case SignalHold:
		return "hold"

	default:
		return "hold"
	}
}

// findPosition 查找某 symbol 的持仓
func findPosition(positions []PositionInfo, symbol string) *PositionInfo {
	for i := range positions {
		if positions[i].Symbol == symbol && positions[i].Quantity > 0 {
			return &positions[i]
		}
	}
	return nil
}

// calculateQuantity 计算实际下单数量（合约数量,不是 USD notional）
//
// 流程:
//   1. 从 ArenaConfig.PositionSizeUSD 取基础 USD 金额
//   2. 按置信度调整(50%-100% 的基础金额)
//   3. 用当前价格换算为合约数量: qty = adjustedUSD / price
//   4. 如果 signal.PositionSizeUSD 已经由 AI 指定,优先使用它
//
// 价格来源优先级:
//   1. signal.EntryPrice  — AI 从 final_decision 解析出的建议入场价
//   2. marketData.CurrentPrice — 最近一次市场数据
//   3. 返回 0 → executeSignal 会跳过下单
func (r *ArenaRunner) calculateQuantity(symbol string, signal *ArenaSignal, marketData *market.Data) float64 {
	// 基础 USD 金额
	baseUSD := r.engine.Config.PositionSizeUSD
	if baseUSD <= 0 {
		baseUSD = 1000
	}

	// 按置信度调整: 信心 50% → 0.75x, 信心 85% → 0.925x, 信心 100% → 1.0x
	confidenceMultiplier := 0.5 + float64(signal.Confidence)/200.0
	if confidenceMultiplier > 1.0 {
		confidenceMultiplier = 1.0
	}
	adjustedUSD := baseUSD * confidenceMultiplier

	// 回写到 signal 供历史记录持久化（BUG-9）
	signal.PositionSizeUSD = adjustedUSD

	// 确定价格
	var price float64
	if signal.EntryPrice > 0 {
		price = signal.EntryPrice
	} else if marketData != nil && marketData.CurrentPrice > 0 {
		price = marketData.CurrentPrice
	}
	if price <= 0 {
		log.Printf("[ArenaRunner] calculateQuantity: no price available for %s (signal.EntryPrice=%.2f, marketData=%v) → skip",
			symbol, signal.EntryPrice, marketData != nil)
		return 0
	}

	// USD → 合约数量
	quantity := adjustedUSD / price
	log.Printf("[ArenaRunner] calculateQuantity: %s %.2f USD / $%.2f = %.6f contracts (confidence=%d)",
		symbol, adjustedUSD, price, quantity, signal.Confidence)
	return quantity
}
