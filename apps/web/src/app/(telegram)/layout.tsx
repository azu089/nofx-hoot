'use client';

import { useEffect } from 'react';
import { TelegramProvider, useTelegramContext } from '@/components/providers/TelegramProvider';
import { TelegramNav } from '@/components/layout/TelegramNav';
import { setHeaderColor, setBackgroundColor } from '@/lib/telegram';

function TelegramLayoutContent({ children }: { children: React.ReactNode }) {
  const { isTelegram, isLoading, isAuthenticated } = useTelegramContext();

  // 设置 Telegram 主题色
  useEffect(() => {
    if (isTelegram) {
      setHeaderColor('#0B0E11');
      setBackgroundColor('#0B0E11');
    }
  }, [isTelegram]);

  // 加载中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  // 非 Telegram 环境
  if (!isTelegram) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-text-primary mb-2">请在 Telegram 中打开</h1>
          <p className="text-text-secondary">此页面仅支持 Telegram Mini App</p>
        </div>
      </div>
    );
  }

  // 认证失败
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-text-primary mb-2">认证失败</h1>
          <p className="text-text-secondary">请重新打开 Mini App</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-20">
      <main className="p-4">{children}</main>
      <TelegramNav />
    </div>
  );
}

export default function TelegramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TelegramProvider>
      <TelegramLayoutContent>{children}</TelegramLayoutContent>
    </TelegramProvider>
  );
}
