'use client';

import { TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type StrategyTemplate,
  type ConditionConfig,
  type IndicatorConfig,
  TIMEFRAME_OPTIONS,
} from '@/lib/strategy-templates';
import { ConditionRow } from './ConditionRow';

interface StrategyConditionCardProps {
  template: StrategyTemplate;
  indicators: IndicatorConfig[];
  buyConditions: ConditionConfig[];
  sellConditions: ConditionConfig[];
  onIndicatorChange: (index: number, indicator: IndicatorConfig) => void;
  onBuyConditionChange: (index: number, condition: ConditionConfig) => void;
  onSellConditionChange: (index: number, condition: ConditionConfig) => void;
  className?: string;
}

/**
 * 策略条件说明卡片
 * 展示买入/卖出条件，支持参数编辑
 */
export function StrategyConditionCard({
  template,
  indicators,
  buyConditions,
  sellConditions,
  onIndicatorChange,
  onBuyConditionChange,
  onSellConditionChange,
  className,
}: StrategyConditionCardProps) {
  const timeframeLabel = TIMEFRAME_OPTIONS.find(t => t.value === template.recommendedTimeframe)?.label || template.recommendedTimeframe;

  // 辅助函数：根据条件的 indicator ID 查找对应的 IndicatorConfig
  const findIndicator = (indicatorId: string) => {
    return indicators.find(ind => ind.id === indicatorId) || template.indicators[0];
  };

  return (
    <div className={cn(
      'border border-border-primary rounded-lg overflow-hidden bg-bg-secondary',
      className
    )}>
      {/* 头部：模板名称 */}
      <div className="px-4 py-3 border-b border-border-primary bg-bg-tertiary/50">
        <span className="font-medium text-text-primary">{template.name}</span>
      </div>

      {/* 买入条件区 */}
      <div className="px-4 py-4 border-b border-border-primary">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
          </div>
          <span className="text-sm font-medium text-success">买入条件</span>
          {buyConditions.length > 1 && (
            <span className="text-xs text-text-tertiary">（需同时满足）</span>
          )}
        </div>
        <div className="space-y-4 pl-8">
          {buyConditions.map((condition, idx) => {
            const indicator = findIndicator(condition.indicator);
            return (
              <ConditionRow
                key={condition.id}
                condition={condition}
                indicator={indicator}
                onConditionChange={(updated) => onBuyConditionChange(idx, updated)}
                onIndicatorChange={(updated) => {
                  const indicatorIdx = indicators.findIndex(ind => ind.id === updated.id);
                  if (indicatorIdx !== -1) {
                    onIndicatorChange(indicatorIdx, updated);
                  }
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 卖出条件区 */}
      <div className="px-4 py-4 border-b border-border-primary">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-danger/15 flex items-center justify-center">
            <TrendingDown className="w-3.5 h-3.5 text-danger" />
          </div>
          <span className="text-sm font-medium text-danger">卖出条件</span>
          {sellConditions.length > 1 && (
            <span className="text-xs text-text-tertiary">（任一满足）</span>
          )}
        </div>
        <div className="space-y-4 pl-8">
          {sellConditions.map((condition, idx) => {
            const indicator = findIndicator(condition.indicator);
            return (
              <ConditionRow
                key={condition.id}
                condition={condition}
                indicator={indicator}
                onConditionChange={(updated) => onSellConditionChange(idx, updated)}
                onIndicatorChange={(updated) => {
                  const indicatorIdx = indicators.findIndex(ind => ind.id === updated.id);
                  if (indicatorIdx !== -1) {
                    onIndicatorChange(indicatorIdx, updated);
                  }
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 底部：推荐信息 */}
      <div className="px-4 py-3 bg-bg-tertiary/30 flex items-center gap-4 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>推荐周期: {timeframeLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          <span>适合行情: {template.marketType}</span>
        </div>
      </div>
    </div>
  );
}
