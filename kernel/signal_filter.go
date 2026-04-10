package kernel

// signal_filter.go — Signal resonance filter for trade proposals.
//
// Sits between AI decision output and trade execution.
// Applies structured market signal checks to reject low-quality setups.
//
// Filter rules (evaluated in order, first failure rejects):
//   1. Funding rate crowding — extreme funding in the same direction blocks entry
//   2. Long/short ratio crowding — overcrowded side blocks entry
//   3. OI divergence — price vs OI direction mismatch blocks entry
//   4. Signal resonance — must satisfy N of 3 confirming signals
//
// Mode behavior:
//   aggressive  → all filters skipped
//   balanced    → 2/3 resonance required (relaxed to 1/3 if tech trend aligns)
//   high_win_rate → 3/3 resonance required, no relaxation

import (
	"fmt"
)

// FilterVerdict describes whether a trade proposal passed signal checks.
type FilterVerdict struct {
	Allowed        bool
	RejectReason   string
	ReduceLeverage bool   // suggest lower leverage (crowded but not blocked)
	MaxLeverage    int    // capped leverage when ReduceLeverage is true
	ResonanceScore int    // positive signals satisfied (0-3)
	Details        string // debug info
}

// CheckSignalResonance evaluates a proposed trade against structured market signals.
//
// Parameters:
//   - d: the AI-generated Decision (action, symbol, leverage, etc.)
//   - signals: structured Coinglass market signals (may be nil → pass)
//   - priceChange1h: 1h price change ratio (positive=up, negative=down)
//   - mode: strategy mode string ("aggressive"|"balanced"|"high_win_rate"|"institutional")
func CheckSignalResonance(
	d Decision,
	signals *MarketSignals,
	priceChange1h float64,
	mode string,
) FilterVerdict {
	// Aggressive mode: skip all filters — full AI discretion
	if mode == "aggressive" {
		return FilterVerdict{Allowed: true, Details: "full_mandate: filters disabled"}
	}

	// Institutional mode: signal filtering deferred to candidate scoring engine
	if mode == "institutional" {
		return FilterVerdict{Allowed: true, Details: "rules_engine: signal filter deferred to scoring pipeline"}
	}

	// No signals available → pass (cannot filter without data)
	if signals == nil {
		return FilterVerdict{Allowed: true, Details: "no market signals available, filter skipped"}
	}

	// Only filter open-position actions
	isOpenLong := d.Action == "open_long" || d.Action == "OPEN_NEW" || d.Action == "ADD_POSITION"
	isOpenShort := d.Action == "open_short"
	if !isOpenLong && !isOpenShort {
		return FilterVerdict{Allowed: true, Details: "non-open action, no filter applied"}
	}

	sym := d.Symbol
	details := fmt.Sprintf("[%s %s] ", sym, d.Action)

	// ── Rule 1: Funding rate crowding ──────────────────────────────────────
	if sig, ok := signals.FundingExtreme[sym]; ok {
		if isOpenLong && sig.Extreme && sig.Direction == "longs_paying" {
			return FilterVerdict{
				RejectReason: fmt.Sprintf("funding crowding: longs paying extreme (%.4f%%/8h)", sig.Value*100),
			}
		}
		if isOpenShort && sig.Extreme && sig.Direction == "shorts_paying" {
			return FilterVerdict{
				RejectReason: fmt.Sprintf("funding crowding: shorts paying extreme (%.4f%%/8h)", sig.Value*100),
			}
		}
		details += fmt.Sprintf("funding=%.4f%% ", sig.Value*100)
	}

	// ── Rule 2: Long/short ratio crowding ─────────────────────────────────
	if crowded, ok := signals.LongCrowded[sym]; ok && crowded && isOpenLong {
		lr := signals.LongRatios[sym]
		return FilterVerdict{
			RejectReason: fmt.Sprintf("long ratio overcrowded (%.1f%% long)", lr*100),
		}
	}
	if crowded, ok := signals.ShortCrowded[sym]; ok && crowded && isOpenShort {
		lr := signals.LongRatios[sym]
		return FilterVerdict{
			RejectReason: fmt.Sprintf("short ratio overcrowded (%.1f%% short)", (1-lr)*100),
		}
	}

	// ── Rule 3: OI divergence ─────────────────────────────────────────────
	// Price up + OI contracting → shorts covering, not genuine demand → block long
	// Price down + OI contracting → long liquidation, may reverse → block short
	oiTrend, hasOI := signals.OITrend[sym]
	oiChange, hasOIChange := signals.OIChangeRatios[sym]
	if hasOI && hasOIChange {
		if isOpenLong && priceChange1h > 0.005 && oiTrend == "contraction" {
			return FilterVerdict{
				RejectReason: fmt.Sprintf("OI divergence: price +%.2f%% but OI contracting (%.2f%%)", priceChange1h*100, oiChange*100),
			}
		}
		if isOpenShort && priceChange1h < -0.005 && oiTrend == "contraction" {
			return FilterVerdict{
				RejectReason: fmt.Sprintf("OI divergence: price %.2f%% but OI contracting (%.2f%%)", priceChange1h*100, oiChange*100),
			}
		}
		details += fmt.Sprintf("OI=%s(%.2f%%) ", oiTrend, oiChange*100)
	}

	// ── Rule 4: Signal resonance ──────────────────────────────────────────
	// Three independent signals: tech trend, OI expansion, funding not extreme
	score := 0
	scoreInfo := ""

	// Signal A: Technical trend aligns with proposed direction
	techAligned := (isOpenLong && priceChange1h > 0) || (isOpenShort && priceChange1h < 0)
	if techAligned {
		score++
		scoreInfo += "tech✓ "
	} else {
		scoreInfo += "tech✗ "
	}

	// Signal B: OI expanding (genuine new interest)
	if hasOI && oiTrend == "expansion" {
		score++
		scoreInfo += "OI✓ "
	} else {
		scoreInfo += "OI✗ "
	}

	// Signal C: Funding rate not extreme (no crowding pressure)
	fundingOK := true
	if sig, ok := signals.FundingExtreme[sym]; ok && sig.Extreme {
		fundingOK = false
	}
	if fundingOK {
		score++
		scoreInfo += "fund✓ "
	} else {
		scoreInfo += "fund✗ "
	}

	details += fmt.Sprintf("| resonance: %s(%d/3)", scoreInfo, score)

	// Determine required resonance threshold by mode
	required := 2 // balanced default
	if mode == "high_win_rate" {
		required = 3
	}

	// Balanced relaxation: if tech trend aligns, lower bar to 1/3
	// This prevents total shutdown during extreme market conditions
	// (e.g., funding rates elevated across all pairs, OI broadly shrinking)
	if score < required && mode == "balanced" && techAligned {
		required = 1
	}

	if score < required {
		return FilterVerdict{
			RejectReason:   fmt.Sprintf("insufficient resonance: %d/%d required (%s)", score, required, scoreInfo),
			ResonanceScore: score,
			Details:        details,
		}
	}

	// ── Crowded-but-allowed: suggest leverage reduction ────────────────────
	reduceLev := false
	maxLev := d.Leverage
	if lr, ok := signals.LongRatios[sym]; ok {
		approaching := (isOpenLong && lr > 0.65) || (isOpenShort && lr < 0.35)
		if approaching {
			reduceLev = true
			maxLev = 5
			if d.Leverage <= maxLev {
				reduceLev = false
			}
		}
	}

	return FilterVerdict{
		Allowed:        true,
		ResonanceScore: score,
		ReduceLeverage: reduceLev,
		MaxLeverage:    maxLev,
		Details:        details,
	}
}

// ApplyFilterVerdict modifies the Decision in-place if leverage reduction is suggested.
// Returns rejection reason (empty string if allowed).
func ApplyFilterVerdict(d *Decision, v FilterVerdict) string {
	if !v.Allowed {
		return v.RejectReason
	}
	if v.ReduceLeverage && v.MaxLeverage > 0 && d.Leverage > v.MaxLeverage {
		d.Leverage = v.MaxLeverage
	}
	return ""
}
