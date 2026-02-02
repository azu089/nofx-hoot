'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { useState, ReactNode } from 'react';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';
import { config } from './wagmi';
import { LocaleProvider } from '@/i18n/provider';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 默认缓存 5 分钟
            staleTime: 5 * 60 * 1000,
            // 错误重试 1 次
            retry: 1,
            // 窗口聚焦时不自动刷新
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
              <Toaster position="top-center" richColors closeButton />
            </AuthProvider>
          </ThemeProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
