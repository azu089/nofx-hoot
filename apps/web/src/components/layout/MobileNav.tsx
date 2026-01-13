'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, Zap, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MobileNav - 移动端底部导航
 * 只在移动端和平板显示（< 1024px）
 * 5 个 Tab：首页、交易、策略、资产、我的
 *
 * 按照 UI 设计方案：
 * - 首页 → /dashboard（资产总览、快捷入口）
 * - 交易 → /trading（交易控制、K线、日志）
 * - 策略 → /strategies（策略市场、我的策略）
 * - 资产 → /wallet（钱包、充提、API Key）
 * - 我的 → /me（统一入口：设置、安全、生态、邀请、帮助）
 */
export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: '首页',
      icon: Home,
      href: '/dashboard',
      // 匹配 /dashboard 及其子路径
      activePattern: /^\/dashboard(\/|$)/,
    },
    {
      label: '交易',
      icon: TrendingUp,
      href: '/trading',
      // 匹配 /trading 及其子路径，以及 /instances（VPS 实例属于交易域）
      activePattern: /^\/(trading|instances)(\/|$)/,
    },
    {
      label: '策略',
      icon: Zap,
      href: '/strategies',
      // 匹配 /strategies 及其子路径（包括 /strategies/upload, /strategies/my-uploads 等）
      activePattern: /^\/strategies(\/|$)/,
    },
    {
      label: '资产',
      icon: Wallet,
      href: '/wallet',
      // 匹配 /wallet 及其子路径（包括 /wallet/deposit, /wallet/withdraw 等）
      activePattern: /^\/wallet(\/|$)/,
    },
    {
      label: '我的',
      icon: User,
      href: '/me',
      // P0修复：只匹配与"我"直接相关的页面
      // 生态中心、帮助等页面属于独立功能，不应激活"我的"Tab
      activePattern: /^\/(me|settings|profile|referral)(\/|$)/,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-fixed lg:hidden bg-bg-secondary/95 backdrop-blur-lg border-t border-border-primary" role="navigation" aria-label="主导航">
      {/* 安全区域适配 iOS */}
      <div className="flex items-center justify-around h-16 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.activePattern.test(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1',
                'transition-all duration-150',
                // 触感反馈：点击时缩放 + 透明度变化
                'active:scale-90 active:opacity-70',
                // 激活状态微放大
                isActive && 'scale-105'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={cn(
                'relative p-2 rounded-xl transition-all duration-200',
                // 激活状态背景和阴影 (P2优化：使用语义化阴影类)
                isActive
                  ? 'bg-brand-primary/15 shadow-glow-md'
                  : 'group-active:bg-bg-tertiary/50'
              )}>
                <Icon
                  className={cn(
                    'w-5 h-5 transition-all duration-200',
                    isActive
                      ? 'text-brand-primary drop-shadow-glow'
                      : 'text-text-secondary'
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden="true"
                />
                {/* 活跃指示点 (P2优化：使用语义化阴影类) */}
                {isActive && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-primary shadow-glow-sm" aria-hidden="true" />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium transition-all duration-200',
                  isActive
                    ? 'text-brand-primary'
                    : 'text-text-tertiary'
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
