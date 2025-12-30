'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Zap,
  TrendingUp,
  TrendingDown,
  Star,
  Users,
  Clock,
  Shield,
  BarChart3,
  Activity,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { strategiesApi } from '../../../../lib/api';
import type { StrategyDetail } from '../../../../lib/api/types';

// 模拟扩展数据（后端 API 待补全）
const mockExtendedData = {
  id: '1',
  name: '趋势追踪 Pro',
  author: 'QuantFi 官方',
  authorVerified: true,
  description: '基于多周期 EMA 交叉的趋势跟踪策略，结合 RSI 和 MACD 指标过滤假信号。适合中长期持仓，在趋势行情中表现优异。',
  longDescription: `## 策略原理

本策略采用经典的趋势跟踪方法，通过分析多个时间周期的指数移动平均线（EMA）交叉信号来识别趋势方向。

### 核心逻辑

1. **趋势识别**：使用 12/26 EMA 交叉判断趋势方向
2. **信号过滤**：RSI > 50 确认多头，RSI < 50 确认空头
3. **入场时机**：MACD 柱状图翻转作为入场信号
4. **止损设置**：基于 ATR 动态止损，控制单笔亏损在 2% 以内
5. **止盈策略**：移动止盈，锁定利润

### 适用场景

- 趋势明显的市场环境
- 中大市值代币
- 4 小时及以上时间周期

### 风险提示

- 震荡行情可能产生较多假信号
- 建议配合资金管理使用`,
  category: 'trend',
  riskLevel: 'medium',
  monthlyPrice: 100,
  quarterlyPrice: 270,
  yearlyPrice: 960,
  rating: 4.8,
  reviewCount: 256,
  subscribers: 1234,
  minInvestment: 1000,
  supportedExchanges: ['Binance', 'OKX', 'Bybit'],
  supportedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
  createdAt: '2023-06-15',
  updatedAt: '2024-01-10',
  stats: {
    totalReturn: 156.8,
    monthlyReturn: 12.5,
    maxDrawdown: 15.2,
    sharpeRatio: 2.3,
    winRate: 68.5,
    profitFactor: 2.1,
    avgHoldingDays: 3.2,
    totalTrades: 892,
  },
  monthlyReturns: [
    { month: '2024-01', return: 12.5 },
    { month: '2023-12', return: 8.3 },
    { month: '2023-11', return: -2.1 },
    { month: '2023-10', return: 15.6 },
    { month: '2023-09', return: 6.8 },
    { month: '2023-08', return: -5.2 },
  ],
  reviews: [
    { id: '1', user: '量化新手', rating: 5, content: '跟了三个月，收益稳定，推荐！', date: '2024-01-10' },
    { id: '2', user: '老韭菜', rating: 4, content: '策略逻辑清晰，回撤控制不错', date: '2024-01-05' },
    { id: '3', user: 'CryptoTrader', rating: 5, content: '官方策略质量有保障', date: '2023-12-28' },
  ],
};

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [investment, setInvestment] = useState('1000');
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const strategyId = params.id as string;

  // 加载策略详情
  useEffect(() => {
    loadStrategy();
  }, [strategyId]);

  const loadStrategy = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await strategiesApi.get(strategyId);
      setStrategy(response.data);
      // 设置最低投入金额
      if (response.data.min_capital) {
        setInvestment(parseFloat(response.data.min_capital).toString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!strategy) return;

    const investmentNum = parseFloat(investment);
    const minCapital = parseFloat(strategy.min_capital);

    if (isNaN(investmentNum) || investmentNum < minCapital) {
      alert(`投入金额不能低于 ${minCapital} USDT`);
      return;
    }

    try {
      setSubscribing(true);
      await strategiesApi.subscribe(strategyId, investment);
      alert('订阅成功！请前往「我的订阅」查看');
      router.push('/strategies/subscribed');
    } catch (err) {
      alert(err instanceof Error ? err.message : '订阅失败');
    } finally {
      setSubscribing(false);
    }
  };

  const getRiskLevelBadge = (level: string) => {
    switch (level) {
      case 'low':
        return <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-500">低风险</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-500">中风险</span>;
      case 'high':
        return <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-500">高风险</span>;
      default:
        return null;
    }
  };

  // 加载态
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  // 错误态
  if (error || !strategy) {
    return (
      <div className="space-y-6 p-6">
        <Link href="/strategies" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          返回策略市场
        </Link>
        <Card className="border-red-500/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <p>{error || '策略不存在'}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={loadStrategy}>重试</Button>
              <Button variant="outline" onClick={() => router.push('/strategies')}>
                返回列表
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* 返回按钮 */}
      <Link href="/strategies" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        返回策略市场
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：策略详情 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Zap className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold">{strategy.name}</h1>
                      {getRiskLevelBadge(strategy.risk_level)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-muted-foreground">QuantFi 官方</span>
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="px-2 py-1 bg-muted rounded capitalize">{strategy.type}</span>
                      <span className={`px-2 py-1 rounded ${
                        strategy.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20'
                      }`}>
                        {strategy.status === 'active' ? '可用' : '维护中'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-muted-foreground">
                {strategy.description}
              </p>
            </CardContent>
          </Card>

          {/* 业绩数据 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                历史业绩
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">预期收益</p>
                  <p className="text-2xl font-bold text-green-500">{strategy.expected_return}%</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">最大回撤</p>
                  <p className="text-2xl font-bold text-red-500">{strategy.max_drawdown}%</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">胜率</p>
                  <p className="text-2xl font-bold">{strategy.win_rate}%</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">最低资金</p>
                  <p className="text-2xl font-bold">${parseFloat(strategy.min_capital).toLocaleString()}</p>
                </div>
              </div>

              {/* 策略参数 */}
              {strategy.params && Object.keys(strategy.params).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">策略参数</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(strategy.params).map(([key, value]) => (
                      <div key={key} className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground capitalize">{key}</p>
                        <p className="font-medium">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 策略详情 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                策略说明
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`prose prose-sm max-w-none ${!showFullDescription && 'max-h-48 overflow-hidden'}`}>
                <div className="whitespace-pre-line text-muted-foreground">
                  {strategy.description}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：订阅面板 */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>订阅策略</CardTitle>
              <CardDescription>设置投入金额开始使用</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* 投入金额 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  投入金额 (USDT)
                </label>
                <Input
                  type="number"
                  value={investment}
                  onChange={(e) => setInvestment(e.target.value)}
                  min={parseFloat(strategy.min_capital)}
                  placeholder={`最低 ${parseFloat(strategy.min_capital)}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  最低投入：{parseFloat(strategy.min_capital).toLocaleString()} USDT
                </p>
              </div>

              {/* 费用明细 */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">策略类型</span>
                  <span className="capitalize">{strategy.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gas 费</span>
                  <span>按盈利收取 20%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">风险等级</span>
                  <span className="capitalize">{strategy.risk_level}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubscribe}
                disabled={subscribing || Number(investment) < parseFloat(strategy.min_capital) || strategy.status !== 'active'}
              >
                {subscribing ? '处理中...' : strategy.status === 'active' ? '立即订阅' : '策略维护中'}
              </Button>

              {/* 提示 */}
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>订阅后可随时暂停或取消</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>策略会自动运行，无需手动操作</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>投资有风险，请谨慎决策</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
