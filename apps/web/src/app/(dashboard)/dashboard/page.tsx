'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { billingApi, instancesApi, userApi, tradingApi, strategiesApi } from '@/lib/api';
import { formatCurrency, formatPercent, formatDateTime } from '@/lib/utils';
import { PnLChart } from '@/components/charts';
import { AnnouncementBanner } from '@/components/features/dashboard';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Server,
  Activity,
  RefreshCw,
  Play,
  Pause,
  Bot,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Zap,
  History,
  Settings,
  ChevronRight,
  Cpu,
  HardDrive,
} from 'lucide-react';

interface DashboardData {
  wallet: {
    usdt_balance: string;
    points_balance: string;
  } | null;
  todayPnL: {
    todayPnl: string;
    todayProfit: string;
    todayLoss: string;
    todayTrades: number;
    todayWinRate: string;
    todayGasFee: string;
  } | null;
  pnlCurve: Array<{
    date: string;
    pnl: number;
    cumulative: number;
  }>;
  instances: Array<{
    id: string;
    status: string;
    ip_address: string;
    last_heartbeat: string | null;
    cpu_usage?: string | number | null;
    memory_usage?: string | number | null;
    region?: string;
  }>;
  botStatus: {
    running: boolean;
    strategy_id?: string;
    strategy_name?: string;
    uptime?: number;
    trades_today?: number;
  } | null;
  positions: Array<{
    id: string;
    symbol: string;
    side: string;
    size: string;
    entry_price: string;
    current_price: string;
    unrealized_pnl: string;
    leverage: number;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({
    wallet: null,
    todayPnL: null,
    pnlCurve: [],
    instances: [],
    botStatus: null,
    positions: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<7 | 30 | 90>(30);

  const fetchData = async () => {
    try {
      const [
        walletRes,
        pnlRes,
        curveRes,
        instancesRes,
        botStatusRes,
        positionsRes,
      ] = await Promise.all([
        userApi.getWallet().catch(() => ({ data: null })),
        billingApi.getTodayPnL().catch(() => ({ data: null })),
        billingApi.getPnLCurve(chartPeriod).catch(() => ({ data: null })),
        instancesApi.list().catch(() => ({ data: [] })),
        tradingApi.getBotStatus().catch(() => ({ data: null })),
        tradingApi.getPositions().catch(() => ({ data: [] })),
      ]);

      // 转换曲线数据格式
      const curveData = curveRes.data?.curve?.map((item: { date: string; pnl: string; cumulativePnl: string }) => ({
        date: item.date,
        pnl: parseFloat(item.pnl) || 0,
        cumulative: parseFloat(item.cumulativePnl) || 0,
      })) || [];

      setData({
        wallet: walletRes.data,
        todayPnL: pnlRes.data,
        pnlCurve: curveData,
        instances: instancesRes.data || [],
        botStatus: botStatusRes.data,
        positions: positionsRes.data || [],
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [chartPeriod]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // 机器人控制
  const handleBotAction = async (action: 'start' | 'stop') => {
    try {
      if (action === 'start') {
        router.push('/strategies');
      } else {
        await tradingApi.stopBot();
        fetchData();
      }
    } catch (error) {
      console.error(`Failed to ${action} bot:`, error);
    }
  };

  const runningInstances = data.instances.filter(
    (i) => i.status === 'running' || i.status === 'provisioning'
  );
  const runningInstance = runningInstances[0];

  const pnlValue = parseFloat(data.todayPnL?.todayPnl || '0');
  const isProfitable = pnlValue >= 0;
  const totalBalance = parseFloat(data.wallet?.usdt_balance || '0');

  // 计算总资产盈亏比例（假设根据今日盈亏）
  const pnlPercent = totalBalance > 0 ? (pnlValue / totalBalance) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">仪表盘</h1>
        {/* Hero 骨架屏 */}
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-32 bg-bg-tertiary rounded-xl" />
          </CardContent>
        </Card>
        {/* 曲线骨架屏 */}
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-64 bg-bg-tertiary rounded-xl" />
          </CardContent>
        </Card>
        {/* 其他骨架 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-bg-tertiary rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 公告跑马灯 */}
      <AnnouncementBanner />

      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">仪表盘</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Hero 资产卡片 - 合并总资产、今日盈亏、点卡 */}
      <Card variant="glass" className="glow-border glow-border-primary overflow-hidden">
        <CardContent className="p-0">
          {/* 渐变背景 */}
          <div className="bg-gradient-to-br from-brand-primary/20 via-bg-secondary to-brand-secondary/10 p-6">
            {/* 总资产 */}
            <div className="mb-6">
              <p className="text-text-secondary text-sm mb-1">总资产</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl md:text-5xl font-bold text-white font-mono tracking-tight">
                  {formatCurrency(data.wallet?.usdt_balance || '0')}
                </span>
              </div>
            </div>

            {/* 今日盈亏 + 点卡 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* 今日盈亏 */}
              <div className={`p-4 rounded-xl ${isProfitable ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'}`}>
                <p className="text-text-secondary text-xs mb-1">今日盈亏</p>
                <div className="flex items-center gap-2">
                  {isProfitable ? (
                    <ArrowUp className="w-5 h-5 text-success" />
                  ) : (
                    <ArrowDown className="w-5 h-5 text-danger" />
                  )}
                  <span className={`text-xl md:text-2xl font-bold font-mono ${isProfitable ? 'text-success' : 'text-danger'}`}>
                    {isProfitable ? '+' : ''}{formatCurrency(data.todayPnL?.todayPnl || '0')}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${isProfitable ? 'text-success/80' : 'text-danger/80'}`}>
                  {isProfitable ? '+' : ''}{formatPercent(pnlPercent, 2)}
                </p>
              </div>

              {/* 点卡余额 */}
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                <p className="text-text-secondary text-xs mb-1">点卡余额</p>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-warning" />
                  <span className="text-xl md:text-2xl font-bold font-mono text-warning">
                    {parseInt(data.wallet?.points_balance || '0').toLocaleString()}
                  </span>
                </div>
                <p className="text-xs mt-1 text-text-tertiary">点</p>
              </div>

              {/* 今日交易（移动端隐藏） */}
              <div className="hidden md:block p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
                <p className="text-text-secondary text-xs mb-1">今日交易</p>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-primary" />
                  <span className="text-xl md:text-2xl font-bold font-mono text-brand-primary">
                    {data.todayPnL?.todayTrades || 0}
                  </span>
                </div>
                <p className="text-xs mt-1 text-text-tertiary">
                  胜率 {formatPercent(parseFloat(data.todayPnL?.todayWinRate || '0') * 100, 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 30天收益曲线 */}
      <Card variant="glass" className="glow-border glow-border-primary overflow-hidden">
        <CardHeader className="border-b border-border-primary/50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-gradient-primary">收益曲线</span>
            </CardTitle>
            {/* 周期切换 */}
            <div className="flex gap-1 bg-bg-tertiary/50 rounded-lg p-1">
              {([7, 30, 90] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    chartPeriod === period
                      ? 'bg-brand-primary text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {period}天
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 md:p-6">
            <PnLChart data={data.pnlCurve} height={250} />
          </div>
        </CardContent>
      </Card>

      {/* 机器人状态 + VPS 状态 并排 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 机器人状态（概览版） */}
        <Card variant="glass" hover>
          <CardHeader className="border-b border-border-primary/50 pb-4">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span>机器人状态</span>
              {data.botStatus?.running && (
                <span className="ml-auto px-2 py-0.5 text-xs bg-success/20 text-success rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                  运行中
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!data.botStatus?.running ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto mb-3 bg-bg-tertiary rounded-full flex items-center justify-center">
                  <Bot className="w-7 h-7 text-text-tertiary" />
                </div>
                <p className="text-text-secondary text-sm mb-4">机器人未运行</p>
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => router.push('/strategies')}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  选择策略启动
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 策略名称 */}
                <div className="flex items-center justify-between p-3 bg-success/5 rounded-lg border border-success/20">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-success" />
                    <span className="text-sm text-text-primary font-medium">
                      {data.botStatus.strategy_name || '策略运行中'}
                    </span>
                  </div>
                </div>

                {/* 运行时长 + 今日交易 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-bg-tertiary/30 rounded-lg">
                    <p className="text-text-tertiary text-xs">运行时长</p>
                    <p className="text-text-primary font-medium mt-1">
                      {data.botStatus.uptime
                        ? `${Math.floor(data.botStatus.uptime / 3600)}h ${Math.floor((data.botStatus.uptime % 3600) / 60)}m`
                        : '-'}
                    </p>
                  </div>
                  <div className="p-3 bg-bg-tertiary/30 rounded-lg">
                    <p className="text-text-tertiary text-xs">今日交易</p>
                    <p className="text-text-primary font-medium mt-1">
                      {data.botStatus.trades_today || 0} 笔
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleBotAction('stop')}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    停止
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push('/trading')}
                  >
                    去控制台
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* VPS 状态（概览版） */}
        <Card variant="glass" hover>
          <CardHeader className="border-b border-border-primary/50 pb-4">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-success to-success/60 rounded-lg flex items-center justify-center">
                <Server className="w-4 h-4 text-white" />
              </div>
              <span>VPS 状态</span>
              {runningInstances.length > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs bg-success/20 text-success rounded-full">
                  {runningInstances.length} 运行中
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {runningInstances.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto mb-3 bg-bg-tertiary rounded-full flex items-center justify-center">
                  <Server className="w-7 h-7 text-text-tertiary" />
                </div>
                <p className="text-text-secondary text-sm mb-4">暂无运行中实例</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/strategies')}
                >
                  去策略市场
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 主实例信息 */}
                <div className="p-3 bg-bg-tertiary/30 rounded-lg border border-border-primary/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                      <span className="text-text-primary text-sm font-medium">
                        {runningInstance?.ip_address || '分配中...'}
                      </span>
                    </div>
                    <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded">
                      运行中
                    </span>
                  </div>

                  {/* CPU / RAM 使用率 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-text-tertiary" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text-tertiary">CPU</span>
                          <span className="text-text-secondary">{parseFloat(String(runningInstance?.cpu_usage || 25))}%</span>
                        </div>
                        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-primary rounded-full transition-all"
                            style={{ width: `${parseFloat(String(runningInstance?.cpu_usage || 25))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-text-tertiary" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text-tertiary">RAM</span>
                          <span className="text-text-secondary">{parseFloat(String(runningInstance?.memory_usage || 60))}%</span>
                        </div>
                        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-success rounded-full transition-all"
                            style={{ width: `${parseFloat(String(runningInstance?.memory_usage || 60))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 查看详情按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push(`/instances/${runningInstance?.id}`)}
                >
                  查看详情
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 当前持仓（最多4个） */}
      <Card variant="glass" className="glow-border glow-border-primary">
        <CardHeader className="border-b border-border-primary/50">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span>当前持仓</span>
              {data.positions.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-brand-primary/20 text-brand-primary rounded-full">
                  {data.positions.length} 个
                </span>
              )}
            </div>
            {data.positions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/trading')}
                className="text-text-secondary hover:text-text-primary"
              >
                查看全部
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {data.positions.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <div className="w-14 h-14 mx-auto mb-3 bg-bg-tertiary rounded-full flex items-center justify-center">
                <Activity className="w-7 h-7 text-text-tertiary" />
              </div>
              <p className="text-sm">暂无持仓</p>
              <p className="text-xs mt-1 text-text-tertiary">机器人开始交易后会显示持仓</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 最多显示4个持仓 */}
              {data.positions.slice(0, 4).map((position) => {
                const unrealizedPnl = parseFloat(position.unrealized_pnl);
                const isProfitable = unrealizedPnl >= 0;
                const entryPrice = parseFloat(position.entry_price);
                const currentPrice = parseFloat(position.current_price);
                const pnlPercent =
                  entryPrice > 0
                    ? ((currentPrice - entryPrice) / entryPrice) * 100
                    : 0;

                return (
                  <div
                    key={position.id}
                    onClick={() => router.push('/trading')}
                    className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${
                      isProfitable ? 'bg-success/5 border border-success/20' : 'bg-danger/5 border border-danger/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary font-bold">{position.symbol}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            position.side === 'buy'
                              ? 'bg-success/20 text-success'
                              : 'bg-danger/20 text-danger'
                          }`}
                        >
                          {position.side === 'buy' ? '多' : '空'}
                        </span>
                        {position.leverage > 1 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">
                            {position.leverage}x
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isProfitable ? (
                          <ArrowUp className="w-4 h-4 text-success" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-danger" />
                        )}
                        <span
                          className={`font-bold ${
                            isProfitable ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {isProfitable ? '+' : ''}
                          {formatPercent(pnlPercent, 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 快捷入口 */}
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => router.push('/strategies')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors"
            >
              <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-brand-primary" />
              </div>
              <span className="text-xs text-text-secondary">策略市场</span>
            </button>
            <button
              onClick={() => router.push('/wallet/deposit')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors"
            >
              <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-success" />
              </div>
              <span className="text-xs text-text-secondary">充值</span>
            </button>
            <button
              onClick={() => router.push('/trading/history')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors"
            >
              <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                <History className="w-5 h-5 text-warning" />
              </div>
              <span className="text-xs text-text-secondary">交易历史</span>
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-colors"
            >
              <div className="w-10 h-10 bg-text-secondary/20 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-text-secondary" />
              </div>
              <span className="text-xs text-text-secondary">设置</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
