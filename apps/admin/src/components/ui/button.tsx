'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0E11] disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-[#3772FF] text-white hover:bg-[#2962FF] focus:ring-[#3772FF]',
      secondary: 'bg-[#1E222D] text-white hover:bg-[#2B3139] focus:ring-[#2B3139]',
      outline: 'border border-[#2B3139] text-[#848E9C] hover:bg-[#1E222D] hover:text-white focus:ring-[#2B3139]',
      ghost: 'text-[#848E9C] hover:bg-[#1E222D] hover:text-white focus:ring-[#2B3139]',
      danger: 'bg-[#F23645] text-white hover:bg-[#D02030] focus:ring-[#F23645]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
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
