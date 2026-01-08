'use client';

import { usePWA } from '@/hooks/usePWA';
import { X, Download, Share, Plus } from 'lucide-react';

/**
 * PWA 安装提示组件
 * - Android/Chrome: 显示安装按钮，点击触发原生安装提示
 * - iOS Safari: 显示手动添加步骤引导
 */
export function PWAInstallPrompt() {
  const { showPrompt, canInstall, isIOS, isSafari, install, dismiss } = usePWA();

  if (!showPrompt) return null;

  // iOS Safari 手动添加引导
  if (isIOS && isSafari) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up lg:hidden">
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 shadow-lg">
          {/* 关闭按钮 */}
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 p-1 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="关闭"
          >
            <X size={18} />
          </button>

          {/* 标题 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center">
              <Download size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary">安装 QuantFi</h3>
              <p className="text-xs text-text-secondary">添加到主屏幕，获得原生体验</p>
            </div>
          </div>

          {/* iOS 添加步骤 */}
          <div className="space-y-2 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-medium">
                1
              </div>
              <span>点击底部</span>
              <Share size={16} className="text-brand-primary" />
              <span>分享按钮</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-medium">
                2
              </div>
              <span>选择</span>
              <Plus size={16} className="text-brand-primary" />
              <span>「添加到主屏幕」</span>
            </div>
          </div>

          {/* 知道了按钮 */}
          <button
            onClick={dismiss}
            className="w-full mt-4 py-2 bg-bg-tertiary hover:bg-border-primary text-text-primary rounded-lg text-sm transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    );
  }

  // Android/Chrome 安装提示
  if (canInstall) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up lg:hidden">
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 shadow-lg">
          {/* 关闭按钮 */}
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 p-1 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="关闭"
          >
            <X size={18} />
          </button>

          {/* 标题 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center">
              <Download size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary">安装 QuantFi</h3>
              <p className="text-xs text-text-secondary">安装到桌面，随时随地交易</p>
            </div>
          </div>

          {/* 按钮组 */}
          <div className="flex gap-3">
            <button
              onClick={dismiss}
              className="flex-1 py-2 bg-bg-tertiary hover:bg-border-primary text-text-primary rounded-lg text-sm transition-colors"
            >
              暂不需要
            </button>
            <button
              onClick={install}
              className="flex-1 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg text-sm font-medium transition-colors"
            >
              立即安装
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
