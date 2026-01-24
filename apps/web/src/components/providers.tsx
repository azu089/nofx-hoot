'use client';

import { useState, useEffect, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui';
import { RouteProgress } from '@/components/ui/RouteProgress';
import { registerServiceWorker, setupInstallPrompt } from '@/lib/registerSW';

export function Providers({ children }: { children: React.ReactNode }) {
  // 注册 Service Worker 和安装提示
  useEffect(() => {
    registerServiceWorker();
    setupInstallPrompt();
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {/* 路由切换进度条 - 提供即时反馈 */}
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
