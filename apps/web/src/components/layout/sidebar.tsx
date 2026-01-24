'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  TrendingUp,
  Zap,
  Wallet,
  User,
  Users,
  Sparkles,
  Megaphone,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { useEffect } from 'react';

/**
 * 侧边栏导航结构 - 与移动端 5 Tab 保持一致
 *
 * 核心导航（5个，对应移动端底部 Tab）：
 * - 首页：/dashboard（资产总览、快捷入口）
 * - 交易：/trading（交易控制、K线、日志，含 VPS 实例）
 * - 策略：/strategies（策略市场、我的策略）
 * - 资产：/wallet（钱包、充提、API Key）
 * - 我的：/me（统一入口：设置、安全、生态、邀请、帮助）
 *
 * 底部固定：
 * - 公告中心
 *
 * 特殊权限入口（+1）：
 * - 代理中心（agent 角色可见）
 * - 管理后台（admin 角色可见）
 */

// 导航项定义
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  // 匹配模式，用于判断激活状态（与移动端 MobileNav 保持一致）
  activePattern?: RegExp;
}

// 主导航项（与移动端 5 Tab 完全一致）
const mainNavItems: NavItem[] = [
  {
    href: '/dashboard',
    label: '首页',
    icon: Home,
    activePattern: /^\/dashboard(\/|$)/,
  },
  {
    href: '/trading',
    label: '交易',
    icon: TrendingUp,
    // 匹配 /trading 及 /instances（VPS 实例属于交易域）
    activePattern: /^\/(trading|instances)(\/|$)/,
  },
  {
    href: '/strategies',
    label: '策略',
    icon: Zap,
    activePattern: /^\/strategies(\/|$)/,
  },
  {
    href: '/wallet',
    label: '资产',
    icon: Wallet,
    activePattern: /^\/wallet(\/|$)/,
  },
  {
    href: '/me',
    label: '我的',
    icon: User,
    // 匹配与"我"直接相关的页面（与移动端一致）
    activePattern: /^\/(me|settings|profile|referral)(\/|$)/,
  },
];

// 底部导航（公告中心）
const bottomItems: NavItem[] = [
  { href: '/announcements', label: '公告中心', icon: Megaphone },
];

// 单个导航项组件 - 与移动端 MobileNav 风格统一
interface NavItemProps {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  variant?: 'default' | 'success' | 'warning';
  badge?: string;
  collapsed?: boolean;
}

function NavItemComponent({
  href,
  label,
  icon: Icon,
  isActive,
  variant = 'default',
  badge,
  collapsed = false,
}: NavItemProps) {
  const variantStyles = {
    default: {
      active: 'bg-brand-primary/15 text-brand-primary',
      inactive: 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50',
      iconColor: 'text-brand-primary',
    },
    success: {
      active: 'bg-success/15 text-success',
      inactive: 'text-success/80 hover:text-success hover:bg-success/10',
      iconColor: 'text-success',
    },
    warning: {
      active: 'bg-warning/15 text-warning',
      inactive: 'text-warning/80 hover:text-warning hover:bg-warning/10',
      iconColor: 'text-warning',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Link
      href={href}
      prefetch={true}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-xl text-sm font-medium transition-colors duration-100 group relative',
        collapsed ? 'px-2 py-3 justify-center flex-col gap-1' : 'px-4 py-3 gap-3',
        isActive ? styles.active : styles.inactive
      )}
    >
      {/* 图标容器 - 与移动端风格一致 */}
      <div className={cn(
        'relative p-2 rounded-xl transition-colors duration-100',
        isActive
          ? 'bg-brand-primary/15 shadow-glow-md'
          : 'group-hover:bg-bg-tertiary/50'
      )}>
        <Icon
          className={cn(
            'w-5 h-5 transition-colors duration-100',
            isActive
              ? `${styles.iconColor} drop-shadow-glow`
              : 'text-text-secondary group-hover:text-text-primary'
          )}
          strokeWidth={isActive ? 2.5 : 2}
        />
        {/* 活跃指示点 */}
        {isActive && (
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-primary shadow-glow-sm" />
        )}
      </div>

      {/* 标签文字 */}
      {!collapsed && (
        <span className="flex-1">{label}</span>
      )}
      {collapsed && (
        <span className={cn(
          'text-[10px] font-medium transition-all duration-200',
          isActive ? styles.iconColor : 'text-text-tertiary'
        )}>
          {label}
        </span>
      )}

      {/* 徽章 */}
      {badge && !collapsed && (
        <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-danger text-white rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
      {badge && collapsed && (
        <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 text-[9px] font-bold bg-danger text-white rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { unreadAnnouncementsCount, setUnreadCount, sidebarCollapsed, toggleSidebarCollapsed } = useUiStore();

  // 判断用户角色（仅代理商在侧边栏显示特殊入口）
  const isAgent = user?.isAgent === true;

  // 预加载所有导航页面，确保点击秒到
  useEffect(() => {
    [...mainNavItems, ...bottomItems].forEach((item) => {
      router.prefetch(item.href);
    });
    if (isAgent) {
      router.prefetch('/agent');
    }
  }, [router, isAgent]);

  // 模拟获取未读公告数量（实际应从 API 获取）
  useEffect(() => {
    // TODO: 从 API 获取真实未读数量
    setUnreadCount(2);
  }, [setUnreadCount]);

  // 判断激活状态（使用与移动端相同的逻辑）
  const isItemActive = (item: NavItem) => {
    if (item.activePattern) {
      return item.activePattern.test(pathname);
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 bottom-0 bg-bg-primary/95 backdrop-blur-lg hidden lg:flex flex-col transition-all duration-300 z-20',
        sidebarCollapsed ? 'w-20' : 'w-56'
      )}
    >
      <div className="flex flex-col h-full py-4 overflow-y-auto scrollbar-thin">
        {/* 折叠/展开按钮 */}
        <div className={cn('mb-4', sidebarCollapsed ? 'px-2 flex justify-center' : 'px-3')}>
          <button
            onClick={toggleSidebarCollapsed}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/50 transition-colors"
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <>
                <PanelLeftClose className="w-5 h-5" />
                <span className="text-xs">收起</span>
              </>
            )}
          </button>
        </div>

        {/* 主导航 - 5 个核心入口（与移动端 Tab 一致） */}
        <nav className={cn('flex-1 space-y-1', sidebarCollapsed ? 'px-2' : 'px-3')}>
          {mainNavItems.map((item) => (
            <NavItemComponent
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={isItemActive(item)}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>

        {/* 底部导航 */}
        <nav className={cn('space-y-1 border-t border-border-primary/30 pt-4 mt-4', sidebarCollapsed ? 'px-2' : 'px-3')}>
          {/* 公告中心 */}
          {bottomItems.map((item) => {
            const badge = item.href === '/announcements' && unreadAnnouncementsCount > 0
              ? unreadAnnouncementsCount.toString()
              : undefined;
            return (
              <NavItemComponent
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={pathname === item.href}
                badge={badge}
                collapsed={sidebarCollapsed}
              />
            );
          })}

          {/* 代理商特殊入口 */}
          {isAgent && (
            <div className="pt-3 mt-3 border-t border-border-primary/30 space-y-1">
              {!sidebarCollapsed && (
                <p className="px-4 mb-2 text-[10px] font-semibold text-text-tertiary uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-brand-primary" />
                  特殊权限
                </p>
              )}

              {/* 代理商入口 */}
              <NavItemComponent
                href="/agent"
                label="代理中心"
                icon={Users}
                isActive={pathname.startsWith('/agent')}
                variant="success"
                collapsed={sidebarCollapsed}
              />
            </div>
          )}
        </nav>

        {/* 版本信息 */}
        <div className={cn(
          'border-t border-border-primary/30 mt-4 pt-3',
          sidebarCollapsed ? 'px-2 flex justify-center' : 'px-3'
        )}>
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-text-tertiary">系统正常</span>
              </div>
              <span className="text-[10px] text-text-tertiary bg-bg-tertiary/50 px-1.5 py-0.5 rounded">
                v1.16.0
              </span>
            </div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="系统正常 v1.16.0" />
          )}
        </div>
      </div>
    </aside>
  );
}
