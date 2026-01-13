'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { strategiesApi } from '@/lib/api';
import {
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileCode,
  Eye,
  ArrowDownCircle,
  Clock,
  Play,
  ArrowLeft,
} from 'lucide-react';

interface MyStrategy {
  id: string;
  name: string;
  reviewStatus: string;
  createdAt: string;
  totalUsers: number;
  backtestWinRate?: string;
  backtestMaxDrawdown?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
}

interface RevenueStats {
  totalRevenue: string;
  pendingRevenue: string;
  settledRevenue: string;
}

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'approved', label: '已上架' },
  { key: 'rejected', label: '已下架' },
  { key: 'pending_review', label: '审核中' },
];

export default function TgStrategyManagePage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<MyStrategy[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [strategiesRes, revenueRes] = await Promise.all([
        strategiesApi.getMyUploads().catch(() => ({ data: [] })),
        strategiesApi.getRevenueStats().catch(() => ({ data: null })),
      ]);
      setStrategies(strategiesRes.data || []);
      setRevenueStats(revenueRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStrategies = useMemo(() => {
    if (filter === 'all') return strategies;
    return strategies.filter(s => s.reviewStatus === filter);
  }, [strategies, filter]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: '已上架' };
      case 'pending_review':
        return { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', label: '待审核' };
      case 'rejected':
        return { icon: XCircle, color: 'text-danger', bg: 'bg-danger/10', label: '已拒绝' };
      case 'backtest_running':
        return { icon: Loader2, color: 'text-brand-primary', bg: 'bg-brand-primary/10', label: '回测中' };
      default:
        return { icon: FileCode, color: 'text-text-secondary', bg: 'bg-bg-tertiary', label: '草稿' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        <div className="h-10 bg-bg-tertiary/50 rounded-lg" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 返回按钮 */}
      <button
        onClick={() => { haptic('selection'); router.back(); }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">策略管理</span>
      </button>

      {/* 收益概览 */}
      <div className="bg-gradient-to-r from-success/10 to-brand-primary/10 border border-success/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-success" />
          <span className="text-white font-medium">我的收益</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-text-tertiary text-xs">总收益</p>
            <p className="text-lg font-bold text-success">
              ${parseFloat(revenueStats?.totalRevenue || '0').toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">今日</p>
            <p className="text-lg font-bold text-brand-primary">
              ${parseFloat(revenueStats?.pendingRevenue || '0').toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">本月</p>
            <p className="text-lg font-bold text-white">
              ${parseFloat(revenueStats?.settledRevenue || '0').toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); haptic('selection'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              filter === f.key
                ? 'bg-brand-primary text-white'
                : 'bg-bg-secondary text-text-secondary'
            }`}
          >
            {f.label}
            {f.key === 'all' && ` (${strategies.length})`}
          </button>
        ))}
      </div>

      {/* 策略列表 */}
      {filteredStrategies.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-3">
            <FileCode className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-base font-medium text-white mb-2">暂无策略</h3>
          <p className="text-text-secondary text-sm mb-4">
            {filter === 'all' ? '创建策略后可在这里管理' : `没有${FILTERS.find(f => f.key === filter)?.label}的策略`}
          </p>
          <Link
            href="/tg/strategies/my"
            onClick={() => haptic('selection')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white text-sm rounded-lg"
          >
            去我的策略
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStrategies.map((strategy) => {
            const statusStyle = getStatusStyle(strategy.reviewStatus);
            const StatusIcon = statusStyle.icon;
            const winRate = parseFloat(strategy.backtestWinRate || '0');
            const drawdown = parseFloat(strategy.backtestMaxDrawdown || '0');
            const sharpe = (winRate / (drawdown || 1) * 0.5).toFixed(2);

            return (
              <div
                key={strategy.id}
                className="bg-bg-secondary border border-border-primary rounded-xl p-3"
              >
                {/* 标题行 */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium text-sm truncate flex-1">{strategy.name}</h3>
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${statusStyle.bg} ${statusStyle.color}`}>
                    <StatusIcon className={`w-3 h-3 ${strategy.reviewStatus === 'backtest_running' ? 'animate-spin' : ''}`} />
                    {statusStyle.label}
                  </span>
                </div>

                {/* 指标 */}
                <div className="grid grid-cols-4 gap-2 py-2 bg-bg-tertiary/50 rounded-md px-2 mb-2">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">{winRate.toFixed(0)}%</p>
                    <p className="text-[10px] text-text-tertiary">胜率</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-danger">-{drawdown.toFixed(0)}%</p>
                    <p className="text-[10px] text-text-tertiary">回撤</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">{sharpe}</p>
                    <p className="text-[10px] text-text-tertiary">夏普</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-brand-primary">{strategy.totalUsers}</p>
                    <p className="text-[10px] text-text-tertiary">订阅</p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tg/strategies/${strategy.id}`}
                    onClick={() => haptic('selection')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-text-secondary bg-bg-tertiary rounded-lg"
                  >
                    <Eye className="w-3 h-3" />
                    详情
                  </Link>
                  {strategy.reviewStatus === 'approved' && (
                    <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-danger bg-danger/10 rounded-lg">
                      <ArrowDownCircle className="w-3 h-3" />
                      下架
                    </button>
                  )}
                  {strategy.reviewStatus === 'rejected' && (
                    <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-brand-primary bg-brand-primary/10 rounded-lg">
                      <Play className="w-3 h-3" />
                      重新提交
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
