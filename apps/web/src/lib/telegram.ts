/**
 * Telegram Mini App 工具库
 * 封装 Telegram WebApp SDK 的常用功能
 */

// 检查是否在 Telegram 环境中
// 注意：仅检查 WebApp 对象存在不够，还需要检查 initData 是否有值
// 因为在非 Telegram 环境加载 SDK 后 WebApp 对象也会存在，但 initData 为空
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const webApp = (window as any).Telegram?.WebApp;
  // 真正的 Telegram 环境中 initData 应该有值
  return !!(webApp && webApp.initData);
}

// 获取 Telegram WebApp 实例
export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp;
}

// 获取 initData 字符串
export function getInitData(): string | null {
  const webApp = getTelegramWebApp();
  return webApp?.initData || null;
}

// 获取 initDataUnsafe（解析后的数据，仅用于 UI 展示）
export function getInitDataUnsafe() {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe || null;
}

// 获取当前用户信息
export function getTelegramUser() {
  const data = getInitDataUnsafe();
  return data?.user || null;
}

// 获取主题参数
export function getThemeParams() {
  const webApp = getTelegramWebApp();
  return webApp?.themeParams || null;
}

// 获取颜色模式
export function getColorScheme(): 'light' | 'dark' {
  const webApp = getTelegramWebApp();
  return webApp?.colorScheme || 'dark';
}

// 关闭 Mini App
export function closeMiniApp(): void {
  const webApp = getTelegramWebApp();
  webApp?.close();
}

// 展开 Mini App
export function expandMiniApp(): void {
  const webApp = getTelegramWebApp();
  webApp?.expand();
}

// 显示确认弹窗
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const webApp = getTelegramWebApp();
    if (webApp?.showConfirm) {
      webApp.showConfirm(message, (confirmed: boolean) => {
        resolve(confirmed);
      });
    } else {
      resolve(window.confirm(message));
    }
  });
}

// 显示提示弹窗
export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const webApp = getTelegramWebApp();
    if (webApp?.showAlert) {
      webApp.showAlert(message, () => {
        resolve();
      });
    } else {
      window.alert(message);
      resolve();
    }
  });
}

// 触觉反馈类型
export type HapticType =
  | 'impact'
  | 'notification'
  | 'selection'
  | 'impact_light'
  | 'impact_medium'
  | 'impact_heavy'
  | 'notification_success'
  | 'notification_warning'
  | 'notification_error';

// 触觉反馈
export function hapticFeedback(type: HapticType): void {
  const webApp = getTelegramWebApp();
  const haptic = webApp?.HapticFeedback;
  if (!haptic) return;

  // 解析复合类型
  if (type.startsWith('impact_')) {
    const style = type.replace('impact_', '');
    haptic.impactOccurred(style);
  } else if (type.startsWith('notification_')) {
    const style = type.replace('notification_', '');
    haptic.notificationOccurred(style);
  } else {
    switch (type) {
      case 'impact':
        haptic.impactOccurred('medium');
        break;
      case 'notification':
        haptic.notificationOccurred('success');
        break;
      case 'selection':
        haptic.selectionChanged();
        break;
    }
  }
}

// 设置主按钮
export function setMainButton(options: {
  text: string;
  onClick: () => void;
  isVisible?: boolean;
  isActive?: boolean;
  color?: string;
  textColor?: string;
}): () => void {
  const webApp = getTelegramWebApp();
  const mainButton = webApp?.MainButton;

  if (!mainButton) {
    return () => {};
  }

  mainButton.setText(options.text);

  if (options.color) {
    mainButton.color = options.color;
  }
  if (options.textColor) {
    mainButton.textColor = options.textColor;
  }

  mainButton.onClick(options.onClick);

  if (options.isVisible !== false) {
    mainButton.show();
  }

  if (options.isActive !== false) {
    mainButton.enable();
  }

  // 返回清理函数
  return () => {
    mainButton.offClick(options.onClick);
    mainButton.hide();
  };
}

// 隐藏主按钮
export function hideMainButton(): void {
  const webApp = getTelegramWebApp();
  webApp?.MainButton?.hide();
}

// 设置返回按钮
export function setBackButton(onClick: () => void): () => void {
  const webApp = getTelegramWebApp();
  const backButton = webApp?.BackButton;

  if (!backButton) {
    return () => {};
  }

  backButton.onClick(onClick);
  backButton.show();

  return () => {
    backButton.offClick(onClick);
    backButton.hide();
  };
}

// 隐藏返回按钮
export function hideBackButton(): void {
  const webApp = getTelegramWebApp();
  webApp?.BackButton?.hide();
}

// 打开 Telegram 链接
export function openTelegramLink(url: string): void {
  const webApp = getTelegramWebApp();
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}

// 打开外部链接
export function openLink(url: string, options?: { try_instant_view?: boolean }): void {
  const webApp = getTelegramWebApp();
  if (webApp?.openLink) {
    webApp.openLink(url, options);
  } else {
    window.open(url, '_blank');
  }
}

// 分享到 Telegram
export function shareToTelegram(url: string, text?: string): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
  openTelegramLink(shareUrl);
}

// 设置头部颜色
export function setHeaderColor(color: string): void {
  const webApp = getTelegramWebApp();
  webApp?.setHeaderColor?.(color);
}

// 设置背景颜色
export function setBackgroundColor(color: string): void {
  const webApp = getTelegramWebApp();
  webApp?.setBackgroundColor?.(color);
}

// 通知 Telegram 准备就绪
export function ready(): void {
  const webApp = getTelegramWebApp();
  webApp?.ready();
}

// 获取平台
export function getPlatform(): string {
  const webApp = getTelegramWebApp();
  return webApp?.platform || 'unknown';
}

// 获取版本
export function getVersion(): string {
  const webApp = getTelegramWebApp();
  return webApp?.version || '0.0';
}

// 检查版本是否满足要求
export function isVersionAtLeast(version: string): boolean {
  const webApp = getTelegramWebApp();
  return webApp?.isVersionAtLeast?.(version) || false;
}
