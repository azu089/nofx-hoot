package trader

// auto_trader_hoot.go — HOOT integration helpers for the main trading loop.
//
// Contains all HOOT-specific logic injected into runCycle():
//   - Market regime detection
//   - Lifecycle management
//   - Position management (alpha decay + lifecycle)
//   - Gatekeeper filtering
//   - Event signal injection
//   - Adaptive threshold updates
// All functions are nil-safe: if a module is not initialized, they are no-ops.

import (
	"fmt"
	"nofx/kernel"
	"nofx/logger"
	"nofx/market"
	"nofx/store"
	"nofx/trader/audit"
	"os"
	"strings"
	"time"
)

// ─── Dependency Injection ───────────────────────────────────────────────────

// SetEventSignalsFunc injects the function that fetches active event signals.
// This avoids circular dependency between trader and intelligence packages.
func (at *AutoTrader) SetEventSignalsFunc(fn func() []kernel.EventSignal) {
	at.getEventSignals = fn
}

// ─── Action Classification ──────────────────────────────────────────────────

func isOpenAction(action string) bool {
	return action == "open_long" || action == "open_short"
}

// isCloseAction 判定是否为 close 系列 action（含部分平仓 reduce_*）
// 用于 OpenGate cooldown 标记 / institutional_pipeline 覆盖逻辑
func isCloseAction(action string) bool {
	switch action {
	case "close_long", "close_short", "reduce_long", "reduce_short":
		return true
	}
	return false
}

// isFullCloseAction 仅识别完全平仓（不含 reduce_*）
// lifecycle unregister 只能用 full close，
// reduce 是部分平仓，持仓仍在，不能注销 lifecycle
func isFullCloseAction(action string) bool {
	return action == "close_long" || action == "close_short"
}

// isScaleAction 判定是否为 scale 加仓 action
// safeMode 过滤需要拦截 scale 防止绕过
func isScaleAction(action string) bool {
	return action == "scale_long" || action == "scale_short"
}

// sideFromAction 从 action 名推出 "LONG" / "SHORT"
// 完整映射所有 action 包含 reduce/scale 系列
func sideFromAction(action string) string {
	switch action {
	case "open_short", "close_short", "reduce_short", "scale_short":
		return "SHORT"
	case "open_long", "close_long", "reduce_long", "scale_long":
		return "LONG"
	}
	return "LONG"
}

// ─── Market Regime Detection ────────────────────────────────────────────────

// injectMarketRegime runs DetectMarketRegime for each symbol and populates ctx.Signals.Regime.
func (at *AutoTrader) injectMarketRegime(ctx *kernel.Context) {
	if ctx.MarketDataMap == nil || len(ctx.MarketDataMap) == 0 {
		return
	}

	// Ensure Signals is initialized
	if ctx.Signals == nil {
		ctx.Signals = kernel.NewMarketSignals()
	}

	primaryTF := ""
	if at.strategyEngine != nil {
		cfg := at.strategyEngine.GetConfig()
		primaryTF = cfg.Indicators.Klines.PrimaryTimeframe
	}
	if primaryTF == "" {
		primaryTF = "1h"
	}

	for sym, md := range ctx.MarketDataMap {
		regime, _ := market.DetectMarketRegime(md, primaryTF)
		ctx.Signals.Regime[sym] = regime
	}
}

// detectPrimaryRegime determines the dominant market regime across all symbols.
func (at *AutoTrader) detectPrimaryRegime(ctx *kernel.Context) market.MarketRegime {
	if ctx.Signals == nil || len(ctx.Signals.Regime) == 0 {
		return market.RegimeRanging
	}

	votes := map[market.MarketRegime]int{}
	for _, regime := range ctx.Signals.Regime {
		votes[regime]++
	}

	best := market.RegimeRanging
	bestCount := 0
	for regime, count := range votes {
		if count > bestCount {
			bestCount = count
			best = regime
		}
	}
	return best
}

// ─── Event Signal Injection ─────────────────────────────────────────────────

// injectEventSignals populates ctx.EventSignals and ctx.EventRiskMode.
// Uses the getEventSignals function if set (injected to avoid circular deps).
//
// 高 severity (≥4) 事件通过 audit pipeline 推送结构化快照，
// 携带 category / scope / affected_symbols / direction 等元数据，
// 供下游 Sink（Telegram bot / Sentry / BullMQ worker）消费。
func (at *AutoTrader) injectEventSignals(ctx *kernel.Context) {
	if at.getEventSignals == nil {
		return
	}

	signals := at.getEventSignals()
	if len(signals) == 0 {
		ctx.EventRiskMode = "normal"
		return
	}

	ctx.EventSignals = signals
	ctx.EventRiskMode = kernel.DeriveEventRiskMode(signals, 4) // default severity threshold = 4
	if ctx.EventRiskMode != "normal" {
		logger.Infof("📰 [%s] Event risk mode: %s (%d active events)", at.name, ctx.EventRiskMode, len(signals))
	}

	// 推送高 severity 事件到 audit pipeline
	// 仅对 severity ≥ 3 的事件触发，避免 spam
	now := time.Now()
	for _, ev := range signals {
		if !ev.IsActive(now) || ev.Severity < 3 {
			continue
		}
		audit.Snapshot(at.id, at.strategyID, "event_signal_active", map[string]any{
			"event_id":         ev.ID,
			"category":         ev.Category,
			"severity":         ev.Severity,
			"direction":        ev.Direction,
			"scope":            ev.Scope,
			"affected_symbols": ev.AffectedSymbols,
			"confidence":       ev.Confidence,
			"source":           ev.SourceName,
			"summary":          ev.Summary,
			"risk_mode":        ctx.EventRiskMode,
		})
	}
}

// ─── Lifecycle Sync ─────────────────────────────────────────────────────────

// syncPositionLifecycles registers/unregisters positions with the global lifecycle manager.
func (at *AutoTrader) syncPositionLifecycles(ctx *kernel.Context) {
	primaryTF := "1h"
	if at.strategyEngine != nil {
		cfg := at.strategyEngine.GetConfig()
		if cfg.Indicators.Klines.PrimaryTimeframe != "" {
			primaryTF = cfg.Indicators.Klines.PrimaryTimeframe
		}
	}

	kernel.GlobalLifecycleManager().SyncPositions(at.id, ctx.Positions, primaryTF)

	// Advance each position's lifecycle with market signals
	if ctx.Signals != nil {
		for _, pos := range ctx.Positions {
			lc := kernel.GlobalLifecycleManager().Get(at.id, pos.Symbol, pos.Side)
			if lc == nil {
				continue
			}

			oiTrend := ctx.Signals.OITrend[pos.Symbol]

			// Determine HTF EMA alignment for this position
			htfAligned := false
			if ctx.MarketDataMap != nil {
				htf := kernel.HigherTimeframe(primaryTF)
				if md, ok := ctx.MarketDataMap[pos.Symbol]; ok && md != nil {
					if htfData, ok := md.TimeframeData[htf]; ok && htfData != nil {
						if len(htfData.EMA20Values) > 0 && len(htfData.EMA50Values) > 0 {
							ema20 := htfData.EMA20Values[len(htfData.EMA20Values)-1]
							ema50 := htfData.EMA50Values[len(htfData.EMA50Values)-1]
							if pos.Side == "long" {
								htfAligned = ema20 > ema50
							} else {
								htfAligned = ema50 > ema20
							}
						}
					}
				}
			}

			lc.Advance(oiTrend, htfAligned)
		}
	}
}

// ─── Position Management ────────────────────────────────────────────────────

// runPositionManagement runs the PositionManager on all open positions.
// Routes PM decisions by action type:
//
//	EXIT   → close_long/close_short — direct (emergency exit, must not be blocked)
//	REDUCE → close_long/close_short — direct (risk reduction, must not be blocked)
//	SCALE  → open_long/open_short   — routed through gateFilterDecisions (adds new risk)
//	HOLD   → not included
//
// Returns the combined set of direct + gated decisions to append to the AI decision list.
func (at *AutoTrader) runPositionManagement(ctx *kernel.Context) []kernel.Decision {
	if len(ctx.Positions) == 0 {
		return nil
	}

	primaryTF := "1h"
	if at.strategyEngine != nil {
		cfg := at.strategyEngine.GetConfig()
		if cfg.Indicators.Klines.PrimaryTimeframe != "" {
			primaryTF = cfg.Indicators.Klines.PrimaryTimeframe
		}
	}

	// Build empty Decision slice for signal extraction (PM uses neutral signal)
	var aiDecisions []kernel.Decision

	logger.Debugf("[%s] PM evaluating with mdMap size=%d", at.id, len(ctx.MarketDataMap))

	pmResult := kernel.RunPositionManager(
		at.id,
		ctx.Positions,
		aiDecisions, // empty — PM will use neutral signal
		ctx.Signals,
		ctx.MarketDataMap,
		primaryTF,
	)

	// Convert all PM decisions to kernel.Decision
	allPMDecisions := kernel.PositionDecisionToDecisions(pmResult, ctx.Positions)
	if len(allPMDecisions) == 0 {
		return nil
	}

	// ── Route by action type ─────────────────────────────────────────────────
	// EXIT / REDUCE map to close_* → bypass Gatekeeper (risk reduction / emergency)
	// SCALE        maps to open_*  → must pass Gatekeeper (introduces new risk)
	var directDecisions []kernel.Decision
	var scaleDecisions []kernel.Decision

	for _, d := range allPMDecisions {
		if isCloseAction(d.Action) {
			// EXIT or REDUCE — direct execution, no Gatekeeper
			logger.Infof("📊 [%s] PM action (direct): %s %s — %s", at.name, d.Action, d.Symbol, d.Reasoning)
			directDecisions = append(directDecisions, d)
		} else if isOpenAction(d.Action) {
			// SCALE — will be gated
			logger.Infof("📊 [%s] PM action (will gate): %s %s — %s", at.name, d.Action, d.Symbol, d.Reasoning)
			scaleDecisions = append(scaleDecisions, d)
		}
		// Unknown actions are silently dropped
	}

	// ── Gate SCALE decisions ─────────────────────────────────────────────────
	var gatedScale []kernel.Decision
	if len(scaleDecisions) > 0 {
		gatedScale = at.gateFilterDecisions(scaleDecisions, ctx)
		blocked := len(scaleDecisions) - len(gatedScale)
		if blocked > 0 {
			logger.Warnf("🚫 [%s] PM SCALE blocked by Gatekeeper: %d/%d passed",
				at.name, len(gatedScale), len(scaleDecisions))
		}
	}

	return append(directDecisions, gatedScale...)
}

// ─── Gatekeeper Filtering ───────────────────────────────────────────────────

// gateFilterDecisions runs the Gatekeeper on all decisions and filters out rejected ones.
// Safe to call even when ctx.Signals is nil — a zero-value MarketSignals is used as fallback.
func (at *AutoTrader) gateFilterDecisions(decisions []kernel.Decision, ctx *kernel.Context) []kernel.Decision {
	if len(decisions) == 0 {
		return decisions
	}
	if ctx == nil {
		return decisions
	}
	if at.strategyEngine == nil {
		return decisions
	}

	// Ensure Signals is non-nil so GateAll can safely dereference it.
	// This handles the case where injectMarketRegime was skipped (e.g. empty MarketDataMap).
	if ctx.Signals == nil {
		ctx.Signals = kernel.NewMarketSignals()
	}

	// Build GatekeeperConfig from strategy config
	rc := at.strategyEngine.GetConfig().RiskControl
	gateCfg := kernel.DefaultGatekeeperConfig()
	gateCfg.MinRiskRewardRatio = rc.MinRiskRewardRatio
	gateCfg.MinConfidence = rc.MinConfidence
	gateCfg.TraderID = at.id
	gateCfg.MinHoldSeconds = at.strategyEngine.GetConfig().MinHoldSeconds

	primaryTF := "1h"
	if at.strategyEngine != nil {
		cfg := at.strategyEngine.GetConfig()
		if cfg.Indicators.Klines.PrimaryTimeframe != "" {
			primaryTF = cfg.Indicators.Klines.PrimaryTimeframe
		}
	}
	gateCfg.SignalTimeframe = primaryTF

	// Convert decisions to CandidateDecisions for Gatekeeper
	candidates := make([]kernel.CandidateDecision, len(decisions))
	for i, d := range decisions {
		candidates[i] = kernel.CandidateFromDecision(d, "ai")
	}

	// Run GateAll
	gated := kernel.GateAll(candidates, ctx.Signals, ctx.MarketDataMap, gateCfg)

	// Filter: keep only passed candidates
	var filtered []kernel.Decision
	for _, c := range gated {
		if c.GatekeeperPassed {
			filtered = append(filtered, c.ToDecision())
		}
	}

	if rejected := len(decisions) - len(filtered); rejected > 0 {
		logger.Infof("🚫 [%s] Gatekeeper filtered %d/%d decisions", at.name, rejected, len(decisions))
	}

	return filtered
}

// ─── Risk Guard Integration ─────────────────────────────────────────────────

// syncRiskGuardPositions updates the risk guard with current position data.
func (at *AutoTrader) syncRiskGuardPositions(ctx *kernel.Context) {
	if at.riskGuard == nil || len(ctx.Positions) == 0 {
		return
	}

	stopLossPct := 5.0 // default 5%
	if at.strategyEngine != nil {
		cfg := at.strategyEngine.GetConfig()
		if cfg.GridConfig != nil && cfg.GridConfig.StopLossPct > 0 {
			stopLossPct = cfg.GridConfig.StopLossPct
		}
	}

	type posInput struct {
		Symbol     string
		Side       string
		EntryPrice float64
		Quantity   float64
		Leverage   int
		LiqPrice   float64
	}
	inputs := make([]posInput, len(ctx.Positions))
	for i, p := range ctx.Positions {
		side := "LONG"
		if p.Side == "short" {
			side = "SHORT"
		}
		inputs[i] = posInput{
			Symbol:     p.Symbol,
			Side:       side,
			EntryPrice: p.EntryPrice,
			Quantity:   p.Quantity,
			Leverage:   p.Leverage,
			LiqPrice:   p.LiquidationPrice,
		}
	}

	monitored := make([]MonitoredPosition, 0, len(inputs))
	for _, p := range inputs {
		mp := MonitoredPosition{
			Symbol:     p.Symbol,
			Side:       p.Side,
			EntryPrice: p.EntryPrice,
			Quantity:   p.Quantity,
			Leverage:   p.Leverage,
			LiqPrice:   p.LiqPrice,
			TraderID:   at.id,
		}
		if stopLossPct > 0 && p.EntryPrice > 0 {
			if p.Side == "LONG" {
				mp.StopLossPrice = p.EntryPrice * (1 - stopLossPct/100)
			} else {
				mp.StopLossPrice = p.EntryPrice * (1 + stopLossPct/100)
			}
		}
		if mp.LiqPrice <= 0 && p.Leverage > 0 && p.EntryPrice > 0 {
			if p.Side == "LONG" {
				mp.LiqPrice = p.EntryPrice * (1 - 1.0/float64(p.Leverage))
			} else {
				mp.LiqPrice = p.EntryPrice * (1 + 1.0/float64(p.Leverage))
			}
		}
		monitored = append(monitored, mp)
	}

	at.riskGuard.UpdatePositions(monitored)
}

// consumeRiskEvents reads risk events from the guard and converts to kernel type.
func (at *AutoTrader) consumeRiskEvents() []kernel.RiskEventInfo {
	if at.riskGuard == nil {
		return nil
	}

	events := at.riskGuard.ConsumeRiskEvents()
	if len(events) == 0 {
		return nil
	}

	result := make([]kernel.RiskEventInfo, len(events))
	for i, e := range events {
		result[i] = kernel.RiskEventInfo{
			Timestamp:    e.Timestamp,
			Symbol:       e.Symbol,
			Side:         e.Side,
			EventType:    e.EventType,
			TriggerPrice: e.TriggerPrice,
			Action:       e.Action,
			Reason:       e.Reason,
			Success:      e.Success,
		}
	}
	logger.Infof("🚨 [%s] Consumed %d risk events from guard", at.name, len(result))
	return result
}

// ─── Arena Gatekeeper ───────────────────────────────────────────────────────

// buildArenaGatekeeper returns a GatekeeperFunc for the ArenaRunner.
// Checks: minimum confidence, open-position frequency (via OpenGate), max positions.
// All checks are best-effort: if the strategy config is nil, default permissive values
// are used so the arena can still run.
func (at *AutoTrader) buildArenaGatekeeper() func(symbol, action string, confidence int) (bool, string) {
	return func(symbol, action string, confidence int) (bool, string) {
		// Derive config safely
		var rc store.RiskControlConfig
		if at.config.StrategyConfig != nil {
			rc = at.config.StrategyConfig.RiskControl
		}

		// 1. Minimum confidence check
		// Close actions bypass MinConfidence and OpenGate: closing positions
		// (SL/TP/risk exit) must not be blocked by confidence or frequency limits.
		if !isCloseAction(action) {
			minConf := rc.MinConfidence
			if minConf <= 0 {
				minConf = 60 // permissive default for arena
			}
			if confidence < minConf {
				return false, fmt.Sprintf("arena gatekeeper: confidence %d < minimum %d", confidence, minConf)
			}
		}

		// 2. Open-position frequency gate (only for open actions)
		// 使用 sided 版本，long/short cooldown 隔离
		if isOpenAction(action) && at.openGate != nil {
			side := "long"
			if action == "open_short" {
				side = "short"
			}
			allowed, reason := at.openGate.AllowOpenSided(at.id, symbol, side, rc)
			if !allowed {
				return false, "arena gatekeeper: OpenGate blocked — " + reason
			}
		}

		// 3. Maximum positions check (only for open actions).
		// N5: 使用 trader.GetPositions() 获取实时持仓（替代 LifecycleManager 可能滞后的快照）。
		// GetPositions 失败时放行（warn log），避免因 API 故障误阻止交易。
		if isOpenAction(action) {
			maxPos := rc.MaxPositions
			if maxPos <= 0 {
				maxPos = store.MaxPositions // package constant (3)
			}
			positions, posErr := at.trader.GetPositions()
			if posErr != nil {
				logger.Warnf("⚠️ [%s] arena gatekeeper: GetPositions failed (%v), allowing action", at.name, posErr)
			} else {
				// 统计非零持仓数量（按 symbol 去重，positionAmt 为交易所返回的仓位数量字段）
				seen := make(map[string]bool)
				for _, p := range positions {
					sym, _ := p["symbol"].(string)
					qty, _ := p["positionAmt"].(float64)
					if sym != "" && qty != 0 {
						seen[sym] = true
					}
				}
				trackedCount := len(seen)
				if trackedCount >= maxPos {
					return false, fmt.Sprintf("arena gatekeeper: position limit reached (%d/%d)", trackedCount, maxPos)
				}
			}
		}

		return true, ""
	}
}

// arenaSymbols returns the configured arena symbol list (or nil if not arena strategy).
func (at *AutoTrader) arenaSymbols() []string {
	if at.config.StrategyConfig != nil && at.config.StrategyConfig.ArenaConfig != nil {
		return at.config.StrategyConfig.ArenaConfig.Symbols
	}
	return nil
}

// ─── Risk Guard Helpers ─────────────────────────────────────────────────────

// collectMonitoredSymbols gathers all symbols that should be watched by the
// real-time risk guard: grid symbol, arena symbols, and AI strategy candidate coins.
func (at *AutoTrader) collectMonitoredSymbols() []string {
	seen := make(map[string]bool)
	var symbols []string

	add := func(sym string) {
		if sym != "" && !seen[sym] {
			seen[sym] = true
			symbols = append(symbols, sym)
		}
	}

	if at.config.StrategyConfig == nil {
		return symbols
	}

	// Grid trading: single symbol
	if at.config.StrategyConfig.GridConfig != nil {
		add(at.config.StrategyConfig.GridConfig.Symbol)
	}

	// Arena trading: multiple symbols
	if at.config.StrategyConfig.ArenaConfig != nil {
		for _, sym := range at.config.StrategyConfig.ArenaConfig.Symbols {
			add(sym)
		}
	}

	// AI trading: candidate coin sources (strategy engine resolves these at runtime,
	// so we use a best-effort pull here; empty is fine — riskGuard.UpdatePositions
	// will subscribe dynamically once positions are opened).

	logger.Infof("🛡️ [%s] collectMonitoredSymbols: %d symbols %v", at.name, len(symbols), symbols)
	return symbols
}

// ─── Adaptive Thresholds ────────────────────────────────────────────────────

// recordTradeOutcome records a trade outcome to the adaptive thresholds system.
func (at *AutoTrader) recordTradeOutcome(symbol string, isWin bool) {
	if at.adaptiveState == nil {
		return
	}

	at.adaptiveState.RecordTrade(kernel.TradeOutcome{
		Symbol:   symbol,
		IsWin:    isWin,
		ClosedAt: time.Now(),
		Source:   "ai",
	})
}

// ─── Position Reconciler (DB ↔ Exchange truth) ──────────────────────────────
//
// reconcileDBPositions forces DB trader_positions to match exchange reality.
// For every DB OPEN position without a matching live position, mark it CLOSED.
// This captures manual closes (via nofx UI or exchange native UI) and any drift
// that position_builder.ProcessTrade missed (e.g., ghost partial closes).
//
// PnL is intentionally left at the position's accumulated RealizedPnL (from any
// prior partial closes). Fresh OrderSync runs may later backfill more accurate
// PnL via the fills table. The core goal here is to ensure the position record
// surfaces in history and no longer pollutes AI stats/recent-trades prompts.
//
// Rollback: set env NOFX_RECONCILE_DISABLED=1 to bypass at runtime.
func (at *AutoTrader) reconcileDBPositions(livePositions []map[string]interface{}) {
	if os.Getenv("NOFX_RECONCILE_DISABLED") == "1" {
		return
	}
	if at.store == nil {
		return
	}

	// 1. Build exchange truth set: symbol+SIDE (uppercase to match DB convention)
	liveSet := make(map[string]bool, len(livePositions))
	for _, p := range livePositions {
		sym, _ := p["symbol"].(string)
		side, _ := p["side"].(string)
		qty, _ := p["positionAmt"].(float64)
		if qty < 0 {
			qty = -qty
		}
		if sym == "" || side == "" || qty == 0 {
			continue
		}
		liveSet[sym+"_"+strings.ToUpper(side)] = true
	}

	// 2. Scan all DB OPEN positions; close those absent from exchange
	dbOpens, err := at.store.Position().GetOpenPositions(at.id)
	if err != nil {
		logger.Warnf("⚠️ [%s] Reconcile: failed to fetch open positions: %v", at.name, err)
		return
	}

	nowMs := time.Now().UTC().UnixMilli()
	closed := 0
	for _, dp := range dbOpens {
		key := dp.Symbol + "_" + strings.ToUpper(dp.Side)
		if liveSet[key] {
			continue
		}

		// Exchange has no matching position → force close.
		// Use EntryPrice as exit fallback when ExitPrice wasn't set by prior partial closes.
		exitPrice := dp.ExitPrice
		if exitPrice == 0 {
			exitPrice = dp.EntryPrice
		}
		if err := at.store.Position().ClosePositionFully(
			dp.ID,
			exitPrice,
			dp.ExitOrderID,
			nowMs,
			dp.RealizedPnL,
			dp.Fee,
			"reconcile",
		); err != nil {
			logger.Warnf("⚠️ [%s] Reconcile: failed to close position id=%d: %v", at.name, dp.ID, err)
			continue
		}
		closed++
		logger.Infof("🧹 [%s] Reconcile: closed ghost position %s %s (id=%d, qty=%.6f, entry=%.4f)",
			at.name, dp.Symbol, dp.Side, dp.ID, dp.Quantity, dp.EntryPrice)
	}

	if closed > 0 {
		logger.Infof("🧹 [%s] Reconcile summary: %d ghost positions closed", at.name, closed)
	}
}

// TriggerReconcileNow runs reconcileDBPositions immediately, fetching live
// positions from the exchange. Used by manual-close handlers so users see the
// closed position appear in history without waiting for the next runCycle.
// Safe to call concurrently with runCycle (the underlying store ops are
// per-row updates with WHERE status='OPEN').
//
// Rollback: env NOFX_RECONCILE_DISABLED=1 short-circuits reconcileDBPositions.
func (at *AutoTrader) TriggerReconcileNow() {
	if at.trader == nil {
		return
	}

	// Grid strategy: run syncGridState which contains the filled-layer reverse check
	if at.IsGridStrategy() {
		at.syncGridState()
		return
	}

	// AI / other strategies: reconcile DB positions
	livePositions, err := at.trader.GetPositions()
	if err != nil {
		logger.Warnf("⚠️ [%s] TriggerReconcileNow: failed to fetch positions: %v", at.name, err)
		return
	}
	at.reconcileDBPositions(livePositions)
}
