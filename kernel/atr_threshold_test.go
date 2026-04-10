// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package kernel

import (
	"testing"

	"nofx/store"
)

func TestComputeATRPullbackThreshold_NilConfig(t *testing.T) {
	if got := ComputeATRPullbackThreshold(nil, 1.0, 100.0, 1); got != 0 {
		t.Errorf("nil config 应返回 0, 实际 %.4f", got)
	}
}

func TestComputeATRPullbackThreshold_DisabledATR(t *testing.T) {
	cfg := &store.StrategyConfig{
		ATRAdaptive: &store.ATRAdaptiveConfig{Enabled: false},
	}
	if got := ComputeATRPullbackThreshold(cfg, 1.0, 100.0, 1); got != 0 {
		t.Errorf("disabled 应返回 0, 实际 %.4f", got)
	}
}

func TestComputeATRPullbackThreshold_NormalCalculation(t *testing.T) {
	cfg := &store.StrategyConfig{
		ATRAdaptive: &store.ATRAdaptiveConfig{
			Enabled:      true,
			Multiplier:   2.0,
			MinThreshold: 0.005,
			MaxThreshold: 0.05,
		},
	}
	// ATR=2, Price=100 → ATR/Price=0.02
	// 杠杆=1 → threshold = 2.0 × 0.02 × 1 = 0.04 (4%)
	got := ComputeATRPullbackThreshold(cfg, 2.0, 100.0, 1)
	if got != 0.04 {
		t.Errorf("期望 0.04, 实际 %.4f", got)
	}

	// 杠杆=5 → threshold = 2.0 × 0.02 × 5 = 0.20 → clamp to 0.05
	got = ComputeATRPullbackThreshold(cfg, 2.0, 100.0, 5)
	if got != 0.05 {
		t.Errorf("高杠杆应被 max 上限 clamp, 期望 0.05, 实际 %.4f", got)
	}
}

func TestComputeATRPullbackThreshold_ClampToMin(t *testing.T) {
	cfg := &store.StrategyConfig{
		ATRAdaptive: &store.ATRAdaptiveConfig{
			Enabled:      true,
			Multiplier:   2.0,
			MinThreshold: 0.005,
			MaxThreshold: 0.05,
		},
	}
	// ATR=0.1, Price=10000 → 极小波动
	// threshold = 2 × 0.00001 × 1 = 0.00002 → clamp to 0.005
	got := ComputeATRPullbackThreshold(cfg, 0.1, 10000.0, 1)
	if got != 0.005 {
		t.Errorf("极小波动应被 min clamp, 期望 0.005, 实际 %.6f", got)
	}
}

func TestComputeATRPullbackThreshold_InvalidInputs(t *testing.T) {
	cfg := &store.StrategyConfig{
		ATRAdaptive: &store.ATRAdaptiveConfig{Enabled: true, Multiplier: 2.0},
	}
	if got := ComputeATRPullbackThreshold(cfg, 0, 100, 1); got != 0 {
		t.Error("ATR=0 应返回 0")
	}
	if got := ComputeATRPullbackThreshold(cfg, 1, 0, 1); got != 0 {
		t.Error("Price=0 应返回 0")
	}
	if got := ComputeATRPullbackThreshold(cfg, 1, 100, -1); got == 0 {
		t.Error("负杠杆应被 clamp 为 1，仍能计算")
	}
}

func TestComputeATRPullbackThreshold_DefaultsWhenZero(t *testing.T) {
	cfg := &store.StrategyConfig{
		ATRAdaptive: &store.ATRAdaptiveConfig{
			Enabled:      true,
			Multiplier:   0, // 用默认 2.0
			MinThreshold: 0, // 用默认 0.005
			MaxThreshold: 0, // 用默认 0.05
		},
	}
	got := ComputeATRPullbackThreshold(cfg, 2.0, 100.0, 1)
	if got != 0.04 {
		t.Errorf("零配置应回退默认，期望 0.04, 实际 %.4f", got)
	}
}

func TestComputeATRPullbackThreshold_InvertedThresholds(t *testing.T) {
	cfg := &store.StrategyConfig{
		ATRAdaptive: &store.ATRAdaptiveConfig{
			Enabled:      true,
			Multiplier:   2.0,
			MinThreshold: 0.05, // min > max → 异常配置
			MaxThreshold: 0.005,
		},
	}
	// 应回退默认 min/max
	got := ComputeATRPullbackThreshold(cfg, 2.0, 100.0, 1)
	if got != 0.04 {
		t.Errorf("异常配置应回退默认, 期望 0.04, 实际 %.4f", got)
	}
}

func TestResolveATRPullbackOrFixed_FallbackPath(t *testing.T) {
	threshold, isATR := ResolveATRPullbackOrFixed(nil, 1, 100, 1, 0.30)
	if isATR {
		t.Error("nil config 应走 fallback 分支")
	}
	if threshold != 0.30 {
		t.Errorf("fallback 应为 0.30, 实际 %.4f", threshold)
	}
}

func TestResolveATRPullbackOrFixed_ATRPath(t *testing.T) {
	cfg := &store.StrategyConfig{
		ATRAdaptive: &store.ATRAdaptiveConfig{
			Enabled:    true,
			Multiplier: 2.0,
		},
	}
	threshold, isATR := ResolveATRPullbackOrFixed(cfg, 2.0, 100.0, 1, 0.30)
	if !isATR {
		t.Error("启用 ATR 时应走 ATR 分支")
	}
	if threshold == 0.30 {
		t.Error("启用 ATR 时不应返回 fallback")
	}
}
