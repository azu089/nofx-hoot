'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  User,
  Shield,
  Bell,
  HelpCircle,
  FileText,
  ChevronRight,
  LogOut,
  Crown,
  Settings,
  Key,
  Smartphone,
} from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';

interface ProfileData {
  id: string;
  email?: string | null;
  hasPassword: boolean;
  telegramId?: string | null;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  telegramPhotoUrl?: string | null;
  vipLevel: number;
  inviteCode?: string | null;
  role: string;
  status: string;
  wallet?: {
    usdtBalance: string;
    usdtFrozen: string;
    pointsBalance: string;
    tokenBalance: string;
  } | null;
  stats: {
    totalTrades: number;
    activeStrategies: number;
    totalPnl: string;
  };
  createdAt: string;
  lastLoginAt?: string | null;
}

export default function TelegramProfile() {
  const { user, haptic, webApp } = useTelegramContext();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await api.get('/telegram/profile');
        setData(response.data);
      } catch (error) {
        console.error('获取用户信息失败:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const getVipLabel = (level: number) => {
    switch (level) {
      case 0:
        return { label: '普通用户', color: 'text-text-tertiary' };
      case 1:
        return { label: 'VIP 1', color: 'text-brand-primary' };
      case 2:
        return { label: 'VIP 2', color: 'text-warning' };
      case 3:
        return { label: 'VIP 3', color: 'text-purple-500' };
      default:
        return { label: `VIP ${level}`, color: 'text-success' };
    }
  };

  const handleLogout = () => {
    haptic('notification_warning');
    // 清除 token
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    // 关闭 Mini App
    webApp?.close();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-48 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  const vipInfo = getVipLabel(data?.vipLevel || 0);

  return (
    <div className="space-y-4">
      {/* 用户信息卡片 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
            {data?.telegramPhotoUrl ? (
              <img src={data.telegramPhotoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.first_name?.[0] || data?.telegramFirstName?.[0] || 'U'
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-text-primary">
              {user?.first_name || data?.telegramFirstName || '用户'}
            </h2>
            {(user?.username || data?.telegramUsername) && (
              <p className="text-sm text-text-tertiary">
                @{user?.username || data?.telegramUsername}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <Crown size={14} className={vipInfo.color} />
              <span className={`text-sm ${vipInfo.color}`}>{vipInfo.label}</span>
            </div>
          </div>
          <Link
            href="/tg/profile/edit"
            className="p-2 bg-bg-tertiary rounded-lg"
            onClick={() => haptic('selection')}
          >
            <Settings size={20} className="text-text-tertiary" />
          </Link>
        </div>

        {data?.email && (
          <div className="mt-4 pt-4 border-t border-border-primary">
            <p className="text-xs text-text-tertiary mb-1">绑定邮箱</p>
            <p className="text-sm text-text-secondary">{data.email}</p>
          </div>
        )}

        {/* 统计数据 */}
        {data?.stats && (
          <div className="mt-4 pt-4 border-t border-border-primary grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-text-primary">{data.stats.totalTrades}</p>
              <p className="text-xs text-text-tertiary">总交易</p>
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary">{data.stats.activeStrategies}</p>
              <p className="text-xs text-text-tertiary">运行策略</p>
            </div>
            <div>
              <p className={`text-lg font-bold ${parseFloat(data.stats.totalPnl) >= 0 ? 'text-success' : 'text-danger'}`}>
                {parseFloat(data.stats.totalPnl) >= 0 ? '+' : ''}{parseFloat(data.stats.totalPnl).toFixed(2)}
              </p>
              <p className="text-xs text-text-tertiary">总盈亏</p>
            </div>
          </div>
        )}
      </div>

      {/* 安全设置 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl divide-y divide-border-primary">
        <Link
          href="/tg/profile/security"
          className="flex items-center justify-between p-4"
          onClick={() => haptic('selection')}
        >
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-success" />
            <span className="text-sm text-text-primary">安全设置</span>
          </div>
          <ChevronRight size={18} className="text-text-tertiary" />
        </Link>

        <Link
          href="/tg/profile/api-keys"
          className="flex items-center justify-between p-4"
          onClick={() => haptic('selection')}
        >
          <div className="flex items-center gap-3">
            <Key size={20} className="text-warning" />
            <span className="text-sm text-text-primary">API 密钥</span>
          </div>
          <ChevronRight size={18} className="text-text-tertiary" />
        </Link>

        <Link
          href="/tg/profile/devices"
          className="flex items-center justify-between p-4"
          onClick={() => haptic('selection')}
        >
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-brand-primary" />
            <span className="text-sm text-text-primary">登录设备</span>
          </div>
          <ChevronRight size={18} className="text-text-tertiary" />
        </Link>
      </div>

      {/* 其他设置 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl divide-y divide-border-primary">
        <Link
          href="/tg/profile/notifications"
          className="flex items-center justify-between p-4"
          onClick={() => haptic('selection')}
        >
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-purple-500" />
            <span className="text-sm text-text-primary">通知设置</span>
          </div>
          <ChevronRight size={18} className="text-text-tertiary" />
        </Link>

        <button
          className="w-full flex items-center justify-between p-4"
          onClick={() => {
            haptic('selection');
            // 打开帮助中心
          }}
        >
          <div className="flex items-center gap-3">
            <HelpCircle size={20} className="text-text-tertiary" />
            <span className="text-sm text-text-primary">帮助中心</span>
          </div>
          <ChevronRight size={18} className="text-text-tertiary" />
        </button>

        <button
          className="w-full flex items-center justify-between p-4"
          onClick={() => {
            haptic('selection');
            // 打开用户协议
          }}
        >
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-text-tertiary" />
            <span className="text-sm text-text-primary">用户协议</span>
          </div>
          <ChevronRight size={18} className="text-text-tertiary" />
        </button>
      </div>

      {/* VIP 升级入口 */}
      <div className="bg-gradient-to-r from-warning/20 to-orange-500/10 border border-warning/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <Crown size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">升级 VIP</p>
              <p className="text-xs text-text-tertiary">享受更多专属权益</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-warning" />
        </div>
      </div>

      {/* 版本信息 */}
      <div className="text-center py-4">
        <p className="text-xs text-text-tertiary">QuantFi v1.0.0</p>
        <p className="text-xs text-text-tertiary mt-1">Telegram Mini App</p>
      </div>

      {/* 退出登录 */}
      <button
        className="w-full flex items-center justify-center gap-2 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger"
        onClick={handleLogout}
      >
        <LogOut size={18} />
        <span className="font-medium">退出登录</span>
      </button>
    </div>
  );
}
