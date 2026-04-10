// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package coinglass

// metrics_engine.go — Stateless signal transformation engine.
//
// Converts raw Coinglass data into structured trading signals.
// All functions are pure (no state, concurrency-safe, testable).
//
// Pipeline: Raw data → 5-dimensional signals → Composite score → MarketSignals mapping

import (
	"math"
)

// ─── Raw Data Types ─────────────────────────────────────────────────────────

// RawOIData holds raw open interest data for one symbol.
type RawOIData struct {
	Symbol       string
	OIValue      float64 // current OI in USD
	OIChange1h   float64 // 1h OI change in USD
	OIChangePct  float64 // 1h OI change percentage
	OIChange24h  float64 // 24h OI change in USD
	OIChange24Pct float64
}

// RawFundingData holds raw funding rate data.
type RawFundingData struct {
	Symbol      string
	Rate        float64 // current 8h funding rate (e.g. 0.0001 = 0.01%)
	NextRate    float64 // predicted next funding rate
	AverageRate float64 // 7-day average rate
}

// RawLiquidationData holds raw liquidation data.
type RawLiquidationData struct {
	Symbol     string
	Long24h    float64 // 24h long liquidations in USD
	Short24h   float64 // 24h short liquidations in USD
	Long1h     float64 // 1h long liquidations
	Short1h    float64 // 1h short liquidations
}

// RawLongShortData holds raw long/short ratio data.
type RawLongShortData struct {
	Symbol    string
	LongRatio float64 // 0.0-1.0 (e.g. 0.65 = 65% long)
}

// RawExchangeFlowData holds raw exchange fund flow data.
type RawExchangeFlowData struct {
	Symbol   string
	Inflow   float64 // USD flowing into exchanges (selling pressure)
	Outflow  float64 // USD flowing out (accumulation signal)
	NetFlow  float64 // Inflow - Outflow (positive = net selling)
}

// CoinglassData aggregates all raw data for one symbol.
type CoinglassData struct {
	OI           *RawOIData
	Funding      *RawFundingData
	Liquidation  *RawLiquidationData
	LongShort    *RawLongShortData
	ExchangeFlow *RawExchangeFlowData
}

// ─── Signal Output Types ────────────────────────────────────────────────────

// OISignal represents the processed OI signal.
type OISignal struct {
	Direction string  // "expansion" | "contraction" | "neutral"
	Strength  float64 // 0-100
	ChangePct float64 // raw change percentage
	RuleCode  string  // signal code constant
}

// CoinglassFundingSignal represents the processed funding signal.
type CoinglassFundingSignal struct {
	Direction string  // "longs_paying" | "shorts_paying" | "neutral"
	Extreme   bool    // true if beyond extreme threshold
	Moderate  bool    // true if beyond moderate threshold
	Value     float64 // raw rate
	RuleCode  string
}

// LiquidationSignal represents the processed liquidation signal.
type LiquidationSignal struct {
	Pressure string  // "short_squeeze" | "long_squeeze" | "neutral"
	Intensity float64 // 0-100
	LongPct  float64 // percentage of liquidations that are longs
	RuleCode string
}

// LSRSignal represents the processed long/short ratio signal.
type LSRSignal struct {
	Crowded   string  // "long_crowded" | "short_crowded" | "neutral"
	LongRatio float64 // raw ratio
	RuleCode  string
}

// ExchangeFlowSignal represents the processed exchange flow signal.
type ExchangeFlowSignal struct {
	Direction string  // "inflow" | "outflow" | "neutral"
	Strength  float64 // 0-100
	NetFlow   float64 // raw net flow USD
	RuleCode  string
}

// CoinglassMetrics holds all processed signals for one symbol.
type CoinglassMetrics struct {
	Symbol       string
	OI           OISignal
	Funding      CoinglassFundingSignal
	Liquidation  LiquidationSignal
	LSR          LSRSignal
	ExchangeFlow ExchangeFlowSignal
	Composite    CompositeSignal
}

// CompositeSignal is the weighted aggregate of all sub-signals.
type CompositeSignal struct {
	BullScore float64 // 0-100 bullish conviction
	BearScore float64 // 0-100 bearish conviction
	Direction string  // "bullish" | "bearish" | "neutral"
	Dominant  string  // which sub-signal is the strongest contributor
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

// BuildCoinglassSignals converts raw data into structured signals for one symbol.
func BuildCoinglassSignals(raw CoinglassData, priceChange1h float64, cfg ThresholdsConfig) CoinglassMetrics {
	m := CoinglassMetrics{Symbol: raw.symbolName()}

	m.OI = buildOISignal(raw.OI, cfg)
	m.Funding = buildFundingSignal(raw.Funding, cfg)
	m.Liquidation = buildLiquidationSignal(raw.Liquidation, cfg)
	m.LSR = buildLSRSignal(raw.LongShort, cfg)
	m.ExchangeFlow = buildExchangeFlowSignal(raw.ExchangeFlow, cfg)
	m.Composite = buildCompositeScore(m, priceChange1h)

	return m
}

// BuildMultiSymbolMetrics processes multiple symbols.
func BuildMultiSymbolMetrics(rawMap map[string]CoinglassData, priceChanges map[string]float64, cfg ThresholdsConfig) map[string]CoinglassMetrics {
	result := make(map[string]CoinglassMetrics, len(rawMap))
	for sym, raw := range rawMap {
		pc := priceChanges[sym]
		result[sym] = BuildCoinglassSignals(raw, pc, cfg)
	}
	return result
}

func (d CoinglassData) symbolName() string {
	if d.OI != nil { return d.OI.Symbol }
	if d.Funding != nil { return d.Funding.Symbol }
	if d.Liquidation != nil { return d.Liquidation.Symbol }
	if d.LongShort != nil { return d.LongShort.Symbol }
	if d.ExchangeFlow != nil { return d.ExchangeFlow.Symbol }
	return ""
}

// ─── Sub-signal Builders ────────────────────────────────────────────────────

func buildOISignal(raw *RawOIData, cfg ThresholdsConfig) OISignal {
	if raw == nil {
		return OISignal{Direction: "neutral"}
	}
	pct := raw.OIChangePct
	if pct > cfg.OIExpansion1h {
		strength := math.Min(100, math.Abs(pct)/OIStrengthUnit*20)
		return OISignal{Direction: "expansion", Strength: strength, ChangePct: pct, RuleCode: SignalOIExpansion}
	}
	if pct < cfg.OIContraction1h {
		strength := math.Min(100, math.Abs(pct)/OIStrengthUnit*20)
		return OISignal{Direction: "contraction", Strength: strength, ChangePct: pct, RuleCode: SignalOIContraction}
	}
	return OISignal{Direction: "neutral", ChangePct: pct}
}

func buildFundingSignal(raw *RawFundingData, cfg ThresholdsConfig) CoinglassFundingSignal {
	if raw == nil {
		return CoinglassFundingSignal{Direction: "neutral"}
	}
	rate := raw.Rate
	sig := CoinglassFundingSignal{Value: rate, Direction: "neutral"}

	if rate > cfg.FundingExtremeLong {
		sig.Direction = "longs_paying"
		sig.Extreme = true
		sig.RuleCode = SignalFundingExtremeLong
	} else if rate > FundingModerateLong {
		sig.Direction = "longs_paying"
		sig.Moderate = true
		sig.RuleCode = SignalFundingModerateLong
	} else if rate < cfg.FundingExtremeShort {
		sig.Direction = "shorts_paying"
		sig.Extreme = true
		sig.RuleCode = SignalFundingExtremeShort
	} else if rate < FundingModerateShort {
		sig.Direction = "shorts_paying"
		sig.Moderate = true
		sig.RuleCode = SignalFundingModerateShort
	}
	return sig
}

func buildLiquidationSignal(raw *RawLiquidationData, cfg ThresholdsConfig) LiquidationSignal {
	if raw == nil {
		return LiquidationSignal{Pressure: "neutral"}
	}
	total := raw.Long24h + raw.Short24h
	if total <= 0 {
		return LiquidationSignal{Pressure: "neutral"}
	}

	longPct := raw.Long24h / total
	ratio := cfg.LiqSqueezeRatio
	if ratio <= 0 {
		ratio = 2.0
	}

	if raw.Long24h > raw.Short24h*ratio {
		// Longs getting liquidated much more → long squeeze (bearish for existing longs)
		intensity := math.Min(100, math.Log10(raw.Long24h/LiqIntensityLog+1)*50)
		return LiquidationSignal{Pressure: "long_squeeze", Intensity: intensity, LongPct: longPct, RuleCode: SignalLongSqueeze}
	}
	if raw.Short24h > raw.Long24h*ratio {
		// Shorts getting liquidated much more → short squeeze (bullish)
		intensity := math.Min(100, math.Log10(raw.Short24h/LiqIntensityLog+1)*50)
		return LiquidationSignal{Pressure: "short_squeeze", Intensity: intensity, LongPct: longPct, RuleCode: SignalShortSqueeze}
	}
	return LiquidationSignal{Pressure: "neutral", LongPct: longPct}
}

func buildLSRSignal(raw *RawLongShortData, cfg ThresholdsConfig) LSRSignal {
	if raw == nil {
		return LSRSignal{Crowded: "neutral"}
	}
	lr := raw.LongRatio
	if lr > cfg.LSRLongCrowded {
		return LSRSignal{Crowded: "long_crowded", LongRatio: lr, RuleCode: SignalLongCrowded}
	}
	if lr < cfg.LSRShortCrowded {
		return LSRSignal{Crowded: "short_crowded", LongRatio: lr, RuleCode: SignalShortCrowded}
	}
	return LSRSignal{Crowded: "neutral", LongRatio: lr}
}

func buildExchangeFlowSignal(raw *RawExchangeFlowData, cfg ThresholdsConfig) ExchangeFlowSignal {
	if raw == nil {
		return ExchangeFlowSignal{Direction: "neutral"}
	}
	minUSD := cfg.ExFlowMinUSD
	if minUSD <= 0 {
		minUSD = ExFlowMinUSD
	}
	net := raw.NetFlow
	if math.Abs(net) < minUSD {
		return ExchangeFlowSignal{Direction: "neutral", NetFlow: net}
	}
	strength := math.Min(100, math.Log10(math.Abs(net)/ExFlowStrengthLog+1)*60)

	if net > 0 {
		return ExchangeFlowSignal{Direction: "inflow", Strength: strength, NetFlow: net, RuleCode: SignalExFlowInflow}
	}
	return ExchangeFlowSignal{Direction: "outflow", Strength: strength, NetFlow: net, RuleCode: SignalExFlowOutflow}
}

// ─── Composite Score ────────────────────────────────────────────────────────

// Weights: OI(35%) + Funding(25%) + Liquidation(20%) + LSR(10%) + ExFlow(10%)
func buildCompositeScore(m CoinglassMetrics, priceChange1h float64) CompositeSignal {
	var bullScore, bearScore float64

	// OI (35%): expansion = bullish if price rising, contraction = bearish
	if m.OI.Direction == "expansion" {
		if priceChange1h > 0 {
			bullScore += m.OI.Strength * 0.35
		} else {
			bearScore += m.OI.Strength * 0.35
		}
	} else if m.OI.Direction == "contraction" {
		if priceChange1h < 0 {
			bearScore += m.OI.Strength * 0.35
		} else {
			bullScore += m.OI.Strength * 0.20 // weaker signal when diverging
		}
	}

	// Funding (25%): longs_paying extreme = bearish reversal risk
	if m.Funding.Extreme {
		if m.Funding.Direction == "longs_paying" {
			bearScore += 80 * 0.25
		} else if m.Funding.Direction == "shorts_paying" {
			bullScore += 80 * 0.25
		}
	} else if m.Funding.Moderate {
		if m.Funding.Direction == "longs_paying" {
			bearScore += 50 * 0.25
		} else if m.Funding.Direction == "shorts_paying" {
			bullScore += 50 * 0.25
		}
	}

	// Liquidation (20%): short_squeeze = bullish, long_squeeze = bearish
	if m.Liquidation.Pressure == "short_squeeze" {
		bullScore += m.Liquidation.Intensity * 0.20
	} else if m.Liquidation.Pressure == "long_squeeze" {
		bearScore += m.Liquidation.Intensity * 0.20
	}

	// LSR (10%): crowded long = contrarian bearish, crowded short = contrarian bullish
	if m.LSR.Crowded == "long_crowded" {
		bearScore += 60 * 0.10
	} else if m.LSR.Crowded == "short_crowded" {
		bullScore += 60 * 0.10
	}

	// Exchange flow (10%): outflow = accumulation = bullish, inflow = distribution = bearish
	if m.ExchangeFlow.Direction == "outflow" {
		bullScore += m.ExchangeFlow.Strength * 0.10
	} else if m.ExchangeFlow.Direction == "inflow" {
		bearScore += m.ExchangeFlow.Strength * 0.10
	}

	cs := CompositeSignal{BullScore: bullScore, BearScore: bearScore}

	diff := bullScore - bearScore
	if diff > 5 {
		cs.Direction = "bullish"
	} else if diff < -5 {
		cs.Direction = "bearish"
	} else {
		cs.Direction = "neutral"
	}

	// Determine dominant contributor
	maxContrib := 0.0
	type contrib struct{ name string; val float64 }
	for _, c := range []contrib{
		{"OI", m.OI.Strength * 0.35},
		{"Funding", boolToFloat(m.Funding.Extreme)*80*0.25 + boolToFloat(m.Funding.Moderate)*50*0.25},
		{"Liquidation", m.Liquidation.Intensity * 0.20},
		{"LSR", boolToFloat(m.LSR.Crowded != "neutral") * 60 * 0.10},
		{"ExchangeFlow", m.ExchangeFlow.Strength * 0.10},
	} {
		if c.val > maxContrib {
			maxContrib = c.val
			cs.Dominant = c.name
		}
	}

	return cs
}

func boolToFloat(b bool) float64 {
	if b { return 1.0 }
	return 0.0
}
