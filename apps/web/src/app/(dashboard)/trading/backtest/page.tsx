'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { strategiesApi } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Percent,
  Target,
  Hash,
  BarChart3,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// 回测结果数据类型
interface BacktestResult {
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  curve: Array<{ date: string; value: number; trades: number }>;
}

// 策略数据类型
interface Strategy {
  id: string;
  name: string;
  description: string;
}

// 交易对选项
const TRADING_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'ADA/USDT',
  'DOT/USDT',
  'AVAX/USDT',
  'MATIC/USDT',
];

export default function BacktestPage() {
  // 表单状态
  const [strategyId, setStrategyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC/USDT', 'ETH/USDT']);

  // 数据状态
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategiesLoading, setStrategiesLoading] = useState(false);

  // 加载策略列表
  const loadStrategies = async () => {
    setStrategiesLoading(true);
    try {
      const response = await strategiesApi.list();
      // 将 API 返回的策略映射为本地格式
      const mappedStrategies = (response.data || []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
      }));
      setStrategies(mappedStrategies);
    } catch (err) {
      console.error('加载策略失败:', err);
      // 使用模拟数据
      setStrategies([
        { id: '1', name: '稳健防御型', description: '低风险策略' },
        { id: '2', name: '趋势追踪型', description: '中风险策略' },
        { id: '3', name: '激进复利型', description: '高风险策略' },
      ]);
    } finally {
      setStrategiesLoading(false);
    }
  };

  // 初始化
  useState(() => {
    loadStrategies();
    // 设置默认日期（最近3个月）
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  });

  // 处理交易对选择
  const togglePair = (pair: string) => {
    setSelectedPairs((prev) =>
      prev.includes(pair) ? prev.filter((p) => p !== pair) : [...prev, pair]
    );
  };

  // 开始回测
  const handleBacktest = async () => {
    // 表单验证
    if (!strategyId) {
      setError('请选择策略');
      return;
    }
    if (!startDate || !endDate) {
      setError('请选择日期范围');
      return;
    }
    if (!initialCapital || parseFloat(initialCapital) <= 0) {
      setError('请输入有效的初始资金');
      return;
    }
    if (selectedPairs.length === 0) {
      setError('请至少选择一个交易对');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // TODO: 调用真实回测 API
      // const response = await backtestApi.run({ strategyId, startDate, endDate, initialCapital, pairs: selectedPairs });
      // setResult(response.data);

      // 模拟延迟
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 使用模拟数据
      const mockResult = generateMockBacktestResult(
        parseFloat(initialCapital),
        new Date(startDate),
        new Date(endDate)
      );
      setResult(mockResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '回测失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">回测系统</h1>
          <p className="text-text-secondary mt-1">验证策略历史表现</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧配置面板 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>回测配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 策略选择 */}
              <Select
                label="选择策略"
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
                disabled={strategiesLoading}
              >
                <option value="">-- 请选择策略 --</option>
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </Select>

              {/* 起始日期 */}
              <Input
                type="date"
                label="起始日期"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />

              {/* 结束日期 */}
              <Input
                type="date"
                label="结束日期"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />

              {/* 初始资金 */}
              <Input
                type="number"
                label="初始资金 (USDT)"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                placeholder="10000"
                min="100"
                step="100"
              />

              {/* 交易对选择 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  交易对选择
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TRADING_PAIRS.map((pair) => (
                    <button
                      key={pair}
                      type="button"
                      onClick={() => togglePair(pair)}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                        selectedPairs.includes(pair)
                          ? 'bg-brand-primary border-brand-primary text-white'
                          : 'bg-bg-tertiary border-border-secondary text-text-secondary hover:border-border-primary'
                      }`}
                    >
                      {pair}
                    </button>
                  ))}
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              {/* 开始回测按钮 */}
              <Button
                variant="primary"
                className="w-full"
                onClick={handleBacktest}
                isLoading={loading}
                disabled={loading}
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                开始回测
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧结果展示 */}
        <div className="lg:col-span-2">
          {loading ? (
            // 加载状态
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-text-secondary">正在回测中，请稍候...</p>
                </div>
              </CardContent>
            </Card>
          ) : !result ? (
            // 空状态
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-text-disabled" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    等待回测
                  </h3>
                  <p className="text-text-secondary">
                    请在左侧配置回测参数，然后点击"开始回测"
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            // 回测结果
            <div className="space-y-6">
              {/* 核心指标 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-text-secondary text-xs">总收益率</p>
                        <p className="text-white text-lg font-semibold">
                          {formatPercent(result.totalReturn)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-primary/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div>
                        <p className="text-text-secondary text-xs">胜率</p>
                        <p className="text-white text-lg font-semibold">
                          {result.winRate.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 text-danger" />
                      </div>
                      <div>
                        <p className="text-text-secondary text-xs">最大回撤</p>
                        <p className="text-white text-lg font-semibold">
                          {formatPercent(result.maxDrawdown)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-text-secondary text-xs">夏普比率</p>
                        <p className="text-white text-lg font-semibold">
                          {result.sharpeRatio.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 收益曲线图 */}
              <Card>
                <CardHeader>
                  <CardTitle>收益曲线</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.curve}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3772FF" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3772FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" />
                        <XAxis
                          dataKey="date"
                          stroke="#848E9C"
                          tick={{ fill: '#848E9C', fontSize: 12 }}
                        />
                        <YAxis
                          stroke="#848E9C"
                          tick={{ fill: '#848E9C', fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1E222D',
                            border: '1px solid #2B3139',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: '#FFFFFF' }}
                          itemStyle={{ color: '#3772FF' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#3772FF"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorValue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* 胜率饼图与风险评级 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 胜率饼图 */}
                <Card>
                  <CardHeader>
                    <CardTitle>盈亏分布</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: '盈利', value: result.winRate, color: '#00C087' },
                              { name: '亏损', value: 100 - result.winRate, color: '#F23645' },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            <Cell fill="#00C087" />
                            <Cell fill="#F23645" />
                          </Pie>
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value, entry) => (
                              <span className="text-text-secondary text-sm">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-2">
                      <p className="text-2xl font-bold text-white">{result.winRate.toFixed(1)}%</p>
                      <p className="text-text-secondary text-sm">胜率</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 风险评级 */}
                <Card>
                  <CardHeader>
                    <CardTitle>风险评级</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 评级展示 */}
                      <div className="text-center py-4">
                        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl font-bold ${
                          result.sharpeRatio >= 2 ? 'bg-success/20 text-success' :
                          result.sharpeRatio >= 1.5 ? 'bg-brand-primary/20 text-brand-primary' :
                          result.sharpeRatio >= 1 ? 'bg-warning/20 text-warning' :
                          'bg-danger/20 text-danger'
                        }`}>
                          {result.sharpeRatio >= 2 ? 'A' :
                           result.sharpeRatio >= 1.5 ? 'B' :
                           result.sharpeRatio >= 1 ? 'C' : 'D'}
                        </div>
                        <p className="text-text-secondary text-sm mt-2">
                          {result.sharpeRatio >= 2 ? '优秀 - 风险调整收益出色' :
                           result.sharpeRatio >= 1.5 ? '良好 - 风险收益比较好' :
                           result.sharpeRatio >= 1 ? '一般 - 需要注意风险控制' :
                           '较差 - 风险较高，建议优化'}
                        </p>
                      </div>

                      {/* 评级指标 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 bg-bg-tertiary/50 rounded">
                          <span className="text-text-secondary text-sm">夏普比率</span>
                          <span className={`font-medium ${
                            result.sharpeRatio >= 1.5 ? 'text-success' :
                            result.sharpeRatio >= 1 ? 'text-warning' : 'text-danger'
                          }`}>{result.sharpeRatio.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-bg-tertiary/50 rounded">
                          <span className="text-text-secondary text-sm">最大回撤</span>
                          <span className={`font-medium ${
                            Math.abs(result.maxDrawdown) <= 10 ? 'text-success' :
                            Math.abs(result.maxDrawdown) <= 20 ? 'text-warning' : 'text-danger'
                          }`}>{formatPercent(result.maxDrawdown)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-bg-tertiary/50 rounded">
                          <span className="text-text-secondary text-sm">盈亏比</span>
                          <span className={`font-medium ${
                            result.profitFactor >= 2 ? 'text-success' :
                            result.profitFactor >= 1.5 ? 'text-warning' : 'text-danger'
                          }`}>{result.profitFactor.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 详细统计 */}
              <Card>
                <CardHeader>
                  <CardTitle>详细统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Hash className="w-5 h-5 text-text-secondary" />
                        <span className="text-text-secondary">交易次数</span>
                      </div>
                      <span className="text-white font-semibold">
                        {result.totalTrades}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-success" />
                        <span className="text-text-secondary">平均盈利</span>
                      </div>
                      <span className="text-success font-semibold">
                        +{formatCurrency(result.avgProfit)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-danger" />
                        <span className="text-text-secondary">平均亏损</span>
                      </div>
                      <span className="text-danger font-semibold">
                        {formatCurrency(result.avgLoss)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Percent className="w-5 h-5 text-brand-primary" />
                        <span className="text-text-secondary">盈亏比</span>
                      </div>
                      <span className="text-white font-semibold">
                        {result.profitFactor.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-text-secondary" />
                        <span className="text-text-secondary">初始资金</span>
                      </div>
                      <span className="text-white font-semibold">
                        {formatCurrency(parseFloat(initialCapital))}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-success" />
                        <span className="text-text-secondary">最终资金</span>
                      </div>
                      <span className="text-success font-semibold">
                        {formatCurrency(
                          parseFloat(initialCapital) * (1 + result.totalReturn / 100)
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 生成模拟回测数据
function generateMockBacktestResult(
  initialCapital: number,
  startDate: Date,
  endDate: Date
): BacktestResult {
  const days = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const curve: Array<{ date: string; value: number; trades: number }> = [];

  let currentValue = initialCapital;
  let maxValue = initialCapital;
  let maxDrawdown = 0;
  let totalTrades = 0;
  let winTrades = 0;

  // 生成每日数据
  for (let i = 0; i <= days; i += 7) {
    // 每周一个数据点
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);

    // 随机涨跌 (-3% ~ +5%)
    const change = (Math.random() * 8 - 3) / 100;
    currentValue *= 1 + change;

    // 更新最大值和回撤
    if (currentValue > maxValue) {
      maxValue = currentValue;
    }
    const drawdown = ((maxValue - currentValue) / maxValue) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    // 随机交易次数
    const trades = Math.floor(Math.random() * 5);
    totalTrades += trades;
    winTrades += Math.floor(trades * (0.55 + Math.random() * 0.15)); // 55-70%胜率

    curve.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(currentValue * 100) / 100,
      trades,
    });
  }

  const totalReturn = ((currentValue - initialCapital) / initialCapital) * 100;
  const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

  return {
    totalReturn,
    winRate,
    maxDrawdown: -maxDrawdown,
    sharpeRatio: 1.2 + Math.random() * 0.8, // 1.2 - 2.0
    totalTrades,
    avgProfit: 45 + Math.random() * 30, // 45-75 USDT
    avgLoss: -25 - Math.random() * 15, // -25 ~ -40 USDT
    profitFactor: 1.5 + Math.random() * 1.0, // 1.5 - 2.5
    curve,
  };
}
