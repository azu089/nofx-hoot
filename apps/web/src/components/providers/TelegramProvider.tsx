'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import { api } from '@/lib/api';
import { type HapticType, getTelegramWebApp } from '@/lib/telegram';

// 开发模式：允许浏览器直接访问
const DEV_MODE = process.env.NODE_ENV === 'development';

interface TelegramContextType {
  isTelegram: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  } | null;
  userId: string | null;
  haptic: (type: HapticType) => void;
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  share: (url: string, text?: string) => void;
  close: () => void;
  webApp: ReturnType<typeof getTelegramWebApp>;
}

const TelegramContext = createContext<TelegramContextType | null>(null);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const telegram = useTelegram();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // 自动认证
  useEffect(() => {
    async function authenticate() {
      console.log('[TelegramProvider] authenticate called', {
        DEV_MODE,
        isTelegram: telegram.isTelegram,
        isReady: telegram.isReady,
        hasInitData: !!telegram.initData,
        initDataLength: telegram.initData?.length,
      });

      // 开发模式：直接认证通过，方便浏览器测试 TG 页面
      if (DEV_MODE && !telegram.isTelegram) {
        // 开发模式下无需 token 也能访问 TG 页面
        console.log('[TelegramProvider] DEV_MODE: skipping auth');
        setIsAuthenticated(true);
        setUserId('dev-test-user');
        setIsLoading(false);
        return;
      }

      if (!telegram.isTelegram || !telegram.initData) {
        console.log('[TelegramProvider] Not in Telegram or no initData, skipping auth');
        setIsLoading(false);
        return;
      }

      try {
        console.log('[TelegramProvider] Calling /telegram/auth...');
        // 调用后端认证接口
        const response = await api.post('/telegram/auth', {
          initData: telegram.initData,
        });
        console.log('[TelegramProvider] Auth response:', response);

        if (response.data?.accessToken) {
          // 保存 token
          localStorage.setItem('token', response.data.accessToken);
          localStorage.setItem('refreshToken', response.data.refreshToken);
          setUserId(response.data.userId);
          setIsAuthenticated(true);
          console.log('[TelegramProvider] Auth success, userId:', response.data.userId);
        }
      } catch (error) {
        console.error('[TelegramProvider] Telegram 认证失败:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (telegram.isReady || DEV_MODE) {
      authenticate();
    }
  }, [telegram.isReady, telegram.isTelegram, telegram.initData]);

  const value: TelegramContextType = {
    // 开发模式下也返回 true，以便测试
    isTelegram: telegram.isTelegram || DEV_MODE,
    isReady: telegram.isReady || DEV_MODE,
    isAuthenticated,
    isLoading,
    user: telegram.user || (DEV_MODE ? { id: 0, first_name: '开发测试' } : null),
    userId,
    haptic: telegram.haptic,
    alert: telegram.alert,
    confirm: telegram.confirm,
    share: telegram.share,
    close: telegram.close,
    webApp: getTelegramWebApp(),
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegramContext() {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegramContext must be used within TelegramProvider');
  }
  return context;
}
