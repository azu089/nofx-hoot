'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PositionsPageV3 } from '@/components/ui-v3/positions/positions-page-v3';
import { MobileTradingCenter } from '@/components/ui-v3/mobile/mobile-trading-center';
import { toast } from 'sonner';

// 持仓数据类型
interface Position {
  id: string;
  symbol: string;
  side: string;
  entryPrice: string;
  amount: string;
  pnl?: string;
  status: string;
  exchange: string;
  strategyName?: string;
  createdAt: string;
}

// 交易历史类型
interface TradeHistory {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: string;
  amount: string;
  total: string;
  pnl: string;
  fee: string;
  status: string;
  closedAt: string;
  createdAt: string;
}

// 执行日志类型
interface ExecutionLog {
  id: string;
  time: string;
  strategy: string;
  action: string;
  symbol: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

// 盈亏统计类型
interface PnlStats {
  totalPnl: string;
  todayPnl: string;
  weekPnl: string;
  monthPnl: string;
  unrealizedPnl: string;
  tradeCount: number;
  winRate: string;
}

// 钱包余额类型
interface WalletBalance {
  usdtBalance: string;
  hootBalance: string;
  pointBalance: string;
}

// API Key类型
interface ApiKeyInfo {
  id: string;
  exchange: string;
  label: string;
  isActive: boolean;
}

export default function TradingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // 获取持仓数据
  const { data: positionsData, isLoading: positionsLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await api.get<{
        items: Position[];
        total: number;
        totalPnl: string;
      }>('/trading/positions');
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // 获取交易历史
  const { data: historyData } = useQuery({
    queryKey: ['trade-history'],
    queryFn: async () => {
      const response = await api.get<{
        items: TradeHistory[];
        total: number;
      }>('/trading/positions/history');
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // 获取执行日志
  const { data: logsData } = useQuery({
    queryKey: ['execution-logs'],
    queryFn: async () => {
      const response = await api.get<ExecutionLog[]>('/trading/positions/logs');
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // 获取盈亏统计
  const { data: pnlStats } = useQuery({
    queryKey: ['pnl-stats'],
    queryFn: async () => {
      const response = await api.get<PnlStats>('/trading/positions/pnl-stats');
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // 获取钱包余额
  const { data: walletBalance } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: async () => {
      const response = await api.get<WalletBalance>('/wallet/balance');
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // 获取API Keys
  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get<{ items: ApiKeyInfo[]; total: number }>('/api-keys');
      return response.data.items;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // 获取每个 API Key 的余额（复用 API 页面的缓存数据）
  const apiKeyBalanceQueries = useQueries({
    queries: (apiKeys || []).map((key) => ({
      queryKey: ['api-key-balance', key.id],
      queryFn: async () => {
        try {
          const response = await api.get<{
            valid: boolean;
            totalUsdValue: number;
            error?: string;
          }>(`/api-keys/${key.id}/verify`);
          return response.data;
        } catch (e) {
          return { valid: false, totalUsdValue: 0 };
        }
      },
      enabled: isAuthenticated && !!key.id,
      staleTime: 30 * 1000, // 30秒缓存，与 API 页面共享
      retry: false,
    })),
  });

  // 订阅策略类型
  interface SubscribedStrategy {
    id: string;
    strategyId: string;
    isActive: boolean;
    leverage?: number;
    amountPerTrade?: string;
    stopLossPercent?: string;
    takeProfitPercent?: string;
    tradingPairs?: string[];
    tradingType?: string;
    createdAt: string;
    strategy?: {
      name?: string;
      description?: string;
    };
  }

  // 获取订阅的策略
  const { data: subscribedStrategies } = useQuery({
    queryKey: ['subscribed-strategies'],
    queryFn: async () => {
      const response = await api.get<SubscribedStrategy[]>('/strategies/my/subscriptions');
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // 单个平仓
  const closePositionMutation = useMutation({
    mutationFn: async ({ positionId, apiKeyId }: { positionId: string; apiKeyId: string }) => {
      const response = await api.post(`/trading/positions/${positionId}/close`, { apiKeyId });
      return response.data;
    },
    onSuccess: () => {
      toast.success('平仓成功');
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['pnl-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trade-history'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '平仓失败');
    },
  });

  // 紧急清仓
  const emergencyCloseAllMutation = useMutation({
    mutationFn: async (apiKeyId: string) => {
      const response = await api.post<{ closed: number; failed: number }>('/trading/positions/close-all', { apiKeyId });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`紧急清仓完成: 成功 ${data.closed} 笔, 失败 ${data.failed} 笔`);
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['pnl-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trade-history'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '紧急清仓失败');
    },
  });

  // 删除策略订阅
  const deleteStrategyMutation = useMutation({
    mutationFn: async (strategyId: string) => {
      const response = await api.delete(`/strategies/${strategyId}/subscribe`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('已取消订阅');
      queryClient.invalidateQueries({ queryKey: ['subscribed-strategies'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '取消订阅失败');
    },
  });

  // 切换策略状态
  const toggleStrategyMutation = useMutation({
    mutationFn: async ({ subscriptionId, isActive }: { subscriptionId: string; isActive: boolean }) => {
      const response = await api.patch(`/strategies/subscription/${subscriptionId}/toggle`, { isActive });
      return response.data;
    },
    onSuccess: () => {
      toast.success('策略状态已更新');
      queryClient.invalidateQueries({ queryKey: ['subscribed-strategies'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '更新失败');
    },
  });

  // 处理平仓
  const handleClosePosition = (positionId: string | number) => {
    const activeApiKey = apiKeys?.find(k => k.isActive);
    if (!activeApiKey) {
      toast.error('请先绑定交易所API Key');
      return;
    }
    closePositionMutation.mutate({
      positionId: String(positionId),
      apiKeyId: activeApiKey.id
    });
  };

  // 处理紧急清仓
  const handleEmergencyCloseAll = () => {
    const activeApiKey = apiKeys?.find(k => k.isActive);
    if (!activeApiKey) {
      toast.error('请先绑定交易所API Key');
      return;
    }
    if (window.confirm('确定要紧急清仓所有持仓吗？此操作不可撤销！')) {
      emergencyCloseAllMutation.mutate(activeApiKey.id);
    }
  };

  // 处理编辑策略
  const handleEditStrategy = (strategyId: string) => {
    router.push(`/strategies/${strategyId}/config`);
  };

  // 处理删除策略
  const handleDeleteStrategy = (strategyId: string) => {
    if (window.confirm('确定要取消订阅此策略吗？')) {
      deleteStrategyMutation.mutate(strategyId);
    }
  };

  // 处理切换策略状态
  const handleToggleStrategy = (strategyId: string, status: 'running' | 'paused') => {
    // 找到对应的订阅ID
    const strategies = Array.isArray(subscribedStrategies) ? subscribedStrategies : [];
    const subscription = strategies.find(s => s.strategyId === strategyId);
    if (subscription) {
      toggleStrategyMutation.mutate({
        subscriptionId: subscription.id,
        isActive: status === 'running',
      });
    }
  };

  // 处理浏览策略市场
  const handleViewMarket = () => {
    router.push('/strategies');
  };

  // 转换持仓数据格式
  const transformedPositions = positionsData?.items?.map(p => ({
    id: p.id,
    symbol: p.symbol,
    direction: p.side as 'long' | 'short',
    size: parseFloat(p.amount),
    entryPrice: parseFloat(p.entryPrice),
    markPrice: parseFloat(p.entryPrice), // 需要实时价格
    liquidationPrice: 0,
    unrealizedPnl: parseFloat(p.pnl || '0'),
    roe: 0,
    icon: p.symbol.startsWith('BTC') ? '₿' : p.symbol.startsWith('ETH') ? 'Ξ' : '◎',
    strategy: p.strategyName || '手动交易',
    stopLoss: 0,
    takeProfit: 0,
    marketType: 'futures' as const,
  }));

  // 转换交易历史数据格式
  const transformedHistory = historyData?.items?.map(h => ({
    id: h.id,
    symbol: h.symbol,
    side: h.side as 'buy' | 'sell',
    type: h.type,
    price: parseFloat(h.price),
    amount: parseFloat(h.amount),
    filled: parseFloat(h.amount),
    total: parseFloat(h.total),
    pnl: parseFloat(h.pnl),
    fee: parseFloat(h.fee),
    time: h.closedAt,
    status: h.status as 'filled' | 'cancelled',
    marketType: 'futures' as const,
  }));

  // 转换执行日志数据格式
  const transformedLogs = logsData?.map(log => ({
    id: log.id,
    time: new Date(log.time).toLocaleString(),
    strategy: log.strategy,
    action: log.action,
    symbol: log.symbol,
    status: log.status,
    message: log.message,
    marketType: 'futures' as const,
  }));

  // 转换订阅的策略数据格式
  const strategiesArray = Array.isArray(subscribedStrategies) ? subscribedStrategies : [];
  const transformedStrategies = strategiesArray.map(s => ({
    id: s.strategyId,
    subscriptionId: s.id,
    name: s.strategy?.name || '未知策略',
    description: s.strategy?.description || '',
    status: (s.isActive ? 'running' : 'paused') as 'running' | 'paused' | 'stopped',
    type: 'system' as const,
    marketType: (s.tradingType || 'futures') as 'spot' | 'futures',
    exchange: 'Binance',
    tradingPairs: s.tradingPairs || [],
    createdAt: s.createdAt,
    lastModified: s.createdAt,
    config: {
      leverage: s.leverage || 1,
      positionSize: `${s.amountPerTrade || 0}`,
      stopLoss: parseFloat(s.stopLossPercent || '0'),
      takeProfit: parseFloat(s.takeProfitPercent || '0'),
    },
  }));

  // 构建API Keys账户列表（使用真实余额）
  const accounts = apiKeys?.map((k, index) => {
    const balanceData = apiKeyBalanceQueries[index]?.data;
    return {
      id: k.id,
      name: `${k.exchange} - ${k.label}`,
      balance: balanceData?.totalUsdValue || 0,
    };
  }) || [];

  // 计算资产统计
  const totalAssets = parseFloat(walletBalance?.usdtBalance || '0');
  const availableBalance = totalAssets;
  const totalPnl = parseFloat(pnlStats?.totalPnl || '0');
  const todayPnl = parseFloat(pnlStats?.todayPnl || '0');
  const unrealizedPnl = parseFloat(pnlStats?.unrealizedPnl || '0');

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <PositionsPageV3
          positions={transformedPositions}
          historyOrders={transformedHistory}
          executionLogs={transformedLogs}
          myStrategies={transformedStrategies}
          accounts={accounts}
          pnlStats={{
            totalAssets,
            availableBalance,
            totalPnl,
            todayPnl,
            unrealizedPnl,
          }}
          isLoading={positionsLoading}
          onClosePosition={handleClosePosition}
          onEmergencyCloseAll={handleEmergencyCloseAll}
          onEditStrategy={handleEditStrategy}
          onDeleteStrategy={handleDeleteStrategy}
          onToggleStrategy={handleToggleStrategy}
          onViewMarket={handleViewMarket}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileTradingCenter
          positions={transformedPositions}
          historyOrders={transformedHistory}
          executionLogs={transformedLogs}
          myStrategies={transformedStrategies}
          accounts={accounts}
          pnlStats={{
            totalAssets,
            availableBalance,
            totalPnl,
            todayPnl,
            unrealizedPnl,
          }}
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
