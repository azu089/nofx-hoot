'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, Zap, Wallet, User } from 'lucide-react';
import { hapticFeedback } from '@/lib/telegram';

// TG 小程序专用路由（所有路由以 /tg 为前缀）
const navItems = [
  { href: '/tg', icon: Home, label: '首页', pattern: /^\/tg(\/?|\/checkin|\/invite|\/announcements|\/help)$/ },
  { href: '/tg/trading', icon: TrendingUp, label: '交易', pattern: /^\/tg\/trading(\/|$)/ },
  { href: '/tg/strategies', icon: Zap, label: '策略', pattern: /^\/tg\/strategies(\/|$)/ },
  { href: '/tg/wallet', icon: Wallet, label: '资产', pattern: /^\/tg\/wallet(\/|$)/ },
  { href: '/tg/settings', icon: User, label: '我的', pattern: /^\/tg\/(settings|profile|instances|ecosystem)(\/|$)/ },
];

export function TelegramNav() {
  const pathname = usePathname();

  const handleClick = () => {
    hapticFeedback('selection');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-fixed bg-bg-secondary border-t border-border-primary safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.pattern.test(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-brand-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="mt-1 text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
