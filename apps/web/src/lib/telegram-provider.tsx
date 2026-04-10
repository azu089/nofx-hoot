'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './auth';
import {
  isTelegramWebApp,
  getTelegramWebApp,
  initTelegramWebApp,
} from './telegram';

interface TelegramContextType {
  /** 是否在 TG Mini App 环境中 */
  isTelegram: boolean;
  /** TG WebApp 初始化是否完成（= AuthProvider 加载完成） */
  isReady: boolean;
  /** 登录错误信息（来自 AuthProvider） */
  error: string | null;
}

const TelegramContext = createContext<TelegramContextType>({
  isTelegram: false,
  isReady: false,
  error: null,
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isTelegram, setIsTelegram] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 使用 AuthProvider 的状态（TG 自动登录由 AuthProvider 统一处理）
  const { isLoading: authLoading, tgAutoLoginError } = useAuth();

  // TG 环境检测 + UI 初始化（仅首次挂载执行一次）
  useEffect(() => {
    if (!isTelegramWebApp()) return;
    setIsTelegram(true);
    initTelegramWebApp(); // expand + 主题色 + ready()
  }, []);

  // TG BackButton 路由返回
  useEffect(() => {
    if (!isTelegram) return;

    const tg = getTelegramWebApp();
    if (!tg) return;

    const handleBack = () => {
      router.back();
    };

    const isHomePage = pathname === '/profile' || pathname === '/';
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

  // isReady = AuthProvider 加载完成
  const isReady = !authLoading;

  return (
    <TelegramContext.Provider value={{ isTelegram, isReady, error: tgAutoLoginError }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
