package trader

import (
	"testing"

	"nofx/feature_flag"
	"nofx/kernel"
	"nofx/store"
)

// newRankerTestTrader 构造测试 trader
func newRankerTestTrader(maxPositions int) *AutoTrader {
	at := &AutoTrader{
		id:         "t1",
		name:       "rankertest",
		strategyID: "s1",
	}
	if maxPositions > 0 {
		at.config.StrategyConfig = &store.StrategyConfig{
			RiskControl: store.RiskControlConfig{MaxPositions: maxPositions},
		}
	}
	return at
}

func enableRanker(t *testing.T) {
	t.Helper()
	feature_flag.SetSpec("candidate_ranker", "on")
	t.Cleanup(feature_flag.Reset)
}

func TestCandidateRanker_DisabledByDefaultPasses(t *testing.T) {
	feature_flag.Reset()
	defer feature_flag.Reset()

	at := newRankerTestTrader(3)
	decisions := []kernel.Decision{
		{Symbol: "A", Action: "open_long", Confidence: 90},
		{Symbol: "B", Action: "open_long", Confidence: 50},
		{Symbol: "C", Action: "open_long", Confidence: 80},
		{Symbol: "D", Action: "open_long", Confidence: 60},
		{Symbol: "E", Action: "open_long", Confidence: 70},
	}
	out := at.applyCandidateRanker(decisions, 0)
	// 默认 disabled → 原样返回
	if len(out) != 5 {
		t.Errorf("disabled 应原样返回, 期望 5 实际 %d", len(out))
	}
}

func TestCandidateRanker_UnderLimitPasses(t *testing.T) {
	enableRanker(t)
	at := newRankerTestTrader(5)
	decisions := []kernel.Decision{
		{Symbol: "A", Action: "open_long", Confidence: 90},
		{Symbol: "B", Action: "open_long", Confidence: 50},
	}
	out := at.applyCandidateRanker(decisions, 0)
	if len(out) != 2 {
		t.Errorf("未超限应原样返回, 期望 2 实际 %d", len(out))
	}
}

func TestCandidateRanker_TrimsOverflowKeepsTopScore(t *testing.T) {
	enableRanker(t)
	at := newRankerTestTrader(3)

	// 5 个 open，maxPositions=3，currentPos=0 → 保留 3 个最高分
	decisions := []kernel.Decision{
		{Symbol: "LOW", Action: "open_long", Confidence: 50, StopLoss: 100, TakeProfit: 110},
		{Symbol: "MID1", Action: "open_long", Confidence: 75, StopLoss: 100, TakeProfit: 120},
		{Symbol: "HIGH", Action: "open_long", Confidence: 95, StopLoss: 100, TakeProfit: 130},
		{Symbol: "MID2", Action: "open_long", Confidence: 80, StopLoss: 100, TakeProfit: 125},
		{Symbol: "BAD", Action: "open_long", Confidence: 30, StopLoss: 100, TakeProfit: 105},
	}
	out := at.applyCandidateRanker(decisions, 0)
	if len(out) != 3 {
		t.Fatalf("期望 3 个, 实际 %d", len(out))
	}

	// HIGH / MID2 / MID1 应被保留（按 confidence 排序）
	kept := map[string]bool{}
	for _, d := range out {
		kept[d.Symbol] = true
	}
	for _, expected := range []string{"HIGH", "MID2", "MID1"} {
		if !kept[expected] {
			t.Errorf("%q 应被保留（高分）", expected)
		}
	}
	for _, dropped := range []string{"LOW", "BAD"} {
		if kept[dropped] {
			t.Errorf("%q 应被移除（低分）", dropped)
		}
	}
}

func TestCandidateRanker_PreservesNonOpenDecisions(t *testing.T) {
	enableRanker(t)
	at := newRankerTestTrader(2)

	// 3 个 open + 2 个 close + 1 个 hold，maxPositions=2, currentPos=0
	// 应裁到 2 个 open，保留所有 close/hold
	decisions := []kernel.Decision{
		{Symbol: "A", Action: "open_long", Confidence: 90, StopLoss: 100, TakeProfit: 120},
		{Symbol: "B", Action: "close_long"},
		{Symbol: "C", Action: "open_long", Confidence: 50, StopLoss: 100, TakeProfit: 105},
		{Symbol: "D", Action: "hold"},
		{Symbol: "E", Action: "open_long", Confidence: 70, StopLoss: 100, TakeProfit: 110},
		{Symbol: "F", Action: "close_short"},
	}
	out := at.applyCandidateRanker(decisions, 0)

	// 期望: 2 open + 2 close + 1 hold = 5
	if len(out) != 5 {
		t.Fatalf("期望 5 个, 实际 %d: %+v", len(out), out)
	}

	// close/hold 必须全部保留
	for _, sym := range []string{"B", "D", "F"} {
		found := false
		for _, d := range out {
			if d.Symbol == sym {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("%q 应被保留（非 open）", sym)
		}
	}

	// C（confidence 50）应被移除
	for _, d := range out {
		if d.Symbol == "C" {
			t.Error("C 是最低分 open, 应被移除")
		}
	}
}

func TestCandidateRanker_RespectsCurrentPositions(t *testing.T) {
	enableRanker(t)
	at := newRankerTestTrader(5) // max 5

	// currentPos=4, availableSlots=1, 3 open candidates → 保留 1 个最高分
	decisions := []kernel.Decision{
		{Symbol: "LOW", Action: "open_long", Confidence: 40},
		{Symbol: "MID", Action: "open_long", Confidence: 60},
		{Symbol: "HIGH", Action: "open_long", Confidence: 90},
	}
	out := at.applyCandidateRanker(decisions, 4)
	if len(out) != 1 {
		t.Fatalf("availableSlots=1 期望 1 个, 实际 %d", len(out))
	}
	if out[0].Symbol != "HIGH" {
		t.Errorf("应保留 HIGH, 实际 %s", out[0].Symbol)
	}
}

func TestCandidateRanker_ZeroSlotsDropsAll(t *testing.T) {
	enableRanker(t)
	at := newRankerTestTrader(3)

	// currentPos=3, availableSlots=0 → 所有 open 都被移除
	decisions := []kernel.Decision{
		{Symbol: "A", Action: "open_long", Confidence: 90},
		{Symbol: "B", Action: "close_long"},
	}
	out := at.applyCandidateRanker(decisions, 3)
	// 只剩 close
	if len(out) != 1 || out[0].Symbol != "B" {
		t.Errorf("availableSlots=0 应移除所有 open, 保留 close, 实际 %+v", out)
	}
}

func TestCandidateRanker_EmptyDecisions(t *testing.T) {
	enableRanker(t)
	at := newRankerTestTrader(3)
	if out := at.applyCandidateRanker(nil, 0); out != nil {
		t.Error("nil 应原样返回")
	}
	if out := at.applyCandidateRanker([]kernel.Decision{}, 0); len(out) != 0 {
		t.Error("empty 应原样返回")
	}
}

func TestComputeDecisionRR(t *testing.T) {
	// SL=100, TP=103, range=3, relRange=0.03 → 满分 1.0
	d1 := kernel.Decision{StopLoss: 100, TakeProfit: 103}
	if got := computeDecisionRR(d1); got != 1.0 {
		t.Errorf("rel 3%% 应为 1.0, 实际 %.3f", got)
	}

	// SL=100, TP=110, range=10, relRange=0.10 → clamp 1.0
	d2 := kernel.Decision{StopLoss: 100, TakeProfit: 110}
	if got := computeDecisionRR(d2); got != 1.0 {
		t.Errorf("rel 10%% 应 clamp 为 1.0, 实际 %.3f", got)
	}

	// SL=100, TP=101.5, range=1.5, relRange=0.015 → 0.015/0.03=0.5
	d3 := kernel.Decision{StopLoss: 100, TakeProfit: 101.5}
	if got := computeDecisionRR(d3); got < 0.4 || got > 0.6 {
		t.Errorf("rel 1.5%% 应约 0.5, 实际 %.3f", got)
	}

	// 缺字段 → 中性 0.5
	d4 := kernel.Decision{}
	if got := computeDecisionRR(d4); got != 0.5 {
		t.Errorf("缺字段应为 0.5, 实际 %.3f", got)
	}

	// SL=100, TP=100 → range=0 → 0.5
	d5 := kernel.Decision{StopLoss: 100, TakeProfit: 100}
	if got := computeDecisionRR(d5); got != 0.5 {
		t.Errorf("range=0 应为 0.5, 实际 %.3f", got)
	}
}

func TestCandidateRanker_NilAdaptiveStateSafe(t *testing.T) {
	enableRanker(t)
	at := newRankerTestTrader(2)
	// adaptiveState 为 nil，不应崩溃
	decisions := []kernel.Decision{
		{Symbol: "A", Action: "open_long", Confidence: 90},
		{Symbol: "B", Action: "open_long", Confidence: 50},
		{Symbol: "C", Action: "open_long", Confidence: 70},
	}
	out := at.applyCandidateRanker(decisions, 0)
	if len(out) != 2 {
		t.Errorf("nil adaptiveState 应安全降级, 期望 2 实际 %d", len(out))
	}
}

func TestCandidateRanker_MaxPositionsZeroPasses(t *testing.T) {
	enableRanker(t)
	at := &AutoTrader{id: "t1", strategyID: "s1"} // 无 StrategyConfig → maxPositions=default 3
	decisions := []kernel.Decision{
		{Symbol: "A", Action: "open_long", Confidence: 90},
		{Symbol: "B", Action: "open_long", Confidence: 50},
	}
	// 默认 max=3, 2 个 open 未超限 → 原样返回
	out := at.applyCandidateRanker(decisions, 0)
	if len(out) != 2 {
		t.Errorf("未超默认上限应原样返回, 实际 %d", len(out))
	}
}
