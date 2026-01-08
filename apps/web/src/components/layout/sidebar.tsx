'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Bot,
  Wallet,
  Settings,
  HelpCircle,
  TrendingUp,
  Globe,
  Receipt,
  FlaskConical,
  ListOrdered,
  Users,
  Shield,
  Sparkles,
  Upload,
  FolderOpen,
  DollarSign,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Coins,
  ArrowRightLeft,
  Clock,
  Trophy,
  Gift,
  CreditCard,
  Key,
  Bell,
  Lock,
  AlertTriangle,
  Megaphone,
  User,
  Server,
  PanelLeftClose,
  PanelLeft,
  Bookmark,
  Radio,
  Banknote,
  Ban,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { useState, useEffect } from 'react';

/**
 * 侧边栏导航结构（5+1 结构）
 *
 * 核心分组（5个）：
 * - 交易：交易控制台（策略为主体）、历史记录、回测系统、AI 策略、交易信号
 * - 策略：策略市场、我的配置、上传策略、已上传、策略收益
 * - 资产：钱包概览、充值、提现、API Key、账单明细
 * - 生态中心：生态概览、积分中心、质押大厅、积分兑换、释放进度、排行榜（独立分组）
 * - 我的：个人中心、安全中心、邀请返佣、帮助与反馈
 * - 高级功能：VPS 实例（默认收起，普通用户无需频繁访问）
 *
 * 底部固定：
 * - 公告中心
 *
 * 特殊权限入口（+1）：
 * - 代理中心（agent 角色可见）
 * - 管理后台（admin 角色可见）
 */

// 导航分组定义
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
}

// 主导航项（不带子菜单）
const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
];

// 交易模块（策略为主体，VPS 对用户透明）
const tradingGroup: NavGroup = {
  id: 'trading',
  label: '交易',
  icon: TrendingUp,
  defaultOpen: true,
  items: [
    { href: '/trading', label: '交易控制台', icon: TrendingUp },
    { href: '/trading/history', label: '历史记录', icon: ListOrdered },
    { href: '/trading/backtest', label: '回测系统', icon: FlaskConical },
    { href: '/trading/ai', label: 'AI 策略', icon: Sparkles, badge: '新' },
    { href: '/trading/signals', label: '交易信号', icon: Radio },
  ],
};

// 高级功能模块（VPS 实例管理 - 普通用户无需频繁访问）
const advancedGroup: NavGroup = {
  id: 'advanced',
  label: '高级功能',
  icon: Server,
  defaultOpen: false,
  items: [
    { href: '/instances', label: 'VPS 实例', icon: Server },
  ],
};

// 策略模块
const strategyGroup: NavGroup = {
  id: 'strategies',
  label: '策略',
  icon: Bot,
  defaultOpen: true,
  items: [
    { href: '/strategies', label: '策略市场', icon: Bot },
    { href: '/strategies/my', label: '我的策略', icon: Bookmark },
  ],
};

// 资产模块（含银行卡管理）
const walletGroup: NavGroup = {
  id: 'wallet',
  label: '资产',
  icon: Wallet,
  defaultOpen: false,
  items: [
    { href: '/wallet', label: '钱包概览', icon: Wallet },
    { href: '/wallet/deposit', label: '充值', icon: CreditCard },
    { href: '/wallet/withdraw', label: '提现', icon: DollarSign },
    { href: '/wallet/api-keys', label: 'API Key', icon: Key },
    { href: '/wallet/billing', label: '账单明细', icon: Receipt },
    { href: '/wallet/cards', label: '银行卡', icon: Banknote },
  ],
};

// 个人中心模块（用户信息、邀请返佣）
const profileGroup: NavGroup = {
  id: 'me',
  label: '个人',
  icon: User,
  defaultOpen: false,
  items: [
    { href: '/me', label: '个人中心', icon: User },
    { href: '/referral', label: '邀请返佣', icon: Gift, badge: '热门' },
    { href: '/help', label: '帮助与反馈', icon: HelpCircle },
  ],
};

// 设置模块（账户设置、安全、通知、黑名单、紧急按钮）
const settingsGroup: NavGroup = {
  id: 'settings',
  label: '设置',
  icon: Settings,
  defaultOpen: false,
  items: [
    { href: '/settings', label: '账户设置', icon: Settings },
    { href: '/settings/security', label: '安全中心', icon: Shield },
    { href: '/settings/notifications', label: '通知设置', icon: Bell },
    { href: '/settings/blacklist', label: '币种黑名单', icon: Ban },
    { href: '/settings/panic', label: '紧急按钮', icon: AlertTriangle },
  ],
};

// 生态中心模块（合并积分质押 + 生态更多 + Token 信息）
const ecosystemGroup: NavGroup = {
  id: 'ecosystem',
  label: '生态中心',
  icon: Globe,
  defaultOpen: false,
  items: [
    { href: '/ecosystem', label: '生态概览', icon: Globe },
    { href: '/ecosystem/points', label: '积分中心', icon: Coins },
    { href: '/ecosystem/staking', label: '质押大厅', icon: Sparkles, badge: '热门' },
    { href: '/ecosystem/exchange', label: '积分兑换', icon: ArrowRightLeft },
    { href: '/ecosystem/vesting', label: '释放进度', icon: Clock },
    { href: '/ecosystem/leaderboard', label: '排行榜', icon: Trophy },
    { href: '/ecosystem/token', label: 'Token 信息', icon: Coins },
  ],
};

// 底部导航（仅保留公告中心）
const bottomItems: NavItem[] = [
  { href: '/announcements', label: '公告中心', icon: Megaphone },
];

// 导航分组（6+1 结构，设置独立为单独分组）
const navGroups: NavGroup[] = [
  tradingGroup,     // 交易（策略为主体）
  strategyGroup,    // 策略
  walletGroup,      // 资产
  ecosystemGroup,   // 生态中心（独立分组）
  profileGroup,     // 个人（个人中心、邀请、帮助）
  settingsGroup,    // 设置（账户、安全、通知、黑名单、紧急）
  advancedGroup,    // 高级功能（VPS 实例，默认收起）
];

// 单个导航项组件
interface NavItemProps {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  variant?: 'default' | 'success' | 'warning';
  indent?: boolean;
  badge?: string;
  collapsed?: boolean;
}

function NavItemComponent({
  href,
  label,
  icon: Icon,
  isActive,
  variant = 'default',
  indent = false,
  badge,
  collapsed = false,
}: NavItemProps) {
  const variantStyles = {
    default: {
      active: 'bg-brand-primary/15 text-brand-primary border-l-brand-primary',
      inactive: 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50',
      iconBg: 'bg-brand-primary/20',
      iconColor: 'text-brand-primary',
    },
    success: {
      active: 'bg-success/15 text-success border-l-success',
      inactive: 'text-success/80 hover:text-success hover:bg-success/10',
      iconBg: 'bg-success/20',
      iconColor: 'text-success',
    },
    warning: {
      active: 'bg-warning/15 text-warning border-l-warning',
      inactive: 'text-warning/80 hover:text-warning hover:bg-warning/10',
      iconBg: 'bg-warning/20',
      iconColor: 'text-warning',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium transition-all duration-200 group relative',
        collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2',
        indent && !collapsed ? 'ml-4' : '',
        isActive
          ? `${styles.active} border-l-2`
          : `${styles.inactive} border-l-2 border-l-transparent hover:border-l-brand-primary/50`
      )}
    >
      <div
        className={cn(
          'rounded-lg flex items-center justify-center transition-transform group-hover:scale-105',
          collapsed ? 'w-8 h-8' : 'w-7 h-7 mr-2.5',
          isActive ? styles.iconBg : 'bg-bg-tertiary/50'
        )}
      >
        <Icon
          className={cn(
            collapsed ? 'w-4 h-4' : 'w-3.5 h-3.5',
            isActive ? styles.iconColor : 'text-text-secondary group-hover:text-text-primary'
          )}
        />
      </div>
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge && (
            <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-danger text-white rounded-full flex items-center justify-center">
              {badge}
            </span>
          )}
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
        </>
      )}
      {collapsed && badge && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 text-[9px] font-bold bg-danger text-white rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

// 可折叠导航组组件
interface NavGroupComponentProps {
  group: NavGroup;
  pathname: string;
  collapsed?: boolean;
}

function NavGroupComponent({ group, pathname, collapsed = false }: NavGroupComponentProps) {
  // 判断该组是否有活跃项
  const hasActiveItem = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const [isOpen, setIsOpen] = useState(group.defaultOpen || hasActiveItem);

  const Icon = group.icon;

  // 折叠模式下，只显示第一个活跃项或第一个项的图标
  if (collapsed) {
    const activeItem = group.items.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
    const displayItem = activeItem || group.items[0];

    return (
      <div className="relative group/collapsed">
        <Link
          href={displayItem.href}
          title={group.label}
          className={cn(
            'flex items-center justify-center px-2 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            hasActiveItem
              ? 'bg-brand-primary/15 text-brand-primary border-l-2 border-l-brand-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50 border-l-2 border-l-transparent'
          )}
        >
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              hasActiveItem ? 'bg-brand-primary/20' : 'bg-bg-tertiary/50'
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4',
                hasActiveItem ? 'text-brand-primary' : 'text-text-secondary group-hover/collapsed:text-text-primary'
              )}
            />
          </div>
        </Link>
        {/* 悬浮展开菜单 */}
        <div className="absolute left-full top-0 ml-2 opacity-0 invisible group-hover/collapsed:opacity-100 group-hover/collapsed:visible transition-all z-50">
          <div className="glass-card rounded-lg border border-border-primary/50 py-2 min-w-[180px] shadow-xl">
            <p className="px-3 py-1.5 text-xs font-semibold text-text-tertiary uppercase">{group.label}</p>
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'text-brand-primary bg-brand-primary/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-danger text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* 组标题 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
          hasActiveItem
            ? 'text-brand-primary bg-brand-primary/5'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
        )}
      >
        <div
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center mr-2.5',
            hasActiveItem ? 'bg-brand-primary/20' : 'bg-bg-tertiary/50'
          )}
        >
          <Icon
            className={cn(
              'w-3.5 h-3.5',
              hasActiveItem ? 'text-brand-primary' : 'text-text-secondary group-hover:text-text-primary'
            )}
          />
        </div>
        <span className="flex-1 text-left">{group.label}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-text-tertiary" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-tertiary" />
        )}
      </button>

      {/* 子菜单 */}
      {isOpen && (
        <div className="space-y-0.5 ml-2 border-l border-border-primary/30 pl-2">
          {group.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <NavItemComponent
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                badge={item.badge}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { unreadAnnouncementsCount, setUnreadCount, sidebarCollapsed, toggleSidebarCollapsed } = useUiStore();

  // 判断用户角色
  const isAgent = user?.isAgent === true;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // 模拟获取未读公告数量（实际应从 API 获取）
  useEffect(() => {
    // TODO: 从 API 获取真实未读数量
    // 这里先设置一个模拟值
    setUnreadCount(2);
  }, [setUnreadCount]);

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 bottom-0 glass-card border-r border-border-primary/50 hidden lg:flex flex-col transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full py-3 overflow-y-auto scrollbar-thin">
        {/* 折叠/展开按钮 */}
        <div className={cn('px-3 mb-2', sidebarCollapsed && 'flex justify-center')}>
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

        {/* 主导航 */}
        <nav className={cn('space-y-0.5', sidebarCollapsed ? 'px-2' : 'px-3')}>
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <NavItemComponent
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                collapsed={sidebarCollapsed}
              />
            );
          })}
        </nav>

        {/* 分隔线 */}
        <div className={cn('my-2 border-t border-border-primary/30', sidebarCollapsed ? 'mx-2' : 'mx-3')} />

        {/* 导航分组 */}
        <nav className={cn('flex-1 space-y-1 overflow-y-auto', sidebarCollapsed ? 'px-2' : 'px-3')}>
          {navGroups.map((group) => (
            <NavGroupComponent
              key={group.id}
              group={group}
              pathname={pathname}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>

        {/* 底部导航 */}
        <nav className={cn('space-y-0.5 border-t border-border-primary/30 pt-3 mt-2', sidebarCollapsed ? 'px-2' : 'px-3')}>
          {bottomItems.map((item) => {
            const isActive = pathname === item.href;
            // 公告中心显示未读数量
            const badge = item.href === '/announcements' && unreadAnnouncementsCount > 0
              ? unreadAnnouncementsCount.toString()
              : undefined;
            return (
              <NavItemComponent
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                badge={badge}
                collapsed={sidebarCollapsed}
              />
            );
          })}

          {/* 角色特殊入口 */}
          {(isAgent || isAdmin) && (
            <div className="pt-3 mt-3 border-t border-border-primary/30">
              {!sidebarCollapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold text-text-tertiary uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-brand-primary" />
                  特殊权限
                </p>
              )}

              {/* 代理商入口 */}
              {isAgent && (
                <NavItemComponent
                  href="/agent"
                  label="代理中心"
                  icon={Users}
                  isActive={pathname.startsWith('/agent')}
                  variant="success"
                  collapsed={sidebarCollapsed}
                />
              )}

              {/* 管理员入口 */}
              {isAdmin && (
                <NavItemComponent
                  href="/admin"
                  label="管理后台"
                  icon={Shield}
                  isActive={pathname.startsWith('/admin')}
                  variant="warning"
                  collapsed={sidebarCollapsed}
                />
              )}
            </div>
          )}
        </nav>

        {/* 版本信息 */}
        {!sidebarCollapsed && (
          <div className="px-3 py-3 border-t border-border-primary/30 mt-2">
            <div className="flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-text-tertiary">系统正常</span>
              </div>
              <span className="text-[10px] text-text-tertiary bg-bg-tertiary/50 px-1.5 py-0.5 rounded">
                v1.15.0
              </span>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="px-2 py-3 border-t border-border-primary/30 mt-2 flex justify-center">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="系统正常" />
          </div>
        )}
      </div>
    </aside>
  );
}
