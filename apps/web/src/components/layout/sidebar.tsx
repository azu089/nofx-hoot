'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Bot,
  Wallet,
  History,
  Settings,
  HelpCircle,
  Server,
  TrendingUp,
  Gamepad2,
  Receipt,
  FlaskConical,
  ListOrdered,
  Users,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const navItems = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/strategies', label: '策略市场', icon: Bot },
  { href: '/trading', label: '交易控制台', icon: TrendingUp },
  { href: '/trading/backtest', label: '回测系统', icon: FlaskConical },
  { href: '/trading/history', label: '交易历史', icon: ListOrdered },
  { href: '/instances', label: 'VPS 实例', icon: Server },
  { href: '/wallet', label: '钱包', icon: Wallet },
  { href: '/gamefi', label: 'GameFi', icon: Gamepad2 },
  { href: '/wallet/billing', label: '账单明细', icon: Receipt },
];

const bottomItems = [
  { href: '/settings', label: '设置', icon: Settings },
  { href: '/help', label: '帮助', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  // 判断用户角色
  const isAgent = user?.isAgent === true; // 后端会通过查询 agents 表返回
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-bg-secondary/50 border-r border-border-primary hidden lg:block">
      <div className="flex flex-col h-full py-4">
        {/* Main Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-primary/20 text-brand-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                )}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <nav className="px-3 space-y-1 border-t border-border-primary pt-4">
          {bottomItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-primary/20 text-brand-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                )}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}

          {/* 角色特殊入口 */}
          {(isAgent || isAdmin) && (
            <div className="pt-4 mt-4 border-t border-border-secondary">
              <p className="px-3 mb-2 text-xs font-semibold text-text-tertiary uppercase">特殊权限</p>

              {/* 代理商入口 */}
              {isAgent && (
                <Link
                  href="/agent"
                  className={cn(
                    'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    pathname.startsWith('/agent')
                      ? 'bg-success/20 text-success'
                      : 'text-success/80 hover:text-success hover:bg-success/10'
                  )}
                >
                  <Users className="w-5 h-5 mr-3" />
                  代理中心
                </Link>
              )}

              {/* 管理员入口 */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={cn(
                    'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    pathname.startsWith('/admin')
                      ? 'bg-warning/20 text-warning'
                      : 'text-warning/80 hover:text-warning hover:bg-warning/10'
                  )}
                >
                  <Shield className="w-5 h-5 mr-3" />
                  管理后台
                </Link>
              )}
            </div>
          )}
        </nav>

        {/* Version Info */}
        <div className="px-6 py-4 border-t border-border-primary">
          <p className="text-xs text-text-tertiary">QuantFi v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
