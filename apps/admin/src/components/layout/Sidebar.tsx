'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import {
  LayoutDashboard,
  Users,
  Server,
  DollarSign,
  FileCheck,
  ArrowDownToLine,
  Coins,
  Megaphone,
  AlertOctagon,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Zap,
  ScrollText,
  Settings,
  FileText,
  Shield,
  Bot,
  Weight,
  Receipt,
  UserCheck,
} from 'lucide-react';

// 分组导航配置
const navGroups = [
  {
    id: 'main',
    items: [
      { href: '/dashboard', label: '概览', icon: LayoutDashboard },
      { href: '/users', label: '用户管理', icon: Users },
    ],
  },
  {
    id: 'finance',
    label: '财务管理',
    icon: DollarSign,
    items: [
      { href: '/finance', label: '财务概览', icon: DollarSign },
      { href: '/finance/deposits', label: '充值审核', icon: ArrowDownToLine },
      { href: '/finance/withdrawals', label: '提现审核', icon: FileCheck },
      { href: '/finance/records', label: '交易明细', icon: Receipt },
    ],
  },
  {
    id: 'business',
    label: '业务管理',
    icon: Zap,
    items: [
      { href: '/staking', label: '质押管理', icon: Coins },
      { href: '/staking/weights', label: '权重分布', icon: Weight },
      { href: '/strategies', label: '策略管理', icon: Zap },
      { href: '/instances', label: 'VPS 监控', icon: Server },
      { href: '/agents', label: '代理商管理', icon: UserCheck },
    ],
  },
  {
    id: 'content',
    label: '内容运营',
    icon: Megaphone,
    items: [
      { href: '/announcements', label: '公告管理', icon: Megaphone },
      { href: '/cms', label: '内容管理', icon: FileText },
      { href: '/telegram', label: 'TG Bot 配置', icon: Bot },
    ],
  },
  {
    id: 'system',
    label: '系统设置',
    icon: Settings,
    items: [
      { href: '/configs', label: '配置中心', icon: Settings },
      { href: '/audit-logs', label: '审计日志', icon: ScrollText },
      { href: '/kill-switch', label: '紧急开关', icon: AlertOctagon },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAdminAuthStore();

  // 根据当前路径自动展开对应分组
  const getInitialExpandedGroups = () => {
    const expanded: string[] = [];
    navGroups.forEach((group) => {
      if (group.items.some((item) => pathname?.startsWith(item.href))) {
        expanded.push(group.id);
      }
    });
    return expanded;
  };

  const [expandedGroups, setExpandedGroups] = useState<string[]>(
    getInitialExpandedGroups()
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <aside className="w-64 bg-[#131722] border-r border-[#2B3139] fixed h-full flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-[#2B3139] flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#F23645] rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">管理后台</span>
        </Link>
      </div>

      {/* 导航菜单 - 可滚动区域 */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navGroups.map((group) => {
          const isExpanded = expandedGroups.includes(group.id);
          const hasActiveItem = group.items.some((item) =>
            isItemActive(item.href)
          );

          // 无分组标题的顶级菜单项
          if (!group.label) {
            return (
              <div key={group.id} className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isItemActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-[#F23645]/10 text-[#F23645]'
                          : 'text-[#848E9C] hover:bg-[#1E222D] hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          }

          // 有分组标题的折叠菜单
          const GroupIcon = group.icon;
          return (
            <div key={group.id} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors ${
                  hasActiveItem
                    ? 'text-[#F23645]'
                    : 'text-[#848E9C] hover:bg-[#1E222D] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{group.label}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* 子菜单 */}
              {isExpanded && (
                <div className="ml-4 pl-4 border-l border-[#2B3139] space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isItemActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-[#F23645]/10 text-[#F23645]'
                            : 'text-[#848E9C] hover:bg-[#1E222D] hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 底部操作 - 固定在底部 */}
      <div className="flex-shrink-0 p-4 border-t border-[#2B3139] space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[#848E9C] hover:bg-[#1E222D] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">返回用户端</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[#848E9C] hover:bg-[#1E222D] hover:text-[#F23645] transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">退出登录</span>
        </button>
      </div>
    </aside>
  );
}
