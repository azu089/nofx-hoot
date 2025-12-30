'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  RotateCcw,
  Save,
  Lock,
  Unlock,
} from 'lucide-react';

// 参数类型定义
export type ParamType = 'number' | 'percentage' | 'select' | 'toggle' | 'range';

// 参数配置项
export interface ParamConfig {
  key: string;
  label: string;
  type: ParamType;
  value: number | string | boolean;
  defaultValue: number | string | boolean;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  unit?: string;
  locked?: boolean;
  warning?: string;
  category: string;
}

// 参数分类
export interface ParamCategory {
  key: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  params: ParamConfig[];
}

// 组件属性
interface AdvancedParamsProps {
  categories: ParamCategory[];
  onChange: (key: string, value: number | string | boolean) => void;
  onSave?: () => void;
  onReset?: () => void;
  isLocked?: boolean;
  onLockToggle?: () => void;
}

export function AdvancedParams({
  categories,
  onChange,
  onSave,
  onReset,
  isLocked = false,
  onLockToggle,
}: AdvancedParamsProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    categories.map((c) => c.key)
  );

  // 切换分类展开/收起
  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // 渲染参数输入控件
  const renderParamInput = (param: ParamConfig) => {
    const isDisabled = isLocked || param.locked;

    switch (param.type) {
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={param.value as number}
              onChange={(e) => onChange(param.key, parseFloat(e.target.value) || 0)}
              min={param.min}
              max={param.max}
              step={param.step || 1}
              disabled={isDisabled}
              className="w-32"
            />
            {param.unit && (
              <span className="text-sm text-text-secondary">{param.unit}</span>
            )}
          </div>
        );

      case 'percentage':
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={param.value as number}
              onChange={(e) => onChange(param.key, parseFloat(e.target.value) || 0)}
              min={param.min ?? 0}
              max={param.max ?? 100}
              step={param.step || 0.1}
              disabled={isDisabled}
              className="w-24"
            />
            <span className="text-sm text-text-secondary">%</span>
          </div>
        );

      case 'range':
        return (
          <div className="flex items-center gap-3 w-full max-w-xs">
            <input
              type="range"
              value={param.value as number}
              onChange={(e) => onChange(param.key, parseFloat(e.target.value))}
              min={param.min ?? 0}
              max={param.max ?? 100}
              step={param.step || 1}
              disabled={isDisabled}
              className="flex-1 h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-brand-primary"
            />
            <span className="text-sm font-medium text-text-primary w-16 text-right">
              {param.value}
              {param.unit || ''}
            </span>
          </div>
        );

      case 'select':
        return (
          <select
            value={param.value as string}
            onChange={(e) => onChange(param.key, e.target.value)}
            disabled={isDisabled}
            className="px-3 py-2 bg-bg-tertiary border border-border-primary rounded-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            {param.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'toggle':
        return (
          <Switch
            checked={param.value as boolean}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(param.key, e.target.checked)}
            disabled={isDisabled}
          />
        );

      default:
        return null;
    }
  };

  // 检查参数是否被修改
  const isModified = (param: ParamConfig) => param.value !== param.defaultValue;

  // 统计修改数量
  const modifiedCount = categories.reduce(
    (count, cat) => count + cat.params.filter(isModified).length,
    0
  );

  return (
    <Card className="overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-brand-primary" />
          <div>
            <h3 className="font-medium text-text-primary">高级参数配置</h3>
            {modifiedCount > 0 && (
              <p className="text-xs text-warning">
                {modifiedCount} 个参数已修改
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onLockToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLockToggle}
              className={isLocked ? 'text-danger' : 'text-text-secondary'}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </Button>
          )}
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} disabled={isLocked}>
              <RotateCcw className="w-4 h-4 mr-1" />
              重置
            </Button>
          )}
          {onSave && (
            <Button size="sm" onClick={onSave} disabled={isLocked || modifiedCount === 0}>
              <Save className="w-4 h-4 mr-1" />
              保存
            </Button>
          )}
        </div>
      </div>

      {/* 参数分类列表 */}
      <div className="divide-y divide-border-primary">
        {categories.map((category) => (
          <div key={category.key}>
            {/* 分类标题 */}
            <button
              onClick={() => toggleCategory(category.key)}
              className="w-full flex items-center justify-between p-4 hover:bg-bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                {category.icon}
                <div className="text-left">
                  <h4 className="font-medium text-text-primary">{category.label}</h4>
                  {category.description && (
                    <p className="text-xs text-text-secondary">{category.description}</p>
                  )}
                </div>
              </div>
              {expandedCategories.includes(category.key) ? (
                <ChevronUp className="w-5 h-5 text-text-tertiary" />
              ) : (
                <ChevronDown className="w-5 h-5 text-text-tertiary" />
              )}
            </button>

            {/* 参数列表 */}
            {expandedCategories.includes(category.key) && (
              <div className="px-4 pb-4 space-y-4">
                {category.params.map((param) => (
                  <div
                    key={param.key}
                    className={`p-3 rounded-md ${
                      isModified(param) ? 'bg-warning/5 border border-warning/20' : 'bg-bg-tertiary'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <label className="font-medium text-text-primary">
                            {param.label}
                          </label>
                          {param.locked && (
                            <Lock className="w-3 h-3 text-text-tertiary" />
                          )}
                          {isModified(param) && (
                            <span className="text-xs text-warning">(已修改)</span>
                          )}
                        </div>
                        {param.description && (
                          <p className="text-xs text-text-secondary mt-1">
                            {param.description}
                          </p>
                        )}
                        {param.warning && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-warning">
                            <AlertCircle className="w-3 h-3" />
                            {param.warning}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">{renderParamInput(param)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 锁定状态提示 */}
      {isLocked && (
        <div className="p-4 bg-danger/5 border-t border-danger/20">
          <div className="flex items-center gap-2 text-sm text-danger">
            <Lock className="w-4 h-4" />
            <span>参数已锁定，交易运行中无法修改</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// 预设的策略参数模板
export const STRATEGY_PARAM_TEMPLATES: ParamCategory[] = [
  {
    key: 'risk',
    label: '风险管理',
    description: '控制单笔交易和整体风险',
    params: [
      {
        key: 'maxPositionSize',
        label: '最大仓位',
        type: 'percentage',
        value: 10,
        defaultValue: 10,
        min: 1,
        max: 100,
        description: '单笔交易最大占用资金比例',
        category: 'risk',
      },
      {
        key: 'stopLoss',
        label: '止损比例',
        type: 'percentage',
        value: 5,
        defaultValue: 5,
        min: 0.5,
        max: 50,
        description: '触发止损的亏损比例',
        category: 'risk',
      },
      {
        key: 'takeProfit',
        label: '止盈比例',
        type: 'percentage',
        value: 10,
        defaultValue: 10,
        min: 1,
        max: 100,
        description: '触发止盈的盈利比例',
        category: 'risk',
      },
      {
        key: 'maxDrawdown',
        label: '最大回撤',
        type: 'percentage',
        value: 20,
        defaultValue: 20,
        min: 5,
        max: 50,
        description: '达到后停止交易',
        warning: '建议不超过 30%',
        category: 'risk',
      },
    ],
  },
  {
    key: 'entry',
    label: '入场条件',
    description: '控制开仓时机',
    params: [
      {
        key: 'entrySignalStrength',
        label: '信号强度阈值',
        type: 'range',
        value: 70,
        defaultValue: 70,
        min: 50,
        max: 100,
        description: '只有信号强度超过此值才开仓',
        category: 'entry',
      },
      {
        key: 'confirmIndicators',
        label: '确认指标数量',
        type: 'number',
        value: 2,
        defaultValue: 2,
        min: 1,
        max: 5,
        description: '需要多少个指标同时确认',
        category: 'entry',
      },
      {
        key: 'waitForPullback',
        label: '等待回调入场',
        type: 'toggle',
        value: false,
        defaultValue: false,
        description: '信号出现后等待价格回调再入场',
        category: 'entry',
      },
    ],
  },
  {
    key: 'exit',
    label: '出场条件',
    description: '控制平仓时机',
    params: [
      {
        key: 'trailingStop',
        label: '移动止损',
        type: 'toggle',
        value: true,
        defaultValue: true,
        description: '价格上涨时自动调整止损位',
        category: 'exit',
      },
      {
        key: 'trailingStopDistance',
        label: '移动止损距离',
        type: 'percentage',
        value: 3,
        defaultValue: 3,
        min: 0.5,
        max: 10,
        description: '止损位与当前价格的距离',
        category: 'exit',
      },
      {
        key: 'partialTakeProfit',
        label: '分批止盈',
        type: 'toggle',
        value: false,
        defaultValue: false,
        description: '达到目标后分批平仓',
        category: 'exit',
      },
    ],
  },
  {
    key: 'timing',
    label: '时间控制',
    description: '交易时间相关设置',
    params: [
      {
        key: 'maxHoldingTime',
        label: '最大持仓时间',
        type: 'number',
        value: 24,
        defaultValue: 24,
        min: 1,
        max: 168,
        unit: '小时',
        description: '超时自动平仓',
        category: 'timing',
      },
      {
        key: 'tradingHoursOnly',
        label: '仅活跃时段交易',
        type: 'toggle',
        value: false,
        defaultValue: false,
        description: '避开低流动性时段',
        category: 'timing',
      },
    ],
  },
];

export default AdvancedParams;
