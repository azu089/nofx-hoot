'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s/g, '-');

    return (
      <div className="flex items-center">
        <div className="relative">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className={cn(
              'peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-[#2B3139]',
              'bg-[#1E222D] transition-all',
              'checked:bg-[#3772FF] checked:border-[#3772FF]',
              'hover:border-[#3772FF]',
              'focus:outline-none focus:ring-2 focus:ring-[#3772FF] focus:ring-offset-2 focus:ring-offset-[#0B0E11]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            {...props}
          />
          <Check
            className={cn(
              'absolute left-0.5 top-0.5 h-4 w-4 text-white pointer-events-none',
              'opacity-0 peer-checked:opacity-100 transition-opacity'
            )}
          />
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className="ml-2 text-sm text-[#848E9C] cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
