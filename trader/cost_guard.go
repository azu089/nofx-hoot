// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package trader

import (
	"os"
	"strconv"
	"sync"
	"time"

	"nofx/logger"
)

// CostGuard skips AI calls during cooldown when there are no open positions,
// saving API costs. When positions exist, AI is always called for management.
//
// Controlled by environment variables:
//   COST_GUARD_ENABLED=true          — enable (default: false)
//   COST_GUARD_COOLDOWN_SECONDS=180  — cooldown duration (default: 180s)
//
// Rollback: set COST_GUARD_ENABLED=false (takes effect immediately).
type CostGuard struct {
	mu           sync.Mutex
	lastAICallAt time.Time // zero = never called
}

// NewCostGuard creates a CostGuard if the env flag is enabled, otherwise returns nil.
// When nil, all guard checks are no-ops (caller must nil-check).
func NewCostGuard() *CostGuard {
	if !costGuardEnabled() {
		return nil
	}
	logger.Infof("[COST_GUARD] Enabled, cooldown=%v", costGuardCooldown())
	return &CostGuard{}
}

// ShouldSkipAI returns true if AI call should be skipped this cycle.
// Always returns false when positions > 0 (must manage positions).
// Always returns false when guard is disabled at runtime.
func (g *CostGuard) ShouldSkipAI(positionCount int) bool {
	if g == nil {
		return false
	}
	if !costGuardEnabled() {
		return false
	}
	// Never skip when holding positions — AI must manage them
	if positionCount > 0 {
		return false
	}

	g.mu.Lock()
	last := g.lastAICallAt
	g.mu.Unlock()

	if last.IsZero() {
		return false // never called, allow first call
	}

	remaining := costGuardCooldown() - time.Since(last)
	if remaining > 0 {
		logger.Infof("[COST_GUARD] Skipping AI call (no positions, cooldown remaining: %v)", remaining.Round(time.Second))
		return true
	}
	return false
}

// RecordAICall records a successful AI call, resetting the cooldown timer.
func (g *CostGuard) RecordAICall() {
	if g == nil {
		return
	}
	g.mu.Lock()
	g.lastAICallAt = time.Now()
	g.mu.Unlock()
}

// costGuardEnabled checks the env flag.
func costGuardEnabled() bool {
	return os.Getenv("COST_GUARD_ENABLED") == "true"
}

// costGuardCooldown returns the configured cooldown duration.
func costGuardCooldown() time.Duration {
	if s := os.Getenv("COST_GUARD_COOLDOWN_SECONDS"); s != "" {
		if secs, err := strconv.Atoi(s); err == nil && secs > 0 {
			return time.Duration(secs) * time.Second
		}
	}
	return 180 * time.Second
}
