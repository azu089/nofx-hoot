package kernel

import "time"

// position_state.go — Position lifecycle state machine.
//
// Each open position progresses through a well-defined lifecycle:
//
//	NEW_POSITION → MATURING → TREND_CONFIRMED → TREND_EXHAUSTION → EXITING
//
// State transitions are driven by market signals (OI trend, HTF EMA alignment)
// and elapsed signal bars. The PositionManager uses these states to prevent
// premature exits.

// PositionState represents the lifecycle stage of an open position.
type PositionState int

const (
	// StateNew: position just opened — fewer than 3 signal bars elapsed.
	// Exit requests blocked unconditionally.
	StateNew PositionState = iota

	// StateMaturing: 3+ bars elapsed; trend has not yet been confirmed.
	// Exit blocked unless HTF EMA + OI both signal reversal.
	StateMaturing

	// StateTrendConfirmed: HTF EMA aligned + OI expanding in trade direction.
	// Hold aggressively; only allow exit on strong reversal signals.
	StateTrendConfirmed

	// StateTrendExhaustion: OI contracting or HTF EMA flattening/reversing.
	// Begin preparing for exit — allow exit signals through.
	StateTrendExhaustion

	// StateExiting: position cleared for exit evaluation.
	StateExiting
)

func (s PositionState) String() string {
	switch s {
	case StateNew:
		return "NEW"
	case StateMaturing:
		return "MATURING"
	case StateTrendConfirmed:
		return "TREND_CONFIRMED"
	case StateTrendExhaustion:
		return "TREND_EXHAUSTION"
	case StateExiting:
		return "EXITING"
	default:
		return "UNKNOWN"
	}
}

// ─── Timeframe Helpers ──────────────────────────────────────────────────────

// TimeframeDuration returns the candle duration for a given timeframe string.
func TimeframeDuration(tf string) time.Duration {
	switch tf {
	case "1m":
		return time.Minute
	case "3m":
		return 3 * time.Minute
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "30m":
		return 30 * time.Minute
	case "1h":
		return time.Hour
	case "2h":
		return 2 * time.Hour
	case "4h":
		return 4 * time.Hour
	case "6h":
		return 6 * time.Hour
	case "8h":
		return 8 * time.Hour
	case "12h":
		return 12 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return time.Hour
	}
}

// MinHoldDuration returns the minimum time a position must remain open before
// an AI-driven exit is considered valid. Shorter timeframes require more bars
// to filter noise.
func MinHoldDuration(signalTimeframe string) time.Duration {
	bar := TimeframeDuration(signalTimeframe)
	var minBars int
	switch signalTimeframe {
	case "1m", "3m":
		minBars = 5
	case "5m":
		minBars = 4
	case "15m", "30m":
		minBars = 3
	case "1h", "2h":
		minBars = 3
	case "4h", "6h", "8h":
		minBars = 2
	case "1d":
		minBars = 2
	default:
		minBars = 3
	}
	return time.Duration(minBars) * bar
}

// HigherTimeframe returns the next-higher confirmation timeframe.
// Used to check whether the higher-TF trend is still intact.
func HigherTimeframe(tf string) string {
	switch tf {
	case "1m":
		return "5m"
	case "3m":
		return "15m"
	case "5m":
		return "15m"
	case "15m":
		return "1h"
	case "30m":
		return "1h"
	case "1h":
		return "4h"
	case "2h":
		return "4h"
	case "4h":
		return "1d"
	case "6h":
		return "1d"
	case "8h":
		return "1d"
	default:
		return "4h"
	}
}
