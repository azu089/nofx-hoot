'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PositionsPageV3 } from '@/components/ui-v3/positions/positions-page-v3';
import { MobileTradingCenter } from '@/components/ui-v3/mobile/mobile-trading-center';
import { toast } from 'sonner';
import {
  usePositionSocket,
  type PositionUpdateEvent,
  type TradeExecutionEvent,
} from '@/hooks/useSocket';

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
  /** 交易所原始保证金比率（%字符串），如 "5.23" 表示 5.23% */
  marginRatio?: string;
  unrealizedPnl: string;
  roe: string;
  status: string;
  tradingType: string;
  strategyName?: string;
  source?: string;
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
  source?: string;
  createdAt: string;
  // 交易配置
  tradingType?: string;
  leverage?: number;
  margin?: string;
  marginMode?: string;
  marginRatio?: string;  // 交易所原始保证金比率（%字符串）
  // 止盈止损（后端 Position 模型字段）
  stopLossPrice?: string;
  takeProfitPrice?: string;
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
  source?: string;
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
  // 执行参数
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  blockedBy?: string;
  blockReason?: string;
  // AI 决策详情
  confidence?: number;
  positionSizePercent?: number;
  reasoning?: string;
  votes?: Array<{ modelId: string; action: string; confidence: number; reasoning?: string }>;
  // Grid 专属
  gridSummary?: string;
  gridBuyRange?: string;
  gridSellRange?: string;
  gridOrderCount?: number;
  // 策略类型标识
  strategyType?: 'research' | 'solo' | 'debate' | 'grid' | 'signal';
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

  // WebSocket: 持仓实时更新 + 交易执行反馈
  const handlePositionUpdate = useCallback(
    (_event: PositionUpdateEvent) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['synced-positions'] });
      queryClient.invalidateQueries({ queryKey: ['pnl-stats'] });
    },
    [queryClient],
  );

  const handleTradeExecution = useCallback(
    (event: TradeExecutionEvent) => {
      if (event.status === 'success') {
        toast.success(event.message || '交易执行成功');
      } else if (event.status === 'failed') {
        toast.error(event.message || '交易执行失败');
      }
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['synced-positions'] });
      queryClient.invalidateQueries({ queryKey: ['trade-history'] });
      queryClient.invalidateQueries({ queryKey: ['execution-logs'] });
      queryClient.invalidateQueries({ queryKey: ['pnl-stats'] });
    },
    [queryClient],
  );

  usePositionSocket(isAuthenticated, {
    onPositionUpdate: handlePositionUpdate,
    onTradeExecution: handleTradeExecution,
  });

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
    refetchInterval: 15000, // 每15秒自动刷新（兜底，WebSocket 实时推送为主）
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
    freeUsdValue?: number;
    spotFreeValue?: number;
    futuresFreeValue?: number;
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
          return { valid: false, totalUsdValue: 0, spotValue: 0, futuresValue: 0, freeUsdValue: 0, spotFreeValue: 0, futuresFreeValue: 0 };
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
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : '平仓失败';
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
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
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : '紧急清仓失败';
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
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
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : '取消订阅失败';
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
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
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : '更新失败';
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
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

  // 确认弹窗 state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'emergency_close' | 'unsubscribe';
    payload?: string;
  } | null>(null);

  // 处理紧急清仓
  const handleEmergencyCloseAll = () => {
    const activeApiKey = apiKeys?.find(k => k.isActive);
    if (!activeApiKey) {
      toast.error('请先绑定交易所API Key');
      return;
    }
    setConfirmAction({ type: 'emergency_close', payload: activeApiKey.id });
  };

  const executeConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'emergency_close' && confirmAction.payload) {
      emergencyCloseAllMutation.mutate(confirmAction.payload);
    } else if (confirmAction.type === 'unsubscribe' && confirmAction.payload) {
      deleteStrategyMutation.mutate(confirmAction.payload);
    }
    setConfirmAction(null);
  };

  // 处理编辑策略
  const handleEditStrategy = (strategyId: string) => {
    router.push(`/strategies/${strategyId}/config`);
  };

  // 处理删除策略
  const handleDeleteStrategy = (strategyId: string) => {
    setConfirmAction({ type: 'unsubscribe', payload: strategyId });
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
          strategy: p.strategyName || '',
          stopLoss: 0, // 交易所同步数据无独立 SL/TP 字段
          takeProfit: 0,
          marketType: (p.tradingType === 'spot' ? 'spot' : 'futures') as 'spot' | 'futures',
          leverage: p.leverage || 1,
          margin: parseFloat(p.margin || '0'),
          marginMode: p.marginMode || 'cross',
          marginRatio: p.marginRatio,  // 直接传递交易所原始值，不重算
          syncSource: p.syncSource, // 标记数据来源
          source: p.source,
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
          strategy: p.strategyName || '',
          stopLoss: parseFloat(p.stopLossPrice || '0'),
          takeProfit: parseFloat(p.takeProfitPrice || '0'),
          marketType: (p.tradingType === 'spot' ? 'spot' : 'futures') as 'spot' | 'futures',
          leverage: p.leverage || 1,
          margin: parseFloat(p.margin || '0'),
          marginMode: p.marginMode || 'cross',
          source: p.source,
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
    source: h.source,
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
    // 执行参数（AI 决策详情已在 AI 交易页面展示，此处只保留执行层面）
    leverage: log.leverage,
    stopLoss: log.stopLoss,
    takeProfit: log.takeProfit,
    blockedBy: log.blockedBy,
    blockReason: log.blockReason,
    // AI 决策详情
    confidence: log.confidence,
    positionSizePercent: log.positionSizePercent,
    reasoning: log.reasoning,
    votes: log.votes,
    // 策略类型标识
    strategyType: log.strategyType,
    // Grid 专属
    gridSummary: log.gridSummary,
    gridBuyRange: log.gridBuyRange,
    gridSellRange: log.gridSellRange,
    gridOrderCount: log.gridOrderCount,
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
      freeBalance: balanceData?.freeUsdValue ?? balanceData?.totalUsdValue ?? 0,
      spotFreeValue: balanceData?.spotFreeValue ?? balanceData?.spotValue ?? 0,
      futuresFreeValue: balanceData?.futuresFreeValue ?? balanceData?.futuresValue ?? 0,
    };
  }) || [];

  // 获取当前选中账户的余额数据
  const selectedAccount = accounts[selectedAccountIndex] || { balance: 0, spotValue: 0, futuresValue: 0, freeBalance: 0, spotFreeValue: 0, futuresFreeValue: 0 };

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
  // 可用余额 = 交易所返回的 free 值（扣除持仓保证金）
  const availableBalance = (() => {
    switch (accountTypeFilter) {
      case 'spot': return selectedAccount.spotFreeValue;
      case 'futures': return selectedAccount.futuresFreeValue;
      default: return selectedAccount.freeBalance;
    }
  })();
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

      {/* 确认弹窗 */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className={`text-lg font-semibold mb-2 ${confirmAction.type === 'emergency_close' ? 'text-red-400' : 'text-white'}`}>
              {confirmAction.type === 'emergency_close' ? '⚠️ 紧急清仓确认' : '取消订阅确认'}
            </h3>
            <p className="text-[#9090A0] text-sm mb-6">
              {confirmAction.type === 'emergency_close'
                ? '确定要紧急清仓所有持仓吗？此操作不可撤销！'
                : '确定要取消订阅此策略吗？'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 bg-[#1A1A24] text-[#9090A0] rounded-lg text-sm font-medium hover:bg-[#22222E] transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeConfirmAction}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  confirmAction.type === 'emergency_close'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                }`}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
