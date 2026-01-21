'use client';

import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { useUiStore } from '@/stores/ui.store';
import { Check, ChevronLeft } from 'lucide-react';

type Language = 'zh' | 'en';

const languages = [
  { code: 'zh' as Language, label: '简体中文', native: '中文', flag: '🇨🇳' },
  { code: 'en' as Language, label: 'English', native: 'English', flag: '🇬🇧' },
];

export default function TgLanguagePage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const { language, setLanguage } = useUiStore();

  const handleSelectLanguage = (lang: Language) => {
    if (lang === language) return;

    haptic('selection');
    setLanguage(lang);
    haptic('notification_success');
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 返回按钮 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors mb-2"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm">{language === 'zh' ? '返回' : 'Back'}</span>
      </button>

      {/* 标题 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          {language === 'zh' ? '语言设置' : 'Language Settings'}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          {language === 'zh' ? 'Language Settings' : '语言设置'}
        </p>
      </div>

      {/* 语言列表 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden">
        {languages.map((lang, index) => (
          <button
            key={lang.code}
            onClick={() => handleSelectLanguage(lang.code)}
            className={`w-full flex items-center justify-between p-4 transition-colors ${
              index !== languages.length - 1 ? 'border-b border-border-primary' : ''
            } active:bg-bg-tertiary`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{lang.flag}</span>
              <div className="text-left">
                <p className="text-white font-medium">{lang.label}</p>
                <p className="text-text-tertiary text-xs">{lang.native}</p>
              </div>
            </div>
            {language === lang.code && (
              <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 提示 */}
      <p className="text-text-tertiary text-xs text-center px-4">
        {language === 'zh'
          ? '切换语言后，界面文字将相应改变'
          : 'Interface text will change after switching language'}
        <br />
        {language === 'zh'
          ? 'Language change will affect interface text'
          : '语言更改将影响界面文字'}
      </p>
    </div>
  );
}
