'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, Button } from '@/components/ui';
import {
  User,
  Shield,
  Gift,
  Sparkles,
  ChevronRight,
  LogOut,
  Crown,
  HelpCircle,
  Users,
  Settings,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 个人中心页面 - 「我的」Tab 统一入口
 * 路由：/me
 *
 * 功能：
 * - 用户信息展示（头像、邮箱、VIP等级）
 * - 功能入口列表（安全、生态、邀请、帮助）
 * - 角色特殊入口（代理商、管理员）
 * - 退出登录
 */

interface MenuItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  description?: string;
  badge?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function MenuItem({ href, icon: Icon, label, description, badge, variant = 'default' }: MenuItemProps) {
  const variantStyles = {
    default: 'text-text-secondary group-hover:text-brand-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };

  const bgStyles = {
    default: 'bg-brand-primary/10 group-hover:bg-brand-primary/20',
    success: 'bg-success/10',
    warning: 'bg-warning/10',
    danger: 'bg-danger/10',
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-all group"
    >
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
        bgStyles[variant]
      )}>
        <Icon className={cn('w-5 h-5', variantStyles[variant])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-tertiary mt-0.5 truncate">{description}</p>
        )}
      </div>
      {badge && (
        <span className="px-2 py-0.5 text-xs font-medium bg-brand-primary/20 text-brand-primary rounded-full flex-shrink-0">
          {badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-text-secondary transition-colors flex-shrink-0" />
    </Link>
  );
}

export default function MePage() {
  const { user, isAuthenticated, logout } = useAuthStore();

  // 判断用户角色
  const isAgent = user?.isAgent === true;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <User className="w-16 h-16 text-text-tertiary" />
        <p className="text-text-secondary">请先登录</p>
        <Link href="/login">
          <Button variant="gradient">立即登录</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 - 仅桌面端显示 */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-text-primary">我的</h1>
        <p className="text-text-secondary mt-1">管理你的账户和偏好设置</p>
      </div>

      {/* 用户信息卡片 */}
      <Card variant="glass" className="overflow-hidden">
        {/* 顶部装饰 */}
        <div className="h-16 bg-gradient-to-r from-brand-primary/30 via-brand-secondary/20 to-brand-primary/30" />

        <CardContent className="relative -mt-8 pb-4">
          {/* 头像和基本信息 */}
          <div className="flex items-end gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center border-4 border-bg-secondary shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-text-primary">
                  {user?.email?.split('@')[0] || '用户'}
                </h2>
                {user?.vipLevel && user.vipLevel > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-warning/20 text-warning rounded-full">
                    <Crown className="w-3 h-3" />
                    VIP{user.vipLevel}
                  </span>
                )}
              </div>
              <p className="text-sm text-text-tertiary truncate">{user?.email}</p>
            </div>
            <Link href="/settings">
              <Button variant="outline" size="sm" className="flex-shrink-0">
                编辑资料
              </Button>
            </Link>
          </div>

        </CardContent>
      </Card>

      {/* 功能入口列表 - 精简为个人相关入口 */}
      <div className="space-y-2">
        <MenuItem
          href="/settings"
          icon={Settings}
          label="设置"
          description="账户、安全、通知"
        />
        <MenuItem
          href="/announcements"
          icon={Megaphone}
          label="公告中心"
          description="查看最新公告"
        />
        <MenuItem
          href="/referral"
          icon={Gift}
          label="邀请返佣"
          description="已邀请 23 人"
        />
        <MenuItem
          href="/help"
          icon={HelpCircle}
          label="帮助与反馈"
        />
      </div>

      {/* 角色特殊入口 */}
      {(isAgent || isAdmin) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-tertiary uppercase px-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-brand-primary" />
            特殊权限
          </p>
          <div className="space-y-2">
            {isAgent && (
              <MenuItem
                href="/agent"
                icon={Users}
                label="代理商中心"
                description="查看返佣、推广业绩"
                variant="success"
              />
            )}
            {isAdmin && (
              <MenuItem
                href="/admin"
                icon={Shield}
                label="管理后台"
                description="用户管理、系统配置"
                variant="warning"
              />
            )}
          </div>
        </div>
      )}

      {/* 退出登录 */}
      <div className="pt-4">
        <Button
          variant="ghost"
          className="w-full justify-center text-danger hover:bg-danger/10 hover:text-danger"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </Button>
      </div>

      {/* 版本信息 */}
      <div className="text-center py-4">
        <p className="text-xs text-text-tertiary">QuantFi v1.15.0</p>
      </div>
    </div>
  );
}
