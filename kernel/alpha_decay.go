// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package kernel

// alpha_decay.go — Alpha decay detection model.
//
// Alpha decay measures the progressive weakening of the signal that originally
// justified a trade. When the original "edge" (trend + orderflow + momentum)
// starts to erode, the position should be reduced or exited — even if price
// has not yet reversed sharply.
//
// Decay is computed from six independent sub-signals:
//
//  1. Trend weakening      — EMA20 slope flattening or reversing vs EMA50
//  2. Momentum drop        — RSI14 declining from entry region
//  3. OI divergence        — OI contracting while price still at high
//  4. Volume weakening     — Volume drying up (lower conviction)
//  5. ATR compression      — Volatility collapsing (trend losing energy)
//  6. Liquidation response — Squeeze event failed to move price
//
// Each sub-signal contributes a partial score; the total DecayScore (0-100)
// drives PositionManager decisions.

import (
	"math"
	"nofx/market"
)

// ─── Config ─────────────────────────────────────────────────────────────────

// AlphaDecayWeights holds tunable sub-signal weights and severity thresholds.
// All weights should sum to ~1.0; zero values fall back to defaults.
type AlphaDecayWeights struct {
	TrendWeight       float64 // default: 0.33
	MomentumWeight    float64 // default: 0.23
	OIWeight          float64 // default: 0.18
	VolumeWeight      float64 // default: 0.09
	ATRWeight         float64 // default: 0.09
	LiqWeight         float64 // default: 0.08
	MildThreshold     float64 // default: 20
	ModerateThreshold float64 // default: 45
	SevereThreshold   float64 // default: 70
}

// DefaultAlphaDecayWeights returns the original hardcoded weights.
func DefaultAlphaDecayWeights() AlphaDecayWeights {
	return AlphaDecayWeights{
		TrendWeight:       0.33,
		MomentumWeight:    0.23,
		OIWeight:          0.18,
		VolumeWeight:      0.09,
		ATRWeight:         0.09,
		LiqWeight:         0.08,
		MildThreshold:     20,
		ModerateThreshold: 45,
		SevereThreshold:   70,
	}
}

// ─── Types ──────────────────────────────────────────────────────────────────

// AlphaDecayState describes the current health of the alpha signal for one position.
type AlphaDecayState struct {
	// Sub-signal flags
	TrendWeakening    bool
	MomentumDrop      bool
	OIDivergence      bool
	VolumeDrop        bool
	ATRCompression    bool
	LiqResponseFailed bool

	// Aggregate score: 0 = alpha fully intact, 100 = severe decay
	DecayScore float64

	// Human-readable severity: "none" | "mild" | "moderate" | "severe"
	Severity string

	// Which sub-signals fired (for logging)
	ActiveSignals []string
}

// MarketIndicators provides the raw market data needed to compute alpha decay.
// Built from market.Data + MarketSignals for a single symbol.
type MarketIndicators struct {
	Symbol string
	Side   string // "long" | "short" — position direction

	// From TimeframeSeriesData (primary timeframe)
	EMA20Values []float64         // EMA20 series (newest last)
	EMA50Values []float64         // EMA50 series (newest last)
	MACDValues  []float64         // MACD histogram (newest last)
	RSI14Values []float64         // RSI14 series (newest last)
	ATRCurrent  float64           // ATR14 on primary timeframe
	ATRHigher   float64           // ATR14 on higher timeframe (for comparison)
	Klines      []market.KlineBar // Raw OHLCV (newest last)

	// From market.Data
	PriceChange1h float64 // 1h price change %

	// From MarketSignals (kernel signals layer)
	OITrend             string // "expansion" | "contraction" | ""
	LiquidationPressure string // "short_squeeze" | "long_squeeze" | "neutral" | ""
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

// EvaluateAlphaDecay computes the decay state for a position based on current
// market indicators. Higher DecayScore = stronger decay signal.
func EvaluateAlphaDecay(ind MarketIndicators, w AlphaDecayWeights) AlphaDecayState {
	state := AlphaDecayState{}

	// 1. Trend weakening — EMA20 slope vs EMA50
	trendScore, trendFired := evalTrendWeakening(ind)
	if trendFired {
		state.TrendWeakening = true
		state.ActiveSignals = append(state.ActiveSignals, "trend_weakening")
	}

	// 2. Momentum drop — RSI14 trajectory
	momScore, momFired := evalMomentumDrop(ind)
	if momFired {
		state.MomentumDrop = true
		state.ActiveSignals = append(state.ActiveSignals, "momentum_drop")
	}

	// 3. OI divergence — OI direction vs position direction
	oiScore, oiFired := evalOIDivergence(ind)
	if oiFired {
		state.OIDivergence = true
		state.ActiveSignals = append(state.ActiveSignals, "oi_divergence")
	}

	// 4. Volume weakening — recent volume vs average
	volScore, volFired := evalVolumeDrop(ind)
	if volFired {
		state.VolumeDrop = true
		state.ActiveSignals = append(state.ActiveSignals, "volume_drop")
	}

	// 5. ATR compression — current ATR vs higher-TF ATR
	atrScore, atrFired := evalATRCompression(ind)
	if atrFired {
		state.ATRCompression = true
		state.ActiveSignals = append(state.ActiveSignals, "atr_compression")
	}

	// 6. Liquidation response — squeeze did not move price as expected
	liqScore, liqFired := evalLiquidationResponse(ind)
	if liqFired {
		state.LiqResponseFailed = true
		state.ActiveSignals = append(state.ActiveSignals, "liq_response_failed")
	}

	// Weighted aggregate
	state.DecayScore = math.Min(100,
		trendScore*w.TrendWeight+
			momScore*w.MomentumWeight+
			oiScore*w.OIWeight+
			volScore*w.VolumeWeight+
			atrScore*w.ATRWeight+
			liqScore*w.LiqWeight,
	)

	// Classify severity
	switch {
	case state.DecayScore >= w.SevereThreshold:
		state.Severity = "severe"
	case state.DecayScore >= w.ModerateThreshold:
		state.Severity = "moderate"
	case state.DecayScore >= w.MildThreshold:
		state.Severity = "mild"
	default:
		state.Severity = "none"
	}

	return state
}

// ─── Sub-signal evaluators ──────────────────────────────────────────────────

// evalTrendWeakening: long decay when EMA20 slope turns negative or crosses below EMA50.
func evalTrendWeakening(ind MarketIndicators) (score float64, fired bool) {
	if len(ind.EMA20Values) < 3 || len(ind.EMA50Values) < 1 {
		return 0, false
	}
	n := len(ind.EMA20Values)
	ema20Cur := ind.EMA20Values[n-1]
	ema20Prev := ind.EMA20Values[n-2]
	ema50Cur := ind.EMA50Values[len(ind.EMA50Values)-1]
	slope := ema20Cur - ema20Prev

	if ind.Side == "long" {
		if ema20Cur < ema50Cur { // death cross
			return 100, true
		}
		if slope < 0 {
			slopePct := math.Abs(slope) / math.Max(ema20Cur, 1) * 100
			s := math.Min(100, slopePct*500)
			return s, s >= 20
		}
	} else if ind.Side == "short" {
		if ema20Cur > ema50Cur { // golden cross
			return 100, true
		}
		if slope > 0 {
			slopePct := math.Abs(slope) / math.Max(ema20Cur, 1) * 100
			s := math.Min(100, slopePct*500)
			return s, s >= 20
		}
	}
	return 0, false
}

// evalMomentumDrop: for longs, decay when RSI14 falling; for shorts, when rising.
func evalMomentumDrop(ind MarketIndicators) (score float64, fired bool) {
	if len(ind.RSI14Values) < 3 {
		return 0, false
	}
	n := len(ind.RSI14Values)
	rsiCur := ind.RSI14Values[n-1]
	rsiPrev := ind.RSI14Values[n-3] // 3-bar trend
	rsiSlope := rsiCur - rsiPrev

	if ind.Side == "long" {
		if rsiCur < 45 && rsiSlope < 0 {
			s := math.Min(100, math.Abs(rsiSlope)*3)
			return s, s >= 15
		}
		if rsiCur > 60 && rsiSlope < -5 {
			s := math.Min(100, math.Abs(rsiSlope)*2)
			return s, s >= 20
		}
	} else if ind.Side == "short" {
		if rsiCur > 55 && rsiSlope > 0 {
			s := math.Min(100, rsiSlope*3)
			return s, s >= 15
		}
		if rsiCur < 40 && rsiSlope > 5 {
			s := math.Min(100, rsiSlope*2)
			return s, s >= 20
		}
	}
	return 0, false
}

// evalOIDivergence: OI moving against the position's direction.
func evalOIDivergence(ind MarketIndicators) (score float64, fired bool) {
	if ind.OITrend == "" {
		return 0, false
	}
	priceUp := ind.PriceChange1h > 0
	oiExpanding := ind.OITrend == "expansion"

	if ind.Side == "long" {
		if priceUp && !oiExpanding {
			return 60, true // price up but OI shrinking — weak conviction
		}
		if !priceUp && oiExpanding {
			return 85, true // price down but OI expanding — shorts building
		}
	} else if ind.Side == "short" {
		if !priceUp && !oiExpanding {
			return 60, true
		}
		if priceUp && oiExpanding {
			return 85, true
		}
	}
	return 0, false
}

// evalVolumeDrop: volume drying up relative to recent average.
func evalVolumeDrop(ind MarketIndicators) (score float64, fired bool) {
	if len(ind.Klines) < 10 {
		return 0, false
	}
	n := len(ind.Klines)
	window := 20
	if n < window {
		window = n
	}
	var sum float64
	for i := n - window; i < n; i++ {
		sum += ind.Klines[i].Volume
	}
	avgVol := sum / float64(window)
	if avgVol <= 0 {
		return 0, false
	}
	lastVol := ind.Klines[n-1].Volume
	ratio := lastVol / avgVol
	if ratio < 0.5 {
		s := math.Min(100, (1-ratio)*100)
		return s, true
	}
	return 0, false
}

// evalATRCompression: volatility collapsing on the primary timeframe.
func evalATRCompression(ind MarketIndicators) (score float64, fired bool) {
	if ind.ATRCurrent <= 0 || ind.ATRHigher <= 0 {
		return 0, false
	}
	ratio := ind.ATRCurrent / ind.ATRHigher
	if ratio < 0.6 {
		s := math.Min(100, (1-ratio)*150)
		return s, true
	}
	return 0, false
}

// evalLiquidationResponse: squeeze event failed to produce expected price movement.
func evalLiquidationResponse(ind MarketIndicators) (score float64, fired bool) {
	if ind.LiquidationPressure == "" || ind.LiquidationPressure == "neutral" {
		return 0, false
	}
	const minMove = 0.5 // 0.5% minimum expected move

	if ind.LiquidationPressure == "short_squeeze" && ind.Side == "long" {
		if ind.PriceChange1h < minMove {
			return 25, true
		}
	}
	if ind.LiquidationPressure == "long_squeeze" && ind.Side == "short" {
		if ind.PriceChange1h > -minMove {
			return 25, true
		}
	}
	return 0, false
}

// ─── Builder ────────────────────────────────────────────────────────────────

// BuildMarketIndicators assembles MarketIndicators from pipeline live data.
func BuildMarketIndicators(pos PositionInfo, md *market.Data, signals *MarketSignals, primaryTF string) MarketIndicators {
	ind := MarketIndicators{
		Symbol: pos.Symbol,
		Side:   pos.Side,
	}
	if md != nil {
		ind.PriceChange1h = md.PriceChange1h
		if tfData, ok := md.TimeframeData[primaryTF]; ok && tfData != nil {
			ind.EMA20Values = tfData.EMA20Values
			ind.EMA50Values = tfData.EMA50Values
			ind.MACDValues = tfData.MACDValues
			ind.RSI14Values = tfData.RSI14Values
			ind.ATRCurrent = tfData.ATR14
			ind.Klines = tfData.Klines
		}
		htf := HigherTimeframe(primaryTF)
		if htfData, ok := md.TimeframeData[htf]; ok && htfData != nil {
			ind.ATRHigher = htfData.ATR14
		}
	}
	if signals != nil {
		ind.OITrend = signals.OITrend[pos.Symbol]
		ind.LiquidationPressure = signals.LiquidationPressure[pos.Symbol]
	}
	return ind
}
