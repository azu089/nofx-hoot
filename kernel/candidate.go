package kernel

// candidate.go — Unified CandidateDecision structure used by all generators,
// the Gatekeeper, and the pipeline.
//
// Both the AI generator and the rule generator produce []CandidateDecision.
// Pipeline: generate → gate → evaluate → execute.

import "fmt"

// ─── CandidateDecision ──────────────────────────────────────────────────────

// CandidateReason carries structured reasoning for a candidate — used for
// logging, attribution, and post-trade analysis.
type CandidateReason struct {
	SignalsUsed  []string `json:"signals_used"`
	Why          string   `json:"why"`
	Invalidation string   `json:"invalidation"`
}

// CandidateDecision is the unified representation produced by all generators.
// It extends Decision with metadata used by the institutional pipeline.
type CandidateDecision struct {
	// Core trade fields (mirrors Decision)
	Action          string  `json:"action"`
	Symbol          string  `json:"symbol"`
	Leverage        int     `json:"leverage,omitempty"`
	StopLoss        float64 `json:"stop_loss,omitempty"`
	TakeProfit      float64 `json:"take_profit,omitempty"`
	PositionSizeUSD float64 `json:"position_size_usd,omitempty"`
	Confidence      int     `json:"confidence,omitempty"`
	RiskUSD         float64 `json:"risk_usd,omitempty"`

	// Metadata
	Tags         []string        `json:"tags,omitempty"`
	ReasonStruct CandidateReason `json:"reason_struct,omitempty"`
	Source       string          `json:"source"` // "ai" | "rule" | "position_manager"

	// Pipeline fields (set during processing)
	GatekeeperPassed bool               `json:"gatekeeper_passed"`
	RejectReason     string             `json:"reject_reason,omitempty"`
	Score            float64            `json:"score"`
	ScoreBreakdown   map[string]float64 `json:"score_breakdown,omitempty"`
}

// IsOpenAction returns true when the candidate proposes to open a new position.
func (c *CandidateDecision) IsOpenAction() bool {
	switch c.Action {
	case "open_long", "open_short", "OPEN_NEW", "ADD_POSITION":
		return true
	}
	return false
}

// IsLong returns true for long-direction opens.
func (c *CandidateDecision) IsLong() bool {
	return c.Action == "open_long" || c.Action == "OPEN_NEW"
}

// IsShort returns true for short-direction opens.
func (c *CandidateDecision) IsShort() bool {
	return c.Action == "open_short"
}

// HasTag returns true if the candidate carries the given tag.
func (c *CandidateDecision) HasTag(tag string) bool {
	for _, t := range c.Tags {
		if t == tag {
			return true
		}
	}
	return false
}

// RRRatio computes reward/risk ratio given an entry price.
func (c *CandidateDecision) RRRatio(entryPrice float64) float64 {
	if c.StopLoss <= 0 || c.TakeProfit <= 0 || entryPrice <= 0 {
		return 0
	}
	if c.IsLong() {
		risk := entryPrice - c.StopLoss
		reward := c.TakeProfit - entryPrice
		if risk <= 0 {
			return 0
		}
		return reward / risk
	}
	if c.IsShort() {
		risk := c.StopLoss - entryPrice
		reward := entryPrice - c.TakeProfit
		if risk <= 0 {
			return 0
		}
		return reward / risk
	}
	return 0
}

// ToDecision converts a CandidateDecision to the legacy Decision type.
func (c *CandidateDecision) ToDecision() Decision {
	reasoning := c.ReasonStruct.Why
	if reasoning == "" {
		reasoning = fmt.Sprintf("[%s] score=%.1f tags=%v", c.Source, c.Score, c.Tags)
	}
	return Decision{
		Symbol:          c.Symbol,
		Action:          c.Action,
		Leverage:        c.Leverage,
		PositionSizeUSD: c.PositionSizeUSD,
		StopLoss:        c.StopLoss,
		TakeProfit:      c.TakeProfit,
		Confidence:      c.Confidence,
		RiskUSD:         c.RiskUSD,
		Reasoning:       reasoning,
	}
}

// CandidateFromDecision builds a CandidateDecision from a legacy Decision.
func CandidateFromDecision(d Decision, source string) CandidateDecision {
	return CandidateDecision{
		Action:          d.Action,
		Symbol:          d.Symbol,
		Leverage:        d.Leverage,
		StopLoss:        d.StopLoss,
		TakeProfit:      d.TakeProfit,
		PositionSizeUSD: d.PositionSizeUSD,
		Confidence:      d.Confidence,
		RiskUSD:         d.RiskUSD,
		Source:          source,
		ReasonStruct:    CandidateReason{Why: d.Reasoning},
		ScoreBreakdown:  make(map[string]float64),
	}
}

// MergeAndDedup merges candidate lists and deduplicates: same (symbol, action)
// keeps only the higher-confidence candidate.
func MergeAndDedup(lists ...[]CandidateDecision) []CandidateDecision {
	type key struct{ symbol, action string }
	best := make(map[key]*CandidateDecision)

	for _, list := range lists {
		for i := range list {
			c := &list[i]
			if !c.IsOpenAction() && c.Action != "close_long" && c.Action != "close_short" {
				k := key{"__wait__", "wait"}
				if _, exists := best[k]; !exists {
					best[k] = c
				}
				continue
			}
			k := key{c.Symbol, c.Action}
			if existing, exists := best[k]; !exists || c.Confidence > existing.Confidence {
				best[k] = c
			}
		}
	}

	out := make([]CandidateDecision, 0, len(best))
	for _, c := range best {
		out = append(out, *c)
	}
	return out
}
