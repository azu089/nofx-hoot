package market

// regime_detector.go — Market regime detector.
//
// Identifies the current structural market state for strategy orchestration.
//
// Supported regimes:
//   TRENDING        — Directional trend (steep EMA slope + ATR expansion + volume up)
//   RANGING         — Sideways consolidation (flat EMA + low ATR + tight price range)
//   HIGH_VOLATILITY — Extreme volatility (ATR explosion + large price swings)
//   LOW_LIQUIDITY   — Thin market (volume crash + wide spreads + unreliable signals)

import "math"

// ─── MarketRegime ───────────────────────────────────────────────────────────

// MarketRegime represents the current market structural state.
type MarketRegime string

const (
	RegimeTrending       MarketRegime = "TRENDING"
	RegimeRanging        MarketRegime = "RANGING"
	RegimeHighVolatility MarketRegime = "HIGH_VOLATILITY"
	RegimeLowLiquidity   MarketRegime = "LOW_LIQUIDITY"
)

// ─── RegimeSignals ──────────────────────────────────────────────────────────

// RegimeSignals records sub-signal details for logging and debugging.
type RegimeSignals struct {
	ATRExpansion    bool    // ATR above historical average
	ATRExtreme      bool    // ATR > 2x average (extreme)
	EMASlopeStrong  bool    // EMA20 slope steep enough for trend
	VolumeExpansion bool    // Recent volume above average
	VolumeCrash     bool    // Volume extremely low (<30% average)
	PriceSwing      float64 // Recent price swing magnitude (%)

	// Per-regime confidence scores (0-100); highest wins
	RegimeScore map[MarketRegime]float64

	// Primary timeframe used for detection
	PrimaryTF string
}

// ─── DetectMarketRegime ─────────────────────────────────────────────────────

// DetectMarketRegime identifies the current market regime from a single symbol's data.
// Uses primaryTF timeframe data, falls back to other available timeframes.
func DetectMarketRegime(md *Data, primaryTF string) (MarketRegime, RegimeSignals) {
	signals := RegimeSignals{
		RegimeScore: map[MarketRegime]float64{
			RegimeTrending:       0,
			RegimeRanging:        0,
			RegimeHighVolatility: 0,
			RegimeLowLiquidity:   0,
		},
		PrimaryTF: primaryTF,
	}

	if md == nil {
		return RegimeRanging, signals
	}

	// Select best available timeframe data
	var tfData *TimeframeSeriesData
	for _, tf := range []string{primaryTF, "1h", "4h", "15m"} {
		if d, ok := md.TimeframeData[tf]; ok && d != nil {
			tfData = d
			signals.PrimaryTF = tf
			break
		}
	}
	if tfData == nil {
		return RegimeRanging, signals
	}

	// ── Sub-signal 1: ATR expansion / extreme ───────────────────────────
	atrScore, atrExtreme := evalATRRegime(md, tfData)
	signals.ATRExpansion = atrScore > 0
	signals.ATRExtreme = atrExtreme

	// ── Sub-signal 2: EMA slope (trend strength) ────────────────────────
	slopeScore := evalEMASlope(tfData)
	signals.EMASlopeStrong = slopeScore > 30

	// ── Sub-signal 3: Volume state ──────────────────────────────────────
	volExpScore, volCrashScore := evalVolumeRegime(tfData)
	signals.VolumeExpansion = volExpScore > 20
	signals.VolumeCrash = volCrashScore > 60

	// ── Sub-signal 4: Price swing magnitude ─────────────────────────────
	signals.PriceSwing = math.Abs(md.PriceChange1h)

	// ── Score synthesis ─────────────────────────────────────────────────

	// HIGH_VOLATILITY: extreme ATR + large price swings
	if atrExtreme {
		signals.RegimeScore[RegimeHighVolatility] += 60
	}
	if signals.PriceSwing > 3.0 { // >3% in 1h
		signals.RegimeScore[RegimeHighVolatility] += math.Min(40, signals.PriceSwing*8)
	}

	// LOW_LIQUIDITY: extreme volume crash
	if signals.VolumeCrash {
		signals.RegimeScore[RegimeLowLiquidity] += volCrashScore
	}

	// TRENDING: steep EMA slope + ATR expansion (non-extreme) + volume up
	if signals.EMASlopeStrong && !atrExtreme {
		signals.RegimeScore[RegimeTrending] += slopeScore
	}
	if signals.ATRExpansion && !atrExtreme {
		signals.RegimeScore[RegimeTrending] += atrScore * 0.5
	}
	if signals.VolumeExpansion {
		signals.RegimeScore[RegimeTrending] += volExpScore * 0.4
	}

	// RANGING: flat EMA + low ATR + small price swings
	if !signals.EMASlopeStrong {
		signals.RegimeScore[RegimeRanging] += 40
	}
	if !signals.ATRExpansion && !atrExtreme {
		signals.RegimeScore[RegimeRanging] += 30
	}
	if signals.PriceSwing < 1.0 {
		signals.RegimeScore[RegimeRanging] += 20
	}

	// ── Select highest-scoring regime ───────────────────────────────────
	best := RegimeRanging
	bestScore := 0.0
	for regime, score := range signals.RegimeScore {
		if score > bestScore {
			bestScore = score
			best = regime
		}
	}

	// Fall back to RANGING when score not significant enough
	if bestScore < 25 {
		best = RegimeRanging
	}

	return best, signals
}

// DetectRegimeFromMultiple runs detection on multiple symbols and returns
// the majority-vote regime. Tie → RANGING (safe default).
func DetectRegimeFromMultiple(mdMap map[string]*Data, primaryTF string) (MarketRegime, RegimeSignals) {
	if len(mdMap) == 0 {
		return RegimeRanging, RegimeSignals{RegimeScore: map[MarketRegime]float64{}}
	}

	votes := map[MarketRegime]int{}
	var lastSignals RegimeSignals

	for _, md := range mdMap {
		regime, signals := DetectMarketRegime(md, primaryTF)
		votes[regime]++
		lastSignals = signals
	}

	best := RegimeRanging
	bestVotes := 0
	for regime, v := range votes {
		if v > bestVotes {
			bestVotes = v
			best = regime
		}
	}

	return best, lastSignals
}

// ─── Sub-signal evaluators ──────────────────────────────────────────────────

// evalATRRegime returns ATR expansion score (0-100) and extreme flag.
func evalATRRegime(md *Data, tfData *TimeframeSeriesData) (score float64, extreme bool) {
	atrCur := tfData.ATR14
	if atrCur <= 0 || md.CurrentPrice <= 0 {
		return 0, false
	}
	atrPct := atrCur / md.CurrentPrice * 100

	// Collect ATR% across timeframes for historical average
	var atrs []float64
	for _, d := range md.TimeframeData {
		if d != nil && d.ATR14 > 0 {
			atrs = append(atrs, d.ATR14/md.CurrentPrice*100)
		}
	}
	if len(atrs) < 2 {
		// Insufficient data: use absolute thresholds
		if atrPct > 2.0 {
			return 80, true
		}
		if atrPct > 0.8 {
			return 50, false
		}
		return 0, false
	}

	var sum float64
	for _, a := range atrs {
		sum += a
	}
	avg := sum / float64(len(atrs))

	ratio := atrPct / avg
	if ratio > 2.0 {
		return 100, true // extreme
	}
	if ratio > 1.4 {
		return math.Min(100, (ratio-1)*100), false // significant expansion
	}
	return 0, false
}

// evalEMASlope returns EMA20 slope score (0-100). Steeper slope = higher score.
func evalEMASlope(tfData *TimeframeSeriesData) float64 {
	n := len(tfData.EMA20Values)
	if n < 3 {
		return 0
	}
	ema20Cur := tfData.EMA20Values[n-1]
	ema20Old := tfData.EMA20Values[n-3]
	if ema20Old <= 0 {
		return 0
	}
	slopePct := math.Abs((ema20Cur - ema20Old) / ema20Old) * 100
	return math.Min(100, slopePct*300)
}

// evalVolumeRegime returns volume expansion score and crash score (each 0-100).
func evalVolumeRegime(tfData *TimeframeSeriesData) (expansion, crash float64) {
	klines := tfData.Klines
	n := len(klines)
	if n < 10 {
		// Fall back to deprecated Volume field
		if len(tfData.Volume) < 10 {
			return 0, 0
		}
		return evalVolumeFromSlice(tfData.Volume)
	}
	vols := make([]float64, n)
	for i, k := range klines {
		vols[i] = k.Volume
	}
	return evalVolumeFromSlice(vols)
}

func evalVolumeFromSlice(vols []float64) (expansion, crash float64) {
	n := len(vols)
	window := 20
	if n < window {
		window = n
	}
	var sum float64
	for i := n - window; i < n; i++ {
		sum += vols[i]
	}
	avg := sum / float64(window)
	if avg <= 0 {
		return 0, 0
	}
	lastVol := vols[n-1]
	ratio := lastVol / avg

	if ratio > 1.5 {
		expansion = math.Min(100, (ratio-1)*100)
	}
	// Extreme crash (<15%) → full score; mild low (<30%) → half score,
	// prevents single low-volume bars (overnight/holiday) from triggering LOW_LIQUIDITY.
	if ratio < 0.15 {
		crash = math.Min(100, (1-ratio)*120)
	} else if ratio < 0.30 {
		crash = math.Min(55, (1-ratio)*80)
	}
	return expansion, crash
}
