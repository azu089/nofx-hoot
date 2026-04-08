// Package pretrade 提供下单前预模拟（dry-run）能力
//
// 设计目标:
//   - 在真实下单前评估订单可行性：保证金 / 仓位上限 / 流动性
//   - interface 定义 + 默认实现，可注入自定义模拟器
//   - 通过 feature_flag 灰度启用：HOOT_FF_pretrade_sim=on / strategies:s1,s2 / pct:50
//   - 模拟失败 → 阻止下单 + 写入 audit
//
// 与改版差异:
//   - 改版直接在 auto_trader.go 内嵌 ExecutionSimulationGate
//   - HOOT 抽出 PreTradeSimulator interface + 默认实现 + 可拔插
//   - 与 HOOT 的 RealtimeRiskGuard 共享风控上下文（未来扩展）
//   - 灰度通过统一 feature_flag 框架（P0.1）
//
// 任务: P3-1 PreTradeSimulator (HOOT nofx 升级 2026-04)
package pretrade

import (
	"fmt"
)

// SimRequest 预模拟请求
type SimRequest struct {
	Symbol          string
	Side            string  // "long" | "short"
	Quantity        float64 // base asset 数量
	Price           float64 // 预期成交价（如市价用 mark price）
	Leverage        int
	AvailableMargin float64 // 当前可用保证金 USDT
	MarkPrice       float64 // 当前 mark price
}

// Verdict 预模拟结论
type Verdict struct {
	Allow  bool
	Reason string
	// 预估占用保证金
	EstMarginUSD float64
	// 触发的检查项
	ChecksRun []string
}

// PreTradeSimulator 接口
//
// 实现需做到:
//   - 纯函数 / 短超时（< 100ms）
//   - 不抛 panic（自行 recover）
//   - 失败时返回 Allow=false 而非 error
type PreTradeSimulator interface {
	Simulate(req SimRequest) Verdict
}

// DefaultSimulator 默认实现
//
// 检查项:
//  1. 保证金充足: req.Quantity × req.Price / leverage ≤ availableMargin × 0.95（留 5% 缓冲）
//  2. 最小订单价值: req.Quantity × req.Price ≥ minOrderUSD
//  3. 杠杆有效: 1 ≤ leverage ≤ maxLeverage（默认 125）
//  4. price/qty 非零
type DefaultSimulator struct {
	MinOrderUSD float64 // 默认 5
	MaxLeverage int     // 默认 125
	MarginBuffer float64 // 默认 0.95（保留 5% 缓冲防滑点）
}

// NewDefaultSimulator 构造默认模拟器（带合理默认值）
func NewDefaultSimulator() *DefaultSimulator {
	return &DefaultSimulator{
		MinOrderUSD:  5,
		MaxLeverage:  125,
		MarginBuffer: 0.95,
	}
}

func (s *DefaultSimulator) Simulate(req SimRequest) Verdict {
	v := Verdict{Allow: true, ChecksRun: []string{}}

	// 0. 基本输入校验
	v.ChecksRun = append(v.ChecksRun, "input_validation")
	if req.Quantity <= 0 || req.Price <= 0 {
		return Verdict{Allow: false, Reason: fmt.Sprintf("invalid qty/price: qty=%v price=%v", req.Quantity, req.Price), ChecksRun: v.ChecksRun}
	}

	// 1. 杠杆有效性
	v.ChecksRun = append(v.ChecksRun, "leverage_range")
	maxLev := s.MaxLeverage
	if maxLev <= 0 {
		maxLev = 125
	}
	leverage := req.Leverage
	if leverage < 1 {
		leverage = 1
	}
	if leverage > maxLev {
		return Verdict{Allow: false, Reason: fmt.Sprintf("leverage %d > max %d", leverage, maxLev), ChecksRun: v.ChecksRun}
	}

	// 2. 最小订单价值
	v.ChecksRun = append(v.ChecksRun, "min_order_value")
	notional := req.Quantity * req.Price
	minUSD := s.MinOrderUSD
	if minUSD <= 0 {
		minUSD = 5
	}
	if notional < minUSD {
		return Verdict{Allow: false, Reason: fmt.Sprintf("notional %.2f < min %.2f", notional, minUSD), ChecksRun: v.ChecksRun}
	}

	// 3. 保证金充足
	v.ChecksRun = append(v.ChecksRun, "margin_sufficiency")
	requiredMargin := notional / float64(leverage)
	v.EstMarginUSD = requiredMargin
	buffer := s.MarginBuffer
	if buffer <= 0 || buffer > 1 {
		buffer = 0.95
	}
	if req.AvailableMargin > 0 && requiredMargin > req.AvailableMargin*buffer {
		return Verdict{
			Allow:        false,
			Reason:       fmt.Sprintf("margin %.2f > available %.2f × %.2f buffer", requiredMargin, req.AvailableMargin, buffer),
			EstMarginUSD: requiredMargin,
			ChecksRun:    v.ChecksRun,
		}
	}

	return v
}

// NoopSimulator 空实现，永远放行（用于测试 / 灰度未启用回退）
type NoopSimulator struct{}

func (NoopSimulator) Simulate(req SimRequest) Verdict {
	return Verdict{Allow: true, Reason: "noop", ChecksRun: []string{"noop"}}
}
