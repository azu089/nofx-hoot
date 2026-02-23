'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { WalletPageV3 } from '@/components/ui-v3/wallet/wallet-page-v3';
import { MobileWalletPage } from '@/components/ui-v3/mobile/mobile-wallet-page';

function WalletPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 参数读取初始 tab（支持 /wallet?tab=api 跳转）
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam === 'api' || tabParam === 'ecosystem') ? tabParam : 'wallet';

  return (
    <>
      {/* 桌面端 - 组件内部自动获取数据 */}
      <div className="hidden md:block">
        <WalletPageV3
          initialTab={initialTab}
          onDeposit={() => router.push('/wallet/deposit')}
          onWithdraw={() => router.push('/wallet/withdraw')}
          onExchange={() => router.push('/wallet/exchange')}
          onGoToEcosystem={() => router.push('/ecosystem')}
          onAddExchange={() => router.push('/wallet?tab=api')}
        />
      </div>

      {/* 移动端 - 组件内部自动获取数据 */}
      <div className="block md:hidden">
        <MobileWalletPage
          initialTab={initialTab}
          onNavigate={(path) => {
            if (path === '/deposit') router.push('/wallet/deposit');
            else if (path === '/withdraw') router.push('/wallet/withdraw');
            else if (path === '/exchange') router.push('/wallet/exchange');
            else router.push(path);
          }}
        />
      </div>
    </>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
      </div>
    }>
      <WalletPageContent />
    </Suspense>
  );
}
