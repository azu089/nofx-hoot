'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { tradingApi, instancesApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { History, TrendingUp, TrendingDown, Filter, Download, ArrowLeft, Search } from 'lucide-react';

interface Trade {
  id: string;
  instance_id: string;
  pair: string;
  side: string;
  amount: string;
  price: string;
  pnl: string;
  fee: string;
  executed_at: string;
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
  const [instances, setInstances] = useState<Array<{ id: string; ip_address: string }>>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // 新增筛选条件
  const [filterPair, setFilterPair] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all | profit | loss
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  const fetchData = async () => {
    try {
      const [tradesRes, statsRes, instancesRes] = await Promise.all([
        tradingApi.getTrades({
          instance_id: selectedInstance === 'all' ? undefined : selectedInstance,
          limit,
          offset: page * limit,
        }),
        tradingApi.getStats(),
        instancesApi.list(),
      ]);

      setTrades(tradesRes.data.trades || []);
      setTotal(tradesRes.data.total || 0);
      setStats(statsRes.data);
      setInstances(instancesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedInstance, page]);

  // 客户端筛选逻辑
  const filteredTrades = trades.filter((trade) => {
    // 交易对筛选
    if (filterPair && !trade.pair.toLowerCase().includes(filterPair.toLowerCase())) {
      return false;
    }

    // 盈亏状态筛选
    const pnl = parseFloat(trade.pnl);
    if (filterStatus === 'profit' && pnl <= 0) return false;
    if (filterStatus === 'loss' && pnl >= 0) return false;

    // 日期范围筛选
    if (dateRange.start && new Date(trade.executed_at) < new Date(dateRange.start)) {
      return false;
    }
    if (dateRange.end && new Date(trade.executed_at) > new Date(dateRange.end)) {
      return false;
    }

    return true;
  });

  // 导出 CSV 功能
  const handleExport = () => {
    const content = filteredTrades
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-white">交易历史</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">交易历史</h1>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          导出 CSV
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-text-secondary text-sm mb-1">总交易次数</p>
              <p className="text-white text-2xl font-bold">{stats.totalTrades} 笔</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-text-secondary text-sm mb-1">胜率</p>
              <p className="text-white text-2xl font-bold">
                {(parseFloat(stats.winRate) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-text-secondary text-sm mb-1">累计盈亏</p>
              <p
                className={`text-2xl font-bold ${
                  parseFloat(stats.totalPnl) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {parseFloat(stats.totalPnl) >= 0 ? '+' : ''}
                {formatCurrency(stats.totalPnl)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-text-secondary text-sm mb-1">最佳/最差</p>
              <div className="flex gap-2 items-center">
                <span className="text-success text-sm">
                  +{formatCurrency(stats.bestTrade)}
                </span>
                <span className="text-text-tertiary">/</span>
                <span className="text-danger text-sm">
                  {formatCurrency(stats.worstTrade)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选器 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <Filter className="w-5 h-5 text-text-secondary mt-2 md:mt-0" />

            {/* 交易对搜索 */}
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-text-secondary" />
              <Input
                type="text"
                placeholder="搜索交易对 (BTC/USDT)"
                value={filterPair}
                onChange={(e) => setFilterPair(e.target.value)}
                className="w-full md:w-48"
              />
            </div>

            {/* 盈亏状态筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-sm">状态:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="all">全部</option>
                <option value="profit">盈利</option>
                <option value="loss">亏损</option>
              </select>
            </div>

            {/* 日期范围筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-sm">日期:</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <span className="text-text-tertiary">-</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            {/* 实例筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-sm">实例:</span>
              <select
                value={selectedInstance}
                onChange={(e) => {
                  setSelectedInstance(e.target.value);
                  setPage(0);
                }}
                className="bg-bg-tertiary border border-border-secondary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="all">全部</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.ip_address}
                  </option>
                ))}
              </select>
            </div>

            {/* 重置筛选 */}
            {(filterPair || filterStatus !== 'all' || dateRange.start || dateRange.end || selectedInstance !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterPair('');
                  setFilterStatus('all');
                  setDateRange({ start: '', end: '' });
                  setSelectedInstance('all');
                }}
              >
                重置
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 交易列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-brand-primary" />
            交易记录 ({filteredTrades.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTrades.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>暂无交易记录</p>
              <p className="text-sm mt-1">开始交易后，记录会显示在这里</p>
            </div>
          ) : (
            <>
              {/* 表头 */}
              <div className="hidden md:grid grid-cols-8 gap-4 p-4 bg-bg-tertiary/30 rounded-lg mb-3 text-sm text-text-secondary">
                <div className="col-span-2">时间</div>
                <div>交易对</div>
                <div>方向</div>
                <div className="text-right">数量</div>
                <div className="text-right">价格</div>
                <div className="text-right">盈亏</div>
                <div className="text-right">手续费</div>
              </div>

              {/* 数据行 */}
              <div className="space-y-2">
                {filteredTrades.map((trade) => {
                  const pnl = parseFloat(trade.pnl);
                  const isProfitable = pnl >= 0;

                  return (
                    <div
                      key={trade.id}
                      className="grid grid-cols-1 md:grid-cols-8 gap-2 md:gap-4 p-4 bg-bg-tertiary/20 hover:bg-bg-tertiary/40 rounded-lg transition-colors"
                    >
                      <div className="text-text-secondary text-sm col-span-1 md:col-span-2">
                        {formatDateTime(trade.executed_at)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{trade.pair}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {trade.side.toLowerCase() === 'buy' ? (
                          <>
                            <TrendingUp className="w-4 h-4 text-success" />
                            <span className="text-success">买入</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-4 h-4 text-danger" />
                            <span className="text-danger">卖出</span>
                          </>
                        )}
                      </div>
                      <div className="text-text-secondary text-right">{parseFloat(trade.amount).toFixed(4)}</div>
                      <div className="text-text-secondary text-right">
                        {formatCurrency(trade.price)}
                      </div>
                      <div
                        className={`text-right font-medium ${
                          isProfitable ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {isProfitable ? '+' : ''}
                        {formatCurrency(trade.pnl)}
                      </div>
                      <div className="text-text-tertiary text-right text-sm">
                        {formatCurrency(trade.fee)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    上一页
                  </Button>
                  <span className="text-text-secondary text-sm">
                    第 {page + 1} / {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
