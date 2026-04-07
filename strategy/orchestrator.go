package strategy

// orchestrator.go — Strategy orchestration based on market regime.
//
// Maps MarketRegime → active strategies with weights.
// Used by the AI candidate generator and Gatekeeper to adapt behaviour.

import (
	"nofx/market"
	"sort"
)

// ─── StrategyName ───────────────────────────────────────────────────────────

type StrategyName string

const (
	TrendFollowing StrategyName = "TREND_FOLLOWING"
	MeanReversion  StrategyName = "MEAN_REVERSION"
	Breakout       StrategyName = "BREAKOUT"
)

// ─── StrategyWeight ─────────────────────────────────────────────────────────

// StrategyWeight describes a strategy and its activation weight for the current regime.
type StrategyWeight struct {
	Name          StrategyName
	Weight        float64 // 0-1 allocation weight
	Active        bool    // whether this strategy should generate candidates
	MinConfidence int     // minimum AI confidence for this strategy (feeds G9)
	Reason        string  // why this strategy is selected/weighted
}

// ─── SelectActiveStrategies ─────────────────────────────────────────────────

// SelectActiveStrategies returns the weighted strategy mix for the given market regime.
func SelectActiveStrategies(regime market.MarketRegime) []StrategyWeight {
	switch regime {
	case market.RegimeTrending:
		return []StrategyWeight{
			{Name: TrendFollowing, Weight: 0.70, Active: true, MinConfidence: 60, Reason: "trending market favours trend-following"},
			{Name: Breakout, Weight: 0.30, Active: true, MinConfidence: 70, Reason: "breakouts can extend trends"},
			{Name: MeanReversion, Weight: 0, Active: false, MinConfidence: 0, Reason: "mean-reversion dangerous in trends"},
		}

	case market.RegimeRanging:
		return []StrategyWeight{
			{Name: MeanReversion, Weight: 0.80, Active: true, MinConfidence: 55, Reason: "ranging market ideal for mean-reversion"},
			{Name: TrendFollowing, Weight: 0.20, Active: true, MinConfidence: 75, Reason: "weak trends possible, require high confidence"},
			{Name: Breakout, Weight: 0, Active: false, MinConfidence: 0, Reason: "false breakouts common in ranges"},
		}

	case market.RegimeHighVolatility:
		return []StrategyWeight{
			{Name: Breakout, Weight: 0.50, Active: true, MinConfidence: 75, Reason: "high volatility enables explosive breakouts"},
			{Name: TrendFollowing, Weight: 0, Active: false, MinConfidence: 0, Reason: "whipsaw risk too high for trend-following"},
			{Name: MeanReversion, Weight: 0, Active: false, MinConfidence: 0, Reason: "mean-reversion dangerous in high vol"},
		}

	case market.RegimeLowLiquidity:
		// Don't fully stop — use conservative allocation to avoid long zero-trade periods
		return []StrategyWeight{
			{Name: Breakout, Weight: 0.50, Active: true, MinConfidence: 80, Reason: "breakouts from low-liquidity compression"},
			{Name: TrendFollowing, Weight: 0.30, Active: true, MinConfidence: 80, Reason: "conservative trend following only"},
			{Name: MeanReversion, Weight: 0, Active: false, MinConfidence: 0, Reason: "thin markets make mean-reversion unreliable"},
		}

	default:
		// Unknown regime → safe default (ranging)
		return SelectActiveStrategies(market.RegimeRanging)
	}
}

// ─── PrimaryStrategy ────────────────────────────────────────────────────────

// PrimaryStrategy returns the highest-weight active strategy.
func PrimaryStrategy(weights []StrategyWeight) StrategyWeight {
	var best StrategyWeight
	for _, w := range weights {
		if w.Active && w.Weight > best.Weight {
			best = w
		}
	}
	if best.Name == "" {
		return StrategyWeight{Name: TrendFollowing, Weight: 1.0, Active: true, MinConfidence: 60}
	}
	return best
}

// ─── ResolveConflict ────────────────────────────────────────────────────────

// CandidateInfo is a minimal interface for conflict resolution.
// Avoids importing kernel.CandidateDecision to prevent circular deps.
type CandidateInfo struct {
	Symbol     string
	Action     string // "open_long" | "open_short" | "wait" | etc.
	Confidence int
	Strategy   StrategyName // which strategy generated this
	Weight     float64      // inherited from StrategyWeight
}

// ResolveConflicts arbitrates when multiple strategies propose opposing actions
// for the same symbol. Higher weighted-confidence wins.
func ResolveConflicts(candidates []CandidateInfo) []CandidateInfo {
	if len(candidates) <= 1 {
		return candidates
	}

	// Group by symbol
	bySymbol := make(map[string][]CandidateInfo)
	var nonConflict []CandidateInfo

	for _, c := range candidates {
		if c.Action == "wait" || c.Action == "hold" {
			nonConflict = append(nonConflict, c)
			continue
		}
		bySymbol[c.Symbol] = append(bySymbol[c.Symbol], c)
	}

	// For each symbol, check for directional conflicts
	for sym, group := range bySymbol {
		if len(group) <= 1 {
			nonConflict = append(nonConflict, group...)
			continue
		}

		// Check if we have both long and short
		hasLong := false
		hasShort := false
		for _, c := range group {
			if c.Action == "open_long" {
				hasLong = true
			}
			if c.Action == "open_short" {
				hasShort = true
			}
		}

		if hasLong && hasShort {
			// Conflict: pick the one with highest weighted confidence
			sort.Slice(group, func(i, j int) bool {
				scoreI := float64(group[i].Confidence) * group[i].Weight
				scoreJ := float64(group[j].Confidence) * group[j].Weight
				return scoreI > scoreJ
			})
			winner := group[0]
			winner.Strategy = StrategyName(string(winner.Strategy) + "_conflict_winner")
			nonConflict = append(nonConflict, winner)
			_ = sym // used in map key
		} else {
			// No conflict, keep all
			nonConflict = append(nonConflict, group...)
		}
	}

	return nonConflict
}
