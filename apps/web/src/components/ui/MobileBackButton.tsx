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

  // MobileLayout 已提供统一的 Header，此组件在移动端不再需要
  // 保留此组件仅为向后兼容，建议使用 MobileLayout 提供的统一 Header
  return null;
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
      {/* 移动端头部 - MobileLayout 已提供统一 Header，这里只保留 rightAction */}
      <div className="lg:hidden">
        {rightAction && (
          <div className="flex justify-end mb-2">
            {rightAction}
          </div>
        )}
      </div>

      {/* 桌面端头部 - 显示完整的返回按钮和标题 */}
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
