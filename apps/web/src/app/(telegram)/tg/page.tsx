'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Zap,
  Gift,
  Bell,
  ChevronRight,
  Coins,
  Server,
  RefreshCw,
} from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/error-state';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface DashboardData {
  user: {
    id: string;
    email?: string;
    telegramUsername?: string;
    telegramFirstName?: string;
    vipLevel: number;
  };
  wallet: {
    usdtBalance: string;
    pointsBalance: string;
    tokenBalance: string;
  };
  todayPnl: {
    amount: string;
    percentage: string;
    trades: number;
  };
  activeStrategies: number;
  instanceStatus: 'running' | 'stopped' | 'none';
  latestAnnouncement?: {
    id: string;
    title: string;
    type: string;
  };
}

export default function TelegramDashboard() {
  const { user, haptic } = useTelegramContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/telegram/dashboard');
      setData(response.data);
    } catch (err: any) {
      console.error('获取仪表盘数据失败:', err);
      setError(err.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 下拉刷新
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchDashboard();
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4">
        {/* 用户信息骨架 */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-bg-tertiary animate-pulse" />
          <div>
            <div className="h-5 w-24 bg-bg-tertiary rounded animate-pulse mb-2" />
            <div className="h-4 w-16 bg-bg-tertiary rounded animate-pulse" />
          </div>
        </div>
        {/* 资产卡片骨架 */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <div className="h-4 w-24 bg-bg-tertiary rounded animate-pulse mb-4" />
          <div className="h-8 w-32 bg-bg-tertiary rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-12 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-12 bg-bg-tertiary rounded animate-pulse" />
          </div>
        </div>
        {/* 今日盈亏骨架 */}
        <div className="h-24 bg-bg-secondary rounded-xl animate-pulse" />
        {/* 快捷操作骨架 */}
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-bg-secondary rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <ErrorState
        title="加载失败"
        message={error}
        onRetry={fetchDashboard}
      />
    );
  }

  const pnlAmount = parseFloat(data?.todayPnl.amount || '0');
  const pnlPercentage = parseFloat(data?.todayPnl.percentage || '0');
  const isProfit = pnlAmount >= 0;

  return (
    <>
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />
      <div className="space-y-4">
      {/* 用户信息 */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-lg">
          {user?.first_name?.[0] || 'U'}
        </div>
        <div>
          <h1 className="font-semibold text-text-primary">
            {user?.first_name || '用户'}
            {user?.username && <span className="text-text-tertiary ml-1">@{user.username}</span>}
          </h1>
          <p className="text-sm text-text-secondary">
            VIP {data?.user.vipLevel || 0}
          </p>
        </div>
      </div>

      {/* 公告 */}
      {data?.latestAnnouncement && (
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-3 flex items-center gap-3">
          <Bell size={18} className="text-warning flex-shrink-0" />
          <p className="text-sm text-text-secondary flex-1 truncate">
            {data.latestAnnouncement.title}
          </p>
          <ChevronRight size={16} className="text-text-tertiary" />
        </div>
      )}

      {/* 资产卡片 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm text-text-secondary">总资产 (USDT)</h2>
          <Link
            href="/tg/wallet"
            className="text-sm text-brand-primary"
            onClick={() => haptic('selection')}
          >
            详情
          </Link>
        </div>
        <p className="text-2xl font-bold text-text-primary mb-4">
          ${parseFloat(data?.wallet.usdtBalance || '0').toFixed(2)}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-warning" />
            <div>
              <p className="text-xs text-text-tertiary">积分</p>
              <p className="text-sm text-text-primary">
                {parseFloat(data?.wallet.pointsBalance || '0').toFixed(0)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-brand-primary" />
            <div>
              <p className="text-xs text-text-tertiary">QFI</p>
              <p className="text-sm text-text-primary">
                {parseFloat(data?.wallet.tokenBalance || '0').toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 今日盈亏 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm text-text-secondary mb-1">今日盈亏</h2>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${isProfit ? 'text-success' : 'text-danger'}`}>
                {isProfit ? '+' : ''}{pnlAmount.toFixed(2)}
              </span>
              <span className={`text-sm ${isProfit ? 'text-success' : 'text-danger'}`}>
                ({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className={`p-3 rounded-full ${isProfit ? 'bg-success/10' : 'bg-danger/10'}`}>
            {isProfit ? (
              <TrendingUp size={24} className="text-success" />
            ) : (
              <TrendingDown size={24} className="text-danger" />
            )}
          </div>
        </div>
        <p className="text-xs text-text-tertiary mt-2">
          今日交易 {data?.todayPnl.trades || 0} 笔
        </p>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-4 gap-3">
        <Link
          href="/tg/wallet/deposit"
          className="flex flex-col items-center gap-2 p-3 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => haptic('selection')}
        >
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
            <Wallet size={20} className="text-success" />
          </div>
          <span className="text-xs text-text-secondary">充值</span>
        </Link>

        <Link
          href="/tg/strategies"
          className="flex flex-col items-center gap-2 p-3 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => haptic('selection')}
        >
          <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
            <Zap size={20} className="text-brand-primary" />
          </div>
          <span className="text-xs text-text-secondary">策略</span>
        </Link>

        <Link
          href="/tg/checkin"
          className="flex flex-col items-center gap-2 p-3 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => haptic('selection')}
        >
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
            <Gift size={20} className="text-warning" />
          </div>
          <span className="text-xs text-text-secondary">签到</span>
        </Link>

        <Link
          href="/tg/invite"
          className="flex flex-col items-center gap-2 p-3 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => haptic('selection')}
        >
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-500"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="text-xs text-text-secondary">邀请</span>
        </Link>
      </div>

      {/* 运行状态 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server size={20} className="text-text-tertiary" />
            <div>
              <h3 className="text-sm text-text-primary">交易机器人</h3>
              <p className="text-xs text-text-tertiary">
                {data?.activeStrategies || 0} 个策略运行中
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                data?.instanceStatus === 'running'
                  ? 'bg-success'
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
      </div>
    </>
  );
}
