'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { ArrowLeft, ArrowRight, RefreshCw, CheckCircle, XCircle, Clock, Timer, TrendingUp } from 'lucide-react';
import { exchangeApi, gamefiApi } from '@/lib/api';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

// 资产配置
const ASSET_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  usdt: { label: 'USDT', icon: '💵', color: 'text-green-400' },
  card: { label: '点卡', icon: '🎫', color: 'text-blue-400' },
  points: { label: '积分', icon: '⭐', color: 'text-yellow-400' },
  token: { label: 'QFI', icon: '🪙', color: 'text-purple-400' },
};

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  completed: { label: '已完成', icon: CheckCircle, color: 'text-success' },
  pending: { label: '处理中', icon: Clock, color: 'text-warning' },
  failed: { label: '失败', icon: XCircle, color: 'text-danger' },
};

interface ExchangeRecord {
  id: string;
  from_asset: string;
  from_amount: string;
  to_asset: string;
  to_amount: string;
  exchange_rate: string;
  fee_amount: string;
  mode?: string;
  status: string;
  created_at: string;
}

interface VestingOrder {
  id: string;
  totalAmount: string;
  releasedAmount: string;
  remainingAmount: string;
  startDate: string;
  endDate: string;
  dailyRelease: string;
  progress: number;
  orderType: 'exchange' | 'dividend';
}

export default function TgExchangeHistoryPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<'records' | 'vesting'>('records');

  const [records, setRecords] = useState<ExchangeRecord[]>([]);
  const [vestingOrders, setVestingOrders] = useState<VestingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // 获取历史记录和待释放订单
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [historyRes, vestingRes] = await Promise.all([
        exchangeApi.getHistory({ page, limit }),
        gamefiApi.getVestingProgress(),
      ]);
      setRecords(historyRes.data?.items || []);
      setTotal(historyRes.data?.total || 0);

      // 转换 vestingOrders 格式并过滤兑换类型
      const allOrders = (vestingRes.data?.vestingOrders || []).map((order: any) => ({
        id: order.orderId,
        totalAmount: order.tokensTotal,
        releasedAmount: order.tokensReleased,
        remainingAmount: order.tokensPending,
        startDate: order.vestingStartAt,
        endDate: order.vestingEndAt,
        dailyRelease: (parseFloat(order.tokensTotal) * 0.8 / 90).toFixed(8),
        progress: order.progress,
        orderType: order.orderType || 'exchange',
      }));

      // 只保留兑换类型的待释放订单
      const exchangeVestingOrders = allOrders.filter(
        (order: VestingOrder) => order.orderType === 'exchange'
      );
      setVestingOrders(exchangeVestingOrders);
    } catch (err) {
      console.error('获取历史记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 下拉刷新
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchHistory();
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { haptic('selection'); router.back(); }}
            className="flex items-center gap-2 text-text-secondary"
          >
            <ArrowLeft size={20} />
            <span className="text-lg font-medium text-white">兑换记录</span>
          </button>
          <button
            onClick={() => { haptic('impact_light'); fetchHistory(); }}
            disabled={loading}
            className="p-2 rounded-lg bg-bg-secondary"
          >
            <RefreshCw className={`w-4 h-4 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex bg-bg-secondary rounded-xl p-1">
          <button
            onClick={() => { setActiveTab('records'); haptic('selection'); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'records'
                ? 'bg-brand-primary text-white'
                : 'text-text-secondary'
            }`}
          >
            <Clock className="w-4 h-4" />
            兑换记录
          </button>
          <button
            onClick={() => { setActiveTab('vesting'); haptic('selection'); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'vesting'
                ? 'bg-brand-primary text-white'
                : 'text-text-secondary'
            }`}
          >
            <Timer className="w-4 h-4" />
            待释放
            {vestingOrders.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'vesting' ? 'bg-white/20' : 'bg-warning/20 text-warning'
              }`}>
                {vestingOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 内容 */}
        {activeTab === 'records' ? (
          <>
            {/* 兑换记录列表 */}
            {loading && records.length === 0 ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 text-text-tertiary">
                暂无兑换记录
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => {
                  const fromConfig = ASSET_CONFIG[record.from_asset] || { label: record.from_asset, icon: '💰', color: 'text-text-primary' };
                  const toConfig = ASSET_CONFIG[record.to_asset] || { label: record.to_asset, icon: '💰', color: 'text-text-primary' };
                  const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={record.id} className="bg-bg-secondary border border-border-primary rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        {/* 兑换方向 */}
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{fromConfig.icon}</span>
                          <span className={`font-medium ${fromConfig.color}`}>
                            {fromConfig.label}
                          </span>
                          <ArrowRight className="w-4 h-4 text-text-tertiary" />
                          <span className="text-lg">{toConfig.icon}</span>
                          <span className={`font-medium ${toConfig.color}`}>
                            {toConfig.label}
                          </span>
                        </div>

                        {/* 状态 */}
                        <div className={`flex items-center gap-1 text-sm ${statusConfig.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          <span>{statusConfig.label}</span>
                        </div>
                      </div>

                      {/* 金额详情 */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-text-tertiary">支付: </span>
                          <span className="text-danger">
                            -{parseFloat(record.from_amount).toFixed(4)} {fromConfig.label}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-tertiary">获得: </span>
                          <span className="text-success">
                            +{parseFloat(record.to_amount).toFixed(4)} {toConfig.label}
                          </span>
                        </div>
                      </div>

                      {/* 底部信息 */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-primary text-xs text-text-tertiary">
                        <span>
                          比例: 1:{parseFloat(record.exchange_rate).toFixed(4)}
                          {record.mode && ` (${record.mode === 'standard' ? '标准' : '急速'})`}
                        </span>
                        <span>{formatTime(record.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => { setPage(page - 1); haptic('selection'); }}
                >
                  上一页
                </button>
                <span className="text-sm text-text-secondary">
                  {page} / {totalPages}
                </span>
                <button
                  className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => { setPage(page + 1); haptic('selection'); }}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 待释放订单列表 */}
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
              </div>
            ) : vestingOrders.length === 0 ? (
              <div className="text-center py-12 text-text-tertiary">
                暂无待释放订单
              </div>
            ) : (
              <div className="space-y-3">
                {vestingOrders.map((order) => {
                  const daysRemaining = Math.ceil(
                    (new Date(order.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  const isCompleted = order.progress >= 100;

                  return (
                    <div key={order.id} className="bg-bg-secondary border border-border-primary rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">
                            #{order.id.slice(0, 8)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">
                            积分兑换
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            isCompleted
                              ? 'bg-success/20 text-success'
                              : 'bg-warning/20 text-warning'
                          }`}
                        >
                          {isCompleted ? '已完成' : '释放中'}
                        </span>
                      </div>

                      {/* 代币释放详情 */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                          <p className="text-white font-semibold">
                            {parseFloat(order.totalAmount).toFixed(2)}
                          </p>
                          <p className="text-text-tertiary text-xs">代币总量</p>
                        </div>
                        <div>
                          <p className="text-success font-semibold">
                            {parseFloat(order.releasedAmount).toFixed(2)}
                          </p>
                          <p className="text-text-tertiary text-xs">已释放</p>
                        </div>
                        <div>
                          <p className="text-warning font-semibold">
                            {parseFloat(order.remainingAmount).toFixed(2)}
                          </p>
                          <p className="text-text-tertiary text-xs">待释放</p>
                        </div>
                      </div>

                      {/* 释放进度条 */}
                      <div className="w-full bg-bg-tertiary rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isCompleted ? 'bg-success' : 'bg-brand-primary'
                          }`}
                          style={{ width: `${order.progress}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-xs text-text-tertiary">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          每日 {parseFloat(order.dailyRelease).toFixed(4)} QFI
                        </span>
                        {!isCompleted && daysRemaining > 0 && (
                          <span>剩余 {daysRemaining} 天</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
