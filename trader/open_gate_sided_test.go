package trader

import (
	"testing"
	"time"

	"nofx/store"
)

// TestAllowOpenSided_LongShortIsolation 验证 long/short cooldown 完全隔离
// 任务: P1-4 PositionGateKey 细化 (HOOT nofx 升级 2026-04)
func TestAllowOpenSided_LongShortIsolation(t *testing.T) {
	g := NewOpenGate()
	rc := store.RiskControlConfig{
		CooldownMinutesAfterClose: 30,
	}

	// 平多头
	g.MarkCloseSided("trader1", "BTCUSDT", "long")

	// 立即开多头：应被 cooldown 拦截
	allowed, reason := g.AllowOpenSided("trader1", "BTCUSDT", "long", rc)
	if allowed {
		t.Errorf("平多头后立即开多头应被拦截，实际允许: %s", reason)
	}

	// 立即开空头：不应被多头 cooldown 影响
	allowed, reason = g.AllowOpenSided("trader1", "BTCUSDT", "short", rc)
	if !allowed {
		t.Errorf("平多头不应阻塞开空头，实际拦截: %s", reason)
	}
}

func TestAllowOpenSided_MinHoldIsolation(t *testing.T) {
	g := NewOpenGate()
	rc := store.RiskControlConfig{
		MinHoldMinutes: 10,
	}

	// 开多头
	allowed, _ := g.AllowOpenSided("trader1", "BTCUSDT", "long", rc)
	if !allowed {
		t.Fatal("首次开多头应允许")
	}

	// 立即再开多头：min interval 拦截
	allowed, _ = g.AllowOpenSided("trader1", "BTCUSDT", "long", rc)
	if allowed {
		t.Error("min interval 内应拦截同方向重复开仓")
	}

	// 立即开空头：不受多头 min interval 影响
	allowed, reason := g.AllowOpenSided("trader1", "BTCUSDT", "short", rc)
	if !allowed {
		t.Errorf("开多头的 min interval 不应阻塞开空头: %s", reason)
	}
}

func TestAllowOpenSided_HourlyLimitGlobal(t *testing.T) {
	g := NewOpenGate()
	rc := store.RiskControlConfig{
		MaxOpensPerHour: 2,
	}

	// long + short 各开一次：占用 hourly 限制 2 次
	if allowed, _ := g.AllowOpenSided("trader1", "BTCUSDT", "long", rc); !allowed {
		t.Error("第 1 次（long）应允许")
	}
	if allowed, _ := g.AllowOpenSided("trader1", "ETHUSDT", "short", rc); !allowed {
		t.Error("第 2 次（short）应允许")
	}

	// 第 3 次任意方向：hourly limit 拦截（全局，不分方向）
	if allowed, reason := g.AllowOpenSided("trader1", "SOLUSDT", "long", rc); allowed {
		t.Errorf("hourly limit 应拦截第 3 次开仓: %s", reason)
	}
}

func TestAllowOpenSided_SymbolIsolation(t *testing.T) {
	g := NewOpenGate()
	rc := store.RiskControlConfig{
		CooldownMinutesAfterClose: 30,
	}

	g.MarkCloseSided("trader1", "BTCUSDT", "long")

	// BTC 多头被 cooldown 拦截
	if allowed, _ := g.AllowOpenSided("trader1", "BTCUSDT", "long", rc); allowed {
		t.Error("BTC long cooldown 应拦截")
	}

	// ETH 多头不受影响
	if allowed, reason := g.AllowOpenSided("trader1", "ETHUSDT", "long", rc); !allowed {
		t.Errorf("ETH 不应受 BTC cooldown 影响: %s", reason)
	}
}

func TestAllowOpenSided_TraderIsolation(t *testing.T) {
	g := NewOpenGate()
	rc := store.RiskControlConfig{
		CooldownMinutesAfterClose: 30,
	}

	g.MarkCloseSided("traderA", "BTCUSDT", "long")

	if allowed, _ := g.AllowOpenSided("traderA", "BTCUSDT", "long", rc); allowed {
		t.Error("traderA cooldown 应拦截")
	}
	if allowed, reason := g.AllowOpenSided("traderB", "BTCUSDT", "long", rc); !allowed {
		t.Errorf("traderB 不应受 traderA cooldown 影响: %s", reason)
	}
}

func TestAllowOpenSided_BackwardsCompatLegacyAllowOpen(t *testing.T) {
	// 验证：legacy AllowOpen 与新 AllowOpenSided 的 state 是隔离的
	// MarkClose（legacy）后调用 AllowOpenSided 不应被拦截
	// 因为 sided map 是空的
	g := NewOpenGate()
	rc := store.RiskControlConfig{
		CooldownMinutesAfterClose: 30,
	}

	g.MarkClose("trader1", "BTCUSDT") // 仅写 legacy map

	// AllowOpenSided 看不到 legacy cooldown
	allowed, _ := g.AllowOpenSided("trader1", "BTCUSDT", "long", rc)
	if !allowed {
		t.Error("AllowOpenSided 不应读 legacy cooldown map")
	}

	// 反向：AllowOpen（legacy）能看到 legacy cooldown
	allowed, _ = g.AllowOpen("trader1", "BTCUSDT", rc)
	if allowed {
		t.Error("AllowOpen（legacy）应能看到 legacy cooldown")
	}
}

func TestMarkCloseSided_DoubleWrite(t *testing.T) {
	// 验证 MarkCloseSided 同时写 sided + legacy map
	g := NewOpenGate()
	rc := store.RiskControlConfig{
		CooldownMinutesAfterClose: 30,
	}

	g.MarkCloseSided("trader1", "BTCUSDT", "long")

	// legacy 应能看到（任意方向）
	if allowed, _ := g.AllowOpen("trader1", "BTCUSDT", rc); allowed {
		t.Error("MarkCloseSided 应同时写 legacy map")
	}

	// 给点时间确保不是 race
	time.Sleep(1 * time.Millisecond)

	// sided long 应能看到
	if allowed, _ := g.AllowOpenSided("trader1", "BTCUSDT", "long", rc); allowed {
		t.Error("MarkCloseSided 应写 sided long map")
	}

	// sided short 不应受影响
	if allowed, _ := g.AllowOpenSided("trader1", "BTCUSDT", "short", rc); !allowed {
		t.Error("MarkCloseSided long 不应写 sided short map")
	}
}
