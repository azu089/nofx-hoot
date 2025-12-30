'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Server,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Settings,
  BarChart3,
  Gift,
  ChevronRight,
  RefreshCcw,
  Clock,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
} from 'lucide-react';

// 导入 API 客户端
import { walletApi, billingApi, instancesApi, tradingApi, strategiesApi } from '@/lib/api';

interface DashboardData {
  wallet: {
    usdt_balance: string;
    point_balance: string;
    staked_amount: string;
  } | null;
  todayPnL: {
    todayPnl: string;
    todayProfit: string;
    todayLoss: string;
    todayTrades: number;
    todayWinRate: string;
    todayGasFee: string;
  } | null;
  instances: Array<{
    id: string;
    status: string;
    ip_address: string;
    last_heartbeat: string | null;
  }>;
  activeStrategies: Array<{
    id: string;
    name: string;
    status: 'running' | 'paused';
    todayProfit: number;
    totalProfit: number;
  }>;
  recentTrades: Array<{
    id: string;
    strategyName: string;
    pair: string;
    side: 'buy' | 'sell';
    amount: number;
    price: number;
    profit: number | null;
    time: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    type: 'info' | 'warning' | 'success';
    time: string;
  }>;
}

// Utility functions
function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    wallet: null,
    todayPnL: null,
    instances: [],
    activeStrategies: [],
    recentTrades: [],
    announcements: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock 数据作为 fallback
  const getMockData = (): DashboardData => ({
    wallet: {
      usdt_balance: '10000.00',
      point_balance: '5000',
      staked_amount: '2000.00',
    },
    todayPnL: {
      todayPnl: '150.50',
      todayProfit: '200.00',
      todayLoss: '49.50',
      todayTrades: 12,
      todayWinRate: '0.75',
      todayGasFee: '30.10',
    },
    instances: [
      { id: '1', status: 'running', ip_address: '192.168.1.100', last_heartbeat: new Date().toISOString() },
      { id: '2', status: 'provisioning', ip_address: '', last_heartbeat: null },
    ],
    activeStrategies: [
      { id: '1', name: '趋势追踪 Pro', status: 'running', todayProfit: 85.50, totalProfit: 1234.56 },
      { id: '2', name: 'AI 量化狙击', status: 'running', todayProfit: 45.00, totalProfit: 567.89 },
      { id: '3', name: '网格套利者', status: 'paused', todayProfit: 0, totalProfit: 234.56 },
    ],
    recentTrades: [
      { id: '1', strategyName: '趋势追踪 Pro', pair: 'BTC/USDT', side: 'buy', amount: 0.01, price: 43250, profit: null, time: new Date().toISOString() },
      { id: '2', strategyName: '趋势追踪 Pro', pair: 'BTC/USDT', side: 'sell', amount: 0.01, price: 43450, profit: 20, time: new Date(Date.now() - 3600000).toISOString() },
      { id: '3', strategyName: 'AI 量化狙击', pair: 'ETH/USDT', side: 'buy', amount: 0.5, price: 2280, profit: null, time: new Date(Date.now() - 7200000).toISOString() },
      { id: '4', strategyName: '网格套利者', pair: 'SOL/USDT', side: 'sell', amount: 10, price: 105.5, profit: 15.5, time: new Date(Date.now() - 10800000).toISOString() },
    ],
    announcements: [
      { id: '1', title: '新策略「动量突破 v2」已上线', type: 'success', time: '2024-01-15' },
      { id: '2', title: '系统维护通知：1月20日 02:00-04:00', type: 'warning', time: '2024-01-14' },
      { id: '3', title: '春节活动：充值返 10% 积分', type: 'info', time: '2024-01-13' },
    ],
  });

  const fetchData = async () => {
    try {
      setError(null);

      // 并行调用所有 API
      const [walletRes, pnlRes, instancesRes, strategiesRes, tradesRes] = await Promise.all([
        walletApi.getBalance().catch(() => null),
        billingApi.getTodayPnL().catch(() => null),
        instancesApi.list().catch(() => null),
        strategiesApi.getMyStrategies().catch(() => null),
        tradingApi.getTrades(10).catch(() => null),
      ]);

      // 处理钱包数据（需要添加 staked_amount）
      const walletData = walletRes?.data
        ? {
            usdt_balance: walletRes.data.usdt_balance,
            point_balance: walletRes.data.point_balance,
            staked_amount: '0.00', // TODO: 后端需要添加质押金额字段
          }
        : null;

      // 处理策略数据（转换为 Dashboard 格式）
      const activeStrategies =
        strategiesRes?.data?.map((s) => ({
          id: s.id,
          name: s.strategy_name,
          status: s.status as 'running' | 'paused',
          todayProfit: 0, // TODO: 后端需要返回今日盈利
          totalProfit: parseFloat(s.total_pnl || '0'),
        })) || [];

      // 处理交易数据（转换为 Dashboard 格式）
      const recentTrades =
        tradesRes?.data?.map((t) => ({
          id: t.id,
          strategyName: '', // TODO: 后端需要返回策略名称
          pair: t.symbol,
          side: t.side as 'buy' | 'sell',
          amount: parseFloat(t.size),
          price: parseFloat(t.price),
          profit: parseFloat(t.pnl),
          time: t.executed_at,
        })) || [];

      // Mock 公告数据（后续可接入真实 API）
      const announcements = [
        { id: '1', title: '新策略「动量突破 v2」已上线', type: 'success' as const, time: '2024-01-15' },
        { id: '2', title: '系统维护通知：1月20日 02:00-04:00', type: 'warning' as const, time: '2024-01-14' },
        { id: '3', title: '春节活动：充值返 10% 积分', type: 'info' as const, time: '2024-01-13' },
      ];

      setData({
        wallet: walletData,
        todayPnL: pnlRes?.data || null,
        instances: instancesRes?.data || [],
        activeStrategies,
        recentTrades,
        announcements,
      });

      console.log('✅ Dashboard 数据加载成功', {
        wallet: !!walletData,
        todayPnL: !!pnlRes?.data,
        instances: instancesRes?.data?.length || 0,
        strategies: activeStrategies.length,
        trades: recentTrades.length,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载数据失败';
      setError(errorMsg);
      console.error('❌ Dashboard 数据加载失败，使用 Mock 数据', err);

      // 使用 Mock 数据作为 fallback
      setData(getMockData());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const runningInstances = data.instances.filter(
    (i) => i.status === 'running' || i.status === 'provisioning'
  ).length;

  const pnlValue = parseFloat(data.todayPnL?.todayPnl || '0');
  const isProfitable = pnlValue >= 0;

  const totalAssets = parseFloat(data.wallet?.usdt_balance || '0') + parseFloat(data.wallet?.staked_amount || '0');

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">仪表盘</h1>
          <p className="text-muted-foreground text-sm">
            欢迎回来，祝您交易顺利
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <p className="text-muted-foreground text-sm">
            {formatDateTime(new Date())}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">API 连接失败</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {error} - 当前显示模拟数据，请稍后重试
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Announcements */}
      {data.announcements.length > 0 && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-primary" />
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-4">
                  {data.announcements.slice(0, 1).map((ann) => (
                    <span key={ann.id} className="text-sm truncate">
                      {ann.title}
                    </span>
                  ))}
                </div>
              </div>
              <Link href="/help" className="text-sm text-primary hover:underline flex items-center gap-1">
                查看全部 <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/wallet/deposit">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-green-500" />
              </div>
              <span className="font-medium">充值</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/wallet/withdraw">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-blue-500" />
              </div>
              <span className="font-medium">提现</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/strategies">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5 text-purple-500" />
              </div>
              <span className="font-medium">订阅策略</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/wallet/api-keys">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-yellow-500" />
              </div>
              <span className="font-medium">API 管理</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Assets */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">总资产</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(totalAssets)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  可用: {formatCurrency(data.wallet?.usdt_balance || '0')}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's PnL */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">今日盈亏</p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    isProfitable ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {isProfitable ? '+' : ''}
                  {formatCurrency(data.todayPnL?.todayPnl || '0')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  胜率: {formatPercent(parseFloat(data.todayPnL?.todayWinRate || '0') * 100, 0)}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isProfitable ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}
              >
                {isProfitable ? (
                  <TrendingUp className="w-6 h-6 text-green-500" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Running Strategies */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">运行策略</p>
                <p className="text-2xl font-bold mt-1">
                  {data.activeStrategies.filter(s => s.status === 'running').length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  共 {data.activeStrategies.length} 个订阅
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Trades */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">今日交易</p>
                <p className="text-2xl font-bold mt-1">
                  {data.todayPnL?.todayTrades || 0} 笔
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gas费: {formatCurrency(data.todayPnL?.todayGasFee || '0')}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Strategies */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              运行中策略
            </CardTitle>
            <Link href="/strategies/subscribed">
              <Button variant="ghost" size="sm">
                查看全部 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.activeStrategies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无运行中策略</p>
                <Link href="/strategies">
                  <Button className="mt-4">浏览策略市场</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.activeStrategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        strategy.status === 'running' ? 'bg-green-500/20' : 'bg-yellow-500/20'
                      }`}>
                        {strategy.status === 'running' ? (
                          <Play className="w-4 h-4 text-green-500" />
                        ) : (
                          <Pause className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{strategy.name}</p>
                        <p className="text-xs text-muted-foreground">
                          总收益: <span className="text-green-500">+{formatCurrency(strategy.totalProfit)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium text-sm ${
                        strategy.todayProfit >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {strategy.todayProfit >= 0 ? '+' : ''}{formatCurrency(strategy.todayProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground">今日</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              资产分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm">可用余额</span>
                </div>
                <span className="font-medium">{formatCurrency(data.wallet?.usdt_balance || '0')}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">质押中</span>
                </div>
                <span className="font-medium">{formatCurrency(data.wallet?.staked_amount || '0')}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm">积分</span>
                </div>
                <span className="font-medium">{parseInt(data.wallet?.point_balance || '0').toLocaleString()}</span>
              </div>

              {/* Simple bar chart */}
              <div className="h-4 bg-muted rounded-full overflow-hidden flex mt-4">
                <div
                  className="bg-primary h-full"
                  style={{ width: `${(parseFloat(data.wallet?.usdt_balance || '0') / totalAssets) * 100}%` }}
                />
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${(parseFloat(data.wallet?.staked_amount || '0') / totalAssets) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades & VPS Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trades */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              最近交易
            </CardTitle>
            <Link href="/trading/history">
              <Button variant="ghost" size="sm">
                查看全部 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentTrades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无交易记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentTrades.slice(0, 4).map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        trade.side === 'buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {trade.side === 'buy' ? (
                          <ArrowDownLeft className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{trade.pair}</p>
                        <p className="text-xs text-muted-foreground">
                          {trade.strategyName} • {formatTime(trade.time)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        {trade.amount} @ {trade.price}
                      </p>
                      {trade.profit !== null && (
                        <p className={`text-xs ${trade.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.profit >= 0 ? '+' : ''}{formatCurrency(trade.profit)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* VPS Instance Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              VPS 实例
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">{runningInstances} 运行中</span>
            </div>
          </CardHeader>
          <CardContent>
            {data.instances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无 VPS 实例</p>
                <p className="text-sm mt-1">订阅策略后自动创建</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.instances.map((instance) => (
                  <div
                    key={instance.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          instance.status === 'running'
                            ? 'bg-green-500'
                            : instance.status === 'provisioning'
                            ? 'bg-yellow-500 animate-pulse'
                            : 'bg-muted-foreground'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {instance.ip_address || '分配中...'}
                        </p>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {instance.last_heartbeat
                            ? formatDateTime(instance.last_heartbeat)
                            : '等待心跳'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        instance.status === 'running'
                          ? 'bg-green-500/20 text-green-500'
                          : instance.status === 'provisioning'
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {instance.status === 'running'
                        ? '运行中'
                        : instance.status === 'provisioning'
                        ? '创建中'
                        : instance.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
