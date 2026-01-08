'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { strategiesApi, Strategy } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { SymbolSearch } from '@/components/features/trading';
import { StrategySelector } from '@/components/features/strategies/StrategySelector';
import {
  loadStrategyConfig,
  getDefaultConfig,
  type MinimalRoiEntry,
} from '@/types/strategy-config';
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
  AlertTriangle,
  Sliders,
  Code,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Calendar,
  Zap,
  RefreshCw,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ============ 类型定义 ============

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

// 页面模式
type PageMode = 'config' | 'loading' | 'result';

// ============ 常量配置 ============

const DEFAULT_PAIRS = ['BTC/USDT', 'ETH/USDT'];

const TIMEFRAME_OPTIONS = [
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
];

const EXCHANGE_OPTIONS = [
  { value: 'binance', label: 'Binance' },
  { value: 'okx', label: 'OKX' },
  { value: 'bybit', label: 'Bybit' },
  { value: 'huobi', label: 'Huobi' },
  { value: 'kucoin', label: 'KuCoin' },
];

// 快速日期选择选项
const QUICK_DATE_OPTIONS = [
  { label: '1周', days: 7 },
  { label: '1月', days: 30 },
  { label: '3月', days: 90 },
  { label: '6月', days: 180 },
];

// 热门交易对
const HOT_PAIRS = ['SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT'];

// ============ 骨架屏组件 ============

function BacktestSkeleton() {
  return (
    <div className="space-y-3 pb-24">
      <div className="h-8 w-20 bg-bg-tertiary rounded animate-pulse" />
      <div className="animate-pulse space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="h-14 bg-bg-tertiary rounded-lg" />
          <div className="h-14 bg-bg-tertiary rounded-lg" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-bg-tertiary rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ============ 步骤标题组件 ============

function StepTitle({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2 py-3">
      <div className="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center">
        <span className="text-xs font-bold text-brand-primary">{step}</span>
      </div>
      <span className="text-sm font-medium text-text-primary">{title}</span>
    </div>
  );
}

// ============ 主组件 ============

function BacktestPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultConfig = getDefaultConfig();

  // 页面模式状态
  const [pageMode, setPageMode] = useState<PageMode>('config');

  // 表单状态
  const [strategyId, setStrategyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [selectedPairs, setSelectedPairs] = useState<string[]>(DEFAULT_PAIRS);

  // 高级回测参数
  const [timeframe, setTimeframe] = useState('5m');
  const [fee, setFee] = useState('0.001');
  const [maxOpenTrades, setMaxOpenTrades] = useState('3');
  const [stakeAmount, setStakeAmount] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [exchange, setExchange] = useState('binance');

  // 止损止盈参数
  const [stopLoss, setStopLoss] = useState('-5');
  const [takeProfit, setTakeProfit] = useState('10');

  // 杠杆设置
  const [leverage, setLeverage] = useState('1');
  const [isContractMode, setIsContractMode] = useState(false);

  // 高级配置
  const [minimalRoi, setMinimalRoi] = useState<MinimalRoiEntry[]>(defaultConfig.minimalRoi);
  const [trailingStop, setTrailingStop] = useState(false);
  const [trailingStopPositive, setTrailingStopPositive] = useState('0.01');
  const [trailingStopOffset, setTrailingStopOffset] = useState('0.02');
  const [trailingOnlyOffsetReached, setTrailingOnlyOffsetReached] = useState(true);
  const [stoplossOnExchange, setStoplossOnExchange] = useState(true);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [crashProtection, setCrashProtection] = useState(false);
  const [crashThreshold, setCrashThreshold] = useState('-10');
  const [crashTimeframe, setCrashTimeframe] = useState('5');

  // 数据状态
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceStrategy, setSourceStrategy] = useState<Strategy | null>(null);
  const [fromStrategyDetail, setFromStrategyDetail] = useState(false);

  // 保存状态
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [directSaving, setDirectSaving] = useState(false);

  // ============ 初始化 ============

  useEffect(() => {
    const init = async () => {
      // 设置默认日期（最近3个月）
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      setEndDate(end.toISOString().split('T')[0]);
      setStartDate(start.toISOString().split('T')[0]);

      // 优先从 sessionStorage 读取配置
      const savedConfig = loadStrategyConfig();
      if (savedConfig) {
        setStrategyId(savedConfig.strategyId);
        setInitialCapital(savedConfig.capital);
        setStopLoss(savedConfig.stopLoss);
        setTakeProfit(savedConfig.takeProfit);
        setMaxOpenTrades(savedConfig.maxPositions);
        setTimeframe(savedConfig.timeframe);
        setExchange(savedConfig.exchange);
        if (savedConfig.fee) setFee(savedConfig.fee);

        const pairs = savedConfig.selectedCoins.map(c => c.includes('/') ? c : `${c}/USDT`);
        setSelectedPairs(pairs);

        setMinimalRoi(savedConfig.minimalRoi);
        setTrailingStop(savedConfig.trailingStop);
        setTrailingStopPositive(savedConfig.trailingStopPositive);
        setTrailingStopOffset(savedConfig.trailingStopOffset);
        setTrailingOnlyOffsetReached(savedConfig.trailingOnlyOffsetReached);
        setStoplossOnExchange(savedConfig.stoplossOnExchange);
        setBlacklist(savedConfig.blacklist);

        setFromStrategyDetail(true);

        try {
          const response = await strategiesApi.getDetail(savedConfig.strategyId);
          if (response.data) {
            setSourceStrategy(response.data as Strategy);
          }
        } catch (err) {
          console.error('获取策略详情失败:', err);
        }
        return;
      }

      // 兼容 URL 参数
      const urlStrategyId = searchParams.get('strategyId');
      if (urlStrategyId) {
        setStrategyId(urlStrategyId);
        try {
          const response = await strategiesApi.getDetail(urlStrategyId);
          if (response.data) {
            setSourceStrategy(response.data as Strategy);
          }
        } catch (err) {
          console.error('获取策略详情失败:', err);
        }
      }
    };

    init();
  }, [searchParams]);

  // ============ 事件处理 ============

  const handleStrategyChange = (id: string, strategy: Strategy | null) => {
    setStrategyId(id);
    setSourceStrategy(strategy);
  };

  // 快速日期选择
  const handleQuickDateSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  // 添加热门交易对
  const handleAddHotPair = (pair: string) => {
    if (!selectedPairs.includes(pair) && selectedPairs.length < 10) {
      setSelectedPairs([...selectedPairs, pair]);
    }
  };

  // 开始回测
  const handleBacktest = async () => {
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
    setPageMode('loading');

    try {
      // TODO: 调用真实回测 API
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockResult = generateMockBacktestResult(
        parseFloat(initialCapital),
        new Date(startDate),
        new Date(endDate)
      );
      setResult(mockResult);
      setPageMode('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '回测失败，请重试');
      setPageMode('config');
    }
  };

  // 保存配置
  const handleSaveToMyStrategies = async () => {
    if (!result || !strategyId) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const configToSave = {
        strategy_id: strategyId,
        stake_amount: initialCapital,
        max_open_trades: parseInt(maxOpenTrades) || 3,
        leverage: isContractMode ? parseInt(leverage) : 1,
        stoploss: parseFloat(stopLoss) / 100,
        trailing_stop: trailingStop,
        timeframe: timeframe,
        pair_whitelist: selectedPairs,
        blacklist: blacklist,
        custom_config: {
          take_profit: parseFloat(takeProfit) / 100,
          fee: parseFloat(fee),
          stake_amount_per_trade: stakeAmount || undefined,
          exchange: exchange,
          minimal_roi: minimalRoi.reduce((acc, entry) => {
            acc[entry.minutes.toString()] = entry.roi;
            return acc;
          }, {} as Record<string, number>),
          trailing_stop_positive: trailingStop ? parseFloat(trailingStopPositive) : undefined,
          trailing_stop_positive_offset: trailingStop ? parseFloat(trailingStopOffset) : undefined,
          trailing_only_offset_is_reached: trailingStop ? trailingOnlyOffsetReached : undefined,
          stoploss_on_exchange: stoplossOnExchange,
          crash_protection: crashProtection,
          crash_threshold: crashProtection ? parseFloat(crashThreshold) : undefined,
          crash_timeframe: crashProtection ? parseInt(crashTimeframe) : undefined,
          backtest_summary: {
            totalReturn: result.totalReturn,
            winRate: result.winRate,
            maxDrawdown: result.maxDrawdown,
            sharpeRatio: result.sharpeRatio,
            totalTrades: result.totalTrades,
            dateRange: { startDate, endDate },
          },
        },
      };

      await strategiesApi.createConfig(configToSave);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('保存失败:', err);
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 直接保存
  const handleDirectSave = async () => {
    if (!strategyId) {
      setError('请选择策略');
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
    setDirectSaving(true);

    try {
      const configToSave = {
        strategy_id: strategyId,
        stake_amount: initialCapital,
        max_open_trades: parseInt(maxOpenTrades) || 3,
        leverage: isContractMode ? parseInt(leverage) : 1,
        stoploss: parseFloat(stopLoss) / 100,
        trailing_stop: trailingStop,
        timeframe: timeframe,
        pair_whitelist: selectedPairs,
        blacklist: blacklist,
        custom_config: {
          take_profit: parseFloat(takeProfit) / 100,
          fee: parseFloat(fee),
          stake_amount_per_trade: stakeAmount || undefined,
          exchange: exchange,
          is_contract_mode: isContractMode,
          minimal_roi: minimalRoi.reduce((acc, entry) => {
            acc[entry.minutes.toString()] = entry.roi;
            return acc;
          }, {} as Record<string, number>),
          trailing_stop_positive: trailingStop ? parseFloat(trailingStopPositive) : undefined,
          trailing_stop_positive_offset: trailingStop ? parseFloat(trailingStopOffset) : undefined,
          trailing_only_offset_is_reached: trailingStop ? trailingOnlyOffsetReached : undefined,
          stoploss_on_exchange: stoplossOnExchange,
          crash_protection: crashProtection,
          crash_threshold: crashProtection ? parseFloat(crashThreshold) : undefined,
          crash_timeframe: crashProtection ? parseInt(crashTimeframe) : undefined,
        },
      };

      await strategiesApi.createConfig(configToSave);
      router.push('/strategies/my?saved=true');
    } catch (err) {
      console.error('保存失败:', err);
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setDirectSaving(false);
    }
  };

  // 重新配置
  const handleReconfig = () => {
    setPageMode('config');
  };

  // 获取风险评级
  const getRiskRating = (sharpe: number) => {
    if (sharpe >= 2) return { grade: 'A', label: '优秀', color: 'text-success', bg: 'bg-success/20' };
    if (sharpe >= 1.5) return { grade: 'B', label: '良好', color: 'text-brand-primary', bg: 'bg-brand-primary/20' };
    if (sharpe >= 1) return { grade: 'C', label: '一般', color: 'text-warning', bg: 'bg-warning/20' };
    return { grade: 'D', label: '较差', color: 'text-danger', bg: 'bg-danger/20' };
  };

  // 已移除顶部副标题文案

  // ============ 渲染：加载状态 ============

  if (pageMode === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-6 pb-24">
        <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-lg font-medium text-white mb-2">正在回测中</p>
          <p className="text-text-secondary text-sm">策略：{sourceStrategy?.name || '未知策略'}</p>
          <p className="text-text-tertiary text-xs mt-1">{startDate} ~ {endDate}</p>
        </div>
      </div>
    );
  }

  // ============ 渲染：回测结果 ============

  if (pageMode === 'result' && result) {
    const rating = getRiskRating(result.sharpeRatio);

    return (
      <div className="space-y-3 pb-28">
        {/* 紧凑头部 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReconfig}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            aria-label="返回"
          >
            <ChevronDown className="w-5 h-5 rotate-90" />
          </button>
          <div>
            <span className="text-sm font-medium text-text-primary">回测结果</span>
            <p className="text-xs text-text-tertiary">{sourceStrategy?.name || '策略'} · {startDate.slice(5)} ~ {endDate.slice(5)}</p>
          </div>
        </div>

        {/* 核心收益卡片 */}
        <Card className="bg-gradient-to-br from-brand-primary/10 to-success/10 border-brand-primary/30">
          <CardContent className="p-6 text-center">
            <p className="text-text-secondary text-sm mb-2">总收益率</p>
            <p className={`text-4xl font-bold ${result.totalReturn >= 0 ? 'text-success' : 'text-danger'}`}>
              {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
            </p>
            <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full ${rating.bg}`}>
              <Star className={`w-4 h-4 ${rating.color}`} />
              <span className={`text-sm font-medium ${rating.color}`}>
                风险评级: {rating.grade} ({rating.label})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 三指标卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-white">{result.winRate.toFixed(0)}%</p>
              <p className="text-[10px] text-text-tertiary">胜率</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-danger">{result.maxDrawdown.toFixed(1)}%</p>
              <p className="text-[10px] text-text-tertiary">最大回撤</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-brand-primary">{result.sharpeRatio.toFixed(2)}</p>
              <p className="text-[10px] text-text-tertiary">夏普比率</p>
            </CardContent>
          </Card>
        </div>

        {/* 收益曲线 */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-primary" />
              收益曲线
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.curve}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3772FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3772FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
                  <XAxis dataKey="date" stroke="#848E9C" tick={{ fill: '#848E9C', fontSize: 10 }} tickLine={false} />
                  <YAxis stroke="#848E9C" tick={{ fill: '#848E9C', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E222D', border: '1px solid #2B3139', borderRadius: '8px' }}
                    labelStyle={{ color: '#FFFFFF', fontSize: 12 }}
                    itemStyle={{ color: '#3772FF', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3772FF" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 详细统计 */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-primary" />
              详细统计
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-border-primary/30">
                <span className="text-text-secondary text-sm">交易次数</span>
                <span className="text-white font-medium">{result.totalTrades} 笔</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-primary/30">
                <span className="text-text-secondary text-sm">平均盈利</span>
                <span className="text-success font-medium">+{formatCurrency(result.avgProfit)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-primary/30">
                <span className="text-text-secondary text-sm">平均亏损</span>
                <span className="text-danger font-medium">{formatCurrency(result.avgLoss)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-primary/30">
                <span className="text-text-secondary text-sm">盈亏比</span>
                <span className="text-white font-medium">{result.profitFactor.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-primary/30">
                <span className="text-text-secondary text-sm">初始资金</span>
                <span className="text-white font-medium">{formatCurrency(parseFloat(initialCapital))}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-text-secondary text-sm">最终资金</span>
                <span className="text-success font-medium">
                  {formatCurrency(parseFloat(initialCapital) * (1 + result.totalReturn / 100))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 固定底部操作栏 */}
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 bg-bg-primary/95 backdrop-blur-md border-t border-border-primary z-50">
          <div className="max-w-lg mx-auto space-y-2">
            <Button
              className="w-full h-12"
              onClick={handleSaveToMyStrategies}
              isLoading={saving}
              disabled={saving || saveSuccess}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  已保存到我的策略
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  保存到我的策略
                </>
              )}
            </Button>
            <button
              onClick={handleReconfig}
              className="w-full py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              重新配置
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============ 渲染：配置表单 ============

  return (
    <div className="space-y-3 pb-32">
      {/* 移动端紧凑返回按钮 */}
      <div className="lg:hidden flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          aria-label="返回"
        >
          <ChevronDown className="w-5 h-5 rotate-90" />
        </button>
        <span className="text-sm text-text-secondary">回测</span>
      </div>

      {/* 高级回测入口 */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/trading/backtest/visual">
          <Card className="hover:border-brand-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-2.5 flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-primary/20 rounded-lg flex items-center justify-center shrink-0">
                <Sliders className="w-4 h-4 text-brand-primary" />
              </div>
              <p className="text-text-primary font-medium text-sm">自定义策略</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/trading/backtest/code">
          <Card className="hover:border-brand-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-2.5 flex items-center gap-2">
              <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center shrink-0">
                <Code className="w-4 h-4 text-warning" />
              </div>
              <p className="text-text-primary font-medium text-sm">代码上传</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Step 1: 选择策略 - 设置 overflow-visible 确保下拉不被截断 */}
      <Card className="overflow-visible">
        <CardContent className="p-4 overflow-visible">
          <StepTitle step={1} title="选择策略" />
          <StrategySelector
            value={strategyId}
            onChange={handleStrategyChange}
            preselectedStrategy={sourceStrategy}
            placeholder="搜索或选择策略..."
          />
        </CardContent>
      </Card>

      {/* Step 2: 回测时间 */}
      <Card>
        <CardContent className="p-4">
          <StepTitle step={2} title="回测时间" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">起始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">结束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            <span className="text-xs text-text-tertiary mr-2">快速选择:</span>
            {QUICK_DATE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => handleQuickDateSelect(opt.days)}
                className="px-2 py-1 rounded text-xs bg-bg-tertiary text-text-secondary hover:bg-brand-primary/20 hover:text-brand-primary transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: 资金与风控 */}
      <Card>
        <CardContent className="p-4">
          <StepTitle step={3} title="资金与风控" />
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">初始资金 (USDT)</label>
              <Input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                placeholder="10000"
                min="100"
                step="100"
                className="text-lg font-medium"
              />
              <p className="text-[10px] text-text-tertiary mt-1">推荐: $1,000 - $100,000</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-tertiary mb-1">止损 (%)</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="-5"
                    min="-50"
                    max="0"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-danger text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1">止盈 (%)</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="10"
                    min="0"
                    max="100"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success text-sm">%</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-text-tertiary">止损推荐 -5% 至 -15%，止盈推荐 5% 至 30%</p>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: 交易对选择 */}
      <Card>
        <CardContent className="p-4">
          <StepTitle step={4} title="交易对选择" />
          <SymbolSearch
            selectedSymbols={selectedPairs}
            onSelectionChange={setSelectedPairs}
            maxSelection={10}
          />
          <div className="mt-3">
            <p className="text-xs text-text-tertiary mb-2">热门交易对:</p>
            <div className="flex flex-wrap gap-2">
              {HOT_PAIRS.filter(p => !selectedPairs.includes(p)).slice(0, 6).map((pair) => (
                <button
                  key={pair}
                  onClick={() => handleAddHotPair(pair)}
                  className="px-2 py-1 rounded text-xs bg-bg-tertiary text-text-secondary hover:bg-brand-primary/20 hover:text-brand-primary transition-colors"
                >
                  + {pair.replace('/USDT', '')}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 高级参数（折叠） */}
      <Card>
        <CardContent className="p-0">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-4"
          >
            <span className="text-sm text-text-secondary font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" />
              高级参数 (可选)
            </span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-text-tertiary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-4 pt-0 space-y-4 border-t border-border-primary/30">
              {/* 交易所选择 */}
              <div>
                <label className="block text-xs text-text-tertiary mb-1">交易所</label>
                <select
                  className="w-full bg-bg-tertiary border border-border-secondary rounded-lg p-2.5 text-white text-sm focus:border-brand-primary outline-none"
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                >
                  {EXCHANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* K 线周期 */}
              <div>
                <label className="block text-xs text-text-tertiary mb-2">K 线周期</label>
                <div className="flex flex-wrap gap-2">
                  {TIMEFRAME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTimeframe(opt.value)}
                      className={`px-3 py-1.5 rounded text-xs transition-colors ${
                        timeframe === opt.value
                          ? 'bg-brand-primary text-white'
                          : 'bg-bg-tertiary text-text-secondary hover:bg-border-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 合约模式与杠杆 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-text-secondary">合约交易模式</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsContractMode(!isContractMode);
                      if (!isContractMode) setLeverage('1');
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isContractMode ? 'bg-brand-primary' : 'bg-bg-tertiary'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isContractMode ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                {isContractMode && (
                  <div>
                    <label className="block text-xs text-text-tertiary mb-2">杠杆倍数</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={leverage}
                        onChange={(e) => setLeverage(e.target.value)}
                        className="flex-1 accent-brand-primary"
                      />
                      <span className="text-white font-medium w-12 text-right">{leverage}x</span>
                    </div>
                    <p className="text-xs text-warning mt-1">高杠杆风险极高，新手建议 1-3x</p>
                  </div>
                )}
              </div>

              {/* 最大持仓数 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">最大持仓数</label>
                  <select
                    className="w-full bg-bg-tertiary border border-border-secondary rounded-lg p-2.5 text-white text-sm focus:border-brand-primary outline-none"
                    value={maxOpenTrades}
                    onChange={(e) => setMaxOpenTrades(e.target.value)}
                  >
                    {[1, 2, 3, 5, 10, 20].map((num) => (
                      <option key={num} value={num}>{num} 个</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">手续费率</label>
                  <Input
                    type="number"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    min="0"
                    max="0.01"
                    step="0.0001"
                    placeholder="0.001"
                  />
                </div>
              </div>

              {/* 移动止损 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-text-secondary">启用移动止损</label>
                  <button
                    type="button"
                    onClick={() => setTrailingStop(!trailingStop)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      trailingStop ? 'bg-brand-primary' : 'bg-bg-tertiary'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      trailingStop ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                {trailingStop && (
                  <div className="pl-4 space-y-3 border-l-2 border-brand-primary/30">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">触发收益 (%)</label>
                        <Input
                          type="number"
                          value={trailingStopPositive}
                          onChange={(e) => setTrailingStopPositive(e.target.value)}
                          placeholder="0.01"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">偏移量 (%)</label>
                        <Input
                          type="number"
                          value={trailingStopOffset}
                          onChange={(e) => setTrailingStopOffset(e.target.value)}
                          placeholder="0.02"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-text-tertiary">仅在达到偏移量后触发</label>
                      <button
                        type="button"
                        onClick={() => setTrailingOnlyOffsetReached(!trailingOnlyOffsetReached)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          trailingOnlyOffsetReached ? 'bg-brand-primary' : 'bg-bg-tertiary'
                        }`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          trailingOnlyOffsetReached ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    <p className="text-[10px] text-text-tertiary">
                      当收益达到 {trailingStopPositive}% 后，止损线将跟随价格移动，保持 {trailingStopOffset}% 偏移
                    </p>
                  </div>
                )}
              </div>

              {/* 止损交易所执行 */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-text-secondary">止损在交易所执行</label>
                  <p className="text-[10px] text-text-tertiary">推荐开启，避免网络延迟</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStoplossOnExchange(!stoplossOnExchange)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    stoplossOnExchange ? 'bg-brand-primary' : 'bg-bg-tertiary'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    stoplossOnExchange ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* 最小收益设置 (minimal_roi) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-text-secondary">分阶止盈 (ROI)</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (minimalRoi.length < 5) {
                        setMinimalRoi([...minimalRoi, { minutes: 0, roi: 0.05 }]);
                      }
                    }}
                    className="text-xs text-brand-primary hover:text-brand-secondary"
                  >
                    + 添加阶段
                  </button>
                </div>
                <div className="space-y-2">
                  {minimalRoi.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={entry.minutes}
                        onChange={(e) => {
                          const newRoi = [...minimalRoi];
                          newRoi[index].minutes = parseInt(e.target.value) || 0;
                          setMinimalRoi(newRoi);
                        }}
                        placeholder="分钟"
                        className="w-20 text-xs"
                        min="0"
                      />
                      <span className="text-xs text-text-tertiary">分钟后</span>
                      <Input
                        type="number"
                        value={entry.roi}
                        onChange={(e) => {
                          const newRoi = [...minimalRoi];
                          newRoi[index].roi = parseFloat(e.target.value) || 0;
                          setMinimalRoi(newRoi);
                        }}
                        placeholder="收益率"
                        className="w-20 text-xs"
                        step="0.01"
                        min="0"
                      />
                      <span className="text-xs text-text-tertiary">止盈</span>
                      {minimalRoi.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMinimalRoi(minimalRoi.filter((_, i) => i !== index))}
                          className="p-1 text-danger hover:bg-danger/10 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-text-tertiary">
                  示例：0分钟后10%止盈，60分钟后5%止盈，表示持仓时间越长止盈条件越宽松
                </p>
              </div>

              {/* 黑名单管理 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-text-secondary">交易对黑名单</label>
                  <span className="text-xs text-text-tertiary">{blacklist.length} 个</span>
                </div>
                {blacklist.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {blacklist.map((pair, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-danger/10 text-danger text-xs rounded"
                      >
                        {pair}
                        <button
                          type="button"
                          onClick={() => setBlacklist(blacklist.filter((_, i) => i !== index))}
                          className="hover:bg-danger/20 rounded-full p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="输入交易对，如 LUNA/USDT"
                    className="flex-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget;
                        const value = input.value.trim().toUpperCase();
                        if (value && !blacklist.includes(value)) {
                          setBlacklist([...blacklist, value]);
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-[10px] text-text-tertiary">
                  添加不参与交易的币种，回车确认
                </p>
              </div>

              {/* 黑天鹅防护 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <label className="text-sm text-text-secondary">黑天鹅防护</label>
                </div>
                <button
                  type="button"
                  onClick={() => setCrashProtection(!crashProtection)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    crashProtection ? 'bg-warning' : 'bg-bg-tertiary'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    crashProtection ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* 配置来源提示 */}
              {fromStrategyDetail && (
                <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
                  <p className="text-xs text-success">✓ 配置已从策略详情页同步</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* 固定底部操作栏 */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 bg-bg-primary/95 backdrop-blur-md border-t border-border-primary z-50">
        <div className="max-w-lg mx-auto space-y-2">
          <Button
            className="w-full h-12"
            onClick={handleBacktest}
            disabled={directSaving}
          >
            <PlayCircle className="w-5 h-5 mr-2" />
            开始回测
          </Button>
          <button
            onClick={handleDirectSave}
            disabled={directSaving}
            className="w-full py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {directSaving ? '保存中...' : '直接保存到我的策略'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 模拟数据生成 ============

function generateMockBacktestResult(
  initialCapital: number,
  startDate: Date,
  endDate: Date
): BacktestResult {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const curve: Array<{ date: string; value: number; trades: number }> = [];

  let currentValue = initialCapital;
  let maxValue = initialCapital;
  let maxDrawdown = 0;
  let totalTrades = 0;
  let winTrades = 0;

  for (let i = 0; i <= days; i += 7) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const change = (Math.random() * 8 - 3) / 100;
    currentValue *= 1 + change;

    if (currentValue > maxValue) {
      maxValue = currentValue;
    }
    const drawdown = ((maxValue - currentValue) / maxValue) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    const trades = Math.floor(Math.random() * 5);
    totalTrades += trades;
    winTrades += Math.floor(trades * (0.55 + Math.random() * 0.15));

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
    sharpeRatio: 1.2 + Math.random() * 0.8,
    totalTrades,
    avgProfit: 45 + Math.random() * 30,
    avgLoss: -25 - Math.random() * 15,
    profitFactor: 1.5 + Math.random() * 1.0,
    curve,
  };
}

// ============ 导出 ============

export default function BacktestPage() {
  return (
    <Suspense fallback={<BacktestSkeleton />}>
      <BacktestPageInner />
    </Suspense>
  );
}
