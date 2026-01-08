'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Dialog, DialogFooter } from '@/components/ui';
import { instancesApi, tradingApi, billingApi } from '@/lib/api';
import { formatDateTime, formatCurrency, formatPercent } from '@/lib/utils';
import { TradingLog, TradingKLineView } from '@/components/features/trading';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Play,
  Square,
  RefreshCw,
  AlertCircle,
  History,
  AlertTriangle,
  XCircle,
  Bot,
  Zap,
  Clock,
  Target,
  Brain,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface Instance {
  id: string;
  status: string;
  ip_address: string;
  region: string;
}

interface FreqtradeStatus {
  state: string;
  runmode: string;
  strategy: string;
  available_balance?: number;
  stake_amount?: number;
  max_open_trades?: number;
}

interface Trade {
  trade_id: number;
  pair: string;
  is_open: boolean;
  open_rate: number;
  close_rate: number | null;
  amount: number;
  stake_amount: number;
  close_profit: number | null;
  close_profit_abs: number | null;
  open_date: string;
  close_date: string | null;
}

interface TodayPnL {
  todayPnl: string;
  todayTrades: number;
  todayWinRate: string;
}

export default function TradingPage() {
  const router = useRouter();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [status, setStatus] = useState<FreqtradeStatus | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [todayPnL, setTodayPnL] = useState<TodayPnL | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 紧急平仓对话框状态
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [instancesRes, pnlRes] = await Promise.all([
        instancesApi.list(),
        billingApi.getTodayPnL().catch(() => ({ data: null })),
      ]);
      const runningInstances = (instancesRes.data || []).filter(
        (i: Instance) => i.status === 'running'
      );
      setInstances(runningInstances);
      setTodayPnL(pnlRes.data);

      // 自动选择第一个实例
      if (runningInstances.length > 0 && !selectedInstance) {
        setSelectedInstance(runningInstances[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstanceData = async (instanceId: string) => {
    try {
      const [statusRes, tradesRes] = await Promise.all([
        instancesApi.getStatus(instanceId),
        instancesApi.getTrades(instanceId),
      ]);
      setStatus(statusRes.data);
      setTrades(tradesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch instance data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 每 30 秒刷新
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedInstance) {
      fetchInstanceData(selectedInstance);
      const interval = setInterval(() => fetchInstanceData(selectedInstance), 5000); // 每 5 秒刷新
      return () => clearInterval(interval);
    }
  }, [selectedInstance]);

  const handleStart = async () => {
    if (!selectedInstance) return;
    setActionLoading(true);
    try {
      await instancesApi.start(selectedInstance);
      fetchInstanceData(selectedInstance);
      alert('策略已启动');
    } catch (error) {
      alert(error instanceof Error ? error.message : '启动失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!selectedInstance) return;
    if (!confirm('确定要停止策略吗？')) return;

    setActionLoading(true);
    try {
      await instancesApi.stop(selectedInstance);
      fetchInstanceData(selectedInstance);
      alert('策略已停止');
    } catch (error) {
      alert(error instanceof Error ? error.message : '停止失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceExit = async (tradeId?: number) => {
    if (!selectedInstance) return;
    if (!confirm('确定要强制平仓吗？')) return;

    setActionLoading(true);
    try {
      await instancesApi.forceExit(selectedInstance, tradeId?.toString());
      fetchInstanceData(selectedInstance);
      alert('平仓指令已发送');
    } catch (error) {
      alert(error instanceof Error ? error.message : '平仓失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 紧急全部平仓
  const handleEmergencyExit = async () => {
    if (!selectedInstance) return;

    setEmergencyLoading(true);
    try {
      // 调用全部平仓（不传 trade_id）
      await instancesApi.forceExit(selectedInstance);
      fetchInstanceData(selectedInstance);
      setEmergencyDialogOpen(false);
      alert(`成功发送紧急平仓指令，共 ${openTrades.length} 个持仓`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '紧急平仓失败');
    } finally {
      setEmergencyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">交易控制台</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">交易控制台</h1>
        <Card variant="glass">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-bg-tertiary rounded-full flex items-center justify-center">
              <Activity className="w-10 h-10 text-text-tertiary" />
            </div>
            <h3 className="text-xl font-medium text-text-primary mb-2">暂无运行中的实例</h3>
            <p className="text-text-secondary mb-8 max-w-md mx-auto">
              请先前往策略市场选择并启用一个策略，系统将自动为您创建交易实例
            </p>
            <Button variant="gradient" onClick={() => router.push('/strategies')}>
              <Zap className="w-4 h-4 mr-2" />
              前往策略市场
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openTrades = trades.filter((t) => t.is_open);
  const closedTrades = trades.filter((t) => !t.is_open);
  const todayPnlValue = parseFloat(todayPnL?.todayPnl || '0');
  const isProfitable = todayPnlValue >= 0;

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">交易控制台</h1>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/trading/history')}
          >
            <History className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">历史</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectedInstance && fetchInstanceData(selectedInstance)}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          {status?.state === 'running' ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              isLoading={actionLoading}
            >
              <Square className="w-4 h-4 mr-1.5" />
              停止策略
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStart}
              isLoading={actionLoading}
            >
              <Play className="w-4 h-4 mr-1.5" />
              启动策略
            </Button>
          )}
        </div>
      </div>

      {/* 紧急平仓警告条 - 有持仓时显示 */}
      {openTrades.length > 0 && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
                <div>
                  <p className="text-text-primary font-medium text-sm">
                    当前有 <span className="font-bold text-danger">{openTrades.length}</span> 个持仓中
                  </p>
                  <p className="text-text-tertiary text-xs mt-0.5 hidden sm:block">
                    紧急情况下可一键平仓所有持仓
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setEmergencyDialogOpen(true)}
                disabled={actionLoading}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                紧急全部平仓
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 当前策略状态卡片 */}
      {status && (
        <Card variant="glass" className="glow-border glow-border-primary">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-brand-primary/10 via-bg-secondary to-brand-secondary/5 p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-text-primary font-medium">{status.strategy || '策略'}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${status.state === 'running' ? 'bg-success animate-pulse' : 'bg-text-tertiary'}`} />
                      <span className="text-xs text-text-secondary">
                        {status.state === 'running' ? '运行中' : '已停止'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* 今日盈亏高亮 */}
                <div className={`text-right p-3 rounded-lg ${isProfitable ? 'bg-success/10' : 'bg-danger/10'}`}>
                  <p className="text-text-tertiary text-xs">今日盈亏</p>
                  <p className={`text-xl md:text-2xl font-bold font-mono ${isProfitable ? 'text-success' : 'text-danger'}`}>
                    {isProfitable ? '+' : ''}{formatCurrency(todayPnL?.todayPnl || '0')}
                  </p>
                </div>
              </div>

              {/* 运行数据 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-bg-tertiary/30 rounded-lg">
                  <div className="flex items-center gap-2 text-text-tertiary text-xs mb-1">
                    <Activity className="w-3.5 h-3.5" />
                    今日交易
                  </div>
                  <p className="text-text-primary font-semibold">{todayPnL?.todayTrades || 0} 笔</p>
                </div>
                <div className="p-3 bg-bg-tertiary/30 rounded-lg">
                  <div className="flex items-center gap-2 text-text-tertiary text-xs mb-1">
                    <Target className="w-3.5 h-3.5" />
                    胜率
                  </div>
                  <p className="text-text-primary font-semibold">
                    {formatPercent(parseFloat(todayPnL?.todayWinRate || '0') * 100, 0)}
                  </p>
                </div>
                <div className="p-3 bg-bg-tertiary/30 rounded-lg">
                  <div className="flex items-center gap-2 text-text-tertiary text-xs mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    可用余额
                  </div>
                  <p className="text-text-primary font-semibold">
                    {status.available_balance?.toFixed(2) || '0.00'} USDT
                  </p>
                </div>
                <div className="p-3 bg-bg-tertiary/30 rounded-lg">
                  <div className="flex items-center gap-2 text-text-tertiary text-xs mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    当前持仓
                  </div>
                  <p className="text-text-primary font-semibold">{openTrades.length} 个</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 实例选择（多实例时显示） */}
      {instances.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {instances.map((instance) => (
            <Button
              key={instance.id}
              variant={selectedInstance === instance.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedInstance(instance.id)}
              className="flex-shrink-0"
            >
              {instance.ip_address}
            </Button>
          ))}
        </div>
      )}

      {/* K 线图 - 买卖点可视化（有持仓时显示） */}
      {openTrades.length > 0 && (
        <TradingKLineView
          symbol={openTrades[0]?.pair || 'BTC/USDT'}
          trades={trades.map(t => ({
            id: t.trade_id.toString(),
            pair: t.pair,
            side: 'buy' as const,
            open_time: Math.floor(new Date(t.open_date).getTime() / 1000),
            close_time: t.close_date ? Math.floor(new Date(t.close_date).getTime() / 1000) : undefined,
            open_rate: t.open_rate,
            close_rate: t.close_rate || undefined,
            amount: t.amount,
            profit: t.close_profit_abs || undefined,
            profit_percent: t.close_profit || undefined,
            is_open: t.is_open,
          }))}
          height={350}
        />
      )}

      {/* 持仓列表 - 完整版 */}
      <Card variant="glass">
        <CardHeader className="border-b border-border-primary/50">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-primary" />
              <span>持仓中</span>
              <span className="px-2 py-0.5 text-xs bg-brand-primary/20 text-brand-primary rounded-full">
                {openTrades.length}
              </span>
            </div>
            {openTrades.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleForceExit()}
                disabled={actionLoading}
              >
                全部平仓
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {openTrades.length === 0 ? (
            <div className="text-center py-10 text-text-secondary">
              <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-text-tertiary" />
              </div>
              <p className="font-medium">暂无持仓</p>
              <p className="text-sm text-text-tertiary mt-1">策略运行后将显示持仓信息</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openTrades.map((trade) => {
                const profit = trade.close_profit_abs || 0;
                const isProfit = profit >= 0;
                const profitPercent = (trade.close_profit || 0) * 100;

                return (
                  <div
                    key={trade.trade_id}
                    className={`p-4 rounded-xl border transition-all ${
                      isProfit ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-text-primary font-bold text-lg">{trade.pair}</h3>
                          <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success">
                            做多
                          </span>
                        </div>
                        {/* 移动端：紧凑布局 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div className="bg-bg-tertiary/30 px-2 py-1.5 rounded">
                            <span className="text-text-tertiary">数量:</span>
                            <span className="text-text-primary ml-1">{trade.amount.toFixed(4)}</span>
                          </div>
                          <div className="bg-bg-tertiary/30 px-2 py-1.5 rounded">
                            <span className="text-text-tertiary">开仓价:</span>
                            <span className="text-text-primary ml-1">{trade.open_rate.toFixed(2)}</span>
                          </div>
                          <div className="bg-bg-tertiary/30 px-2 py-1.5 rounded">
                            <span className="text-text-tertiary">本金:</span>
                            <span className="text-text-primary ml-1">{trade.stake_amount.toFixed(2)}</span>
                          </div>
                          <div className="bg-bg-tertiary/30 px-2 py-1.5 rounded">
                            <span className="text-text-tertiary">时间:</span>
                            <span className="text-text-primary ml-1">{formatDateTime(trade.open_date).slice(5)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isProfit ? (
                              <ArrowUp className="w-4 h-4 text-success" />
                            ) : (
                              <ArrowDown className="w-4 h-4 text-danger" />
                            )}
                            <span
                              className={`text-lg font-bold ${
                                isProfit ? 'text-success' : 'text-danger'
                              }`}
                            >
                              {isProfit ? '+' : ''}{profit.toFixed(2)}
                            </span>
                          </div>
                          <p
                            className={`text-xs ${
                              isProfit ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {isProfit ? '+' : ''}{profitPercent.toFixed(2)}%
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleForceExit(trade.trade_id)}
                          disabled={actionLoading}
                          className="flex-shrink-0"
                        >
                          平仓
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近交易 + AI 解读 并排 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近交易 */}
        <Card variant="glass">
          <CardHeader className="border-b border-border-primary/50">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-text-secondary" />
                <span>最近交易</span>
                <span className="px-2 py-0.5 text-xs bg-bg-tertiary text-text-secondary rounded-full">
                  {closedTrades.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/trading/history')}
                className="text-text-secondary"
              >
                查看全部
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {closedTrades.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <p className="text-sm">暂无交易记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {closedTrades.slice(0, 8).map((trade) => {
                  const profit = trade.close_profit_abs || 0;
                  const isProfit = profit >= 0;

                  return (
                    <div
                      key={trade.trade_id}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        isProfit ? 'bg-success/5 hover:bg-success/10' : 'bg-danger/5 hover:bg-danger/10'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-text-primary text-sm font-medium truncate">{trade.pair}</h3>
                        <p className="text-text-tertiary text-xs">
                          {formatDateTime(trade.close_date || '').slice(5)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isProfit ? (
                          <ArrowUp className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-danger" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            isProfit ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {isProfit ? '+' : ''}{profit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 解读 */}
        <Card variant="glass">
          <CardHeader className="border-b border-border-primary/50">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-primary" />
              <span>AI 交易解读</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {openTrades.length === 0 && closedTrades.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <div className="w-14 h-14 mx-auto mb-3 bg-bg-tertiary rounded-full flex items-center justify-center">
                  <Brain className="w-7 h-7 text-text-tertiary" />
                </div>
                <p className="text-sm">暂无交易数据可分析</p>
                <p className="text-xs text-text-tertiary mt-1">开始交易后 AI 将提供实时解读</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* AI 分析摘要 */}
                <div className="p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-brand-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-sm leading-relaxed">
                        {isProfitable
                          ? `今日交易表现良好，${todayPnL?.todayTrades || 0} 笔交易中胜率 ${formatPercent(parseFloat(todayPnL?.todayWinRate || '0') * 100, 0)}。当前市场趋势向好，建议继续持有盈利仓位。`
                          : `今日交易出现回撤，建议关注风险控制。当前持仓 ${openTrades.length} 个，可考虑适当止损或减仓。`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 最新信号 */}
                {openTrades.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-text-secondary text-xs font-medium">最新信号</p>
                    {openTrades.slice(0, 2).map((trade) => (
                      <div key={trade.trade_id} className="p-3 bg-bg-tertiary/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-text-primary text-sm font-medium">{trade.pair}</span>
                          <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded">
                            买入信号
                          </span>
                        </div>
                        <p className="text-text-tertiary text-xs mt-1">
                          RSI 超卖反弹 | MACD 金叉
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 查看详细分析按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push('/trading/ai')}
                >
                  查看详细分析
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 实时日志 */}
      <TradingLog
        instanceId={selectedInstance}
        isConnected={status?.state === 'running'}
      />

      {/* 紧急平仓确认对话框 */}
      <Dialog
        open={emergencyDialogOpen}
        onClose={() => setEmergencyDialogOpen(false)}
        title="紧急全部平仓"
        description="此操作将立即平仓所有持仓，不可撤销"
      >
        <div className="space-y-4">
          {/* 警告信息 */}
          <div className="flex items-start gap-3 p-4 bg-danger/10 border border-danger/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="text-text-primary font-medium mb-1">风险提示</p>
              <ul className="text-text-secondary space-y-1">
                <li>• 将立即平仓所有 {openTrades.length} 个持仓</li>
                <li>• 可能以市价成交，存在滑点风险</li>
                <li>• 操作不可撤销，请谨慎确认</li>
              </ul>
            </div>
          </div>

          {/* 持仓列表预览 */}
          <div>
            <p className="text-sm text-text-secondary mb-2">即将平仓的持仓：</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {openTrades.map((trade) => {
                const profit = trade.close_profit_abs || 0;
                const isProfit = profit >= 0;

                return (
                  <div
                    key={trade.trade_id}
                    className="flex items-center justify-between p-3 bg-bg-secondary/50 rounded-lg text-sm"
                  >
                    <div>
                      <p className="text-text-primary font-medium">{trade.pair}</p>
                      <p className="text-text-tertiary text-xs">
                        开仓价: {trade.open_rate.toFixed(2)}
                      </p>
                    </div>
                    <p
                      className={`font-medium ${
                        isProfit ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {isProfit ? '+' : ''}{profit.toFixed(2)} USDT
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setEmergencyDialogOpen(false)}
            disabled={emergencyLoading}
          >
            取消
          </Button>
          <Button
            variant="danger"
            onClick={handleEmergencyExit}
            isLoading={emergencyLoading}
          >
            <XCircle className="w-4 h-4 mr-2" />
            确认全部平仓
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
