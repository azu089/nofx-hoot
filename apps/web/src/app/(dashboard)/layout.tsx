'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, BarChart3, Wallet, User } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { useTranslations } from '@/i18n/provider';

const navItemsConfig = [
  { id: 'dashboard', labelKey: 'home', icon: Home, href: '/dashboard' },
  { id: 'strategies', labelKey: 'strategies', icon: TrendingUp, href: '/strategies' },
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

  // 动态生成带翻译的导航项
  const navItems = navItemsConfig.map(item => ({
    ...item,
    label: t(item.labelKey as any)
  }));

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0A0A0F]">
        {/* Desktop Sidebar - 隐藏在移动端 */}
        <div className="hidden md:block fixed left-0 top-0 h-screen w-60 bg-[#12121A] border-r border-[#1E1E2E] z-40">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center gap-2 border-b border-[#1E1E2E]">
            <Image src="/icons/hoot/logo.png" alt="Hoot" width={32} height={32} className="object-contain" />
            <h1 className="text-2xl font-bold text-[#F8F8FC]">Hoot</h1>
          </div>

          {/* Navigation */}
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
        {/* 移动端：使用固定高度容器，底部留出导航栏空间 */}
        <div className="md:hidden w-full h-[calc(100vh-64px)] overflow-y-auto">
          {children}
        </div>

        {/* Mobile Bottom Navigation - 仅在移动端显示 */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#12121A]/95 backdrop-blur-lg border-t border-[#1E1E2E] z-50">
          <nav className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-[#9090A0]'
                  }`}
                >
                  <Icon size={22} />
                  <span className="text-xs mt-1 font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </AuthGuard>
  );
}
