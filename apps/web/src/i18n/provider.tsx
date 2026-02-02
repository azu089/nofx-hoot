'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { locales, defaultLocale, localeNames, type Locale } from './config';
import { api } from '../lib/api';

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

  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);

  // 加载对应语言的翻译文件
  useEffect(() => {
    import(`./messages/${locale}.json`)
      .then((m) => setMessages(m.default))
      .catch(() => {
        import('./messages/zh-CN.json').then((m) => setMessages(m.default));
      });
  }, [locale]);

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

  if (!messages) {
    return null; // 或者返回 loading 状态
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, locales, localeNames }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
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
