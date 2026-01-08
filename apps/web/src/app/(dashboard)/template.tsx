'use client';

/**
 * Dashboard 页面过渡动画容器
 *
 * 使用 Next.js App Router 的 template.tsx 实现页面切换动画
 * - 桌面端：淡入 + 向上滑动
 * - 移动端：淡入 + 向右滑动（更像原生 App）
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-page-enter">
      {children}
    </div>
  );
}
