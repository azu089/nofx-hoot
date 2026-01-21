'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import {
  User,
  Shield,
  Info,
  ChevronRight,
  Power,
  LogOut,
  Bell,
  Copy,
  Check,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export default function TgSettingsPage() {
  const router = useRouter();
  const { haptic, user: tgUser } = useTelegramContext();
  const { user, logout } = useAuthStore();
  const [copied, setCopied] = useState(false);

  // 生成短 ID（取 UUID 前 8 位，大写）
  const getShortId = (id: string) => {
    if (!id) return '';
    return id.split('-')[0].toUpperCase();
  };

  // 复制短 ID 到剪贴板
  const copyUserId = async () => {
    const userId = (user as any)?.id;
    if (!userId) return;
    const shortId = getShortId(userId);
    try {
      await navigator.clipboard.writeText(shortId);
      setCopied(true);
      haptic('notification_success');
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
      haptic('notification_success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const settingsGroups = [
    {
      title: '账户与安全',
      items: [
        {
          icon: User,
          label: '账户信息',
          desc: '邮箱、会员等级',
          path: '/tg/settings/account',
          color: 'text-brand-primary',
        },
        {
          icon: Bell,
          label: '通知设置',
          desc: '推送通知偏好',
          path: '/tg/settings/notifications',
          color: 'text-purple-400',
        },
        {
          icon: Shield,
          label: '安全设置',
          desc: '密码、两步验证',
          path: '/tg/settings/security',
          color: 'text-success',
        },
      ],
    },
    {
      title: '紧急控制',
      items: [
        {
          icon: Power,
          label: '紧急按钮',
          desc: '一键停止所有策略',
          path: '/tg/settings/panic',
          color: 'text-danger',
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          icon: Info,
          label: '关于应用',
          desc: '版本信息',
          path: '/tg/settings/about',
          color: 'text-text-secondary',
        },
      ],
    },
  ];

  const handleLogout = () => {
    haptic('impact_medium');
    if (confirm('确定要退出登录吗？')) {
      logout();
      router.push('/tg');
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 用户信息 */}
      <div className="bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 border border-brand-primary/30 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-brand-primary flex items-center justify-center text-white text-xl font-bold">
            {tgUser?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold">
              {tgUser?.first_name || user?.email?.split('@')[0] || '用户'}
            </h2>
            {/* 用户 ID - 短 ID 格式，支持复制 */}
            {(user as any)?.id && (
              <button
                onClick={copyUserId}
                className="flex items-center gap-1.5 mt-0.5 text-text-secondary text-xs font-mono hover:text-text-primary transition-colors active:scale-95"
              >
                <span>ID: {getShortId((user as any).id)}</span>
                {copied ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded">
                {(user as any)?.memberLevel || 'VIP 0'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 设置分组 */}
      {settingsGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="space-y-1">
          <h3 className="text-text-tertiary text-xs px-1 mb-2">{group.title}</h3>
          <div className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden">
            {group.items.map((item, itemIdx) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => haptic('selection')}
                  className={`flex items-center justify-between p-4 ${
                    itemIdx !== group.items.length - 1 ? 'border-b border-border-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{item.label}</p>
                      <p className="text-text-tertiary text-xs">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-tertiary" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* 退出登录 */}
      <button
        onClick={handleLogout}
        className="w-full py-4 bg-bg-secondary border border-border-primary rounded-xl flex items-center justify-center gap-2 text-danger"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-medium">退出登录</span>
      </button>
    </div>
  );
}
