'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';

/**
 * Admin 路由组的 Error Boundary
 * 解决问题：任何 admin 页面渲染出错时，提供重试/恢复 UI，而非白屏
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Admin 错误边界]', error);
  }, [error]);

  const errorMessage = error.message
    ? error.message.slice(0, 200)
    : '管理后台遇到意外错误';

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 flex flex-col items-center text-center"
        style={{
          backgroundColor: '#12121A',
          border: '1px solid #2A2A3A',
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
        >
          <AlertTriangle
            size={32}
            style={{ color: '#EF4444' }}
            aria-hidden="true"
          />
        </div>

        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: '#F8F8FC' }}
        >
          管理后台出错
        </h1>

        <p
          className="text-sm mb-2 leading-relaxed"
          style={{ color: '#9090A0' }}
        >
          页面加载失败，请尝试重试或重新登录。
        </p>

        {errorMessage && (
          <div
            className="w-full rounded-lg px-4 py-3 mb-8 text-left"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <p
              className="text-xs font-mono break-words"
              style={{ color: '#EF4444' }}
            >
              {errorMessage}
            </p>
            {error.digest && (
              <p className="text-xs mt-1" style={{ color: '#9090A0' }}>
                错误代码: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: '#06B6D4',
              color: '#0A0A0F',
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            重试
          </button>

          <a
            href="/admin-login"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{
              backgroundColor: 'transparent',
              color: '#F8F8FC',
              border: '1px solid #2A2A3A',
            }}
          >
            <LogIn size={16} aria-hidden="true" />
            重新登录
          </a>
        </div>
      </div>
    </div>
  );
}
