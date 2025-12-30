'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'avatar' | 'card' | 'table';
  loading?: boolean;
  children?: React.ReactNode;
}

const Skeleton = ({ className, variant = 'text', loading = true, children, ...props }: SkeletonProps) => {
  // 不加载时，直接显示子元素
  if (!loading && children) {
    return <>{children}</>;
  }

  const variants = {
    text: 'h-4 w-full rounded',
    avatar: 'h-12 w-12 rounded-full',
    card: 'h-32 w-full rounded-lg',
    table: 'h-10 w-full rounded',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-[#1E222D]',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

// 预设骨架屏组件
export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? 'w-3/4' : undefined}
        />
      ))}
    </div>
  );
}

export function AvatarSkeleton({ className }: { className?: string }) {
  return <Skeleton variant="avatar" className={className} />;
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 bg-[#131722] border border-[#2B3139] rounded-xl space-y-4', className)}>
      <div className="flex items-center gap-4">
        <AvatarSkeleton />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
      <TextSkeleton lines={2} />
    </div>
  );
}

export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* 表头 */}
      <Skeleton variant="table" className="bg-[#2B3139]" />
      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="table" />
      ))}
    </div>
  );
}

Skeleton.displayName = 'Skeleton';

export { Skeleton };
