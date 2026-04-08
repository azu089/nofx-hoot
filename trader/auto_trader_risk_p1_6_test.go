package trader

import (
	"testing"

	"nofx/store"
)

// TestResolveMinPositionUSD_DefaultsAndOverride 验证 P1-6 配置化的解析
func TestResolveMinPositionUSD_DefaultsAndOverride(t *testing.T) {
	// 1. nil config → 默认值
	at := &AutoTrader{}
	if got := at.resolveMinPositionUSD(); got != defaultMinPositionUSD {
		t.Errorf("nil config 期望默认 %.2f, 实际 %.2f", defaultMinPositionUSD, got)
	}

	// 2. 配置 0 → 默认值
	at.config.StrategyConfig = &store.StrategyConfig{
		RiskControl: store.RiskControlConfig{MinPositionSize: 0},
	}
	if got := at.resolveMinPositionUSD(); got != defaultMinPositionUSD {
		t.Errorf("0 配置期望默认 %.2f, 实际 %.2f", defaultMinPositionUSD, got)
	}

	// 3. 配置正值 → 用配置
	at.config.StrategyConfig.RiskControl.MinPositionSize = 25.5
	if got := at.resolveMinPositionUSD(); got != 25.5 {
		t.Errorf("配置 25.5 期望 25.5, 实际 %.2f", got)
	}
}

func TestResolveMaxPositions_DefaultsAndOverride(t *testing.T) {
	at := &AutoTrader{}
	if got := at.resolveMaxPositions(); got != defaultMaxPositions {
		t.Errorf("nil config 期望默认 %d, 实际 %d", defaultMaxPositions, got)
	}

	at.config.StrategyConfig = &store.StrategyConfig{
		RiskControl: store.RiskControlConfig{MaxPositions: 0},
	}
	if got := at.resolveMaxPositions(); got != defaultMaxPositions {
		t.Errorf("0 配置期望默认 %d, 实际 %d", defaultMaxPositions, got)
	}

	at.config.StrategyConfig.RiskControl.MaxPositions = 5
	if got := at.resolveMaxPositions(); got != 5 {
		t.Errorf("配置 5 期望 5, 实际 %d", got)
	}
}

func TestEnforceMinPositionSize_BoundaryAndPass(t *testing.T) {
	at := &AutoTrader{
		config: AutoTraderConfig{
			StrategyConfig: &store.StrategyConfig{
				RiskControl: store.RiskControlConfig{MinPositionSize: 20},
			},
		},
	}

	// 正常路径：超过最小值
	if err := at.enforceMinPositionSize(25); err != nil {
		t.Errorf("25 USDT 应通过最小 20: %v", err)
	}
	// 边界：精确等于
	if err := at.enforceMinPositionSize(20); err != nil {
		t.Errorf("精确等于最小值应通过: %v", err)
	}
	// 异常：低于最小值
	if err := at.enforceMinPositionSize(19.99); err == nil {
		t.Error("19.99 USDT 应被拦截（最小 20）")
	}
}

func TestEnforceMaxPositions_BoundaryAndPass(t *testing.T) {
	at := &AutoTrader{
		config: AutoTraderConfig{
			StrategyConfig: &store.StrategyConfig{
				RiskControl: store.RiskControlConfig{MaxPositions: 3},
			},
		},
	}

	// 正常：低于上限
	if err := at.enforceMaxPositions(2); err != nil {
		t.Errorf("2 < 3 应通过: %v", err)
	}
	// 边界：等于上限
	if err := at.enforceMaxPositions(3); err == nil {
		t.Error("等于上限应拦截")
	}
	// 异常：超过
	if err := at.enforceMaxPositions(5); err == nil {
		t.Error("超过上限应拦截")
	}
}

func TestEnforce_NilConfigUsesDefaults(t *testing.T) {
	at := &AutoTrader{}

	// 默认 12 USDT
	if err := at.enforceMinPositionSize(11); err == nil {
		t.Error("低于默认 12 应拦截")
	}
	if err := at.enforceMinPositionSize(12); err != nil {
		t.Errorf("等于默认 12 应通过: %v", err)
	}

	// 默认 3 仓
	if err := at.enforceMaxPositions(3); err == nil {
		t.Error("等于默认上限 3 应拦截")
	}
	if err := at.enforceMaxPositions(2); err != nil {
		t.Errorf("低于默认上限应通过: %v", err)
	}
}
