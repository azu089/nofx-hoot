'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Settings,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Save,
  RotateCcw,
  Info,
} from 'lucide-react';

// 策略参数类型
export interface StrategyParams {
  takeProfitPercent: number;      // 10-50
  maxOpenTrades: number;          // 3-10
  entryAggressiveness: 'conservative' | 'standard' | 'aggressive';
  stopLossPercent: number;        // 3-10
}

// 默认参数
const DEFAULT_PARAMS: StrategyParams = {
  takeProfitPercent: 20,
  maxOpenTrades: 5,
  entryAggressiveness: 'standard',
  stopLossPercent: 5,
};

// 组件属性
interface AdvancedSettingsProps {
  strategyId?: string;
  defaultValues?: Partial<StrategyParams>;
  onChange?: (params: StrategyParams) => void;
  onSave?: (params: StrategyParams) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

// 简易滑块组件
function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

export function AdvancedSettings({
  strategyId,
  defaultValues,
  onChange,
  onSave,
  disabled = false,
  className = '',
}: AdvancedSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [params, setParams] = useState<StrategyParams>({
    ...DEFAULT_PARAMS,
    ...defaultValues,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 检测变化
  useEffect(() => {
    const initialParams = { ...DEFAULT_PARAMS, ...defaultValues };
    const changed = JSON.stringify(params) !== JSON.stringify(initialParams);
    setHasChanges(changed);
  }, [params, defaultValues]);

  // 更新参数
  const handleChange = <K extends keyof StrategyParams>(
    key: K,
    value: StrategyParams[K]
  ) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    onChange?.(newParams);
  };

  // 重置参数
  const handleReset = () => {
    const initialParams = { ...DEFAULT_PARAMS, ...defaultValues };
    setParams(initialParams);
    onChange?.(initialParams);
  };

  // 保存参数
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(params);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`border border-border-secondary rounded-lg overflow-hidden ${className}`}>
      {/* 折叠头部 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
        disabled={disabled}
      >
        <div className="flex items-center gap-2 text-text-secondary">
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">高级设置</span>
          {hasChanges && (
            <span className="text-xs text-warning">(已修改)</span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        )}
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="p-4 space-y-6 bg-bg-secondary/50">
          {/* 止盈目标 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-text-primary flex items-center gap-1">
                止盈目标
                <Info className="w-3 h-3 text-text-tertiary" />
              </label>
              <span className="text-sm text-brand-primary font-medium">
                {params.takeProfitPercent}%
              </span>
            </div>
            <Slider
              value={params.takeProfitPercent}
              min={10}
              max={50}
              step={5}
              onChange={(v) => handleChange('takeProfitPercent', v)}
              disabled={disabled}
            />
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>稳健 10%</span>
              <span>贪婪 50%</span>
            </div>
          </div>

          {/* 最大持仓数 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-text-primary">最大持仓数</label>
              <span className="text-sm text-brand-primary font-medium">
                {params.maxOpenTrades} 个
              </span>
            </div>
            <Slider
              value={params.maxOpenTrades}
              min={3}
              max={10}
              step={1}
              onChange={(v) => handleChange('maxOpenTrades', v)}
              disabled={disabled}
            />
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>集中火力</span>
              <span>广撒网</span>
            </div>
          </div>

          {/* 入场激进程度 */}
          <div>
            <label className="text-sm text-text-primary block mb-2">入场激进程度</label>
            <Select
              value={params.entryAggressiveness}
              onChange={(e) => handleChange('entryAggressiveness', e.target.value as StrategyParams['entryAggressiveness'])}
              disabled={disabled}
            >
              <option value="conservative">保守 - 仅在明确信号时入场</option>
              <option value="standard">标准 - 平衡风险与机会</option>
              <option value="aggressive">激进 - 抓住更多机会</option>
            </Select>
          </div>

          {/* 止损线 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-text-primary">止损线</label>
              <span className="text-sm text-danger font-medium">
                -{params.stopLossPercent}%
              </span>
            </div>
            <Slider
              value={params.stopLossPercent}
              min={3}
              max={10}
              step={1}
              onChange={(v) => handleChange('stopLossPercent', v)}
              disabled={disabled}
            />
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>严格 -3%</span>
              <span>宽松 -10%</span>
            </div>
          </div>

          {/* 风险提示 */}
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                修改参数会影响策略表现，建议先在回测中验证
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={disabled || !hasChanges}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              重置
            </Button>
            {onSave && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={disabled || !hasChanges}
                isLoading={isSaving}
              >
                <Save className="w-4 h-4 mr-1" />
                保存
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdvancedSettings;
