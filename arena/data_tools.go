// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package arena

import (
	"fmt"
	"strings"
)

// ---------------------------------------------------------------------------
// data_tools.go — 账户/持仓/风控上下文的格式化工具
//
// 这些函数为 9 个推理角色（Bull / Bear / ResearchManager / Trader /
// 3 风控辩论 / PortfolioManager）提供预喂的账户状态信息。
//
// 4 个分析师（Market / Social / News / Fundamentals）不使用这些函数，
// 它们通过 tool calling 自主探索市场数据（见 tool_executor.go）。
// ---------------------------------------------------------------------------

// FormatAccountContext 格式化账户余额和持仓信息（给 Trader / PortfolioManager 看）
//
// 输出包含 Trader / PM 做风险决策需要的所有关键指标：
//   - Total Equity = 账户净值 (wallet + unrealized PnL)
//   - Wallet Balance = 钱包余额（未含未实现 PnL）
//   - Available Margin = 可开新仓的可用保证金
//   - Total Unrealized PnL = 总未实现盈亏
//   - Margin Used % = 保证金使用率
//   - 持仓明细：含 mark price / leverage / unrealized PnL / margin used
func FormatAccountContext(state *ArenaState) string {
	var b strings.Builder
	b.WriteString("=== Current Account ===\n")
	b.WriteString(fmt.Sprintf("Exchange: %s\n", defaultIfEmpty(state.ExchangeType, "unknown")))
	b.WriteString(fmt.Sprintf("Total Equity: $%.2f USDT (Net value = Wallet + Unrealized PnL)\n", state.AccountBalance))
	b.WriteString(fmt.Sprintf("Wallet Balance: $%.2f | Available Margin: $%.2f\n", state.WalletBalance, state.AvailableMargin))

	// 总未实现 PnL
	pnlSign := "+"
	if state.TotalUnrealizedPnL < 0 {
		pnlSign = ""
	}
	b.WriteString(fmt.Sprintf("Total Unrealized PnL: %s$%.2f\n", pnlSign, state.TotalUnrealizedPnL))

	// 保证金使用率
	if state.MarginUsedPct > 0 {
		b.WriteString(fmt.Sprintf("Margin Used: %.1f%% of wallet\n", state.MarginUsedPct*100))
	} else {
		b.WriteString("Margin Used: 0.0% of wallet\n")
	}

	b.WriteString("\n=== Current Positions ===\n")
	if len(state.CurrentPositions) == 0 {
		b.WriteString("No open positions.\n")
	} else {
		for i, p := range state.CurrentPositions {
			sign := "+"
			if p.UnrealizedPnL < 0 {
				sign = ""
			}
			// 显示 mark price 让 AI 对比当前价位
			markStr := ""
			if p.MarkPrice > 0 {
				markStr = fmt.Sprintf(" mark=$%.2f", p.MarkPrice)
			}
			b.WriteString(fmt.Sprintf("%d. %s %s qty=%.4f entry=$%.2f%s leverage=%dx unrealizedPnL=%s$%.2f margin=$%.2f\n",
				i+1, p.Symbol, p.Side, p.Quantity, p.EntryPrice, markStr, p.Leverage, sign, p.UnrealizedPnL, p.MarginUsed))
		}
	}
	return b.String()
}

func defaultIfEmpty(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

// FormatPositionsBrief 格式化持仓简要信息（给分析师/研究员看，只列方向和币种）
func FormatPositionsBrief(positions []PositionSnapshot) string {
	if len(positions) == 0 {
		return "Current Positions: None"
	}
	var parts []string
	for _, p := range positions {
		parts = append(parts, fmt.Sprintf("%s %s", p.Symbol, p.Side))
	}
	return "Current Positions: " + strings.Join(parts, ", ")
}

// FormatRiskConstraints 格式化风控约束（给 Trader / Risk Debaters 看）
func FormatRiskConstraints(rc RiskConfigSnapshot) string {
	var b strings.Builder
	b.WriteString("=== Risk Constraints ===\n")
	b.WriteString(fmt.Sprintf("Max Leverage: %dx | Max Positions: %d\n", rc.MaxLeverage, rc.MaxPositions))
	if rc.PositionSizeRatio > 0 {
		b.WriteString(fmt.Sprintf("Position Size: ≤%.0f%% of balance per trade\n", rc.PositionSizeRatio*100))
	}
	if rc.MaxMarginUsage > 0 {
		b.WriteString(fmt.Sprintf("Max Margin Usage: %.0f%%\n", rc.MaxMarginUsage*100))
	}
	if rc.MinRiskReward > 0 {
		b.WriteString(fmt.Sprintf("Min Risk/Reward: %.1f\n", rc.MinRiskReward))
	}
	if rc.MinConfidence > 0 {
		b.WriteString(fmt.Sprintf("Min Confidence: %d%%\n", rc.MinConfidence))
	}
	return b.String()
}
