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
  ScrollText,
  Settings,
  FileCode,
  ClipboardCheck,
  FileText,
  Wallet,
  ShieldAlert,
  ArrowDownToLine,
  CircleDollarSign,
  UserPlus,
  Lock,
  BarChart3,
} from 'lucide-react';

const adminNavItems = [
  { href: '/admin', label: '概览', icon: LayoutDashboard },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/instances', label: 'VPS 监控', icon: Server },
  { href: '/admin/finance', label: '财务审计', icon: DollarSign },
  { href: '/admin/finance/deposits', label: '充值审核', icon: ArrowDownToLine },
  { href: '/admin/finance/withdrawals', label: '提现审核', icon: FileCheck },
  { href: '/admin/finance/balance', label: '余额调整', icon: CircleDollarSign },
  { href: '/admin/staking', label: '质押管理', icon: Lock },
  { href: '/admin/reports', label: '报表导出', icon: BarChart3 },
  { href: '/admin/agents', label: '代理商管理', icon: UserPlus },
  { href: '/admin/agents/withdrawals', label: '代理商提现', icon: Wallet },
  { href: '/admin/strategies', label: '策略管理', icon: FileCode },
  { href: '/admin/strategies/review', label: '策略审核', icon: ClipboardCheck },
  { href: '/admin/announcements', label: '公告管理', icon: Megaphone },
  { href: '/admin/cms', label: 'CMS 管理', icon: FileText },
  { href: '/admin/audit-logs', label: '审计日志', icon: ScrollText },
  { href: '/admin/configs', label: '系统配置', icon: Settings },
  { href: '/admin/kill-switch', label: '紧急开关', icon: AlertOctagon },
];

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
      <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#3772FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#848E9C]">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0B0E11] flex">
      {/* 管理后台侧边栏 */}
      <aside className="w-64 bg-[#131722] border-r border-[#2B3139] fixed h-full">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-[#2B3139]">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#F23645] rounded-lg flex items-center justify-center">
              <AlertOctagon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">管理后台</span>
          </Link>
        </div>

        {/* 导航菜单 */}
        <nav className="p-4 space-y-1">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#F23645]/10 text-[#F23645]'
                    : 'text-[#848E9C] hover:bg-[#1E222D] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 底部操作 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#2B3139]">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#848E9C] hover:bg-[#1E222D] hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>返回用户端</span>
          </Link>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#848E9C] hover:bg-[#1E222D] hover:text-[#F23645] transition-colors"
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
