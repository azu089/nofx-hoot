// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package kernel

import (
	"testing"
	"time"
)

// TestSyncPositions_UsesUpdateTimeAsRegisteredAt 验证 SyncPositions 会用
// PositionInfo.UpdateTime 作为 lifecycle.RegisteredAt，保证跨重启的 hold 时间计算
func TestSyncPositions_UsesUpdateTimeAsRegisteredAt(t *testing.T) {
	m := NewPositionLifecycleManager()

	// 模拟持仓从 2 小时前就存在（entry_time 来自 DB）
	realEntryTime := time.Now().Add(-2 * time.Hour)
	positions := []PositionInfo{
		{
			Symbol:     "BTCUSDT",
			Side:       "long",
			UpdateTime: realEntryTime.UnixMilli(),
		},
	}

	m.SyncPositions("trader1", positions, "15m")

	lc := m.Get("trader1", "BTCUSDT", "LONG")
	if lc == nil {
		t.Fatal("lifecycle should be registered")
	}

	// RegisteredAt 应当接近 realEntryTime（而不是 now）
	diff := lc.RegisteredAt.Sub(realEntryTime)
	if diff < -time.Second || diff > time.Second {
		t.Errorf("RegisteredAt 应接近 UpdateTime, 差值 %v", diff)
	}

	// time.Since(RegisteredAt) 应该接近 2 小时
	held := time.Since(lc.RegisteredAt)
	if held < 119*time.Minute || held > 121*time.Minute {
		t.Errorf("held duration 应接近 2 小时, 实际 %v", held)
	}
}

// TestSyncPositions_ZeroUpdateTimeFallsBackToNow 验证 UpdateTime=0 时退化为当前时间
func TestSyncPositions_ZeroUpdateTimeFallsBackToNow(t *testing.T) {
	m := NewPositionLifecycleManager()
	before := time.Now()

	positions := []PositionInfo{
		{Symbol: "ETHUSDT", Side: "long", UpdateTime: 0},
	}
	m.SyncPositions("trader1", positions, "15m")

	lc := m.Get("trader1", "ETHUSDT", "LONG")
	if lc == nil {
		t.Fatal("lifecycle should be registered")
	}

	if lc.RegisteredAt.Before(before) || lc.RegisteredAt.After(time.Now()) {
		t.Errorf("RegisteredAt 应在 before 和 now 之间, 实际 %v", lc.RegisteredAt)
	}
}

// TestRegisterWithTime_RespectsFirstRegistration 验证重复 Register 不覆盖原时间
func TestRegisterWithTime_RespectsFirstRegistration(t *testing.T) {
	m := NewPositionLifecycleManager()

	t1 := time.Now().Add(-1 * time.Hour)
	m.RegisterWithTime("t1", "BTCUSDT", "LONG", "15m", t1)

	// 第二次调用（模拟 SyncPositions 每个 tick 都调一次）
	t2 := time.Now().Add(-30 * time.Minute)
	m.RegisterWithTime("t1", "BTCUSDT", "LONG", "15m", t2)

	lc := m.Get("t1", "BTCUSDT", "LONG")
	if lc == nil {
		t.Fatal("nil")
	}
	// 第一次注册的时间应保留
	if lc.RegisteredAt.Sub(t1).Abs() > time.Second {
		t.Errorf("RegisteredAt 应保留首次注册时间 %v, 实际 %v", t1, lc.RegisteredAt)
	}
}

// TestGateExitAction_G3_AcrossRestart 端到端场景:
// 模拟进程重启后, lifecycle 从 ctx.Positions[].UpdateTime 恢复真实开仓时间
// EXIT_G3 应正确判断持仓已超 min_hold
func TestGateExitAction_G3_AcrossRestart(t *testing.T) {
	// 清空全局单例避免测试相互影响
	m := globalLifecycleManager
	m.mu.Lock()
	m.positions = map[string]*PositionLifecycle{}
	m.mu.Unlock()
	defer func() {
		m.mu.Lock()
		m.positions = map[string]*PositionLifecycle{}
		m.mu.Unlock()
	}()

	// 模拟重启后的 ctx.Positions，UpdateTime 来自 DB entry_time（2 小时前）
	realEntryMs := time.Now().Add(-2 * time.Hour).UnixMilli()
	livePositions := []PositionInfo{
		{Symbol: "BTCUSDT", Side: "long", UpdateTime: realEntryMs},
	}
	// 主循环会这样调用
	m.SyncPositions("trader_restart", livePositions, "15m")

	// Gatekeeper 查 lifecycle
	cfg := GatekeeperConfig{
		TraderID:        "trader_restart",
		MinHoldSeconds:  1020, // 17 分钟
		SignalTimeframe: "15m",
	}
	c := &CandidateDecision{Symbol: "BTCUSDT", Action: "close_long", Source: "ai"}
	result := GateExitAction(c, nil, nil, cfg)

	if !result.Allowed {
		t.Errorf("持仓已 2 小时 > 17 分钟 min_hold, close_long 应放行, 实际: %s", result.RejectReason)
	}
}
