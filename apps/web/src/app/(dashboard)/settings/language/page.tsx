'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check } from 'lucide-react';
import { MobileHeader } from '@/components/ui';

/**
 * 语言设置页面 - 极简流畅风格
 * 支持：简体中文、English、繁體中文、日本語
 */
export default function LanguagePage() {
  const router = useRouter();
  const [currentLanguage, setCurrentLanguage] = useState('zh-CN');

  const languages = [
    { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'zh-TW', name: '繁體中文', nativeName: '繁體中文' },
    { code: 'ja', name: '日本語', nativeName: '日本語' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary lg:p-6 pb-24 lg:pb-6">
      {/* 移动端标题 */}
      <MobileHeader title="语言设置" />

      {/* 顶部导航 - 仅桌面端显示 */}
      <div className="mb-6 hidden lg:block">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>设置</span>
        </button>
        <h1 className="text-2xl font-bold text-text-primary mt-4">语言设置</h1>
      </div>

      {/* 移动端极简列表 */}
      <div className="lg:hidden">
        {languages.map((lang, index) => {
          const isActive = currentLanguage === lang.code;

          return (
            <button
              key={lang.code}
              onClick={() => setCurrentLanguage(lang.code)}
              className={`w-full px-4 py-4 flex items-center justify-between transition-colors ${
                index % 2 === 1 ? 'bg-bg-secondary' : ''
              } ${isActive ? 'bg-brand-primary/5' : ''}`}
            >
              {/* 语言名称 */}
              <div className="text-left">
                <p
                  className={`text-sm font-medium ${
                    isActive ? 'text-brand-primary' : 'text-text-primary'
                  }`}
                >
                  {lang.nativeName}
                </p>
                {lang.name !== lang.nativeName && (
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {lang.name}
                  </p>
                )}
              </div>

              {/* 选中标记 */}
              {isActive && (
                <Check className="w-5 h-5 text-brand-primary flex-shrink-0" />
              )}
            </button>
          );
        })}

        {/* 提示信息 */}
        <p className="text-center text-xs text-text-tertiary mt-4 px-4">
          语言设置将在刷新页面后生效
        </p>
      </div>

      {/* 桌面端卡片 */}
      <div className="hidden lg:block max-w-2xl mx-auto">
        <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden divide-y divide-border-primary">
          {languages.map((lang) => {
            const isActive = currentLanguage === lang.code;

            return (
              <button
                key={lang.code}
                onClick={() => setCurrentLanguage(lang.code)}
                className={`w-full p-4 flex items-center justify-between hover:bg-bg-tertiary/50 transition-colors ${
                  isActive ? 'bg-brand-primary/5' : ''
                }`}
              >
                {/* 语言名称 */}
                <div className="text-left">
                  <p
                    className={`font-medium ${
                      isActive ? 'text-brand-primary' : 'text-text-primary'
                    }`}
                  >
                    {lang.nativeName}
                  </p>
                  {lang.name !== lang.nativeName && (
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {lang.name}
                    </p>
                  )}
                </div>

                {/* 选中标记 */}
                {isActive && (
                  <Check className="w-5 h-5 text-brand-primary flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* 提示信息 */}
        <p className="text-center text-xs text-text-tertiary mt-4">
          语言设置将在刷新页面后生效
        </p>
      </div>
    </div>
  );
}
