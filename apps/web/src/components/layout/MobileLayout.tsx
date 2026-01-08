'use client';

import { ReactNode } from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileTabBar } from './MobileTabBar';

interface MobileLayoutProps {
  children: ReactNode;
}

/**
 * 移动端固定布局
 *
 * 结构：
 * - 固定顶部 Header (56px)
 * - 可滚动内容区 (flex-1)
 * - 固定底部 TabBar (56px + safe-area)
 */
export function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* 固定顶部 Header */}
      <MobileHeader />

      {/* 可滚动内容区 - 使用固定的 padding-bottom 为 TabBar 留空间 */}
      {/* 增加额外的底部 padding (20px) 确保内容不会被遮挡 */}
      <main className="flex-1 overflow-y-auto overscroll-contain pb-[calc(76px+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      {/* 固定底部 TabBar */}
      <MobileTabBar />
    </div>
  );
}
