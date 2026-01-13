'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { strategiesApi } from '@/lib/api';
import {
  Plus,
  FileCode,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  TrendingUp,
  Users,
  ArrowLeft,
} from 'lucide-react';

interface MyStrategy {
  id: string;
  name: string;
  description: string | null;
  reviewStatus: string;
  createdAt: string;
  totalUsers: number;
  backtestTotalReturn?: string;
  backtestWinRate?: string;
  backtestMaxDrawdown?: string;
}

export default function TgMyStrategiesPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<MyStrategy[]>([]);

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      const response = await strategiesApi.getMyUploads();
      setStrategies(response.data || []);
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: '已上架' };
      case 'pending_review':
        return { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', label: '审核中' };
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
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">我的策略</span>
        </button>
        <Link
          href="/tg/strategies/create"
          onClick={() => haptic('selection')}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-white text-sm rounded-lg"
        >
          <Plus size={16} />
          创建
        </Link>
      </div>

      {/* 空状态 */}
      {strategies.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
            <FileCode className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-base font-medium text-white mb-2">还没有策略</h3>
          <p className="text-text-secondary text-sm mb-4">创建您的第一个量化策略</p>
          <Link
            href="/tg/strategies/create"
            onClick={() => haptic('selection')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white text-sm rounded-lg"
          >
            <Plus size={16} />
            创建策略
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map((strategy) => {
            const statusStyle = getStatusStyle(strategy.reviewStatus);
            const StatusIcon = statusStyle.icon;
            const winRate = parseFloat(strategy.backtestWinRate || '0');
            const drawdown = parseFloat(strategy.backtestMaxDrawdown || '0');

            return (
              <Link
                key={strategy.id}
                href={`/tg/strategies/${strategy.id}`}
                onClick={() => haptic('selection')}
                className="block bg-bg-secondary border border-border-primary rounded-xl p-4"
              >
                {/* 标题行 */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-white truncate flex-1">{strategy.name}</h3>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusStyle.bg} ${statusStyle.color}`}>
                    <StatusIcon className={`w-3 h-3 ${strategy.reviewStatus === 'backtest_running' ? 'animate-spin' : ''}`} />
                    {statusStyle.label}
                  </span>
                </div>

                {/* 指标 */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-text-tertiary mb-0.5">胜率</p>
                    <p className="text-sm font-medium text-success">{winRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-0.5">最大回撤</p>
                    <p className="text-sm font-medium text-danger">-{drawdown.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-0.5">订阅数</p>
                    <p className="text-sm font-medium text-text-primary">{strategy.totalUsers}</p>
                  </div>
                </div>

                {/* 底部 */}
                <div className="flex items-center justify-between pt-3 border-t border-border-primary/50">
                  <span className="text-xs text-text-tertiary">
                    {new Date(strategy.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1 text-brand-primary">
                    <span className="text-xs">查看详情</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
