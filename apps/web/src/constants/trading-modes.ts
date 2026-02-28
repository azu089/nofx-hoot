/**
 * 策略详情 — 模式说明常量 (Phase 9.7)
 *
 * 每种 tradingMode 的固定介绍文案 + 动态配置参数拼接
 * 文案通过 t 函数获取 i18n 翻译，不硬编码中文
 */

import { MODEL_DISPLAY } from './debate';
import type { LucideIcon } from 'lucide-react';
import { Zap, MessageSquare, Grid3X3, FlaskConical } from 'lucide-react';

type TFunc = (key: string, params?: Record<string, string | number>) => string;

export interface TradingModeInfo {
  title: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  description: string;
}

// 固定介绍文案（接收 t 函数）
export function getTradingModeInfo(t: TFunc): Record<string, TradingModeInfo> {
  return {
    solo: {
      title: t('modeInfo.soloTitle'),
      Icon: Zap,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.15)',
      description: t('modeInfo.soloDesc'),
    },
    debate: {
      title: t('modeInfo.debateTitle'),
      Icon: MessageSquare,
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.15)',
      description: t('modeInfo.debateDesc'),
    },
    grid: {
      title: t('modeInfo.gridTitle'),
      Icon: Grid3X3,
      color: '#10B981',
      bg: 'rgba(16,185,129,0.15)',
      description: t('modeInfo.gridDesc'),
    },
    research: {
      title: t('modeInfo.researchTitle'),
      Icon: FlaskConical,
      color: '#06B6D4',
      bg: 'rgba(6,182,212,0.15)',
      description: t('modeInfo.researchDesc'),
    },
  };
}

// 动态参数拼接
export function buildConfigSummary(tradingMode: string, strategy: any, t: TFunc): string {
  const models: string[] = (strategy.models?.length ? strategy.models : strategy.coinSourceConfig?.models) || [];
  const coinCount =
    strategy.coinSourceConfig?.coins?.length ||
    strategy.coinSourceConfig?.maxCoins ||
    0;
  const maxLev = strategy.riskControlConfig?.maxLeverage || '\u2014';
  const interval = strategy.intervalMinutes || 60;

  if (tradingMode === 'solo') {
    const name = models[0]
      ? (MODEL_DISPLAY[models[0]]?.name || models[0])
      : t('modeInfo.defaultModel');
    return `${name} \u00B7 ${coinCount} ${t('modeInfo.coins')} \u00B7 ${t('modeInfo.maxLabel')} ${maxLev}x ${t('modeInfo.leverageSuffix')} \u00B7 ${t('modeInfo.every')} ${interval} ${t('modeInfo.minutes')}`;
  }

  if (tradingMode === 'debate') {
    const modelCount = models.length || 0;
    const modelLabel = modelCount > 0
      ? t('modeInfo.modelConsensus', { count: modelCount })
      : t('modeInfo.defaultModelGroup');
    return `${modelLabel} \u00B7 ${coinCount} ${t('modeInfo.coins')} \u00B7 ${t('modeInfo.maxLabel')} ${maxLev}x ${t('modeInfo.leverageSuffix')} \u00B7 ${t('modeInfo.every')} ${interval} ${t('modeInfo.minutes')}`;
  }

  if (tradingMode === 'grid') {
    const name = models[0]
      ? (MODEL_DISPLAY[models[0]]?.name || models[0])
      : t('modeInfo.defaultModel');
    const dist = strategy.gridConfig?.distribution || 'uniform';
    const distLabel: Record<string, string> = {
      uniform: t('modeInfo.distUniform'),
      gaussian: t('modeInfo.distGaussian'),
      pyramid: t('modeInfo.distPyramid'),
    };
    return `${name} \u00B7 ${distLabel[dist] || dist}${t('modeInfo.distribution')} \u00B7 ${coinCount} ${t('modeInfo.coins')} \u00B7 ${t('modeInfo.every')} ${interval} ${t('modeInfo.minutes')}`;
  }

  return '';
}
