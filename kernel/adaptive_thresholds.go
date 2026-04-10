// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package kernel

// adaptive_thresholds.go — Rolling win-rate driven threshold adaptation.
//
// AdaptiveState maintains a rolling window of recent trade outcomes and
// automatically tightens Gatekeeper thresholds when the system underperforms.
// Only ever moves thresholds in the safer direction (single-direction tightening).
//
// Adaptation rules:
//   - If rolling_winrate < 55%:
//       min_confidence += 5, min_rr += 0.2, cooldown_threshold += 1
//   - If symbol_winrate_20 < 45% (with >= minTrades):
//       add symbol to 24h time-based blacklist

import (
	"nofx/logger"
	"sync"
	"time"
)

// ─── TradeOutcome ───────────────────────────────────────────────────────────

// TradeOutcome records the result of a completed trade for window tracking.
type TradeOutcome struct {
	Symbol   string
	IsWin    bool
	ClosedAt time.Time
	Source   string // "ai" | "rule"
}

// ─── AdaptiveState ──────────────────────────────────────────────────────────

// AdaptiveState holds the rolling window and current effective thresholds.
type AdaptiveState struct {
	mu            sync.RWMutex
	window        []TradeOutcome            // global rolling window
	symbolWindows map[string][]TradeOutcome // per-symbol rolling windows
	blacklist     map[string]time.Time      // symbol → blacklist expiry

	// Configuration
	windowSize       int     // global window size (default 50)
	triggerWinRate   float64 // win rate below which thresholds tighten (default 0.55)
	blMinTrades      int     // min trades before blacklisting (default 10)
	blWinRateThresh  float64 // symbol blacklist threshold (default 0.45)
	blHours          int     // blacklist duration hours (default 24)

	// Baseline thresholds (from config)
	baseMinConfidence   int
	baseMinRR           float64
	baseMinScoreToTrade float64
	baseCooldown        int

	// Current effective thresholds (may be tightened)
	MinConfidence     int
	MinRR             float64
	MinScoreToTrade   float64
	CooldownThreshold int
}

// AdaptiveConfig holds the configuration for the adaptive thresholds system.
type AdaptiveConfig struct {
	WindowSize              int     // global window size (default 50)
	TriggerWinRate          float64 // threshold to trigger tightening (default 0.55)
	BaseMinConfidence       int     // baseline min confidence
	BaseMinRR               float64 // baseline min R:R ratio
	BaseMinScoreToTrade     float64 // baseline min composite score for Vote (default 50)
	BaseCooldownThreshold   int     // baseline consecutive loss cooldown
	SymbolBlacklistMinTrades int    // min trades for symbol blacklist (default 10)
	SymbolBlacklistWinRate  float64 // symbol blacklist threshold (default 0.45)
	SymbolBlacklistHours    int     // blacklist duration (default 24)
}

// DefaultAdaptiveConfig returns sensible defaults.
func DefaultAdaptiveConfig() AdaptiveConfig {
	return AdaptiveConfig{
		WindowSize:               50,
		TriggerWinRate:           0.55,
		BaseMinConfidence:        0,
		BaseMinRR:                1.5,
		BaseMinScoreToTrade:      52,
		BaseCooldownThreshold:    3,
		SymbolBlacklistMinTrades: 10,
		SymbolBlacklistWinRate:   0.45,
		SymbolBlacklistHours:     24,
	}
}

// AdaptiveConfigForMode returns a config tuned for the given strategy mode.
func AdaptiveConfigForMode(mode string) AdaptiveConfig {
	base := DefaultAdaptiveConfig()
	switch mode {
	case "aggressive":
		base.TriggerWinRate = 0.40       // more tolerant before tightening
		base.BaseMinConfidence = 0       // no confidence gate
		base.BaseMinRR = 1.0             // accept lower R:R
		base.BaseMinScoreToTrade = 50    // lowest bar
		base.BaseCooldownThreshold = 99  // practically no cooldown
	case "high_win_rate":
		base.TriggerWinRate = 0.60       // tighten sooner
		base.BaseMinConfidence = 80      // high bar
		base.BaseMinRR = 2.0             // stricter R:R
		base.BaseMinScoreToTrade = 63    // highest bar
		base.BaseCooldownThreshold = 2   // cool down after 2 losses
	case "institutional":
		base.TriggerWinRate = 0.55
		base.BaseMinConfidence = 70
		base.BaseMinRR = 1.5
		base.BaseMinScoreToTrade = 58    // moderately strict
		base.BaseCooldownThreshold = 3
	default: // balanced
		// use defaults as-is
	}
	return base
}

// NewAdaptiveState creates an AdaptiveState with the given config.
func NewAdaptiveState(cfg AdaptiveConfig) *AdaptiveState {
	if cfg.WindowSize <= 0 {
		cfg.WindowSize = 50
	}
	if cfg.TriggerWinRate <= 0 {
		cfg.TriggerWinRate = 0.55
	}
	if cfg.BaseMinRR <= 0 {
		cfg.BaseMinRR = 1.5
	}
	if cfg.BaseCooldownThreshold <= 0 {
		cfg.BaseCooldownThreshold = 3
	}
	if cfg.SymbolBlacklistMinTrades <= 0 {
		cfg.SymbolBlacklistMinTrades = 10
	}
	if cfg.SymbolBlacklistWinRate <= 0 {
		cfg.SymbolBlacklistWinRate = 0.45
	}
	if cfg.SymbolBlacklistHours <= 0 {
		cfg.SymbolBlacklistHours = 24
	}

	return &AdaptiveState{
		window:           make([]TradeOutcome, 0, cfg.WindowSize),
		symbolWindows:    make(map[string][]TradeOutcome),
		blacklist:        make(map[string]time.Time),
		windowSize:       cfg.WindowSize,
		triggerWinRate:   cfg.TriggerWinRate,
		blMinTrades:      cfg.SymbolBlacklistMinTrades,
		blWinRateThresh:  cfg.SymbolBlacklistWinRate,
		blHours:          cfg.SymbolBlacklistHours,
		baseMinConfidence:   cfg.BaseMinConfidence,
		baseMinRR:           cfg.BaseMinRR,
		baseMinScoreToTrade: cfg.BaseMinScoreToTrade,
		baseCooldown:        cfg.BaseCooldownThreshold,
		MinConfidence:       cfg.BaseMinConfidence,
		MinRR:               cfg.BaseMinRR,
		MinScoreToTrade:     cfg.BaseMinScoreToTrade,
		CooldownThreshold:   cfg.BaseCooldownThreshold,
	}
}

// RecordTrade appends a trade outcome and re-evaluates all thresholds.
func (a *AdaptiveState) RecordTrade(outcome TradeOutcome) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if outcome.ClosedAt.IsZero() {
		outcome.ClosedAt = time.Now()
	}

	// Global rolling window
	a.window = append(a.window, outcome)
	if len(a.window) > a.windowSize {
		a.window = a.window[len(a.window)-a.windowSize:]
	}

	// Per-symbol window (last 20 trades)
	const symWindowSize = 20
	sym := outcome.Symbol
	a.symbolWindows[sym] = append(a.symbolWindows[sym], outcome)
	if len(a.symbolWindows[sym]) > symWindowSize {
		sw := a.symbolWindows[sym]
		a.symbolWindows[sym] = sw[len(sw)-symWindowSize:]
	}

	a.recompute(outcome.ClosedAt)
}

// IsBlacklisted returns true if the symbol is currently blacklisted.
func (a *AdaptiveState) IsBlacklisted(symbol string) bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	expiry, ok := a.blacklist[symbol]
	return ok && time.Now().Before(expiry)
}

// BuildBlacklist returns all currently active blacklisted symbols.
func (a *AdaptiveState) BuildBlacklist() map[string]bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	now := time.Now()
	out := make(map[string]bool)
	for sym, expiry := range a.blacklist {
		if now.Before(expiry) {
			out[sym] = true
		}
	}
	return out
}

// RollingWinRate returns the current global rolling win-rate (0-1).
// Returns -1 when the window is empty.
func (a *AdaptiveState) RollingWinRate() float64 {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.rollingWinRate()
}

// EffectiveMinScore returns the current adaptive min composite score for Vote.
func (a *AdaptiveState) EffectiveMinScore() float64 {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.MinScoreToTrade
}

// EffectiveMinConfidence returns the current adaptive min confidence.
func (a *AdaptiveState) EffectiveMinConfidence() int {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.MinConfidence
}

// EffectiveMinRR returns the current adaptive minimum R:R ratio.
func (a *AdaptiveState) EffectiveMinRR() float64 {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.MinRR
}

// EffectiveCooldown returns the current adaptive consecutive-loss threshold.
func (a *AdaptiveState) EffectiveCooldown() int {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.CooldownThreshold
}

// ─── internal helpers ───────────────────────────────────────────────────────

func (a *AdaptiveState) rollingWinRate() float64 {
	if len(a.window) == 0 {
		return -1
	}
	return winRateOf(a.window)
}

func winRateOf(trades []TradeOutcome) float64 {
	wins := 0
	for _, t := range trades {
		if t.IsWin {
			wins++
		}
	}
	return float64(wins) / float64(len(trades))
}

func (a *AdaptiveState) recompute(now time.Time) {
	// Start from baseline
	minConf := a.baseMinConfidence
	minRR := a.baseMinRR
	minScore := a.baseMinScoreToTrade
	cooldown := a.baseCooldown

	// Global win-rate tightening
	wr := a.rollingWinRate()
	if wr >= 0 && wr < a.triggerWinRate {
		minConf += 5
		minRR += 0.2
		minScore += 5
		cooldown++
		logger.Infof("⚡ [AdaptiveThresholds] Rolling WR=%.1f%% < %.0f%% → tightened: min_conf=%d, min_rr=%.1f, min_score=%.0f, cooldown=%d",
			wr*100, a.triggerWinRate*100, minConf, minRR, minScore, cooldown)
	}

	a.MinConfidence = minConf
	a.MinRR = minRR
	a.MinScoreToTrade = minScore
	a.CooldownThreshold = cooldown

	// Per-symbol blacklist
	for sym, trades := range a.symbolWindows {
		if len(trades) < a.blMinTrades {
			continue
		}
		symWR := winRateOf(trades)
		if symWR < a.blWinRateThresh {
			if existing, ok := a.blacklist[sym]; !ok || now.After(existing) {
				expiry := now.Add(time.Duration(a.blHours) * time.Hour)
				a.blacklist[sym] = expiry
				logger.Infof("🚫 [AdaptiveThresholds] %s blacklisted for %dh (winrate=%.1f%% < %.0f%%)",
					sym, a.blHours, symWR*100, a.blWinRateThresh*100)
			}
		}
	}

	// Prune expired blacklist entries
	for sym, expiry := range a.blacklist {
		if now.After(expiry) {
			delete(a.blacklist, sym)
		}
	}
}
