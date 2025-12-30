'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
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
  Zap,
} from 'lucide-react';

const adminNavItems = [
  { href: '/dashboard', label: '概览', icon: LayoutDashboard },
  { href: '/users', label: '用户管理', icon: Users },
  { href: '/instances', label: 'VPS 监控', icon: Server },
  { href: '/finance', label: '财务审计', icon: DollarSign },
  { href: '/finance/withdrawals', label: '提现审核', icon: FileCheck },
  { href: '/strategies', label: '策略管理', icon: Zap },
  { href: '/announcements', label: '公告管理', icon: Megaphone },
  { href: '/kill-switch', label: '紧急开关', icon: AlertOctagon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAdminAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-[#131722] border-r border-[#2B3139] fixed h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-[#2B3139]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#F23645] rounded-lg flex items-center justify-center">
            <AlertOctagon className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">管理后台</span>
        </Link>
      </div>

      {/* 导航菜单 */}
      <nav className="p-4 space-y-1">
        {adminNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname?.startsWith(item.href));
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
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#848E9C] hover:bg-[#1E222D] hover:text-white transition-colors mb-2"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>返回用户端</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#848E9C] hover:bg-[#1E222D] hover:text-[#F23645] transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  );
}
