/**
 * AI 安全层默认值（非用户面向）
 *
 * 这些阈值不暴露给用户配置，仅在代码层面作为安全护栏。
 * 用户可配置的风控参数在 AiConfig (DTO) 中定义。
 *
 * 设计参考: NoFx — 用户只配置 9 个核心风控参数，
 * RSI/ATR/资金费率等指标阈值由代码强制执行。
 */
export const AI_SAFETY_DEFAULTS = {
  // ── L3: RSI 指标阈值 ──
  rsiOverbought: 80, // RSI > 80 禁止做多
  rsiOversold: 20, // RSI < 20 禁止做空

  // ── L7: 单持仓 Drawdown 保护 ──
  drawdownBlockThreshold: -30, // 任一持仓亏损 >30% 暂停开新仓

  // ── L8: 资金费率分级阈值 ──
  fundingRateExtreme: 0.001, // |FR| > 0.1%/8h → 硬拦截
  fundingRateHigh: 0.0005, // |FR| > 0.05%/8h → 软警告
  fundingRateNegativeBenefit: -0.0005, // FR < -0.05%/8h + 做多 → 软提示收益

  // ── L9: ATR 波动率守卫 ──
  atrExtremeRatio: 3.0, // ATR3/ATR14 > 3.0 → 硬拦截
  atrAnomalyRatio: 2.0, // ATR3/ATR14 > 2.0 → 需更高共识
  atrAnomalyMinConfidence: 80, // 波动异常时最低信心度要求

  // ── L9: 风险收益比（Phase 9.0: 对齐 NoFx R/R ≥ 3.0） ──
  minRiskRewardRatio: 3.0, // TP/SL ≥ 3:1

  // ── L2: 多模型共识 ──
  minConsensusModels: 3, // 至少 3/5 模型同意

  // ── 执行层默认值 ──
  defaultLeverage: 5, // AI 未指定杠杆时的默认值
  defaultPositionSizeUSD: 50, // AI 未指定仓位时的默认值

  // ── 仓位价值比约束（NoFx 代码强制） ──
  btcEthMaxRatio: 5.0, // BTC/ETH: position ≤ equity × 5.0
  altMaxRatio: 1.0, // 山寨币: position ≤ equity × 1.0

  // ── 最小仓位（对齐 NoFx validateDecision MinPositionSize） ──
  minPositionSizeMajor: 60, // BTC/ETH: margin ≥ 60 USDT
  minPositionSizeAlt: 12, // 山寨币: margin ≥ 12 USDT
};
