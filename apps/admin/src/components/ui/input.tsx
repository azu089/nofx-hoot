'use client';

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === 'password';

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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPasswordType ? (showPassword ? 'text' : 'password') : type}
            className={cn(
              'w-full px-4 py-2 bg-[#1E222D] border rounded-lg text-white placeholder-[#5E6673]',
              'focus:outline-none focus:ring-2 focus:ring-[#3772FF] focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              // 修复浏览器 autofill 背景色问题
              'autofill:bg-[#1E222D] autofill:text-white',
              '[&:-webkit-autofill]:bg-[#1E222D] [&:-webkit-autofill]:text-white [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#1E222D]',
              '[&:-webkit-autofill:hover]:shadow-[inset_0_0_0px_1000px_#1E222D]',
              '[&:-webkit-autofill:focus]:shadow-[inset_0_0_0px_1000px_#1E222D]',
              error ? 'border-[#F23645]' : 'border-[#2B3139]',
              isPasswordType && 'pr-10',
              className
            )}
            {...props}
          />
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5E6673] hover:text-[#848E9C] transition-colors"
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
        {error && <p className="mt-1 text-sm text-[#F23645]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
