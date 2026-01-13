'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, Zap, Wallet, User } from 'lucide-react';

/**
 * 移动端底部导航 TabBar
 *
 * 高度：56px + 底部安全区
 *
 * 5 个 Tab：
 * - 首页 /dashboard
 * - 交易 /trading
 * - 策略 /strategies
 * - 资产 /wallet
 * - 我的 /me
 */

const tabs = [
  { icon: Home, label: '首页', path: '/dashboard' },
  { icon: TrendingUp, label: '交易', path: '/trading' },
  { icon: Zap, label: '策略', path: '/strategies' },
  { icon: Wallet, label: '资产', path: '/wallet' },
  { icon: User, label: '我的', path: '/me' },
];

export function MobileTabBar() {
  const pathname = usePathname();

  // 判断当前 tab 是否激活
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-primary/95 backdrop-blur-md z-fixed">
      <div className="h-14 flex pb-safe">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-brand-primary' : 'text-text-tertiary'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] ${active ? 'font-medium' : ''}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
