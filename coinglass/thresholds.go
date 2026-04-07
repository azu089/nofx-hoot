package coinglass

// thresholds.go — Unified threshold constants for Coinglass signal classification.
// Eliminates magic numbers across the signal pipeline.

// ─── Funding Rate Thresholds ────────────────────────────────────────────────

const (
	// Extreme: market very crowded, high reversal risk
	FundingExtremeLong  = 0.001   // +0.1%/8h — longs paying heavily
	FundingExtremeShort = -0.0005 // -0.05%/8h — shorts paying heavily

	// Moderate: notable crowding, caution warranted
	FundingModerateLong  = 0.0005 // +0.05%/8h
	FundingModerateShort = -0.0003

	// Mild: slight crowding, informational only
	FundingMildLong  = 0.0002
	FundingMildShort = -0.0001
)

// ─── OI (Open Interest) Thresholds ──────────────────────────────────────────

const (
	// OI change percentage thresholds (1h window)
	OIExpansion1h   = 5.0  // >5% OI increase = expansion
	OIContraction1h = -5.0 // <-5% OI decrease = contraction

	// OI strength unit: % change per unit of signal strength
	OIStrengthUnit = 2.0

	// OI acceleration threshold (change-of-change)
	OIAccelThreshold = 1.5
)

// ─── Liquidation Thresholds ─────────────────────────────────────────────────

const (
	// Squeeze detection: one-side liq > threshold × other-side
	LiqLongSqueezeThreshold  = 2.0 // longs liquidated 2x > shorts = long squeeze
	LiqShortSqueezeThreshold = 2.0 // shorts liquidated 2x > longs = short squeeze

	// Intensity scaling (log base for normalization)
	LiqIntensityLog = 10.0

	// Minimum price move to confirm squeeze response
	LiqResponseMinMove = 0.5 // 0.5% minimum price move
)

// ─── Long/Short Ratio Thresholds ────────────────────────────────────────────

const (
	// Crowding: extreme directional positioning
	LSRLongCrowded  = 0.70 // >70% long = crowded long
	LSRShortCrowded = 0.30 // <30% long (>70% short) = crowded short

	// Trend threshold: mild directional bias
	LSRTrendThreshold = 0.55
)

// ─── Exchange Fund Flow Thresholds ──────────────────────────────────────────

const (
	// Minimum USD flow to be considered significant
	ExFlowMinUSD = 1_000_000.0 // $1M

	// Log base for strength normalization
	ExFlowStrengthLog = 10_000_000.0 // $10M
)

// ─── Signal Code Constants ──────────────────────────────────────────────────

const (
	SignalFundingExtremeLong  = "funding_extreme_long"
	SignalFundingExtremeShort = "funding_extreme_short"
	SignalFundingModerateLong = "funding_moderate_long"
	SignalFundingModerateShort = "funding_moderate_short"
	SignalLongCrowded         = "long_crowded"
	SignalShortCrowded        = "short_crowded"
	SignalOIExpansion         = "oi_expansion"
	SignalOIContraction       = "oi_contraction"
	SignalLongSqueeze         = "long_squeeze"
	SignalShortSqueeze        = "short_squeeze"
	SignalExFlowInflow        = "exchange_inflow"
	SignalExFlowOutflow       = "exchange_outflow"
)

// ─── ThresholdsConfig ───────────────────────────────────────────────────────

// ThresholdsConfig allows overriding default thresholds.
type ThresholdsConfig struct {
	FundingExtremeLong  float64
	FundingExtremeShort float64
	LSRLongCrowded      float64
	LSRShortCrowded     float64
	OIExpansion1h       float64
	OIContraction1h     float64
	LiqSqueezeRatio     float64
	ExFlowMinUSD        float64
}

// DefaultThresholdsConfig returns the default thresholds.
func DefaultThresholdsConfig() ThresholdsConfig {
	return ThresholdsConfig{
		FundingExtremeLong:  FundingExtremeLong,
		FundingExtremeShort: FundingExtremeShort,
		LSRLongCrowded:      LSRLongCrowded,
		LSRShortCrowded:     LSRShortCrowded,
		OIExpansion1h:       OIExpansion1h,
		OIContraction1h:     OIContraction1h,
		LiqSqueezeRatio:     LiqShortSqueezeThreshold,
		ExFlowMinUSD:        ExFlowMinUSD,
	}
}
