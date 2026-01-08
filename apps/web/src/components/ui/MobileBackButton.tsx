'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 移动端返回按钮组件
 *
 * 功能：
 * - 仅在移动端显示（<1024px）
 * - 在子页面显示返回按钮
 * - 主页面（dashboard, trading, strategies, wallet, profile）不显示
 * - 支持自定义标题
 */

// 主页面路径（底部 5 Tab 对应的页面，不需要返回按钮）
const mainPages = [
  '/dashboard',
  '/trading',
  '/strategies',
  '/wallet',
  '/me',
];

interface MobileBackButtonProps {
  title?: string;
  className?: string;
  showOnMainPages?: boolean;
}

export function MobileBackButton({
  title,
  className,
  showOnMainPages = false
}: MobileBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  // 检查是否是主页面
  const isMainPage = mainPages.some(page => pathname === page);

  // 主页面默认不显示返回按钮
  if (isMainPage && !showOnMainPages) {
    return null;
  }

  const handleBack = () => {
    // 如果有历史记录，返回上一页
    if (window.history.length > 1) {
      router.back();
    } else {
      // 否则返回首页
      router.push('/dashboard');
    }
  };

  return (
    <div className={cn(
      'lg:hidden flex items-center gap-3 mb-4',
      className
    )}>
      <button
        onClick={handleBack}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        aria-label="返回"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      {title && (
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
      )}
    </div>
  );
}

/**
 * 移动端页面头部组件
 * 包含返回按钮和标题
 */
interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  rightAction?: React.ReactNode;
}

export function MobileHeader({
  title,
  subtitle,
  className,
  rightAction
}: MobileHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // 检查是否是主页面
  const isMainPage = mainPages.some(page => pathname === page);

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className={cn('mb-6', className)}>
      {/* 移动端头部 */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {!isMainPage && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-10 h-10 -ml-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                aria-label="返回"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold text-text-primary">{title}</h1>
          </div>
          {rightAction}
        </div>
        {subtitle && (
          <p className="text-sm text-text-secondary">{subtitle}</p>
        )}
      </div>

      {/* 桌面端头部 - 也显示返回按钮 */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isMainPage && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-10 h-10 -ml-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                aria-label="返回"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
              {subtitle && (
                <p className="text-text-secondary mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {rightAction}
        </div>
      </div>
    </div>
  );
}
