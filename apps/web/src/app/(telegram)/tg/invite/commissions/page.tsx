'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { ArrowLeft, RefreshCw, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { userApi } from '@/lib/api';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface CommissionRecord {
  id: string;
  amount: string;
  type: string;
  sourceUserId: string;
  sourceUserEmail: string;
  level: number;
  description: string;
  createdAt: string;
}

interface CommissionStats {
  totalCommission: string;
  thisMonthCommission: string;
  pendingCommission: string;
}

export default function TgInviteCommissionsPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchData = async () => {
    try {
      const [recordsRes, statsRes] = await Promise.all([
        userApi.getCommissionHistory({ page, limit }),
        userApi.getCommissionStats(),
      ]);

      if (recordsRes.code === 0 && recordsRes.data) {
        setRecords(recordsRes.data.items || []);
        setTotal(recordsRes.data.total || 0);
      }

      if (statsRes.code === 0 && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('获取返佣记录失败:', error);
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
  }, [page]);

  // 脱敏邮箱
  const maskEmail = (email: string) => {
    if (!email) return '***';
    return email.replace(/(.{2}).*(@.*)/, '$1***$2');
  };

  // 格式化时间
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部导航 */}
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">返佣明细</span>
        </button>

        {/* 统计概览 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-3">
            <p className="text-xs text-text-tertiary mb-1">累计返佣</p>
            <p className="text-lg font-bold text-success">
              ${parseFloat(stats?.totalCommission || '0').toFixed(2)}
            </p>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-3">
            <p className="text-xs text-text-tertiary mb-1">本月返佣</p>
            <p className="text-lg font-bold text-white">
              ${parseFloat(stats?.thisMonthCommission || '0').toFixed(2)}
            </p>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-3">
            <p className="text-xs text-text-tertiary mb-1">待结算</p>
            <p className="text-lg font-bold text-warning">
              ${parseFloat(stats?.pendingCommission || '0').toFixed(2)}
            </p>
          </div>
        </div>

        {/* 返佣记录列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-text-tertiary">
            暂无返佣记录
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-bg-secondary border border-border-primary rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">
                        {record.description || '邀请返佣'}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        来自 {maskEmail(record.sourceUserEmail)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-success font-semibold">
                      +${parseFloat(record.amount).toFixed(2)}
                    </p>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      record.level === 1
                        ? 'bg-brand-primary/20 text-brand-primary'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {record.level === 1 ? '一级' : '二级'}返佣
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-text-tertiary">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(record.createdAt)}</span>
                </div>
              </div>
            ))}
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
      </div>
    </>
  );
}
