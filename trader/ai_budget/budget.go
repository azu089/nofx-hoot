// Package ai_budget 提供策略级 AI 调用预算控制
//
// 与原版 trader.CostGuard 的差异:
//   - 策略级（按 strategy_id 隔离），不是 trader 级
//   - 配置来自 StrategyConfig.AIBudgetPolicy（用户可配），不是 env 全局开关
//   - 支持每日上限（MaxCallsPerDay），原版只有 cooldown
//   - 与 CostGuard 串联使用：任一拒绝即跳过 AI 调用
//
// 设计:
//   - 包级 registry 管理 per-strategy state，调用方零侵入
//   - policy 每次传入，运行时配置变更无缝
//   - 默认 disabled（policy=nil 或 Enabled=false → 直接放行）
//   - 持仓时强制放行（持仓必须由 AI 管理，不能跳过）
//
// 任务: P1-1 StrategyAIBudget (HOOT nofx 升级 2026-04)
package ai_budget

import (
	"fmt"
	"sync"
	"time"

	"nofx/store"
)

// state 单个策略的运行时状态
type state struct {
	lastCallAt   time.Time
	callsToday   int
	dayStartedAt time.Time
}

var (
	mu     sync.Mutex
	states = map[string]*state{}
)

// Check 评估是否应跳过本轮 AI 调用
//
// 返回 (skip, reason)
//   - 持仓 > 0: 永远不跳过（reason="positions_held"）
//   - policy 为 nil 或未启用: 永远不跳过（reason=""）
//   - cooldown 未到: 跳过
//   - 当日上限达到: 跳过
//   - skipWhenIdle=false 且无持仓: 不跳过
func Check(strategyID string, policy *store.AIBudgetPolicyConfig, positionCount int) (skip bool, reason string) {
	// 持仓时永远不跳过
	if positionCount > 0 {
		return false, ""
	}
	if policy == nil || !policy.Enabled {
		return false, ""
	}
	if strategyID == "" {
		return false, ""
	}

	mu.Lock()
	defer mu.Unlock()

	st := states[strategyID]
	if st == nil {
		st = &state{dayStartedAt: time.Now()}
		states[strategyID] = st
	}

	// 当日计数滚动
	if !sameDayUTC(st.dayStartedAt, time.Now()) {
		st.callsToday = 0
		st.dayStartedAt = time.Now()
	}

	// 每日上限
	if policy.MaxCallsPerDay > 0 && st.callsToday >= policy.MaxCallsPerDay {
		return true, fmt.Sprintf("daily_limit_reached(%d)", policy.MaxCallsPerDay)
	}

	// 无持仓 + skipWhenIdle 时检查 cooldown
	if policy.SkipWhenIdle {
		cooldown := cooldownDuration(policy)
		if !st.lastCallAt.IsZero() {
			remaining := cooldown - time.Since(st.lastCallAt)
			if remaining > 0 {
				return true, fmt.Sprintf("cooldown_remaining=%s", remaining.Round(time.Second))
			}
		}
	}

	return false, ""
}

// Record 记录一次成功的 AI 调用
// 必须在 AI 调用成功后调用，否则 cooldown 不会启动
func Record(strategyID string) {
	if strategyID == "" {
		return
	}
	mu.Lock()
	defer mu.Unlock()
	st := states[strategyID]
	if st == nil {
		st = &state{dayStartedAt: time.Now()}
		states[strategyID] = st
	}
	if !sameDayUTC(st.dayStartedAt, time.Now()) {
		st.callsToday = 0
		st.dayStartedAt = time.Now()
	}
	st.lastCallAt = time.Now()
	st.callsToday++
}

// Snapshot 返回某策略的当前状态（调试/监控用）
type Snapshot struct {
	StrategyID   string
	LastCallAt   time.Time
	CallsToday   int
	DayStartedAt time.Time
}

func GetSnapshot(strategyID string) *Snapshot {
	mu.Lock()
	defer mu.Unlock()
	st := states[strategyID]
	if st == nil {
		return nil
	}
	return &Snapshot{
		StrategyID:   strategyID,
		LastCallAt:   st.lastCallAt,
		CallsToday:   st.callsToday,
		DayStartedAt: st.dayStartedAt,
	}
}

// Reset 清空所有策略状态（测试用）
func Reset() {
	mu.Lock()
	defer mu.Unlock()
	states = map[string]*state{}
}

// cooldownDuration 取 policy 中的 cooldown，缺省 180 秒
func cooldownDuration(p *store.AIBudgetPolicyConfig) time.Duration {
	if p.CooldownSeconds > 0 {
		return time.Duration(p.CooldownSeconds) * time.Second
	}
	return 180 * time.Second
}

// sameDayUTC 判断两时间是否同一 UTC 自然日（用于每日计数滚动）
func sameDayUTC(a, b time.Time) bool {
	ay, am, ad := a.UTC().Date()
	by, bm, bd := b.UTC().Date()
	return ay == by && am == bm && ad == bd
}
