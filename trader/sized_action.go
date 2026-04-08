// trader/sized_action.go — v1.1 P2-4 细粒度仓位调整 action
//
// 引入 4 个新 action（基于现有 close/open 路径，加 partial_pct 缩放）:
//   - reduce_long  : 部分平多头  (qty *= partial_pct)
//   - reduce_short : 部分平空头
//   - scale_long   : 加多头     (按当前持仓 × partial_pct)
//   - scale_short  : 加空头
//
// 与现有 close_long/open_long 的关系:
//   - reduce_long ≡ close_long(qty=current*pct)
//   - scale_long  ≡ open_long(size=current*pct)
//   - 默认 pct=0.5（半仓）
//   - pct ≥ 1.0 时退化为 close_long / open_long 等效行为
//
// 任务: P2-4 Sized Adjust Actions (HOOT nofx 升级 2026-04)
package trader

import (
	"fmt"

	"nofx/kernel"
	"nofx/logger"
	"nofx/market"
	"nofx/store"
)

// 默认 partial 比例（当 AI 未指定 PartialPct 时）
const defaultPartialPct = 0.5

// resolvePartialPct 钳制并规范化 PartialPct
//   - 0 或负数 → 默认 0.5
//   - > 1.0    → 1.0（等效全平/全开）
func resolvePartialPct(p float64) float64 {
	if p <= 0 {
		return defaultPartialPct
	}
	if p > 1.0 {
		return 1.0
	}
	return p
}

// IsSizedAdjustAction 判定是否为 P2-4 新增 sized action
func IsSizedAdjustAction(action string) bool {
	switch action {
	case "reduce_long", "reduce_short", "scale_long", "scale_short":
		return true
	default:
		return false
	}
}

// executeSizedAdjustAction 派发 sized adjust action
//
// 实现策略:
//   - reduce_*: 复用现有 CloseLong/CloseShort 接口，传入 quantity = current × pct
//   - scale_*:  复用现有 executeOpenLong/Short 路径，按 pct 缩放 PositionSizeUSD
//
// 风险设计:
//   - 找不到当前持仓 → 错误返回，不静默忽略
//   - PartialPct 无效 → 用默认 0.5
//   - 与现有 OpenGate / 风控完全兼容（走相同的 caller 函数）
func (at *AutoTrader) executeSizedAdjustAction(decision *kernel.Decision, actionRecord *store.DecisionAction) error {
	pct := resolvePartialPct(decision.PartialPct)

	switch decision.Action {
	case "reduce_long":
		return at.executeReduceLong(decision, actionRecord, pct)
	case "reduce_short":
		return at.executeReduceShort(decision, actionRecord, pct)
	case "scale_long":
		return at.executeScaleLong(decision, actionRecord, pct)
	case "scale_short":
		return at.executeScaleShort(decision, actionRecord, pct)
	default:
		return fmt.Errorf("not a sized adjust action: %s", decision.Action)
	}
}

// executeReduceLong 部分平多头
// 通过 trader.CloseLong(symbol, quantity) 接口实现，quantity = current × pct
func (at *AutoTrader) executeReduceLong(decision *kernel.Decision, _ *store.DecisionAction, pct float64) error {
	logger.Infof("  📉 Reduce long: %s (pct=%.2f)", decision.Symbol, pct)
	currentQty := at.getCurrentPositionQty(decision.Symbol, "long")
	if currentQty <= 0 {
		return fmt.Errorf("reduce_long: no long position for %s", decision.Symbol)
	}
	closeQty := currentQty * pct
	_, err := at.trader.CloseLong(decision.Symbol, closeQty)
	if err != nil {
		return fmt.Errorf("reduce_long failed: %w", err)
	}
	logger.Infof("  ✓ Reduced long %s: %.8f / %.8f (%.0f%%)", decision.Symbol, closeQty, currentQty, pct*100)
	return nil
}

// executeReduceShort 部分平空头
func (at *AutoTrader) executeReduceShort(decision *kernel.Decision, _ *store.DecisionAction, pct float64) error {
	logger.Infof("  📉 Reduce short: %s (pct=%.2f)", decision.Symbol, pct)
	currentQty := at.getCurrentPositionQty(decision.Symbol, "short")
	if currentQty <= 0 {
		return fmt.Errorf("reduce_short: no short position for %s", decision.Symbol)
	}
	closeQty := currentQty * pct
	_, err := at.trader.CloseShort(decision.Symbol, closeQty)
	if err != nil {
		return fmt.Errorf("reduce_short failed: %w", err)
	}
	logger.Infof("  ✓ Reduced short %s: %.8f / %.8f (%.0f%%)", decision.Symbol, closeQty, currentQty, pct*100)
	return nil
}

// executeScaleLong 加仓多头 (v1.1 P2-4, 审计修复 Bug #5)
//
// 独立执行路径，不调用 executeOpenLongWithRecord (会被"已有同向持仓"检查拒绝)
// 仍保留核心风控：
//   - 保证金充足性检查（auto-adjust）
//   - 最小仓位检查
//   - 止损/止盈设置
//
// 明确跳过（scale 不是新开）：
//   - OpenGate AllowOpen (scale 不受 cooldown 限制)
//   - enforceMaxPositions (已占一个 slot)
//   - "已有同向持仓" 拒绝
//   - Geometry 检查（entry 已存在）
//
// safeMode 由主循环 loop 负责拦截，此处不重复判断
func (at *AutoTrader) executeScaleLong(decision *kernel.Decision, actionRecord *store.DecisionAction, pct float64) error {
	logger.Infof("  📈 Scale long: %s (pct=%.2f)", decision.Symbol, pct)
	currentValue := at.getCurrentPositionValueUSD(decision.Symbol, "long")
	if currentValue <= 0 {
		return fmt.Errorf("scale_long: no long position for %s", decision.Symbol)
	}
	addUSD := currentValue * pct
	logger.Infof("  ➕ Scale-in long %s: addUSD=%.2f (current=%.2f × %.0f%%)", decision.Symbol, addUSD, currentValue, pct*100)

	// 复用已有 scale-in 核心逻辑
	return at.executeScaleInCore(decision, actionRecord, addUSD, "long")
}

// executeScaleShort 加仓空头 (v1.1 P2-4, 审计修复 Bug #5)
func (at *AutoTrader) executeScaleShort(decision *kernel.Decision, actionRecord *store.DecisionAction, pct float64) error {
	logger.Infof("  📉 Scale short: %s (pct=%.2f)", decision.Symbol, pct)
	currentValue := at.getCurrentPositionValueUSD(decision.Symbol, "short")
	if currentValue <= 0 {
		return fmt.Errorf("scale_short: no short position for %s", decision.Symbol)
	}
	addUSD := currentValue * pct
	logger.Infof("  ➕ Scale-in short %s: addUSD=%.2f (current=%.2f × %.0f%%)", decision.Symbol, addUSD, currentValue, pct*100)

	return at.executeScaleInCore(decision, actionRecord, addUSD, "short")
}

// executeScaleInCore scale 加仓的核心下单路径
//
// 参数 addUSD: 要追加的仓位价值 USD
// 参数 side:   "long" | "short"
//
// 流程:
//  1. 取市场价格 + 账户余额
//  2. 保证金足够性检查 + auto-adjust
//  3. 最小仓位检查
//  4. 按当前持仓杠杆下单（OpenLong/OpenShort 相同接口，添加到现有仓位）
//  5. 更新 actionRecord，不重置 positionFirstSeenTime（保持原仓位时间戳）
func (at *AutoTrader) executeScaleInCore(decision *kernel.Decision, actionRecord *store.DecisionAction, addUSD float64, side string) error {
	// 1. 市场价
	marketData, err := market.GetWithExchange(decision.Symbol, at.exchange)
	if err != nil {
		return fmt.Errorf("scale %s: failed to get market data: %w", side, err)
	}

	// 2. 余额
	balance, err := at.trader.GetBalance()
	if err != nil {
		return fmt.Errorf("scale %s: failed to get balance: %w", side, err)
	}
	availableBalance := 0.0
	if avail, ok := balance["availableBalance"].(float64); ok {
		availableBalance = avail
	}

	// 3. 保证金 auto-adjust（沿用 executeOpenLong 的公式）
	leverage := decision.Leverage
	if leverage < 1 {
		leverage = 1
	}
	marginFactor := 1.01/float64(leverage) + 0.001
	maxAffordable := availableBalance / marginFactor

	actualAddUSD := addUSD
	if actualAddUSD > maxAffordable {
		adjusted := maxAffordable * 0.98
		logger.Warnf("  ⚠️ Scale-in size %.2f exceeds max affordable %.2f, reducing to %.2f", actualAddUSD, maxAffordable, adjusted)
		actualAddUSD = adjusted
	}

	// 4. 最小仓位
	if err := at.enforceMinPositionSize(actualAddUSD); err != nil {
		return fmt.Errorf("scale %s: %w", side, err)
	}

	// 5. 下单
	quantity := actualAddUSD / marketData.CurrentPrice
	actionRecord.Quantity = quantity
	actionRecord.Price = marketData.CurrentPrice

	var order map[string]interface{}
	var orderErr error
	switch side {
	case "long":
		order, orderErr = at.trader.OpenLong(decision.Symbol, quantity, leverage)
	case "short":
		order, orderErr = at.trader.OpenShort(decision.Symbol, quantity, leverage)
	default:
		return fmt.Errorf("scale: unknown side %q", side)
	}
	if orderErr != nil {
		return fmt.Errorf("scale %s failed: %w", side, orderErr)
	}

	if orderID, ok := order["orderId"].(int64); ok {
		actionRecord.OrderID = orderID
	}

	logger.Infof("  ✓ Scale-in %s succeeded: qty=%.4f, price=%.4f, addUSD=%.2f", side, quantity, marketData.CurrentPrice, actualAddUSD)

	// 6. 记录订单到 DB（action 仍用 scale_* 以便区分）
	action := "scale_" + side
	at.recordAndConfirmOrder(order, decision.Symbol, action, quantity, marketData.CurrentPrice, leverage, 0)

	// 7. scale-in 不重置 positionFirstSeenTime（保持原仓位的时间戳）
	// 也不重设 SL/TP（由原仓位管理，除非 AI 明确给出新值）
	if decision.StopLoss > 0 {
		sideUpper := "LONG"
		if side == "short" {
			sideUpper = "SHORT"
		}
		if err := at.trader.SetStopLoss(decision.Symbol, sideUpper, quantity, decision.StopLoss); err != nil {
			logger.Infof("  ⚠ Scale-in: failed to update stop loss: %v", err)
		}
	}
	if decision.TakeProfit > 0 {
		sideUpper := "LONG"
		if side == "short" {
			sideUpper = "SHORT"
		}
		if err := at.trader.SetTakeProfit(decision.Symbol, sideUpper, quantity, decision.TakeProfit); err != nil {
			logger.Infof("  ⚠ Scale-in: failed to update take profit: %v", err)
		}
	}

	return nil
}

// getCurrentPositionQty 查询当前持仓数量（绝对值）
func (at *AutoTrader) getCurrentPositionQty(symbol, side string) float64 {
	positions, err := at.trader.GetPositions()
	if err != nil {
		logger.Warnf("[sized_action] failed to get positions for %s/%s: %v", symbol, side, err)
		return 0
	}
	for _, pos := range positions {
		if pos["symbol"] != symbol {
			continue
		}
		if pos["side"] != side {
			continue
		}
		if amt, ok := pos["positionAmt"].(float64); ok {
			if amt < 0 {
				amt = -amt
			}
			return amt
		}
	}
	return 0
}

// getCurrentPositionValueUSD 查询当前持仓价值 USD
func (at *AutoTrader) getCurrentPositionValueUSD(symbol, side string) float64 {
	qty := at.getCurrentPositionQty(symbol, side)
	if qty <= 0 {
		return 0
	}
	positions, err := at.trader.GetPositions()
	if err != nil {
		return 0
	}
	for _, pos := range positions {
		if pos["symbol"] != symbol || pos["side"] != side {
			continue
		}
		var price float64
		if mp, ok := pos["markPrice"].(float64); ok && mp > 0 {
			price = mp
		} else if ep, ok := pos["entryPrice"].(float64); ok {
			price = ep
		}
		if price > 0 {
			return qty * price
		}
	}
	return 0
}
