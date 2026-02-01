'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { WalletPageV3 } from '@/components/ui-v3/wallet/wallet-page-v3';
import { MobileWalletPage } from '@/components/ui-v3/mobile/mobile-wallet-page';

// 假设的 USDT 价格（实际应从 API 获取）
const USDT_PRICE = 1;
const HOOT_PRICE = 0.15;

export default function WalletPage() {
  const router = useRouter();

  // 获取余额
  const { data: balance } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const response = await api.get<{ usdt: string; hoot: string }>('/wallet/balance');
      return response.data;
    },
  });

  // 获取交易记录
  const { data: transactionsData } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: async () => {
      const response = await api.get<{
        items: Array<{
          id: string;
          type: string;
          asset: string;
          amount: string;
          status: string;
          createdAt: string;
        }>;
        total: number;
      }>('/wallet/transactions');
      return response.data;
    },
  });

  // 转换余额数据为 assets 格式
  const assets = useMemo(() => {
    if (!balance) return undefined;
    const usdtBalance = parseFloat(balance.usdt) || 0;
    const hootBalance = parseFloat(balance.hoot) || 0;

    // 临时 mock 数据 - 释放中和点卡（后续从 API 获取）
    const releasingHoot = 15000;
    const releasedAmount = 3000;
    const totalLocked = 18000;
    const gasCardBalance = 1250;

    return [
      {
        id: 'usdt',
        name: 'USDT',
        symbol: 'USDT',
        balance: usdtBalance || 10346.57, // 显示 mock 数据如果余额为 0
        value: usdtBalance || 10346.57,
        icon: '/icons/usdt.svg',
      },
      {
        id: 'hoot',
        name: 'HOOT',
        symbol: 'HOOT',
        balance: hootBalance || 2500.75,
        value: (hootBalance || 2500.75) * HOOT_PRICE,
        icon: '/icons/hoot/token.png',
      },
      {
        id: 'hoot-releasing',
        name: 'HOOT 释放中',
        symbol: 'HOOT',
        balance: releasingHoot,
        value: releasingHoot * HOOT_PRICE,
        icon: '/icons/hoot/token.png',
        isReleasing: true,
        releasedAmount,
        totalLocked,
      },
      {
        id: 'gas-card',
        name: '点卡',
        symbol: 'GAS',
        balance: gasCardBalance,
        value: gasCardBalance,
        icon: '/icons/gas-card.svg',
      },
    ];
  }, [balance]);

  // 计算总余额
  const totalBalance = useMemo(() => {
    if (!assets) return undefined;
    return assets.reduce((sum, asset) => sum + asset.value, 0);
  }, [assets]);

  // 转换交易记录格式
  const transactions = useMemo(() => {
    if (!transactionsData?.items) return undefined;
    return transactionsData.items.map((tx) => ({
      id: tx.id,
      type: tx.type as 'deposit' | 'withdraw' | 'buy' | 'exchange',
      amount: parseFloat(tx.amount) || 0,
      asset: tx.asset,
      status: tx.status as 'completed' | 'pending' | 'failed',
      time: new Date(tx.createdAt).toLocaleString('zh-CN'),
    }));
  }, [transactionsData]);

  // 移动端导航处理
  const handleMobileNavigate = (page: 'deposit' | 'withdraw' | 'exchange' | 'api-add') => {
    const routes: Record<string, string> = {
      deposit: '/wallet/deposit',
      withdraw: '/wallet/withdraw',
      exchange: '/wallet/exchange',
      'api-add': '/wallet/api-keys',
    };
    router.push(routes[page] || '/wallet');
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <WalletPageV3
          totalBalance={totalBalance}
          assets={assets}
          transactions={transactions}
          onDeposit={() => router.push('/wallet/deposit')}
          onWithdraw={() => router.push('/wallet/withdraw')}
          onExchange={() => router.push('/wallet/exchange')}
          onGoToEcosystem={() => router.push('/ecosystem')}
          onAddExchange={() => router.push('/wallet/api-keys')}
        />
      </div>

      {/* 移动端 - 使用V0生成的新版组件 */}
      <div className="block md:hidden">
        <MobileWalletPage
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
