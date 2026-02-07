'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { DepositPage as DepositPageUI } from '@/components/ui-v3/wallet/deposit-page';
import { MobileDepositPage } from '@/components/ui-v3/mobile/mobile-deposit-page';

type NetworkType = 'TRC20' | 'ERC20' | 'BEP20' | 'Polygon';

// 网络映射
const chainMap: Record<string, string> = {
  TRC20: 'TRON',
  ERC20: 'ETH',
  BEP20: 'BSC',
  Polygon: 'POLYGON',
};

// 充值记录类型
interface DepositHistory {
  id: string;
  amount: string;
  chain: string;
  txHash: string;
  status: string;
  createdAt: string;
}

export default function DepositPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>('BEP20');

  // 获取充值地址
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
    enabled: isAuthenticated,
  });

  // 获取钱包余额
  const { data: walletBalance } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const response = await api.get<{
        usdtBalance: string;
        hootBalance: string;
        pointBalance: string;
      }>('/wallet/balance');
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // 获取充值历史
  const { data: depositHistory } = useQuery({
    queryKey: ['wallet', 'deposit-history'],
    queryFn: async () => {
      const response = await api.get<{
        items: DepositHistory[];
        total: number;
      }>('/wallet/deposits');
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const handleCopyAddress = () => {
    if (depositAddress?.address) {
      navigator.clipboard.writeText(depositAddress.address);
    }
  };

  const handleBack = () => {
    router.push('/wallet');
  };

  const handleNetworkChange = (network: NetworkType) => {
    setSelectedNetwork(network);
  };

  // 转换充值历史格式 - 桌面端
  const recentDepositsDesktop = depositHistory?.items?.map(d => ({
    id: d.id,
    amount: parseFloat(d.amount),
    network: d.chain === 'TRON' ? 'TRC20' : d.chain === 'ETH' ? 'ERC20' : d.chain === 'BSC' ? 'BEP20' : 'Polygon',
    status: (d.status === 'confirmed' ? 'completed' : d.status === 'pending' ? 'pending' : 'confirmed') as 'pending' | 'confirmed' | 'completed',
    txHash: d.txHash || '',
    time: new Date(d.createdAt).toLocaleString('zh-CN'),
  })) || [];

  // 转换充值历史格式 - 移动端
  const recentDepositsMobile = depositHistory?.items?.map(d => ({
    id: d.id,
    amount: d.amount,
    network: (d.chain === 'TRON' ? 'TRC20' : d.chain === 'ETH' ? 'ERC20' : d.chain === 'BSC' ? 'BEP20' : 'Polygon') as NetworkType,
    time: new Date(d.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
    status: (d.status === 'confirmed' ? 'completed' : d.status === 'pending' ? 'pending' : 'failed') as 'completed' | 'pending' | 'failed',
  })) || [];

  const balance = parseFloat(walletBalance?.usdtBalance || '0');

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <DepositPageUI
          walletAddress={depositAddress?.address}
          recentDeposits={recentDepositsDesktop}
          balance={balance}
          onCopyAddress={handleCopyAddress}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileDepositPage
          onBack={handleBack}
          walletAddress={depositAddress?.address || ''}
          recentDeposits={recentDepositsMobile}
          selectedNetwork={selectedNetwork}
          onNetworkChange={handleNetworkChange}
        />
      </div>
    </>
  );
}
