'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface BillingRecord {
  id: string;
  type: 'deposit' | 'withdraw' | 'fee' | 'reward' | 'refund';
  amount: string;
  balance: string;
  description: string;
  time: string;
  status: 'completed' | 'pending' | 'failed';
}

interface BillingResponse {
  records: BillingRecord[];
  total: number;
  page: number;
  limit: number;
}

const typeConfig: Record<string, { icon: typeof ArrowDownLeft; color: string; label: string }> = {
  deposit: { icon: ArrowDownLeft, color: 'text-success', label: '充值' },
  withdraw: { icon: ArrowUpRight, color: 'text-danger', label: '提现' },
  fee: { icon: ArrowUpRight, color: 'text-warning', label: '手续费' },
  reward: { icon: ArrowDownLeft, color: 'text-brand-primary', label: '奖励' },
  refund: { icon: ArrowDownLeft, color: 'text-success', label: '退款' },
};

export default function TgBillingPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>('all');

  const fetchBilling = async (pageNum: number = 1) => {
    try {
      const response = await api.get('/telegram/billing', {
        params: { page: pageNum, limit: 20 },
      });
      setData(response.data);
    } catch (error) {
      console.error('获取账单记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchBilling(1);
      setPage(1);
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchBilling();
  }, []);

  const filteredRecords = data?.records.filter((record) => {
    if (filter === 'all') return true;
    return record.type === filter;
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-12 bg-bg-tertiary/50 rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { haptic('selection'); router.back(); }}
            className="flex items-center gap-2 text-text-secondary"
          >
            <ArrowLeft size={20} />
            <span className="text-lg font-medium text-white">账单明细</span>
          </button>
          <span className="text-sm text-text-tertiary">
            共 {data?.total || 0} 条
          </span>
        </div>

        {/* 筛选器 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all', label: '全部' },
            { key: 'deposit', label: '充值' },
            { key: 'withdraw', label: '提现' },
            { key: 'fee', label: '手续费' },
            { key: 'reward', label: '奖励' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => { setFilter(item.key); haptic('selection'); }}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                filter === item.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-secondary text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 账单列表 */}
        {!filteredRecords || filteredRecords.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary">暂无账单记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecords.map((record) => {
              const config = typeConfig[record.type] || typeConfig.deposit;
              const Icon = config.icon;
              const amount = parseFloat(record.amount);
              const isIncome = ['deposit', 'reward', 'refund'].includes(record.type);

              return (
                <div
                  key={record.id}
                  className="bg-bg-secondary border border-border-primary rounded-xl p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isIncome ? 'bg-success/10' : 'bg-danger/10'
                      }`}>
                        <Icon size={16} className={config.color} />
                      </div>
                      <div>
                        <p className="text-sm text-white">{record.description || config.label}</p>
                        <p className="text-xs text-text-tertiary">
                          {new Date(record.time).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${isIncome ? 'text-success' : 'text-danger'}`}>
                        {isIncome ? '+' : '-'}{Math.abs(amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        余额: {parseFloat(record.balance).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 加载更多 */}
        {data && data.total > (page * 20) && (
          <button
            onClick={() => {
              setPage(p => p + 1);
              fetchBilling(page + 1);
              haptic('selection');
            }}
            className="w-full py-3 text-center text-sm text-brand-primary"
          >
            加载更多
          </button>
        )}
      </div>
    </>
  );
}
