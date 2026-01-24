'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Header, Sidebar, MobileNav } from '@/components/layout';
import { TelegramNav } from '@/components/layout/TelegramNav';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { useDeviceType } from '@/hooks/useDeviceType';
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt';
import { isTelegramWebApp, setHeaderColor, setBackgroundColor, ready, expandMiniApp } from '@/lib/telegram';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth, _hasHydrated } = useAuthStore();

  // 设备类型检测（移动端 < 768px）
  const { isMobile, isLoaded: deviceLoaded } = useDeviceType();

  // 标记客户端是否已挂载，避免 hydration 不匹配
  const [isMounted, setIsMounted] = useState(false);

  // 标记是否已完成初始认证检查，避免导航过程中的竞态条件
  const hasInitializedRef = useRef(false);

  // 检测是否在 Telegram 环境
  const [isTelegram, setIsTelegram] = useState(false);

  // 客户端挂载后设置 mounted 状态
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 检测 Telegram 环境
  useEffect(() => {
    const inTelegram = isTelegramWebApp();
    setIsTelegram(inTelegram);

    if (inTelegram) {
      // 设置 Telegram 主题色
      setHeaderColor('#0B0E11');
      setBackgroundColor('#0B0E11');
      expandMiniApp();
      ready();
    }
  }, []);

  useEffect(() => {
    // 等待 hydration 完成后，只在初始加载时调用 checkAuth
    if (_hasHydrated && !hasInitializedRef.current) {
      checkAuth();
    }
  }, [checkAuth, _hasHydrated]);

  useEffect(() => {
    // 等待 hydration 完成后进行认证检查
    // 避免在 hydration 前因 isAuthenticated 为 false 导致错误重定向
    if (!_hasHydrated) return;

    if (!isLoading) {
      if (!hasInitializedRef.current) {
        // 初始检查完成
        hasInitializedRef.current = true;
        if (!isAuthenticated) {
          router.push('/login');
        }
      }
      // 初始化后，不再自动重定向（让 API 拦截器处理 401）
    }
  }, [isAuthenticated, isLoading, router, _hasHydrated]);

  // 加载中（包括客户端未挂载、hydration 未完成、设备检测未完成的情况）
  // 服务端和客户端初始渲染都返回相同的加载状态，避免 hydration 不匹配
  if (!isMounted || !_hasHydrated || isLoading || !deviceLoaded) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录
  if (!isAuthenticated) {
    return null;
  }

  // Telegram 环境：简洁布局（无 Header，使用 TelegramNav）
  if (isTelegram) {
    return (
      <div className="min-h-screen bg-bg-primary pb-20">
        <main className="p-4">{children}</main>
        <TelegramNav />
      </div>
    );
  }

  // 移动端：固定布局（< 768px）
  if (isMobile) {
    return (
      <MobileLayout>
        {children}
        {/* PWA 安装提示（仅移动端显示） */}
        <PWAInstallPrompt />
      </MobileLayout>
    );
  }

  // 桌面端：完整布局（≥ 768px）
  return <DashboardContent>{children}</DashboardContent>;
}

// Web3 全局背景组件 - 增强版 v3.0
function Web3Background() {
  return (
    <>
      {/* 多层渐变背景 */}
      <div className="bg-gradient-overlay" />
      {/* 科技网格 */}
      <div className="bg-grid-pattern" />
      {/* 动态光球 */}
      <div className="bg-orbs" />
      {/* 扫描线效果 */}
      <div className="scanline" />
    </>
  );
}

// 内部组件，使用 sidebarCollapsed 状态
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUiStore();

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <Web3Background />
      <Header />
      <Sidebar />
      <main
        className={`pt-16 transition-all duration-300 relative z-10 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-56'
        }`}
      >
        {/* 移动端需要额外的底部 padding 来避开 MobileNav + 安全区 */}
        <div className="p-4 lg:p-6 pb-24 lg:pb-6">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
