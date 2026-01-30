'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StrategyMarketplaceV3 } from '@/components/ui-v3/strategies/strategy-marketplace-v3';

export default function StrategiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 获取策略列表
  const { data: strategiesData } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const response = await api.get<{
        items: Array<{
          id: string;
          name: string;
          description: string;
          type: string;
          creator: string;
          monthlyReturn: string;
          winRate: string;
          maxDrawdown: string;
          subscribers: number;
          riskLevel: string;
          isHot: boolean;
          badges: string[];
        }>;
        total: number;
      }>('/strategies');
      return response.data;
    },
  });

  // 订阅策略
  const subscribeMutation = useMutation({
    mutationFn: async (strategyId: string) => {
      const response = await api.post(`/strategies/${strategyId}/subscribe`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      alert('订阅成功');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : '订阅失败');
    },
  });

  // 转换策略数据格式
  const strategies = useMemo(() => {
    if (!strategiesData?.items) return undefined;
    return strategiesData.items.map((s) => ({
      id: s.id,
      name: s.name,
      type: (s.type || 'DCA') as 'DCA' | 'Grid' | 'Arbitrage' | 'AI Signal',
      marketType: '现货' as '现货' | '合约', // 默认现货，后端可以返回
      creator: s.creator || '官方',
      winRate: parseFloat(s.winRate) || 0,
      totalReturn: parseFloat(s.monthlyReturn) || 0,
      riskLevel: (s.riskLevel || 'medium') as 'low' | 'medium' | 'high',
      subscribers: s.subscribers || 0,
      badges: (s.badges || []).map(b => {
        // 转换英文 badge 为中文
        if (b === 'Hot') return '热门';
        if (b === 'New') return '最新';
        if (b === 'Pro') return '专业版';
        return b;
      }) as ('热门' | '最新' | '专业版')[],
      isHot: s.isHot || false,
    }));
  }, [strategiesData]);

  return (
    <StrategyMarketplaceV3
      strategies={strategies}
      onStrategyClick={(id) => router.push(`/strategies/${id}`)}
      onSubscribe={(id) => subscribeMutation.mutate(id)}
      onSearch={(q) => console.log('搜索:', q)}
      onFilterChange={(f) => console.log('筛选:', f)}
      onConfigureStrategy={(id) => router.push(`/strategies/${id}/config`)}
      onCreateStrategy={() => router.push('/strategies/create')}
      onNavigate={(path) => router.push(path)}
    />
  );
}
