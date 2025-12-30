'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'muted';
  fullscreen?: boolean;
  className?: string;
}

const Spinner = ({ size = 'md', color = 'primary', fullscreen = false, className }: SpinnerProps) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const colors = {
    primary: 'text-brand-primary',
    white: 'text-white',
    muted: 'text-text-tertiary',
  };

  const spinner = (
    <Loader2 className={cn('animate-spin', sizes[size], colors[color], className)} />
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg-secondary/50 backdrop-blur-sm z-modal">
        {spinner}
      </div>
    );
  }

  return spinner;
};

// 加载容器组件
export function LoadingContainer({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}

// 全屏加载组件
export function FullscreenSpinner() {
  return <Spinner fullscreen />;
}

Spinner.displayName = 'Spinner';

export { Spinner };
