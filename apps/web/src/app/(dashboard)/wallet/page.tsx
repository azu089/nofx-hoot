'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { WalletPageV3 } from '@/components/ui-v3/wallet/wallet-page-v3';

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
    return [
      {
        id: 'usdt',
        name: 'Tether USD',
        symbol: 'USDT',
        balance: usdtBalance,
        value: usdtBalance * USDT_PRICE,
        price: USDT_PRICE,
        icon: '💵',
      },
      {
        id: 'hoot',
        name: 'HOOT Token',
        symbol: 'HOOT',
        balance: hootBalance,
        value: hootBalance * HOOT_PRICE,
        price: HOOT_PRICE,
        icon: '🦉',
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

  return (
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
  );
}
