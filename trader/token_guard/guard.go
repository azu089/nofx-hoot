// Package token_guard 在 AI 调用前对 prompt 预算做运行时拦截
//
// 与原版的差异:
//   - 原版只有 store.StrategyConfig.EstimateTokens() 静态分析（API 暴露给前端）
//   - 本包将其转化为运行时拦截器：每轮 AI 调用前自动评估
//   - 超过软阈值（默认 80%）记录 warn
//   - 超过硬阈值（默认 100%）阻止本轮调用，避免 API 422 / 截断
//
// 设计:
//   - 纯函数 Evaluate(cfg, provider) → Verdict
//   - 不持有状态，调用方决定如何 react
//   - 默认 disabled by config（StrategyConfig 暂未带 token_guard 字段时走默认）
//   - 软/硬阈值未来可做成 strategy config 字段，本期用常量
//
// 任务: P1-2 Token Budget Middleware (HOOT nofx 升级 2026-04)
package token_guard

import (
	"fmt"

	"nofx/store"
)

// Level 评估等级
type Level string

const (
	LevelOK      Level = "ok"
	LevelWarning Level = "warning" // ≥ 软阈值
	LevelDanger  Level = "danger"  // ≥ 硬阈值，应阻止调用
)

// 默认阈值（百分比 0-100）
const (
	DefaultSoftThresholdPct = 80
	DefaultHardThresholdPct = 100
)

// Verdict 评估结论
type Verdict struct {
	Level        Level
	EstimatedTok int
	ContextLimit int
	UsagePct     int
	Provider     string
	Reason       string
	// ShouldBlock 是否应阻止本次 AI 调用
	ShouldBlock bool
}

// Evaluate 对策略配置 + 目标 provider 做 token 预算评估
//
// cfg 为 nil 时返回 ok（无法评估，放行）
// provider 为空时使用 deepseek 默认 limit
func Evaluate(cfg *store.StrategyConfig, provider string) Verdict {
	if cfg == nil {
		return Verdict{Level: LevelOK, Reason: "nil config"}
	}

	estimate := cfg.EstimateTokens()
	limit := store.GetContextLimit(provider)
	if limit <= 0 {
		return Verdict{Level: LevelOK, Reason: "unknown provider, fallback ok"}
	}

	pct := estimate.Total * 100 / limit
	v := Verdict{
		EstimatedTok: estimate.Total,
		ContextLimit: limit,
		UsagePct:     pct,
		Provider:     provider,
	}

	switch {
	case pct >= DefaultHardThresholdPct:
		v.Level = LevelDanger
		v.ShouldBlock = true
		v.Reason = fmt.Sprintf("token estimate %d ≥ context limit %d (%d%%)", estimate.Total, limit, pct)
	case pct >= DefaultSoftThresholdPct:
		v.Level = LevelWarning
		v.Reason = fmt.Sprintf("token estimate %d ≥ %d%% of limit %d (%d%%)", estimate.Total, DefaultSoftThresholdPct, limit, pct)
	default:
		v.Level = LevelOK
	}
	return v
}
