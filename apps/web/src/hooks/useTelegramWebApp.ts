'use client';

import { useEffect, useState } from 'react';

// Telegram WebApp 类型定义
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      is_bot?: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  showPopup: (
    params: {
      title?: string;
      message: string;
      buttons?: Array<{
        id?: string;
        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
        text?: string;
      }>;
    },
    callback?: (buttonId: string) => void
  ) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  setHeaderColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void;
  setBackgroundColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface UseTelegramWebAppResult {
  webApp: TelegramWebApp | null;
  user: TelegramWebApp['initDataUnsafe']['user'] | null;
  isInTelegram: boolean;
  isReady: boolean;
  colorScheme: 'light' | 'dark';
}

export function useTelegramWebApp(): UseTelegramWebAppResult {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 检查是否在 Telegram 环境中
    const tg = window.Telegram?.WebApp;

    if (tg) {
      // 初始化 WebApp
      tg.ready();

      // 展开应用（全屏）
      tg.expand();

      // 设置主题颜色
      tg.setHeaderColor('#0B0E11');
      tg.setBackgroundColor('#0B0E11');

      setWebApp(tg);
      setIsReady(true);
    }
  }, []);

  return {
    webApp,
    user: webApp?.initDataUnsafe?.user ?? null,
    isInTelegram: !!webApp,
    isReady,
    colorScheme: webApp?.colorScheme ?? 'dark',
  };
}

// 触觉反馈钩子
export function useHapticFeedback() {
  const { webApp } = useTelegramWebApp();

  return {
    impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
      webApp?.HapticFeedback?.impactOccurred(style);
    },
    notification: (type: 'error' | 'success' | 'warning') => {
      webApp?.HapticFeedback?.notificationOccurred(type);
    },
    selection: () => {
      webApp?.HapticFeedback?.selectionChanged();
    },
  };
}

// 主按钮钩子
export function useMainButton() {
  const { webApp } = useTelegramWebApp();

  return {
    show: (text: string, onClick: () => void) => {
      if (webApp?.MainButton) {
        webApp.MainButton.setText(text);
        webApp.MainButton.onClick(onClick);
        webApp.MainButton.show();
      }
    },
    hide: () => {
      webApp?.MainButton?.hide();
    },
    showProgress: () => {
      webApp?.MainButton?.showProgress();
    },
    hideProgress: () => {
      webApp?.MainButton?.hideProgress();
    },
  };
}

// 返回按钮钩子
export function useBackButton() {
  const { webApp } = useTelegramWebApp();

  return {
    show: (onClick: () => void) => {
      if (webApp?.BackButton) {
        webApp.BackButton.onClick(onClick);
        webApp.BackButton.show();
      }
    },
    hide: () => {
      webApp?.BackButton?.hide();
    },
  };
}
