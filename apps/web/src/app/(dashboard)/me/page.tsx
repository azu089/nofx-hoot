'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, Button } from '@/components/ui';
import {
  User,
  Sparkles,
  ChevronRight,
  LogOut,
  Download,
  HelpCircle,
  Users,
  Settings,
  Megaphone,
  Check,
  Share,
  Plus,
  Crown,
  Gift,
  Copy,
} from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
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
  isOdd?: boolean;
}

function MenuItem({ href, icon: Icon, label, description, badge, variant = 'default', isOdd = false }: MenuItemProps) {
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
      className={cn(
        'flex items-center gap-4 px-4 py-4 transition-all group',
        // 移动端斑马纹效果
        'lg:rounded-xl lg:bg-bg-tertiary/30 lg:hover:bg-bg-tertiary/50',
        isOdd ? 'bg-bg-secondary' : ''
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
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
  const { canInstall, isInstalled, isIOS, isSafari, install } = usePWA();
  const [copied, setCopied] = useState(false);

  // 生成短 ID（取 UUID 前 8 位，大写）
  const getShortId = (id: string) => {
    if (!id) return '';
    return id.split('-')[0].toUpperCase();
  };

  // 复制短 ID 到剪贴板
  const copyUserId = async () => {
    const userId = user?.id;
    if (!userId) return;
    const shortId = getShortId(userId);
    try {
      await navigator.clipboard.writeText(shortId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级方案
      const input = document.createElement('input');
      input.value = shortId;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
    <div className="space-y-4 lg:space-y-6">
      {/* 页面标题 - 仅桌面端显示 */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-text-primary">我的</h1>
        <p className="text-text-secondary mt-1">管理你的账户和偏好设置</p>
      </div>

      {/* 移动端用户信息区域 - 极简风格 */}
      <div className="lg:hidden">
        <div className="flex items-center gap-4 px-4 py-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
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
            {/* 用户短 ID - 点击复制 */}
            {user?.id && (
              <button
                onClick={copyUserId}
                className="flex items-center gap-1.5 mt-0.5 text-text-tertiary text-xs font-mono hover:text-text-secondary transition-colors active:scale-95"
              >
                <span>ID: {getShortId(user.id)}</span>
                {copied ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
            <p className="text-sm text-text-tertiary truncate mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* 桌面端用户信息卡片 */}
      <Card variant="glass" className="overflow-hidden hidden lg:block">
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
              {/* 用户短 ID - 桌面端 */}
              {user?.id && (
                <button
                  onClick={copyUserId}
                  className="flex items-center gap-1.5 mt-0.5 text-text-tertiary text-xs font-mono hover:text-text-secondary transition-colors"
                >
                  <span>ID: {getShortId(user.id)}</span>
                  {copied ? (
                    <Check className="w-3 h-3 text-success" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
              <p className="text-sm text-text-tertiary truncate mt-0.5">{user?.email}</p>
            </div>
            <Link href="/settings">
              <Button variant="outline" size="sm" className="flex-shrink-0">
                编辑资料
              </Button>
            </Link>
          </div>

        </CardContent>
      </Card>

      {/* 功能入口列表 - 移动端极简风格，桌面端保持卡片 */}
      <div className="lg:hidden">
        {/* 安装 APP - PWA 安装入口 */}
        <button
          onClick={() => canInstall && install()}
          disabled={isInstalled}
          className="w-full flex items-center gap-4 px-4 py-4 transition-all group text-left"
        >
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            isInstalled ? 'bg-success/10' : 'bg-brand-primary/10'
          )}>
            <Download className={cn('w-5 h-5', isInstalled ? 'text-success' : 'text-brand-primary')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">安装 APP</p>
            <p className="text-xs text-text-tertiary mt-0.5 truncate">
              {isInstalled ? '已安装到设备' : '添加到主屏幕，获得原生体验'}
            </p>
          </div>
          {isInstalled ? (
            <span className="flex items-center gap-1 text-xs text-success">
              <Check className="w-4 h-4" />
              已安装
            </span>
          ) : canInstall ? (
            <span className="px-2.5 py-1 text-xs font-medium bg-brand-primary text-white rounded-lg">
              安装
            </span>
          ) : isIOS && isSafari ? (
            <div className="flex items-center gap-1 text-xs text-text-tertiary">
              <Share className="w-3 h-3" />
              <span>→</span>
              <Plus className="w-3 h-3" />
            </div>
          ) : (
            <span className="text-xs text-text-tertiary">请用 Chrome</span>
          )}
        </button>

        <MenuItem
          href="/settings/checkin"
          icon={Gift}
          label="每日签到"
          description="签到领积分，连续签到更多奖励"
          variant="warning"
          isOdd={true}
        />
        <MenuItem
          href="/settings"
          icon={Settings}
          label="设置"
          description="账户、安全、通知"
          isOdd={false}
        />
        <MenuItem
          href="/announcements"
          icon={Megaphone}
          label="公告中心"
          description="查看最新公告"
          isOdd={true}
        />
        <MenuItem
          href="/help"
          icon={HelpCircle}
          label="帮助与反馈"
          isOdd={false}
        />
      </div>

      {/* 桌面端功能入口 */}
      <div className="hidden lg:block space-y-2">
        {/* 安装 APP - 桌面端 */}
        <button
          onClick={() => canInstall && install()}
          disabled={isInstalled}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-all group text-left"
        >
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            isInstalled ? 'bg-success/10' : 'bg-brand-primary/10 group-hover:bg-brand-primary/20'
          )}>
            <Download className={cn('w-5 h-5', isInstalled ? 'text-success' : 'text-text-secondary group-hover:text-brand-primary')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">安装 APP</p>
            <p className="text-xs text-text-tertiary mt-0.5 truncate">
              {isInstalled ? '已安装到设备' : '添加到桌面，获得原生体验'}
            </p>
          </div>
          {isInstalled ? (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="w-4 h-4" />
              已安装
            </span>
          ) : canInstall ? (
            <span className="px-3 py-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-secondary text-white rounded-lg transition-colors">
              安装
            </span>
          ) : isIOS && isSafari ? (
            <div className="text-right">
              <p className="text-xs text-text-tertiary mb-1">iOS 安装:</p>
              <div className="flex items-center gap-1 text-xs text-text-secondary">
                <Share className="w-3 h-3" />
                <span>→</span>
                <Plus className="w-3 h-3" />
              </div>
            </div>
          ) : (
            <span className="text-sm text-text-tertiary">请使用 Chrome/Safari</span>
          )}
        </button>
        <MenuItem
          href="/settings/checkin"
          icon={Gift}
          label="每日签到"
          description="签到领积分，连续签到更多奖励"
          variant="warning"
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

      {/* 代理商入口 */}
      {isAgent && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-tertiary uppercase px-4 lg:px-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-brand-primary" />
            特殊权限
          </p>
          <div className="lg:hidden">
            <MenuItem
              href="/agent"
              icon={Users}
              label="代理商中心"
              description="查看返佣、推广业绩"
              variant="success"
              isOdd={false}
            />
          </div>
          <div className="hidden lg:block space-y-2">
            <MenuItem
              href="/agent"
              icon={Users}
              label="代理商中心"
              description="查看返佣、推广业绩"
              variant="success"
            />
          </div>
        </div>
      )}

      {/* 退出登录 - 移动端样式 */}
      <div className="pt-4 px-4 lg:px-0">
        <Button
          variant="ghost"
          className="w-full justify-center text-danger hover:bg-danger/10 hover:text-danger lg:bg-bg-tertiary/30"
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
