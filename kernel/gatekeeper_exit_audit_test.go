package kernel

import (
	"strings"
	"testing"

	"nofx/feature_flag"
	"nofx/market"
)

// newCloseLongCandidate 构造测试用 close_long 候选
func newCloseLongCandidate(symbol, source string) *CandidateDecision {
	return &CandidateDecision{
		Symbol: symbol,
		Action: "close_long",
		Source: source,
	}
}

// baseCfgWithTrader 构造带 trader 的 gatekeeper 配置
func baseCfgWithTrader(traderID string) GatekeeperConfig {
	return GatekeeperConfig{
		TraderID:        traderID,
		MinHoldSeconds:  0, // 禁用 G3 避免干扰其他测试
		SignalTimeframe: "15m",
	}
}

// TestGateExitAction_SyncSourceExempt 验证 sync 来源豁免所有 EXIT_G
// v1.1 审计修复 (对齐 nofx改版): sync 是交易所服务端触发的关单，不应被拦截
func TestGateExitAction_SyncSourceExempt(t *testing.T) {
	feature_flag.Reset()

	cfg := baseCfgWithTrader("trader1")
	cfg.MinHoldSeconds = 3600 // 一小时硬门槛

	// 注册 lifecycle，持仓刚开
	GlobalLifecycleManager().Register("trader1", "BTCUSDT", "LONG", "15m")
	defer GlobalLifecycleManager().Unregister("trader1", "BTCUSDT", "LONG")

	// 普通来源应被 G3 拦
	normal := newCloseLongCandidate("BTCUSDT", "ai")
	result := GateExitAction(normal, nil, nil, cfg)
	if result.Allowed {
		t.Error("普通来源 + 持仓不足 min hold 应被拦")
	}

	// sync 来源应豁免
	sync := newCloseLongCandidate("BTCUSDT", "sync")
	result = GateExitAction(sync, nil, nil, cfg)
	if !result.Allowed {
		t.Errorf("sync 来源应豁免 EXIT_G3, 实际拦截: %s", result.RejectReason)
	}
}

// TestGateExitAction_G1_RequiresPriceConfirmation 验证 EXIT_G1 需要价格同向
// v1.1 审计修复 (对齐 nofx改版): 要求 OI 扩张 + 价格同向才算"趋势完好"
// 避免"OI 扩但价跌"的分歧场景下 AI 想止损被误拦
func TestGateExitAction_G1_RequiresPriceConfirmation(t *testing.T) {
	feature_flag.Reset()

	cfg := baseCfgWithTrader("trader1")
	signals := NewMarketSignals()
	signals.OITrend["BTCUSDT"] = "expansion"

	// 场景 1: OI 扩张 + 价格上涨 → 应拦（真实多头动能）
	mdUp := &market.Data{PriceChange1h: 2.5}
	c1 := newCloseLongCandidate("BTCUSDT", "ai")
	r1 := GateExitAction(c1, signals, mdUp, cfg)
	if r1.Allowed {
		t.Error("OI 扩张 + 价格上涨应拦 close_long")
	}
	if !strings.Contains(r1.RejectCode, "EXIT_G1") {
		t.Errorf("期望 EXIT_G1 拦截码, 实际 %s", r1.RejectCode)
	}

	// 场景 2: OI 扩张 + 价格下跌 → 应放行（v1.1 关键改进）
	// 原版会拦，改版和 HOOT 放行 — 因为 OI 扩但价跌是分歧信号
	mdDown := &market.Data{PriceChange1h: -1.8}
	c2 := newCloseLongCandidate("BTCUSDT", "ai")
	r2 := GateExitAction(c2, signals, mdDown, cfg)
	if !r2.Allowed {
		t.Errorf("OI 扩张但价格下跌时不应拦 close_long (v1.1 改进), 实际拦截: %s", r2.RejectReason)
	}
}

// TestGateExitAction_G2_HTFAlignedStillBlocks 保留原版 EXIT_G2 行为
// 说明: HOOT 没有 EXIT_G2 的缓解方案（对齐改版，改版也没做）
// 如果未来真实数据支持，可以在 v1.2 重新评估
func TestGateExitAction_G2_HTFAlignedStillBlocks(t *testing.T) {
	feature_flag.Reset()

	cfg := baseCfgWithTrader("trader_eth_case")
	signals := NewMarketSignals()
	md := &market.Data{
		TimeframeData: map[string]*market.TimeframeSeriesData{
			"1h": {
				EMA20Values: []float64{2260},
				EMA50Values: []float64{2240}, // EMA20 > EMA50 顺势
			},
		},
	}

	// 连续 10 次 close_long 都应被拦 — EXIT_G2 不会因重复请求放行
	// 这是刻意的设计：对齐改版，让系统规则保持权威性
	for i := 1; i <= 10; i++ {
		c := newCloseLongCandidate("ETHUSDT", "ai")
		r := GateExitAction(c, signals, md, cfg)
		if r.Allowed {
			t.Errorf("第 %d 次 EXIT_G2 应始终拦截（无逃生阀）", i)
		}
		if r.RejectCode != "EXIT_G2_HTF_ALIGNED" {
			t.Errorf("第 %d 次期望 EXIT_G2_HTF_ALIGNED, 实际 %s", i, r.RejectCode)
		}
	}
}
