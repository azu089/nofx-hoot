// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package portfolio

// portfolio_manager.go — Portfolio-level risk monitoring and allocation.
//
// Tracks aggregate exposure, margin usage, drawdown, and direction concentration.
// Self-contained: defines its own Position type to avoid circular dependencies.

import "math"

// ─── Position ───────────────────────────────────────────────────────────────

// Position represents a single open position for portfolio analysis.
// Callers convert from their native position types (kernel.PositionInfo, etc.).
type Position struct {
	Symbol        string
	Side          string  // "long" | "short"
	NotionalUSD   float64 // position value in USD (qty × price)
	MarginUsed    float64 // margin locked for this position
	UnrealizedPnL float64 // current unrealized P&L in USD
	EntryPrice    float64
	MarkPrice     float64
	Leverage      int
}

// ─── PortfolioState ─────────────────────────────────────────────────────────

// PortfolioState is a snapshot of the portfolio's aggregate risk metrics.
type PortfolioState struct {
	TotalExposureUSD  float64 // sum of all position notionals
	TotalExposurePct  float64 // total exposure / equity × 100
	LongExposureUSD   float64
	ShortExposureUSD  float64
	NetExposurePct    float64 // (long - short) / equity × 100
	TotalMarginUsed   float64
	MarginUsagePct    float64 // margin / equity × 100
	TotalUnrealizedPnL float64
	DrawdownPct       float64 // negative = drawdown from equity
	CorrelationRisk   float64 // 0-1: direction concentration
	LongCount         int
	ShortCount        int
	SymbolExposures   map[string]float64 // symbol → exposure % of equity
}

// ─── PortfolioLimits ────────────────────────────────────────────────────────

// PortfolioLimits defines risk boundaries.
type PortfolioLimits struct {
	MaxTotalExposurePct      float64 // default: 80%
	MaxSingleSymbolPct       float64 // default: 40%
	MaxMarginUsagePct        float64 // default: 70%
	MaxDrawdownPct           float64 // default: 15%
	MaxDirectionConcentration float64 // default: 0.80 (80% one direction)
	MaxNetExposurePct        float64 // default: 60%
}

// DefaultPortfolioLimits returns sensible defaults.
func DefaultPortfolioLimits() PortfolioLimits {
	return PortfolioLimits{
		MaxTotalExposurePct:      80,
		MaxSingleSymbolPct:       40,
		MaxMarginUsagePct:        70,
		MaxDrawdownPct:           15,
		MaxDirectionConcentration: 0.80,
		MaxNetExposurePct:        60,
	}
}

// ─── BuildPortfolioState ────────────────────────────────────────────────────

// BuildPortfolioState computes aggregate metrics from positions and equity.
func BuildPortfolioState(positions []Position, equity float64) PortfolioState {
	state := PortfolioState{
		SymbolExposures: make(map[string]float64),
	}

	if equity <= 0 {
		return state
	}

	for _, p := range positions {
		notional := math.Abs(p.NotionalUSD)
		state.TotalExposureUSD += notional
		state.TotalMarginUsed += p.MarginUsed
		state.TotalUnrealizedPnL += p.UnrealizedPnL

		if p.Side == "long" {
			state.LongExposureUSD += notional
			state.LongCount++
		} else {
			state.ShortExposureUSD += notional
			state.ShortCount++
		}

		// Per-symbol exposure
		state.SymbolExposures[p.Symbol] += (notional / equity) * 100
	}

	state.TotalExposurePct = (state.TotalExposureUSD / equity) * 100
	state.NetExposurePct = ((state.LongExposureUSD - state.ShortExposureUSD) / equity) * 100
	state.MarginUsagePct = (state.TotalMarginUsed / equity) * 100

	// Drawdown as unrealized P&L percentage of equity
	if state.TotalUnrealizedPnL < 0 {
		state.DrawdownPct = (state.TotalUnrealizedPnL / equity) * 100
	}

	// Direction concentration: how much of exposure is in one direction
	total := state.LongExposureUSD + state.ShortExposureUSD
	if total > 0 {
		state.CorrelationRisk = math.Max(state.LongExposureUSD, state.ShortExposureUSD) / total
	}

	return state
}

// ─── LimitViolation ─────────────────────────────────────────────────────────

// LimitViolation describes a single portfolio limit breach.
type LimitViolation struct {
	Rule     string  // "MAX_TOTAL_EXPOSURE" | "MAX_SYMBOL" | etc.
	Current  float64 // current value
	Limit    float64 // threshold
	Symbol   string  // affected symbol (empty for portfolio-wide)
	Severity string  // "warning" | "breach"
}

// CheckPortfolioLimits evaluates the portfolio state against limits.
func CheckPortfolioLimits(state PortfolioState, limits PortfolioLimits) []LimitViolation {
	var violations []LimitViolation

	if state.TotalExposurePct > limits.MaxTotalExposurePct {
		violations = append(violations, LimitViolation{
			Rule: "MAX_TOTAL_EXPOSURE", Current: state.TotalExposurePct,
			Limit: limits.MaxTotalExposurePct, Severity: "breach",
		})
	}

	if state.MarginUsagePct > limits.MaxMarginUsagePct {
		violations = append(violations, LimitViolation{
			Rule: "MAX_MARGIN_USAGE", Current: state.MarginUsagePct,
			Limit: limits.MaxMarginUsagePct, Severity: "breach",
		})
	}

	if math.Abs(state.DrawdownPct) > limits.MaxDrawdownPct {
		violations = append(violations, LimitViolation{
			Rule: "MAX_DRAWDOWN", Current: math.Abs(state.DrawdownPct),
			Limit: limits.MaxDrawdownPct, Severity: "breach",
		})
	}

	if math.Abs(state.NetExposurePct) > limits.MaxNetExposurePct {
		violations = append(violations, LimitViolation{
			Rule: "MAX_NET_EXPOSURE", Current: math.Abs(state.NetExposurePct),
			Limit: limits.MaxNetExposurePct, Severity: "warning",
		})
	}

	if state.CorrelationRisk > limits.MaxDirectionConcentration {
		violations = append(violations, LimitViolation{
			Rule: "MAX_DIRECTION_CONCENTRATION", Current: state.CorrelationRisk * 100,
			Limit: limits.MaxDirectionConcentration * 100, Severity: "warning",
		})
	}

	for sym, pct := range state.SymbolExposures {
		if pct > limits.MaxSingleSymbolPct {
			violations = append(violations, LimitViolation{
				Rule: "MAX_SYMBOL_EXPOSURE", Current: pct,
				Limit: limits.MaxSingleSymbolPct, Symbol: sym, Severity: "breach",
			})
		}
	}

	return violations
}

// ─── AllocationSuggestion ───────────────────────────────────────────────────

// AllocationSuggestion recommends maximum allocation for a new position.
type AllocationSuggestion struct {
	MaxNotionalUSD float64
	MaxPctOfEquity float64
	Reason         string
}

// SuggestAllocation calculates the maximum allocation for a new position,
// respecting both total exposure and single-symbol limits.
func SuggestAllocation(state PortfolioState, limits PortfolioLimits, equity float64, symbol string) AllocationSuggestion {
	if equity <= 0 {
		return AllocationSuggestion{Reason: "no equity available"}
	}

	// Remaining total exposure budget
	totalBudgetPct := limits.MaxTotalExposurePct - state.TotalExposurePct
	if totalBudgetPct <= 0 {
		return AllocationSuggestion{Reason: "total exposure limit reached"}
	}

	// Remaining symbol budget
	currentSymPct := state.SymbolExposures[symbol]
	symBudgetPct := limits.MaxSingleSymbolPct - currentSymPct

	// Remaining margin budget (conservative: assume 5x leverage)
	marginBudgetPct := (limits.MaxMarginUsagePct - state.MarginUsagePct) * 5

	// Take the minimum
	maxPct := math.Min(totalBudgetPct, math.Min(symBudgetPct, marginBudgetPct))
	if maxPct <= 0 {
		return AllocationSuggestion{Reason: "no allocation budget remaining"}
	}

	maxNotional := equity * maxPct / 100.0

	return AllocationSuggestion{
		MaxNotionalUSD: maxNotional,
		MaxPctOfEquity: maxPct,
		Reason:         "within all limits",
	}
}
