'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  FlaskConical,
  Play,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  DollarSign,
  Activity,
  Clock,
} from 'lucide-react';

// 模拟回测结果
const mockBacktestResult = {
  strategyName: '趋势追踪 Pro',
  period: '2023-01-01 ~ 2024-01-01',
  initialCapital: 10000,
  finalCapital: 15678,
  totalReturn: 56.78,
  annualReturn: 56.78,
  maxDrawdown: 12.5,
  sharpeRatio: 1.85,
  winRate: 68,
  totalTrades: 245,
  profitTrades: 167,
  lossTrades: 78,
  avgProfit: 89.5,
  avgLoss: -45.2,
  profitFactor: 2.1,
  monthlyReturns: [
    { month: '2023-01', return: 5.2 },
    { month: '2023-02', return: -2.1 },
    { month: '2023-03', return: 8.5 },
    { month: '2023-04', return: 3.2 },
    { month: '2023-05', return: -1.5 },
    { month: '2023-06', return: 12.3 },
    { month: '2023-07', return: 4.8 },
    { month: '2023-08', return: -3.2 },
    { month: '2023-09', return: 6.7 },
    { month: '2023-10', return: 9.1 },
    { month: '2023-11', return: 7.5 },
    { month: '2023-12', return: 6.3 },
  ],
};

export default function BacktestPage() {
  const [strategy, setStrategy] = useState('');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2024-01-01');
  const [capital, setCapital] = useState('10000');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<typeof mockBacktestResult | null>(null);

  const handleRunBacktest = () => {
    if (!strategy) {
      alert('请选择策略');
      return;
    }

    setRunning(true);
    // 模拟回测运行
    setTimeout(() => {
      setRunning(false);
      setResult(mockBacktestResult);
    }, 2000);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="w-7 h-7 text-primary" />
          回测系统
        </h1>
        <p className="text-muted-foreground">使用历史数据测试策略表现</p>
      </div>

      {/* 回测配置 */}
      <Card>
        <CardHeader>
          <CardTitle>回测配置</CardTitle>
          <CardDescription>设置回测参数并运行</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                选择策略
              </label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
              >
                <option value="">请选择策略</option>
                <option value="trend">趋势追踪 Pro</option>
                <option value="grid">网格套利者</option>
                <option value="ai">AI 量化狙击</option>
                <option value="arbitrage">稳健套利王</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                开始日期
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                结束日期
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                初始资金
              </label>
              <Input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="10000"
              />
            </div>
          </div>

          <Button
            className="mt-4"
            onClick={handleRunBacktest}
            disabled={running || !strategy}
          >
            <Play className={`w-4 h-4 mr-2 ${running ? 'animate-pulse' : ''}`} />
            {running ? '回测运行中...' : '开始回测'}
          </Button>
        </CardContent>
      </Card>

      {/* 回测结果 */}
      {result && (
        <>
          {/* 核心指标 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">总收益率</p>
                    <p className="text-xl font-bold text-green-500">+{result.totalReturn}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">最大回撤</p>
                    <p className="text-xl font-bold text-red-500">-{result.maxDrawdown}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">夏普比率</p>
                    <p className="text-xl font-bold">{result.sharpeRatio}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">胜率</p>
                    <p className="text-xl font-bold">{result.winRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 详细指标 */}
            <Card>
              <CardHeader>
                <CardTitle>详细指标</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">策略名称</span>
                    <span className="font-medium">{result.strategyName}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">回测区间</span>
                    <span className="font-medium">{result.period}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">初始资金</span>
                    <span className="font-medium">${result.initialCapital.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">最终资金</span>
                    <span className="font-medium text-green-500">${result.finalCapital.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">总交易次数</span>
                    <span className="font-medium">{result.totalTrades}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">盈利交易</span>
                    <span className="font-medium text-green-500">{result.profitTrades}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">亏损交易</span>
                    <span className="font-medium text-red-500">{result.lossTrades}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">盈亏比</span>
                    <span className="font-medium">{result.profitFactor}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 月度收益 */}
            <Card>
              <CardHeader>
                <CardTitle>月度收益</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.monthlyReturns.map((item) => (
                    <div
                      key={item.month}
                      className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                    >
                      <span className="text-sm text-muted-foreground w-20">{item.month}</span>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.return >= 0 ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{
                            width: `${Math.min(Math.abs(item.return) * 5, 100)}%`,
                            marginLeft: item.return < 0 ? 'auto' : undefined,
                          }}
                        />
                      </div>
                      <span
                        className={`text-sm font-medium w-16 text-right ${
                          item.return >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {item.return >= 0 ? '+' : ''}{item.return}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button variant="outline">
              导出报告
            </Button>
            <Button>
              使用此策略
            </Button>
          </div>
        </>
      )}

      {!result && !running && (
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">开始回测</h3>
            <p className="text-muted-foreground">
              选择策略和时间范围，运行回测查看历史表现
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
