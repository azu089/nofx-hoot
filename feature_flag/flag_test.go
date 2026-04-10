// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package feature_flag

import "testing"

func TestEnabled_Unregistered(t *testing.T) {
	Reset()
	if Enabled("nope", EvalCtx{}) {
		t.Error("未注册 flag 应返回 false")
	}
}

func TestEnabled_OnOff(t *testing.T) {
	Reset()
	SetSpec("foo", "on")
	if !Enabled("foo", EvalCtx{}) {
		t.Error("on 应返回 true")
	}
	SetSpec("foo", "off")
	if Enabled("foo", EvalCtx{}) {
		t.Error("off 应返回 false")
	}
}

func TestEnabled_Strategies(t *testing.T) {
	Reset()
	SetSpec("pm_authority", "strategies:s1,s2,s3")

	if !Enabled("pm_authority", EvalCtx{StrategyID: "s2"}) {
		t.Error("白名单内策略应启用")
	}
	if Enabled("pm_authority", EvalCtx{StrategyID: "s99"}) {
		t.Error("白名单外策略应禁用")
	}
	if Enabled("pm_authority", EvalCtx{}) {
		t.Error("空 StrategyID 应禁用")
	}
}

func TestEnabled_Traders(t *testing.T) {
	Reset()
	SetSpec("pretrade_sim", "traders:trader_a,trader_b")

	if !Enabled("pretrade_sim", EvalCtx{TraderID: "trader_a"}) {
		t.Error("白名单内 trader 应启用")
	}
	if Enabled("pretrade_sim", EvalCtx{TraderID: "trader_x"}) {
		t.Error("白名单外 trader 应禁用")
	}
}

func TestEnabled_PercentageRollout(t *testing.T) {
	Reset()
	SetSpec("audit_pipeline", "pct:50")

	// 灰度算法稳定性: 同 strategy 反复求值结果一致
	id := "stable-strategy-id-1234"
	first := Enabled("audit_pipeline", EvalCtx{StrategyID: id})
	for i := 0; i < 10; i++ {
		if Enabled("audit_pipeline", EvalCtx{StrategyID: id}) != first {
			t.Errorf("灰度结果不稳定: id=%s 第 %d 次结果不一致", id, i)
		}
	}

	// 0% 永远 false
	SetSpec("audit_pipeline", "pct:0")
	if Enabled("audit_pipeline", EvalCtx{StrategyID: "any"}) {
		t.Error("pct:0 应永远 false")
	}

	// 100% 永远 true
	SetSpec("audit_pipeline", "pct:100")
	if !Enabled("audit_pipeline", EvalCtx{StrategyID: "any"}) {
		t.Error("pct:100 应永远 true")
	}

	// 边界: 越界值应被 clamp
	SetSpec("audit_pipeline", "pct:200")
	if !Enabled("audit_pipeline", EvalCtx{StrategyID: "any"}) {
		t.Error("pct:200 应被 clamp 为 100")
	}
}

func TestEnabled_PercentageDistribution(t *testing.T) {
	Reset()
	SetSpec("rollout", "pct:50")

	// 跑 1000 个不同 id, 看分布是否大致接近 50%（容忍 ±15%）
	enabled := 0
	for i := 0; i < 1000; i++ {
		id := "strategy-" + string(rune('a'+i%26)) + string(rune('0'+i/26%10))
		if Enabled("rollout", EvalCtx{StrategyID: id}) {
			enabled++
		}
	}
	if enabled < 350 || enabled > 650 {
		t.Errorf("50%% 灰度分布异常: 1000 次中 %d 次启用 (期望 ~500)", enabled)
	}
}

func TestEnabled_CustomMode(t *testing.T) {
	Reset()
	SetSpec("pm_mode", "shadow")

	if !Enabled("pm_mode", EvalCtx{}) {
		t.Error("自定义模式应视为 enabled")
	}
	if Mode("pm_mode") != "shadow" {
		t.Errorf("Mode 应返回 shadow, 实际 %q", Mode("pm_mode"))
	}
}

func TestMode_Unregistered(t *testing.T) {
	Reset()
	if Mode("nope") != "" {
		t.Error("未注册 flag Mode 应返回空串")
	}
}

func TestParse_EmptyAndWhitespace(t *testing.T) {
	Reset()
	SetSpec("empty", "")
	if Enabled("empty", EvalCtx{}) {
		t.Error("空 spec 应视为 off")
	}
}

func TestSetSpec_CaseInsensitive(t *testing.T) {
	Reset()
	SetSpec("FooBar", "on")
	if !Enabled("foobar", EvalCtx{}) {
		t.Error("flag key 应大小写不敏感")
	}
	if !Enabled("FOOBAR", EvalCtx{}) {
		t.Error("flag key 应大小写不敏感")
	}
}
