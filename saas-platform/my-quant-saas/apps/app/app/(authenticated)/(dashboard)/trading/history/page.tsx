'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  History,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// 模拟交易历史
const mockTradeHistory = [
  { id: '1', pair: 'BTC/USDT', side: 'buy', price: 42350.5, amount: 0.1, total: 4235.05, profit: 125.50, strategy: '趋势追踪 Pro', time: '2024-01-15 10:23:45' },
  { id: '2', pair: 'ETH/USDT', side: 'sell', price: 2234.8, amount: 1.5, total: 3352.20, profit: -45.30, strategy: '网格套利者', time: '2024-01-15 10:20:12' },
  { id: '3', pair: 'BTC/USDT', side: 'sell', price: 42480.2, amount: 0.1, total: 4248.02, profit: 89.70, strategy: '趋势追踪 Pro', time: '2024-01-15 10:15:33' },
  { id: '4', pair: 'SOL/USDT', side: 'buy', price: 98.45, amount: 10, total: 984.50, profit: 35.20, strategy: 'AI 量化狙击', time: '2024-01-15 10:10:05' },
  { id: '5', pair: 'ETH/USDT', side: 'buy', price: 2230.5, amount: 1.5, total: 3345.75, profit: 18.45, strategy: '网格套利者', time: '2024-01-15 10:05:22' },
  { id: '6', pair: 'BNB/USDT', side: 'sell', price: 312.8, amount: 5, total: 1564.00, profit: -12.50, strategy: '稳健套利王', time: '2024-01-15 09:58:17' },
  { id: '7', pair: 'BTC/USDT', side: 'buy', price: 42200.0, amount: 0.15, total: 6330.00, profit: 210.00, strategy: '趋势追踪 Pro', time: '2024-01-15 09:45:30' },
  { id: '8', pair: 'DOGE/USDT', side: 'sell', price: 0.0823, amount: 5000, total: 411.50, profit: 8.30, strategy: 'AI 量化狙击', time: '2024-01-15 09:30:15' },
  { id: '9', pair: 'XRP/USDT', side: 'buy', price: 0.612, amount: 1000, total: 612.00, profit: -25.00, strategy: '网格套利者', time: '2024-01-15 09:15:42' },
  { id: '10', pair: 'ETH/USDT', side: 'sell', price: 2245.6, amount: 2, total: 4491.20, profit: 156.80, strategy: '趋势追踪 Pro', time: '2024-01-15 09:00:00' },
];

const mockStats = {
  totalTrades: 1256,
  profitTrades: 856,
  lossTrades: 400,
  totalProfit: 12567.89,
  avgProfit: 45.67,
  winRate: 68.2,
};

export default function TradingHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sideFilter, setSideFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filteredTrades = mockTradeHistory.filter((trade) => {
    const matchSearch = trade.pair.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSide = sideFilter === 'all' || trade.side === sideFilter;
    const matchStrategy = strategyFilter === 'all' || trade.strategy === strategyFilter;
    return matchSearch && matchSide && matchStrategy;
  });

  const strategies = [...new Set(mockTradeHistory.map((t) => t.strategy))];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            交易历史
          </h1>
          <p className="text-muted-foreground">查看所有历史交易记录</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          导出记录
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">总交易</p>
            <p className="text-xl font-bold">{mockStats.totalTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">盈利次数</p>
            <p className="text-xl font-bold text-green-500">{mockStats.profitTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">亏损次数</p>
            <p className="text-xl font-bold text-red-500">{mockStats.lossTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">总盈利</p>
            <p className="text-xl font-bold text-green-500">${mockStats.totalProfit.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">平均盈利</p>
            <p className="text-xl font-bold">${mockStats.avgProfit}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">胜率</p>
            <p className="text-xl font-bold">{mockStats.winRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索交易对..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value as 'all' | 'buy' | 'sell')}
                className="px-4 py-2 bg-muted border border-border rounded-lg"
              >
                <option value="all">全部方向</option>
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
              <select
                value={strategyFilter}
                onChange={(e) => setStrategyFilter(e.target.value)}
                className="px-4 py-2 bg-muted border border-border rounded-lg"
              >
                <option value="all">全部策略</option>
                {strategies.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 交易列表 */}
      <Card>
        <CardHeader>
          <CardTitle>交易记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">时间</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">交易对</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">方向</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">价格</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">数量</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">总额</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">盈亏</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">策略</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => (
                  <tr key={trade.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 text-sm text-muted-foreground">{trade.time}</td>
                    <td className="p-3 font-medium">{trade.pair}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          trade.side === 'buy'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}
                      >
                        {trade.side === 'buy' ? '买入' : '卖出'}
                      </span>
                    </td>
                    <td className="p-3 text-right">${trade.price.toLocaleString()}</td>
                    <td className="p-3 text-right">{trade.amount}</td>
                    <td className="p-3 text-right">${trade.total.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <span className={trade.profit >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{trade.strategy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              显示 1-{filteredTrades.length} 条，共 {mockStats.totalTrades} 条
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">第 {page} 页</span>
              <Button variant="outline" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
