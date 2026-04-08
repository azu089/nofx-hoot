package trader

import (
	"testing"

	"nofx/kernel"
	"nofx/store"
)

// 构造测试用 trader
func newTestTrader(pmMode string) *AutoTrader {
	at := &AutoTrader{
		id:         "test_trader",
		name:       "test",
		strategyID: "test_strategy",
		config: AutoTraderConfig{
			StrategyConfig: &store.StrategyConfig{},
		},
	}
	if pmMode != "" {
		mode := pmMode
		at.config.StrategyConfig.PMAuthorityMode = &mode
	}
	return at
}

func TestApplyInstitutionalPipeline_OffMode(t *testing.T) {
	at := newTestTrader("")
	ai := []kernel.Decision{
		{Symbol: "BTC", Action: "open_long"},
		{Symbol: "ETH", Action: "close_long"},
	}
	pm := []kernel.Decision{
		{Symbol: "BTC", Action: "close_long", Reasoning: "PM stop loss"},
	}

	out := at.ApplyInstitutionalPipeline(ai, pm)
	// off 模式：PM 直接 append
	if len(out) != 3 {
		t.Errorf("off 模式应 append PM, 期望 3 实际 %d", len(out))
	}
	if out[2].Action != "close_long" || out[2].Symbol != "BTC" {
		t.Error("off 模式 PM 应在末尾")
	}
}

func TestApplyInstitutionalPipeline_ShadowMode(t *testing.T) {
	at := newTestTrader("shadow")
	ai := []kernel.Decision{
		{Symbol: "BTC", Action: "open_long"},
	}
	pm := []kernel.Decision{
		{Symbol: "BTC", Action: "close_long"},
	}

	out := at.ApplyInstitutionalPipeline(ai, pm)
	// shadow 模式：PM 不执行
	if len(out) != 1 {
		t.Errorf("shadow 模式不应执行 PM, 期望 1 实际 %d", len(out))
	}
	if out[0].Action != "open_long" {
		t.Error("shadow 模式应只保留 AI 决策")
	}
}

func TestApplyInstitutionalPipeline_PartialMode_OverrideClose(t *testing.T) {
	at := newTestTrader("partial")
	ai := []kernel.Decision{
		{Symbol: "BTC", Action: "open_long"},
		{Symbol: "ETH", Action: "close_long", Reasoning: "AI thinks ETH down"},
		{Symbol: "SOL", Action: "open_short"},
	}
	pm := []kernel.Decision{
		{Symbol: "ETH", Action: "reduce_long", PartialPct: 0.5, Reasoning: "PM trim only"},
	}

	out := at.ApplyInstitutionalPipeline(ai, pm)
	// partial: ETH AI close 被 PM 覆盖；BTC/SOL AI 保留；PM 决策追加
	// 期望: BTC open_long, SOL open_short, ETH reduce_long
	if len(out) != 3 {
		t.Errorf("partial 模式期望 3 个决策（被覆盖 1 + 保留 2 + 追加 1）, 实际 %d", len(out))
	}

	hasBTCOpen := false
	hasSOLShort := false
	hasETHReduce := false
	hasETHClose := false
	for _, d := range out {
		switch {
		case d.Symbol == "BTC" && d.Action == "open_long":
			hasBTCOpen = true
		case d.Symbol == "SOL" && d.Action == "open_short":
			hasSOLShort = true
		case d.Symbol == "ETH" && d.Action == "reduce_long":
			hasETHReduce = true
		case d.Symbol == "ETH" && d.Action == "close_long":
			hasETHClose = true
		}
	}
	if !hasBTCOpen || !hasSOLShort {
		t.Error("AI 的 open 决策应保留")
	}
	if !hasETHReduce {
		t.Error("PM 的 reduce 决策应被追加")
	}
	if hasETHClose {
		t.Error("AI 的 ETH close 应被 PM 覆盖（移除）")
	}
}

func TestApplyInstitutionalPipeline_FullMode_BlocksAllAIClose(t *testing.T) {
	at := newTestTrader("full")
	ai := []kernel.Decision{
		{Symbol: "BTC", Action: "open_long"},
		{Symbol: "ETH", Action: "close_long"},
		{Symbol: "SOL", Action: "close_short"},
		{Symbol: "DOT", Action: "reduce_long", PartialPct: 0.3},
	}
	pm := []kernel.Decision{
		{Symbol: "AAVE", Action: "close_long"},
	}

	out := at.ApplyInstitutionalPipeline(ai, pm)
	// full: AI close/reduce 全部移除；BTC open 保留；PM 决策追加
	// 期望: BTC open_long, AAVE close_long
	if len(out) != 2 {
		t.Errorf("full 模式期望 2 个决策, 实际 %d", len(out))
	}

	for _, d := range out {
		if isCloseAction(d.Action) && d.Symbol != "AAVE" {
			t.Errorf("full 模式 AI close 应被移除: %s/%s", d.Symbol, d.Action)
		}
	}
}

func TestApplyInstitutionalPipeline_EmptyPM(t *testing.T) {
	at := newTestTrader("partial")
	ai := []kernel.Decision{
		{Symbol: "BTC", Action: "open_long"},
		{Symbol: "ETH", Action: "close_long"},
	}

	out := at.ApplyInstitutionalPipeline(ai, nil)
	// 任何模式下 PM 为空都应原样返回 AI
	if len(out) != 2 {
		t.Errorf("PM 空时应保留所有 AI 决策, 期望 2 实际 %d", len(out))
	}
}

func TestApplyInstitutionalPipeline_EmptyAI(t *testing.T) {
	at := newTestTrader("partial")
	pm := []kernel.Decision{
		{Symbol: "BTC", Action: "close_long"},
	}

	out := at.ApplyInstitutionalPipeline(nil, pm)
	// AI 空时所有模式都应包含 PM 决策（除 shadow）
	if len(out) != 1 {
		t.Errorf("AI 空时 PM 应被保留, 实际 %d", len(out))
	}
}

func TestResolvePMMode_DefaultsToOff(t *testing.T) {
	at := &AutoTrader{}
	if mode := at.resolvePMMode(); mode != PMModeOff {
		t.Errorf("默认应为 off, 实际 %s", mode)
	}
}

func TestResolvePMMode_StrategyConfigOverride(t *testing.T) {
	at := newTestTrader("partial")
	if mode := at.resolvePMMode(); mode != PMModePartial {
		t.Errorf("strategy config 应优先, 实际 %s", mode)
	}
}

func TestResolvePMMode_InvalidValueDefaults(t *testing.T) {
	at := newTestTrader("invalid_mode_xyz")
	if mode := at.resolvePMMode(); mode != PMModeOff {
		t.Errorf("无效值应回退 off, 实际 %s", mode)
	}
}

func TestIsCloseAction_IncludesReduce(t *testing.T) {
	yes := []string{"close_long", "close_short", "reduce_long", "reduce_short"}
	no := []string{"open_long", "scale_long", "hold", "wait", ""}

	for _, a := range yes {
		if !isCloseAction(a) {
			t.Errorf("%q 应被识别为 close action", a)
		}
	}
	for _, a := range no {
		if isCloseAction(a) {
			t.Errorf("%q 不应被识别为 close action", a)
		}
	}
}
