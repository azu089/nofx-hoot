'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'gradient' | 'glow';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  pulse?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, pulse = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed ripple';

    const variants = {
      primary: 'bg-brand-primary text-white hover:bg-brand-secondary focus:ring-brand-primary shadow-md hover:shadow-lg hover:-translate-y-0.5',
      secondary: 'bg-bg-tertiary text-text-primary hover:bg-bg-secondary focus:ring-border-focus border border-border-primary',
      outline: 'border border-border-primary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary focus:ring-border-focus hover:border-brand-primary',
      ghost: 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary focus:ring-border-focus',
      danger: 'bg-danger text-white hover:bg-danger/90 focus:ring-danger shadow-md hover:shadow-lg hover:-translate-y-0.5',
      success: 'bg-success text-white hover:bg-success/90 focus:ring-success shadow-md hover:shadow-lg hover:-translate-y-0.5',
      // 新增: 渐变按钮
      gradient: 'bg-gradient-button text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 focus:ring-brand-primary',
      // 新增: 发光按钮
      glow: 'bg-brand-primary text-white shadow-lg hover:shadow-[0_0_20px_rgba(55,114,255,0.5)] focus:ring-brand-primary hover:-translate-y-0.5',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      // 新增: 超大尺寸（用于 CTA）
      xl: 'px-8 py-4 text-lg font-semibold',
    };

    const pulseClass = pulse ? 'animate-breathe' : '';

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], pulseClass, className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
