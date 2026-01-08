'use client';

import { ReactNode } from 'react';
import { FileQuestion, Inbox, Search, AlertCircle, Plus, RefreshCw, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface EmptyProps {
  icon?: 'default' | 'search' | 'error' | 'strategy' | 'trading' | ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** 引导步骤 */
  steps?: string[];
  className?: string;
  /** 紧凑模式（较小的间距和图标） */
  compact?: boolean;
}

const Empty = ({
  icon = 'default',
  title = '暂无数据',
  description,
  action,
  secondaryAction,
  steps,
  className,
  compact = false,
}: EmptyProps) => {
  const renderIcon = () => {
    if (typeof icon !== 'string') {
      return icon;
    }

    const icons: Record<string, typeof Inbox> = {
      default: Inbox,
      search: Search,
      error: AlertCircle,
      strategy: Zap,
      trading: TrendingUp,
    };

    const iconColors: Record<string, string> = {
      default: 'text-text-tertiary',
      search: 'text-text-tertiary',
      error: 'text-danger',
      strategy: 'text-warning',
      trading: 'text-success',
    };

    const bgColors: Record<string, string> = {
      default: 'bg-bg-tertiary',
      search: 'bg-bg-tertiary',
      error: 'bg-danger/10',
      strategy: 'bg-warning/10',
      trading: 'bg-success/10',
    };

    const IconComponent = icons[icon] || Inbox;
    const iconSize = compact ? 'w-10 h-10' : 'w-14 h-14';
    const containerSize = compact ? 'w-16 h-16' : 'w-20 h-20';

    return (
      <div className={cn(containerSize, bgColors[icon] || bgColors.default, 'rounded-2xl flex items-center justify-center')}>
        <IconComponent className={cn(iconSize, iconColors[icon] || iconColors.default)} strokeWidth={1.5} />
      </div>
    );
  };

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8 px-4' : 'py-12 px-6',
      className
    )}>
      {/* P2优化：图标容器增加背景圆 */}
      <div className={compact ? 'mb-3' : 'mb-5'}>{renderIcon()}</div>

      {/* 标题 */}
      <h3 className={cn(
        'font-semibold text-text-primary',
        compact ? 'text-base mb-1' : 'text-lg mb-2'
      )}>{title}</h3>

      {/* 描述 */}
      {description && (
        <p className={cn(
          'text-text-secondary max-w-sm',
          compact ? 'text-xs mb-4' : 'text-sm mb-4'
        )}>{description}</p>
      )}

      {/* P2优化：引导步骤 */}
      {steps && steps.length > 0 && (
        <div className="w-full max-w-xs mb-6 space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3 text-left">
              <div className="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-brand-primary">{index + 1}</span>
              </div>
              <span className="text-sm text-text-secondary">{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* P2优化：操作按钮组 */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant === 'outline' ? 'outline' : 'primary'}
              className={!compact ? 'min-w-[140px]' : ''}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              className="text-text-secondary"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// 预设空状态组件
export function EmptySearch({ onReset }: { onReset?: () => void }) {
  return (
    <Empty
      icon="search"
      title="未找到相关结果"
      description="尝试调整搜索条件或筛选项"
      action={onReset ? { label: '清空筛选', onClick: onReset, variant: 'outline' } : undefined}
    />
  );
}

export function EmptyList({ onCreate }: { onCreate?: () => void }) {
  return (
    <Empty
      icon="default"
      title="还没有内容"
      description="点击下方按钮开始创建"
      action={onCreate ? { label: '立即创建', onClick: onCreate } : undefined}
    />
  );
}

export function EmptyError({ onRetry }: { onRetry?: () => void }) {
  return (
    <Empty
      icon="error"
      title="加载失败"
      description="无法加载数据，请稍后重试"
      action={onRetry ? { label: '重新加载', onClick: onRetry, variant: 'outline' } : undefined}
    />
  );
}

/** P2优化：交易页空状态 - 带引导步骤 */
export function EmptyTrades({ onGoStrategies }: { onGoStrategies?: () => void }) {
  return (
    <Empty
      icon="trading"
      title="还没有交易记录"
      description="订阅策略并开始自动交易"
      steps={[
        '浏览策略市场，选择适合的策略',
        '配置策略参数并订阅',
        '系统将自动执行交易',
      ]}
      action={onGoStrategies ? { label: '浏览策略', onClick: onGoStrategies } : undefined}
    />
  );
}

/** P2优化：策略页空状态 */
export function EmptyStrategies({ onExplore }: { onExplore?: () => void }) {
  return (
    <Empty
      icon="strategy"
      title="还没有订阅策略"
      description="订阅专业量化策略，开启自动交易之旅"
      action={onExplore ? { label: '探索策略市场', onClick: onExplore } : undefined}
    />
  );
}

Empty.displayName = 'Empty';

export { Empty };
