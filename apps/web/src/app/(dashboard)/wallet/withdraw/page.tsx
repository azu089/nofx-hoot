'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { WithdrawPage as WithdrawPageUI } from '@/components/ui-v3/wallet/withdraw-page';
import { MobileWithdrawPage } from '@/components/ui-v3/mobile/mobile-withdraw-page';

export default function WithdrawPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // 获取余额
  const { data: balance } = useQuery({
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
  });

  // 获取提现记录
  const { data: withdrawRequests } = useQuery({
    queryKey: ['wallet', 'withdraw-requests'],
    queryFn: async () => {
      const response = await api.get<{
        items: Array<{
          id: string;
          amount: string;
          fee: string;
          chain: string;
          toAddress: string;
          status: string;
          txHash: string;
          createdAt: string;
        }>;
      }>('/wallet/withdraw-requests');
      return response.data;
    },
    enabled: isAuthenticated,
  });

  // 提现请求
  const withdrawMutation = useMutation({
    mutationFn: async (data: {
      amount: number;
      network: string;
      address: string;
    }) => {
      const chainMap: Record<string, string> = {
        trc20: 'TRON',
        erc20: 'ETH',
        bep20: 'BSC',
        polygon: 'POLYGON',
      };
      const response = await api.post('/wallet/withdraw', {
        asset: 'USDT',
        amount: data.amount,
        chain: chainMap[data.network] || data.network,
        address: data.address,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      alert('提现申请已提交');
      router.push('/wallet');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : '提现失败');
    },
  });

  // 转换提现记录格式
  const recentWithdrawals = withdrawRequests?.items?.map((w) => ({
    id: w.id,
    amount: parseFloat(w.amount) || 0,
    fee: parseFloat(w.fee) || 0,
    network: w.chain,
    address: w.toAddress,
    status: w.status as 'pending' | 'processing' | 'completed' | 'failed',
    txHash: w.txHash,
    time: new Date(w.createdAt).toLocaleString('zh-CN'),
  }));

  const handleBack = () => {
    router.push('/wallet');
  };

  const usdtBalance = parseFloat(balance?.usdtBalance || '0');

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <WithdrawPageUI
          balance={usdtBalance}
          recentWithdrawals={recentWithdrawals}
          onWithdraw={(data) => withdrawMutation.mutate(data)}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileWithdrawPage
          balance={usdtBalance}
          recentWithdrawals={recentWithdrawals}
          onBack={handleBack}
          onWithdraw={(data) => withdrawMutation.mutate(data)}
        />
      </div>
    </>
  );
}
