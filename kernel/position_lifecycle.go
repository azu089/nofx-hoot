package kernel

// position_lifecycle.go — Position lifecycle manager.
//
// Tracks when each position was opened and which lifecycle state it is
// currently in. The PositionManager queries this before allowing exit
// decisions.
//
// State machine:
//
//	StateNew → StateMaturing → StateTrendConfirmed → StateTrendExhaustion → StateExiting
//
// Transitions are driven by:
//   - Bar count elapsed since registration
//   - OI trend ("expansion" vs "contraction")
//   - HTF EMA alignment (EMA20 vs EMA50 on the higher timeframe)

import (
	"strings"
	"sync"
	"time"
)

// ─── PositionLifecycle ──────────────────────────────────────────────────────

// PositionLifecycle holds the runtime lifecycle data for a single open position.
type PositionLifecycle struct {
	TraderID        string
	Symbol          string
	Side            string
	State           PositionState
	RegisteredAt    time.Time // wall-clock time when position was first detected
	LastTransition  time.Time // wall-clock time of last state change
	SignalTimeframe string    // primary signal timeframe for this trade
	BarCount        int       // approximate number of signal bars elapsed
}

// HasMinimumBarsElapsed returns true when the position has been held for at
// least MinHoldDuration(SignalTimeframe).
func (lc *PositionLifecycle) HasMinimumBarsElapsed() bool {
	return time.Since(lc.RegisteredAt) >= MinHoldDuration(lc.SignalTimeframe)
}

// Advance increments the bar counter and runs state-machine transitions based
// on fresh market signals. Call once per engine tick.
//
//   - oiTrend: "expansion" | "contraction" | "" (from MarketSignals)
//   - htfEMAAligned: true when EMA20 > EMA50 for a long (or EMA20 < EMA50 for short)
//     on the higher timeframe — caller must normalise direction before passing.
func (lc *PositionLifecycle) Advance(oiTrend string, htfEMAAligned bool) {
	lc.BarCount++

	switch lc.State {
	case StateNew:
		if lc.BarCount >= 3 {
			lc.transition(StateMaturing)
		}
	case StateMaturing:
		if htfEMAAligned && oiTrend == "expansion" {
			lc.transition(StateTrendConfirmed)
		}
	case StateTrendConfirmed:
		if oiTrend == "contraction" || !htfEMAAligned {
			lc.transition(StateTrendExhaustion)
		}
	case StateTrendExhaustion:
		lc.transition(StateExiting)
	}
}

func (lc *PositionLifecycle) transition(next PositionState) {
	lc.State = next
	lc.LastTransition = time.Now()
}

// ─── PositionLifecycleManager ───────────────────────────────────────────────

// PositionLifecycleManager manages lifecycle state for all open positions.
// Thread-safe.
type PositionLifecycleManager struct {
	mu        sync.RWMutex
	positions map[string]*PositionLifecycle // key: trader|symbol|side
}

// NewPositionLifecycleManager creates a new manager.
func NewPositionLifecycleManager() *PositionLifecycleManager {
	return &PositionLifecycleManager{
		positions: make(map[string]*PositionLifecycle),
	}
}

func normalizeLifecycleSide(side string) string {
	s := strings.ToUpper(strings.TrimSpace(side))
	switch s {
	case "LONG", "BUY":
		return "LONG"
	case "SHORT", "SELL":
		return "SHORT"
	default:
		return s
	}
}

func lifecycleKey(traderID, symbol, side string) string {
	return strings.TrimSpace(traderID) + "|" + strings.ToUpper(strings.TrimSpace(symbol)) + "|" + normalizeLifecycleSide(side)
}

// Register adds a position to lifecycle tracking if not already present.
// Safe to call on every tick — subsequent calls for the same key are no-ops.
// 使用当前时间作为 RegisteredAt（进程启动后首次见到的时间）。
func (m *PositionLifecycleManager) Register(traderID, symbol, side, signalTimeframe string) {
	m.RegisterWithTime(traderID, symbol, side, signalTimeframe, time.Now())
}

// RegisterWithTime 按指定时间注册 lifecycle。
//
// 用于进程启动/重启时从 DB trader_positions.entry_time 恢复真实开仓时间，
// 避免 EXIT_G3 min_hold 检查被重启瞬间重置。
//
// registeredAt 零值时退化为 time.Now()。
// 重复 Register 同 key 是 no-op，以第一次 Register 的时间为准。
func (m *PositionLifecycleManager) RegisterWithTime(traderID, symbol, side, signalTimeframe string, registeredAt time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := lifecycleKey(traderID, symbol, side)
	if _, exists := m.positions[key]; !exists {
		if registeredAt.IsZero() {
			registeredAt = time.Now()
		}
		m.positions[key] = &PositionLifecycle{
			TraderID:        strings.TrimSpace(traderID),
			Symbol:          symbol,
			Side:            normalizeLifecycleSide(side),
			State:           StateNew,
			RegisteredAt:    registeredAt,
			LastTransition:  time.Now(), // 状态变更时间总是当下
			SignalTimeframe: signalTimeframe,
		}
	}
}

// Unregister removes a position once it has been closed.
func (m *PositionLifecycleManager) Unregister(traderID, symbol, side string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.positions, lifecycleKey(traderID, symbol, side))
}

// Get returns the lifecycle for trader/symbol/side, or nil if not tracked.
func (m *PositionLifecycleManager) Get(traderID, symbol, side string) *PositionLifecycle {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.positions[lifecycleKey(traderID, symbol, side)]
}

// HasMinimumBarsElapsed returns whether the position has been held long enough.
// Returns false for untracked positions (fail-close).
func (m *PositionLifecycleManager) HasMinimumBarsElapsed(traderID, symbol, side string) bool {
	lc := m.Get(traderID, symbol, side)
	if lc == nil {
		return false
	}
	return lc.HasMinimumBarsElapsed()
}

// SyncPositions reconciles tracked positions against the live position list.
// Registers new positions and unregisters stale ones for the given trader.
//
// 对于新注册的 lifecycle，优先使用 PositionInfo.UpdateTime（来自 DB entry_time
// 或交易所 createdTime）作为 RegisteredAt，使 EXIT_G3 的 hold 时间计算跨越
// 进程重启仍然准确。UpdateTime 为 0 时退化为 time.Now()。
func (m *PositionLifecycleManager) SyncPositions(traderID string, livePositions []PositionInfo, signalTimeframe string) {
	live := make(map[string]bool, len(livePositions))
	for _, p := range livePositions {
		side := p.Side
		if side == "" {
			side = "LONG"
		}
		key := lifecycleKey(traderID, p.Symbol, side)
		live[key] = true

		var registeredAt time.Time
		if p.UpdateTime > 0 {
			registeredAt = time.UnixMilli(p.UpdateTime)
		}
		m.RegisterWithTime(traderID, p.Symbol, side, signalTimeframe, registeredAt)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	prefix := strings.TrimSpace(traderID) + "|"
	for key := range m.positions {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		if !live[key] {
			delete(m.positions, key)
		}
	}
}

// ─── Global Singleton ───────────────────────────────────────────────────────

var globalLifecycleManager = NewPositionLifecycleManager()

// GlobalLifecycleManager returns the process-wide PositionLifecycleManager.
func GlobalLifecycleManager() *PositionLifecycleManager {
	return globalLifecycleManager
}
