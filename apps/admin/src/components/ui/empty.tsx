'use client';

import { ReactNode } from 'react';
import { FileQuestion, Inbox, Search, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface EmptyProps {
  icon?: 'default' | 'search' | 'error' | ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const Empty = ({
  icon = 'default',
  title = '暂无数据',
  description,
  action,
  className,
}: EmptyProps) => {
  const renderIcon = () => {
    if (typeof icon !== 'string') {
      return icon;
    }

    const icons: Record<string, typeof Inbox> = {
      default: Inbox,
      search: Search,
      error: AlertCircle,
    };

    const IconComponent = icons[icon] || Inbox;
    return <IconComponent className="w-16 h-16 text-[#5E6673]" strokeWidth={1.5} />;
  };

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
      {/* 图标 */}
      <div className="mb-4">{renderIcon()}</div>

      {/* 标题 */}
      <h3 className="text-lg font-medium text-[#848E9C] mb-2">{title}</h3>

      {/* 描述 */}
      {description && <p className="text-sm text-[#5E6673] max-w-sm mb-6">{description}</p>}

      {/* 操作按钮 */}
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
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
      action={onReset ? { label: '清空筛选', onClick: onReset } : undefined}
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
      action={onRetry ? { label: '重新加载', onClick: onRetry } : undefined}
    />
  );
}

Empty.displayName = 'Empty';

export { Empty };
