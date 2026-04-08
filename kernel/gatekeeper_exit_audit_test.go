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
// v1.1 审计修复: 对齐 nofx改版的 sync 豁免
func TestGateExitAction_SyncSourceExempt(t *testing.T) {
	feature_flag.Reset()
	GlobalExitIntentTracker().Reset()

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
// v1.1 审计修复: 对齐 nofx改版，避免"OI 扩但价跌"误拦
func TestGateExitAction_G1_RequiresPriceConfirmation(t *testing.T) {
	feature_flag.Reset()
	GlobalExitIntentTracker().Reset()

	cfg := baseCfgWithTrader("trader1")
	signals := NewMarketSignals()
	signals.OITrend["BTCUSDT"] = "expansion"

	// 场景 1: OI 扩张 + 价格上涨 → 应拦
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
	mdDown := &market.Data{PriceChange1h: -1.8}
	c2 := newCloseLongCandidate("BTCUSDT", "ai")
	r2 := GateExitAction(c2, signals, mdDown, cfg)
	if !r2.Allowed {
		t.Errorf("OI 扩张但价格下跌时不应拦 close_long (v1.1 改进), 实际拦截: %s", r2.RejectReason)
	}
}

// TestGateExitAction_EscapeHatch_AfterMinAttempts 验证连续被拦后逃生阀触发
// v1.1 HOOT 独有: 解决 EXIT_G2 过度保护导致亏损的真实生产问题
func TestGateExitAction_EscapeHatch_AfterMinAttempts(t *testing.T) {
	feature_flag.Reset()
	GlobalExitIntentTracker().Reset()

	// 设置小值 MinAttempts 以加速测试
	GlobalExitIntentTracker().MinAttempts = 3
	defer func() {
		GlobalExitIntentTracker().Reset()
		GlobalExitIntentTracker().MinAttempts = defaultExitEscapeMinAttempts
	}()

	cfg := baseCfgWithTrader("trader_eth_case")

	// 构造 EXIT_G2 场景: HTF EMA20 > EMA50 一直拦 close_long
	signals := NewMarketSignals()
	md := &market.Data{
		TimeframeData: map[string]*market.TimeframeSeriesData{
			"1h": {
				EMA20Values: []float64{2260},
				EMA50Values: []float64{2240}, // EMA20 > EMA50 顺势
			},
		},
	}

	// 前 2 次被 EXIT_G2 拦
	for i := 1; i <= 2; i++ {
		c := newCloseLongCandidate("ETHUSDT", "ai")
		r := GateExitAction(c, signals, md, cfg)
		if r.Allowed {
			t.Errorf("第 %d 次应被 EXIT_G2 拦截", i)
		}
	}

	// 第 3 次: 触发逃生阀
	c := newCloseLongCandidate("ETHUSDT", "ai")
	r := GateExitAction(c, signals, md, cfg)
	if !r.Allowed {
		t.Errorf("第 3 次应触发逃生阀, 实际拦截: %s", r.RejectReason)
	}
	if r.RejectCode != "EXIT_ESCAPE_GRANTED" {
		t.Errorf("期望 EXIT_ESCAPE_GRANTED 标签, 实际 %s", r.RejectCode)
	}

	// 第 4 次: 逃生阀已用过，恢复拦截
	c4 := newCloseLongCandidate("ETHUSDT", "ai")
	r4 := GateExitAction(c4, signals, md, cfg)
	if r4.Allowed {
		t.Error("逃生阀已用过，第 4 次应恢复拦截")
	}
}

// TestGateExitAction_EscapeHatch_DisabledByFeatureFlag 验证 feature flag off 禁用逃生阀
func TestGateExitAction_EscapeHatch_DisabledByFeatureFlag(t *testing.T) {
	feature_flag.Reset()
	feature_flag.SetSpec("exit_escape", "off")
	defer feature_flag.Reset()

	GlobalExitIntentTracker().Reset()
	GlobalExitIntentTracker().MinAttempts = 3
	defer func() {
		GlobalExitIntentTracker().Reset()
		GlobalExitIntentTracker().MinAttempts = defaultExitEscapeMinAttempts
	}()

	cfg := baseCfgWithTrader("trader1")
	signals := NewMarketSignals()
	md := &market.Data{
		TimeframeData: map[string]*market.TimeframeSeriesData{
			"1h": {EMA20Values: []float64{100}, EMA50Values: []float64{90}},
		},
	}

	// 即使被拦 10 次，feature flag off 下逃生阀不应触发
	for i := 0; i < 10; i++ {
		c := newCloseLongCandidate("BTCUSDT", "ai")
		r := GateExitAction(c, signals, md, cfg)
		if r.Allowed {
			t.Fatalf("feature flag off 时第 %d 次不应放行, code=%s", i+1, r.RejectCode)
		}
	}
}

// TestGateExitAction_EscapeHatch_Isolation 验证逃生阀的独立性
// 不同 trader / symbol / side 互不影响
func TestGateExitAction_EscapeHatch_Isolation(t *testing.T) {
	feature_flag.Reset()
	GlobalExitIntentTracker().Reset()
	GlobalExitIntentTracker().MinAttempts = 3
	defer func() {
		GlobalExitIntentTracker().Reset()
		GlobalExitIntentTracker().MinAttempts = defaultExitEscapeMinAttempts
	}()

	cfg := baseCfgWithTrader("trader1")
	signals := NewMarketSignals()
	md := &market.Data{
		TimeframeData: map[string]*market.TimeframeSeriesData{
			"1h": {EMA20Values: []float64{100}, EMA50Values: []float64{90}},
		},
	}

	// trader1/BTC/LONG 积累 3 次
	for i := 0; i < 3; i++ {
		GateExitAction(newCloseLongCandidate("BTCUSDT", "ai"), signals, md, cfg)
	}

	// ETH 不应触发（不同 symbol）
	rEth := GateExitAction(newCloseLongCandidate("ETHUSDT", "ai"), signals, md, cfg)
	if rEth.Allowed {
		t.Error("ETH 不应因 BTC 积累而放行")
	}
}
