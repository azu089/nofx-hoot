'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StrategyMarketplaceV3 } from '@/components/ui-v3/strategies/strategy-marketplace-v3';
import { MobileStrategiesV3 } from '@/components/ui-v3/mobile/mobile-strategies-v3';

const PAGE_SIZE = 6; // 每页显示数量

export default function StrategiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE); // 当前显示数量
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 获取策略列表
  const { data: strategiesData } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const response = await api.get<Array<{
        id: string;
        name: string;
        description: string;
        freqtradeId?: string;
        isActive: boolean;
        subscriberCount: number;
        riskLevel: string;
        tags: string[];
        totalTrades: number;
        isFeatured: boolean;
        // 扩展字段（后端可选返回）
        winRate?: number;
        monthlyReturn?: number;
        creator?: string;
        marketType?: string;
      }>>('/strategies');
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

  // 转换策略数据格式（全部数据）- 使用真实 API 数据
  const allStrategies = useMemo(() => {
    if (!strategiesData) return [];

    return strategiesData.map((s) => {
      // 根据策略名称推断类型
      let type: 'DCA' | 'Grid' | 'Arbitrage' | 'AI Signal' = 'DCA';
      if (s.name.includes('网格') || s.name.toLowerCase().includes('grid')) type = 'Grid';
      else if (s.name.includes('套利') || s.name.toLowerCase().includes('arb')) type = 'Arbitrage';
      else if (s.name.includes('AI') || s.name.includes('信号')) type = 'AI Signal';

      // 根据描述或字段推断市场类型
      const marketType: 'spot' | 'futures' =
        s.marketType === 'futures' || s.description?.includes('合约') ? 'futures' : 'spot';

      // 生成 badges
      const badges: ('hot' | 'new' | 'pro')[] = [];
      if (s.isFeatured || s.subscriberCount > 10) badges.push('hot');
      if (s.description?.includes('专业版') || s.tags?.includes('pro')) badges.push('pro');

      return {
        id: s.id,
        name: s.name,
        type,
        marketType,
        creator: s.creator || 'HOOT Team',
        winRate: s.winRate ?? 0,
        totalReturn: s.monthlyReturn ?? 0,
        riskLevel: (s.riskLevel || 'medium') as 'low' | 'medium' | 'high',
        subscribers: s.subscriberCount || 0,
        badges,
        isHot: s.isFeatured || s.subscriberCount > 0,
      };
    });
  }, [strategiesData]);

  // 当前显示的策略（分页）
  const strategies = useMemo(() => {
    if (!allStrategies.length) return [];
    return allStrategies.slice(0, displayCount);
  }, [allStrategies, displayCount]);

  // 是否还有更多数据
  const hasMore = allStrategies.length > displayCount;

  // 加载更多
  const handleLoadMore = () => {
    setIsLoadingMore(true);
    // 模拟加载延迟
    setTimeout(() => {
      setDisplayCount((prev) => prev + PAGE_SIZE);
      setIsLoadingMore(false);
    }, 300);
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <StrategyMarketplaceV3
          strategies={strategies}
          onStrategyClick={(id) => router.push(`/strategies/${id}`)}
          onSubscribe={(id) => subscribeMutation.mutate(id)}
          onSearch={(q) => console.log('搜索:', q)}
          onFilterChange={(f) => console.log('筛选:', f)}
          onConfigureStrategy={(id) => router.push(`/strategies/${id}/config`)}
          onCreateStrategy={() => router.push('/strategies/create')}
          onNavigate={(path) => router.push(path)}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileStrategiesV3
          strategies={strategies}
          onStrategyClick={(id) => router.push(`/strategies/${id}`)}
          onUseStrategy={(id) => router.push(`/strategies/${id}/config`)}
          onNavigate={(tab) => router.push(`/${tab}`)}
          onCreateStrategy={() => router.push('/strategies/create')}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
        />
      </div>
    </>
  );
}
