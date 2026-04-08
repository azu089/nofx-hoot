package trader

import (
	"testing"

	"nofx/feature_flag"
	"nofx/kernel"
)

// TestPreTradeSim_DisabledByDefaultPasses 验证默认 disabled 时不阻塞
// 任务: P3-4 PHASE_B 灰度接入 (HOOT nofx 升级 2026-04)
func TestPreTradeSim_DisabledByDefaultPasses(t *testing.T) {
	feature_flag.Reset()
	defer feature_flag.Reset()

	at := &AutoTrader{
		id:         "t1",
		name:       "test",
		strategyID: "s1",
	}
	// trader 字段为 nil，但因为 disable，不应触及
	err := at.runPreTradeSimulation(&kernel.Decision{
		Symbol:          "BTCUSDT",
		Action:          "open_long",
		PositionSizeUSD: 1000,
		Leverage:        5,
	})
	if err != nil {
		t.Errorf("默认 disabled 应放行, 实际拒绝: %v", err)
	}
}

func TestPreTradeSim_FeatureFlagOffPasses(t *testing.T) {
	feature_flag.Reset()
	feature_flag.SetSpec("pretrade_sim", "off")
	defer feature_flag.Reset()

	at := &AutoTrader{id: "t1", strategyID: "s1"}
	err := at.runPreTradeSimulation(&kernel.Decision{
		Symbol:          "BTCUSDT",
		Action:          "open_long",
		PositionSizeUSD: 1000,
		Leverage:        5,
	})
	if err != nil {
		t.Error("显式 off 应放行")
	}
}

// 注：启用路径需要 mock trader.GetBalance，本期跳过集成测试
// 单元测试已在 trader/pretrade/simulator_test.go 充分覆盖纯函数
