'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { NextIntlClientProvider, IntlErrorCode } from 'next-intl';
import { locales, defaultLocale, localeNames, type Locale } from './config';
import { api } from '../lib/api';

// 静态导入所有语言文件，消除动态 import 导致的异步黑屏
import zhCN from './messages/zh-CN.json';
import en from './messages/en.json';
import zhTW from './messages/zh-TW.json';
import ja from './messages/ja.json';
import ko from './messages/ko.json';
import ru from './messages/ru.json';
import vi from './messages/vi.json';
import id from './messages/id.json';
import th from './messages/th.json';
import tr from './messages/tr.json';
import ar from './messages/ar.json';

const allMessages: Record<Locale, Record<string, unknown>> = {
  'zh-CN': zhCN,
  'en': en,
  'zh-TW': zhTW,
  'ja': ja,
  'ko': ko,
  'ru': ru,
  'vi': vi,
  'id': id,
  'th': th,
  'tr': tr,
  'ar': ar,
};

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: readonly Locale[];
  localeNames: typeof localeNames;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

// Cookie 操作
function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // 初始化时从 cookie 或 props 获取
    if (typeof window !== 'undefined') {
      const cookieLocale = getCookie('NEXT_LOCALE') as Locale | null;
      if (cookieLocale && locales.includes(cookieLocale)) {
        return cookieLocale;
      }
    }
    return initialLocale || defaultLocale;
  });

  // 同步从静态 map 获取，无需异步等待
  const messages = allMessages[locale] || allMessages[defaultLocale];

  // 同步 locale 到 API 客户端
  useEffect(() => {
    api.setLocale(locale);
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (!locales.includes(newLocale)) return;

    // 先保存到 cookie
    setCookie('NEXT_LOCALE', newLocale);

    // 刷新页面以应用新语言
    window.location.reload();
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, locales, localeNames }}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={(error) => {
          // 仅在开发模式下用 warn 代替 error（避免控制台红色刷屏）
          if (process.env.NODE_ENV === 'development') {
            console.warn('[i18n]', error.message);
          }
        }}
        getMessageFallback={({ namespace, key, error }) => {
          // MISSING_MESSAGE: 返回 key 名作为兜底文本
          if (error.code === IntlErrorCode.MISSING_MESSAGE) {
            return key;
          }
          return `${namespace}.${key}`;
        }}
      >
        {children as React.ReactNode}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

// Re-export next-intl hooks for convenience
export { useTranslations, useFormatter, useNow, useTimeZone } from 'next-intl';
