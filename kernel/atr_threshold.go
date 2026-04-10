// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

// kernel/atr_threshold.go — ATR 自适应止盈阈值
//
// 设计:
//   - 公式: threshold = clamp(Multiplier × (ATR/Price) × Leverage, Min, Max)
//   - 配置: StrategyConfig.ATRAdaptive
//   - 默认: Multiplier=2.0 / Min=0.5% / Max=5%
//   - nil/disabled 时返回 0 → 调用方回退到固定阈值
//
// 抽出独立函数便于单元测试，默认 disabled 由策略配置开启。
package kernel

import (
	"nofx/store"
)

// 默认 ATR 自适应参数
const (
	defaultATRMultiplier   = 2.0
	defaultATRMinThreshold = 0.005 // 0.5%
	defaultATRMaxThreshold = 0.05  // 5%
)

// ComputeATRPullbackThreshold 根据 ATR 计算止盈/回撤动态阈值
//
// 返回 0 表示未启用（caller 应回退到固定阈值如 0.30）
//
// 参数:
//   - cfg: 策略配置（nil 或 ATRAdaptive=nil 时未启用）
//   - atr14: 当前 ATR14 值（绝对价格幅度）
//   - markPrice: 当前价格（用于归一化）
//   - leverage: 当前杠杆（≥1）
//
// 返回:
//   - threshold: 0..1 之间的归一化阈值，例如 0.025 表示 2.5%
//   - 0: 表示未启用或参数异常
func ComputeATRPullbackThreshold(cfg *store.StrategyConfig, atr14, markPrice float64, leverage int) float64 {
	if cfg == nil || cfg.ATRAdaptive == nil || !cfg.ATRAdaptive.Enabled {
		return 0
	}
	if atr14 <= 0 || markPrice <= 0 {
		return 0
	}
	if leverage < 1 {
		leverage = 1
	}

	mult := cfg.ATRAdaptive.Multiplier
	if mult <= 0 {
		mult = defaultATRMultiplier
	}
	minT := cfg.ATRAdaptive.MinThreshold
	if minT <= 0 {
		minT = defaultATRMinThreshold
	}
	maxT := cfg.ATRAdaptive.MaxThreshold
	if maxT <= 0 {
		maxT = defaultATRMaxThreshold
	}
	if minT >= maxT {
		// 配置异常：回退默认
		minT = defaultATRMinThreshold
		maxT = defaultATRMaxThreshold
	}

	atrPct := atr14 / markPrice
	threshold := mult * atrPct * float64(leverage)

	if threshold < minT {
		return minT
	}
	if threshold > maxT {
		return maxT
	}
	return threshold
}

// ResolveATRPullbackOrFixed 对 caller 友好的封装
//
// 当 ATR 自适应启用时返回动态阈值，否则返回固定 fallback。
// fallback 通常是 0.30（即 30% peak 回撤）。
//
// 注意阈值语义不同：
//   - ATR 自适应: 价格变动比例（如 0.025 = 2.5% 价格波动）
//   - 固定阈值: peak PnL 回撤比例（如 0.30 = 回吐 30% 峰值利润）
//
// caller 需根据是否启用使用不同的判定逻辑：
//
//	if t := ComputeATRPullbackThreshold(...); t > 0 {
//	    // 用 t 判定 priceMove
//	} else {
//	    // 用 0.30 判定 peakPnL drawdown
//	}
func ResolveATRPullbackOrFixed(cfg *store.StrategyConfig, atr14, markPrice float64, leverage int, fallback float64) (threshold float64, isATR bool) {
	if t := ComputeATRPullbackThreshold(cfg, atr14, markPrice, leverage); t > 0 {
		return t, true
	}
	return fallback, false
}

// getStrategyConfigForATR 从 Context 提取 strategy config（nil-safe）
// formatter.go 在持仓循环外调用一次，避免重复访问
func getStrategyConfigForATR(ctx *Context) *store.StrategyConfig {
	if ctx == nil {
		return nil
	}
	return ctx.StrategyConfig
}

// getPositionATR14 从 Context 中提取指定 symbol 的 ATR14
// 优先用 IntradaySeries.ATR14（最高频），其次回退到任意 timeframe 的 ATR14
// 找不到返回 0
func getPositionATR14(ctx *Context, symbol string) float64 {
	if ctx == nil || ctx.MarketDataMap == nil {
		return 0
	}
	mdata, ok := ctx.MarketDataMap[symbol]
	if !ok || mdata == nil {
		return 0
	}
	if mdata.IntradaySeries != nil && mdata.IntradaySeries.ATR14 > 0 {
		return mdata.IntradaySeries.ATR14
	}
	// 回退到任意 timeframe
	for _, tf := range mdata.TimeframeData {
		if tf != nil && tf.ATR14 > 0 {
			return tf.ATR14
		}
	}
	return 0
}
