'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/stores/ui.store';
import { ChevronLeft, Moon, Sun, Monitor, Check } from 'lucide-react';
import { MobileHeader } from '@/components/ui';

/**
 * 外观设置页面 - 极简流畅风格
 * 主题模式切换：暗黑模式、浅色模式、跟随系统
 */
export default function AppearancePage() {
  const router = useRouter();
  const { themeMode, setThemeMode, applyTheme } = useUiStore();

  // 初始化时应用主题
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  const themeOptions = [
    {
      mode: 'dark' as const,
      label: '暗黑模式',
      desc: '使用暗色背景,适合夜间使用',
      icon: Moon,
    },
    {
      mode: 'light' as const,
      label: '浅色模式',
      desc: '使用浅色背景,适合日间使用',
      icon: Sun,
    },
    {
      mode: 'system' as const,
      label: '跟随系统',
      desc: '根据系统设置自动切换主题',
      icon: Monitor,
    },
  ];

  return (
    <div className="min-h-screen bg-bg-primary lg:p-6 pb-24 lg:pb-6">
      {/* 移动端标题 */}
      <MobileHeader title="外观设置" />

      {/* 顶部导航 - 仅桌面端显示 */}
      <div className="mb-6 hidden lg:block">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>设置</span>
        </button>
        <h1 className="text-2xl font-bold text-text-primary mt-4">外观设置</h1>
      </div>

      {/* 移动端极简列表 */}
      <div className="lg:hidden">
        {themeOptions.map((option, index) => {
          const Icon = option.icon;
          const isActive = themeMode === option.mode;

          return (
            <button
              key={option.mode}
              onClick={() => setThemeMode(option.mode)}
              className={`w-full px-4 py-4 flex items-center gap-4 transition-colors ${
                index % 2 === 1 ? 'bg-bg-secondary' : ''
              } ${isActive ? 'bg-brand-primary/5' : ''}`}
            >
              {/* 图标 */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isActive ? 'bg-brand-primary/20' : 'bg-brand-primary/10'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-brand-primary' : 'text-text-tertiary'
                  }`}
                />
              </div>

              {/* 文字信息 */}
              <div className="flex-1 text-left">
                <p
                  className={`text-sm font-medium ${
                    isActive ? 'text-brand-primary' : 'text-text-primary'
                  }`}
                >
                  {option.label}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {option.desc}
                </p>
              </div>

              {/* 选中标记 */}
              {isActive && (
                <Check className="w-5 h-5 text-brand-primary flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* 桌面端卡片 */}
      <div className="hidden lg:block max-w-2xl mx-auto">
        <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden divide-y divide-border-primary">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = themeMode === option.mode;

            return (
              <button
                key={option.mode}
                onClick={() => setThemeMode(option.mode)}
                className={`w-full p-4 flex items-center gap-4 hover:bg-bg-tertiary/50 transition-colors ${
                  isActive ? 'bg-brand-primary/5' : ''
                }`}
              >
                {/* 图标 */}
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-brand-primary/20' : 'bg-bg-tertiary'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? 'text-brand-primary' : 'text-text-tertiary'
                    }`}
                  />
                </div>

                {/* 文字信息 */}
                <div className="flex-1 text-left">
                  <p
                    className={`font-medium ${
                      isActive ? 'text-brand-primary' : 'text-text-primary'
                    }`}
                  >
                    {option.label}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {option.desc}
                  </p>
                </div>

                {/* 选中标记 */}
                {isActive && (
                  <Check className="w-5 h-5 text-brand-primary flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
