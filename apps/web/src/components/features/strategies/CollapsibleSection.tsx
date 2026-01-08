'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  badge?: ReactNode;
}

/**
 * 可折叠区域组件
 * 用于策略创建页面的交易参数、风险管理等区域
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
  headerClassName,
  contentClassName,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('border border-border-primary rounded-md overflow-hidden', className)}>
      {/* 头部（点击切换） */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'bg-bg-secondary hover:bg-bg-tertiary transition-colors',
          'text-left',
          headerClassName
        )}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          )}
          <span className="text-sm font-medium text-text-primary">{title}</span>
          {badge && <div className="ml-2">{badge}</div>}
        </div>
        <span className="text-xs text-text-tertiary">
          {isOpen ? '收起' : '展开'}
        </span>
      </button>

      {/* 内容区域（动画展开） */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className={cn('px-4 py-4 bg-bg-primary border-t border-border-primary', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
