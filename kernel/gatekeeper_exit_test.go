package kernel

import (
	"strings"
	"testing"
	"time"

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

// TestGateExitAction_G3_PositionMapFallback 验证 lifecycle 丢失时
// 使用 PositionMap.UpdateTime 作为 held 时间 fallback（重启恢复场景）
func TestGateExitAction_G3_PositionMapFallback(t *testing.T) {
	feature_flag.Reset()

	cfg := baseCfgWithTrader("trader_restarted")
	cfg.MinHoldSeconds = 600 // 10 分钟

	// 模拟重启: lifecycle 里无数据，但交易所有持仓
	// 持仓 UpdateTime 在 20 分钟前（已超过 min_hold）
	now := time.Now()
	cfg.PositionMap = map[string]*PositionInfo{
		"BTCUSDT": {
			Symbol:     "BTCUSDT",
			Side:       "long",
			UpdateTime: now.Add(-20 * time.Minute).UnixMilli(),
		},
	}

	c := newCloseLongCandidate("BTCUSDT", "ai")
	result := GateExitAction(c, nil, nil, cfg)
	if !result.Allowed {
		t.Errorf("PositionMap 显示已持仓 20 分钟 > 10 分钟 min_hold，应放行 close_long, 实际拒绝: %s", result.RejectReason)
	}
}

// TestGateExitAction_G3_PositionMapBlocksWhenTooNew 验证 PositionMap fallback
// 也会正确拦截持仓时间不足的情况
func TestGateExitAction_G3_PositionMapBlocksWhenTooNew(t *testing.T) {
	feature_flag.Reset()

	cfg := baseCfgWithTrader("trader_fresh")
	cfg.MinHoldSeconds = 600

	// 持仓刚 2 分钟（小于 10 分钟 min_hold）
	now := time.Now()
	cfg.PositionMap = map[string]*PositionInfo{
		"BTCUSDT": {
			Symbol:     "BTCUSDT",
			Side:       "long",
			UpdateTime: now.Add(-2 * time.Minute).UnixMilli(),
		},
	}

	c := newCloseLongCandidate("BTCUSDT", "ai")
	result := GateExitAction(c, nil, nil, cfg)
	if result.Allowed {
		t.Error("PositionMap 显示只持仓 2 分钟，应拦截 close_long")
	}
	if result.RejectFeatures["tracking_ref"] != "position_map" {
		t.Errorf("应标记 tracking_ref=position_map, 实际 %v", result.RejectFeatures["tracking_ref"])
	}
}

// TestGateExitAction_G3_LifecycleTakesPriority 验证 lifecycle 优先级高于 PositionMap
func TestGateExitAction_G3_LifecycleTakesPriority(t *testing.T) {
	feature_flag.Reset()

	cfg := baseCfgWithTrader("trader_both")
	cfg.MinHoldSeconds = 600

	// lifecycle: 刚注册（1 秒前）
	GlobalLifecycleManager().Register("trader_both", "BTCUSDT", "LONG", "15m")
	defer GlobalLifecycleManager().Unregister("trader_both", "BTCUSDT", "LONG")

	// PositionMap: 声称持仓 20 分钟前
	now := time.Now()
	cfg.PositionMap = map[string]*PositionInfo{
		"BTCUSDT": {
			Symbol:     "BTCUSDT",
			Side:       "long",
			UpdateTime: now.Add(-20 * time.Minute).UnixMilli(),
		},
	}

	c := newCloseLongCandidate("BTCUSDT", "ai")
	result := GateExitAction(c, nil, nil, cfg)
	if result.Allowed {
		t.Error("lifecycle 优先（显示刚 1 秒），应拦截，即使 PositionMap 显示 20 分钟")
	}
	if result.RejectFeatures["tracking_ref"] != "lifecycle" {
		t.Errorf("应标记 tracking_ref=lifecycle, 实际 %v", result.RejectFeatures["tracking_ref"])
	}
}

// TestGateExitAction_SyncSourceExempt 验证 sync 来源豁免所有 EXIT_G
// sync 是交易所服务端触发的关单（SL/TP 命中），不应被拦截
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
// 要求 OI 扩张 + 价格同向才算"趋势完好"
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

	// 场景 2: OI 扩张 + 价格下跌 → 应放行
	// OI 扩但价跌是分歧信号，不应锁死 close_long
	mdDown := &market.Data{PriceChange1h: -1.8}
	c2 := newCloseLongCandidate("BTCUSDT", "ai")
	r2 := GateExitAction(c2, signals, mdDown, cfg)
	if !r2.Allowed {
		t.Errorf("OI 扩张但价格下跌时不应拦 close_long, 实际拦截: %s", r2.RejectReason)
	}
}

// TestGateExitAction_G2_HTFAlignedStillBlocks EXIT_G2 严格拦截行为
// HTF 顺势时 close 会被持续拦截，这是刻意保留的设计
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
	// 系统规则保持权威性，防止 AI 摇摆绕过硬约束
	for i := 1; i <= 10; i++ {
		c := newCloseLongCandidate("ETHUSDT", "ai")
		r := GateExitAction(c, signals, md, cfg)
		if r.Allowed {
			t.Errorf("第 %d 次 EXIT_G2 应始终拦截", i)
		}
		if r.RejectCode != "EXIT_G2_HTF_ALIGNED" {
			t.Errorf("第 %d 次期望 EXIT_G2_HTF_ALIGNED, 实际 %s", i, r.RejectCode)
		}
	}
}
