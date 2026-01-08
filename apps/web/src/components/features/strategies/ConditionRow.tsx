'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ConditionConfig,
  type IndicatorConfig,
  type IndicatorType,
  INDICATOR_PARAM_OPTIONS,
  INDICATOR_TYPE_DISPLAY,
  OPERATOR_DISPLAY,
  CONDITION_THRESHOLD_OPTIONS,
  getConditionExplanation,
} from '@/lib/strategy-templates';

interface ConditionRowProps {
  condition: ConditionConfig;
  indicator: IndicatorConfig;
  onConditionChange: (condition: ConditionConfig) => void;
  onIndicatorChange: (indicator: IndicatorConfig) => void;
  className?: string;
}

/**
 * 条件行组件
 * 显示条件信息，支持参数编辑
 */
export function ConditionRow({
  condition,
  indicator,
  onConditionChange,
  onIndicatorChange,
  className,
}: ConditionRowProps) {
  const explanation = getConditionExplanation(condition, indicator);
  const paramOptions = INDICATOR_PARAM_OPTIONS[indicator.type];

  // 获取阈值选项
  const thresholdOption = CONDITION_THRESHOLD_OPTIONS.find(
    (opt) =>
      opt.indicatorType === indicator.type &&
      opt.field === condition.field &&
      opt.operator === condition.operator
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* 条件显示行 */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        {/* 指标名称 */}
        <span className="text-text-primary font-medium">
          {INDICATOR_TYPE_DISPLAY[indicator.type]}
        </span>

        {/* 指标参数（可编辑） */}
        {paramOptions && paramOptions.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-text-tertiary">(</span>
            {paramOptions.map((param, idx) => (
              <span key={param.paramName} className="flex items-center gap-1">
                {idx > 0 && <span className="text-text-tertiary">,</span>}
                <span className="text-text-tertiary">{param.label}:</span>
                <ParamDropdown
                  value={indicator.params[param.paramName]}
                  options={param.options}
                  onChange={(val) => {
                    onIndicatorChange({
                      ...indicator,
                      params: { ...indicator.params, [param.paramName]: val },
                    });
                  }}
                />
              </span>
            ))}
            <span className="text-text-tertiary">)</span>
          </div>
        )}

        {/* 运算符 */}
        <span className="text-brand-primary font-medium">
          {OPERATOR_DISPLAY[condition.operator]}
        </span>

        {/* 阈值（可编辑） */}
        {thresholdOption && thresholdOption.options.length > 1 ? (
          <ParamDropdown
            value={condition.value}
            options={thresholdOption.options}
            onChange={(val) => {
              onConditionChange({ ...condition, value: val });
            }}
          />
        ) : condition.value !== 0 ? (
          <span className="text-white font-medium">{condition.value}</span>
        ) : null}
      </div>

      {/* 条件解释 */}
      <div className="flex items-start gap-2 text-xs text-text-tertiary">
        <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-warning flex-shrink-0" />
        <span className="leading-relaxed">{explanation}</span>
      </div>
    </div>
  );
}

interface ParamDropdownProps {
  value: number;
  options: number[];
  onChange: (value: number) => void;
}

/**
 * 参数下拉选择器
 */
function ParamDropdown({ value, options, onChange }: ParamDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded',
          'bg-brand-primary/15 text-brand-primary font-medium',
          'hover:bg-brand-primary/25 transition-colors',
          'border border-brand-primary/30'
        )}
      >
        <span>{value}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-1 z-50',
            'bg-bg-secondary border border-border-primary rounded-md shadow-lg',
            'py-1 min-w-[60px]'
          )}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className={cn(
                'w-full px-3 py-1.5 text-sm text-left',
                'hover:bg-bg-tertiary transition-colors',
                opt === value ? 'text-brand-primary font-medium' : 'text-text-primary'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
