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

  // 初始化
  useEffect(() => {
    const inTelegram = isTelegramWebApp();
    setIsTelegram(inTelegram);

    if (inTelegram) {
      // 获取用户和数据
      setUser(getTelegramUser());
      setInitData(getInitData());
      setColorScheme(getColorScheme());
      setThemeParams(getThemeParams());

      // 展开并通知就绪
      expandMiniApp();
      ready();
      setIsReady(true);
    }
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
