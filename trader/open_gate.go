package trader

import (
	"fmt"
	"sync"
	"time"

	"nofx/logger"
	"nofx/store"
)

// OpenGate enforces open-position frequency control.
// Hard gates (A): cooldown after close, min interval, hourly limit, consecutive loss cooldown.
// Soft gates (B): intent counting — does not block, used for position sizing weight.
type OpenGate struct {
	mu sync.Mutex

	// Hard gate state
	openHistory map[string][]time.Time // traderKey → recent open timestamps
	lastOpenAt  map[string]time.Time   // traderKey|symbol → last open time
	lastCloseAt map[string]time.Time   // traderKey|symbol → last close time

	// Consecutive loss tracking
	consecutiveLosses map[string]int       // traderKey → current streak
	lossLockUntil     map[string]time.Time // traderKey → lockout expiry

	// Soft gate state (signal tag only, does NOT block)
	confirmCount  map[string]int   // traderKey|symbol|side → consecutive intent count
	confirmLastAt map[string]int64 // traderKey|symbol|side → last intent unix seconds
}

// NewOpenGate creates a new frequency gate.
func NewOpenGate() *OpenGate {
	logger.Info("[OPEN_GATE] Initialized")
	return &OpenGate{
		openHistory:       make(map[string][]time.Time),
		lastOpenAt:        make(map[string]time.Time),
		lastCloseAt:       make(map[string]time.Time),
		consecutiveLosses: make(map[string]int),
		lossLockUntil:     make(map[string]time.Time),
		confirmCount:      make(map[string]int),
		confirmLastAt:     make(map[string]int64),
	}
}

func (g *OpenGate) key(traderKey, symbol string) string {
	return traderKey + "|" + symbol
}

func (g *OpenGate) confirmKey(traderKey, symbol, side string) string {
	return traderKey + "|" + symbol + "|" + side
}

// MarkClose records a close event (for cooldown tracking).
func (g *OpenGate) MarkClose(traderKey, symbol string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.lastCloseAt[g.key(traderKey, symbol)] = time.Now()
}

// RecordLoss increments consecutive loss counter. Call after a losing close.
func (g *OpenGate) RecordLoss(traderKey string, rc store.RiskControlConfig) {
	if rc.ConsecutiveLossLimit <= 0 {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()

	g.consecutiveLosses[traderKey]++
	streak := g.consecutiveLosses[traderKey]

	if streak >= rc.ConsecutiveLossLimit {
		cooldown := rc.ConsecutiveLossCooldownMinutes
		if cooldown <= 0 {
			cooldown = 30 // default 30 min cooldown
		}
		g.lossLockUntil[traderKey] = time.Now().Add(time.Duration(cooldown) * time.Minute)
		logger.Infof("[OPEN_GATE] Consecutive loss limit reached (%d), cooling down %d minutes", streak, cooldown)
	}
}

// RecordWin resets the consecutive loss counter.
func (g *OpenGate) RecordWin(traderKey string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.consecutiveLosses[traderKey] = 0
}

// CanPossiblyOpen is a fast pre-check: returns false only when opening is impossible
// for all candidate symbols this cycle. Used to skip AI calls (circuit breaker).
func (g *OpenGate) CanPossiblyOpen(traderKey string, symbols []string, rc store.RiskControlConfig) bool {
	ok, _ := g.CanPossiblyOpenWithReason(traderKey, symbols, rc)
	return ok
}

// CanPossiblyOpenWithReason returns (ok, reason).
func (g *OpenGate) CanPossiblyOpenWithReason(traderKey string, symbols []string, rc store.RiskControlConfig) (bool, string) {
	if len(symbols) == 0 {
		return true, ""
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	now := time.Now()

	// Check consecutive loss lockout
	if until, ok := g.lossLockUntil[traderKey]; ok && now.Before(until) {
		remain := until.Sub(now).Round(time.Second)
		return false, fmt.Sprintf("consecutive_loss_cooldown (remaining %s)", remain)
	}

	// Hourly limit
	if rc.MaxOpensPerHour > 0 {
		h := g.pruneHistory(traderKey, now)
		if len(h) >= rc.MaxOpensPerHour {
			return false, fmt.Sprintf("max_opens_per_hour limit=%d count=%d", rc.MaxOpensPerHour, len(h))
		}
	}

	// At least one symbol must not be in cooldown/min-hold
	for _, symbol := range symbols {
		k := g.key(traderKey, symbol)
		if rc.CooldownMinutesAfterClose > 0 {
			if t, ok := g.lastCloseAt[k]; ok && !t.IsZero() {
				if now.Sub(t) < time.Duration(rc.CooldownMinutesAfterClose)*time.Minute {
					continue
				}
			}
		}
		if rc.MinHoldMinutes > 0 {
			if t, ok := g.lastOpenAt[k]; ok && !t.IsZero() {
				if now.Sub(t) < time.Duration(rc.MinHoldMinutes)*time.Minute {
					continue
				}
			}
		}
		return true, ""
	}
	return false, "all_cooldown_or_min_hold"
}

// RecordOpenIntent records an open intent for soft confirm counting.
// Call before AllowOpen. Does not block — only updates counter.
func (g *OpenGate) RecordOpenIntent(traderKey, symbol, side string, rc store.RiskControlConfig) {
	confirmN := rc.ConfirmTimes
	if confirmN <= 0 {
		confirmN = 1
	}
	confirmWin := rc.ConfirmWindowSeconds
	if confirmWin <= 0 {
		confirmWin = 3600
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	key := g.confirmKey(traderKey, symbol, side)
	now := time.Now().Unix()
	lastAt := g.confirmLastAt[key]
	cnt := g.confirmCount[key]

	if lastAt == 0 || (now-lastAt) > int64(confirmWin) {
		cnt = 1 // reset after window expires
	} else {
		cnt++
	}
	g.confirmLastAt[key] = now
	g.confirmCount[key] = cnt

	logger.Infof("[OPEN_GATE_SOFT] trader=%s symbol=%s side=%s count=%d required=%d",
		traderKey, symbol, side, cnt, confirmN)
}

// ConfirmSatisfied returns true if consecutive intents meet ConfirmTimes threshold.
// Used for position sizing weight (e.g. half size when false). Does not block.
func (g *OpenGate) ConfirmSatisfied(traderKey, symbol, side string, rc store.RiskControlConfig) bool {
	confirmN := rc.ConfirmTimes
	if confirmN <= 0 {
		confirmN = 1
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.confirmCount[g.confirmKey(traderKey, symbol, side)] >= confirmN
}

// ResetConfirmCount clears confirm state after a successful open.
func (g *OpenGate) ResetConfirmCount(traderKey, symbol, side string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := g.confirmKey(traderKey, symbol, side)
	delete(g.confirmCount, key)
	delete(g.confirmLastAt, key)
}

// AllowOpen enforces hard gates only: cooldown, min interval, hourly limit, loss lockout.
// Returns (allowed, reason). On allow, records the open timestamp.
func (g *OpenGate) AllowOpen(traderKey, symbol string, rc store.RiskControlConfig) (bool, string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now()

	// 1) Consecutive loss lockout
	if until, ok := g.lossLockUntil[traderKey]; ok && now.Before(until) {
		remain := until.Sub(now).Round(time.Second)
		return false, fmt.Sprintf("consecutive loss cooldown (remaining %s)", remain)
	}

	// 2) Post-close cooldown
	if rc.CooldownMinutesAfterClose > 0 {
		if t, ok := g.lastCloseAt[g.key(traderKey, symbol)]; ok && !t.IsZero() {
			wait := time.Duration(rc.CooldownMinutesAfterClose) * time.Minute
			if now.Sub(t) < wait {
				remain := (wait - now.Sub(t)).Round(time.Second)
				return false, fmt.Sprintf("post-close cooldown %dm (remaining %s)", rc.CooldownMinutesAfterClose, remain)
			}
		}
	}

	// 3) Min interval
	if rc.MinHoldMinutes > 0 {
		if t, ok := g.lastOpenAt[g.key(traderKey, symbol)]; ok && !t.IsZero() {
			wait := time.Duration(rc.MinHoldMinutes) * time.Minute
			if now.Sub(t) < wait {
				remain := (wait - now.Sub(t)).Round(time.Second)
				return false, fmt.Sprintf("min interval %dm (remaining %s)", rc.MinHoldMinutes, remain)
			}
		}
	}

	// 4) Hourly limit
	if rc.MaxOpensPerHour > 0 {
		h := g.pruneHistory(traderKey, now)
		if len(h) >= rc.MaxOpensPerHour {
			remain := h[0].Add(time.Hour).Sub(now).Round(time.Second)
			return false, fmt.Sprintf("hourly limit %d (remaining %s)", rc.MaxOpensPerHour, remain)
		}
		g.openHistory[traderKey] = append(h, now)
	}

	// Record open time
	g.lastOpenAt[g.key(traderKey, symbol)] = now

	logger.Infof("[OPEN_GATE] Allowed: trader=%s symbol=%s", traderKey, symbol)
	return true, ""
}

// pruneHistory removes entries older than 1 hour and returns the pruned slice.
func (g *OpenGate) pruneHistory(traderKey string, now time.Time) []time.Time {
	h := g.openHistory[traderKey]
	cutoff := now.Add(-time.Hour)
	n := 0
	for _, ts := range h {
		if ts.After(cutoff) {
			h[n] = ts
			n++
		}
	}
	h = h[:n]
	g.openHistory[traderKey] = h
	return h
}
