'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, Zap, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MobileNav - 移动端底部导航
 * 只在移动端和平板显示（< 1024px）
 * 5 个 Tab：首页、交易、策略、资产、我的
 */
export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: '首页',
      icon: Home,
      href: '/dashboard',
      activePattern: /^\/dashboard$/,
    },
    {
      label: '交易',
      icon: TrendingUp,
      href: '/trading',
      activePattern: /^\/trading/,
    },
    {
      label: '策略',
      icon: Zap,
      href: '/strategies',
      activePattern: /^\/strategies/,
    },
    {
      label: '资产',
      icon: Wallet,
      href: '/wallet',
      activePattern: /^\/wallet/,
    },
    {
      label: '我的',
      icon: User,
      href: '/settings',
      activePattern: /^\/settings/,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-fixed lg:hidden bg-bg-secondary border-t border-border-primary">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.activePattern.test(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
            >
              <Icon
                className={cn(
                  'w-6 h-6 transition-colors',
                  isActive ? 'text-brand-primary' : 'text-text-secondary'
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  'text-xs font-medium transition-colors',
                  isActive ? 'text-brand-primary' : 'text-text-secondary'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
