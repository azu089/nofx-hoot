'use client';

import { forwardRef, InputHTMLAttributes, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  marks?: Array<{ value: number; label: string }>;
  variant?: 'default' | 'danger' | 'success';
}

const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({
    className,
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    showValue = true,
    formatValue = (v) => String(v),
    marks,
    variant = 'default',
    disabled,
    ...props
  }, ref) => {
    const [isDragging, setIsDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);

    // 计算填充百分比
    const percentage = ((value - min) / (max - min)) * 100;

    // 变体颜色
    const variantStyles = {
      default: {
        track: 'bg-brand-primary',
        thumb: 'bg-brand-primary border-brand-primary',
      },
      danger: {
        track: 'bg-danger',
        thumb: 'bg-danger border-danger',
      },
      success: {
        track: 'bg-success',
        thumb: 'bg-success border-success',
      },
    };

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    }, [onChange]);

    // 拖拽处理
    const handleMouseDown = () => setIsDragging(true);
    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
      if (isDragging) {
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchend', handleMouseUp);
      }
      return () => {
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }, [isDragging]);

    return (
      <div className={cn('w-full', className)}>
        {/* 标签和当前值 */}
        {(label || showValue) && (
          <div className="flex items-center justify-between mb-2">
            {label && (
              <label className="text-sm text-text-secondary">{label}</label>
            )}
            {showValue && (
              <span className={cn(
                'text-sm font-medium',
                variant === 'danger' ? 'text-danger' :
                variant === 'success' ? 'text-success' :
                'text-white'
              )}>
                {formatValue(value)}
              </span>
            )}
          </div>
        )}

        {/* 滑块容器 */}
        <div className="relative" ref={trackRef}>
          {/* 轨道背景 */}
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            {/* 填充轨道 */}
            <div
              className={cn(
                'h-full rounded-full transition-all duration-100',
                variantStyles[variant].track
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* 隐藏的原生 input */}
          <input
            ref={ref}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            disabled={disabled}
            className={cn(
              'absolute inset-0 w-full h-2 opacity-0 cursor-pointer',
              disabled && 'cursor-not-allowed'
            )}
            {...props}
          />

          {/* 自定义滑块 */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 bg-white shadow-md transition-transform',
              variantStyles[variant].thumb,
              isDragging && 'scale-110',
              disabled && 'opacity-50'
            )}
            style={{ left: `calc(${percentage}% - 10px)` }}
          />
        </div>

        {/* 刻度标记 */}
        {marks && marks.length > 0 && (
          <div className="relative mt-2">
            <div className="flex justify-between">
              {marks.map((mark) => {
                const markPercentage = ((mark.value - min) / (max - min)) * 100;
                return (
                  <span
                    key={mark.value}
                    className="text-xs text-text-tertiary"
                    style={{
                      position: 'absolute',
                      left: `${markPercentage}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    {mark.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 最小最大值标签（无 marks 时） */}
        {!marks && (
          <div className="flex justify-between mt-1">
            <span className="text-xs text-text-tertiary">{formatValue(min)}</span>
            <span className="text-xs text-text-tertiary">{formatValue(max)}</span>
          </div>
        )}
      </div>
    );
  }
);

Slider.displayName = 'Slider';

export { Slider };
