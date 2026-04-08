package trader

import (
	"testing"

	"nofx/kernel"
	"nofx/store"
)

// TestSortDecisionsByPriority_WithSizedActions 审计修复 Bug #4 回归
// 确认 reduce_* 与 close_* 同优先级，scale_* 与 open_* 同优先级
func TestSortDecisionsByPriority_WithSizedActions(t *testing.T) {
	input := []kernel.Decision{
		{Symbol: "A", Action: "open_long"},
		{Symbol: "B", Action: "scale_short"},
		{Symbol: "C", Action: "reduce_long"},
		{Symbol: "D", Action: "hold"},
		{Symbol: "E", Action: "close_short"},
		{Symbol: "F", Action: "scale_long"},
		{Symbol: "G", Action: "reduce_short"},
		{Symbol: "H", Action: "open_short"},
		{Symbol: "I", Action: "close_long"},
	}
	out := sortDecisionsByPriority(input)

	// 前 4 个应全是 close/reduce 系列（priority 1）
	closeSeries := map[string]bool{"close_long": true, "close_short": true, "reduce_long": true, "reduce_short": true}
	openSeries := map[string]bool{"open_long": true, "open_short": true, "scale_long": true, "scale_short": true}

	for i := 0; i < 4; i++ {
		if !closeSeries[out[i].Action] {
			t.Errorf("sort[%d] = %s, 应为 close/reduce 系列", i, out[i].Action)
		}
	}
	// 中间 4 个应全是 open/scale 系列（priority 2）
	for i := 4; i < 8; i++ {
		if !openSeries[out[i].Action] {
			t.Errorf("sort[%d] = %s, 应为 open/scale 系列", i, out[i].Action)
		}
	}
	// 最后 1 个是 hold
	if out[8].Action != "hold" {
		t.Errorf("sort[8] 应为 hold, 实际 %s", out[8].Action)
	}
}

// TestSortDecisionsByPriority_ReducesBeforeScalesBeforeOpens 关键顺序保证
// reduce 先释放保证金 → scale/open 后追加风险
func TestSortDecisionsByPriority_ReduceBeforeOpen(t *testing.T) {
	input := []kernel.Decision{
		{Symbol: "NEW", Action: "open_short"},
		{Symbol: "EXISTING", Action: "reduce_long"},
	}
	out := sortDecisionsByPriority(input)
	if out[0].Action != "reduce_long" || out[1].Action != "open_short" {
		t.Errorf("reduce 必须在 open 前执行, 实际顺序: %s, %s", out[0].Action, out[1].Action)
	}
}

// TestSideFromAction 审计修复 Bug #3 回归
func TestSideFromAction(t *testing.T) {
	cases := map[string]string{
		"open_long":    "LONG",
		"open_short":   "SHORT",
		"close_long":   "LONG",
		"close_short":  "SHORT",
		"reduce_long":  "LONG",
		"reduce_short": "SHORT", // 关键：之前被误判为 LONG
		"scale_long":   "LONG",
		"scale_short":  "SHORT",
		"hold":         "LONG", // 默认
		"":             "LONG",
	}
	for action, expected := range cases {
		if got := sideFromAction(action); got != expected {
			t.Errorf("sideFromAction(%q) = %q, 期望 %q", action, got, expected)
		}
	}
}

// TestIsFullCloseAction 审计修复 Bug #2 回归
// 只有完全平仓才能 Unregister lifecycle
func TestIsFullCloseAction(t *testing.T) {
	yes := []string{"close_long", "close_short"}
	no := []string{"reduce_long", "reduce_short", "open_long", "scale_long", "hold", "wait", ""}

	for _, a := range yes {
		if !isFullCloseAction(a) {
			t.Errorf("%q 应识别为 full close", a)
		}
	}
	for _, a := range no {
		if isFullCloseAction(a) {
			t.Errorf("%q 不应识别为 full close", a)
		}
	}
}

// TestIsScaleAction 审计修复 Bug #1 回归
func TestIsScaleAction(t *testing.T) {
	yes := []string{"scale_long", "scale_short"}
	no := []string{"open_long", "open_short", "close_long", "reduce_long", "hold", ""}

	for _, a := range yes {
		if !isScaleAction(a) {
			t.Errorf("%q 应识别为 scale", a)
		}
	}
	for _, a := range no {
		if isScaleAction(a) {
			t.Errorf("%q 不应识别为 scale", a)
		}
	}
}

// TestSafeModeFilter_BlocksScale 审计修复 Bug #1 集成回归
// 模拟 safeMode 过滤逻辑，确认 scale_* 被拦截
func TestSafeModeFilter_BlocksScale(t *testing.T) {
	// 直接测试过滤条件等价逻辑
	decisions := []kernel.Decision{
		{Symbol: "A", Action: "open_long"},
		{Symbol: "B", Action: "scale_long"},   // 应被拦
		{Symbol: "C", Action: "scale_short"},  // 应被拦
		{Symbol: "D", Action: "close_long"},   // 应保留
		{Symbol: "E", Action: "reduce_short"}, // 应保留（释放保证金）
		{Symbol: "F", Action: "hold"},         // 应保留
	}

	filtered := make([]kernel.Decision, 0)
	for _, d := range decisions {
		if isOpenAction(d.Action) || isScaleAction(d.Action) {
			continue // safe mode 拦截
		}
		filtered = append(filtered, d)
	}

	// 期望：C D E F（4 个）— 但 C 是 scale_short 也应被拦
	expected := []string{"close_long", "reduce_short", "hold"}
	if len(filtered) != len(expected) {
		t.Fatalf("期望 %d 个, 实际 %d: %+v", len(expected), len(filtered), filtered)
	}
	for i, act := range expected {
		if filtered[i].Action != act {
			t.Errorf("filtered[%d] 期望 %s, 实际 %s", i, act, filtered[i].Action)
		}
	}
}

// TestApplyPartialMode_HedgeScenario 审计修复 #7 回归
// 同 symbol 的 long + short 不应相互覆盖
func TestApplyPartialMode_HedgeScenario(t *testing.T) {
	mode := "partial"
	at := &AutoTrader{
		id:         "t1",
		name:       "hedgetest",
		strategyID: "s1",
		config: AutoTraderConfig{
			StrategyConfig: &store.StrategyConfig{PMAuthorityMode: &mode},
		},
	}

	// AI 同时想平多头和平空头
	ai := []kernel.Decision{
		{Symbol: "BTC", Action: "close_long", Reasoning: "AI thinks long should exit"},
		{Symbol: "BTC", Action: "close_short", Reasoning: "AI thinks short should exit"},
	}
	// PM 只想覆盖多头平仓（把 close_long 改为 reduce_long）
	pm := []kernel.Decision{
		{Symbol: "BTC", Action: "reduce_long", PartialPct: 0.5, Reasoning: "PM says trim only"},
	}

	out := at.ApplyInstitutionalPipeline(ai, pm)

	// 期望:
	//  - AI close_long 被 PM 的 reduce_long 覆盖（移除 AI close_long）
	//  - AI close_short 保留（不同 side，PM 没管它）
	//  - PM reduce_long 追加
	// 总共 2 条
	if len(out) != 2 {
		t.Fatalf("期望 2 条, 实际 %d: %+v", len(out), out)
	}

	hasAICloseLong := false
	hasAICloseShort := false
	hasPMReduceLong := false
	for _, d := range out {
		if d.Action == "close_long" {
			hasAICloseLong = true
		}
		if d.Action == "close_short" {
			hasAICloseShort = true
		}
		if d.Action == "reduce_long" {
			hasPMReduceLong = true
		}
	}
	if hasAICloseLong {
		t.Error("AI close_long 应被 PM 覆盖（移除）")
	}
	if !hasAICloseShort {
		t.Error("AI close_short 应被保留（不同 side，PM 没覆盖）")
	}
	if !hasPMReduceLong {
		t.Error("PM reduce_long 应被追加")
	}
}
