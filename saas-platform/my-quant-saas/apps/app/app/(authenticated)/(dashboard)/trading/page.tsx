'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Play,
  Pause,
  AlertTriangle,
  Activity,
  BarChart3,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';

// 模拟交易数据
const mockTradingData = {
  activeBots: 3,
  totalProfit: 1234.56,
  todayProfit: 89.32,
  winRate: 68.5,
  totalTrades: 156,
  runningStrategies: [
    {
      id: '1',
      name: '趋势追踪 Pro',
      status: 'running',
      profit: 456.78,
      trades: 45,
      lastTrade: '2分钟前',
    },
    {
      id: '2',
      name: '网格套利者',
      status: 'running',
      profit: 234.12,
      trades: 78,
      lastTrade: '5分钟前',
    },
    {
      id: '3',
      name: 'AI 量化狙击',
      status: 'paused',
      profit: -45.67,
      trades: 23,
      lastTrade: '1小时前',
    },
  ],
  recentTrades: [
    { id: '1', pair: 'BTC/USDT', side: 'buy', price: 42350.5, amount: 0.1, profit: 12.34, time: '10:23:45' },
    { id: '2', pair: 'ETH/USDT', side: 'sell', price: 2234.8, amount: 1.5, profit: -5.67, time: '10:20:12' },
    { id: '3', pair: 'BTC/USDT', side: 'sell', price: 42380.2, amount: 0.1, profit: 29.7, time: '10:15:33' },
    { id: '4', pair: 'SOL/USDT', side: 'buy', price: 98.45, amount: 10, profit: 15.2, time: '10:10:05' },
    { id: '5', pair: 'ETH/USDT', side: 'buy', price: 2230.5, amount: 1.5, profit: 8.45, time: '10:05:22' },
  ],
};

export default function TradingPage() {
  const [data] = useState(mockTradingData);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleToggleStrategy = async (id: string, currentStatus: string) => {
    setActionLoading(id);
    // TODO: Implement API call
    setTimeout(() => {
      setActionLoading(null);
      alert(currentStatus === 'running' ? '策略已暂停' : '策略已启动');
    }, 500);
  };

  const handlePanicStop = () => {
    if (confirm('确定要紧急停止所有策略吗？这将立即停止所有交易活动。')) {
      alert('已发送紧急停止指令');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">交易控制台</h1>
          <p className="text-muted-foreground">实时监控和管理您的量化交易</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button variant="destructive" size="sm" onClick={handlePanicStop}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            紧急停止
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">运行中</p>
                <p className="text-xl font-bold">{data.activeBots} 个策略</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总盈利</p>
                <p className="text-xl font-bold text-green-500">
                  +${data.totalProfit.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">今日盈亏</p>
                <p className={`text-xl font-bold ${data.todayProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {data.todayProfit >= 0 ? '+' : ''}${data.todayProfit.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">胜率</p>
                <p className="text-xl font-bold">{data.winRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 运行中的策略 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              运行中的策略
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.runningStrategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        strategy.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                      }`}
                    />
                    <div>
                      <p className="font-medium">{strategy.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {strategy.trades} 笔交易 • {strategy.lastTrade}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          strategy.profit >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {strategy.profit >= 0 ? '+' : ''}${strategy.profit.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStrategy(strategy.id, strategy.status)}
                      disabled={actionLoading === strategy.id}
                    >
                      {strategy.status === 'running' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}

              {data.runningStrategies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无运行中的策略</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 最近交易 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              最近交易
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        trade.side === 'buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}
                    >
                      {trade.side === 'buy' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{trade.pair}</p>
                      <p className="text-xs text-muted-foreground">
                        {trade.side === 'buy' ? '买入' : '卖出'} {trade.amount} @ ${trade.price}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-medium text-sm ${
                        trade.profit >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{trade.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 交易日志 */}
      <Card>
        <CardHeader>
          <CardTitle>实时日志</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm h-48 overflow-y-auto">
            <p className="text-green-400">[10:23:45] 趋势追踪 Pro: 买入 BTC/USDT 0.1 @ 42350.5</p>
            <p className="text-muted-foreground">[10:23:44] 趋势追踪 Pro: 检测到上升趋势信号</p>
            <p className="text-red-400">[10:20:12] 网格套利者: 卖出 ETH/USDT 1.5 @ 2234.8</p>
            <p className="text-muted-foreground">[10:20:10] 网格套利者: 触发网格上限</p>
            <p className="text-green-400">[10:15:33] 趋势追踪 Pro: 平仓 BTC/USDT +$29.70</p>
            <p className="text-yellow-400">[10:10:00] AI 量化狙击: 策略已暂停</p>
            <p className="text-muted-foreground">[10:05:22] 网格套利者: 新网格订单已创建</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
