'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PositionsPageV3 } from '@/components/ui-v3/positions/positions-page-v3';
import { MobileTradingCenter } from '@/components/ui-v3/mobile/mobile-trading-center';
import { toast } from 'sonner';

// 同步后的持仓数据类型
interface SyncedPosition {
  id: string;
  symbol: string;
  side: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  amount: string;
  notionalValue: string;
  margin: string;
  leverage: number;
  marginMode: string;
  unrealizedPnl: string;
  roe: string;
  status: string;
  tradingType: string;
  strategyName?: string;
  createdAt: string;
  syncedAt: string;
  syncSource: 'exchange' | 'database';
}

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
  // 交易配置（新增）
  tradingType?: string;
  leverage?: number;
  margin?: string;
  marginMode?: string;
}

// 交易历史类型
interface TradeHistory {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: string;
  entryPrice?: string;
  closePrice?: string;
  amount: string;
  total: string;
  pnl: string;
  pnlPercent?: string;
  fee: string;
  status: string;
  closedAt: string;
  createdAt: string;
  // 交易配置
  tradingType?: string;
  leverage?: number;
  margin?: string;
  marginMode?: string;
  closeReason?: string;
  strategyName?: string;
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
  // 增强字段
  orderId?: string;
  executedPrice?: string;
  executedAmount?: string;
  slippage?: string;
  durationMs?: number;
  errorCode?: string;
  skipReason?: string;
}

// 策略健康状态类型
interface StrategyHealth {
  strategyId: string;
  strategyName: string;
  isOnline: boolean;
  lastSignalAt?: string;
  minutesSinceLastSignal?: number;
  todaySignals: number;
  status: 'healthy' | 'degraded' | 'warning' | 'offline';
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

  // 当前选中的API Key ID
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | null>(null);

  // 获取持仓数据（基础数据）
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

  // 同步持仓数据（从交易所获取实时数据）
  const { data: syncedPositions, refetch: refetchSyncedPositions } = useQuery({
    queryKey: ['synced-positions', selectedApiKeyId],
    queryFn: async () => {
      if (!selectedApiKeyId) return null;
      const response = await api.get<SyncedPosition[]>(
        `/trading/positions/synced?apiKeyId=${selectedApiKeyId}`
      );
      return response.data;
    },
    enabled: isAuthenticated && !!selectedApiKeyId,
    refetchInterval: 30000, // 每30秒自动刷新
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

  // 获取策略健康状态
  const { data: strategyHealthData } = useQuery({
    queryKey: ['strategy-health'],
    queryFn: async () => {
      const response = await api.get<{ strategies: StrategyHealth[] }>('/signals/strategy-health');
      return response.data.strategies;
    },
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 60000, // 每分钟刷新
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
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const response = await api.get<WalletBalance>('/wallet/balance');
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
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

  // API Key 余额数据类型（包含现货/合约分开的余额）
  interface ApiKeyBalanceData {
    valid: boolean;
    totalUsdValue: number;
    spotValue: number;
    futuresValue: number;
    error?: string;
  }

  // 获取每个 API Key 的余额（复用 API 页面的缓存数据）
  const apiKeyBalanceQueries = useQueries({
    queries: (apiKeys || []).map((key) => ({
      queryKey: ['api-key-balance', key.id],
      queryFn: async (): Promise<ApiKeyBalanceData> => {
        try {
          const response = await api.get<ApiKeyBalanceData>(`/api-keys/${key.id}/verify`);
          return response.data;
        } catch (e) {
          return { valid: false, totalUsdValue: 0, spotValue: 0, futuresValue: 0 };
        }
      },
      enabled: isAuthenticated && !!key.id,
      staleTime: 30 * 1000, // 30秒缓存，与 API 页面共享
      retry: false,
    })),
  });

  // 当前选中的账户索引
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  // 账户类型筛选：全部/现货/合约
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'spot' | 'futures'>('all');

  // 当 API Keys 加载完成后，自动选择第一个活跃的 API Key 用于同步
  useEffect(() => {
    if (apiKeys && apiKeys.length > 0 && !selectedApiKeyId) {
      const activeKey = apiKeys.find(k => k.isActive) || apiKeys[0];
      setSelectedApiKeyId(activeKey.id);
    }
  }, [apiKeys, selectedApiKeyId]);

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

  // 标准化交易对名称：去掉 :USDT 后缀，保持 SOL/USDT 格式
  const normalizeSymbol = (symbol: string): string => {
    // 去掉 :USDT 后缀
    return symbol.replace(':USDT', '').replace(':USDC', '');
  };

  // 转换持仓数据格式（优先使用同步数据）
  const transformedPositions = (syncedPositions && syncedPositions.length > 0)
    ? syncedPositions.map(p => {
        const symbol = normalizeSymbol(p.symbol);
        return {
          id: p.id,
          symbol,
          direction: p.side as 'long' | 'short',
          size: parseFloat(p.amount),
          entryPrice: parseFloat(p.entryPrice),
          markPrice: parseFloat(p.markPrice), // 使用实时标记价格
          liquidationPrice: parseFloat(p.liquidationPrice), // 强平价格
          unrealizedPnl: parseFloat(p.unrealizedPnl),
          roe: parseFloat(p.roe), // 收益率
          icon: symbol.startsWith('BTC') ? '₿' : symbol.startsWith('ETH') ? 'Ξ' : symbol.startsWith('SOL') ? '◎' : '○',
          strategy: p.strategyName || '手动交易',
          stopLoss: 0, // TODO: 从订阅配置获取
          takeProfit: 0,
          marketType: (p.tradingType === 'spot' ? 'spot' : 'futures') as 'spot' | 'futures',
          leverage: p.leverage || 1,
          margin: parseFloat(p.margin || '0'),
          marginMode: p.marginMode || 'cross',
          syncSource: p.syncSource, // 标记数据来源
        };
      })
    : positionsData?.items?.map(p => {
        const symbol = normalizeSymbol(p.symbol);
        return {
          id: p.id,
          symbol,
          direction: p.side as 'long' | 'short',
          size: parseFloat(p.amount),
          entryPrice: parseFloat(p.entryPrice),
          markPrice: parseFloat(p.entryPrice), // 没有同步时使用入场价
          liquidationPrice: 0,
          unrealizedPnl: parseFloat(p.pnl || '0'),
          roe: 0,
          icon: symbol.startsWith('BTC') ? '₿' : symbol.startsWith('ETH') ? 'Ξ' : symbol.startsWith('SOL') ? '◎' : '○',
          strategy: p.strategyName || '手动交易',
          stopLoss: 0,
          takeProfit: 0,
          marketType: (p.tradingType === 'spot' ? 'spot' : 'futures') as 'spot' | 'futures',
          leverage: p.leverage || 1,
          margin: parseFloat(p.margin || '0'),
          marginMode: p.marginMode || 'cross',
        };
      });

  // 转换交易历史数据格式
  const transformedHistory = historyData?.items?.map(h => ({
    id: h.id,
    symbol: normalizeSymbol(h.symbol),
    side: h.side as 'long' | 'short',
    type: h.type,
    price: parseFloat(h.closePrice || h.price),
    entryPrice: parseFloat(h.entryPrice || h.price),
    closePrice: parseFloat(h.closePrice || h.price),
    amount: parseFloat(h.amount),
    filled: parseFloat(h.amount),
    total: parseFloat(h.total),
    pnl: parseFloat(h.pnl),
    pnlPercent: parseFloat(h.pnlPercent || '0'),
    fee: parseFloat(h.fee),
    time: h.closedAt,
    status: h.status as 'filled' | 'cancelled',
    marketType: (h.tradingType === 'spot' ? 'spot' : 'futures') as 'spot' | 'futures',
    leverage: h.leverage || 1,
    margin: parseFloat(h.margin || '0'),
    closeReason: h.closeReason,
    strategyName: h.strategyName,
    openTime: h.createdAt,
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
    // 增强字段
    orderId: log.orderId,
    executedPrice: log.executedPrice,
    executedAmount: log.executedAmount,
    slippage: log.slippage,
    durationMs: log.durationMs,
    errorCode: log.errorCode,
    skipReason: log.skipReason,
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
      amountPerTrade: parseFloat(s.amountPerTrade || '0'),
    },
  }));

  // 构建API Keys账户列表（使用真实余额，包含现货/合约分开的数据）
  const accounts = apiKeys?.map((k, index) => {
    const balanceData = apiKeyBalanceQueries[index]?.data as ApiKeyBalanceData | undefined;
    return {
      id: k.id,
      name: `${k.exchange} - ${k.label}`,
      balance: balanceData?.totalUsdValue || 0,
      spotValue: balanceData?.spotValue || 0,
      futuresValue: balanceData?.futuresValue || 0,
    };
  }) || [];

  // 获取当前选中账户的余额数据
  const selectedAccount = accounts[selectedAccountIndex] || { balance: 0, spotValue: 0, futuresValue: 0 };

  // 根据账户类型筛选计算资产
  // accountTypeFilter: 'all' | 'spot' | 'futures'
  const getFilteredAssets = () => {
    switch (accountTypeFilter) {
      case 'spot':
        return selectedAccount.spotValue;
      case 'futures':
        return selectedAccount.futuresValue;
      case 'all':
      default:
        return selectedAccount.balance;
    }
  };

  // 计算资产统计（使用选中交易所账户的余额）
  const totalAssets = getFilteredAssets();
  const availableBalance = totalAssets; // 可用余额暂时等于总资产
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
          strategyHealth={strategyHealthData}
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
          strategyHealth={strategyHealthData}
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
