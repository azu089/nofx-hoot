package kernel

// strategy_profile.go — Strategy profile abstraction layer.
//
// Different trading strategies require fundamentally different exit logic.
// A trend-following strategy should hold through pullbacks and exit only on
// genuine reversal signals. A mean-reversion strategy should exit quickly.
// Breakout strategies need to scale aggressively and cut losses fast.
//
// StrategyProfile defines the behavioural parameters that the PositionManager
// uses when evaluating HOLD / REDUCE / SCALE / EXIT decisions.

import "strings"

// ─── StrategyProfile ────────────────────────────────────────────────────────

// StrategyProfile identifies the type of strategy driving a position.
type StrategyProfile string

const (
	ProfileTrendFollowing StrategyProfile = "TREND_FOLLOWING"
	ProfileMeanReversion  StrategyProfile = "MEAN_REVERSION"
	ProfileBreakout       StrategyProfile = "BREAKOUT"
)

// ─── Tag constants ──────────────────────────────────────────────────────────

const (
	TagTrendFollow  = "trend_follow"
	TagMeanRevert   = "mean_revert"
	TagBreakout     = "breakout"
	TagSqueeze      = "squeeze"
	TagOIExpansion  = "oi_expansion"
	TagRuleGen      = "rule_generated"
	TagAIGen        = "ai_generated"
	TagWait         = "wait"
)

// ─── StrategyProfileConfig ──────────────────────────────────────────────────

// StrategyProfileConfig holds the exit and scaling parameters for a given profile.
type StrategyProfileConfig struct {
	Profile StrategyProfile

	// Exit sensitivity: 0.0 = exit only on strong signals, 1.0 = exit quickly.
	ExitSensitivity float64

	// DecayThresholdScore: when AlphaDecayState.DecayScore reaches this value,
	// the position should be reduced.
	DecayThresholdScore float64

	// ForceExitScore: when DecayScore reaches this value, force exit regardless.
	ForceExitScore float64

	// AllowScaling: whether the PositionManager may return SCALE.
	AllowScaling bool

	// MaxScaleCount: maximum number of scale-in events.
	MaxScaleCount int

	// MinHoldMultiplier: applied to MinHoldDuration(); 1.0 = no change.
	MinHoldMultiplier float64
}

// ─── GetStrategyProfileConfig ───────────────────────────────────────────────

// GetStrategyProfileConfig returns the StrategyProfileConfig for the given profile.
func GetStrategyProfileConfig(profile StrategyProfile) StrategyProfileConfig {
	switch profile {
	case ProfileTrendFollowing:
		return StrategyProfileConfig{
			Profile:             ProfileTrendFollowing,
			ExitSensitivity:     0.3,
			DecayThresholdScore: 55.0,
			ForceExitScore:      80.0,
			AllowScaling:        true,
			MaxScaleCount:       2,
			MinHoldMultiplier:   1.5,
		}
	case ProfileMeanReversion:
		return StrategyProfileConfig{
			Profile:             ProfileMeanReversion,
			ExitSensitivity:     0.7,
			DecayThresholdScore: 35.0,
			ForceExitScore:      60.0,
			AllowScaling:        false,
			MaxScaleCount:       0,
			MinHoldMultiplier:   0.6,
		}
	case ProfileBreakout:
		return StrategyProfileConfig{
			Profile:             ProfileBreakout,
			ExitSensitivity:     0.5,
			DecayThresholdScore: 40.0,
			ForceExitScore:      65.0,
			AllowScaling:        true,
			MaxScaleCount:       1,
			MinHoldMultiplier:   0.8,
		}
	default:
		return GetStrategyProfileConfig(ProfileTrendFollowing)
	}
}

// ─── DetectStrategyProfile ──────────────────────────────────────────────────

// DetectStrategyProfile infers the likely strategy profile from tags.
// Used to apply the correct exit config when an explicit profile is not set.
func DetectStrategyProfile(tags []string) StrategyProfile {
	for _, tag := range tags {
		switch strings.ToLower(tag) {
		case TagTrendFollow:
			return ProfileTrendFollowing
		case TagMeanRevert:
			return ProfileMeanReversion
		case TagBreakout:
			return ProfileBreakout
		}
	}
	// OI-expansion candidates are inherently trend-following
	for _, tag := range tags {
		if strings.ToLower(tag) == TagOIExpansion {
			return ProfileTrendFollowing
		}
	}
	return ProfileTrendFollowing // safe default
}

// DetectStrategyProfileFromReasoning infers profile from AI Decision.Reasoning text.
// Used when no explicit tags are available (pre-CandidateDecision era).
func DetectStrategyProfileFromReasoning(reasoning string) StrategyProfile {
	r := strings.ToLower(reasoning)
	if strings.Contains(r, "breakout") || strings.Contains(r, "break out") || strings.Contains(r, "突破") {
		return ProfileBreakout
	}
	if strings.Contains(r, "mean reversion") || strings.Contains(r, "回归") || strings.Contains(r, "overbought") || strings.Contains(r, "oversold") {
		return ProfileMeanReversion
	}
	return ProfileTrendFollowing
}
