'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { gamefiApi } from '@/lib/api';
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface VestingOrder {
  id: string;
  totalAmount: string;
  releasedAmount: string;
  remainingAmount: string;
  startDate: string;
  endDate: string;
  dailyRelease: string;
  progress: number;
  orderType: 'exchange' | 'dividend';  // 订单类型
  sourceType?: string;                 // 来源类型 (weekly_reward | buyback)
}

export default function TgVestingPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [loading, setLoading] = useState(true);
  const [totalVesting, setTotalVesting] = useState('0');
  const [totalReleased, setTotalReleased] = useState('0');
  const [orders, setOrders] = useState<VestingOrder[]>([]);

  const fetchData = async () => {
    try {
      const res = await gamefiApi.getVestingProgress();
      setTotalVesting(res.data?.pending || '0');
      setTotalReleased(res.data?.released || '0');

      const vestingOrders = (res.data?.vestingOrders || []).map((order: any) => ({
        id: order.orderId,
        totalAmount: order.tokensTotal,
        releasedAmount: order.tokensReleased,
        remainingAmount: order.tokensPending,
        startDate: order.vestingStartAt,
        endDate: order.vestingEndAt,
        dailyRelease: (parseFloat(order.tokensTotal) / 90).toFixed(8),
        progress: order.progress,
        orderType: order.orderType || 'exchange',
        sourceType: order.sourceType,
      }));
      setOrders(vestingOrders);
    } catch (error) {
      console.error('Failed to fetch vesting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchData();
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const calculateProgress = () => {
    const vesting = parseFloat(totalVesting);
    const released = parseFloat(totalReleased);
    if (vesting === 0 && released === 0) return 0;
    return Math.round((released / (vesting + released)) * 100);
  };

  const dailyTotal = orders.reduce((sum, order) => sum + parseFloat(order.dailyRelease), 0);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
          <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        </div>
        <div className="h-20 bg-bg-tertiary/50 rounded-xl" />
        {[1, 2].map((i) => (
          <div key={i} className="h-40 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部 */}
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">释放进度</span>
        </button>

        {/* 总览卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-text-tertiary text-xs">待释放</span>
            </div>
            <p className="text-xl font-bold text-white">
              {parseFloat(totalVesting).toLocaleString()}
            </p>
            <p className="text-text-tertiary text-xs mt-1">$QFI</p>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-text-tertiary text-xs">已释放</span>
            </div>
            <p className="text-xl font-bold text-success">
              {parseFloat(totalReleased).toLocaleString()}
            </p>
            <p className="text-text-tertiary text-xs mt-1">$QFI</p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-secondary text-sm">总进度</span>
            <span className="text-brand-primary font-bold">{calculateProgress()}%</span>
          </div>
          <div className="w-full bg-bg-tertiary rounded-full h-2">
            <div
              className="bg-brand-primary h-2 rounded-full transition-all"
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
        </div>

        {/* 每日释放 */}
        <div className="bg-gradient-to-r from-brand-primary/20 to-brand-primary/10 border border-brand-primary/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">每日释放预估</p>
              <p className="text-2xl font-bold text-brand-primary mt-1">
                {dailyTotal.toFixed(4)} $QFI
              </p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-brand-primary" />
            </div>
          </div>
        </div>

        {/* 订单列表 */}
        <div className="space-y-2">
          <h3 className="text-white font-medium">释放订单</h3>
          {orders.length === 0 ? (
            <div className="py-12 text-center bg-bg-secondary border border-border-primary rounded-xl">
              <Clock className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary">暂无释放订单</p>
              <p className="text-text-tertiary text-xs mt-1">完成积分兑换后会出现在这里</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const daysRemaining = Math.ceil(
                  (new Date(order.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isCompleted = order.progress >= 100;

                return (
                  <div
                    key={order.id}
                    className="bg-bg-secondary border border-border-primary rounded-xl p-4 space-y-3"
                  >
                    {/* 订单标题 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium text-sm">
                            订单 #{order.id.slice(0, 8)}
                          </h4>
                          {/* 订单来源标签 */}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            order.orderType === 'dividend'
                              ? 'bg-brand-primary/20 text-brand-primary'
                              : 'bg-bg-tertiary text-text-secondary'
                          }`}>
                            {order.orderType === 'dividend' ? '周分红' : '积分兑换'}
                          </span>
                        </div>
                        <p className="text-text-tertiary text-xs mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.startDate).toLocaleDateString('zh-CN')} -
                          {new Date(order.endDate).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        isCompleted
                          ? 'bg-success/20 text-success'
                          : 'bg-brand-primary/20 text-brand-primary'
                      }`}>
                        {isCompleted ? '已完成' : '释放中'}
                      </span>
                    </div>

                    {/* 数量信息 */}
                    <div className="grid grid-cols-3 gap-2 py-2 bg-bg-tertiary/50 rounded-lg px-3">
                      <div className="text-center">
                        <p className="text-white font-semibold text-sm">
                          {parseFloat(order.totalAmount).toFixed(2)}
                        </p>
                        <p className="text-text-tertiary text-[10px]">总数量</p>
                      </div>
                      <div className="text-center">
                        <p className="text-success font-semibold text-sm">
                          {parseFloat(order.releasedAmount).toFixed(2)}
                        </p>
                        <p className="text-text-tertiary text-[10px]">已释放</p>
                      </div>
                      <div className="text-center">
                        <p className="text-warning font-semibold text-sm">
                          {parseFloat(order.remainingAmount).toFixed(2)}
                        </p>
                        <p className="text-text-tertiary text-[10px]">待释放</p>
                      </div>
                    </div>

                    {/* 进度条 */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-text-tertiary">释放进度</span>
                        <span className="text-white font-medium">{order.progress}%</span>
                      </div>
                      <div className="w-full bg-bg-tertiary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isCompleted ? 'bg-success' : 'bg-brand-primary'
                          }`}
                          style={{ width: `${order.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* 底部信息 */}
                    <div className="flex justify-between items-center pt-2 border-t border-border-primary">
                      <div>
                        <p className="text-text-tertiary text-xs">每日释放</p>
                        <p className="text-white font-medium text-sm">
                          {parseFloat(order.dailyRelease).toFixed(4)}/天
                        </p>
                      </div>
                      {!isCompleted && daysRemaining > 0 && (
                        <div className="text-right">
                          <p className="text-text-tertiary text-xs">剩余时间</p>
                          <p className="text-white font-medium text-sm">{daysRemaining} 天</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
