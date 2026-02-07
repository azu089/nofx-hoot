'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ExchangePage } from '@/components/ui-v3/wallet/exchange-page';
import { MobileExchangePage } from '@/components/ui-v3/mobile/mobile-exchange-page';
import { toast } from 'sonner';

export default function WalletExchangePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // 获取余额
  const { data: balance } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const response = await api.get<{ usdt: string; hoot: string; point: string }>('/wallet/balance');
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // 兑换 mutation
  const exchangeMutation = useMutation({
    mutationFn: async (data: { fromAsset: string; toAsset: string; amount: number }) => {
      const response = await api.post<{ fromAmount: string; toAmount: string; rate: string }>('/wallet/exchange', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`兑换成功！获得 ${parseFloat(data.toAmount).toFixed(4)}`);
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '兑换失败');
    },
  });

  const handleExchange = (from: string, to: string, amount: number) => {
    // 映射前端资产名到后端
    const assetMap: Record<string, string> = {
      USDT: 'USDT',
      HOOT: 'HOOT',
      '点卡': 'POINT',
      GAS: 'POINT',
      POINT: 'POINT',
    };

    const fromAsset = assetMap[from] || from;
    const toAsset = assetMap[to] || to;

    exchangeMutation.mutate({ fromAsset, toAsset, amount });
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <ExchangePage
          balance={{
            usdt: parseFloat(balance?.usdt || '0'),
            hoot: parseFloat(balance?.hoot || '0'),
            point: parseFloat(balance?.point || '0'),
          }}
          onExchange={handleExchange}
          isLoading={exchangeMutation.isPending}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileExchangePage
          balance={{
            usdt: parseFloat(balance?.usdt || '0'),
            hoot: parseFloat(balance?.hoot || '0'),
            point: parseFloat(balance?.point || '0'),
          }}
          onBack={() => router.back()}
          onExchange={handleExchange}
          isLoading={exchangeMutation.isPending}
        />
      </div>
    </>
  );
}
