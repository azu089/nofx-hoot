'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { strategiesApi, instancesApi, Strategy } from '@/lib/api';
import {
  ArrowLeft,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Target,
  TrendingDown,
  Activity,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// 扩展 Strategy 类型添加 content 和 is_subscribed 字段
type StrategyDetail = Strategy & {
  content?: string;
  is_subscribed?: boolean;
};

// 时间范围类型
type TimeRange = '7d' | '30d' | '90d';

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;

  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // 配置表单
  const [config, setConfig] = useState({
    capital: '',
    leverage: '1',
    stopLoss: '-10',
    tradingPair: 'BTC/USDT',
  });

  useEffect(() => {
    const fetchStrategy = async () => {
      try {
        const res = await strategiesApi.getDetail(strategyId);
        if (res.data) {
          const detail = res.data as StrategyDetail;
          setStrategy(detail);
          // 检查用户是否已订阅
          setSubscribed(detail.is_subscribed || false);
        }
      } catch (err) {
        setError('获取策略详情失败');
      } finally {
        setLoading(false);
      }
    };

    fetchStrategy();
  }, [strategyId]);

  const handleSubscribe = async () => {
    const minCapitalRequired = strategy?.config?.minInvestment || 1000;
    if (!config.capital || parseFloat(config.capital) < minCapitalRequired) {
      setError(`最低投入资本为 $${minCapitalRequired.toLocaleString()}`);
      return;
    }

    setSubscribing(true);
    setError(null);

    try {
      // 1. 订阅策略
      await strategiesApi.subscribe(strategyId);

      // 2. 检查是否有运行中的实例，如果没有则创建
      const instancesRes = await instancesApi.list();
      const runningInstance = instancesRes.data?.find(
        (i: { status: string }) => i.status === 'running' || i.status === 'provisioning'
      );

      if (!runningInstance) {
        // 创建新实例
        await instancesApi.create();
      }

      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '订阅失败');
    } finally {
      setSubscribing(false);
    }
  };

  const getRiskLevelStyle = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return { text: '低风险', color: 'text-success', bg: 'bg-success/20' };
      case 'medium':
        return { text: '中风险', color: 'text-warning', bg: 'bg-warning/20' };
      case 'high':
        return { text: '高风险', color: 'text-danger', bg: 'bg-danger/20' };
      default:
        return { text: riskLevel, color: 'text-text-secondary', bg: 'bg-bg-tertiary' };
    }
  };

  // 生成模拟收益曲线数据（实际应从后端获取）
  const generateProfitData = (range: TimeRange) => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    let profit = 0;

    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.45) * 200; // 模拟收益波动
      profit += change;
      data.push({
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
        }),
        profit: parseFloat(profit.toFixed(2)),
      });
    }
    return data;
  };

  const profitData = generateProfitData(timeRange);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-8">
            <div className="h-64 bg-bg-tertiary rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-danger" />
            <p className="text-text-secondary">策略不存在</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const risk = getRiskLevelStyle(strategy.config?.riskLevel || 'medium');
  const stats = strategy.performance_stats;
  const minCapital = strategy.config?.minInvestment || 1000;
  const isContractStrategy = strategy.config?.riskLevel === 'high';

  // 回测数据（模拟 - avg_hold_time 字段暂未在后端实现）
  const backtestData = {
    winRate: stats?.backtest?.win_rate || 65,
    maxDrawdown: stats?.backtest?.max_drawdown || 15,
    sharpeRatio: stats?.backtest?.sharpe_ratio || 1.8,
    avgHoldTime: 4.2, // 模拟数据，后续需要从后端获取
  };

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回策略市场
        </Button>
      </div>

      {/* 策略信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：策略详情 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 策略基本信息 */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-8 h-8 text-brand-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">{strategy.name}</CardTitle>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-sm px-3 py-1 rounded-full ${risk.bg} ${risk.color}`}>
                      {risk.text}
                    </span>
                    <span className="text-text-secondary text-sm">
                      {strategy.owner_type === 'system' ? '官方策略' : '用户策略'}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary leading-relaxed">{strategy.description || '暂无描述'}</p>
            </CardContent>
          </Card>

          {/* 收益曲线图 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-primary" />
                  收益曲线
                </CardTitle>
                <div className="flex gap-2">
                  {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        timeRange === range
                          ? 'bg-brand-primary text-white'
                          : 'bg-bg-tertiary text-text-secondary hover:bg-border-secondary'
                      }`}
                    >
                      {range === '7d' ? '7天' : range === '30d' ? '30天' : '90天'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={profitData}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00C087" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00C087" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" />
                  <XAxis
                    dataKey="date"
                    stroke="#848E9C"
                    style={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#848E9C"
                    style={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E222D',
                      border: '1px solid #2B3139',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, '收益']}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#00C087"
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 回测数据展示 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-primary" />
                回测数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-bg-tertiary/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-success" />
                    <p className="text-text-tertiary text-sm">胜率</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{backtestData.winRate}%</p>
                </div>
                <div className="p-4 bg-bg-tertiary/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-danger" />
                    <p className="text-text-tertiary text-sm">最大回撤</p>
                  </div>
                  <p className="text-2xl font-bold text-danger">
                    -{backtestData.maxDrawdown}%
                  </p>
                </div>
                <div className="p-4 bg-bg-tertiary/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-brand-primary" />
                    <p className="text-text-tertiary text-sm">夏普比率</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{backtestData.sharpeRatio}</p>
                </div>
                <div className="p-4 bg-bg-tertiary/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-text-secondary" />
                    <p className="text-text-tertiary text-sm">平均持仓</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{backtestData.avgHoldTime}h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 风险提示 */}
          <Card className="border-warning/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm text-text-secondary">
                  <p className="font-medium text-warning mb-1">风险提示</p>
                  <p>
                    量化交易存在风险，历史收益不代表未来表现。请根据自身风险承受能力谨慎投资。
                    平台对策略运行结果不承担任何责任。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：配置/订阅面板 */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>
                {subscribed ? '策略配置' : '启用策略'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                  {error}
                </div>
              )}

              {/* 投入资本 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  投入资本 (USDT)
                </label>
                <Input
                  type="number"
                  placeholder={`最低 $${minCapital.toLocaleString()}`}
                  value={config.capital}
                  onChange={(e) => setConfig({ ...config, capital: e.target.value })}
                  disabled={subscribed}
                />
                <p className="text-xs text-text-tertiary mt-1">
                  范围: ${minCapital.toLocaleString()} - $100,000
                </p>
              </div>

              {/* 交易对选择 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  交易对
                </label>
                <select
                  className="w-full bg-bg-tertiary border border-border-secondary rounded-lg p-3 text-white focus:border-brand-primary outline-none transition-colors"
                  value={config.tradingPair}
                  onChange={(e) => setConfig({ ...config, tradingPair: e.target.value })}
                  disabled={subscribed}
                >
                  <option value="BTC/USDT">BTC/USDT</option>
                  <option value="ETH/USDT">ETH/USDT</option>
                  <option value="BNB/USDT">BNB/USDT</option>
                  <option value="SOL/USDT">SOL/USDT</option>
                  <option value="XRP/USDT">XRP/USDT</option>
                </select>
              </div>

              {/* 止损设置 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  止损比例 (%)
                </label>
                <Input
                  type="number"
                  min="-100"
                  max="0"
                  step="1"
                  placeholder="-10"
                  value={config.stopLoss}
                  onChange={(e) => setConfig({ ...config, stopLoss: e.target.value })}
                  disabled={subscribed}
                />
                <p className="text-xs text-text-tertiary mt-1">
                  范围: -100% 至 0（推荐 -5% ~ -15%）
                </p>
              </div>

              {/* 杠杆倍数（仅合约策略） */}
              {isContractStrategy && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    杠杆倍数
                  </label>
                  <select
                    className="w-full bg-bg-tertiary border border-border-secondary rounded-lg p-3 text-white focus:border-brand-primary outline-none transition-colors"
                    value={config.leverage}
                    onChange={(e) => setConfig({ ...config, leverage: e.target.value })}
                    disabled={subscribed}
                  >
                    {[1, 2, 3, 5, 10, 20].map((lev) => (
                      <option key={lev} value={lev}>
                        {lev}x
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-tertiary mt-1">
                    高杠杆高收益但风险也更高
                  </p>
                </div>
              )}

              {/* 费用说明 */}
              <div className="pt-4 border-t border-border-primary">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">VPS 订阅费</span>
                  <span className="text-white">$25/月</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">燃油费 (盈利抽成)</span>
                  <span className="text-white">20%</span>
                </div>
                <div className="flex justify-between text-sm font-medium pt-2 border-t border-border-primary">
                  <span className="text-text-secondary">预计月度成本</span>
                  <span className="text-white">$25 + 盈利20%</span>
                </div>
              </div>

              {/* 按钮 */}
              {subscribed ? (
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => router.push('/trading')}
                  >
                    前往交易控制台
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/dashboard')}
                  >
                    返回仪表盘
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubscribe}
                    disabled={subscribing || !strategy.is_public}
                  >
                    {subscribing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        处理中...
                      </>
                    ) : !strategy.is_public ? (
                      '策略维护中'
                    ) : (
                      '订阅并启用策略'
                    )}
                  </Button>

                  <p className="text-xs text-text-tertiary text-center">
                    启用后将自动创建 VPS 实例并部署策略
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
