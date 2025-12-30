'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  outline?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'primary', size = 'md', outline = false, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center font-medium rounded-full transition-colors';

    const sizeStyles = {
      sm: 'text-xs px-2 py-0.5',
      md: 'text-sm px-2.5 py-0.5',
      lg: 'text-base px-3 py-1',
    };

    const solidVariants = {
      primary: 'bg-brand-primary text-white',
      secondary: 'bg-bg-tertiary text-text-primary border border-border-primary',
      success: 'bg-success/20 text-success',
      danger: 'bg-danger/20 text-danger',
      warning: 'bg-warning/20 text-warning',
      info: 'bg-brand-primary/20 text-brand-primary',
    };

    const outlineVariants = {
      primary: 'border border-brand-primary text-brand-primary bg-transparent',
      secondary: 'border border-border-primary text-text-secondary bg-transparent',
      success: 'border border-success text-success bg-transparent',
      danger: 'border border-danger text-danger bg-transparent',
      warning: 'border border-warning text-warning bg-transparent',
      info: 'border border-brand-primary text-brand-primary bg-transparent',
    };

    const variantStyles = outline ? outlineVariants : solidVariants;

    return (
      <span
        ref={ref}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
