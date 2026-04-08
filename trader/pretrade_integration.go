// trader/pretrade_integration.go — v1.1 P3-4 PreTradeSimulator 主循环接入
//
// 设计:
//   - 通过 feature_flag 'pretrade_sim' 灰度启用
//   - 默认 disabled → 直接放行（零行为变化）
//   - 启用时调用 pretrade.DefaultSimulator
//   - 失败 → 错误返回 + audit 快照
//
// 任务: P3-4 PHASE_B 灰度接入 (HOOT nofx 升级 2026-04)
package trader

import (
	"fmt"

	"nofx/feature_flag"
	"nofx/kernel"
	"nofx/logger"
	"nofx/trader/audit"
	"nofx/trader/pretrade"
)

// runPreTradeSimulation 运行下单前预模拟
//
// 返回 nil 表示放行（含 feature flag 未启用）
// 返回 error 表示阻止下单
func (at *AutoTrader) runPreTradeSimulation(decision *kernel.Decision) error {
	// feature flag 检查（默认 disable）
	ctx := feature_flag.EvalCtx{StrategyID: at.strategyID, TraderID: at.id}
	if !feature_flag.Enabled("pretrade_sim", ctx) {
		return nil
	}

	// 拉取账户信息
	balance, err := at.trader.GetBalance()
	availableMargin := 0.0
	if err == nil && balance != nil {
		if v, ok := balance["availableBalance"].(float64); ok {
			availableMargin = v
		} else if v, ok := balance["available"].(float64); ok {
			availableMargin = v
		}
	}

	// 估算成交价
	markPrice := decision.StopLoss // fallback
	if markPrice == 0 {
		markPrice = decision.TakeProfit
	}
	if markPrice == 0 {
		// 如果没有 TP/SL，从市场快照拿 mark price
		// 简化处理：用 PositionSizeUSD / 默认数量估算
		markPrice = 1
	}

	side := "long"
	if decision.Action == "open_short" {
		side = "short"
	}

	// 根据 PositionSizeUSD 反推数量（简化）
	leverage := decision.Leverage
	if leverage <= 0 {
		leverage = 1
	}
	quantity := decision.PositionSizeUSD / markPrice
	if quantity <= 0 {
		quantity = 0.001 // 占位
	}

	req := pretrade.SimRequest{
		Symbol:          decision.Symbol,
		Side:            side,
		Quantity:        quantity,
		Price:           markPrice,
		Leverage:        leverage,
		AvailableMargin: availableMargin,
		MarkPrice:       markPrice,
	}

	sim := pretrade.NewDefaultSimulator()
	verdict := sim.Simulate(req)

	audit.Snapshot(at.id, at.strategyID, "pretrade_sim", map[string]any{
		"symbol":     decision.Symbol,
		"action":     decision.Action,
		"allow":      verdict.Allow,
		"reason":     verdict.Reason,
		"est_margin": verdict.EstMarginUSD,
		"checks_run": verdict.ChecksRun,
	})

	if !verdict.Allow {
		logger.Warnf("🚫 [%s] PreTradeSim blocked %s %s: %s", at.name, decision.Symbol, decision.Action, verdict.Reason)
		return fmt.Errorf("PreTradeSim blocked: %s", verdict.Reason)
	}

	logger.Infof("✓ [%s] PreTradeSim passed %s %s (est margin %.2f USDT)", at.name, decision.Symbol, decision.Action, verdict.EstMarginUSD)
	return nil
}
