package ai_budget

import (
	"testing"
	"time"

	"nofx/store"
)

func TestCheck_NilPolicyAlwaysAllow(t *testing.T) {
	Reset()
	skip, _ := Check("s1", nil, 0)
	if skip {
		t.Error("nil policy 应永远不跳过")
	}
}

func TestCheck_DisabledPolicyAlwaysAllow(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{Enabled: false, SkipWhenIdle: true}
	skip, _ := Check("s1", p, 0)
	if skip {
		t.Error("disabled policy 应永远不跳过")
	}
}

func TestCheck_PositionsHeldAlwaysAllow(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{Enabled: true, SkipWhenIdle: true, CooldownSeconds: 3600}
	Record("s1")                 // 立即记录调用，cooldown 进行中
	skip, _ := Check("s1", p, 1) // 但有持仓
	if skip {
		t.Error("有持仓时应永远不跳过")
	}
}

func TestCheck_CooldownSkipWhenIdle(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{
		Enabled:         true,
		SkipWhenIdle:    true,
		CooldownSeconds: 60,
	}

	// 首次调用：无 last，放行
	skip, _ := Check("s1", p, 0)
	if skip {
		t.Error("首次调用应放行")
	}

	Record("s1")

	// 立即再查：cooldown 内，跳过
	skip, reason := Check("s1", p, 0)
	if !skip {
		t.Error("cooldown 内应跳过")
	}
	if reason == "" {
		t.Error("跳过原因不能为空")
	}
}

func TestCheck_NoSkipWhenIdleFalse(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{
		Enabled:         true,
		SkipWhenIdle:    false, // 关键：不在空闲时跳过
		CooldownSeconds: 60,
	}
	Record("s1")
	skip, _ := Check("s1", p, 0)
	if skip {
		t.Error("SkipWhenIdle=false 时不应因 cooldown 跳过")
	}
}

func TestCheck_DailyLimit(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{
		Enabled:        true,
		MaxCallsPerDay: 3,
	}

	for i := 0; i < 3; i++ {
		skip, _ := Check("s1", p, 0)
		if skip {
			t.Errorf("第 %d 次调用应放行", i+1)
		}
		Record("s1")
	}

	// 第 4 次：已达上限
	skip, reason := Check("s1", p, 0)
	if !skip {
		t.Error("达到每日上限后应跳过")
	}
	if reason == "" {
		t.Error("跳过原因不能为空")
	}
}

func TestCheck_DailyLimitBypassedByPositions(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{
		Enabled:        true,
		MaxCallsPerDay: 1,
	}
	Record("s1") // 已用 1 次

	// 即使达到上限，有持仓也必须放行
	skip, _ := Check("s1", p, 1)
	if skip {
		t.Error("有持仓时即使超日限也应放行")
	}
}

func TestCheck_StrategyIsolation(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{
		Enabled:         true,
		SkipWhenIdle:    true,
		CooldownSeconds: 3600,
	}
	Record("s1")

	// s1 在 cooldown，s2 不应受影响
	skip, _ := Check("s2", p, 0)
	if skip {
		t.Error("不同策略状态应隔离")
	}
}

func TestCheck_EmptyStrategyIDPasses(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{Enabled: true, SkipWhenIdle: true, CooldownSeconds: 3600}
	skip, _ := Check("", p, 0)
	if skip {
		t.Error("空 strategyID 应放行（向后兼容）")
	}
}

func TestCheck_DefaultCooldownWhenZero(t *testing.T) {
	Reset()
	p := &store.AIBudgetPolicyConfig{
		Enabled:         true,
		SkipWhenIdle:    true,
		CooldownSeconds: 0, // 应用默认 180s
	}
	Record("s1")
	skip, _ := Check("s1", p, 0)
	if !skip {
		t.Error("CooldownSeconds=0 时应使用默认 180s，应跳过")
	}
}

func TestSnapshot(t *testing.T) {
	Reset()
	if GetSnapshot("nope") != nil {
		t.Error("未初始化策略 Snapshot 应为 nil")
	}
	Record("s1")
	snap := GetSnapshot("s1")
	if snap == nil {
		t.Fatal("Snapshot 不应为 nil")
	}
	if snap.CallsToday != 1 {
		t.Errorf("CallsToday 期望 1, 实际 %d", snap.CallsToday)
	}
	if snap.LastCallAt.IsZero() {
		t.Error("LastCallAt 不应为零值")
	}
}

func TestSameDayUTC(t *testing.T) {
	a := time.Date(2026, 4, 8, 23, 59, 59, 0, time.UTC)
	b := time.Date(2026, 4, 9, 0, 0, 1, 0, time.UTC)
	if sameDayUTC(a, b) {
		t.Error("跨 UTC 自然日应判定为不同")
	}

	c := time.Date(2026, 4, 8, 0, 0, 0, 0, time.UTC)
	d := time.Date(2026, 4, 8, 23, 59, 59, 0, time.UTC)
	if !sameDayUTC(c, d) {
		t.Error("同 UTC 自然日应判定为相同")
	}
}
