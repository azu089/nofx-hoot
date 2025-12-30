'use client';

import { useEffect } from 'react';
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
} from 'lucide-react';

const adminNavItems = [
  { href: '/admin', label: '概览', icon: LayoutDashboard },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/instances', label: 'VPS 监控', icon: Server },
  { href: '/admin/finance', label: '财务审计', icon: DollarSign },
  { href: '/admin/finance/withdrawals', label: '提现审核', icon: FileCheck },
  { href: '/admin/strategies', label: '策略管理', icon: FileCheck },
  { href: '/admin/announcements', label: '公告管理', icon: Megaphone },
  { href: '/admin/kill-switch', label: '紧急开关', icon: AlertOctagon },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth, user, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
    // TODO: 添加管理员角色检查
    // if (!isLoading && isAuthenticated && user?.role !== 'admin') {
    //   router.push('/dashboard');
    // }
  }, [isAuthenticated, isLoading, router, user]);

  if (isLoading) {
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
