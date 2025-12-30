'use client';

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  icon?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = 'info',
      title,
      icon,
      dismissible = false,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      info: {
        container: 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary',
        icon: Info,
      },
      success: {
        container: 'bg-success/10 border-success/30 text-success',
        icon: CheckCircle2,
      },
      warning: {
        container: 'bg-warning/10 border-warning/30 text-warning',
        icon: AlertTriangle,
      },
      danger: {
        container: 'bg-danger/10 border-danger/30 text-danger',
        icon: AlertCircle,
      },
    };

    const variantConfig = variants[variant];
    const IconComponent = icon || <variantConfig.icon className="w-5 h-5 flex-shrink-0" />;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border',
          variantConfig.container,
          className
        )}
        {...props}
      >
        {IconComponent}
        <div className="flex-1 min-w-0">
          {title && <h5 className="font-medium mb-1">{title}</h5>}
          <div className="text-sm opacity-90">{children}</div>
        </div>
        {dismissible && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert };
