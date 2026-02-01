'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DepositPage as DepositPageUI } from '@/components/ui-v3/wallet/deposit-page';
import { MobileDepositPage } from '@/components/ui-v3/mobile/mobile-deposit-page';

export default function DepositPage() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedNetwork, _setSelectedNetwork] = useState('bep20');

  // 根据选择的网络获取充值地址
  const chainMap: Record<string, string> = {
    trc20: 'TRON',
    erc20: 'ETH',
    bep20: 'BSC',
    polygon: 'POLYGON',
  };

  const { data: depositAddress } = useQuery({
    queryKey: ['wallet', 'deposit-address', selectedNetwork, 'USDT'],
    queryFn: async () => {
      const response = await api.get<{
        chain: string;
        asset: string;
        address: string;
      }>(`/wallet/deposit-address?chain=${chainMap[selectedNetwork]}&asset=USDT`);
      return response.data;
    },
  });

  const handleCopyAddress = () => {
    if (depositAddress?.address) {
      navigator.clipboard.writeText(depositAddress.address);
      alert('地址已复制');
    }
  };

  const handleBack = () => {
    router.push('/wallet');
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <DepositPageUI
          walletAddress={depositAddress?.address}
          onCopyAddress={handleCopyAddress}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileDepositPage onBack={handleBack} />
      </div>
    </>
  );
}
