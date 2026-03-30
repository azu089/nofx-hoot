'use client';

import type React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Settings,
  Brain,
  LogOut,
  BarChart3,
  Wallet,
  Globe,
  UserCheck,
  Share2,
  FileText,
  Shield,
  ScrollText,
  Radio,
} from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/lib/admin-auth';

const adminNavItems = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard, href: '/admin' },
  { id: 'users', label: '用户管理', icon: Users, href: '/admin/users' },
  { id: 'finance', label: '财务中心', icon: DollarSign, href: '/admin/finance' },
  { id: 'trading', label: '交易管理', icon: BarChart3, href: '/admin/trading' },
  { id: 'ai', label: 'AI 管理', icon: Brain, href: '/admin/ai' },
  { id: 'risk', label: '风控中心', icon: Shield, href: '/admin/risk' },
  { id: 'ecosystem', label: '生态管理', icon: Globe, href: '/admin/ecosystem' },
  { id: 'agents', label: '代理商', icon: UserCheck, href: '/admin/agents' },
  { id: 'referral', label: '返佣管理', icon: Share2, href: '/admin/referral' },
  { id: 'content', label: '内容管理', icon: FileText, href: '/admin/content' },
  { id: 'withdraws', label: '提现审核', icon: Wallet, href: '/admin/withdraws' },
  { id: 'blockchain', label: '区块链监控', icon: Radio, href: '/admin/blockchain' },
  { id: 'logs', label: '日志管理', icon: ScrollText, href: '/admin/logs' },
  { id: 'settings', label: '系统设置', icon: Settings, href: '/admin/settings' },
];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, isAuthenticated, isLoading, logout } = useAdminAuth();

  // 加载中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9090A0]">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录显示登录页（login 页面在 admin-login 路由下）
  if (!isAuthenticated && !pathname.includes('admin-login')) {
    // 客户端重定向，期间显示 loading 避免黑屏
    if (typeof window !== 'undefined') {
      window.location.href = '/admin-login';
    }
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9090A0]">正在跳转登录...</p>
        </div>
      </div>
    );
  }

  // 登录页不使用管理布局
  if (pathname.includes('admin-login')) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0F]">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-screen w-56 bg-[#12121A] border-r border-[#1E1E2E] z-40 flex flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center justify-center gap-2 border-b border-[#1E1E2E]">
          <Image src="/icons/hoot/token.png" alt="HOOT" width={28} height={28} className="object-contain" />
          <h1 className="text-lg font-bold text-[#F8F8FC]">Hoot Admin</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1 transition-all text-sm ${
                  isActive
                    ? 'bg-[#1E1E2E] text-[#F8F8FC] border border-[#2A2A3A]'
                    : 'text-[#9090A0] hover:bg-[#1E1E2E]/50 hover:text-[#F8F8FC]'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-cyan-400' : ''} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Admin Info */}
        <div className="border-t border-[#1E1E2E] p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[#9090A0] truncate">
              {admin?.username || 'admin'}
              <span className="ml-1 text-cyan-400/60">
                ({admin?.role === 'super_admin' ? '超级管理员' : admin?.role === 'admin' ? '管理员' : admin?.role})
              </span>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded hover:bg-[#1E1E2E] text-[#9090A0] hover:text-red-400 transition-colors"
              title="退出登录"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-56 flex-1 min-h-screen">
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}
