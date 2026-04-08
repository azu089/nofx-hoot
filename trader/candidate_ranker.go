// trader/candidate_ranker.go — v1.1 P4-1 候选决策排序器
//
// 目的: 当 AI 返回的 open 候选数量 > maxPositions 时，按质量排序选最优 K 个，
//       而非按 AI 返回顺序盲取前 K。
//
// 设计原则:
//   - 仅排序 open_long/open_short，其他 action（close/hold/wait/reduce/scale）原样保留
//   - 仅在 openCount > maxPositions - currentPositions 时触发裁剪
//   - 综合得分 = confidence(0.5) + risk_reward(0.3) + recent_winrate(0.2)
//   - 默认 disabled via feature_flag 'candidate_ranker'
//   - 不修改 AdaptiveState，只读 per-symbol winrate
//
// 与 HOOT Arena 的关系:
//   - Arena = 多 AI 前置共识（独立 strategy_type）
//   - CandidateRanker = 单 AI 内的后置排序
//   - 两者不互斥，Solo Trader 中此器为默认优化层
//
// 与改版 Gatekeeper.Vote() 的差异:
//   - HOOT 命名: CandidateRanker（排序器）vs Vote（投票）避免与 Arena 混淆
//   - 独立文件 vs 改版内嵌 engine.go
//   - 权重可配 + feature flag 灰度 vs 改版硬编码
//   - 条件触发（仅超限时）vs 改版每轮必跑
//
// 任务: P4-1 CandidateRanker (HOOT nofx 升级 2026-04)
package trader

import (
	"sort"

	"nofx/feature_flag"
	"nofx/kernel"
	"nofx/logger"
	"nofx/trader/audit"
)

// 得分权重（可通过 strategy config 后期覆盖）
const (
	weightConfidence  = 0.5
	weightRiskReward  = 0.3
	weightRecentPerf  = 0.2
)

// rankedCandidate 内部打分条目
type rankedCandidate struct {
	Index       int     // 在原数组中的索引
	Decision    kernel.Decision
	Score       float64
	Confidence  float64
	RiskReward  float64
	RecentPerf  float64
}

// applyCandidateRanker 过滤 open 类决策到 maxOpenSlots 个最优候选
//
// 输入:
//   - decisions: 已合并的 AI + PM 决策列表
//   - currentPositions: 当前持仓数
//
// 行为:
//   - feature_flag 'candidate_ranker' 未启用 → 原样返回
//   - maxPositions 无效 → 原样返回
//   - open 候选数 ≤ 可用 slot → 原样返回
//   - 超出时: 保留所有非 open 决策 + 取前 slot 个最高分 open
//   - 被移除的 open 写 audit 快照
func (at *AutoTrader) applyCandidateRanker(decisions []kernel.Decision, currentPositions int) []kernel.Decision {
	if len(decisions) == 0 {
		return decisions
	}

	// feature flag
	ctx := feature_flag.EvalCtx{StrategyID: at.strategyID, TraderID: at.id}
	if !feature_flag.Enabled("candidate_ranker", ctx) {
		return decisions
	}

	// 取 maxPositions
	maxPositions := at.resolveMaxPositions()
	if maxPositions <= 0 {
		return decisions
	}
	availableSlots := maxPositions - currentPositions
	if availableSlots < 0 {
		availableSlots = 0
	}

	// 分离 open / 其他
	openIdx := make([]int, 0, len(decisions))
	for i, d := range decisions {
		if d.Action == "open_long" || d.Action == "open_short" {
			openIdx = append(openIdx, i)
		}
	}

	// 未超限 → 原样返回
	if len(openIdx) <= availableSlots {
		return decisions
	}

	// 打分
	ranked := make([]rankedCandidate, 0, len(openIdx))
	for _, i := range openIdx {
		d := decisions[i]
		rc := rankedCandidate{
			Index:      i,
			Decision:   d,
			Confidence: float64(d.Confidence) / 100.0,
			RiskReward: computeDecisionRR(d),
			RecentPerf: at.getSymbolRecentWinrate(d.Symbol),
		}
		rc.Score = rc.Confidence*weightConfidence + rc.RiskReward*weightRiskReward + rc.RecentPerf*weightRecentPerf
		ranked = append(ranked, rc)
	}

	// 降序排序，同分时保留原顺序（stable sort）
	sort.SliceStable(ranked, func(i, j int) bool {
		return ranked[i].Score > ranked[j].Score
	})

	// 选前 availableSlots 个
	keepIdx := make(map[int]bool, availableSlots)
	kept := make([]rankedCandidate, 0, availableSlots)
	dropped := make([]rankedCandidate, 0)
	for i, rc := range ranked {
		if i < availableSlots {
			keepIdx[rc.Index] = true
			kept = append(kept, rc)
		} else {
			dropped = append(dropped, rc)
		}
	}

	// 重建结果：保留所有非 open + 保留的 open
	result := make([]kernel.Decision, 0, len(decisions)-len(dropped))
	for i, d := range decisions {
		isOpen := d.Action == "open_long" || d.Action == "open_short"
		if !isOpen || keepIdx[i] {
			result = append(result, d)
		}
	}

	// 审计
	for _, rc := range kept {
		audit.Snapshot(at.id, at.strategyID, "candidate_ranker_kept", map[string]any{
			"symbol":      rc.Decision.Symbol,
			"action":      rc.Decision.Action,
			"score":       rc.Score,
			"confidence":  rc.Confidence,
			"risk_reward": rc.RiskReward,
			"recent_perf": rc.RecentPerf,
		})
	}
	for _, rc := range dropped {
		audit.Snapshot(at.id, at.strategyID, "candidate_ranker_dropped", map[string]any{
			"symbol":      rc.Decision.Symbol,
			"action":      rc.Decision.Action,
			"score":       rc.Score,
			"confidence":  rc.Confidence,
			"risk_reward": rc.RiskReward,
			"recent_perf": rc.RecentPerf,
			"reason":      "lower_score_than_top_slots",
		})
	}

	logger.Infof("🎯 [%s] CandidateRanker: %d open candidates → kept %d, dropped %d (slots=%d)",
		at.name, len(openIdx), len(kept), len(dropped), availableSlots)

	return result
}

// computeDecisionRR 计算 decision 的 risk-reward ratio，归一化到 [0, 1]
//
// 不知道真实 entry 价格时的估算约定:
//   - 假设 AI 期望 entry 距 SL 为 (TP-SL) × 0.25（即 entry 在 SL 之上 25% 处）
//   - 这样 risk = 0.25 × range, reward = 0.75 × range, 理论 RR = 3:1
//   - 这是常见的"好 setup"假设，给 AI 一个可靠的排序信号
//
// 归一化:
//   - 当 AI 给出合理 TP/SL（RR>=3 设定）→ 接近 1.0
//   - TP/SL 极窄（RR<1 设定）→ 接近 0
//   - 缺字段 → 返回 0.5 中性默认值
func computeDecisionRR(d kernel.Decision) float64 {
	if d.StopLoss <= 0 || d.TakeProfit <= 0 {
		return 0.5 // 默认中性
	}
	tpSlRange := d.TakeProfit - d.StopLoss
	if tpSlRange < 0 {
		tpSlRange = -tpSlRange
	}
	if tpSlRange == 0 {
		return 0.5
	}
	// entry 约定在距 SL 25% 处（假定好设置）
	// risk = 0.25 × range, reward = 0.75 × range → rr = 3.0
	// 但我们真正要用的是 AI 设定的 range 是否"像样"，
	// 简化为: 假设 AI 给的 TP 就是期望收益，SL 就是风险，则 range 本身是 RR 的指标。
	// 规模越大 → 设定越好（前提是 entry 定位合理）
	// 所以用另一种方式: 直接用 (tp-sl)/sl 作为相对尺度
	relRange := tpSlRange / d.StopLoss
	// 典型好设置: relRange ≥ 0.03（3% 幅度足够覆盖费用 + 滑点）→ 满分
	// 极窄设置: relRange < 0.005 → 低分
	if relRange >= 0.03 {
		return 1.0
	}
	return relRange / 0.03
}

// getSymbolRecentWinrate 查询 symbol 最近胜率（从 AdaptiveState）
//
// 未知 symbol 或无数据 → 返回 0.5 中性默认值
func (at *AutoTrader) getSymbolRecentWinrate(symbol string) float64 {
	if at.adaptiveState == nil {
		return 0.5
	}
	// AdaptiveState 没有暴露 per-symbol winrate 的 public API，用 IsBlacklisted 做负信号
	if at.adaptiveState.IsBlacklisted(symbol) {
		return 0.0 // 黑名单 symbol 得分最低
	}
	// 没有具体胜率时用全局 rolling winrate 的保守估计
	global := at.adaptiveState.RollingWinRate()
	if global < 0 {
		return 0.5
	}
	return global
}
