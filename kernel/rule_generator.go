package kernel

// rule_generator.go — Pure rule-based candidate generator.
//
// Complements the AI generator by producing conservative, high-certainty
// candidates based solely on objective signals. Only generates a candidate
// when ALL required conditions are met ("belt-and-suspenders").
//
// Current rules:
//   R1  Trend + OI expansion (EMA trend + OI expanding + safe crowding + no extreme funding)
//   R2  Squeeze confirmation (liquidation spike + taker flow + price momentum)

import (
	"nofx/logger"
	"nofx/market"
)

// GenerateCandidatesFromRules produces up to 1 conservative candidate per symbol.
// Returns empty slice when conditions are not met.
func GenerateCandidatesFromRules(
	signals *MarketSignals,
	mdMap map[string]*market.Data,
) []CandidateDecision {
	if signals == nil {
		return nil
	}

	var candidates []CandidateDecision

	for sym, md := range mdMap {
		if md == nil || md.CurrentPrice <= 0 {
			continue
		}

		if c := ruleTrendOIExpansion(sym, md, signals); c != nil {
			candidates = append(candidates, *c)
			logger.Infof("📐 [RuleGen] R1 candidate: %s %s conf=%d", c.Symbol, c.Action, c.Confidence)
		}

		if c := ruleSqueezeConfirmation(sym, md, signals); c != nil {
			candidates = append(candidates, *c)
			logger.Infof("📐 [RuleGen] R2 candidate: %s %s conf=%d", c.Symbol, c.Action, c.Confidence)
		}
	}

	logger.Infof("📐 [RuleGen] Generated %d rule candidates", len(candidates))
	return candidates
}

// ─── R1: Trend + OI Expansion ───────────────────────────────────────────────

// ruleTrendOIExpansion generates a candidate when:
//   - EMA20 > EMA50 on 1h (long) or EMA20 < EMA50 (short)
//   - OI trend = expansion
//   - Funding rate is NOT extreme in proposed direction
//   - Long ratio is in safe zone (32-70%)
//   - RSI in reasonable range
func ruleTrendOIExpansion(sym string, md *market.Data, signals *MarketSignals) *CandidateDecision {
	// Require 1h timeframe data
	tf1h, ok := md.TimeframeData["1h"]
	if !ok || tf1h == nil || len(tf1h.EMA20Values) == 0 || len(tf1h.EMA50Values) == 0 {
		return nil
	}

	ema20 := tf1h.EMA20Values[len(tf1h.EMA20Values)-1]
	ema50 := tf1h.EMA50Values[len(tf1h.EMA50Values)-1]
	if ema20 == 0 || ema50 == 0 {
		return nil
	}

	// OI must be expanding
	if signals.OITrend[sym] != "expansion" {
		return nil
	}

	// Long ratio must be in safe zone
	lr, hasLR := signals.LongRatios[sym]
	if hasLR && (lr > 0.70 || lr < 0.32) {
		return nil
	}

	// Determine direction (require clear EMA separation)
	isLong := ema20 > ema50*1.002
	isShort := ema50 > ema20*1.002
	if !isLong && !isShort {
		return nil
	}

	// Verify funding not extreme in proposed direction
	if sig, ok := signals.FundingExtreme[sym]; ok {
		if isLong && sig.Extreme && sig.Direction == "longs_paying" {
			return nil
		}
		if isShort && sig.Extreme && sig.Direction == "shorts_paying" {
			return nil
		}
	}

	// RSI sanity check
	if len(tf1h.RSI14Values) > 0 {
		rsi := tf1h.RSI14Values[len(tf1h.RSI14Values)-1]
		if isLong && (rsi > 72 || rsi < 35) {
			return nil
		}
		if isShort && (rsi < 28 || rsi > 65) {
			return nil
		}
	}

	action := "open_long"
	if isShort {
		action = "open_short"
	}

	sl, tp := estimateSlTp(md, action)

	signalsUsed := []string{"ema_trend_1h", "oi_expansion"}
	if hasLR {
		signalsUsed = append(signalsUsed, "long_ratio_safe")
	}

	return &CandidateDecision{
		Action:     action,
		Symbol:     sym,
		Leverage:   3,
		StopLoss:   sl,
		TakeProfit: tp,
		Confidence: 72,
		Tags:       []string{TagTrendFollow, TagOIExpansion, TagRuleGen},
		Source:     "rule",
		ReasonStruct: CandidateReason{
			SignalsUsed:  signalsUsed,
			Why:          "Rule R1: EMA trend + OI expansion + safe long ratio + no extreme funding",
			Invalidation: "OI turns contraction OR funding becomes extreme OR long ratio crosses threshold",
		},
		ScoreBreakdown: make(map[string]float64),
	}
}

// ─── R2: Squeeze Confirmation ───────────────────────────────────────────────

// ruleSqueezeConfirmation generates a candidate when liquidation pressure
// and taker flow both confirm a squeeze direction.
func ruleSqueezeConfirmation(sym string, md *market.Data, signals *MarketSignals) *CandidateDecision {
	liq, hasLiq := signals.LiquidationPressure[sym]
	flow, hasFlow := signals.AggressiveFlow[sym]
	if !hasLiq || !hasFlow {
		return nil
	}

	var action, squeezeType string

	if liq == "short_squeeze" && flow == "buyers_dominant" {
		action = "open_long"
		squeezeType = "short_squeeze"
	} else if liq == "long_squeeze" && flow == "sellers_dominant" {
		action = "open_short"
		squeezeType = "long_squeeze"
	} else {
		return nil
	}

	// Price must be moving in squeeze direction
	if action == "open_long" && md.PriceChange1h < 0 {
		return nil
	}
	if action == "open_short" && md.PriceChange1h > 0 {
		return nil
	}

	sl, tp := estimateSlTp(md, action)

	return &CandidateDecision{
		Action:     action,
		Symbol:     sym,
		Leverage:   3,
		StopLoss:   sl,
		TakeProfit: tp,
		Confidence: 68,
		Tags:       []string{TagSqueeze, TagRuleGen},
		Source:     "rule",
		ReasonStruct: CandidateReason{
			SignalsUsed:  []string{"liquidation_pressure", "taker_flow"},
			Why:          "Rule R2: " + squeezeType + " + taker flow confirms direction",
			Invalidation: "Liquidation pressure neutralises OR flow reverses",
		},
		ScoreBreakdown: make(map[string]float64),
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// estimateSlTp uses ATR to produce basic stop-loss and take-profit levels.
func estimateSlTp(md *market.Data, action string) (sl, tp float64) {
	price := md.CurrentPrice
	if price <= 0 {
		return 0, 0
	}

	// Try 1h ATR, fall back to intraday ATR, then 1.5% of price
	atr := 0.0
	if tf1h, ok := md.TimeframeData["1h"]; ok && tf1h != nil && tf1h.ATR14 > 0 {
		atr = tf1h.ATR14
	} else if md.IntradaySeries != nil && md.IntradaySeries.ATR14 > 0 {
		atr = md.IntradaySeries.ATR14
	}
	if atr <= 0 {
		atr = price * 0.015
	}

	// SL = 1.5 ATR, TP = 3 ATR (R:R = 2:1)
	if action == "open_long" {
		sl = price - 1.5*atr
		tp = price + 3.0*atr
	} else if action == "open_short" {
		sl = price + 1.5*atr
		tp = price - 3.0*atr
	}
	return
}
