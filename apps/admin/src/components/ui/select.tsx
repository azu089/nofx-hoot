'use client';

import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-[#848E9C]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full px-3 py-2 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white',
            'focus:outline-none focus:ring-2 focus:ring-[#3772FF] focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[#F23645]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-sm text-[#F23645]">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
