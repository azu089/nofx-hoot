package coinglass

// to_signals.go — Bridge: CoinglassMetrics → kernel.MarketSignals.
//
// Populates a kernel.MarketSignals struct from Coinglass metrics output.
// This bridges the coinglass signal engine to the kernel Gatekeeper pipeline.

import "nofx/kernel"

// PopulateMarketSignals fills a MarketSignals struct from Coinglass metrics.
// The signals argument must be non-nil (use kernel.NewMarketSignals()).
// Existing entries are overwritten; entries for symbols not in metricsMap are untouched.
func PopulateMarketSignals(signals *kernel.MarketSignals, metricsMap map[string]CoinglassMetrics) {
	if signals == nil {
		return
	}

	for sym, m := range metricsMap {
		// OI trend → signals.OITrend
		if m.OI.Direction != "" && m.OI.Direction != "neutral" {
			signals.OITrend[sym] = m.OI.Direction
		}

		// Funding → signals.FundingExtreme + signals.FundingRates
		signals.FundingRates[sym] = m.Funding.Value
		if m.Funding.Extreme || m.Funding.Moderate {
			signals.FundingExtreme[sym] = kernel.FundingSignal{
				Value:     m.Funding.Value,
				Extreme:   m.Funding.Extreme,
				Direction: m.Funding.Direction,
			}
		}

		// Liquidation → signals.LiquidationPressure
		if m.Liquidation.Pressure != "" && m.Liquidation.Pressure != "neutral" {
			signals.LiquidationPressure[sym] = m.Liquidation.Pressure
		}

		// Long/Short ratio → signals.LongRatios + signals.LongCrowded/ShortCrowded
		if m.LSR.LongRatio > 0 {
			signals.LongRatios[sym] = m.LSR.LongRatio
		}
		if m.LSR.Crowded == "long_crowded" {
			signals.LongCrowded[sym] = true
		} else if m.LSR.Crowded == "short_crowded" {
			signals.ShortCrowded[sym] = true
		}

		// Exchange flow → signals.AggressiveFlow (mapped from flow direction)
		if m.ExchangeFlow.Direction == "outflow" {
			signals.AggressiveFlow[sym] = "buyers_dominant"
		} else if m.ExchangeFlow.Direction == "inflow" {
			signals.AggressiveFlow[sym] = "sellers_dominant"
		}

		// OI change percentage → signals.OIChangeRatios
		if m.OI.ChangePct != 0 {
			signals.OIChangeRatios[sym] = m.OI.ChangePct
		}
	}
}

// BuildMarketSignals creates a new MarketSignals from Coinglass metrics (convenience).
func BuildMarketSignals(metricsMap map[string]CoinglassMetrics) *kernel.MarketSignals {
	signals := kernel.NewMarketSignals()
	PopulateMarketSignals(signals, metricsMap)
	return signals
}
