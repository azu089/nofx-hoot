'use client';

import type { ReactNode } from 'react';

export interface PillOption<T extends string | number = string | number> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface PillGroupProps<T extends string | number> {
  label?: string;
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

export function PillGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = 'sm',
}: PillGroupProps<T>) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  return (
    <div className="space-y-2">
      {label && (
        <span className="text-xs text-[#9090A0]">{label}</span>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`${pad} font-medium rounded-xl transition-all flex items-center gap-1.5 ${
                active
                  ? 'bg-[#06B6D4]/10 border border-[#06B6D4] text-[#06B6D4] shadow-[0_0_8px_rgba(6,182,212,0.12)]'
                  : 'bg-[#12121A] border border-[#1E1E2E] text-[#9090A0] hover:border-[#06B6D4]/40'
              }`}
              title={opt.label}
              aria-label={opt.label}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
