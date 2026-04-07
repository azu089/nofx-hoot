package kernel

// position_manager.go — Position management authority.
//
// PositionManager is the single decision-maker for open position actions.
// It synthesises lifecycle state, AI signal, alpha decay, and strategy profile
// into a single authoritative PositionAction.
//
// Pipeline:
//
//	AI signal (direction + strength)
//	    ↓
//	PositionLifecycle state
//	    ↓
//	AlphaDecay model
//	    ↓
//	StrategyProfileConfig (profile-specific thresholds)
//	    ↓
//	PositionManager.EvaluatePosition()
//	    ↓
//	PositionAction  (HOLD | REDUCE | SCALE | EXIT)

import (
	"fmt"
	"nofx/market"
)

// ─── PositionAction ─────────────────────────────────────────────────────────

// PositionAction is the definitive instruction for what to do with a position.
type PositionAction string

const (
	PositionActionHold   PositionAction = "HOLD"
	PositionActionReduce PositionAction = "REDUCE"
	PositionActionScale  PositionAction = "SCALE"
	PositionActionExit   PositionAction = "EXIT"
)

// ─── AISignal ───────────────────────────────────────────────────────────────

// AISignal represents the distilled directional view produced by the AI layer.
// The AI says *what it thinks the market will do*, not *what action to take*.
type AISignal struct {
	Symbol    string
	Direction string // "long" | "short" | "neutral"
	Strength  int    // 0-100 confidence
	Source    string // "ai" | "rule"
	Reasoning string
}

// ─── PositionDecision ───────────────────────────────────────────────────────

// PositionDecision is the output of EvaluatePosition.
type PositionDecision struct {
	Symbol     string
	Action     PositionAction
	Reason     string
	RuleCode   string // e.g. "PM_LIFECYCLE_BLOCK", "PM_DECAY_EXIT"
	DecayScore float64
}

// ─── EvaluatePosition ───────────────────────────────────────────────────────

// EvaluatePosition is the central decision function. It synthesises lifecycle
// state, AI signal, alpha decay, and strategy profile into a single action.
//
// Rules in priority order:
//  1. Lifecycle block  — StateNew/StateMaturing → HOLD unconditionally
//  2. Severe decay     — DecayScore ≥ ForceExitScore → EXIT
//  3. Moderate decay   — DecayScore ≥ DecayThresholdScore → REDUCE
//  4. Signal reversal  — AI signal opposes position + lifecycle ≥ Exhaustion → EXIT
//  5. Trend confirmed  — StateTrendConfirmed + signal aligned → SCALE (if allowed)
//  6. Default          — HOLD
func EvaluatePosition(
	position PositionInfo,
	signal AISignal,
	lifecycle PositionState,
	decay AlphaDecayState,
	profile StrategyProfileConfig,
) PositionDecision {
	sym := position.Symbol

	// ── Rule 1: Lifecycle block ─────────────────────────────────────────
	if lifecycle == StateNew {
		return PositionDecision{
			Symbol:   sym,
			Action:   PositionActionHold,
			Reason:   "lifecycle=NEW: minimum bars not elapsed, unconditional hold",
			RuleCode: "PM_LIFECYCLE_NEW",
		}
	}
	if lifecycle == StateMaturing {
		return PositionDecision{
			Symbol:   sym,
			Action:   PositionActionHold,
			Reason:   fmt.Sprintf("lifecycle=MATURING: decay=%s but insufficient bars for exit", decay.Severity),
			RuleCode: "PM_LIFECYCLE_MATURING",
		}
	}

	// ── Rule 2: Severe alpha decay → force exit ─────────────────────────
	if decay.DecayScore >= profile.ForceExitScore {
		return PositionDecision{
			Symbol:     sym,
			Action:     PositionActionExit,
			Reason:     fmt.Sprintf("alpha decay severe (score=%.0f ≥ %.0f): signals=%v", decay.DecayScore, profile.ForceExitScore, decay.ActiveSignals),
			RuleCode:   "PM_DECAY_EXIT",
			DecayScore: decay.DecayScore,
		}
	}

	// ── Rule 3: Moderate alpha decay → reduce ───────────────────────────
	if decay.DecayScore >= profile.DecayThresholdScore {
		return PositionDecision{
			Symbol:     sym,
			Action:     PositionActionReduce,
			Reason:     fmt.Sprintf("alpha decay moderate (score=%.0f ≥ %.0f): signals=%v", decay.DecayScore, profile.DecayThresholdScore, decay.ActiveSignals),
			RuleCode:   "PM_DECAY_REDUCE",
			DecayScore: decay.DecayScore,
		}
	}

	// ── Rule 4: AI signal reversal → exit (lifecycle-gated) ─────────────
	signalOpposes := (position.Side == "long" && signal.Direction == "short") ||
		(position.Side == "short" && signal.Direction == "long")

	if signalOpposes && signal.Strength >= 60 {
		if lifecycle >= StateTrendExhaustion {
			return PositionDecision{
				Symbol:   sym,
				Action:   PositionActionExit,
				Reason:   fmt.Sprintf("AI reversal signal (dir=%s str=%d) + lifecycle=%s → exit", signal.Direction, signal.Strength, lifecycle),
				RuleCode: "PM_SIGNAL_REVERSAL",
			}
		}
		// Signal opposes but lifecycle not exhausted → reduce only if strong
		if lifecycle == StateTrendConfirmed && signal.Strength >= 80 {
			return PositionDecision{
				Symbol:   sym,
				Action:   PositionActionReduce,
				Reason:   fmt.Sprintf("strong AI reversal (str=%d) but lifecycle=TREND_CONFIRMED → reduce only", signal.Strength),
				RuleCode: "PM_SIGNAL_REVERSAL_REDUCE",
			}
		}
	}

	// ── Rule 5: Trend confirmed + aligned signal → scale ────────────────
	signalAligned := (position.Side == "long" && signal.Direction == "long") ||
		(position.Side == "short" && signal.Direction == "short")

	if signalAligned && lifecycle == StateTrendConfirmed && profile.AllowScaling && signal.Strength >= 70 {
		return PositionDecision{
			Symbol:   sym,
			Action:   PositionActionScale,
			Reason:   fmt.Sprintf("lifecycle=TREND_CONFIRMED + aligned AI signal (str=%d) → scale", signal.Strength),
			RuleCode: "PM_SCALE_CONFIRM",
		}
	}

	// ── Rule 6: Default → hold ──────────────────────────────────────────
	return PositionDecision{
		Symbol:   sym,
		Action:   PositionActionHold,
		Reason:   fmt.Sprintf("no exit condition met (decay=%.0f lifecycle=%s signal=%s) → hold", decay.DecayScore, lifecycle, signal.Direction),
		RuleCode: "PM_DEFAULT_HOLD",
	}
}

// ─── Signal Extraction ──────────────────────────────────────────────────────

// ExtractAISignalFromDecision derives an AISignal from a kernel.Decision.
// The AI's "action" is interpreted as a directional view — the PositionManager
// then decides what to actually do with that view.
func ExtractAISignalFromDecision(d *Decision) AISignal {
	sig := AISignal{
		Symbol:    d.Symbol,
		Strength:  d.Confidence,
		Source:    "ai",
		Reasoning: d.Reasoning,
	}
	switch d.Action {
	case "open_long":
		sig.Direction = "long"
	case "open_short":
		sig.Direction = "short"
	case "close_long":
		sig.Direction = "short" // closing long = bearish view
	case "close_short":
		sig.Direction = "long" // closing short = bullish view
	case "hold", "wait":
		sig.Direction = "neutral"
	default:
		sig.Direction = "neutral"
	}
	return sig
}

// ─── Pipeline Integration ───────────────────────────────────────────────────

// PositionManagerResult holds the outcome of evaluating all open positions.
type PositionManagerResult struct {
	Decisions     map[string]PositionDecision
	ExitSymbols   []string
	ReduceSymbols []string
	ScaleSymbols  []string
}

// RunPositionManager evaluates all open positions against AI decisions,
// alpha decay, and lifecycle state. Returns a PositionManagerResult.
func RunPositionManager(
	traderID string,
	positions []PositionInfo,
	aiDecisions []Decision,
	signals *MarketSignals,
	mdMap map[string]*market.Data,
	primaryTF string,
) PositionManagerResult {
	result := PositionManagerResult{
		Decisions: make(map[string]PositionDecision, len(positions)),
	}

	// Build signal lookup: symbol → best AI signal
	signalMap := buildAISignalMap(aiDecisions)

	for _, pos := range positions {
		// Get AI signal for this position's symbol
		aiSig, hasSig := signalMap[pos.Symbol]
		if !hasSig {
			aiSig = AISignal{Symbol: pos.Symbol, Direction: "neutral", Strength: 0, Source: "none"}
		}

		// Get lifecycle state
		lifecycle := StateNew
		if lc := GlobalLifecycleManager().Get(traderID, pos.Symbol, pos.Side); lc != nil {
			lifecycle = lc.State
		}

		// Compute alpha decay
		md := mdMap[pos.Symbol]
		ind := BuildMarketIndicators(pos, md, signals, primaryTF)
		decay := EvaluateAlphaDecay(ind, DefaultAlphaDecayWeights())

		// Detect strategy profile from AI reasoning
		profile := DetectStrategyProfileFromReasoning(aiSig.Reasoning)
		profileCfg := GetStrategyProfileConfig(profile)

		// Evaluate position
		decision := EvaluatePosition(pos, aiSig, lifecycle, decay, profileCfg)
		result.Decisions[pos.Symbol] = decision

		switch decision.Action {
		case PositionActionExit:
			result.ExitSymbols = append(result.ExitSymbols, pos.Symbol)
		case PositionActionReduce:
			result.ReduceSymbols = append(result.ReduceSymbols, pos.Symbol)
		case PositionActionScale:
			result.ScaleSymbols = append(result.ScaleSymbols, pos.Symbol)
		}
	}
	return result
}

// buildAISignalMap converts Decision slice to per-symbol AISignal map.
// Highest-confidence signal wins when multiple decisions target the same symbol.
func buildAISignalMap(decisions []Decision) map[string]AISignal {
	m := make(map[string]AISignal, len(decisions))
	for i := range decisions {
		sig := ExtractAISignalFromDecision(&decisions[i])
		if existing, ok := m[sig.Symbol]; !ok || sig.Strength > existing.Strength {
			m[sig.Symbol] = sig
		}
	}
	return m
}

// PositionDecisionToDecisions converts PositionManager results to kernel.Decision
// slice for the existing execution pipeline.
// EXIT → close_long or close_short
// REDUCE → close_long/close_short (partial)
// SCALE → open_long/open_short
// HOLD → not included
func PositionDecisionToDecisions(pmResult PositionManagerResult, positions []PositionInfo) []Decision {
	posMap := make(map[string]PositionInfo, len(positions))
	for _, p := range positions {
		posMap[p.Symbol] = p
	}

	var out []Decision
	for sym, dec := range pmResult.Decisions {
		pos, hasPos := posMap[sym]
		if !hasPos {
			continue
		}
		switch dec.Action {
		case PositionActionExit:
			action := "close_long"
			if pos.Side == "short" {
				action = "close_short"
			}
			out = append(out, Decision{
				Symbol:    sym,
				Action:    action,
				Reasoning: fmt.Sprintf("[PM:%s] %s", dec.RuleCode, dec.Reason),
			})
		case PositionActionReduce:
			action := "close_long"
			if pos.Side == "short" {
				action = "close_short"
			}
			out = append(out, Decision{
				Symbol:    sym,
				Action:    action,
				Reasoning: fmt.Sprintf("[PM:%s] partial — %s", dec.RuleCode, dec.Reason),
			})
		case PositionActionScale:
			action := "open_long"
			if pos.Side == "short" {
				action = "open_short"
			}
			out = append(out, Decision{
				Symbol:     sym,
				Action:     action,
				Confidence: 70,
				Reasoning:  fmt.Sprintf("[PM:%s] %s", dec.RuleCode, dec.Reason),
			})
		}
		// HOLD → no decision generated
	}
	return out
}
