'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from './api';
import {
  isTelegramWebApp,
  getTelegramInitData,
  getTelegramWebApp,
  getTelegramStartParam,
  initTelegramWebApp,
} from './telegram';

interface TelegramContextType {
  /** 是否在 TG Mini App 环境中 */
  isTelegram: boolean;
  /** TG WebApp 登录是否完成 */
  isReady: boolean;
  /** 登录错误信息 */
  error: string | null;
}

const TelegramContext = createContext<TelegramContextType>({
  isTelegram: false,
  isReady: false,
  error: null,
});

const TOKEN_KEY = 'hoot_token';
const USER_KEY = 'hoot_user';

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isTelegram, setIsTelegram] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 检测 TG 环境
    if (!isTelegramWebApp()) {
      setIsReady(true); // 非 TG 环境直接就绪
      return;
    }

    setIsTelegram(true);

    // 初始化 TG WebApp UI（展开 + 颜色 + ready）
    initTelegramWebApp();

    // 如果已经有 token（之前登录过），直接就绪
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (existingToken) {
      api.setToken(existingToken);
      setIsReady(true);
      return;
    }

    // 用 initData 自动登录
    const initData = getTelegramInitData();
    if (!initData) {
      setError('无法获取 Telegram 认证数据');
      setIsReady(true);
      return;
    }

    (async () => {
      try {
        const response = await api.post<{
          accessToken: string;
          user: {
            id: string;
            email?: string | null;
            nickname?: string | null;
            telegramId?: string | null;
          };
          isNewUser?: boolean;
        }>('/auth/telegram/webapp-login', { initData });

        const { accessToken, user } = response.data;

        // 存储认证信息（与 AuthProvider 共享）
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        api.setToken(accessToken);

        setIsReady(true);

        // 如果当前在登录/注册页，跳转到 dashboard
        if (pathname === '/login' || pathname === '/register' || pathname === '/') {
          router.replace('/dashboard');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '自动登录失败';
        setError(message);
        setIsReady(true);
      }
    })();
  }, [pathname, router]);

  // TG BackButton 路由返回
  useEffect(() => {
    if (!isTelegram) return;

    const tg = getTelegramWebApp();
    if (!tg) return;

    const handleBack = () => {
      router.back();
    };

    // 在非首页显示返回按钮
    const isHomePage = pathname === '/dashboard' || pathname === '/';
    if (isHomePage) {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
      tg.BackButton.onClick(handleBack);
    }

    return () => {
      tg.BackButton.offClick(handleBack);
    };
  }, [isTelegram, pathname, router]);

  return (
    <TelegramContext.Provider value={{ isTelegram, isReady, error }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
