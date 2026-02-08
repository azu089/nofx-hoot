/**
 * Telegram WebApp SDK 工具库
 * 检测 TG 环境、封装常用 SDK 方法
 */

/**
 * 检测当前是否在 Telegram WebApp 环境中
 */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = window.Telegram?.WebApp;
  return !!tg && !!tg.initData && tg.initData.length > 0;
}

/**
 * 获取 Telegram WebApp 实例
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp || null;
}

/**
 * 获取 initData 原始字符串（用于发送给后端验证）
 */
export function getTelegramInitData(): string | null {
  const tg = getTelegramWebApp();
  if (!tg || !tg.initData) return null;
  return tg.initData;
}

/**
 * 获取 TG 用户信息（未验证，仅用于 UI 展示）
 */
export function getTelegramUser(): TelegramWebAppUser | null {
  const tg = getTelegramWebApp();
  return tg?.initDataUnsafe?.user || null;
}

/**
 * 获取深度链接 start_param（邀请码等）
 */
export function getTelegramStartParam(): string | null {
  const tg = getTelegramWebApp();
  return tg?.initDataUnsafe?.start_param || null;
}

/**
 * 初始化 TG WebApp（展开 + 设置颜色 + ready）
 */
export function initTelegramWebApp(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  // 全屏展开
  tg.expand();

  // 设置颜色匹配 HOOT 主题
  tg.setHeaderColor('#0A0A0F');
  tg.setBackgroundColor('#0A0A0F');

  // 告诉 TG 加载完成（隐藏加载动画）
  tg.ready();
}

/**
 * 触发震动反馈
 */
export function hapticFeedback(
  type: 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy'
): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  if (type === 'success' || type === 'warning' || type === 'error') {
    tg.HapticFeedback.notificationOccurred(type);
  } else {
    tg.HapticFeedback.impactOccurred(type);
  }
}

/**
 * 关闭 Mini App
 */
export function closeTelegramWebApp(): void {
  getTelegramWebApp()?.close();
}
