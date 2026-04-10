// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

// trader/pretrade_integration.go — PreTradeSimulator 主循环接入
//
// 设计:
//   - 通过 feature_flag 'pretrade_sim' 灰度启用
//   - 默认 disabled → 直接放行
//   - 启用时调用 pretrade.DefaultSimulator
//   - 失败 → 错误返回 + audit 快照
package trader

import (
	"fmt"

	"nofx/feature_flag"
	"nofx/kernel"
	"nofx/logger"
	"nofx/market"
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

	// 取实时 mark price（优先从 market cache，fallback 到 TP/SL 估算）
	markPrice := 0.0
	if md, err := market.GetWithExchange(decision.Symbol, at.exchange); err == nil && md != nil && md.CurrentPrice > 0 {
		markPrice = md.CurrentPrice
	}
	if markPrice == 0 {
		// fallback: 用 TP 与 SL 中点做合理估算
		if decision.StopLoss > 0 && decision.TakeProfit > 0 {
			markPrice = (decision.StopLoss + decision.TakeProfit) / 2
		} else if decision.StopLoss > 0 {
			markPrice = decision.StopLoss
		} else if decision.TakeProfit > 0 {
			markPrice = decision.TakeProfit
		}
	}
	if markPrice <= 0 {
		// 彻底拿不到价格 → 审计记录后放行（不阻塞主流程）
		audit.Snapshot(at.id, at.strategyID, "pretrade_sim_skipped", map[string]any{
			"symbol": decision.Symbol,
			"reason": "markPrice unavailable",
		})
		logger.Warnf("⚠️ [%s] PreTradeSim skipped (no markPrice for %s)", at.name, decision.Symbol)
		return nil
	}

	side := "long"
	if decision.Action == "open_short" {
		side = "short"
	}

	leverage := decision.Leverage
	if leverage <= 0 {
		leverage = 1
	}
	quantity := decision.PositionSizeUSD / markPrice
	if quantity <= 0 {
		// PositionSizeUSD 未设 → 审计放行
		audit.Snapshot(at.id, at.strategyID, "pretrade_sim_skipped", map[string]any{
			"symbol": decision.Symbol,
			"reason": "position size unset",
		})
		return nil
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
