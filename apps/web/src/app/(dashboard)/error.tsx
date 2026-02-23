'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 上报错误到监控（未来接入 Sentry 等）
    if (process.env.NODE_ENV === 'development') {
      console.error('[DashboardError]', error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">出了点问题</h2>
        <p className="text-[#9090A0] text-sm max-w-md">
          {error.message || '页面加载时发生了意外错误，请重试。'}
        </p>
      </div>

      <button
        onClick={reset}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors text-sm font-medium"
      >
        <RefreshCw className="w-4 h-4" />
        重试
      </button>
    </div>
  );
}
