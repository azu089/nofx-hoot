'use client';

import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { useAuthStore } from '@/stores/auth.store';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Crown,
  Shield,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { useState } from 'react';

export default function TgAccountPage() {
  const router = useRouter();
  const { haptic, user: tgUser } = useTelegramContext();
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      haptic('notification_success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const memberLevelInfo = {
    VIP0: { label: 'VIP 0', color: 'text-text-secondary', desc: '基础会员' },
    VIP1: { label: 'VIP 1', color: 'text-success', desc: '白银会员' },
    VIP2: { label: 'VIP 2', color: 'text-warning', desc: '黄金会员' },
    VIP3: { label: 'VIP 3', color: 'text-brand-primary', desc: '铂金会员' },
  };

  const level = memberLevelInfo[(user as any)?.memberLevel as keyof typeof memberLevelInfo] || memberLevelInfo.VIP0;

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <button
        onClick={() => { haptic('selection'); router.back(); }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">账户信息</span>
      </button>

      {/* 头像区域 */}
      <div className="flex flex-col items-center py-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white text-3xl font-bold mb-3">
          {tgUser?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <h2 className="text-white font-bold text-lg">
          {tgUser?.first_name || user?.email?.split('@')[0] || '用户'}
        </h2>
        <div className={`flex items-center gap-1 mt-1 ${level.color}`}>
          <Crown className="w-4 h-4" />
          <span className="text-sm font-medium">{level.label}</span>
        </div>
      </div>

      {/* 账户信息 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl divide-y divide-border-primary">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-brand-primary" />
            <span className="text-text-secondary text-sm">邮箱</span>
          </div>
          <span className="text-white text-sm">{user?.email || '-'}</span>
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-success" />
            <span className="text-text-secondary text-sm">用户ID</span>
          </div>
          <button
            onClick={copyUserId}
            className="flex items-center gap-2 text-white text-sm"
          >
            <span className="font-mono">{user?.id?.slice(0, 8) || '-'}...</span>
            {copied ? (
              <CheckCircle className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-text-tertiary" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Crown className="w-4 h-4 text-warning" />
            <span className="text-text-secondary text-sm">会员等级</span>
          </div>
          <span className={`text-sm font-medium ${level.color}`}>{level.desc}</span>
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-brand-primary" />
            <span className="text-text-secondary text-sm">注册时间</span>
          </div>
          <span className="text-white text-sm">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-text-secondary text-sm">账户状态</span>
          </div>
          <span className="text-success text-sm">正常</span>
        </div>
      </div>

      {/* Telegram 信息 */}
      {tgUser && (
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <h3 className="text-white font-medium text-sm mb-3">Telegram 账户</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-tertiary">用户名</span>
              <span className="text-white">@{tgUser.username || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">名称</span>
              <span className="text-white">
                {tgUser.first_name} {tgUser.last_name || ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">TG ID</span>
              <span className="text-white font-mono">{tgUser.id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
