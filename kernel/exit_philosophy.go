// kernel/exit_philosophy.go — 退出哲学模板
//
// 三种退出哲学:
//   - mechanical: 固定止损 + 30% peak 回撤 + 三条件平仓（默认）
//   - signal_driven: 禁止固定百分比平仓，仅信号驱动 + 趋势完好持有
//   - hybrid: 硬止损底线 + 信号驱动触发
//
// 通过 PromptBuilder.WithPhilosophy(p) 设置，由 system prompt 装配
package kernel

// ─── 中文模板 ────────────────────────────────────────────────────────────────

// exitGuidanceMechanicalZH 机械风格（默认，零行为变更）
func exitGuidanceMechanicalZH() string {
	return `### 信号驱动平仓
- 平仓需要同时满足以下三个条件：
  1. EMA趋势反转（EMA20穿越EMA50反向）
  2. OI萎缩（持仓量持续下降，资金在撤出）
  3. 最小持仓时间已满足（避免因噪音过早退出）
- 三个条件同时满足才建议平仓
- 如果只满足1-2个条件，考虑减仓而非全部平仓`
}

// exitGuidanceSignalDrivenZH 严格信号驱动 — 禁止机械平仓
func exitGuidanceSignalDrivenZH() string {
	return `### 信号驱动平仓（严格）
- **禁止**基于固定百分比回撤进行机械平仓
- 趋势完好时，回撤是正常波动，应持有而非平仓
- 平仓必须由以下信号驱动：
  1. **趋势反转确认**: EMA 反向交叉持续 ≥3 根主信号 K 线
  2. **持仓量崩塌**: OI 在 3 根 K 线内萎缩 ≥10%
  3. **结构破坏**: 价格跌破上一个关键支撑（多头）/突破上一个关键阻力（空头）
- 至少 2 个信号同时确认才平仓
- 仅 1 个信号: 减仓 30%
- 0 信号: 持有，不要因短期波动出场`
}

// exitGuidanceHybridZH 推荐默认 — 硬底线 + 信号驱动
func exitGuidanceHybridZH() string {
	return `### 信号驱动平仓（混合模式）
- **硬止损底线**: 单仓亏损 ≥ -5% 必须平仓（保护资本）
- 在硬底线之上，优先用信号判断，而非机械百分比：
  1. **趋势反转**: EMA 反向交叉 + 持续 ≥3 根 K 线
  2. **持仓量萎缩**: OI 持续下降 ≥10%
  3. **支撑破位**: 关键价位破位
- 三个信号同时满足：全部平仓
- 两个信号满足：减仓 50%
- 仅一个信号或趋势完好：持有
- **判定优先级**: 硬底线 > 信号驱动 > 时间窗口`
}

// ─── 英文模板 ────────────────────────────────────────────────────────────────

func exitGuidanceMechanicalEN() string {
	return `### Signal-Driven Exit
- Exit requires ALL THREE conditions to be met simultaneously:
  1. EMA trend reversal (EMA20 crosses EMA50 in opposite direction)
  2. OI contraction (open interest declining — capital is exiting)
  3. Minimum hold time elapsed (avoid noise-driven premature exits)
- All three conditions must be met before recommending a full close
- If only 1-2 conditions met, consider partial close instead of full exit`
}

func exitGuidanceSignalDrivenEN() string {
	return `### Signal-Driven Close (Strict)
- **Never** close based on fixed-percentage drawdown rules
- Trend pullbacks are normal volatility — hold, don't close
- Closes must be driven by these signals:
  1. **Trend Reversal Confirmation**: EMA reverse cross persists ≥3 primary K-lines
  2. **OI Collapse**: OI shrinks ≥10% within 3 K-lines
  3. **Structure Break**: Price breaks key support (long) / resistance (short)
- Close only when ≥2 signals confirm simultaneously
- Single signal: reduce 30%
- Zero signals: hold, do not exit on short-term volatility`
}

func exitGuidanceHybridEN() string {
	return `### Signal-Driven Close (Hybrid)
- **Hard stop floor**: Position loss ≥ -5% MUST close (capital protection)
- Above the hard floor, prioritize signal-based judgment over mechanical percentages:
  1. **Trend Reversal**: EMA reverse cross + persists ≥3 K-lines
  2. **OI Shrinking**: OI declines persistently ≥10%
  3. **Support Break**: Key price level broken
- All three signals: full close
- Two signals: reduce 50%
- One signal or trend intact: hold
- **Priority order**: Hard floor > Signal-driven > Time window`
}

// ─── 路由器 ──────────────────────────────────────────────────────────────────

// getExitGuidanceZH 根据 philosophy 返回中文退出指引
func getExitGuidanceZH(philosophy string) string {
	switch philosophy {
	case "signal_driven":
		return exitGuidanceSignalDrivenZH()
	case "hybrid":
		return exitGuidanceHybridZH()
	default:
		return exitGuidanceMechanicalZH()
	}
}

// getExitGuidanceEN 根据 philosophy 返回英文退出指引
func getExitGuidanceEN(philosophy string) string {
	switch philosophy {
	case "signal_driven":
		return exitGuidanceSignalDrivenEN()
	case "hybrid":
		return exitGuidanceHybridEN()
	default:
		return exitGuidanceMechanicalEN()
	}
}
