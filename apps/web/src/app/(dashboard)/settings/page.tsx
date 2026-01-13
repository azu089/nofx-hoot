'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  Info,
  ChevronRight,
  Ban,
  Gift,
} from 'lucide-react';
import { MobileHeader } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * 设置主页 - 极简流畅风格
 * 移动端：斑马纹列表，无边框
 * 桌面端：保持卡片分组样式
 */
export default function SettingsPage() {
  const router = useRouter();

  // 设置项分组
  const settingsGroups = [
    {
      title: '每日福利',
      items: [
        {
          icon: Gift,
          label: '每日签到',
          desc: '签到得积分，抵扣 VIP 订阅费',
          path: '/settings/checkin',
        },
      ],
    },
    {
      title: '账户与安全',
      items: [
        {
          icon: User,
          label: '账户信息',
          desc: '邮箱、会员等级、注册时间',
          path: '/settings/account',
        },
        {
          icon: Shield,
          label: '安全设置',
          desc: '密码、两步验证、登录历史',
          path: '/settings/security',
        },
        {
          icon: Bell,
          label: '消息通知',
          desc: '交易通知、账户通知、系统公告',
          path: '/settings/notifications',
        },
      ],
    },
    {
      title: '交易设置',
      items: [
        {
          icon: Ban,
          label: '黑名单管理',
          desc: '交易对黑名单配置',
          path: '/settings/blacklist',
        },
      ],
    },
    {
      title: '应用偏好',
      items: [
        {
          icon: Palette,
          label: '外观设置',
          desc: '暗黑模式、浅色模式、跟随系统',
          path: '/settings/appearance',
        },
        {
          icon: Globe,
          label: '语言设置',
          desc: '简体中文、English、繁體中文、日本語',
          path: '/settings/language',
        },
        {
          icon: Info,
          label: '关于应用',
          desc: '版本信息、PWA 安装、缓存管理、隐私条款',
          path: '/settings/about',
        },
      ],
    },
  ];

  // 计算全局索引用于斑马纹
  let globalIndex = 0;

  return (
    <div className="min-h-screen bg-bg-primary lg:p-6 pb-24 lg:pb-6">
      {/* 移动端标题 */}
      <MobileHeader title="设置" subtitle="管理账户和偏好" />

      {/* 页面标题 - 仅桌面端显示 */}
      <div className="hidden lg:block mb-8">
        <h1 className="text-2xl font-bold text-text-primary">设置</h1>
        <p className="text-sm text-text-secondary mt-1">
          管理您的账户和偏好设置
        </p>
      </div>

      {/* 移动端极简列表 */}
      <div className="lg:hidden">
        {settingsGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* 分组标题 */}
            <div className="px-4 py-3">
              <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {group.title}
              </h2>
            </div>

            {/* 分组列表 */}
            <div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const currentIndex = globalIndex++;
                const isOdd = currentIndex % 2 === 1;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      'flex items-center gap-4 px-4 py-4 transition-colors',
                      isOdd ? 'bg-bg-secondary' : ''
                    )}
                  >
                    {/* 图标 */}
                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-brand-primary" />
                    </div>

                    {/* 文字信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {item.label}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5 truncate">
                        {item.desc}
                      </p>
                    </div>

                    {/* 右箭头 */}
                    <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 桌面端分组卡片列表 */}
      <div className="hidden lg:block space-y-6 max-w-2xl mx-auto">
        {settingsGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* 分组标题 */}
            <h2 className="text-xs text-text-tertiary uppercase tracking-wider mb-2 px-2">
              {group.title}
            </h2>

            {/* 分组卡片容器 */}
            <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden">
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon;
                const isLast = itemIndex === group.items.length - 1;

                return (
                  <button
                    key={itemIndex}
                    onClick={() => router.push(item.path)}
                    className={`w-full flex items-center gap-4 p-4 hover:bg-bg-tertiary/50 transition-colors ${
                      !isLast ? 'border-b border-border-primary' : ''
                    }`}
                  >
                    {/* 图标 */}
                    <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-brand-primary" />
                    </div>

                    {/* 文字信息 */}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-text-primary font-medium">
                        {item.label}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5 truncate">
                        {item.desc}
                      </p>
                    </div>

                    {/* 右箭头 */}
                    <ChevronRight className="w-5 h-5 text-text-tertiary flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
