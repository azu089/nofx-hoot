'use client';

import { useState, useEffect } from 'react';

/**
 * 设备类型检测 Hook
 *
 * 策略：只在初始加载时检测，不监听 resize
 * - < 768px → 移动端
 * - >= 768px → 桌面端
 *
 * 用户想要切换视图需要刷新页面
 */
export function useDeviceType() {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 检测是否为移动设备（< 768px）
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
      setIsLoaded(true);
    };

    checkDevice();
    // 只在初始加载时检测，不监听 resize
  }, []);

  return { isMobile, isLoaded };
}

/**
 * 移动端布局常量
 */
export const MOBILE_LAYOUT = {
  HEADER_HEIGHT: 56,      // 顶部 Header 高度
  TAB_BAR_HEIGHT: 56,     // 底部 TabBar 高度
  CONTENT_PADDING: 16,    // 内容区左右内边距
  CARD_GAP: 12,           // 卡片间距
} as const;
