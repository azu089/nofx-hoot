'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PositionsPageV3 } from '@/components/ui-v3/positions/positions-page-v3';
import { MobileTradingCenter } from '@/components/ui-v3/mobile/mobile-trading-center';

interface Position {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  roe: number;
  icon: string;
  strategy: string;
  stopLoss: number;
  takeProfit: number;
  marketType: 'spot' | 'futures';
}

export default function TradingPage() {
  const router = useRouter();

  // 获取持仓数据
  const { data: positions, isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      try {
        const response = await api.get<Position[]>('/trading/positions');
        return response.data;
      } catch {
        // API 未实现时返回 null，让组件使用 mock 数据
        return null;
      }
    },
  });

  const handleClosePosition = (positionId: number) => {
    console.log('关闭持仓:', positionId);
    // TODO: 调用 API 关闭持仓
  };

  const handleEmergencyCloseAll = () => {
    console.log('紧急平仓所有持仓');
    // TODO: 调用 API 紧急平仓
  };

  const handleEditStrategy = (strategyId: string) => {
    router.push(`/strategies/${strategyId}/config`);
  };

  const handleDeleteStrategy = (strategyId: string) => {
    console.log('删除策略:', strategyId);
    // TODO: 调用 API 删除策略
  };

  const handleToggleStrategy = (strategyId: string, status: 'running' | 'paused') => {
    console.log('切换策略状态:', strategyId, status);
    // TODO: 调用 API 切换策略状态
  };

  const handleViewMarket = () => {
    router.push('/strategies');
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <PositionsPageV3
          positions={positions || undefined}
          isLoading={isLoading}
          onClosePosition={handleClosePosition}
          onEmergencyCloseAll={handleEmergencyCloseAll}
          onEditStrategy={handleEditStrategy}
          onDeleteStrategy={handleDeleteStrategy}
          onToggleStrategy={handleToggleStrategy}
          onViewMarket={handleViewMarket}
        />
      </div>

      {/* 移动端 - 使用 MobileTradingCenter */}
      <div className="block md:hidden">
        <MobileTradingCenter
          onClosePosition={handleClosePosition}
          onEmergencyCloseAll={handleEmergencyCloseAll}
          onEditStrategy={handleEditStrategy}
          onDeleteStrategy={handleDeleteStrategy}
          onToggleStrategy={handleToggleStrategy}
          onViewMarket={handleViewMarket}
        />
      </div>
    </>
  );
}
