'use client';

import type React from 'react';
import { useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Brain, BarChart3, Wallet, User } from 'lucide-react';
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

type NavLabelKey = 'home' | 'ai' | 'trading' | 'wallet' | 'profile';

const navItemsConfig: Array<{ id: string; labelKey: NavLabelKey; icon: React.ElementType; href: string }> = [
  { id: 'dashboard', labelKey: 'home', icon: Home, href: '/dashboard' },
  { id: 'ai', labelKey: 'ai', icon: Brain, href: '/ai' },
  { id: 'trading', labelKey: 'trading', icon: BarChart3, href: '/trading' },
  { id: 'wallet', labelKey: 'wallet', icon: Wallet, href: '/wallet' },
  { id: 'profile', labelKey: 'profile', icon: User, href: '/profile' },
];

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

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0A0A0F]">
        {/* Desktop Sidebar - 隐藏在移动端 */}
        <div className="hidden md:block fixed left-0 top-0 h-screen w-60 bg-[#12121A] border-r border-[#1E1E2E] z-40">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center gap-2 border-b border-[#1E1E2E]">
            <Image src="/icons/hoot/token.png" alt="Hoot" width={32} height={32} className="object-contain" />
            <h1 className="text-2xl font-bold text-[#F8F8FC]">Hoot</h1>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === 'ai'
                ? pathname.startsWith('/ai')
                : pathname.startsWith(item.href);

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
                  <Icon
                    size={20}
                    className={`transition-colors duration-200 ${
                      isActive
                        ? 'text-cyan-400'
                        : 'text-[#9090A0] group-hover:text-[#F8F8FC]'
                    }`}
                  />
                  <span
                    className={`font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-[#F8F8FC] group-hover:text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1E1E2E]">
            <div className="text-xs text-center text-[#9090A0]">
              © 2026 Hoot
            </div>
          </div>
        </div>

        {/* Main Content - 响应式 margin */}
        {/* 桌面端：左侧留出侧边栏空间 */}
        <div className="hidden md:block md:ml-60 flex-1">
          {children}
        </div>
        {/* 移动端：顶部 safe-area + 底部留出导航栏空间（56px nav + safe-area-inset-bottom） */}
        <div className="md:hidden w-full h-[calc(100vh-56px)] overflow-y-auto pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </div>

        {/* Mobile Bottom Navigation - 仅在移动端显示（行业标准 56px 高度） */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#12121A]/95 backdrop-blur-lg border-t border-[#1E1E2E] z-50 pb-[env(safe-area-inset-bottom,0px)]">
          <nav className="flex items-center justify-around h-14 select-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === 'ai'
                ? pathname.startsWith('/ai')
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-100 active:opacity-50 active:scale-90 ${
                    isActive ? 'text-cyan-400' : 'text-[#9090A0]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[11px] mt-0.5 font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </AuthGuard>
  );
}
