'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import {
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  Info,
  ChevronRight,
  Gift,
  Power,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export default function TgSettingsPage() {
  const router = useRouter();
  const { haptic, user: tgUser } = useTelegramContext();
  const { user, logout } = useAuthStore();

  const settingsGroups = [
    {
      title: '每日福利',
      items: [
        {
          icon: Gift,
          label: '每日签到',
          desc: '签到得积分',
          path: '/tg/settings/checkin',
          color: 'text-warning',
        },
      ],
    },
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
          icon: Shield,
          label: '安全设置',
          desc: '密码、两步验证',
          path: '/tg/settings/security',
          color: 'text-success',
        },
        {
          icon: Bell,
          label: '消息通知',
          desc: '交易、账户通知',
          path: '/tg/settings/notifications',
          color: 'text-brand-primary',
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
      title: '应用偏好',
      items: [
        {
          icon: Palette,
          label: '外观设置',
          desc: '主题切换',
          path: '/tg/settings/appearance',
          color: 'text-brand-primary',
        },
        {
          icon: Globe,
          label: '语言设置',
          desc: '简体中文',
          path: '/tg/settings/language',
          color: 'text-success',
        },
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
            <p className="text-text-tertiary text-sm">
              {user?.email || 'Telegram 用户'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded">
                {user?.memberLevel || 'VIP 0'}
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
