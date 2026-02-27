'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberStepperProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}

export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix = '',
  suffix = '',
}: NumberStepperProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 防止 touch 后模拟的 mouseDown 重复触发（移动端双计步问题）
  const touchActiveRef = useRef(false);

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
    [min, max],
  );

  const increment = useCallback(() => {
    onChange(clamp(value + step));
  }, [onChange, clamp, value, step]);

  const decrement = useCallback(() => {
    onChange(clamp(value - step));
  }, [onChange, clamp, value, step]);

  // 长按加速
  const startHold = useCallback(
    (fn: () => void) => {
      fn();
      let delay = 300;
      const tick = () => {
        fn();
        delay = Math.max(50, delay * 0.85);
        intervalRef.current = setTimeout(tick, delay);
      };
      intervalRef.current = setTimeout(tick, delay);
    },
    [],
  );

  const stopHold = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  // 点击数字进入编辑模式
  const enterEdit = () => {
    setInputValue(String(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const commitEdit = useCallback(() => {
    // 优先读取 DOM 实际值，避免 React state 闭包过期问题
    const rawValue = inputRef.current?.value ?? inputValue;
    const parsed = parseFloat(rawValue);
    if (!isNaN(parsed)) {
      // 手动输入不对齐 step，只做 min/max 范围限制，允许小数
      onChange(clamp(parsed));
    }
    setEditing(false);
  }, [inputRef, inputValue, clamp, onChange]);

  const displayValue = `${prefix}${value.toLocaleString()}${suffix}`;

  return (
    <div className="space-y-2">
      {label && (
        <span className="text-xs text-[#9090A0]">{label}</span>
      )}
      <div className="flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-3 py-2.5">
        {/* 减少按钮 */}
        <button
          type="button"
          onMouseDown={() => { if (!touchActiveRef.current) startHold(decrement); }}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => { touchActiveRef.current = true; startHold(decrement); }}
          onTouchEnd={() => { stopHold(); setTimeout(() => { touchActiveRef.current = false; }, 500); }}
          disabled={value <= min}
          className="w-8 h-8 rounded-full bg-[#1E1E2E] flex items-center justify-center text-[#9090A0] hover:text-[#06B6D4] active:bg-[#06B6D4]/10 transition-colors disabled:opacity-30 disabled:hover:text-[#9090A0] flex-shrink-0"
          title="-"
          aria-label="减少"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* 数值显示 / 编辑 */}
        <div className="flex-1 text-center min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full bg-transparent text-center text-lg font-semibold text-[#F8F8FC] outline-none"
              aria-label={label}
            />
          ) : (
            <button
              type="button"
              onClick={enterEdit}
              className="text-lg font-semibold text-[#F8F8FC] hover:text-[#06B6D4] transition-colors cursor-text"
              title="点击编辑"
              aria-label={displayValue}
            >
              {displayValue}
            </button>
          )}
        </div>

        {/* 增加按钮 */}
        <button
          type="button"
          onMouseDown={() => { if (!touchActiveRef.current) startHold(increment); }}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => { touchActiveRef.current = true; startHold(increment); }}
          onTouchEnd={() => { stopHold(); setTimeout(() => { touchActiveRef.current = false; }, 500); }}
          disabled={value >= max}
          className="w-8 h-8 rounded-full bg-[#1E1E2E] flex items-center justify-center text-[#9090A0] hover:text-[#06B6D4] active:bg-[#06B6D4]/10 transition-colors disabled:opacity-30 disabled:hover:text-[#9090A0] flex-shrink-0"
          title="+"
          aria-label="增加"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
