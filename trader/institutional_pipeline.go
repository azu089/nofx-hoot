// trader/institutional_pipeline.go — v1.1 P3-2 InstitutionalPipeline + PM 授权
//
// 通过统一的灰度模式控制 AI 与 PositionManager 的协作方式：
//   - "off"     : 原版顺序模式（PM 决策直接 append 到 AI 决策末尾）
//   - "shadow"  : PM 决策不执行，仅记录到 audit（用于对比观察）
//   - "partial" : PM 决策覆盖同 symbol 的 AI close 提案
//   - "full"    : PM 决策对所有 close 拥有最终权威
//
// 灰度通过 P0.1 feature_flag 框架控制：HOOT_FF_pm_authority=mode_string
// 也可通过 strategy 级配置 PMAuthorityMode 覆盖
//
// 任务: P3-2 InstitutionalPipeline (HOOT nofx 升级 2026-04)
package trader

import (
	"nofx/feature_flag"
	"nofx/kernel"
	"nofx/logger"
	"nofx/trader/audit"
)

// PM 授权模式常量
const (
	PMModeOff     = "off"
	PMModeShadow  = "shadow"
	PMModePartial = "partial"
	PMModeFull    = "full"
)

// resolvePMMode 解析当前生效的 PM 授权模式
//
// 优先级:
//  1. strategy config 中的 PMAuthorityMode（per-strategy 覆盖）
//  2. feature_flag mode（per-trader 灰度）
//  3. 默认 "off"（沿用原版顺序模式）
func (at *AutoTrader) resolvePMMode() string {
	// 1. strategy config
	if at.config.StrategyConfig != nil && at.config.StrategyConfig.PMAuthorityMode != nil {
		m := *at.config.StrategyConfig.PMAuthorityMode
		if isValidPMMode(m) {
			return m
		}
	}

	// 2. feature flag
	ctx := feature_flag.EvalCtx{StrategyID: at.strategyID, TraderID: at.id}
	if feature_flag.Enabled("pm_authority", ctx) {
		mode := feature_flag.Mode("pm_authority")
		if isValidPMMode(mode) {
			return mode
		}
	}

	// 3. 默认
	return PMModeOff
}

func isValidPMMode(s string) bool {
	switch s {
	case PMModeOff, PMModeShadow, PMModePartial, PMModeFull:
		return true
	}
	return false
}

// ApplyInstitutionalPipeline 根据 PM 授权模式合并 AI 与 PM 决策
//
// 输入:
//   - aiDecisions: AI 输出的决策列表
//   - pmDecisions: PositionManager 输出的决策列表（可能为空）
//
// 输出: 合并后的最终决策列表（待 sortDecisionsByPriority 排序）
//
// 行为矩阵:
//   - off:     return append(aiDecisions, pmDecisions...) 与原版完全一致
//   - shadow:  return aiDecisions; pmDecisions 仅写 audit 不执行
//   - partial: PM 决策覆盖同 symbol AI close 提案；其他 AI 决策保留
//   - full:    PM 决策完全权威；移除所有 AI close 提案，仅保留 AI open
func (at *AutoTrader) ApplyInstitutionalPipeline(aiDecisions, pmDecisions []kernel.Decision) []kernel.Decision {
	mode := at.resolvePMMode()

	audit.Snapshot(at.id, at.strategyID, "pm_authority_mode", map[string]any{
		"mode":         mode,
		"ai_decisions": len(aiDecisions),
		"pm_decisions": len(pmDecisions),
	})

	switch mode {
	case PMModeShadow:
		return at.applyShadowMode(aiDecisions, pmDecisions)
	case PMModePartial:
		return at.applyPartialMode(aiDecisions, pmDecisions)
	case PMModeFull:
		return at.applyFullMode(aiDecisions, pmDecisions)
	default:
		// off / unknown → 原版顺序模式：PM append 到 AI 末尾
		if len(pmDecisions) == 0 {
			return aiDecisions
		}
		return append(aiDecisions, pmDecisions...)
	}
}

// applyShadowMode shadow: PM 决策仅写 audit，不影响实际执行
func (at *AutoTrader) applyShadowMode(aiDecisions, pmDecisions []kernel.Decision) []kernel.Decision {
	for _, pm := range pmDecisions {
		audit.Snapshot(at.id, at.strategyID, "pm_decision_shadow", map[string]any{
			"symbol": pm.Symbol,
			"action": pm.Action,
			"reason": pm.Reasoning,
		})
		logger.Infof("👻 [%s] PM shadow decision (NOT executed): %s %s", at.name, pm.Symbol, pm.Action)
	}
	return aiDecisions
}

// applyPartialMode partial: PM 决策覆盖同 symbol+side AI close 提案
// v1.1 审计修复 #7: dedup key 加 side，支持对冲策略（同 symbol 同时多空）
func (at *AutoTrader) applyPartialMode(aiDecisions, pmDecisions []kernel.Decision) []kernel.Decision {
	if len(pmDecisions) == 0 {
		return aiDecisions
	}

	// dedup key: symbol|side
	keyFor := func(d kernel.Decision) string {
		return d.Symbol + "|" + sideFromAction(d.Action)
	}

	// 收集 PM close 系列决策的 (symbol|side) → decision 映射
	// 只对 PM 的 close/reduce 才构建 override 索引（PM 的 scale/open 不覆盖 AI）
	pmCloseBySide := make(map[string]kernel.Decision, len(pmDecisions))
	for _, pm := range pmDecisions {
		if isCloseAction(pm.Action) {
			pmCloseBySide[keyFor(pm)] = pm
		}
	}

	// 过滤 AI 决策：同 (symbol|side) 的 close 被 PM 覆盖
	merged := make([]kernel.Decision, 0, len(aiDecisions)+len(pmDecisions))
	for _, ai := range aiDecisions {
		if isCloseAction(ai.Action) {
			if pm, exists := pmCloseBySide[keyFor(ai)]; exists {
				audit.Snapshot(at.id, at.strategyID, "pm_override_ai_close", map[string]any{
					"symbol":    ai.Symbol,
					"side":      sideFromAction(ai.Action),
					"ai_action": ai.Action,
					"pm_action": pm.Action,
					"ai_reason": ai.Reasoning,
					"pm_reason": pm.Reasoning,
				})
				logger.Infof("🏛️ [%s] PM partial override: AI %s %s → PM %s",
					at.name, ai.Symbol, ai.Action, pm.Action)
				continue // 不添加 AI 的 close
			}
		}
		merged = append(merged, ai)
	}

	// 追加所有 PM 决策（含被覆盖的 + 全新的）
	merged = append(merged, pmDecisions...)
	return merged
}

// applyFullMode full: PM 完全权威
//   - 移除所有 AI 的 close 提案（PM 完全接管平仓权）
//   - 保留 AI 的 open / hold / wait
//   - 追加所有 PM 决策
func (at *AutoTrader) applyFullMode(aiDecisions, pmDecisions []kernel.Decision) []kernel.Decision {
	merged := make([]kernel.Decision, 0, len(aiDecisions)+len(pmDecisions))
	removedCount := 0
	for _, ai := range aiDecisions {
		if isCloseAction(ai.Action) {
			audit.Snapshot(at.id, at.strategyID, "pm_full_blocked_ai_close", map[string]any{
				"symbol":    ai.Symbol,
				"ai_action": ai.Action,
				"reason":    "PM full authority — AI close suppressed",
			})
			removedCount++
			continue
		}
		merged = append(merged, ai)
	}
	if removedCount > 0 {
		logger.Infof("🏛️ [%s] PM full authority: blocked %d AI close decisions", at.name, removedCount)
	}
	merged = append(merged, pmDecisions...)
	return merged
}

// 注：isCloseAction 已在 trader/auto_trader_hoot.go 中定义（含 reduce_* 兼容）
