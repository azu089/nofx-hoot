'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, size = 'md', id, disabled, ...props }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s/g, '-');

    const sizes = {
      sm: {
        track: 'w-8 h-4',
        thumb: 'w-3 h-3',
        translate: 'peer-checked:translate-x-4',
      },
      md: {
        track: 'w-11 h-6',
        thumb: 'w-5 h-5',
        translate: 'peer-checked:translate-x-5',
      },
      lg: {
        track: 'w-14 h-7',
        thumb: 'w-6 h-6',
        translate: 'peer-checked:translate-x-7',
      },
    };

    const sizeConfig = sizes[size];

    return (
      <div className="flex items-start">
        <div className="relative flex-shrink-0">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            disabled={disabled}
            className={cn(
              'peer sr-only',
              className
            )}
            {...props}
          />
          <label
            htmlFor={switchId}
            className={cn(
              'block rounded-full cursor-pointer transition-colors duration-fast',
              'bg-bg-tertiary border-2 border-border-primary',
              'peer-checked:bg-brand-primary peer-checked:border-brand-primary',
              'peer-focus:ring-2 peer-focus:ring-border-focus peer-focus:ring-offset-2 peer-focus:ring-offset-bg-primary',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
              sizeConfig.track
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm',
                'transition-transform duration-fast',
                sizeConfig.thumb,
                sizeConfig.translate
              )}
            />
          </label>
        </div>
        {(label || description) && (
          <div className="ml-3">
            {label && (
              <label
                htmlFor={switchId}
                className={cn(
                  'text-sm font-medium text-text-primary cursor-pointer select-none',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-text-tertiary mt-0.5">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';

export { Switch };
