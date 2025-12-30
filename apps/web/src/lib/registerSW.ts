'use client';

// 注册 Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  // 检查浏览器是否支持 Service Worker
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    console.log('[PWA] Service Worker registered:', registration.scope);

    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本可用，提示用户刷新
            console.log('[PWA] New version available');
            showUpdateNotification();
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

// 请求通知权限
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('[PWA] Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('[PWA] Notification permission:', permission);
  return permission;
}

// 订阅推送通知
export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    console.log('[PWA] Push subscription:', subscription.endpoint);
    return subscription;
  } catch (error) {
    console.error('[PWA] Push subscription failed:', error);
    return null;
  }
}

// 显示更新通知
function showUpdateNotification() {
  // 可以用 toast 或自定义 UI 提示用户
  if (confirm('QuantFi 有新版本可用，是否立即刷新？')) {
    window.location.reload();
  }
}

// 工具函数：Base64 转 Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// 检查是否可以安装为 PWA
export function isPWAInstallable(): boolean {
  return 'BeforeInstallPromptEvent' in window;
}

// 保存安装提示事件
let deferredPrompt: Event | null = null;

export function setupInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 阻止默认提示
    e.preventDefault();
    // 保存事件以便稍后使用
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');
  });
}

// 触发安装提示
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available');
    return false;
  }

  // 显示安装提示
  (deferredPrompt as BeforeInstallPromptEvent).prompt();

  // 等待用户响应
  const { outcome } = await (deferredPrompt as BeforeInstallPromptEvent).userChoice;
  console.log('[PWA] Install prompt outcome:', outcome);

  // 清除保存的事件
  deferredPrompt = null;

  return outcome === 'accepted';
}

// 检查是否已安装为 PWA
export function isRunningAsPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// BeforeInstallPromptEvent 类型声明
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
