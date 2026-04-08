package kernel

// gatekeeper.go — Hard-filter gate for trade candidates.
//
// Evaluates each CandidateDecision against non-negotiable rules.
// Any violation results in immediate rejection with a labelled reason.
//
// Entry rules:
//   G1  Funding-rate crowding
//   G2  Long/short-ratio crowding
//   G3  OI divergence (price vs OI mismatch)
//   G4  ATR low-volatility filter
//   G5  Liquidation spike — only allow squeeze direction
//   G6  Symbol blacklist (from AdaptiveThresholds)
//   G7  Consecutive-loss cooldown
//   G8  Minimum R:R ratio (calls trade_validation)
//   G9  Minimum confidence
//
// Exit rules:
//   EXIT_G1  OI still expanding → trend intact, block premature close
//   EXIT_G2  HTF EMA still aligned → trend intact
//   EXIT_G3  Minimum hold time not elapsed

import (
	"fmt"
	"math"
	"nofx/logger"
	"nofx/market"
	"strings"
	"time"
)

// ─── GatekeeperConfig ───────────────────────────────────────────────────────

// GatekeeperConfig holds all tunable thresholds.
type GatekeeperConfig struct {
	// G1 — Funding rate crowding
	FundingExtremeLong  float64 // default 0.001 (0.1%)
	FundingExtremeShort float64 // default -0.0005 (-0.05%)

	// G2 — Long/short crowding
	LongCrowdedThreshold  float64 // default 0.75
	ShortCrowdedThreshold float64 // default 0.30

	// G3 — OI divergence
	PriceChangeThresholdForOIDivergence float64 // default 0.005 (0.5%)

	// G4 — ATR low-volatility filter
	ATRFilterEnabled bool

	// G5 — Liquidation spike (only allow squeeze direction)
	// (no config needed, logic is fixed)

	// G6 — Symbol blacklist
	SymbolBlacklist map[string]bool

	// G7 — Consecutive-loss cooldown
	MaxConsecutiveLosses int
	InCooldown           bool

	// G8 — Minimum R:R
	MinRiskRewardRatio float64 // default 1.5

	// G9 — Minimum confidence
	MinConfidence int

	// Exit validation
	TraderID        string
	MinHoldSeconds  int
	SignalTimeframe string
}

// DefaultGatekeeperConfig returns sensible defaults.
func DefaultGatekeeperConfig() GatekeeperConfig {
	return GatekeeperConfig{
		FundingExtremeLong:                  0.001,
		FundingExtremeShort:                 -0.0005,
		LongCrowdedThreshold:                0.75,
		ShortCrowdedThreshold:               0.30,
		PriceChangeThresholdForOIDivergence: 0.005,
		MinRiskRewardRatio:                  1.5,
		MinConfidence:                       0,
		MaxConsecutiveLosses:                3,
		MinHoldSeconds:                      720,
	}
}

// ─── GatekeeperResult ───────────────────────────────────────────────────────

// GatekeeperResult describes the outcome for a single candidate.
type GatekeeperResult struct {
	Allowed        bool
	RejectReason   string
	RejectCode     string
	RejectFeatures map[string]interface{}
}

// ─── Gate ────────────────────────────────────────────────────────────────────

// Gate evaluates a single CandidateDecision against all rules.
// Non-open actions are routed through GateExitAction.
func Gate(c *CandidateDecision, signals *MarketSignals, md *market.Data, cfg GatekeeperConfig) GatekeeperResult {
	// Non-open actions → exit validation
	if !c.IsOpenAction() {
		return GateExitAction(c, signals, md, cfg)
	}

	sym := c.Symbol

	// G7 — Cooldown check (fast path)
	if cfg.InCooldown {
		return GatekeeperResult{
			Allowed:      false,
			RejectReason: fmt.Sprintf("cooldown active after %d consecutive losses", cfg.MaxConsecutiveLosses),
			RejectCode:   "G7_COOLDOWN",
			RejectFeatures: map[string]interface{}{
				"consecutive_losses": cfg.MaxConsecutiveLosses,
			},
		}
	}

	// G6 — Symbol blacklist
	if cfg.SymbolBlacklist != nil && cfg.SymbolBlacklist[sym] {
		return GatekeeperResult{
			Allowed:        false,
			RejectReason:   fmt.Sprintf("%s is on the temporary blacklist (recent low win-rate)", sym),
			RejectCode:     "G6_BLACKLIST",
			RejectFeatures: map[string]interface{}{"symbol": sym},
		}
	}

	if signals == nil {
		// No signals → skip signal-dependent rules, check R:R and confidence
		return checkRRAndConfidence(c, md, cfg)
	}

	// G1 — Funding-rate crowding
	if sig, ok := signals.FundingExtreme[sym]; ok {
		if c.IsLong() && sig.Value > cfg.FundingExtremeLong {
			return GatekeeperResult{
				Allowed:        false,
				RejectReason:   fmt.Sprintf("funding rate extreme (%.4f%%/8h) — longs overcrowded", sig.Value*100),
				RejectCode:     "G1_FUNDING_EXTREME_LONG",
				RejectFeatures: map[string]interface{}{"funding_rate": sig.Value},
			}
		}
		if c.IsShort() && sig.Value < cfg.FundingExtremeShort {
			return GatekeeperResult{
				Allowed:        false,
				RejectReason:   fmt.Sprintf("funding rate extreme (%.4f%%/8h) — shorts overcrowded", sig.Value*100),
				RejectCode:     "G1_FUNDING_EXTREME_SHORT",
				RejectFeatures: map[string]interface{}{"funding_rate": sig.Value},
			}
		}
	}

	// G2 — Long/short crowding
	if lr, ok := signals.LongRatios[sym]; ok {
		if c.IsLong() && lr > cfg.LongCrowdedThreshold {
			return GatekeeperResult{
				Allowed:        false,
				RejectReason:   fmt.Sprintf("long ratio %.1f%% > %.0f%% — crowd long-trap risk", lr*100, cfg.LongCrowdedThreshold*100),
				RejectCode:     "G2_LONG_CROWDED",
				RejectFeatures: map[string]interface{}{"long_ratio": lr},
			}
		}
		if c.IsShort() && lr < cfg.ShortCrowdedThreshold {
			return GatekeeperResult{
				Allowed:        false,
				RejectReason:   fmt.Sprintf("long ratio %.1f%% < %.0f%% — crowd short-trap risk", lr*100, cfg.ShortCrowdedThreshold*100),
				RejectCode:     "G2_SHORT_CROWDED",
				RejectFeatures: map[string]interface{}{"long_ratio": lr},
			}
		}
	}

	// G3 — OI divergence
	if md != nil {
		priceChange := md.PriceChange1h / 100.0
		oiTrend := signals.OITrend[sym]
		if c.IsLong() && priceChange > cfg.PriceChangeThresholdForOIDivergence && oiTrend == "contraction" {
			return GatekeeperResult{
				Allowed:        false,
				RejectReason:   fmt.Sprintf("OI divergence: price +%.2f%% but OI contracting — not genuine demand", priceChange*100),
				RejectCode:     "G3_OI_DIVERGENCE_LONG",
				RejectFeatures: map[string]interface{}{"price_change": priceChange, "oi_trend": oiTrend},
			}
		}
		if c.IsShort() && priceChange < -cfg.PriceChangeThresholdForOIDivergence && oiTrend == "contraction" {
			return GatekeeperResult{
				Allowed:        false,
				RejectReason:   fmt.Sprintf("OI divergence: price %.2f%% but OI contracting — not genuine selling", priceChange*100),
				RejectCode:     "G3_OI_DIVERGENCE_SHORT",
				RejectFeatures: map[string]interface{}{"price_change": priceChange, "oi_trend": oiTrend},
			}
		}
	}

	// G4 — ATR low-volatility filter
	if cfg.ATRFilterEnabled && md != nil {
		if atrResult := checkATRFilter(c, md); !atrResult.Allowed {
			return atrResult
		}
	}

	// G5 — Liquidation spike: only allow squeeze direction
	if liq, ok := signals.LiquidationPressure[sym]; ok {
		if liq == "short_squeeze" && c.IsShort() {
			return GatekeeperResult{
				Allowed:        false,
				RejectReason:   "short_squeeze active — opening shorts into squeeze is high risk",
				RejectCode:     "G5_LIQ_SPIKE_AGAINST",
				RejectFeatures: map[string]interface{}{"liquidation_pressure": liq},
			}
		}
		if liq == "long_squeeze" && c.IsLong() {
			return GatekeeperResult{
				Allowed:        false,
				RejectReason:   "long_squeeze active — opening longs into squeeze is high risk",
				RejectCode:     "G5_LIQ_SPIKE_AGAINST",
				RejectFeatures: map[string]interface{}{"liquidation_pressure": liq},
			}
		}
	}

	// G8 + G9 — R:R ratio and confidence
	return checkRRAndConfidence(c, md, cfg)
}

// ─── GateAll ────────────────────────────────────────────────────────────────

// GateAll evaluates all candidates and marks each with pass/reject.
func GateAll(candidates []CandidateDecision, signals *MarketSignals, mdMap map[string]*market.Data, cfg GatekeeperConfig) []CandidateDecision {
	for i := range candidates {
		c := &candidates[i]
		md := mdMap[c.Symbol]
		result := Gate(c, signals, md, cfg)
		c.GatekeeperPassed = result.Allowed
		if !result.Allowed {
			c.RejectReason = fmt.Sprintf("[%s] %s", result.RejectCode, result.RejectReason)
			logger.Infof("🚫 [Gatekeeper] REJECTED %s %s: %s", c.Symbol, c.Action, c.RejectReason)
		} else {
			logger.Infof("✅ [Gatekeeper] PASSED %s %s", c.Symbol, c.Action)
		}
	}
	return candidates
}

// ─── GateExitAction ─────────────────────────────────────────────────────────

// GateExitAction validates close/hold/wait actions.
// Blocks premature exits when the trend is still healthy.
//
// v1.1 审计修复 (2026-04-08, 对齐 nofx改版):
//   - sync 来源豁免: 交易所服务端触发的关单（SL/TP 命中）不拦
//   - EXIT_G1 加价格同向: 要求 OI 扩张 + 价格同向才判定"趋势完好"
func GateExitAction(c *CandidateDecision, signals *MarketSignals, md *market.Data, cfg GatekeeperConfig) GatekeeperResult {
	// hold/wait always pass
	if c.Action == "hold" || c.Action == "wait" || c.Action == "HOLD" || c.Action == "WAIT" {
		return GatekeeperResult{Allowed: true}
	}

	sym := c.Symbol

	// v1.1 审计修复: sync 来源豁免所有 EXIT_G 规则
	// "sync" 是交易所服务端触发的关单（SL/TP 命中 / 流动性事件），
	// 不应被 gatekeeper 拦截——拦了也没用且会造成记录混乱
	if strings.EqualFold(c.Source, "sync") {
		return GatekeeperResult{Allowed: true}
	}

	// EXIT_G3 — Minimum hold time not elapsed
	if cfg.MinHoldSeconds > 0 && cfg.TraderID != "" {
		lc := GlobalLifecycleManager().Get(cfg.TraderID, sym, exitSideFromAction(c.Action))
		if lc != nil {
			holdDuration := time.Since(lc.RegisteredAt)
			minHold := time.Duration(cfg.MinHoldSeconds) * time.Second
			if holdDuration < minHold {
				remaining := minHold - holdDuration
				return GatekeeperResult{
					Allowed:      false,
					RejectReason: fmt.Sprintf("EXIT_G3: min hold %ds not elapsed (held %ds, remaining %ds)", cfg.MinHoldSeconds, int(holdDuration.Seconds()), int(remaining.Seconds())),
					RejectCode:   "EXIT_G3_MIN_HOLD",
					RejectFeatures: map[string]interface{}{
						"min_hold_seconds": cfg.MinHoldSeconds,
						"held_seconds":     int(holdDuration.Seconds()),
					},
				}
			}
		}
	}

	if signals == nil || md == nil {
		return GatekeeperResult{Allowed: true}
	}

	// EXIT_G1 — OI still expanding + price direction confirms trend → block close
	// v1.1 审计修复 (对齐 nofx改版): 要求 OI 扩张 + 价格同向才算"趋势完好"
	// 避免"OI 扩但价跌"的分歧场景下误拦 close_long
	oiTrend := signals.OITrend[sym]
	priceChange1h := md.PriceChange1h / 100.0 // 百分比 → 小数
	if oiTrend == "expansion" {
		isClosingLong := c.Action == "close_long" || c.Action == "FULL_CLOSE" || c.Action == "PARTIAL_CLOSE"
		if isClosingLong && priceChange1h > 0 {
			return GatekeeperResult{
				Allowed:      false,
				RejectReason: fmt.Sprintf("EXIT_G1: OI expanding + price +%.2f%% — bullish trend intact, hold long", priceChange1h*100),
				RejectCode:   "EXIT_G1_OI_EXPANDING_LONG",
				RejectFeatures: map[string]interface{}{
					"oi_trend":     oiTrend,
					"price_change": priceChange1h,
					"symbol":       sym,
				},
			}
		}
	}

	// EXIT_G2 — HTF EMA still aligned → trend intact
	if cfg.SignalTimeframe != "" {
		htf := HigherTimeframe(cfg.SignalTimeframe)
		if md.TimeframeData != nil {
			if htfData, ok := md.TimeframeData[htf]; ok && htfData != nil {
				if len(htfData.EMA20Values) > 0 && len(htfData.EMA50Values) > 0 {
					ema20 := htfData.EMA20Values[len(htfData.EMA20Values)-1]
					ema50 := htfData.EMA50Values[len(htfData.EMA50Values)-1]

					isClosingLong := c.Action == "close_long"
					isClosingShort := c.Action == "close_short"

					// Long position: block close if EMA20 > EMA50 (uptrend intact)
					if isClosingLong && ema20 > ema50*1.001 {
						return GatekeeperResult{
							Allowed:      false,
							RejectReason: fmt.Sprintf("EXIT_G2: HTF (%s) EMA20 > EMA50 — uptrend intact, hold long", htf),
							RejectCode:   "EXIT_G2_HTF_ALIGNED",
							RejectFeatures: map[string]interface{}{
								"htf": htf, "ema20": ema20, "ema50": ema50,
							},
						}
					}
					// Short position: block close if EMA20 < EMA50 (downtrend intact)
					if isClosingShort && ema50 > ema20*1.001 {
						return GatekeeperResult{
							Allowed:      false,
							RejectReason: fmt.Sprintf("EXIT_G2: HTF (%s) EMA50 > EMA20 — downtrend intact, hold short", htf),
							RejectCode:   "EXIT_G2_HTF_ALIGNED",
							RejectFeatures: map[string]interface{}{
								"htf": htf, "ema20": ema20, "ema50": ema50,
							},
						}
					}
				}
			}
		}
	}

	return GatekeeperResult{Allowed: true}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func exitSideFromAction(action string) string {
	switch action {
	case "close_long", "FULL_CLOSE", "PARTIAL_CLOSE":
		return "LONG"
	case "close_short":
		return "SHORT"
	default:
		return "LONG"
	}
}

// checkRRAndConfidence validates G8 (R:R ratio) and G9 (confidence).
func checkRRAndConfidence(c *CandidateDecision, md *market.Data, cfg GatekeeperConfig) GatekeeperResult {
	// G8 — Minimum R:R ratio
	if c.StopLoss > 0 && c.TakeProfit > 0 && md != nil && md.CurrentPrice > 0 {
		entryPrice := md.CurrentPrice
		var minRR float64
		if cfg.MinRiskRewardRatio > 0 {
			minRR = cfg.MinRiskRewardRatio
		} else {
			minRR = 1.5
		}

		var err error
		if c.IsLong() {
			err = ValidateOpenLong(entryPrice, c.StopLoss, c.TakeProfit, minRR)
		} else if c.IsShort() {
			err = ValidateOpenShort(entryPrice, c.StopLoss, c.TakeProfit, minRR)
		}
		if err != nil {
			return GatekeeperResult{
				Allowed:      false,
				RejectReason: fmt.Sprintf("G8: %v", err),
				RejectCode:   "G8_RR_RATIO",
				RejectFeatures: map[string]interface{}{
					"entry": entryPrice, "sl": c.StopLoss, "tp": c.TakeProfit, "min_rr": minRR,
				},
			}
		}
	}

	// G9 — Minimum confidence
	if cfg.MinConfidence > 0 && c.Confidence < cfg.MinConfidence {
		return GatekeeperResult{
			Allowed:      false,
			RejectReason: fmt.Sprintf("confidence %d < minimum %d", c.Confidence, cfg.MinConfidence),
			RejectCode:   "G9_MIN_CONFIDENCE",
			RejectFeatures: map[string]interface{}{
				"confidence": c.Confidence, "min_confidence": cfg.MinConfidence,
			},
		}
	}

	return GatekeeperResult{Allowed: true}
}

// checkATRFilter rejects candidates when ATR indicates low volatility.
func checkATRFilter(c *CandidateDecision, md *market.Data) GatekeeperResult {
	if md.TimeframeData == nil {
		return GatekeeperResult{Allowed: true}
	}

	// Get primary timeframe ATR
	var primaryATR float64
	for _, tfData := range md.TimeframeData {
		if tfData.ATR14 > 0 {
			primaryATR = tfData.ATR14
			break
		}
	}

	if primaryATR <= 0 || md.CurrentPrice <= 0 {
		return GatekeeperResult{Allowed: true}
	}

	// ATR as percentage of price
	atrPct := primaryATR / md.CurrentPrice
	if atrPct < 0.003 { // 0.3% — very low volatility
		return GatekeeperResult{
			Allowed:      false,
			RejectReason: fmt.Sprintf("ATR too low (%.3f%% of price) — consolidation regime", atrPct*100),
			RejectCode:   "G4_ATR_LOW_VOL",
			RejectFeatures: map[string]interface{}{
				"atr": primaryATR, "atr_pct": atrPct, "price": md.CurrentPrice,
			},
		}
	}

	return GatekeeperResult{Allowed: true}
}

// ComputeATRThreshold calculates a dynamic drawdown threshold from ATR.
// Returns a percentage value clamped to [0.5%, 5.0%].
func ComputeATRThreshold(atr float64, price float64) float64 {
	if atr <= 0 || price <= 0 {
		return 2.0 // default 2%
	}
	atrPct := (atr / price) * 100.0
	// Scale: 1 ATR% → ~2% threshold, with floor/ceiling
	threshold := atrPct * 1.5
	return math.Max(0.5, math.Min(5.0, threshold))
}
