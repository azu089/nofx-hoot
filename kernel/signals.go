package kernel

// signals.go — Structured market signal types.
//
// These types live in kernel so that both the data layer (which populates
// signals from exchange/Coinglass data) and the filter/manager engines can
// use them without circular imports.

import "nofx/market"

// MarketSignals is the semantic signal layer derived from raw market data.
type MarketSignals struct {
	// Funding rate signal per symbol
	FundingExtreme map[string]FundingSignal `json:"funding_extreme"`
	// Long/short crowding flags per symbol
	LongCrowded  map[string]bool `json:"long_crowded"`
	ShortCrowded map[string]bool `json:"short_crowded"`
	// OI trend: "expansion" | "contraction" | "neutral"
	OITrend map[string]string `json:"oi_trend"`
	// Liquidation pressure: "short_squeeze" | "long_squeeze" | "neutral"
	LiquidationPressure map[string]string `json:"liquidation_pressure"`
	// Aggressive flow dominance: "buyers_dominant" | "sellers_dominant" | "neutral"
	AggressiveFlow map[string]string `json:"aggressive_flow"`
	// Raw values for filter logic and prompt generation
	FundingRates   map[string]float64 `json:"funding_rates"`
	LongRatios     map[string]float64 `json:"long_ratios"`
	OIChangeRatios map[string]float64 `json:"oi_change_ratios"`
	// Market regime per symbol (from regime_detector)
	Regime map[string]market.MarketRegime `json:"regime"`
}

// FundingSignal categorises a funding rate reading.
type FundingSignal struct {
	Value     float64 `json:"value"`
	Extreme   bool    `json:"extreme"`
	Direction string  `json:"direction"` // "longs_paying" | "shorts_paying"
}

// NewMarketSignals returns an empty MarketSignals with all maps initialised.
func NewMarketSignals() *MarketSignals {
	return &MarketSignals{
		FundingExtreme:      make(map[string]FundingSignal),
		LongCrowded:         make(map[string]bool),
		ShortCrowded:        make(map[string]bool),
		OITrend:             make(map[string]string),
		LiquidationPressure: make(map[string]string),
		AggressiveFlow:      make(map[string]string),
		FundingRates:        make(map[string]float64),
		LongRatios:          make(map[string]float64),
		OIChangeRatios:      make(map[string]float64),
		Regime:              make(map[string]market.MarketRegime),
	}
}
