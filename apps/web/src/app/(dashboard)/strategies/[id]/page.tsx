'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, Button, MobileHeader } from '@/components/ui';
import { strategiesApi, Strategy } from '@/lib/api';
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Target,
  TrendingDown,
  Activity,
  BarChart3,
  Play,
  Users,
  Calendar,
  Star,
  ArrowRight,
  Settings,
  BadgeCheck,
  UserCircle,
  Share2,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Info,
  FileText,
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
const STRATEGY_TYPES: Record<StrategyType, { label: string; icon: string; color: string; bgColor: string }> = {
  grid: { label: '网格策略', icon: '📊', color: 'text-brand-primary', bgColor: 'bg-brand-primary/20' },
  trend: { label: '趋势策略', icon: '📈', color: 'text-success', bgColor: 'bg-success/20' },
  dca: { label: '定投策略', icon: '💰', color: 'text-warning', bgColor: 'bg-warning/20' },
  arbitrage: { label: '套利策略', icon: '⚖️', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  scalping: { label: '剥头皮', icon: '⚡', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  swing: { label: '波段策略', icon: '🌊', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
};

// 扩展 Strategy 类型
type StrategyDetail = Strategy & {
  content?: string;
  is_subscribed?: boolean;
  subscriber_count?: number;
  created_at?: string;
  total_users?: number;
  tier?: string;
  backtest_total_return?: number;
  backtest_max_drawdown?: number;
  backtest_win_rate?: number;
  backtest_total_trades?: number;
  backtest_sharpe_ratio?: number;
};

// 时间范围类型
type TimeRange = '7d' | '30d' | '90d';
// 数据来源类型
type DataSource = 'backtest' | 'live';

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;

  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [dataSource, setDataSource] = useState<DataSource>('backtest');
  const [riskExpanded, setRiskExpanded] = useState(false);

  useEffect(() => {
    const fetchStrategy = async () => {
      try {
        const res = await strategiesApi.getDetail(strategyId);
        if (res.data) {
          const detail = res.data as StrategyDetail;
          setStrategy(detail);
          setSubscribed(detail.is_subscribed || false);
        }
      } catch (err) {
        console.error('获取策略详情失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStrategy();
  }, [strategyId]);

  // 跳转到回测系统页面
  const handleGoToBacktest = () => {
    router.push(`/trading/backtest?strategyId=${strategyId}`);
  };

  // 分享策略
  const handleShare = async () => {
    const url = `${window.location.origin}/strategies/${strategyId}`;
    if (navigator.share) {
      await navigator.share({
        title: strategy?.name || '策略分享',
        text: strategy?.description || '',
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  // 生成模拟收益曲线数据
  const generateProfitData = (range: TimeRange) => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    let profit = 0;

    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.45) * 200;
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
      <div className="space-y-4 pb-24">
        <MobileHeader title="策略详情" />
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
      <div className="space-y-4 pb-24">
        <MobileHeader title="策略详情" />
        <Card>
          <CardContent className="p-12 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-danger" />
            <p className="text-text-secondary">策略不存在</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 获取策略类型
  const strategyType = (strategy.config?.strategyType as StrategyType) || 'grid';
  const typeConfig = STRATEGY_TYPES[strategyType] || STRATEGY_TYPES.grid;

  // 获取回测数据
  const backtestWinRate = Number(strategy.backtest_win_rate ?? strategy.performance_stats?.backtest?.win_rate ?? 0);
  const backtestMaxDrawdown = Number(strategy.backtest_max_drawdown ?? strategy.performance_stats?.backtest?.max_drawdown ?? 0);
  const backtestTotalTrades = Number(strategy.backtest_total_trades ?? strategy.performance_stats?.backtest?.total_trades ?? 0);
  const backtestTotalReturn = Number(strategy.backtest_total_return ?? 0);

  // 获取实盘数据
  const liveStats = strategy.performance_stats?.live;
  const hasLiveData = liveStats && (liveStats.total_trades || 0) > 0;

  // 状态标签
  const isNew = strategy.created_at && (Date.now() - new Date(strategy.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
  const isHot = (strategy.total_users || 0) > 100;

  const minCapital = strategy.config?.minInvestment || 100;

  return (
    <div className="space-y-4 pb-28 lg:pb-6">
      {/* 移动端头部 */}
      <MobileHeader
        title="策略详情"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            >
              <Share2 className="w-5 h-5 text-text-secondary" />
            </button>
            <button className="p-2 rounded-lg hover:bg-warning/10 transition-colors">
              <Star className="w-5 h-5 text-text-tertiary hover:text-warning" />
            </button>
          </div>
        }
      />

      {/* ============ Hero 区域 ============ */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-bg-secondary via-bg-secondary to-brand-primary/10 border border-border-primary">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-primary/5 rounded-full blur-3xl" />

        <div className="relative p-4 lg:p-6">
          {/* 标签行 */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* 策略类型 */}
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${typeConfig.color} ${typeConfig.bgColor}`}>
              {typeConfig.icon} {typeConfig.label}
            </span>
            {/* 官方/社区 */}
            {strategy.owner_type === 'system' ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-success bg-success/10">
                <BadgeCheck className="w-3 h-3" />
                官方
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-text-tertiary bg-bg-tertiary">
                <UserCircle className="w-3 h-3" />
                社区
              </span>
            )}
            {isNew && (
              <span className="text-xs px-2 py-1 rounded-full text-brand-primary bg-brand-primary/10">
                新上线
              </span>
            )}
            {isHot && (
              <span className="text-xs px-2 py-1 rounded-full text-warning bg-warning/10">
                热门
              </span>
            )}
          </div>

          {/* 策略名称 */}
          <h1 className="text-xl lg:text-2xl font-bold text-white mb-2">{strategy.name}</h1>
          <p className="text-sm text-text-secondary line-clamp-2">
            {strategy.description || '暂无描述'}
          </p>

          {/* 4 个核心指标 - 横向排列 */}
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border-primary/50">
            <div className="text-center">
              <p className={cn(
                "text-xl lg:text-2xl font-bold",
                backtestTotalReturn >= 0 ? 'text-success' : 'text-danger'
              )}>
                {backtestTotalReturn >= 0 ? '+' : ''}{backtestTotalReturn.toFixed(1)}%
              </p>
              <p className="text-[10px] text-text-tertiary mt-1">回测收益</p>
            </div>
            <div className="text-center">
              <p className="text-xl lg:text-2xl font-bold text-white">{backtestWinRate.toFixed(0)}%</p>
              <p className="text-[10px] text-text-tertiary mt-1">胜率</p>
            </div>
            <div className="text-center">
              <p className="text-xl lg:text-2xl font-bold text-danger">-{Math.abs(backtestMaxDrawdown).toFixed(1)}%</p>
              <p className="text-[10px] text-text-tertiary mt-1">回撤</p>
            </div>
            <div className="text-center">
              <p className="text-xl lg:text-2xl font-bold text-white">{backtestTotalTrades}</p>
              <p className="text-[10px] text-text-tertiary mt-1">交易</p>
            </div>
          </div>

          {/* 数据来源标签 */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => setDataSource('backtest')}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-colors',
                dataSource === 'backtest'
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-tertiary text-text-secondary'
              )}
            >
              <FlaskConical className="w-3 h-3 inline mr-1" />
              回测数据
            </button>
            <button
              onClick={() => setDataSource('live')}
              disabled={!hasLiveData}
              className={cn(
                'px-3 py-1 text-xs rounded-full transition-colors',
                dataSource === 'live'
                  ? 'bg-success text-white'
                  : hasLiveData
                    ? 'bg-bg-tertiary text-text-secondary'
                    : 'bg-bg-tertiary text-text-tertiary opacity-50 cursor-not-allowed'
              )}
            >
              <BarChart3 className="w-3 h-3 inline mr-1" />
              实盘数据
            </button>
          </div>
        </div>
      </div>

      {/* ============ 收益曲线 ============ */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-text-primary flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-brand-primary" />
              收益曲线
            </span>
            <div className="flex gap-1 bg-bg-tertiary rounded-lg p-0.5">
              {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-md transition-colors',
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
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={profitData}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00C087" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00C087" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
              <XAxis dataKey="date" stroke="#848E9C" style={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis stroke="#848E9C" style={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={40} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E222D',
                  border: '1px solid #2B3139',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, '收益']}
              />
              <Area type="monotone" dataKey="profit" stroke="#00C087" strokeWidth={2} fill="url(#profitGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ============ 策略详情（合并介绍+信息） ============ */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-brand-primary" />
          策略详情
        </h3>

        {/* 策略描述 */}
        {strategy.description && (
          <p className="text-sm text-text-secondary leading-relaxed mb-4 pb-4 border-b border-border-primary">
            {strategy.description}
          </p>
        )}

        {/* 策略信息 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">策略类型</span>
            <span className="text-sm text-text-primary font-medium">{typeConfig.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">订阅人数</span>
            <span className="text-sm text-text-primary font-medium">
              {strategy.total_users || strategy.subscriber_count || 0} 人
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">上线时间</span>
            <span className="text-sm text-text-primary font-medium">
              {strategy.created_at
                ? new Date(strategy.created_at).toLocaleDateString('zh-CN')
                : '未知'}
            </span>
          </div>
        </div>
      </Card>

      {/* ============ 风险提示（可折叠） ============ */}
      <Card className="border-warning/20">
        <button
          onClick={() => setRiskExpanded(!riskExpanded)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">风险提示</span>
          </div>
          {riskExpanded ? (
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          )}
        </button>
        {riskExpanded && (
          <div className="px-4 pb-4 pt-0 text-xs text-text-secondary space-y-1.5">
            <p>• 单边行情下可能产生浮亏</p>
            <p>• 历史收益不代表未来表现</p>
            <p>• 请根据自身风险承受能力配置资金</p>
            <p>• 平台对策略运行结果不承担任何责任</p>
          </div>
        )}
      </Card>

      {/* ============ 固定底部 CTA ============ */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 bg-bg-primary/95 backdrop-blur-md border-t border-border-primary lg:relative lg:bg-transparent lg:border-0 lg:p-0 z-50">
        {subscribed ? (
          <div className="flex gap-3 max-w-lg mx-auto lg:max-w-none">
            <Button className="flex-1 h-12" size="lg" onClick={() => router.push('/trading')}>
              <Play className="w-4 h-4 mr-2" />
              前往交易控制台
            </Button>
            <Button variant="outline" className="h-12" onClick={() => router.push('/strategies/my')}>
              我的策略
            </Button>
          </div>
        ) : (
          <div className="max-w-lg mx-auto lg:max-w-none">
            <Button className="w-full h-12 text-base font-semibold" size="lg" onClick={handleGoToBacktest}>
              立即配置使用
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-[11px] text-text-tertiary text-center mt-2">
              配置参数 → 回测验证 → 保存到我的策略
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
