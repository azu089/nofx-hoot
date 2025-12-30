'use client';

import { useAdminAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

interface HeaderProps {
  title?: string;
}

export function Header({ title = '管理后台' }: HeaderProps) {
  const { user, logout } = useAdminAuthStore();

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      // 重定向将由 AdminGuard 处理
      window.location.href = '/login';
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#F23645]/20 bg-[#0B0E11]/95 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        {/* 左侧：页面标题 */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
        </div>

        {/* 右侧：管理员信息 + 退出按钮 */}
        <div className="flex items-center space-x-4">
          {/* 管理员信息 */}
          <div className="flex items-center space-x-3 rounded-lg bg-[#F23645]/10 px-4 py-2 border border-[#F23645]/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F23645]/20 text-[#F23645]">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-[#848E9C]">管理员</span>
              <span className="text-sm font-medium text-white">
                {user?.email || '未知用户'}
              </span>
            </div>
          </div>

          {/* 退出按钮 */}
          <Button
            variant="danger"
            size="sm"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </div>
      </div>
    </header>
  );
}
