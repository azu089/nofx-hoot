/**
 * 策略详情 — 模式说明常量 (Phase 9.7)
 *
 * 每种 tradingMode 的固定介绍文案 + 动态配置参数拼接
 */

import { MODEL_DISPLAY } from './debate';

// 固定介绍文案
export const TRADING_MODE_INFO: Record<string, {
  title: string;
  icon: string;
  color: string;
  bg: string;
  description: string;
}> = {
  solo: {
    title: '极速模式',
    icon: '\u26A1',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.15)',
    description:
      '单个 AI 模型在每个执行周期对持仓币种进行技术面 + 衍生品数据分析，一次性输出交易决策（方向、杠杆、止损止盈）。特点是响应快、决策链路短，适合趋势明确的行情。',
  },
  debate: {
    title: '共识模式',
    icon: '\u{1F91D}',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.15)',
    description:
      '多个 AI 模型各自独立分析相同市场数据，分别给出交易方向和置信度，再通过加权投票机制达成共识决策。多模型交叉验证可降低单一模型偏差，适合震荡或信号不明确的行情。',
  },
};

// 动态参数拼接
export function buildConfigSummary(tradingMode: string, strategy: any): string {
  const models = (strategy.models as string[]) || [];
  const coinCount =
    strategy.coinSourceConfig?.coins?.length ||
    strategy.coinSourceConfig?.maxCoins ||
    0;
  const maxLev = strategy.riskControlConfig?.maxLeverage || '\u2014';
  const interval = strategy.intervalMinutes || 60;

  if (tradingMode === 'solo') {
    const name = models[0]
      ? (MODEL_DISPLAY[models[0]]?.name || models[0])
      : '\u9ED8\u8BA4\u6A21\u578B';
    return `${name} \u00B7 ${coinCount} \u5E01\u79CD \u00B7 \u6700\u5927 ${maxLev}x \u6760\u6746 \u00B7 \u6BCF ${interval} \u5206\u949F`;
  }

  if (tradingMode === 'debate') {
    const names =
      models.length > 0
        ? models.map((m) => MODEL_DISPLAY[m]?.name || m).join(' + ')
        : '\u9ED8\u8BA4\u6A21\u578B\u7EC4';
    const rounds = strategy.debateConfig?.maxRounds || 3;
    return `${names} \u00B7 ${rounds} \u8F6E\u8FA9\u8BBA \u00B7 ${coinCount} \u5E01\u79CD \u00B7 \u6700\u5927 ${maxLev}x \u6760\u6746 \u00B7 \u6BCF ${interval} \u5206\u949F`;
  }

  return '';
}
