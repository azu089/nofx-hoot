/**
 * AI 安全层默认值（系统级护栏）
 *
 * 系统级指标阈值（不暴露给用户的 RSI/ATR/资金费率默认值）：
 * - 用户可配的 9 个核心风控参数在 RiskControlConfig 接口中定义
 * - 本文件仅包含不暴露给用户的指标阈值 (RSI/ATR/资金费率)
 * - 用户未配置时，使用这些系统默认值
 */
export const AI_SAFETY_DEFAULTS = {
  // ── L3: RSI 软警告阈值（不拦截） ──
  rsiOverbought: 80, // RSI > 80 做多风险高
  rsiOversold: 20, // RSI < 20 做空风险高

  // ── L7: 单持仓 Drawdown 软警告 ──
  drawdownBlockThreshold: -30, // 任一持仓亏损 >30%

  // ── L8: 资金费率分级阈值 ──
  fundingRateExtreme: 0.001, // |FR| > 0.1%/8h → 硬拦截
  fundingRateHigh: 0.0005, // |FR| > 0.05%/8h → 软警告
  fundingRateNegativeBenefit: -0.0005, // FR < -0.05%/8h + 做多 → 软提示收益

  // ── L9: ATR 波动率守卫 ──
  atrExtremeRatio: 3.0, // ATR3/ATR14 > 3.0 → 硬拦截
  atrAnomalyRatio: 2.0, // ATR3/ATR14 > 2.0 → 需更高共识
  atrAnomalyMinConfidence: 80, // 波动异常时最低信心度要求

  // ── L9: 单小时价格变化率守卫（黑天鹅检测，ATR 滞后补偿） ──
  priceChange1hExtreme: 8.0, // |1h涨跌| > 8% → 硬拦截新开仓
  priceChange1hHigh: 5.0, // |1h涨跌| > 5% → 软警告（不拦截）

  // ── R:R 系统默认下限（用户可在策略 riskControlConfig.minRiskRewardRatio 覆盖） ──
  // 对齐 nofx: nofx 无 R:R 硬约束。默认 1.0 作为兜底，用户可通过策略配置自行调整
  minRiskRewardRatio: 1.0,

  // ── L2: 共识（仅 Research 模式使用，Solo/Debate 跳过 L2） ──
  minConsensusModels: 2,

  // ── 执行层默认值 ──
  defaultLeverage: 5, // AI 未指定杠杆时的默认值
  defaultPositionSizeUSD: 50, // AI 未指定仓位时的默认值

  // ── 仓位价值比约束（D6 auto-cap 默认值） ──
  btcEthMaxRatio: 5.0, // BTC/ETH: position ≤ equity × 5.0
  altMaxRatio: 1.0, // 山寨币: position ≤ equity × 1.0

  // ── 最小仓位系统硬底（用户 minPositionSize 不能低于此） ──
  minPositionSizeMajor: 60, // BTC/ETH: margin ≥ 60 USDT
  minPositionSizeAlt: 12, // 山寨币: margin ≥ 12 USDT
};
