'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  Users,
  BarChart3,
  AlertTriangle,
  Check,
  Zap,
  Clock,
  Target,
  Activity,
} from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';

interface StrategyDetail {
  id: string;
  name: string;
  description?: string;
  tier: string;
  isPublic: boolean;
  isActive: boolean;
  // 回测数据
  backtestWinRate: string;
  backtestSharpeRatio: string;
  backtestMaxDrawdown: string;
  backtestTotalTrades: number;
  // 实盘数据
  avgWinRate: string;
  avgSharpeRatio: string;
  // 用户数据
  totalUsers: number;
  totalProfit: string;
  // 订阅状态
  isSubscribed: boolean;
  userConfig?: {
    id: string;
    stakeAmount: string;
    isActive: boolean;
  };
  // 最近交易
  recentTrades: Array<{
    symbol: string;
    side: string;
    pnl: string;
    closedAt: string;
  }>;
  // 作者信息
  author?: {
    id: string;
    username: string;
  };
  createdAt: string;
}

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<StrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('100');
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const strategyId = params?.id as string;

  useEffect(() => {
    async function fetchStrategy() {
      try {
        const response = await api.get(`/telegram/strategies/${strategyId}`);
        setData(response.data);
      } catch (error) {
        console.error('获取策略详情失败:', error);
      } finally {
        setLoading(false);
      }
    }

    if (strategyId) {
      fetchStrategy();
    }
  }, [strategyId]);

  const handleSubscribe = async () => {
    setActionLoading(true);
    haptic('impact_medium');
    try {
      await api.post(`/telegram/strategies/${strategyId}/subscribe`, {
        stakeAmount,
      });
      haptic('notification_success');
      setShowSubscribeModal(false);
      // 刷新数据
      const response = await api.get(`/telegram/strategies/${strategyId}`);
      setData(response.data);
    } catch (error: any) {
      console.error('订阅失败:', error);
      haptic('notification_error');
      alert(error.response?.data?.message || '订阅失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!confirm('确定要取消订阅此策略吗？')) return;

    setActionLoading(true);
    haptic('impact_medium');
    try {
      await api.delete(`/telegram/strategies/${strategyId}/unsubscribe`);
      haptic('notification_success');
      // 刷新数据
      const response = await api.get(`/telegram/strategies/${strategyId}`);
      setData(response.data);
    } catch (error: any) {
      console.error('取消订阅失败:', error);
      haptic('notification_error');
      alert(error.response?.data?.message || '取消订阅失败');
    } finally {
      setActionLoading(false);
    }
  };

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'diamond':
        return { label: '钻石', color: 'text-cyan-400', bg: 'bg-cyan-400/10' };
      case 'platinum':
        return { label: '铂金', color: 'text-purple-400', bg: 'bg-purple-400/10' };
      case 'gold':
        return { label: '黄金', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
      case 'silver':
        return { label: '白银', color: 'text-gray-300', bg: 'bg-gray-300/10' };
      default:
        return { label: '青铜', color: 'text-amber-600', bg: 'bg-amber-600/10' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-bg-secondary rounded animate-pulse" />
        <div className="h-48 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-64 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={48} className="mx-auto text-warning mb-3" />
        <p className="text-text-secondary">策略不存在或已下架</p>
        <button
          className="mt-4 text-brand-primary"
          onClick={() => router.back()}
        >
          返回
        </button>
      </div>
    );
  }

  const tierInfo = getTierInfo(data.tier);

  return (
    <div className="space-y-4 pb-20">
      {/* 返回按钮 */}
      <button
        className="flex items-center gap-2 text-text-secondary"
        onClick={() => {
          haptic('selection');
          router.back();
        }}
      >
        <ArrowLeft size={20} />
        <span>返回</span>
      </button>

      {/* 基本信息 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-text-primary">{data.name}</h1>
              <span className={`px-2 py-0.5 rounded text-xs ${tierInfo.bg} ${tierInfo.color}`}>
                {tierInfo.label}
              </span>
            </div>
            {data.author && (
              <p className="text-xs text-text-tertiary">
                作者：@{data.author.username}
              </p>
            )}
          </div>
          {data.isSubscribed && (
            <div className="p-2 bg-success/10 rounded-lg">
              <Check size={20} className="text-success" />
            </div>
          )}
        </div>

        <p className="text-sm text-text-secondary mb-4">
          {data.description || '暂无描述'}
        </p>

        {/* 数据指标 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target size={14} className="text-success" />
              <span className="text-xs text-text-tertiary">回测胜率</span>
            </div>
            <p className="text-lg font-bold text-success">
              {parseFloat(data.backtestWinRate).toFixed(1)}%
            </p>
          </div>

          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={14} className="text-brand-primary" />
              <span className="text-xs text-text-tertiary">夏普比率</span>
            </div>
            <p className="text-lg font-bold text-brand-primary">
              {parseFloat(data.backtestSharpeRatio).toFixed(2)}
            </p>
          </div>

          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-danger" />
              <span className="text-xs text-text-tertiary">最大回撤</span>
            </div>
            <p className="text-lg font-bold text-danger">
              {parseFloat(data.backtestMaxDrawdown).toFixed(1)}%
            </p>
          </div>

          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={14} className="text-warning" />
              <span className="text-xs text-text-tertiary">回测交易</span>
            </div>
            <p className="text-lg font-bold text-text-primary">
              {data.backtestTotalTrades}
            </p>
          </div>
        </div>
      </div>

      {/* 用户数据 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">使用情况</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-text-tertiary" />
            <span className="text-sm text-text-secondary">
              {data.totalUsers} 人正在使用
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-success" />
            <span className="text-sm text-success">
              +{parseFloat(data.totalProfit).toFixed(2)} USDT
            </span>
          </div>
        </div>
      </div>

      {/* 实盘表现（如果有） */}
      {parseFloat(data.avgWinRate) > 0 && (
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">实盘表现</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-tertiary mb-1">平均胜率</p>
              <p className="text-lg font-bold text-success">
                {parseFloat(data.avgWinRate).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">平均夏普比</p>
              <p className="text-lg font-bold text-brand-primary">
                {parseFloat(data.avgSharpeRatio).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 最近交易 */}
      {data.recentTrades.length > 0 && (
        <div className="bg-bg-secondary border border-border-primary rounded-xl">
          <div className="p-4 border-b border-border-primary">
            <h3 className="text-sm font-medium text-text-primary">最近交易</h3>
          </div>
          <div className="divide-y divide-border-primary max-h-48 overflow-y-auto">
            {data.recentTrades.map((trade, index) => {
              const pnl = parseFloat(trade.pnl);
              const isProfit = pnl >= 0;
              return (
                <div key={index} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-primary">{trade.symbol}</p>
                    <p className="text-xs text-text-tertiary">
                      {trade.side === 'buy' ? '做多' : '做空'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${isProfit ? 'text-success' : 'text-danger'}`}>
                      {isProfit ? '+' : ''}{pnl.toFixed(2)}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {new Date(trade.closedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 我的配置（如果已订阅） */}
      {data.isSubscribed && data.userConfig && (
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">我的配置</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">投入资金</span>
              <span className="text-sm text-text-primary">
                {parseFloat(data.userConfig.stakeAmount).toFixed(2)} USDT
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">运行状态</span>
              <span className={`text-sm ${data.userConfig.isActive ? 'text-success' : 'text-text-tertiary'}`}>
                {data.userConfig.isActive ? '运行中' : '已停止'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 底部操作按钮 */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-bg-primary border-t border-border-primary">
        {data.isSubscribed ? (
          <div className="flex gap-3">
            <button
              className="flex-1 py-3 bg-bg-tertiary text-text-secondary rounded-xl font-medium"
              onClick={handleUnsubscribe}
              disabled={actionLoading}
            >
              {actionLoading ? '处理中...' : '取消订阅'}
            </button>
            <button
              className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-medium"
              onClick={() => router.push('/tg/trading')}
            >
              前往交易
            </button>
          </div>
        ) : (
          <button
            className="w-full py-3 bg-brand-primary text-white rounded-xl font-medium flex items-center justify-center gap-2"
            onClick={() => {
              haptic('selection');
              setShowSubscribeModal(true);
            }}
          >
            <Zap size={20} />
            <span>订阅策略</span>
          </button>
        )}
      </div>

      {/* 订阅弹窗 */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-bg-secondary border-t border-border-primary rounded-t-2xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold text-text-primary mb-4">订阅策略</h3>

            <div className="mb-4">
              <label className="text-sm text-text-secondary mb-2 block">
                投入资金 (USDT)
              </label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-xl text-text-primary focus:outline-none focus:border-brand-primary"
                placeholder="请输入投入资金"
                min="10"
              />
              <p className="text-xs text-text-tertiary mt-2">
                建议最低投入 100 USDT 以获得最佳效果
              </p>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 py-3 bg-bg-tertiary text-text-secondary rounded-xl font-medium"
                onClick={() => setShowSubscribeModal(false)}
                disabled={actionLoading}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-medium"
                onClick={handleSubscribe}
                disabled={actionLoading}
              >
                {actionLoading ? '处理中...' : '确认订阅'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
