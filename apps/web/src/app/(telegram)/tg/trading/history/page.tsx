'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface Trade {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  profit: string;
  profitPercent: string;
  time: string;
  strategyName: string;
}

interface TradesResponse {
  trades: Trade[];
  total: number;
  page: number;
  limit: number;
}

export default function TgTradingHistoryPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<TradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'profit' | 'loss'>('all');

  const fetchTrades = async (pageNum: number = 1) => {
    try {
      const response = await api.get('/telegram/trades', {
        params: { page: pageNum, limit: 20 },
      });
      setData(response.data);
    } catch (error) {
      console.error('获取交易历史失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchTrades(1);
      setPage(1);
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchTrades();
  }, []);

  const filteredTrades = data?.trades.filter((trade) => {
    if (filter === 'all') return true;
    const profit = parseFloat(trade.profit);
    if (filter === 'profit') return profit >= 0;
    return profit < 0;
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-12 bg-bg-tertiary/50 rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-bg-tertiary/50 rounded-xl" />
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
            <span className="text-lg font-medium text-white">交易历史</span>
          </button>
          <span className="text-sm text-text-tertiary">
            共 {data?.total || 0} 笔
          </span>
        </div>

        {/* 筛选器 */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'profit', label: '盈利' },
            { key: 'loss', label: '亏损' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => { setFilter(item.key as any); haptic('selection'); }}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                filter === item.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-secondary text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 交易列表 */}
        {!filteredTrades || filteredTrades.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary">暂无交易记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrades.map((trade) => {
              const profit = parseFloat(trade.profit);
              const profitPercent = parseFloat(trade.profitPercent);
              const isProfit = profit >= 0;

              return (
                <div
                  key={trade.id}
                  className="bg-bg-secondary border border-border-primary rounded-xl p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{trade.pair}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        trade.side === 'buy'
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger'
                      }`}>
                        {trade.side === 'buy' ? '买入' : '卖出'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isProfit ? (
                        <TrendingUp size={14} className="text-success" />
                      ) : (
                        <TrendingDown size={14} className="text-danger" />
                      )}
                      <span className={`text-sm font-medium ${isProfit ? 'text-success' : 'text-danger'}`}>
                        {isProfit ? '+' : ''}{profit.toFixed(2)}
                      </span>
                      <span className={`text-xs ${isProfit ? 'text-success' : 'text-danger'}`}>
                        ({isProfit ? '+' : ''}{profitPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-tertiary">
                    <span>{trade.strategyName}</span>
                    <span>{new Date(trade.time).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-primary/50 text-xs">
                    <span className="text-text-tertiary">
                      数量: {parseFloat(trade.amount).toFixed(4)}
                    </span>
                    <span className="text-text-tertiary">
                      价格: ${parseFloat(trade.price).toFixed(2)}
                    </span>
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
              fetchTrades(page + 1);
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
