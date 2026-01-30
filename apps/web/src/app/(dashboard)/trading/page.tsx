'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PositionsPageV3 } from '@/components/ui-v3/positions/positions-page-v3';

export default function TradingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 获取持仓列表（后续接入时移除下划线前缀）
  const { data: _positions, isLoading: _isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await api.get<{
        items: Array<{
          id: string;
          strategyId: string;
          strategyName: string;
          symbol: string;
          side: string;
          amount: string;
          entryPrice: string;
          currentPrice: string;
          pnl: string;
          pnlPercent: string;
          status: string;
        }>;
      }>('/positions');
      return response.data;
    },
  });

  // 平仓
  const closePositionMutation = useMutation({
    mutationFn: async (positionId: string) => {
      const response = await api.post(`/positions/${positionId}/close`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });

  // 暂停策略
  const pauseStrategyMutation = useMutation({
    mutationFn: async (strategyId: string) => {
      const response = await api.post(`/strategies/${strategyId}/pause`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });

  // 后续接入真实数据时移除
  void _positions;
  void _isLoading;

  return (
    <PositionsPageV3
      onClosePosition={(id) => closePositionMutation.mutate(String(id))}
      onPauseStrategy={(id) => pauseStrategyMutation.mutate(String(id))}
      onResumeStrategy={(id) => console.log('恢复策略:', id)}
      onEmergencyCloseAll={() => console.log('紧急全部平仓')}
      onEditStrategy={(id) => router.push(`/strategies/${id}/config`)}
      onDeleteStrategy={(id) => console.log('删除策略:', id)}
      onToggleStrategy={(id, status) => console.log('切换策略状态:', id, status)}
      onViewMarket={() => router.push('/strategies')}
      // 传递真实数据
      // positions={positions?.items}
      // isLoading={isLoading}
    />
  );
}
