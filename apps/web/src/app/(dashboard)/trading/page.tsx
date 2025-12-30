'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: '交易控制台 | QuantFi',
//   description: '实时监控量化交易执行，管理当前持仓，查看交易日志和策略运行状态',
// };
import { Card, CardContent, CardHeader, CardTitle, Button, Dialog, DialogFooter } from '@/components/ui';
import { instancesApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { TradingLog, TradingKLineView, TradeRecord } from '@/components/features/trading';
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

export default function TradingPage() {
  const router = useRouter();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [status, setStatus] = useState<FreqtradeStatus | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 紧急平仓对话框状态
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  const fetchData = async () => {
    try {
      const instancesRes = await instancesApi.list();
      const runningInstances = (instancesRes.data || []).filter(
        (i: Instance) => i.status === 'running'
      );
      setInstances(runningInstances);

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
          {[...Array(3)].map((_, i) => (
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
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="w-16 h-16 mx-auto mb-4 text-text-disabled" />
            <h3 className="text-lg font-medium text-text-primary mb-2">暂无运行中的实例</h3>
            <p className="text-text-secondary mb-6">
              请先创建并启动一个 VPS 实例
            </p>
            <Button onClick={() => (window.location.href = '/instances')}>
              前往实例管理
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openTrades = trades.filter((t) => t.is_open);
  const closedTrades = trades.filter((t) => !t.is_open);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">交易控制台</h1>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/trading/history')}
          >
            <History className="w-4 h-4 mr-2" />
            交易历史
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectedInstance && fetchInstanceData(selectedInstance)}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          {status?.state === 'running' ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              isLoading={actionLoading}
            >
              <Square className="w-4 h-4 mr-2" />
              停止策略
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStart}
              isLoading={actionLoading}
            >
              <Play className="w-4 h-4 mr-2" />
              启动策略
            </Button>
          )}
        </div>
      </div>

      {/* 紧急平仓警告条 */}
      {openTrades.length > 0 && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-danger" />
                <div>
                  <p className="text-text-primary font-medium">
                    当前有 <span className="font-bold text-danger">{openTrades.length}</span> 个持仓中
                  </p>
                  <p className="text-text-secondary text-sm mt-0.5">
                    紧急情况下可一键平仓所有持仓
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setEmergencyDialogOpen(true)}
                disabled={actionLoading}
                className="bg-danger hover:bg-danger/90"
              >
                <XCircle className="w-4 h-4 mr-2" />
                紧急全部平仓
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 实例选择 */}
      {instances.length > 1 && (
        <div className="flex gap-2">
          {instances.map((instance) => (
            <Button
              key={instance.id}
              variant={selectedInstance === instance.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedInstance(instance.id)}
            >
              {instance.ip_address}
            </Button>
          ))}
        </div>
      )}

      {/* 状态卡片 */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-brand-primary/20 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <p className="text-text-secondary text-sm">状态</p>
                  <p className="text-text-primary text-xl font-semibold">
                    {status.state === 'running' ? '运行中' : '已停止'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-success/20 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-text-secondary text-sm">可用余额</p>
                  <p className="text-text-primary text-xl font-semibold">
                    {status.available_balance?.toFixed(2) || '0.00'} USDT
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-warning/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-text-secondary text-sm">策略</p>
                  <p className="text-text-primary text-lg font-medium">
                    {status.strategy || '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* K 线图 - 买卖点可视化 */}
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

      {/* 持仓列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-primary" />
              持仓中 ({openTrades.length})
            </span>
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
        <CardContent>
          {openTrades.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无持仓</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openTrades.map((trade) => {
                const profit = trade.close_profit_abs || 0;
                const isProfit = profit >= 0;

                return (
                  <div
                    key={trade.trade_id}
                    className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-text-primary font-medium">{trade.pair}</h3>
                        <span className="text-text-secondary text-sm">
                          {formatDateTime(trade.open_date)}
                        </span>
                      </div>
                      <p className="text-text-tertiary text-sm mt-1">
                        开仓价: {trade.open_rate.toFixed(8)} • 数量: {trade.amount.toFixed(4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={`text-lg font-semibold ${
                            isProfit ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {profit.toFixed(2)} USDT
                        </p>
                        <p
                          className={`text-sm ${
                            isProfit ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {((trade.close_profit || 0) * 100).toFixed(2)}%
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleForceExit(trade.trade_id)}
                        disabled={actionLoading}
                      >
                        平仓
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近交易 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-text-secondary" />
            最近交易 ({closedTrades.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {closedTrades.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <p>暂无交易记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {closedTrades.slice(0, 10).map((trade) => {
                const profit = trade.close_profit_abs || 0;
                const isProfit = profit >= 0;

                return (
                  <div
                    key={trade.trade_id}
                    className="flex items-center justify-between p-3 bg-bg-tertiary/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="text-text-primary text-sm font-medium">{trade.pair}</h3>
                      <p className="text-text-tertiary text-xs">
                        {formatDateTime(trade.close_date || '')}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-medium ${
                        isProfit ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {isProfit ? '+' : ''}
                      {profit.toFixed(2)} USDT
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
                        开仓价: {trade.open_rate.toFixed(8)}
                      </p>
                    </div>
                    <p
                      className={`font-medium ${
                        isProfit ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {isProfit ? '+' : ''}
                      {profit.toFixed(2)} USDT
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
            className="bg-danger hover:bg-danger/90"
          >
            <XCircle className="w-4 h-4 mr-2" />
            确认全部平仓
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
