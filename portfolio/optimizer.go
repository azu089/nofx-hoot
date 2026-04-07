package portfolio

// optimizer.go — Portfolio optimization and risk adjustment.
//
// Provides heuristic-based portfolio optimization (no quadratic solver needed)
// and risk-driven adjustment recommendations.

import (
	"fmt"
	"math"
	"sort"
)

// ─── OptimizationObjective ──────────────────────────────────────────────────

type OptimizationObjective string

const (
	MaxSharpe        OptimizationObjective = "MAX_SHARPE"
	MinDrawdown      OptimizationObjective = "MIN_DRAWDOWN"
	BalancedExposure OptimizationObjective = "BALANCED_EXPOSURE"
)

// ─── OptimizationAdvice ─────────────────────────────────────────────────────

// OptimizationAdvice recommends an allocation weight for a position.
type OptimizationAdvice struct {
	Symbol     string
	Side       string
	Weight     float64 // 0-1 target allocation weight
	Action     string  // "keep" | "increase" | "decrease" | "close"
	Reason     string
	Priority   int // 1=highest
}

// ─── RiskAdjustment ─────────────────────────────────────────────────────────

// RiskAdjustment is a specific risk-driven action recommendation.
type RiskAdjustment struct {
	Symbol   string
	Action   string // "reduce" | "close" | "rebalance"
	Reason   string
	Priority int // 1=highest, 3=lowest
	ReducePct float64 // suggested reduction percentage (0-100)
}

// ─── SignalContext ───────────────────────────────────────────────────────────

// SignalContext provides market signal data for optimization decisions.
// Callers populate this from MarketSignals/CoinglassMetrics to avoid
// direct dependency on those packages.
type SignalContext struct {
	OITrend             map[string]string  // symbol → "expansion"/"contraction"/"neutral"
	FundingExtreme      map[string]bool    // symbol → true if funding rate extreme
	LiquidationPressure map[string]string  // symbol → "short_squeeze"/"long_squeeze"/"neutral"
}

// ─── Optimize ───────────────────────────────────────────────────────────────

// Optimize generates allocation advice for each position based on the objective.
func Optimize(positions []Position, signals SignalContext, objective OptimizationObjective) []OptimizationAdvice {
	if len(positions) == 0 {
		return nil
	}

	switch objective {
	case MaxSharpe:
		return optimizeMaxSharpe(positions, signals)
	case MinDrawdown:
		return optimizeMinDrawdown(positions, signals)
	case BalancedExposure:
		return optimizeBalanced(positions)
	default:
		return optimizeMaxSharpe(positions, signals)
	}
}

// ─── MaxSharpe Optimization ─────────────────────────────────────────────────

func optimizeMaxSharpe(positions []Position, signals SignalContext) []OptimizationAdvice {
	type scored struct {
		pos   Position
		score float64
	}

	var items []scored
	for _, p := range positions {
		score := 50.0 // baseline

		// OI expansion = confidence boost (30%)
		if oi, ok := signals.OITrend[p.Symbol]; ok && oi == "expansion" {
			score += 30
		} else if oi == "contraction" {
			score -= 20
		}

		// Funding not extreme = safe (15%)
		if extreme, ok := signals.FundingExtreme[p.Symbol]; ok && extreme {
			score -= 15 // extreme funding = crowded, risky
		} else {
			score += 15
		}

		// Liquidation balance (10%)
		if liq, ok := signals.LiquidationPressure[p.Symbol]; ok {
			if (p.Side == "long" && liq == "short_squeeze") || (p.Side == "short" && liq == "long_squeeze") {
				score += 10 // squeeze in our favor
			} else if (p.Side == "long" && liq == "long_squeeze") || (p.Side == "short" && liq == "short_squeeze") {
				score -= 10 // squeeze against us
			}
		}

		// Unrealized P&L bonus/penalty
		if p.UnrealizedPnL > 0 {
			score += 5 // winning position
		} else if p.UnrealizedPnL < 0 {
			score -= 5
		}

		items = append(items, scored{pos: p, score: math.Max(0, math.Min(100, score))})
	}

	// Sort by score descending
	sort.Slice(items, func(i, j int) bool { return items[i].score > items[j].score })

	// Normalize weights
	var totalScore float64
	for _, s := range items {
		totalScore += s.score
	}
	if totalScore <= 0 {
		totalScore = 1
	}

	advice := make([]OptimizationAdvice, len(items))
	for i, s := range items {
		weight := s.score / totalScore
		action := "keep"
		if weight > 1.0/float64(len(items))*1.3 {
			action = "increase"
		} else if weight < 1.0/float64(len(items))*0.5 {
			action = "decrease"
		}
		advice[i] = OptimizationAdvice{
			Symbol:   s.pos.Symbol,
			Side:     s.pos.Side,
			Weight:   weight,
			Action:   action,
			Reason:   fmt.Sprintf("sharpe score=%.0f", s.score),
			Priority: i + 1,
		}
	}
	return advice
}

// ─── MinDrawdown Optimization ───────────────────────────────────────────────

func optimizeMinDrawdown(positions []Position, signals SignalContext) []OptimizationAdvice {
	n := len(positions)
	equalWeight := 1.0 / float64(n)

	advice := make([]OptimizationAdvice, n)
	for i, p := range positions {
		weight := equalWeight

		// Penalize positions with large drawdown (>3%)
		if p.NotionalUSD > 0 {
			drawdownPct := (p.UnrealizedPnL / p.NotionalUSD) * 100
			if drawdownPct < -3 {
				weight *= 0.70 // reduce by 30%
			}
		}

		// Penalize OI contraction
		if oi, ok := signals.OITrend[p.Symbol]; ok && oi == "contraction" {
			weight *= 0.80 // reduce by 20%
		}

		action := "keep"
		if weight < equalWeight*0.6 {
			action = "decrease"
		}

		advice[i] = OptimizationAdvice{
			Symbol:   p.Symbol,
			Side:     p.Side,
			Weight:   weight,
			Action:   action,
			Reason:   fmt.Sprintf("min_dd weight=%.2f", weight),
			Priority: i + 1,
		}
	}
	return advice
}

// ─── Balanced Exposure ──────────────────────────────────────────────────────

func optimizeBalanced(positions []Position) []OptimizationAdvice {
	n := len(positions)
	equalWeight := 1.0 / float64(n)

	advice := make([]OptimizationAdvice, n)
	for i, p := range positions {
		advice[i] = OptimizationAdvice{
			Symbol:   p.Symbol,
			Side:     p.Side,
			Weight:   equalWeight,
			Action:   "keep",
			Reason:   "balanced equal-weight",
			Priority: i + 1,
		}
	}
	return advice
}

// ─── Risk Adjustments ───────────────────────────────────────────────────────

// GenerateRiskAdjustments produces specific risk-driven actions.
func GenerateRiskAdjustments(state PortfolioState, positions []Position, signals SignalContext) []RiskAdjustment {
	var adjustments []RiskAdjustment

	for _, p := range positions {
		// Extreme funding → high priority reduce
		if extreme, ok := signals.FundingExtreme[p.Symbol]; ok && extreme {
			adjustments = append(adjustments, RiskAdjustment{
				Symbol:    p.Symbol,
				Action:    "reduce",
				Reason:    "extreme funding rate — crowding risk",
				Priority:  1,
				ReducePct: 50,
			})
		}

		// Deep loss → stop-loss suggestion
		if p.NotionalUSD > 0 {
			lossPct := (p.UnrealizedPnL / p.NotionalUSD) * 100
			if lossPct < -5 {
				adjustments = append(adjustments, RiskAdjustment{
					Symbol:    p.Symbol,
					Action:    "close",
					Reason:    fmt.Sprintf("deep loss %.1f%% — stop-loss recommended", lossPct),
					Priority:  1,
					ReducePct: 100,
				})
			}
		}

		// OI contraction + losing → medium priority
		if oi, ok := signals.OITrend[p.Symbol]; ok && oi == "contraction" && p.UnrealizedPnL < 0 {
			adjustments = append(adjustments, RiskAdjustment{
				Symbol:    p.Symbol,
				Action:    "reduce",
				Reason:    "OI contraction + losing position",
				Priority:  2,
				ReducePct: 30,
			})
		}
	}

	// Overall exposure check
	if state.TotalExposurePct > DefaultPortfolioLimits().MaxTotalExposurePct*1.3 {
		adjustments = append(adjustments, RiskAdjustment{
			Symbol:    "ALL",
			Action:    "rebalance",
			Reason:    fmt.Sprintf("total exposure %.0f%% > 130%% of limit — rebalance needed", state.TotalExposurePct),
			Priority:  2,
			ReducePct: 20,
		})
	}

	// Sort by priority
	sort.Slice(adjustments, func(i, j int) bool {
		return adjustments[i].Priority < adjustments[j].Priority
	})

	return adjustments
}

// ─── Overall Reduction Check ────────────────────────────────────────────────

// ShouldReduceOverall checks if the entire portfolio should be reduced.
// Returns (shouldReduce, suggestedReductionPct, reason).
func ShouldReduceOverall(state PortfolioState) (bool, float64, string) {
	// Drawdown > 10%
	if math.Abs(state.DrawdownPct) > 10 {
		return true, 30, fmt.Sprintf("portfolio drawdown %.1f%% > 10%%", math.Abs(state.DrawdownPct))
	}

	// Margin usage > 65%
	if state.MarginUsagePct > 65 {
		return true, 30, fmt.Sprintf("margin usage %.1f%% > 65%%", state.MarginUsagePct)
	}

	// Very high exposure (>120% of equity)
	if state.TotalExposurePct > 120 {
		return true, 25, fmt.Sprintf("total exposure %.1f%% > 120%%", state.TotalExposurePct)
	}

	return false, 0, ""
}
