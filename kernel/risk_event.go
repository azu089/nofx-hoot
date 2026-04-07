package kernel

// risk_event.go — Risk event types for AI knowledge injection.
//
// RiskEventInfo is a kernel-level type mirroring trader.RiskEvent,
// avoiding circular dependency (kernel cannot import trader).

import (
	"fmt"
	"strings"
	"time"
)

// RiskEventInfo describes a risk guard trigger for AI context injection.
type RiskEventInfo struct {
	Timestamp    time.Time
	Symbol       string
	Side         string
	EventType    string  // "stop_loss" / "liquidation_warning" / "grid_boundary" / "exposure_limit"
	TriggerPrice float64
	Action       string  // "closed_long" / "closed_short" / "reduced" / "grid_paused"
	Reason       string
	Success      bool
}

// FormatRiskEventsForAI formats risk events as a prompt section for AI awareness.
// Returns empty string if no events.
func FormatRiskEventsForAI(events []RiskEventInfo, lang Language) string {
	if len(events) == 0 {
		return ""
	}

	var sb strings.Builder

	if lang == LangChinese {
		sb.WriteString("\n## ⚠️ 实时风控事件（上一周期内触发）\n\n")
		for _, e := range events {
			status := "✅ 已执行"
			if !e.Success {
				status = "❌ 执行失败"
			}
			sb.WriteString(fmt.Sprintf("- %s %s %s %s：价格 $%.2f，%s，%s\n",
				e.Timestamp.Format("15:04:05"),
				e.Symbol, e.Side, e.EventType,
				e.TriggerPrice, e.Reason, status))
		}
		sb.WriteString("\n请在决策时考虑这些已执行的风控动作。不要重复对已平仓的品种开仓（除非有强烈理由）。\n\n")
	} else {
		sb.WriteString("\n## ⚠️ Real-Time Risk Events (triggered during last cycle)\n\n")
		for _, e := range events {
			status := "✅ executed"
			if !e.Success {
				status = "❌ failed"
			}
			sb.WriteString(fmt.Sprintf("- %s %s %s %s: price $%.2f, %s, %s\n",
				e.Timestamp.Format("15:04:05"),
				e.Symbol, e.Side, e.EventType,
				e.TriggerPrice, e.Reason, status))
		}
		sb.WriteString("\nConsider these risk actions in your decisions. Do not re-open positions that were just risk-closed (unless strong reasons).\n\n")
	}

	return sb.String()
}
