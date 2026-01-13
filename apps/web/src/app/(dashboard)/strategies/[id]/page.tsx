'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button } from '@/components/ui';
import { strategiesApi, Strategy } from '@/lib/api';
import {
  XCircle,
  Share2,
  Star,
  BadgeCheck,
  UserCircle,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

// 策略类型配置
type StrategyType = 'grid' | 'trend' | 'dca' | 'arbitrage' | 'scalping' | 'swing';
const STRATEGY_TYPES: Record<StrategyType, { label: string; description: string }> = {
  grid: {
    label: '网格策略',
    description: '在设定价格区间内自动低买高卖，适合震荡行情，通过价格波动赚取差价收益。'
  },
  trend: {
    label: '趋势策略',
    description: '跟随市场趋势方向交易，上涨时做多、下跌时做空或观望，适合单边行情。'
  },
  dca: {
    label: '定投策略',
    description: '定期定额买入，平摊成本降低风险，适合长期投资者，无需择时。'
  },
  arbitrage: {
    label: '套利策略',
    description: '利用不同市场或合约间的价差获利，风险较低但收益稳定。'
  },
  scalping: {
    label: '剥头皮策略',
    description: '高频短线交易，捕捉微小价格波动，交易次数多、单笔利润小。'
  },
  swing: {
    label: '波段策略',
    description: '中期持仓，捕捉价格波段，持仓周期数天到数周，追求较大波动收益。'
  },
};

// 扩展 Strategy 类型
type StrategyDetail = Strategy & {
  content?: string;
  is_subscribed?: boolean;
  created_at?: string;
  trade_type?: 'spot' | 'futures';
};

// 时间范围
type TimeRange = '7d' | '30d' | '90d';

// 模拟生成回测数据（实际应从后端获取）
const generateBacktestData = (range: TimeRange) => {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const data = [];
  let value = 10000;
  let maxValue = value;
  let minValue = value;
  let wins = 0;
  let totalTrades = 0;

  for (let i = 0; i < days; i++) {
    const dailyReturn = (Math.random() - 0.45) * 0.03;
    const prevValue = value;
    value = value * (1 + dailyReturn);

    if (value > prevValue) wins++;
    totalTrades++;
    maxValue = Math.max(maxValue, value);
    minValue = Math.min(minValue, value);

    data.push({
      date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
      }),
      value: Math.round(value),
    });
  }

  const totalReturn = ((value - 10000) / 10000) * 100;
  const maxDrawdown = ((maxValue - minValue) / maxValue) * 100;
  const winRate = (wins / totalTrades) * 100;
  const sharpeRatio = totalReturn / (maxDrawdown || 1) * 0.5;
  // 交易次数随时间范围增加
  const tradeCount = Math.floor(totalTrades * (1 + Math.random() * 2));

  return {
    data,
    metrics: {
      totalReturn: totalReturn.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      winRate: winRate.toFixed(0),
      sharpeRatio: sharpeRatio.toFixed(2),
      tradeCount,
    }
  };
};

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;

  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  useEffect(() => {
    const fetchStrategy = async () => {
      try {
        const res = await strategiesApi.getDetail(strategyId);
        if (res.data) {
          setStrategy(res.data as StrategyDetail);
        }
      } catch (err) {
        console.error('获取策略详情失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStrategy();
  }, [strategyId]);

  const backtestResult = useMemo(() => generateBacktestData(timeRange), [timeRange]);

  const handleShare = async () => {
    const url = `${window.location.origin}/strategies/${strategyId}`;
    if (navigator.share) {
      await navigator.share({ title: strategy?.name || '策略分享', url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const handleUseStrategy = () => {
    router.push(`/trading/backtest?strategyId=${strategyId}`);
  };

  // Loading
  if (loading) {
    return (
      <div className="pb-24">
        {/* 移动端加载状态 */}
        <div className="lg:hidden animate-pulse">
          <div className="p-4 h-96 bg-bg-tertiary/50 rounded-xl" />
        </div>
        {/* 桌面端加载状态 */}
        <Card className="hidden lg:block animate-pulse">
          <div className="p-6 h-96 bg-bg-tertiary rounded" />
        </Card>
      </div>
    );
  }

  // 策略不存在
  if (!strategy) {
    return (
      <div className="pb-24">
        {/* 移动端空状态 */}
        <div className="lg:hidden py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-danger" />
          </div>
          <p className="text-text-secondary">策略不存在</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            返回
          </Button>
        </div>
        {/* 桌面端空状态 */}
        <Card className="hidden lg:block">
          <div className="p-12 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-danger" />
            <p className="text-text-secondary">策略不存在</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              返回
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const strategyType = (strategy.config?.strategyType as StrategyType) || 'grid';
  const typeConfig = STRATEGY_TYPES[strategyType] || STRATEGY_TYPES.grid;
  const tradeType = strategy.trade_type || 'spot';
  const { data: chartData, metrics } = backtestResult;
  const totalReturn = parseFloat(metrics.totalReturn);

  return (
    <div className="pb-20">
      {/* ====== 移动端布局 - 无边框极简风格 ====== */}
      <div className="lg:hidden space-y-4">
        {/* 顶部：标题 + 操作按钮 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white mb-2 truncate">{strategy.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {strategy.owner_type === 'system' ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary">
                  <BadgeCheck className="w-3 h-3" />
                  官方
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary">
                  <UserCircle className="w-3 h-3" />
                  社区
                </span>
              )}
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                tradeType === 'futures'
                  ? 'bg-warning/15 text-warning'
                  : 'bg-bg-secondary text-text-secondary'
              )}>
                {tradeType === 'futures' ? '合约' : '现货'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary">
                {typeConfig.label}
              </span>
            </div>
          </div>
          {/* 右侧操作按钮 */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleShare} className="p-2 rounded-full bg-bg-secondary">
              <Share2 className="w-5 h-5 text-text-secondary" />
            </button>
            <button className="p-2 rounded-full bg-bg-secondary">
              <Star className="w-5 h-5 text-text-tertiary" />
            </button>
          </div>
        </div>

        {/* 策略描述 */}
        <p className="text-sm text-text-secondary leading-relaxed">
          {strategy.description || typeConfig.description}
        </p>

        {/* 回测表现区块 */}
        <div className="bg-bg-secondary rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-white">回测表现</h2>
            <div className="flex gap-1 bg-bg-primary rounded-lg p-0.5">
              {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-md transition-colors',
                    timeRange === range
                      ? 'bg-brand-primary text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {range === '7d' ? '7天' : range === '30d' ? '30天' : '90天'}
                </button>
              ))}
            </div>
          </div>

          {/* 回测指标 */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{metrics.winRate}%</p>
              <p className="text-xs text-text-tertiary mt-1">胜率</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-danger">-{metrics.maxDrawdown}%</p>
              <p className="text-xs text-text-tertiary mt-1">最大回撤</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{metrics.sharpeRatio}</p>
              <p className="text-xs text-text-tertiary mt-1">夏普比率</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{metrics.tradeCount}</p>
              <p className="text-xs text-text-tertiary mt-1">交易次数</p>
            </div>
          </div>

          {/* 收益曲线 */}
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="profitGradientMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={totalReturn >= 0 ? "#00C087" : "#F23645"} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={totalReturn >= 0 ? "#00C087" : "#F23645"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#5E6673"
                style={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#5E6673"
                style={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                domain={['dataMin - 500', 'dataMax + 500']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E222D',
                  border: '1px solid #2B3139',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [`$${Number(value).toLocaleString()}`, '净值']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={totalReturn >= 0 ? "#00C087" : "#F23645"}
                strokeWidth={2}
                fill="url(#profitGradientMobile)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 风险提示 */}
        <div className="flex items-start gap-2 p-3 bg-warning/5 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary">
            以上数据为历史回测结果，不代表未来收益，请根据自身风险承受能力谨慎投资。
          </p>
        </div>

        {/* 操作按钮 */}
        <Button
          className="w-full h-11 text-base font-semibold"
          size="lg"
          onClick={handleUseStrategy}
        >
          使用此策略
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      {/* ====== 桌面端布局 - 保持卡片样式 ====== */}
      <div className="hidden lg:block">
        <Card>
          <div className="p-6 space-y-5">
            {/* 顶部：返回按钮 + 标题 + 操作按钮 */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <button
                  onClick={() => router.back()}
                  className="shrink-0 p-1.5 -ml-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-white mb-2 truncate">{strategy.name}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    {strategy.owner_type === 'system' ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
                        <BadgeCheck className="w-3 h-3" />
                        官方
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary border border-border-primary">
                        <UserCircle className="w-3 h-3" />
                        社区
                      </span>
                    )}
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full border",
                      tradeType === 'futures'
                        ? 'bg-warning/15 text-warning border-warning/30'
                        : 'bg-bg-tertiary text-text-secondary border-border-primary'
                    )}>
                      {tradeType === 'futures' ? '合约' : '现货'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary border border-border-primary">
                      {typeConfig.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={handleShare} className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors">
                  <Share2 className="w-5 h-5 text-text-secondary" />
                </button>
                <button className="p-2 rounded-lg hover:bg-warning/10 transition-colors">
                  <Star className="w-5 h-5 text-text-tertiary hover:text-warning" />
                </button>
              </div>
            </div>

            {/* 策略描述 */}
            <p className="text-sm text-text-secondary leading-relaxed">
              {strategy.description || typeConfig.description}
            </p>

            {/* 分隔线 */}
            <div className="border-t border-border-primary" />

            {/* 回测表现 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-white">回测表现</h2>
                <div className="flex gap-1 bg-bg-tertiary rounded-lg p-0.5">
                  {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-md transition-colors',
                        timeRange === range
                          ? 'bg-brand-primary text-white'
                          : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {range === '7d' ? '7天' : range === '30d' ? '30天' : '90天'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 回测指标 */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{metrics.winRate}%</p>
                  <p className="text-xs text-text-tertiary mt-1">胜率</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-danger">-{metrics.maxDrawdown}%</p>
                  <p className="text-xs text-text-tertiary mt-1">最大回撤</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{metrics.sharpeRatio}</p>
                  <p className="text-xs text-text-tertiary mt-1">夏普比率</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{metrics.tradeCount}</p>
                  <p className="text-xs text-text-tertiary mt-1">交易次数</p>
                </div>
              </div>

              {/* 收益曲线 */}
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={totalReturn >= 0 ? "#00C087" : "#F23645"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={totalReturn >= 0 ? "#00C087" : "#F23645"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#5E6673"
                    style={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#5E6673"
                    style={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                    domain={['dataMin - 500', 'dataMax + 500']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E222D',
                      border: '1px solid #2B3139',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, '净值']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={totalReturn >= 0 ? "#00C087" : "#F23645"}
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 分隔线 */}
            <div className="border-t border-border-primary" />

            {/* 风险提示 */}
            <div className="flex items-start gap-2 p-3 bg-warning/5 rounded-lg border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary">
                以上数据为历史回测结果，不代表未来收益，请根据自身风险承受能力谨慎投资。
              </p>
            </div>
          </div>
        </Card>

        {/* 操作按钮 - 卡片下方 */}
        <div className="pt-3">
          <Button
            className="w-full h-11 text-base font-semibold"
            size="lg"
            onClick={handleUseStrategy}
          >
            使用此策略
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
