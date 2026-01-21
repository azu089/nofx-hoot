'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader } from '@/components/ui';
import { tradingApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  History,
  TrendingUp,
  TrendingDown,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  X,
} from 'lucide-react';

interface Trade {
  id: string;
  instance_id: string;
  pair: string;
  side: string;
  amount: string;
  entry_price: string;    // 开仓价
  exit_price: string;     // 平仓价
  leverage?: number;      // 杠杆倍数
  pnl: string;
  pnl_percentage?: string; // 盈亏百分比
  fee: string;            // 手续费
  gas_fee?: string;       // 燃油费(平台抽成)
  executed_at: string;
  closed_at?: string;     // 平仓时间

  // 兼容旧字段
  price?: string;         // 兼容旧API,优先使用 entry_price
}

interface TradeStats {
  totalTrades: number;
  winRate: string;
  totalPnl: string;
  avgProfit: string;
  avgLoss: string;
  bestTrade: string;
  worstTrade: string;
}

export default function TradingHistoryPage() {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // 筛选条件
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tradeParams: {
        pnl_status?: 'all' | 'profit' | 'loss';
        start_date?: string;
        end_date?: string;
        limit: number;
        offset: number;
      } = {
        limit,
        offset: page * limit,
      };

      if (filterStatus !== 'all') {
        tradeParams.pnl_status = filterStatus as 'profit' | 'loss';
      }

      if (dateRange.start) {
        tradeParams.start_date = dateRange.start;
      }
      if (dateRange.end) {
        tradeParams.end_date = dateRange.end;
      }

      const [tradesRes, statsRes] = await Promise.all([
        tradingApi.getTrades(tradeParams),
        tradingApi.getStats(),
      ]);

      const tradesData = tradesRes.data?.trades || [];
      const statsData = statsRes.data;

      // 映射 API 数据到 Trade 类型
      const mappedTrades: Trade[] = tradesData.map((trade: any) => ({
        ...trade,
        entry_price: trade.entry_price || trade.price || '0',
        exit_price: trade.exit_price || trade.close_price || '0',
      }));
      setTrades(mappedTrades);
      setTotal(tradesRes.data?.total || 0);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);

      // 出错时设置空数据
      setTrades([]);
      setTotal(0);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
  }, [filterStatus, dateRange.start, dateRange.end]);

  useEffect(() => {
    fetchData();
  }, [page, filterStatus, dateRange.start, dateRange.end]);

  const handleExport = () => {
    const content = trades
      .map(
        (trade) =>
          `${formatDateTime(trade.executed_at)},${trade.pair},${trade.side},${trade.amount},${trade.price},${trade.pnl},${trade.fee}`
      )
      .join('\n');
    const header = '时间,交易对,方向,数量,价格,盈亏,手续费\n';
    const blob = new Blob([header + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setDateRange({ start: '', end: '' });
  };

  const hasActiveFilters = filterStatus !== 'all' || dateRange.start || dateRange.end;
  const totalPages = Math.ceil(total / limit);

  if (loading && trades.length === 0) {
    return (
      <div className="space-y-4">
        <MobileHeader title="交易历史" />
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-bg-tertiary rounded-xl" />
          <div className="h-16 bg-bg-tertiary rounded-xl" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <MobileHeader
        title="交易历史"
        rightAction={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'text-brand-primary' : ''}
            >
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* 统计摘要 - 简化为一行 */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-3 text-center">
            <p className="text-text-tertiary text-xs mb-1">总交易</p>
            <p className="text-white font-bold">{stats.totalTrades || 0}</p>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-3 text-center">
            <p className="text-text-tertiary text-xs mb-1">胜率</p>
            <p className="text-white font-bold">
              {isNaN(parseFloat(stats.winRate || '0'))
                ? '0'
                : (parseFloat(stats.winRate) * 100).toFixed(0)}
              %
            </p>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-3 text-center">
            <p className="text-text-tertiary text-xs mb-1">累计盈亏</p>
            <p
              className={`font-bold ${
                parseFloat(stats.totalPnl || '0') >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {isNaN(parseFloat(stats.totalPnl || '0'))
                ? '$0.00'
                : `${parseFloat(stats.totalPnl) >= 0 ? '+' : ''}$${Math.abs(
                    parseFloat(stats.totalPnl)
                  ).toFixed(2)}`}
            </p>
          </div>
        </div>
      )}

      {/* 筛选器 - 可折叠 */}
      {showFilters && (
        <Card className="border-brand-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm font-medium">筛选条件</span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-brand-primary flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  清除
                </button>
              )}
            </div>

            {/* 盈亏状态 */}
            <div className="flex gap-2">
              {[
                { value: 'all', label: '全部' },
                { value: 'profit', label: '盈利' },
                { value: 'loss', label: '亏损' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilterStatus(item.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === item.value
                      ? 'bg-brand-primary text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* 日期范围 */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-tertiary" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="flex-1 bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-white text-sm"
              />
              <span className="text-text-tertiary">-</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="flex-1 bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 交易列表 */}
      <div className="space-y-2">
        {trades.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="w-12 h-12 mx-auto mb-3 text-text-tertiary opacity-50" />
              <p className="text-text-secondary">暂无交易记录</p>
              <p className="text-text-tertiary text-sm mt-1">开始交易后，记录会显示在这里</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {trades.map((trade) => {
              const pnl = parseFloat(trade.pnl || '0');
              const amount = parseFloat(trade.amount || '0');
              const entryPrice = parseFloat(trade.entry_price || trade.price || '0');
              const exitPrice = parseFloat(trade.exit_price || '0');
              const pnlPercentage = trade.pnl_percentage ? parseFloat(trade.pnl_percentage) : null;
              const fee = parseFloat(trade.fee || '0');
              const gasFee = trade.gas_fee ? parseFloat(trade.gas_fee) : 0;
              const leverage = trade.leverage || 1;
              const isProfitable = pnl >= 0;
              const isBuy = trade.side.toLowerCase() === 'buy';

              return (
                <div
                  key={trade.id}
                  className="bg-bg-secondary border border-border-primary rounded-xl p-4 space-y-3"
                >
                  {/* 第一行：交易对 + 方向标签 + 杠杆 + 盈亏 */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-base">{trade.pair}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          isBuy
                            ? 'bg-success/20 text-success'
                            : 'bg-danger/20 text-danger'
                        }`}
                      >
                        {isBuy ? '做多' : '做空'}
                      </span>
                      {leverage > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-warning/20 text-warning">
                          {leverage}x
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        {isProfitable ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-danger" />
                        )}
                        <span
                          className={`font-bold text-lg ${
                            isProfitable ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {isProfitable ? '+' : ''}
                          {formatCurrency(trade.pnl || '0')}
                        </span>
                      </div>
                      {pnlPercentage !== null && (
                        <p className={`text-xs mt-0.5 ${isProfitable ? 'text-success' : 'text-danger'}`}>
                          {isProfitable ? '+' : ''}{pnlPercentage.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 第二行：开仓价 → 平仓价 */}
                  <div className="flex items-center justify-between bg-bg-tertiary/30 rounded-lg p-2.5">
                    {/* 开仓价 */}
                    <div className="flex-1">
                      <p className="text-text-tertiary text-xs mb-0.5">开仓价</p>
                      <p className="text-text-primary font-mono text-sm font-medium">
                        {isNaN(entryPrice) ? '$0.00' : formatCurrency(entryPrice.toString())}
                      </p>
                    </div>

                    {/* 箭头 */}
                    <div className="px-3 text-text-tertiary text-lg">→</div>

                    {/* 平仓价 */}
                    <div className="flex-1 text-right">
                      <p className="text-text-tertiary text-xs mb-0.5">平仓价</p>
                      <p className={`font-mono text-sm font-medium ${isProfitable ? 'text-success' : 'text-danger'}`}>
                        {isNaN(exitPrice) ? '$0.00' : formatCurrency(exitPrice.toString())}
                      </p>
                    </div>
                  </div>

                  {/* 第三行：数量 + 手续费 + 燃油费 */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-text-tertiary mb-0.5">数量</p>
                      <p className="text-text-primary font-mono">
                        {isNaN(amount) ? '0.0000' : amount.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary mb-0.5">手续费</p>
                      <p className="text-text-primary font-mono">
                        ${isNaN(fee) ? '0.00' : fee.toFixed(2)}
                      </p>
                    </div>
                    {gasFee > 0 && (
                      <div>
                        <p className="text-text-tertiary mb-0.5">燃油费</p>
                        <p className="text-warning font-mono">
                          ${gasFee.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 第四行：时间 */}
                  <div className="flex items-center justify-between text-xs text-text-tertiary pt-1 border-t border-border-primary/30">
                    <span>开仓：{formatDateTime(trade.executed_at)}</span>
                    {trade.closed_at && (
                      <span>平仓：{formatDateTime(trade.closed_at)}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-text-secondary text-sm">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page === totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
