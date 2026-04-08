package kernel

import (
	"testing"
	"time"

	"nofx/feature_flag"
)

func enableGlobalBL(t *testing.T) {
	t.Helper()
	feature_flag.SetSpec("global_blacklist", "on")
	t.Cleanup(func() {
		feature_flag.Reset()
		ResetGlobalBlacklist()
	})
}

func TestGlobalBlacklist_DisabledByDefault(t *testing.T) {
	feature_flag.Reset()
	ResetGlobalBlacklist()

	BanGlobal("BTCUSDT", "test", "admin", time.Time{})
	if IsGloballyBlacklisted("BTCUSDT", "any") {
		t.Error("feature flag 关闭时应永远 false")
	}
}

func TestGlobalBlacklist_BanAndCheck(t *testing.T) {
	enableGlobalBL(t)

	BanGlobal("BTCUSDT", "high volatility", "admin", time.Time{})
	if !IsGloballyBlacklisted("BTCUSDT", "strat1") {
		t.Error("BTC 应被全局禁")
	}
	if IsGloballyBlacklisted("ETHUSDT", "strat1") {
		t.Error("ETH 未被禁不应触发")
	}
}

func TestGlobalBlacklist_Unban(t *testing.T) {
	enableGlobalBL(t)

	BanGlobal("BTCUSDT", "test", "admin", time.Time{})
	UnbanGlobal("BTCUSDT")

	if IsGloballyBlacklisted("BTCUSDT", "strat1") {
		t.Error("Unban 后不应触发")
	}
}

func TestGlobalBlacklist_Expiry(t *testing.T) {
	enableGlobalBL(t)

	// 已过期
	BanGlobal("BTCUSDT", "test", "admin", time.Now().Add(-1*time.Hour))
	if IsGloballyBlacklisted("BTCUSDT", "strat1") {
		t.Error("过期条目不应触发")
	}

	// 未过期
	BanGlobal("ETHUSDT", "test", "admin", time.Now().Add(1*time.Hour))
	if !IsGloballyBlacklisted("ETHUSDT", "strat1") {
		t.Error("未过期条目应触发")
	}
}

func TestGlobalBlacklist_StrategyExemption(t *testing.T) {
	enableGlobalBL(t)

	BanGlobal("BTCUSDT", "test", "admin", time.Time{})
	AddExemption("BTCUSDT", "vip_strat")

	// 普通策略仍被禁
	if !IsGloballyBlacklisted("BTCUSDT", "normal_strat") {
		t.Error("普通策略应被禁")
	}
	// VIP 策略豁免
	if IsGloballyBlacklisted("BTCUSDT", "vip_strat") {
		t.Error("VIP 策略应被豁免")
	}
}

func TestGlobalBlacklist_AddExemptionDuplicate(t *testing.T) {
	enableGlobalBL(t)

	BanGlobal("BTCUSDT", "test", "admin", time.Time{})
	AddExemption("BTCUSDT", "s1")
	AddExemption("BTCUSDT", "s1") // 重复

	list := ListGlobalBlacklist()
	if len(list) != 1 {
		t.Fatalf("期望 1 条, 实际 %d", len(list))
	}
	exemptions := 0
	for _, ex := range list[0].Exemptions {
		if ex == "s1" {
			exemptions++
		}
	}
	if exemptions != 1 {
		t.Errorf("重复 exemption 应去重, 实际 %d", exemptions)
	}
}

func TestGlobalBlacklist_ListExcludesExpired(t *testing.T) {
	enableGlobalBL(t)

	BanGlobal("BTC", "test", "admin", time.Now().Add(-1*time.Hour))
	BanGlobal("ETH", "test", "admin", time.Now().Add(1*time.Hour))
	BanGlobal("SOL", "test", "admin", time.Time{}) // 永久

	list := ListGlobalBlacklist()
	if len(list) != 2 {
		t.Errorf("过期条目应被排除, 期望 2, 实际 %d", len(list))
	}
}

func TestGlobalBlacklist_EmptyInputsNoOp(t *testing.T) {
	enableGlobalBL(t)
	// 不应崩溃
	BanGlobal("", "test", "admin", time.Time{})
	UnbanGlobal("")
	AddExemption("", "s1")
	AddExemption("BTC", "")
	if IsGloballyBlacklisted("", "s1") {
		t.Error("空 symbol 应 false")
	}
}

func TestGlobalBlacklist_SymbolNormalization(t *testing.T) {
	enableGlobalBL(t)

	// market.Normalize 应处理大小写差异（验证基本规范化）
	BanGlobal("btcusdt", "test", "admin", time.Time{})
	if !IsGloballyBlacklisted("BTCUSDT", "s1") {
		t.Error("symbol 应被规范化匹配")
	}
}
