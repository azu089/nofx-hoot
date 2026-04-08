package store

import (
	"encoding/json"
	"testing"
)

// TestStrategyConfigBackwardsCompat 验证 v1.1 升级新增字段不破坏旧 JSON 反序列化
// 相关任务: P0.2 StrategyConfig 字段扩展 (2026-04-08)
//
// 原则: 所有 v1.1 新字段必须为指针 + omitempty，nil 表示沿用原版行为
// 旧策略 JSON 不包含这些字段时，反序列化应成功且新字段全部为 nil
func TestStrategyConfigBackwardsCompat(t *testing.T) {
	// 模拟一段 v1.0 时期保存的旧 JSON（不含任何 v1.1 字段）
	legacyJSON := `{
		"strategy_type": "ai_trading",
		"language": "zh",
		"coin_source": {"mode": "manual"},
		"indicators": {},
		"risk_control": {},
		"min_hold_seconds": 720
	}`

	var cfg StrategyConfig
	if err := json.Unmarshal([]byte(legacyJSON), &cfg); err != nil {
		t.Fatalf("旧 JSON 反序列化失败: %v", err)
	}

	// 验证旧字段读到了
	if cfg.StrategyType != "ai_trading" {
		t.Errorf("StrategyType 期望 ai_trading, 实际 %q", cfg.StrategyType)
	}
	if cfg.MinHoldSeconds != 720 {
		t.Errorf("MinHoldSeconds 期望 720, 实际 %d", cfg.MinHoldSeconds)
	}

	// 验证所有 v1.1 新字段全为 nil（= 沿用原版行为）
	if cfg.AIBudgetPolicy != nil {
		t.Errorf("AIBudgetPolicy 应为 nil, 实际 %+v", cfg.AIBudgetPolicy)
	}
	if cfg.ExitPhilosophy != nil {
		t.Errorf("ExitPhilosophy 应为 nil, 实际 %v", *cfg.ExitPhilosophy)
	}
	if cfg.ATRAdaptive != nil {
		t.Errorf("ATRAdaptive 应为 nil, 实际 %+v", cfg.ATRAdaptive)
	}
	if cfg.IndicatorHistoryDepth != nil {
		t.Errorf("IndicatorHistoryDepth 应为 nil, 实际 %d", *cfg.IndicatorHistoryDepth)
	}
	if cfg.PMAuthorityMode != nil {
		t.Errorf("PMAuthorityMode 应为 nil, 实际 %v", *cfg.PMAuthorityMode)
	}
}

// TestStrategyConfigV11FieldsRoundTrip 验证 v1.1 字段填值后能正确序列化/反序列化
func TestStrategyConfigV11FieldsRoundTrip(t *testing.T) {
	exitMode := "hybrid"
	histDepth := 50
	pmMode := "shadow"

	original := StrategyConfig{
		StrategyType: "ai_trading",
		AIBudgetPolicy: &AIBudgetPolicyConfig{
			Enabled:         true,
			CooldownSeconds: 180,
			MaxCallsPerDay:  500,
			SkipWhenIdle:    true,
		},
		ExitPhilosophy: &exitMode,
		ATRAdaptive: &ATRAdaptiveConfig{
			Enabled:      true,
			Multiplier:   2.0,
			MinThreshold: 0.005,
			MaxThreshold: 0.05,
		},
		IndicatorHistoryDepth: &histDepth,
		PMAuthorityMode:       &pmMode,
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}

	var decoded StrategyConfig
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}

	if decoded.AIBudgetPolicy == nil || !decoded.AIBudgetPolicy.Enabled {
		t.Error("AIBudgetPolicy 未正确往返")
	}
	if decoded.AIBudgetPolicy.CooldownSeconds != 180 {
		t.Errorf("CooldownSeconds 期望 180, 实际 %d", decoded.AIBudgetPolicy.CooldownSeconds)
	}
	if decoded.ExitPhilosophy == nil || *decoded.ExitPhilosophy != "hybrid" {
		t.Error("ExitPhilosophy 未正确往返")
	}
	if decoded.ATRAdaptive == nil || decoded.ATRAdaptive.Multiplier != 2.0 {
		t.Error("ATRAdaptive 未正确往返")
	}
	if decoded.IndicatorHistoryDepth == nil || *decoded.IndicatorHistoryDepth != 50 {
		t.Error("IndicatorHistoryDepth 未正确往返")
	}
	if decoded.PMAuthorityMode == nil || *decoded.PMAuthorityMode != "shadow" {
		t.Error("PMAuthorityMode 未正确往返")
	}
}

// TestStrategyConfigEmptyJSON 极端边界: 空 JSON 也应能反序列化
func TestStrategyConfigEmptyJSON(t *testing.T) {
	var cfg StrategyConfig
	if err := json.Unmarshal([]byte(`{}`), &cfg); err != nil {
		t.Fatalf("空 JSON 反序列化失败: %v", err)
	}
	if cfg.AIBudgetPolicy != nil {
		t.Error("空 JSON 时 AIBudgetPolicy 应为 nil")
	}
}
