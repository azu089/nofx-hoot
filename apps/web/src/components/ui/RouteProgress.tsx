'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * RouteProgress - 路由切换进度条
 * 在页面导航时显示顶部加载进度条，提供即时反馈
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 开始加载动画
  const startProgress = useCallback(() => {
    setIsVisible(true);
    setProgress(0);

    // 快速增加到 30%
    setTimeout(() => setProgress(30), 50);

    // 然后缓慢增加
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 90;
        }
        // 越接近90%增速越慢
        const increment = Math.max(1, (90 - prev) / 10);
        return Math.min(90, prev + increment);
      });
    }, 100);
  }, []);

  // 完成加载动画
  const completeProgress = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setProgress(100);

    // 延迟隐藏
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
    }, 200);
  }, []);

  // 监听路由变化
  useEffect(() => {
    completeProgress();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname, searchParams, completeProgress]);

  // 监听点击事件，在点击链接时立即开始进度条
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link) {
        const href = link.getAttribute('href');
        // 只处理内部链接
        if (href && href.startsWith('/') && href !== pathname) {
          startProgress();
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname, startProgress]);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none',
        'transition-opacity duration-200',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div
        className="h-full bg-gradient-to-r from-brand-primary via-brand-primary to-brand-secondary shadow-glow-md"
        style={{
          width: `${progress}%`,
          transition: progress === 100
            ? 'width 150ms ease-out'
            : 'width 200ms ease-out',
        }}
      />
      {/* 发光效果 */}
      <div
        className="absolute top-0 right-0 h-full w-24 bg-gradient-to-r from-transparent to-brand-primary/50 blur-sm"
        style={{
          transform: `translateX(${progress === 100 ? '0' : '-100%'})`,
          opacity: isVisible ? 1 : 0,
        }}
      />
    </div>
  );
}
