package kernel

// candidate_scorer.go — Candidate scoring and voting engine.
//
// Used by the "Rules Engine" (institutional) mode to evaluate AI-generated
// candidates with a structured scoring system rather than executing AI
// decisions directly.
//
// Scoring dimensions (each 0-100, combined into composite score):
//   1. Crowding score  — penalise when the market is overcrowded in our direction
//   2. Trend score     — reward when price trend aligns with proposed direction
//   3. OI alignment    — reward when OI expansion confirms genuine interest
//   4. Squeeze score   — bonus when liquidation pressure favours our direction
//
// Voting rules:
//   - Best score < minScore → WAIT (no clear edge)
//   - Top two scores too close (gap < minGap) → WAIT (ambiguous signal)
//   - Otherwise → execute the highest-scoring candidate

import (
	"fmt"
	"nofx/market"
	"sort"
	"strings"
)

// ScoredCandidate pairs a candidate with its composite score.
type ScoredCandidate struct {
	Candidate CandidateDecision
	Score     float64
	Breakdown map[string]float64
}

// VoteResult describes the voting outcome.
type VoteResult struct {
	Winner      *CandidateDecision // nil when Wait is true
	Wait        bool
	WaitReason  string
	AllScores   []ScoredCandidate
	BestScore   float64
	SecondScore float64
	ScoreGap    float64
	Explain     string // human-readable score summary
}

// ScoreCandidate computes a composite score (0-100) for a single candidate.
func ScoreCandidate(c *CandidateDecision, signals *MarketSignals, md *market.Data) float64 {
	if c == nil {
		return 0
	}

	crowding := scoreCrowding(c, signals)
	trend := scoreTrend(c, md)
	oi := scoreOIAlignment(c, signals)
	squeeze := scoreSqueeze(c, signals)

	// Weighted composite: crowding and trend dominate
	composite := crowding*0.30 + trend*0.35 + oi*0.20 + squeeze*0.15

	// Store breakdown for transparency
	if c.ScoreBreakdown == nil {
		c.ScoreBreakdown = make(map[string]float64)
	}
	c.ScoreBreakdown["crowding"] = crowding
	c.ScoreBreakdown["trend"] = trend
	c.ScoreBreakdown["oi_alignment"] = oi
	c.ScoreBreakdown["squeeze"] = squeeze

	c.Score = composite
	return composite
}

// VoteCandidates runs scoring on all candidates and selects the best one (or WAIT).
func VoteCandidates(
	candidates []CandidateDecision,
	signals *MarketSignals,
	mdMap map[string]*market.Data,
	minScore float64,
	minGap float64,
) VoteResult {
	if len(candidates) == 0 {
		return VoteResult{Wait: true, WaitReason: "no candidates available"}
	}

	// Score all candidates
	scored := make([]ScoredCandidate, 0, len(candidates))
	for i := range candidates {
		c := &candidates[i]
		var md *market.Data
		if mdMap != nil {
			md = mdMap[c.Symbol]
		}
		s := ScoreCandidate(c, signals, md)
		scored = append(scored, ScoredCandidate{
			Candidate: *c,
			Score:     s,
			Breakdown: c.ScoreBreakdown,
		})
	}

	// Sort descending by score
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	best := scored[0]
	secondScore := 0.0
	if len(scored) > 1 {
		secondScore = scored[1].Score
	}
	gap := best.Score - secondScore

	// Build explanation
	var lines []string
	for _, sc := range scored {
		lines = append(lines, fmt.Sprintf("  %s %s: %.1f (crowd=%.1f trend=%.1f OI=%.1f squeeze=%.1f)",
			sc.Candidate.Symbol, sc.Candidate.Action, sc.Score,
			sc.Breakdown["crowding"], sc.Breakdown["trend"],
			sc.Breakdown["oi_alignment"], sc.Breakdown["squeeze"]))
	}
	explain := "Scores:\n" + strings.Join(lines, "\n")

	// WAIT if best score too low
	if best.Score < minScore {
		return VoteResult{
			Wait:        true,
			WaitReason:  fmt.Sprintf("best score %.1f < threshold %.1f", best.Score, minScore),
			AllScores:   scored,
			BestScore:   best.Score,
			SecondScore: secondScore,
			ScoreGap:    gap,
			Explain:     explain,
		}
	}

	// WAIT if top two are too close (ambiguous signal)
	if len(scored) > 1 && gap < minGap {
		return VoteResult{
			Wait:        true,
			WaitReason:  fmt.Sprintf("score gap %.1f < min_gap %.1f — ambiguous signal", gap, minGap),
			AllScores:   scored,
			BestScore:   best.Score,
			SecondScore: secondScore,
			ScoreGap:    gap,
			Explain:     explain,
		}
	}

	winner := best.Candidate
	return VoteResult{
		Winner:      &winner,
		AllScores:   scored,
		BestScore:   best.Score,
		SecondScore: secondScore,
		ScoreGap:    gap,
		Explain:     explain,
	}
}

// ── Scoring sub-functions ─────────────────────────────────────────────────────

// scoreCrowding: high score = not crowded, low score = overcrowded in our direction
func scoreCrowding(c *CandidateDecision, signals *MarketSignals) float64 {
	if signals == nil {
		return 50.0 // neutral when no data
	}

	score := 50.0 // baseline neutral
	sym := c.Symbol

	// Funding rate penalty
	if sig, ok := signals.FundingExtreme[sym]; ok && sig.Extreme {
		if (c.IsLong() && sig.Direction == "longs_paying") ||
			(c.IsShort() && sig.Direction == "shorts_paying") {
			score -= 40 // heavy penalty: crowded in our direction
		} else {
			score += 20 // crowded in opposite direction = good for us
		}
	}

	// Long ratio penalty
	if lr, ok := signals.LongRatios[sym]; ok {
		if c.IsLong() && lr > 0.65 {
			score -= (lr - 0.65) * 200 // penalise approaching crowded
		} else if c.IsShort() && lr < 0.35 {
			score -= (0.35 - lr) * 200
		} else if c.IsLong() && lr < 0.45 {
			score += 15 // underweight longs = contrarian edge
		} else if c.IsShort() && lr > 0.55 {
			score += 15
		}
	}

	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return score
}

// scoreTrend: high score = price trend aligns with proposed direction
func scoreTrend(c *CandidateDecision, md *market.Data) float64 {
	if md == nil {
		return 50.0
	}

	score := 50.0
	change1h := md.PriceChange1h
	change4h := md.PriceChange4h

	if c.IsLong() {
		if change1h > 0 {
			score += clampFloat(change1h*10, 0, 25) // up to +25 for strong 1h up
		} else {
			score -= clampFloat(-change1h*10, 0, 25)
		}
		if change4h > 0 {
			score += clampFloat(change4h*5, 0, 15) // 4h trend confirmation
		} else {
			score -= clampFloat(-change4h*5, 0, 15)
		}
	} else if c.IsShort() {
		if change1h < 0 {
			score += clampFloat(-change1h*10, 0, 25)
		} else {
			score -= clampFloat(change1h*10, 0, 25)
		}
		if change4h < 0 {
			score += clampFloat(-change4h*5, 0, 15)
		} else {
			score -= clampFloat(change4h*5, 0, 15)
		}
	}

	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return score
}

// scoreOIAlignment: high score = OI expanding in the direction of the trade
func scoreOIAlignment(c *CandidateDecision, signals *MarketSignals) float64 {
	if signals == nil {
		return 50.0
	}

	sym := c.Symbol
	oiTrend, ok := signals.OITrend[sym]
	if !ok {
		return 50.0
	}

	switch oiTrend {
	case "expansion":
		return 80.0 // OI expanding = genuine interest
	case "contraction":
		return 20.0 // OI shrinking = position unwinding, unreliable signal
	default:
		return 50.0
	}
}

// scoreSqueeze: bonus when liquidation pressure favours our direction
func scoreSqueeze(c *CandidateDecision, signals *MarketSignals) float64 {
	if signals == nil {
		return 50.0
	}

	sym := c.Symbol
	pressure, ok := signals.LiquidationPressure[sym]
	if !ok {
		return 50.0
	}

	// "short_squeeze" = shorts being liquidated → bullish for longs
	// "long_squeeze" = longs being liquidated → bullish for shorts
	switch pressure {
	case "short_squeeze":
		if c.IsLong() {
			return 80.0
		}
		return 30.0 // going against the squeeze
	case "long_squeeze":
		if c.IsShort() {
			return 80.0
		}
		return 30.0
	default:
		return 50.0
	}
}

func clampFloat(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
