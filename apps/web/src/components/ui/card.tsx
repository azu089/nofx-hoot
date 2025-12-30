'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'glass' | 'glow' | 'gradient';
  hover?: boolean;
  glowColor?: 'primary' | 'success' | 'danger' | 'warning';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = false, glowColor = 'primary', ...props }, ref) => {
    const variants = {
      default: 'bg-bg-secondary border-border-primary',
      elevated: 'bg-bg-secondary border-border-primary shadow-lg',
      bordered: 'bg-bg-primary border-border-primary border-2',
      // 新增: 玻璃效果变体
      glass: 'glass-card bg-transparent',
      // 新增: 发光边框变体
      glow: `bg-bg-secondary border-border-primary glow-border glow-border-${glowColor}`,
      // 新增: 渐变背景变体
      gradient: 'bg-gradient-to-br from-bg-secondary to-bg-tertiary border-border-primary',
    };

    const hoverClass = hover ? 'card-hover cursor-pointer' : '';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border backdrop-blur-sm transition-all duration-300',
          variants[variant],
          hoverClass,
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-6 py-4 border-b border-border-primary', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold text-text-primary', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-text-secondary', className)}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-6 py-4', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-6 py-4 border-t border-border-primary', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
