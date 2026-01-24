'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  isTelegramWebApp,
  getTelegramUser,
  getInitData,
  getColorScheme,
  getThemeParams,
  ready,
  expandMiniApp,
  hapticFeedback,
  showAlert,
  showConfirm,
  setMainButton,
  hideMainButton,
  setBackButton,
  hideBackButton,
  shareToTelegram,
  closeMiniApp,
} from '@/lib/telegram';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

interface UseTelegramReturn {
  // 状态
  isTelegram: boolean;
  isReady: boolean;
  user: TelegramUser | null;
  initData: string | null;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams | null;

  // 方法
  haptic: typeof hapticFeedback;
  alert: typeof showAlert;
  confirm: typeof showConfirm;
  share: typeof shareToTelegram;
  close: typeof closeMiniApp;

  // 按钮
  showMainButton: (text: string, onClick: () => void) => void;
  hideMainButton: typeof hideMainButton;
  showBackButton: (onClick: () => void) => void;
  hideBackButton: typeof hideBackButton;
}

export function useTelegram(): UseTelegramReturn {
  const [isTelegram, setIsTelegram] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
  const [themeParams, setThemeParams] = useState<ThemeParams | null>(null);

  // 动态加载 Telegram SDK
  useEffect(() => {
    console.log('[useTelegram] useEffect triggered');

    // 检查是否已加载 SDK
    if ((window as any).Telegram?.WebApp) {
      console.log('[useTelegram] SDK already loaded');
      initTelegram();
      return;
    }

    console.log('[useTelegram] Loading Telegram SDK...');
    // 动态加载 Telegram WebApp SDK
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = false; // 同步加载以确保顺序
    script.onload = () => {
      console.log('[useTelegram] SDK loaded successfully');
      // SDK 加载完成后初始化
      initTelegram();
    };
    script.onerror = () => {
      console.error('[useTelegram] Failed to load Telegram WebApp SDK');
      setIsReady(true); // 标记为就绪（非 Telegram 环境）
    };
    document.head.appendChild(script);

    function initTelegram() {
      const webApp = (window as any).Telegram?.WebApp;
      console.log('[useTelegram] initTelegram called', {
        hasWebApp: !!webApp,
        initData: webApp?.initData?.substring(0, 50) + '...',
        initDataUnsafe: webApp?.initDataUnsafe,
      });

      const inTelegram = isTelegramWebApp();
      setIsTelegram(inTelegram);
      console.log('[useTelegram] isTelegram:', inTelegram);

      if (inTelegram) {
        const userData = getTelegramUser();
        const initDataStr = getInitData();
        console.log('[useTelegram] User data:', userData);
        console.log('[useTelegram] initData length:', initDataStr?.length);

        // 获取用户和数据
        setUser(userData);
        setInitData(initDataStr);
        setColorScheme(getColorScheme());
        setThemeParams(getThemeParams());

        // 展开并通知就绪
        expandMiniApp();
        ready();
      }
      setIsReady(true);
      console.log('[useTelegram] Ready!');
    }

    return () => {
      // 清理：不移除 script，因为可能被其他组件使用
    };
  }, []);

  // 显示主按钮
  const showMainButtonWrapper = useCallback((text: string, onClick: () => void) => {
    return setMainButton({ text, onClick });
  }, []);

  // 显示返回按钮
  const showBackButtonWrapper = useCallback((onClick: () => void) => {
    return setBackButton(onClick);
  }, []);

  return {
    isTelegram,
    isReady,
    user,
    initData,
    colorScheme,
    themeParams,
    haptic: hapticFeedback,
    alert: showAlert,
    confirm: showConfirm,
    share: shareToTelegram,
    close: closeMiniApp,
    showMainButton: showMainButtonWrapper,
    hideMainButton,
    showBackButton: showBackButtonWrapper,
    hideBackButton,
  };
}
