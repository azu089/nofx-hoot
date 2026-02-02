'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 此页面已合并到 /wallet 页面的 API Tab
 * 访问 /wallet/api-keys 会自动重定向到 /wallet?tab=api
 */
export default function WalletApiKeysPage() {
  const router = useRouter();

  useEffect(() => {
    // 重定向到 /wallet 并选中 API tab
    router.replace('/wallet?tab=api');
  }, [router]);

  // 显示加载状态，避免闪烁
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="text-[#9090A0]">正在跳转...</div>
    </div>
  );
}
