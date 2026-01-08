'use client';

import { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';

interface StrategyConfig {
  id: string;
  strategyId: string;
  strategyName: string;
  strategyTier: string;
  stakeAmount: string;
  isActive: boolean;
  winRate: string;
  leverage: number;
  createdAt: string;
}

interface TradingData {
  configs: StrategyConfig[];
  instanceStatus: 'running' | 'stopped' | 'none';
  todayPnl: {
    amount: string;
    percentage: string;
    trades: number;
  };
}

export default function TelegramTrading() {
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPanicConfirm, setShowPanicConfirm] = useState(false);
  const [panicLoading, setPanicLoading] = useState(false);

  const fetchData = async () => {
    try {
      // 并行获取仪表盘数据和策略配置列表
      const [dashboardRes, strategiesRes] = await Promise.all([
        api.get('/telegram/dashboard'),
        api.get('/telegram/my-strategies'),
      ]);
      setData({
        configs: strategiesRes.data.configs || [],
        instanceStatus: dashboardRes.data.instanceStatus,
        todayPnl: dashboardRes.data.todayPnl,
      });
    } catch (error) {
      console.error('获取交易数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartStrategy = async (configId: string) => {
    setActionLoading(configId);
    haptic('impact_medium');
    try {
      await api.post(`/telegram/trade/start`, { configId });
      haptic('notification_success');
      fetchData();
    } catch (error) {
      console.error('启动策略失败:', error);
      haptic('notification_error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopStrategy = async (configId: string) => {
    setActionLoading(configId);
    haptic('impact_medium');
    try {
      await api.post(`/telegram/trade/stop`, { configId });
      haptic('notification_success');
      fetchData();
    } catch (error) {
      console.error('停止策略失败:', error);
      haptic('notification_error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePanic = async () => {
    setPanicLoading(true);
    haptic('notification_warning');
    try {
      await api.post('/telegram/panic', { confirm: true });
      haptic('notification_success');
      setShowPanicConfirm(false);
      fetchData();
    } catch (error) {
      console.error('紧急平仓失败:', error);
      haptic('notification_error');
    } finally {
      setPanicLoading(false);
    }
  };

  const pnlAmount = parseFloat(data?.todayPnl.amount || '0');
  const pnlPercentage = parseFloat(data?.todayPnl.percentage || '0');
  const isProfit = pnlAmount >= 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-24 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-48 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 今日盈亏卡片 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm text-text-secondary">今日盈亏</h2>
          <button
            className="p-2 bg-bg-tertiary rounded-lg"
            onClick={() => {
              haptic('selection');
              fetchData();
            }}
          >
            <RefreshCw size={16} className="text-text-tertiary" />
          </button>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p
              className={`text-3xl font-bold ${
                isProfit ? 'text-success' : 'text-danger'
              }`}
            >
              {isProfit ? '+' : ''}
              {pnlAmount.toFixed(2)}
            </p>
            <p
              className={`text-sm ${isProfit ? 'text-success' : 'text-danger'}`}
            >
              {isProfit ? '+' : ''}
              {pnlPercentage.toFixed(2)}%
            </p>
          </div>
          <div
            className={`p-4 rounded-full ${
              isProfit ? 'bg-success/10' : 'bg-danger/10'
            }`}
          >
            {isProfit ? (
              <TrendingUp size={32} className="text-success" />
            ) : (
              <TrendingDown size={32} className="text-danger" />
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border-primary flex items-center justify-between text-sm">
          <span className="text-text-tertiary">今日交易</span>
          <span className="text-text-primary">{data?.todayPnl.trades || 0} 笔</span>
        </div>
      </div>

      {/* 运行状态 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-text-tertiary" />
            <span className="text-sm text-text-primary">机器人状态</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                data?.instanceStatus === 'running'
                  ? 'bg-success animate-pulse'
                  : data?.instanceStatus === 'stopped'
                  ? 'bg-warning'
                  : 'bg-text-tertiary'
              }`}
            />
            <span className="text-sm text-text-secondary">
              {data?.instanceStatus === 'running'
                ? '运行中'
                : data?.instanceStatus === 'stopped'
                ? '已停止'
                : '未启用'}
            </span>
          </div>
        </div>
      </div>

      {/* 策略列表 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl">
        <div className="p-4 border-b border-border-primary">
          <h3 className="text-sm font-medium text-text-primary">运行中的策略</h3>
        </div>

        {data?.configs.length === 0 ? (
          <div className="p-8 text-center">
            <Zap size={40} className="mx-auto text-text-tertiary mb-3" />
            <p className="text-sm text-text-secondary mb-1">暂无运行中的策略</p>
            <p className="text-xs text-text-tertiary">
              前往策略市场订阅并启用策略
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-primary">
            {data?.configs.map((config) => (
              <div key={config.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{config.strategyName}</p>
                      <span className="text-xs text-text-tertiary px-1.5 py-0.5 bg-bg-tertiary rounded">
                        {config.strategyTier}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                      <span>投入: {parseFloat(config.stakeAmount).toFixed(0)} USDT</span>
                      <span>杠杆: {config.leverage}x</span>
                      <span>胜率: {parseFloat(config.winRate).toFixed(1)}%</span>
                    </div>
                  </div>
                  <button
                    className={`p-2.5 rounded-lg ${
                      config.isActive
                        ? 'bg-danger/10 text-danger'
                        : 'bg-success/10 text-success'
                    }`}
                    onClick={() =>
                      config.isActive
                        ? handleStopStrategy(config.id)
                        : handleStartStrategy(config.id)
                    }
                    disabled={actionLoading === config.id}
                  >
                    {actionLoading === config.id ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : config.isActive ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      config.isActive ? 'bg-success animate-pulse' : 'bg-text-tertiary'
                    }`}
                  />
                  <span className={`text-xs ${config.isActive ? 'text-success' : 'text-text-tertiary'}`}>
                    {config.isActive ? '运行中' : '已停止'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 紧急平仓按钮 */}
      <button
        className="w-full flex items-center justify-center gap-2 p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger font-medium"
        onClick={() => {
          haptic('notification_warning');
          setShowPanicConfirm(true);
        }}
      >
        <AlertTriangle size={20} />
        <span>紧急平仓</span>
      </button>

      {/* 紧急平仓确认弹窗 */}
      {showPanicConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10">
              <AlertTriangle size={32} className="text-danger" />
            </div>

            <h3 className="text-lg font-bold text-text-primary text-center mb-2">
              确认紧急平仓？
            </h3>
            <p className="text-sm text-text-secondary text-center mb-6">
              此操作将停止所有运行中的策略，并尝试平掉所有持仓。此操作不可撤销。
            </p>

            <div className="flex gap-3">
              <button
                className="flex-1 py-3 bg-bg-tertiary text-text-secondary rounded-xl font-medium"
                onClick={() => setShowPanicConfirm(false)}
                disabled={panicLoading}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 bg-danger text-white rounded-xl font-medium"
                onClick={handlePanic}
                disabled={panicLoading}
              >
                {panicLoading ? '执行中...' : '确认平仓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="text-xs text-text-tertiary text-center">
        <p>• 策略运行需要 VPS 实例在线</p>
        <p>• 紧急平仓会停止所有策略并平掉持仓</p>
      </div>
    </div>
  );
}
