package trader

// realtime_risk_guard.go — Real-time risk monitoring between runCycle intervals.
//
// Monitors price updates via WebSocket and triggers emergency actions:
//   1. Stop-loss: markPrice breaches pre-calculated SL level → immediate close
//   2. Liquidation warning: price within 5% of liquidation → reduce/close
//   3. Grid boundary breach: price exits grid range → pause grid
//   4. Exposure limit: total notional exceeds maximum → reduce largest position
//
// All risk events are recorded for AI knowledge injection in the next runCycle.

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"nofx/logger"
	"nofx/market"
	"nofx/store"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// MonitoredPosition is a pre-calculated position snapshot for fast risk checks.
type MonitoredPosition struct {
	Symbol        string
	Side          string  // "LONG" / "SHORT"
	EntryPrice    float64
	Quantity      float64
	Leverage      int
	StopLossPrice float64 // pre-calculated trigger price
	LiqPrice      float64 // estimated liquidation price
	TraderID      string
}

// RiskEvent records a risk guard trigger for AI knowledge injection.
type RiskEvent struct {
	Timestamp    time.Time
	Symbol       string
	Side         string
	EventType    string  // "stop_loss" / "liquidation_warning" / "grid_boundary" / "exposure_limit"
	TriggerPrice float64
	Action       string  // "closed_long" / "closed_short" / "reduced" / "grid_paused"
	Reason       string
	Success      bool
	Error        string
}

// ─── RealtimeRiskGuard ──────────────────────────────────────────────────────

// RealtimeRiskGuard monitors prices in real-time and executes emergency risk actions.
type RealtimeRiskGuard struct {
	priceStream *market.PriceStream
	trader      Trader
	gridState   *GridState

	// Monitored positions (synced from runCycle)
	mu         sync.RWMutex
	positions  []MonitoredPosition
	gridConfig *store.GridStrategyConfig

	// Max exposure limit
	maxExposureUSD float64

	// Risk events queue (consumed by runCycle for AI injection)
	riskEvents   []RiskEvent
	riskEventsMu sync.Mutex

	// De-duplication: (symbol|side|eventType) → last trigger time
	lastTrigger   map[string]time.Time
	lastTriggerMu sync.Mutex
	cooldownSecs  int // default 30

	// Exposure limit check throttle
	lastExposureCheck time.Time

	// Stats
	totalChecks   int64
	totalTriggers int64

	// Lifecycle
	stopCh chan struct{}
}

// NewRealtimeRiskGuard creates a new risk guard.
func NewRealtimeRiskGuard(trader Trader, gridState *GridState, testnet bool, maxExposureUSD float64) *RealtimeRiskGuard {
	ps := market.NewPriceStream(testnet)

	rg := &RealtimeRiskGuard{
		priceStream:    ps,
		trader:         trader,
		gridState:      gridState,
		maxExposureUSD: maxExposureUSD,
		lastTrigger:    make(map[string]time.Time),
		cooldownSecs:   30,
		stopCh:         make(chan struct{}),
	}

	// Wire the price callback
	ps.OnPriceUpdate = rg.onPriceUpdate

	return rg
}

// Start begins real-time monitoring. Call after positions are known.
func (rg *RealtimeRiskGuard) Start(symbols []string) error {
	if len(symbols) > 0 {
		rg.priceStream.SubscribeSymbols(symbols)
	}
	return rg.priceStream.Start()
}

// Stop gracefully shuts down monitoring.
func (rg *RealtimeRiskGuard) Stop() {
	select {
	case <-rg.stopCh:
		return
	default:
		close(rg.stopCh)
	}
	rg.priceStream.Stop()
}

// ─── Position Sync (called by runCycle) ─────────────────────────────────────

// UpdatePositions replaces the monitored positions snapshot.
func (rg *RealtimeRiskGuard) UpdatePositions(positions []MonitoredPosition) {
	rg.mu.Lock()
	defer rg.mu.Unlock()
	rg.positions = positions

	// Update subscribed symbols
	syms := make([]string, 0, len(positions))
	seen := make(map[string]bool)
	for _, p := range positions {
		if !seen[p.Symbol] {
			syms = append(syms, p.Symbol)
			seen[p.Symbol] = true
		}
	}
	rg.priceStream.SubscribeSymbols(syms)
}

// UpdateGridConfig updates the grid configuration for boundary checks.
func (rg *RealtimeRiskGuard) UpdateGridConfig(config *store.GridStrategyConfig) {
	rg.mu.Lock()
	defer rg.mu.Unlock()
	rg.gridConfig = config
}

// ConsumeRiskEvents returns and clears all pending risk events.
func (rg *RealtimeRiskGuard) ConsumeRiskEvents() []RiskEvent {
	rg.riskEventsMu.Lock()
	defer rg.riskEventsMu.Unlock()
	events := rg.riskEvents
	rg.riskEvents = nil
	return events
}

// ─── Price Callback ─────────────────────────────────────────────────────────

func (rg *RealtimeRiskGuard) onPriceUpdate(symbol string, price float64, _ int64) {
	select {
	case <-rg.stopCh:
		return
	default:
	}

	atomic.AddInt64(&rg.totalChecks, 1)

	rg.mu.RLock()
	positions := rg.positions
	gridConfig := rg.gridConfig
	rg.mu.RUnlock()

	// Check each position
	for _, pos := range positions {
		if pos.Symbol != symbol {
			continue
		}
		rg.checkStopLoss(pos, price)
		rg.checkLiquidationWarning(pos, price)
	}

	// Grid boundary check
	if rg.gridState != nil && gridConfig != nil {
		rg.checkGridBoundary(price, gridConfig)
	}

	// Exposure limit check (throttled to every 10s)
	now := time.Now()
	if now.Sub(rg.lastExposureCheck) >= 10*time.Second {
		rg.lastExposureCheck = now
		rg.checkExposureLimit(positions, price)
	}
}

// ─── Risk Check 1: Stop Loss ────────────────────────────────────────────────

func (rg *RealtimeRiskGuard) checkStopLoss(pos MonitoredPosition, markPrice float64) {
	if pos.StopLossPrice <= 0 {
		return
	}

	triggered := false
	if pos.Side == "LONG" && markPrice <= pos.StopLossPrice {
		triggered = true
	} else if pos.Side == "SHORT" && markPrice >= pos.StopLossPrice {
		triggered = true
	}

	if !triggered {
		return
	}

	if !rg.canTrigger(pos.Symbol, pos.Side, "stop_loss") {
		return
	}

	reason := fmt.Sprintf("markPrice %.4f breached SL %.4f", markPrice, pos.StopLossPrice)
	logger.Warnf("🚨 [RiskGuard] STOP LOSS %s %s: %s", pos.Symbol, pos.Side, reason)

	var err error
	var action string
	if pos.Side == "LONG" {
		_, err = rg.trader.CloseLong(pos.Symbol, 0)
		action = "closed_long"
	} else {
		_, err = rg.trader.CloseShort(pos.Symbol, 0)
		action = "closed_short"
	}

	rg.recordEvent(pos.Symbol, pos.Side, "stop_loss", markPrice, action, reason, err)
}

// ─── Risk Check 2: Liquidation Warning ──────────────────────────────────────

func (rg *RealtimeRiskGuard) checkLiquidationWarning(pos MonitoredPosition, markPrice float64) {
	if pos.LiqPrice <= 0 || pos.EntryPrice <= 0 {
		return
	}

	distancePct := 0.0
	if pos.Side == "LONG" {
		if markPrice > pos.LiqPrice {
			distancePct = (markPrice - pos.LiqPrice) / markPrice * 100
		}
	} else {
		if pos.LiqPrice > markPrice {
			distancePct = (pos.LiqPrice - markPrice) / markPrice * 100
		}
	}

	if distancePct >= 5 {
		return // safe
	}

	if !rg.canTrigger(pos.Symbol, pos.Side, "liquidation_warning") {
		return
	}

	var qty float64
	var action, reason string

	if distancePct < 2 {
		qty = 0 // close all
		reason = fmt.Sprintf("CRITICAL: %.1f%% from liquidation (liq=%.4f mark=%.4f)", distancePct, pos.LiqPrice, markPrice)
		action = "closed_" + sideLower(pos.Side)
	} else {
		qty = pos.Quantity * 0.5 // reduce 50%
		reason = fmt.Sprintf("WARNING: %.1f%% from liquidation (liq=%.4f mark=%.4f), reducing 50%%", distancePct, pos.LiqPrice, markPrice)
		action = "reduced"
	}

	logger.Warnf("🚨 [RiskGuard] LIQUIDATION WARNING %s %s: %s", pos.Symbol, pos.Side, reason)

	var err error
	if pos.Side == "LONG" {
		_, err = rg.trader.CloseLong(pos.Symbol, qty)
	} else {
		_, err = rg.trader.CloseShort(pos.Symbol, qty)
	}

	rg.recordEvent(pos.Symbol, pos.Side, "liquidation_warning", markPrice, action, reason, err)
}

// ─── Risk Check 3: Grid Boundary ────────────────────────────────────────────

func (rg *RealtimeRiskGuard) checkGridBoundary(markPrice float64, gridConfig *store.GridStrategyConfig) {
	if rg.gridState == nil || gridConfig == nil {
		return
	}

	rg.gridState.mu.RLock()
	isPaused := rg.gridState.IsPaused
	upper := rg.gridState.UpperPrice
	lower := rg.gridState.LowerPrice
	rg.gridState.mu.RUnlock()

	if isPaused || upper <= 0 || lower <= 0 {
		return
	}

	breached := false
	var reason string
	sym := gridConfig.Symbol

	if markPrice > upper*1.02 {
		breached = true
		reason = fmt.Sprintf("price %.4f > upper bound %.4f (+2%%)", markPrice, upper)
	} else if markPrice < lower*0.98 {
		breached = true
		reason = fmt.Sprintf("price %.4f < lower bound %.4f (-2%%)", markPrice, lower)
	}

	if !breached {
		return
	}

	if !rg.canTrigger(sym, "GRID", "grid_boundary") {
		return
	}

	logger.Warnf("🚨 [RiskGuard] GRID BOUNDARY %s: %s", sym, reason)

	rg.gridState.mu.Lock()
	rg.gridState.IsPaused = true
	rg.gridState.mu.Unlock()

	rg.recordEvent(sym, "GRID", "grid_boundary", markPrice, "grid_paused", reason, nil)
}

// ─── Risk Check 4: Exposure Limit ───────────────────────────────────────────

func (rg *RealtimeRiskGuard) checkExposureLimit(positions []MonitoredPosition, latestPrice float64) {
	if rg.maxExposureUSD <= 0 || len(positions) == 0 {
		return
	}

	// Compute current total exposure
	totalExposure := 0.0
	var largest MonitoredPosition
	largestNotional := 0.0

	for _, pos := range positions {
		price := latestPrice
		if pos.Symbol != "" {
			// Use entry price × leverage as approximation when mark price unavailable
			price = pos.EntryPrice
		}
		notional := pos.Quantity * price * float64(pos.Leverage)
		totalExposure += notional
		if notional > largestNotional {
			largestNotional = notional
			largest = pos
		}
	}

	if totalExposure <= rg.maxExposureUSD {
		return
	}

	if !rg.canTrigger("ALL", "ALL", "exposure_limit") {
		return
	}

	reduceQty := largest.Quantity * 0.30
	reason := fmt.Sprintf("total exposure $%.0f > limit $%.0f, reducing %s by 30%%", totalExposure, rg.maxExposureUSD, largest.Symbol)
	logger.Warnf("🚨 [RiskGuard] EXPOSURE LIMIT: %s", reason)

	var err error
	if largest.Side == "LONG" {
		_, err = rg.trader.CloseLong(largest.Symbol, reduceQty)
	} else {
		_, err = rg.trader.CloseShort(largest.Symbol, reduceQty)
	}

	rg.recordEvent(largest.Symbol, largest.Side, "exposure_limit", latestPrice, "reduced", reason, err)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// canTrigger implements the 30-second de-duplication cooldown.
func (rg *RealtimeRiskGuard) canTrigger(symbol, side, eventType string) bool {
	key := symbol + "|" + side + "|" + eventType
	now := time.Now()

	rg.lastTriggerMu.Lock()
	defer rg.lastTriggerMu.Unlock()

	if last, ok := rg.lastTrigger[key]; ok {
		if now.Sub(last) < time.Duration(rg.cooldownSecs)*time.Second {
			return false
		}
	}
	rg.lastTrigger[key] = now
	return true
}

func (rg *RealtimeRiskGuard) recordEvent(symbol, side, eventType string, price float64, action, reason string, err error) {
	atomic.AddInt64(&rg.totalTriggers, 1)

	event := RiskEvent{
		Timestamp:    time.Now(),
		Symbol:       symbol,
		Side:         side,
		EventType:    eventType,
		TriggerPrice: price,
		Action:       action,
		Reason:       reason,
		Success:      err == nil,
	}
	if err != nil {
		event.Error = err.Error()
		logger.Errorf("🚨 [RiskGuard] Action FAILED for %s %s: %v", symbol, eventType, err)
	}

	rg.riskEventsMu.Lock()
	rg.riskEvents = append(rg.riskEvents, event)
	rg.riskEventsMu.Unlock()
}

func sideLower(side string) string {
	if side == "LONG" {
		return "long"
	}
	return "short"
}

// ─── Position Builder ───────────────────────────────────────────────────────

// BuildMonitoredPositions converts kernel position infos to monitored positions
// with pre-calculated stop-loss and liquidation prices.
func BuildMonitoredPositions(positions []struct {
	Symbol     string
	Side       string
	EntryPrice float64
	Quantity   float64
	Leverage   int
	LiqPrice   float64
}, stopLossPct float64, traderID string) []MonitoredPosition {
	result := make([]MonitoredPosition, 0, len(positions))
	for _, p := range positions {
		mp := MonitoredPosition{
			Symbol:     p.Symbol,
			Side:       p.Side,
			EntryPrice: p.EntryPrice,
			Quantity:   p.Quantity,
			Leverage:   p.Leverage,
			LiqPrice:   p.LiqPrice,
			TraderID:   traderID,
		}

		// Pre-calculate stop-loss price
		if stopLossPct > 0 && p.EntryPrice > 0 {
			if p.Side == "LONG" {
				mp.StopLossPrice = p.EntryPrice * (1 - stopLossPct/100)
			} else {
				mp.StopLossPrice = p.EntryPrice * (1 + stopLossPct/100)
			}
		}

		// Estimate liquidation price if not provided
		if mp.LiqPrice <= 0 && p.Leverage > 0 && p.EntryPrice > 0 {
			if p.Side == "LONG" {
				mp.LiqPrice = p.EntryPrice * (1 - 1.0/float64(p.Leverage))
			} else {
				mp.LiqPrice = p.EntryPrice * (1 + 1.0/float64(p.Leverage))
			}
		}

		result = append(result, mp)
	}
	return result
}
