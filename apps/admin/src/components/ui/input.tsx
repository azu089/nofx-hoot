'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#848E9C] mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            'w-full px-4 py-2 bg-[#1E222D] border rounded-lg text-white placeholder-[#5E6673]',
            'focus:outline-none focus:ring-2 focus:ring-[#3772FF] focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-[#F23645]' : 'border-[#2B3139]',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-[#F23645]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
