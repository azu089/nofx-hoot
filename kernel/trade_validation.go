// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package kernel

import "fmt"

// ValidateOpenLong validates geometry for a long position:
// TP > Entry > SL, and minimum R:R ratio must be met.
func ValidateOpenLong(entryPrice, stopLoss, takeProfit, minRR float64) error {
	return validateOpenTradeGeometry("open_long", entryPrice, stopLoss, takeProfit, minRR)
}

// ValidateOpenShort validates geometry for a short position:
// SL > Entry > TP, and minimum R:R ratio must be met.
func ValidateOpenShort(entryPrice, stopLoss, takeProfit, minRR float64) error {
	return validateOpenTradeGeometry("open_short", entryPrice, stopLoss, takeProfit, minRR)
}

// ValidateDecisionGeometry validates an AI Decision's trade geometry.
// Returns nil for non-open actions (hold, wait, close_*).
func ValidateDecisionGeometry(d *Decision, entryPrice, minRR float64) error {
	if d == nil {
		return fmt.Errorf("decision is nil")
	}
	return validateOpenTradeGeometry(d.Action, entryPrice, d.StopLoss, d.TakeProfit, minRR)
}

// validateOpenTradeGeometry enforces price geometry and minimum risk/reward.
//
//	long  => take_profit > entry_price > stop_loss
//	short => stop_loss > entry_price > take_profit
func validateOpenTradeGeometry(action string, entryPrice, stopLoss, takeProfit, minRR float64) error {
	if action != "open_long" && action != "open_short" {
		return nil // non-open actions pass through
	}
	if entryPrice <= 0 {
		return fmt.Errorf("entry price must be > 0, got %.6f", entryPrice)
	}
	if stopLoss <= 0 || takeProfit <= 0 {
		return fmt.Errorf("stop_loss (%.6f) and take_profit (%.6f) must be > 0", stopLoss, takeProfit)
	}
	if minRR <= 0 {
		minRR = 1.5
	}

	var risk, reward float64
	switch action {
	case "open_long":
		if !(takeProfit > entryPrice && entryPrice > stopLoss) {
			return fmt.Errorf("invalid long geometry: require TP %.4f > entry %.4f > SL %.4f",
				takeProfit, entryPrice, stopLoss)
		}
		risk = entryPrice - stopLoss
		reward = takeProfit - entryPrice
	case "open_short":
		if !(stopLoss > entryPrice && entryPrice > takeProfit) {
			return fmt.Errorf("invalid short geometry: require SL %.4f > entry %.4f > TP %.4f",
				stopLoss, entryPrice, takeProfit)
		}
		risk = stopLoss - entryPrice
		reward = entryPrice - takeProfit
	}

	if risk <= 0 || reward <= 0 {
		return fmt.Errorf("risk/reward distances must be > 0 (risk=%.4f, reward=%.4f)", risk, reward)
	}

	rr := reward / risk
	if rr < minRR {
		return fmt.Errorf("R:R ratio %.2f:1 below minimum %.2f:1 (entry=%.4f SL=%.4f TP=%.4f)",
			rr, minRR, entryPrice, stopLoss, takeProfit)
	}

	return nil
}
