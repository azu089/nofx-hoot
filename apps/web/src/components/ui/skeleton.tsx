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
        'animate-pulse bg-bg-tertiary/50',
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
    <div className={cn('p-6 bg-bg-secondary border border-border-primary rounded-lg space-y-4', className)}>
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
      <Skeleton variant="table" className="bg-bg-tertiary" />
      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="table" />
      ))}
    </div>
  );
}

Skeleton.displayName = 'Skeleton';

// ========== 页面级骨架屏组件 ==========

/**
 * 仪表盘骨架屏
 * 包含：标题 + 总资产卡片 + 快捷入口 + 收益概览 + 持仓列表
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      {/* 总资产卡片 */}
      <div className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* 快捷入口 4 格 */}
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 bg-bg-secondary border border-border-primary rounded-xl">
            <Skeleton className="h-6 w-6 mx-auto mb-2" />
            <Skeleton className="h-3 w-8 mx-auto" />
          </div>
        ))}
      </div>

      {/* 收益概览 */}
      <div className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
        <Skeleton className="h-5 w-20" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>

      {/* 持仓列表 */}
      <div className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border-primary/30 last:border-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-8 rounded" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 策略市场骨架屏
 * 包含：标题 + 筛选器 + 策略卡片网格
 */
export function StrategiesSkeleton() {
  return (
    <div className="space-y-6">
      {/* 标题 */}
      <Skeleton className="h-8 w-28" />

      {/* 筛选区域 */}
      <div className="flex flex-wrap gap-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-lg" />
        ))}
      </div>

      {/* 策略卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 交易控制台骨架屏
 * 包含：标题 + 统计卡片 + 持仓列表 + 交易日志
 */
export function TradingSkeleton() {
  return (
    <div className="space-y-6">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 bg-bg-secondary border border-border-primary rounded-xl">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>

      {/* 持仓列表 */}
      <div className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
        <Skeleton className="h-5 w-20" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border-primary/30 last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* 交易日志 */}
      <div className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
        <Skeleton className="h-5 w-20" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-bg-tertiary/30 rounded-lg">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 钱包骨架屏
 * 包含：标题 + 余额卡片 + 快捷操作 + 资产列表
 */
export function WalletSkeleton() {
  return (
    <div className="space-y-6">
      {/* 标题 */}
      <Skeleton className="h-8 w-16" />

      {/* 余额卡片 */}
      <div className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 bg-bg-secondary border border-border-primary rounded-xl text-center">
            <Skeleton className="h-8 w-8 mx-auto mb-2 rounded-lg" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>

      {/* 资产列表 */}
      <div className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
        <Skeleton className="h-5 w-20" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border-primary/30 last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 实例列表骨架屏
 */
export function InstancesSkeleton() {
  return (
    <div className="space-y-6">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* 实例卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 通用列表骨架屏
 */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-bg-secondary border border-border-primary rounded-xl">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * 设置页骨架屏
 */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-16" />

      {/* 设置分组 */}
      {[...Array(3)].map((_, groupIndex) => (
        <div key={groupIndex} className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
          <Skeleton className="h-5 w-24" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border-primary/30 last:border-0">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export { Skeleton };
