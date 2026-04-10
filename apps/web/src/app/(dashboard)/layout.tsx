'use client';

import type React from 'react';
import { useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, User } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { useTranslations } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  useNotificationSocket,
  useBudgetAlertSocket,
  type NotificationEvent,
  type BudgetAlertEvent,
} from '@/hooks/useSocket';

type NavLabelKey = 'wallet' | 'profile';

const navItemsConfig: Array<{ id: string; labelKey: NavLabelKey; icon: React.ElementType; href: string }> = [
  { id: 'wallet', labelKey: 'wallet', icon: Wallet, href: '/wallet' },
  { id: 'profile', labelKey: 'profile', icon: User, href: '/profile' },
];

// 路径 → 页面标题映射（用于顶部栏显示）
const pageTitleMap: Record<string, string> = {
  '/wallet': 'wallet',
  '/profile': 'profile',
  '/trading': 'trading',
  '/settings': 'settings',
  '/referral': 'referral',
  '/subscription': 'subscription',
  '/notifications': 'notifications',
  '/help': 'help',
  '/about': 'about',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { isAuthenticated } = useAuth();

  // 全局通知监听
  const handleNotification = useCallback((event: NotificationEvent) => {
    const toastFn = event.type === 'error' ? toast.error
      : event.type === 'warning' ? toast.warning
      : event.type === 'success' ? toast.success
      : toast.info;
    toastFn(event.message, { description: event.title });
  }, []);

  // AI 预算告警监听
  const handleBudgetAlert = useCallback((event: BudgetAlertEvent) => {
    toast.warning(event.message, {
      description: `${event.percentUsed.toFixed(0)}% used`,
      duration: 10000,
    });
  }, []);

  useNotificationSocket(isAuthenticated, handleNotification);
  useBudgetAlertSocket(isAuthenticated, handleBudgetAlert);

  // 动态生成带翻译的导航项
  const navItems = navItemsConfig.map(item => ({
    ...item,
    label: t(item.labelKey)
  }));

  // 当前页面标题
  const currentTitleKey = Object.entries(pageTitleMap).find(
    ([prefix]) => pathname.startsWith(prefix)
  )?.[1];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#0A0A0F] relative">
        {/* ====== 移动端：nofx 风格透明顶部栏 ====== */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            background: 'rgba(10, 10, 15, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Logo */}
          <Link href="/profile" className="flex items-center gap-2">
            <Image src="/icons/hoot/token.png" alt="Hoot" width={28} height={28} className="rounded-full" priority />
            <span className="text-base font-semibold text-[#06B6D4]">HOOT</span>
          </Link>

          {/* 页面标题（居中感） */}
          {currentTitleKey && (
            <span className="text-sm font-medium text-[#9090A0]">
              {t(currentTitleKey)}
            </span>
          )}

          {/* 右侧占位（保持标题居中） */}
          <div className="w-[68px]" />
        </header>

        {/* ====== 移动端内容区 ====== */}
        <main
          className="md:hidden w-full min-h-screen"
          style={{
            paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {children}
        </main>

        {/* ====== 移动端底部导航 ====== */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[#1E1E2E] pb-[env(safe-area-inset-bottom,0px)]"
          style={{
            background: 'rgba(18, 18, 26, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <nav className="flex items-center justify-around h-14 select-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-100 active:opacity-50 active:scale-90 ${
                    isActive ? 'text-[#06B6D4]' : 'text-[#9090A0]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[11px] mt-0.5 font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ====== 桌面端：侧边栏 + 内容 ====== */}
        <div className="hidden md:block fixed left-0 top-0 h-screen w-60 bg-[#12121A] border-r border-[#1E1E2E] z-40">
          <div className="flex h-16 items-center justify-center gap-2 border-b border-[#1E1E2E]">
            <Image src="/icons/hoot/token.png" alt="Hoot" width={32} height={32} className="object-contain" priority />
            <h1 className="text-2xl font-bold text-[#F8F8FC]">Hoot</h1>
          </div>
          <nav className="flex flex-col gap-2 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-[#1E1E2E] text-[#F8F8FC] border border-[#2A2A3A]'
                      : 'hover:bg-[#1E1E2E]/50'
                  }`}
                >
                  <Icon size={20} className={`transition-colors duration-200 ${isActive ? 'text-cyan-400' : 'text-[#9090A0] group-hover:text-[#F8F8FC]'}`} />
                  <span className={`font-medium transition-colors duration-200 ${isActive ? 'text-white' : 'text-[#F8F8FC] group-hover:text-white'}`}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1E1E2E]">
            <div className="text-xs text-center text-[#9090A0]">© 2026 Hoot</div>
          </div>
        </div>
        <div className="hidden md:block md:ml-60 flex-1">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
