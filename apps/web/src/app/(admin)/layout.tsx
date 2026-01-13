'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import {
  LayoutDashboard,
  Users,
  Server,
  DollarSign,
  FileCheck,
  Megaphone,
  AlertOctagon,
  LogOut,
  ChevronLeft,
  ChevronDown,
  ScrollText,
  Settings,
  FileCode,
  ClipboardCheck,
  FileText,
  Wallet,
  ArrowDownToLine,
  CircleDollarSign,
  UserPlus,
  Lock,
  BarChart3,
  ShieldBan,
  Smartphone,
  KeyRound,
  Palette,
  MessageSquareWarning,
  Activity,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 导航分组数据结构
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  isSingle?: boolean; // 单独入口，不折叠
}

// 分组式导航配置
const adminNavGroups: NavGroup[] = [
  {
    id: 'overview',
    label: '概览',
    icon: LayoutDashboard,
    items: [{ href: '/admin', label: '概览', icon: LayoutDashboard }],
    isSingle: true,
  },
  {
    id: 'users',
    label: '用户管理',
    icon: Users,
    items: [
      { href: '/admin/users', label: '用户列表', icon: Users },
      { href: '/admin/blacklist', label: '黑名单管理', icon: ShieldBan },
      { href: '/admin/sessions', label: '会话管理', icon: Smartphone },
      { href: '/admin/api-keys', label: 'API Key 监管', icon: KeyRound },
      { href: '/admin/login-alerts', label: '登录告警', icon: MessageSquareWarning },
      { href: '/admin/rbac', label: '权限管理', icon: Shield },
    ],
  },
  {
    id: 'vps',
    label: 'VPS 管理',
    icon: Server,
    items: [
      { href: '/admin/instances', label: 'VPS 监控', icon: Server },
      { href: '/admin/instance-metrics', label: 'VPS 性能', icon: Activity },
    ],
  },
  {
    id: 'finance',
    label: '财务管理',
    icon: DollarSign,
    items: [
      { href: '/admin/finance', label: '财务审计', icon: DollarSign },
      { href: '/admin/finance/deposits', label: '充值审核', icon: ArrowDownToLine },
      { href: '/admin/finance/withdrawals', label: '提现审核', icon: FileCheck },
      { href: '/admin/finance/balance', label: '余额调整', icon: CircleDollarSign },
      { href: '/admin/reports', label: '报表导出', icon: BarChart3 },
    ],
  },
  {
    id: 'agents',
    label: '代理商管理',
    icon: UserPlus,
    items: [
      { href: '/admin/agents', label: '代理商列表', icon: UserPlus },
      { href: '/admin/agents/withdrawals', label: '代理商提现', icon: Wallet },
    ],
  },
  {
    id: 'strategy',
    label: '策略与生态',
    icon: FileCode,
    items: [
      { href: '/admin/strategies', label: '策略管理', icon: FileCode },
      { href: '/admin/strategies/review', label: '策略审核', icon: ClipboardCheck },
      { href: '/admin/staking', label: '质押管理', icon: Lock },
    ],
  },
  {
    id: 'content',
    label: '内容运营',
    icon: Megaphone,
    items: [
      { href: '/admin/announcements', label: '公告管理', icon: Megaphone },
      { href: '/admin/popups', label: '弹窗公告', icon: MessageSquareWarning },
      { href: '/admin/cms', label: 'CMS 管理', icon: FileText },
      { href: '/admin/brand', label: '品牌配置', icon: Palette },
    ],
  },
  {
    id: 'system',
    label: '系统设置',
    icon: Settings,
    items: [
      { href: '/admin/configs', label: '系统配置', icon: Settings },
      { href: '/admin/audit-logs', label: '审计日志', icon: ScrollText },
      { href: '/admin/kill-switch', label: '紧急开关', icon: AlertOctagon },
    ],
  },
];

// 导航分组组件
function NavGroupItem({
  group,
  pathname,
  expandedGroups,
  onToggle,
}: {
  group: NavGroup;
  pathname: string;
  expandedGroups: Set<string>;
  onToggle: (groupId: string) => void;
}) {
  const Icon = group.icon;

  // 检查当前路径是否在该分组内
  const isGroupActive = group.items.some(
    (item) =>
      pathname === item.href ||
      (item.href !== '/admin' && pathname.startsWith(item.href))
  );

  const isExpanded = expandedGroups.has(group.id);

  // 单独入口（如概览）直接渲染为链接
  if (group.isSingle && group.items.length === 1) {
    const item = group.items[0];
    const isActive = pathname === item.href;

    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
          isActive
            ? 'bg-danger/10 text-danger'
            : 'text-text-secondary hover:bg-bg-tertiary hover:text-white'
        )}
      >
        <Icon className="w-5 h-5" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      {/* 分组标题 */}
      <button
        onClick={() => onToggle(group.id)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
          isGroupActive
            ? 'bg-danger/5 text-danger'
            : 'text-text-secondary hover:bg-bg-tertiary hover:text-white'
        )}
      >
        <Icon className="w-5 h-5" />
        <span className="flex-1 text-left font-medium">{group.label}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform duration-200',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {/* 子项列表 */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="pl-4 space-y-1">
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm',
                  isActive
                    ? 'bg-danger/10 text-danger'
                    : 'text-text-tertiary hover:bg-bg-tertiary hover:text-white'
                )}
              >
                <ItemIcon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth, user, logout, _hasHydrated } = useAuthStore();

  // 标记客户端是否已挂载，避免 hydration 不匹配
  const [isMounted, setIsMounted] = useState(false);

  // 标记是否已完成初始认证检查，避免导航过程中的竞态条件
  const hasInitializedRef = useRef(false);

  // 展开的分组（使用 Set 存储）
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // 初始化时展开当前页面所在的分组
    const initial = new Set<string>();
    adminNavGroups.forEach((group) => {
      if (
        group.items.some(
          (item) =>
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href))
        )
      ) {
        initial.add(group.id);
      }
    });
    return initial;
  });

  // 切换分组展开状态
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // 当路径变化时，自动展开对应分组
  useEffect(() => {
    adminNavGroups.forEach((group) => {
      if (
        group.items.some(
          (item) =>
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href))
        )
      ) {
        setExpandedGroups((prev) => {
          const next = new Set(prev);
          next.add(group.id);
          return next;
        });
      }
    });
  }, [pathname]);

  // 客户端挂载后设置 mounted 状态
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // 等待 hydration 完成后，只在初始加载时调用 checkAuth
    if (_hasHydrated && !hasInitializedRef.current) {
      checkAuth();
    }
  }, [checkAuth, _hasHydrated]);

  useEffect(() => {
    // 等待 hydration 完成后进行认证检查
    if (!_hasHydrated) return;

    if (!isLoading) {
      if (!hasInitializedRef.current) {
        // 初始检查完成
        hasInitializedRef.current = true;
        if (!isAuthenticated) {
          router.push('/login');
        } else if (user?.role !== 'admin' && user?.role !== 'super_admin') {
          // 管理员角色检查：只有 admin 或 super_admin 可以访问
          router.push('/admin/unauthorized');
        }
      }
    }
  }, [isAuthenticated, isLoading, router, user, _hasHydrated]);

  // 加载中（包括客户端未挂载、hydration 未完成的情况）
  if (!isMounted || !_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* 管理后台侧边栏 */}
      <aside className="w-64 bg-bg-secondary border-r border-border-primary fixed h-full flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border-primary flex-shrink-0">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-danger rounded-lg flex items-center justify-center">
              <AlertOctagon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">管理后台</span>
          </Link>
        </div>

        {/* 导航菜单 - 可滚动 */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {adminNavGroups.map((group) => (
            <NavGroupItem
              key={group.id}
              group={group}
              pathname={pathname}
              expandedGroups={expandedGroups}
              onToggle={toggleGroup}
            />
          ))}
        </nav>

        {/* 底部操作 */}
        <div className="flex-shrink-0 p-4 border-t border-border-primary">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>返回用户端</span>
          </Link>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-danger transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 ml-64">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
