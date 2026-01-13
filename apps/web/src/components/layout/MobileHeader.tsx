'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface MobileHeaderProps {
  /** 显示返回按钮（子页面） */
  showBack?: boolean;
  /** 自定义标题（子页面） */
  title?: string;
  /** 右侧操作区内容 */
  rightContent?: React.ReactNode;
}

/**
 * 移动端固定顶部 Header
 *
 * 高度：56px + 顶部安全区
 *
 * 两种模式：
 * 1. 主页面模式：显示 Logo + 通知 + 头像
 * 2. 子页面模式：显示 返回按钮 + 标题
 */
export function MobileHeader({ showBack, title, rightContent }: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <header className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-md pt-safe">
      <div className="h-14 flex items-center justify-between px-4">
        {/* 左侧 */}
        <div className="flex items-center">
          {showBack ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors -ml-1"
            >
              <ChevronLeft className="w-5 h-5" />
              {title && <span className="text-base font-medium text-text-primary">{title}</span>}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {/* Logo */}
              <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">Q</span>
              </div>
              <span className="text-lg font-semibold text-text-primary">QuantFi</span>
            </div>
          )}
        </div>

        {/* 右侧 */}
        <div className="flex items-center gap-2">
          {rightContent}
        </div>
      </div>
    </header>
  );
}
