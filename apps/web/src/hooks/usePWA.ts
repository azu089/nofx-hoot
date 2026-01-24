'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { isRunningAsPWA } from '@/lib/registerSW';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface PWAState {
  // 是否可以安装（Android/Chrome）
  canInstall: boolean;
  // 是否已经安装为 PWA
  isInstalled: boolean;
  // 是否是 iOS 设备（需要手动引导）
  isIOS: boolean;
  // 是否是 Safari 浏览器
  isSafari: boolean;
  // 是否显示安装提示
  showPrompt: boolean;
  // 是否已经关闭过提示（本次会话）
  dismissed: boolean;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    canInstall: false,
    isInstalled: false,
    isIOS: false,
    isSafari: false,
    showPrompt: false,
    dismissed: false,
  });

  // 保存安装提示事件（在 hook 内部管理）
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 检测设备和浏览器
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isInstalled = isRunningAsPWA();

    // 检查是否已经关闭过提示（localStorage）
    const wasDismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true';

    setState(prev => ({
      ...prev,
      isIOS,
      isSafari,
      isInstalled,
      dismissed: wasDismissed,
    }));

    // 监听安装提示事件（Android/Chrome）
    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      // 阻止默认行为
      e.preventDefault();
      // 保存事件以便稍后使用
      deferredPromptRef.current = e;
      console.log('[PWA] Install prompt available (hook)');
      setState(prev => ({
        ...prev,
        canInstall: true,
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall as EventListener);

    // 监听 PWA 安装完成
    const handleAppInstalled = () => {
      console.log('[PWA] App installed');
      deferredPromptRef.current = null;
      setState(prev => ({
        ...prev,
        isInstalled: true,
        canInstall: false,
        showPrompt: false,
      }));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 5 秒后显示安装提示（如果满足条件）
    const timer = setTimeout(() => {
      setState(prev => {
        // 不显示提示的条件
        if (prev.isInstalled) return prev;
        if (prev.dismissed) return prev;

        // iOS Safari 或 可安装时显示提示
        const shouldShow = (prev.isIOS && prev.isSafari) || prev.canInstall;
        return { ...prev, showPrompt: shouldShow };
      });
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  // 触发安装
  const install = useCallback(async () => {
    const deferredPrompt = deferredPromptRef.current;

    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      // 显示安装提示
      await deferredPrompt.prompt();

      // 等待用户响应
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Install prompt outcome:', outcome);

      // 清除保存的事件
      deferredPromptRef.current = null;

      if (outcome === 'accepted') {
        setState(prev => ({
          ...prev,
          isInstalled: true,
          canInstall: false,
          showPrompt: false,
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('[PWA] Install error:', error);
      return false;
    }
  }, []);

  // 关闭提示
  const dismiss = useCallback(() => {
    setState(prev => ({
      ...prev,
      showPrompt: false,
      dismissed: true,
    }));
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  }, []);

  // 重置提示（下次会话显示）
  const resetPrompt = useCallback(() => {
    localStorage.removeItem('pwa-prompt-dismissed');
    setState(prev => ({
      ...prev,
      dismissed: false,
    }));
  }, []);

  return {
    ...state,
    install,
    dismiss,
    resetPrompt,
  };
}
