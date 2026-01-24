'use client';

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, type = 'text', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === 'password';

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPasswordType ? (showPassword ? 'text' : 'password') : type}
            className={cn(
              'w-full px-4 py-2.5 bg-bg-tertiary border rounded-md text-text-primary placeholder-text-tertiary',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-secondary',
              // 修复浏览器 autofill 背景色问题
              '[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#1E222D]',
              '[&:-webkit-autofill]:[-webkit-text-fill-color:#FFFFFF]',
              '[&:-webkit-autofill:hover]:shadow-[inset_0_0_0px_1000px_#1E222D]',
              '[&:-webkit-autofill:focus]:shadow-[inset_0_0_0px_1000px_#1E222D]',
              error ? 'border-danger' : 'border-border-primary hover:border-border-secondary',
              isPasswordType && 'pr-10',
              className
            )}
            {...props}
          />
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
        {hint && !error && (
          <p className="mt-1.5 text-sm text-text-tertiary">{hint}</p>
        )}
        {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
