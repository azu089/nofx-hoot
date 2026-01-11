'use client';

import { useRouter } from 'next/navigation';
import {
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  Info,
  ChevronRight,
  Ban,
} from 'lucide-react';

/**
 * 设置主页 - iOS 风格分组卡片列表
 * 将7个Tab改为纵向滚动的卡片列表,分为3组
 */
export default function SettingsPage() {
  const router = useRouter();

  // 设置项分组
  const settingsGroups = [
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

  return (
    <div className="min-h-screen bg-bg-primary p-4 lg:p-6 pb-24 lg:pb-6">
      {/* 页面标题 - 桌面端显示,移动端不显示 */}
      <div className="hidden lg:block mb-8">
        <h1 className="text-2xl font-bold text-text-primary">设置</h1>
        <p className="text-sm text-text-secondary mt-1">
          管理您的账户和偏好设置
        </p>
      </div>

      {/* iOS 风格分组卡片列表 */}
      <div className="space-y-6 max-w-2xl mx-auto">
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
