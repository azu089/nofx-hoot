'use client';

import { useRouter } from 'next/navigation';
import { usePWA } from '@/hooks/usePWA';
import {
  ChevronLeft,
  Download,
  Check,
  Share,
  Plus,
  Trash2,
  FileText,
  Shield,
  Info,
} from 'lucide-react';

/**
 * 关于应用页面
 * 包含：版本信息、PWA安装、清除缓存、隐私条款、服务条款
 */
export default function AboutPage() {
  const router = useRouter();
  const { canInstall, isInstalled, isIOS, isSafari, install } = usePWA();

  const handleClearCache = () => {
    if (confirm('确定要清除缓存吗?这将刷新页面')) {
      // 清除 localStorage
      localStorage.clear();
      // 刷新页面
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary p-4 lg:p-6 pb-24 lg:pb-6">
      {/* 顶部导航 */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>设置</span>
        </button>
        <h1 className="text-2xl font-bold text-text-primary mt-4">关于应用</h1>
      </div>

      {/* 内容 */}
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 应用信息 */}
        <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden divide-y divide-border-primary">
          {/* 版本信息 */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-tertiary mb-1">当前版本</p>
                <p className="text-text-primary font-medium">v1.15.0</p>
              </div>
              <div className="px-3 py-1 bg-success/10 rounded-full">
                <span className="text-xs text-success">最新版本</span>
              </div>
            </div>
          </div>

          {/* PWA 安装 */}
          <div className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="flex-1">
                <p className="text-text-primary font-medium">安装应用</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {isInstalled
                    ? '应用已安装到您的设备'
                    : '安装到桌面,获得原生体验'}
                </p>
              </div>
              {isInstalled ? (
                <span className="flex items-center gap-1 text-sm text-success">
                  <Check className="w-4 h-4" />
                  已安装
                </span>
              ) : canInstall ? (
                <button
                  onClick={install}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  安装
                </button>
              ) : isIOS && isSafari ? (
                <div className="text-right">
                  <p className="text-xs text-text-tertiary mb-1">iOS 安装:</p>
                  <div className="flex items-center gap-1 text-xs text-text-secondary">
                    <Share className="w-3 h-3" />
                    <span>→</span>
                    <Plus className="w-3 h-3" />
                  </div>
                </div>
              ) : (
                <span className="text-sm text-text-tertiary">
                  请使用 Chrome/Safari
                </span>
              )}
            </div>
          </div>

          {/* 清除缓存 */}
          <div className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-text-primary font-medium">清除缓存</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  清除应用缓存数据
                </p>
              </div>
              <button
                onClick={handleClearCache}
                className="px-4 py-2 bg-bg-tertiary hover:bg-border-primary text-text-secondary text-sm rounded-lg transition-colors"
              >
                清除
              </button>
            </div>
          </div>
        </div>

        {/* 法律条款 */}
        <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden divide-y divide-border-primary">
          {/* 服务条款 */}
          <button
            onClick={() => window.open('/terms', '_blank')}
            className="w-full p-4 flex items-center gap-4 hover:bg-bg-tertiary/50 transition-colors"
          >
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-text-primary font-medium">服务条款</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                用户协议和使用条款
              </p>
            </div>
            <ChevronLeft className="w-5 h-5 text-text-tertiary -rotate-180" />
          </button>

          {/* 隐私政策 */}
          <button
            onClick={() => window.open('/privacy', '_blank')}
            className="w-full p-4 flex items-center gap-4 hover:bg-bg-tertiary/50 transition-colors"
          >
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-text-primary font-medium">隐私政策</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                数据保护和隐私条款
              </p>
            </div>
            <ChevronLeft className="w-5 h-5 text-text-tertiary -rotate-180" />
          </button>

          {/* 关于我们 */}
          <button
            onClick={() => router.push('/about')}
            className="w-full p-4 flex items-center gap-4 hover:bg-bg-tertiary/50 transition-colors"
          >
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-text-primary font-medium">关于我们</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                了解 QuantFi 团队和愿景
              </p>
            </div>
            <ChevronLeft className="w-5 h-5 text-text-tertiary -rotate-180" />
          </button>
        </div>

        {/* 版权信息 */}
        <div className="text-center text-xs text-text-tertiary py-4">
          <p>© 2024 QuantFi. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
