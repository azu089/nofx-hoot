'use client';

import { useEffect, useState } from 'react';
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
  Zap,
  RefreshCw,
  Play,
  Pause,
  StopCircle,
  PlayCircle,
  AlertCircle,
  Bot,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';

// 统计卡片组件 - 带发光效果
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  glowColor?: 'primary' | 'success' | 'danger' | 'warning';
  trend?: 'up' | 'down' | null;
}

function StatCard({ title, value, subtitle, icon, iconBg, glowColor = 'primary', trend }: StatCardProps) {
  return (
    <Card variant="glass" hover className={`glow-border glow-border-${glowColor} group`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-text-secondary text-sm flex items-center gap-1">
              {title}
              {trend && (
                <span className={`inline-flex items-center ${trend === 'up' ? 'text-success' : 'text-danger'}`}>
                  {trend === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                </span>
              )}
            </p>
            <p className="text-3xl font-bold text-text-primary mt-2 animate-count font-mono tracking-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-text-tertiary mt-2">{subtitle}</p>
            )}
          </div>
          <div className={`w-14 h-14 ${iconBg} rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
  }>;
  botStatus: {
    running: boolean;
    strategy_id?: string;
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
  myStrategies: Array<{
    id: string;
    strategy_id: string;
    strategy_name: string;
    status: string;
    allocated_capital: string;
    total_pnl: string;
    subscribed_at: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    wallet: null,
    todayPnL: null,
    pnlCurve: [],
    instances: [],
    botStatus: null,
    positions: [],
    myStrategies: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [
        walletRes,
        pnlRes,
        curveRes,
        instancesRes,
        botStatusRes,
        positionsRes,
        strategiesRes,
      ] = await Promise.all([
        userApi.getWallet().catch(() => ({ data: null })),
        billingApi.getTodayPnL().catch(() => ({ data: null })),
        billingApi.getPnLCurve(30).catch(() => ({ data: null })),
        instancesApi.list().catch(() => ({ data: [] })),
        tradingApi.getBotStatus().catch(() => ({ data: null })),
        tradingApi.getPositions().catch(() => ({ data: [] })),
        strategiesApi.getMyStrategies().catch(() => ({ data: [] })),
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
        myStrategies: strategiesRes.data || [],
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
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // 实例控制
  const handleInstanceAction = async (instanceId: string, action: 'start' | 'stop') => {
    try {
      if (action === 'start') {
        await instancesApi.start(instanceId);
      } else {
        await instancesApi.stop(instanceId);
      }
      // 刷新数据
      fetchData();
    } catch (error) {
      console.error(`Failed to ${action} instance:`, error);
    }
  };

  // 机器人控制
  const handleBotAction = async (action: 'start' | 'stop') => {
    try {
      if (action === 'start') {
        // 需要先选择策略，这里可以跳转到策略页面或弹窗
        window.location.href = '/strategies';
      } else {
        await tradingApi.stopBot();
      }
      // 刷新数据
      fetchData();
    } catch (error) {
      console.error(`Failed to ${action} bot:`, error);
    }
  };

  const runningInstances = data.instances.filter(
    (i) => i.status === 'running' || i.status === 'provisioning'
  ).length;

  const pnlValue = parseFloat(data.todayPnL?.todayPnl || '0');
  const isProfitable = pnlValue >= 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">仪表盘</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-bg-tertiary rounded" />
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
        <div className="flex items-center gap-3">
          <p className="text-text-secondary text-sm">
            最后更新: {formatDateTime(new Date())}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 统计卡片 - 玻璃效果 + 发光边框 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 账户余额 */}
        <StatCard
          title="账户余额"
          value={formatCurrency(data.wallet?.usdt_balance || '0')}
          subtitle={`积分: ${data.wallet?.points_balance || '0'}`}
          icon={<Wallet className="w-7 h-7 text-brand-primary" />}
          iconBg="bg-brand-primary/20"
          glowColor="primary"
        />

        {/* 今日盈亏 */}
        <StatCard
          title="今日盈亏"
          value={`${isProfitable ? '+' : ''}${formatCurrency(data.todayPnL?.todayPnl || '0')}`}
          subtitle={`胜率: ${formatPercent(parseFloat(data.todayPnL?.todayWinRate || '0') * 100, 0)}`}
          icon={isProfitable ? <TrendingUp className="w-7 h-7 text-success" /> : <TrendingDown className="w-7 h-7 text-danger" />}
          iconBg={isProfitable ? 'bg-success/20' : 'bg-danger/20'}
          glowColor={isProfitable ? 'success' : 'danger'}
          trend={pnlValue !== 0 ? (isProfitable ? 'up' : 'down') : null}
        />

        {/* 运行中实例 */}
        <StatCard
          title="运行中实例"
          value={runningInstances}
          subtitle={`总计: ${data.instances.length} 个`}
          icon={<Server className="w-7 h-7 text-success" />}
          iconBg="bg-success/20"
          glowColor="success"
        />

        {/* 今日交易 */}
        <StatCard
          title="今日交易"
          value={`${data.todayPnL?.todayTrades || 0} 笔`}
          subtitle={`燃油费: ${formatCurrency(data.todayPnL?.todayGasFee || '0')}`}
          icon={<Activity className="w-7 h-7 text-brand-primary" />}
          iconBg="bg-brand-primary/20"
          glowColor="primary"
        />
      </div>

      {/* 收益曲线 - 玻璃效果卡片 */}
      <Card variant="glass" className="glow-border glow-border-primary overflow-hidden">
        <CardHeader className="border-b border-border-primary/50">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-gradient-primary">30天收益曲线</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <PnLChart data={data.pnlCurve} height={300} />
          </div>
        </CardContent>
      </Card>

      {/* 详细信息 - 玻璃效果 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 收益详情 */}
        <Card variant="glass" hover>
          <CardHeader className="border-b border-border-primary/50">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-warning to-warning/60 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              今日收益详情
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-success/5 rounded-lg border border-success/20">
                <span className="text-text-secondary flex items-center gap-2">
                  <ArrowUp className="w-4 h-4 text-success" />
                  总盈利
                </span>
                <span className="text-success font-bold text-lg">
                  +{formatCurrency(data.todayPnL?.todayProfit || '0')}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-danger/5 rounded-lg border border-danger/20">
                <span className="text-text-secondary flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-danger" />
                  总亏损
                </span>
                <span className="text-danger font-bold text-lg">
                  -{formatCurrency(data.todayPnL?.todayLoss || '0')}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-bg-tertiary/50 rounded-lg">
                <span className="text-text-secondary">胜率</span>
                <span className="text-text-primary font-medium">
                  {formatPercent(parseFloat(data.todayPnL?.todayWinRate || '0') * 100, 1)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-bg-tertiary/50 rounded-lg">
                <span className="text-text-secondary">燃油费 (20%)</span>
                <span className="text-text-primary font-medium">
                  {formatCurrency(data.todayPnL?.todayGasFee || '0')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 实例状态（含控制按钮） */}
        <Card variant="glass" hover>
          <CardHeader className="border-b border-border-primary/50">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-success to-success/60 rounded-lg flex items-center justify-center">
                <Server className="w-4 h-4 text-white" />
              </div>
              VPS 实例状态
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {data.instances.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
                  <Server className="w-8 h-8 opacity-50" />
                </div>
                <p className="font-medium">暂无 VPS 实例</p>
                <p className="text-sm mt-1 text-text-tertiary">前往策略市场启用策略</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => (window.location.href = '/strategies')}
                >
                  去策略市场
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {data.instances.slice(0, 5).map((instance) => (
                  <div
                    key={instance.id}
                    className="flex items-center justify-between p-3 bg-bg-tertiary/30 rounded-lg border border-border-primary/50 hover:border-brand-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          instance.status === 'running'
                            ? 'status-dot-running'
                            : instance.status === 'provisioning'
                            ? 'bg-warning animate-pulse'
                            : 'bg-text-secondary'
                        }`}
                      />
                      <div>
                        <p className="text-text-primary text-sm font-medium">
                          {instance.ip_address || '分配中...'}
                        </p>
                        <p className="text-text-tertiary text-xs">
                          {instance.last_heartbeat
                            ? `最后心跳: ${formatDateTime(instance.last_heartbeat)}`
                            : '等待心跳'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 控制按钮 */}
                      {instance.status === 'running' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInstanceAction(instance.id, 'stop')}
                          className="text-danger hover:text-danger/80 hover:bg-danger/10"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      )}
                      {instance.status === 'stopped' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInstanceAction(instance.id, 'start')}
                          className="text-success hover:text-success/80 hover:bg-success/10"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          instance.status === 'running'
                            ? 'bg-success/20 text-success'
                            : instance.status === 'provisioning'
                            ? 'bg-warning/20 text-warning'
                            : 'bg-bg-tertiary text-text-secondary'
                        }`}
                      >
                        {instance.status === 'running'
                          ? '运行中'
                          : instance.status === 'provisioning'
                          ? '创建中'
                          : instance.status === 'stopped'
                          ? '已停止'
                          : instance.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 机器人状态卡片 - 玻璃效果 */}
      <Card variant="glass" className="glow-border glow-border-primary">
        <CardHeader className="border-b border-border-primary/50">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span>策略机器人状态</span>
            {data.botStatus?.running && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-success/20 text-success rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                运行中
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {data.myStrategies.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
                <Bot className="w-8 h-8 opacity-50" />
              </div>
              <p className="font-medium">暂未启用任何策略</p>
              <p className="text-sm mt-2 text-text-tertiary">前往策略市场选择策略</p>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => (window.location.href = '/strategies')}
                className="mt-4"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                去策略市场
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 机器人运行状态 */}
              {data.botStatus && (
                <div className={`p-4 rounded-xl border ${data.botStatus.running ? 'bg-success/5 border-success/30' : 'bg-bg-tertiary/50 border-border-primary/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          data.botStatus.running
                            ? 'status-dot-running'
                            : 'bg-text-secondary'
                        }`}
                      />
                      <span className="text-text-primary font-medium">
                        {data.botStatus.running ? '机器人运行中' : '机器人已停止'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {data.botStatus.running ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBotAction('stop')}
                          className="text-danger hover:text-danger/80 hover:bg-danger/10"
                        >
                          <StopCircle className="w-4 h-4 mr-1" />
                          停止
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBotAction('start')}
                          className="text-success hover:text-success/80 hover:bg-success/10"
                        >
                          <PlayCircle className="w-4 h-4 mr-1" />
                          启动
                        </Button>
                      )}
                    </div>
                  </div>
                  {data.botStatus.running && (
                    <div className="grid grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-border-primary/30">
                      <div className="bg-bg-primary/30 p-3 rounded-lg">
                        <span className="text-text-tertiary text-xs">运行时长</span>
                        <p className="text-text-primary font-medium mt-1">
                          {data.botStatus.uptime
                            ? `${Math.floor(data.botStatus.uptime / 3600)}h ${Math.floor((data.botStatus.uptime % 3600) / 60)}m`
                            : '-'}
                        </p>
                      </div>
                      <div className="bg-bg-primary/30 p-3 rounded-lg">
                        <span className="text-text-tertiary text-xs">今日交易</span>
                        <p className="text-text-primary font-medium mt-1">
                          {data.botStatus.trades_today || 0} 笔
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 已启用策略列表 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                  <Zap className="w-4 h-4 text-brand-primary" />
                  已启用策略
                </h4>
                {data.myStrategies.map((strategy) => {
                  const pnl = parseFloat(strategy.total_pnl);
                  const isProfitable = pnl >= 0;

                  return (
                    <div
                      key={strategy.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:border-brand-primary/30 ${
                        isProfitable ? 'row-profit bg-success/5' : 'row-loss bg-danger/5'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-text-primary text-sm font-medium">
                            {strategy.strategy_name}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              strategy.status === 'active'
                                ? 'bg-success/20 text-success'
                                : 'bg-bg-tertiary text-text-secondary'
                            }`}
                          >
                            {strategy.status === 'active' ? '运行中' : '暂停'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
                          <span className="bg-bg-tertiary/50 px-2 py-1 rounded">
                            投入: {formatCurrency(strategy.allocated_capital)}
                          </span>
                          <span
                            className={`px-2 py-1 rounded font-medium ${
                              isProfitable ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                            }`}
                          >
                            盈亏: {isProfitable ? '+' : ''}
                            {formatCurrency(strategy.total_pnl)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          (window.location.href = `/strategies/${strategy.strategy_id}`)
                        }
                      >
                        查看
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 当前持仓列表 - 玻璃效果 + 行高亮 */}
      <Card variant="glass" className="glow-border glow-border-primary">
        <CardHeader className="border-b border-border-primary/50">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            当前持仓
            {data.positions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-brand-primary/20 text-brand-primary rounded-full">
                {data.positions.length} 个
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {data.positions.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
                <Activity className="w-8 h-8 opacity-50" />
              </div>
              <p className="font-medium">暂无持仓</p>
              <p className="text-sm mt-1 text-text-tertiary">机器人开始交易后会显示持仓</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.positions.map((position) => {
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
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:border-brand-primary/30 ${
                      isProfitable ? 'row-profit bg-success/5' : 'row-loss bg-danger/5'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-text-primary font-bold text-lg">{position.symbol}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            position.side === 'buy'
                              ? 'bg-success/20 text-success'
                              : 'bg-danger/20 text-danger'
                          }`}
                        >
                          {position.side === 'buy' ? '做多' : '做空'}
                        </span>
                        {position.leverage > 1 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">
                            {position.leverage}x
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
                        <span className="bg-bg-tertiary/50 px-2 py-1 rounded">
                          数量: {position.size}
                        </span>
                        <span className="bg-bg-tertiary/50 px-2 py-1 rounded">
                          开仓价: {position.entry_price}
                        </span>
                        <span className="bg-bg-tertiary/50 px-2 py-1 rounded">
                          现价: {position.current_price}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isProfitable ? (
                          <ArrowUp className="w-5 h-5 text-success" />
                        ) : (
                          <ArrowDown className="w-5 h-5 text-danger" />
                        )}
                        <span
                          className={`text-lg font-bold ${
                            isProfitable ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {isProfitable ? '+' : ''}
                          {formatCurrency(position.unrealized_pnl)}
                        </span>
                      </div>
                      <p
                        className={`text-sm mt-1 font-medium ${
                          isProfitable ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {isProfitable ? '+' : ''}
                        {formatPercent(pnlPercent, 2)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="pt-4 border-t border-border-primary/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = '/trading')}
                  className="w-full"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  查看所有持仓
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
