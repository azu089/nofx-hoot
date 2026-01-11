'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, Button } from '@/components/ui';
import {
  User,
  Shield,
  Sparkles,
  ChevronRight,
  LogOut,
  Crown,
  HelpCircle,
  Users,
  Settings,
  Megaphone,
  TrendingUp,
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
  const [isSubscribed, setIsSubscribed] = useState(false);

  // 判断用户角色
  const isAgent = user?.isAgent === true;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // 获取订阅状态（暂时使用 VIP 等级判断，后续可接入真实订阅 API）
  useEffect(() => {
    if (isAuthenticated) {
      setIsSubscribed((user?.vipLevel ?? 0) > 0);
    }
  }, [isAuthenticated, user?.vipLevel]);

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

      {/* 会员订阅卡片 - P0 最显眼位置 */}
      <Link href="/subscription">
        <Card className={cn(
          'overflow-hidden transition-all hover:border-brand-primary/50',
          isSubscribed
            ? 'bg-gradient-to-r from-warning/10 to-warning/5 border-warning/30'
            : 'bg-gradient-to-r from-brand-primary/10 to-brand-primary/5 border-brand-primary/30'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                isSubscribed
                  ? 'bg-gradient-to-br from-warning to-warning/60'
                  : 'bg-gradient-to-br from-brand-primary to-brand-primary/60'
              )}>
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold">会员订阅</h3>
                  {isSubscribed && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-success/20 text-success rounded-full">
                      已订阅
                    </span>
                  )}
                </div>
                <p className="text-text-secondary text-sm truncate">
                  {isSubscribed
                    ? 'VPS + 全部策略已解锁'
                    : '升级解锁 VPS + 全部策略'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isSubscribed && (
                  <span className="text-sm font-medium text-brand-primary">
                    ¥25/月起
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-text-tertiary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 功能入口列表 - 精简为个人相关入口 */}
      <div className="space-y-2">
        <MenuItem
          href="/me/exchanges"
          icon={TrendingUp}
          label="推荐交易所"
          description="注册返佣，享手续费优惠"
          variant="success"
          badge="返佣"
        />
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
