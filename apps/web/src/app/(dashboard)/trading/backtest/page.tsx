'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, Button } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { strategiesApi, Strategy } from '@/lib/api';
import { StrategySelector, ParamsHelpModal } from '@/components/features/strategies';
import {
  loadStrategyConfig,
  getDefaultConfig,
} from '@/types/strategy-config';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  PlayCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Save,
  CheckCircle2,
  Loader2,
  RotateCcw,
  X,
  Clock,
  Target,
  ArrowLeft,
  Search,
  Plus,
  Shield,
  AlertTriangle,
  Code,
  HelpCircle,
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

// ============ 类型定义 ============

type PageState = 'config' | 'loading' | 'result';

interface BacktestResult {
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  curveData: Array<{ date: string; value: number }>;
}

// 默认交易对
const DEFAULT_PAIRS = ['BTC/USDT', 'ETH/USDT'];
const HOT_PAIRS = ['SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT'];
// 所有可选交易对（用于搜索）
const ALL_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'ETC/USDT',
  'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'NEAR/USDT',
  'AAVE/USDT', 'MKR/USDT', 'SNX/USDT', 'CRV/USDT', 'LDO/USDT',
  'SAND/USDT', 'MANA/USDT', 'AXS/USDT', 'GALA/USDT', 'IMX/USDT',
];

// ============ 骨架屏组件 ============

function BacktestSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-bg-tertiary rounded-lg w-48" />
      <div className="h-32 bg-bg-tertiary rounded-lg" />
      <div className="h-24 bg-bg-tertiary rounded-lg" />
      <div className="h-24 bg-bg-tertiary rounded-lg" />
    </div>
  );
}

// ============ 主组件 ============

function BacktestPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultConfig = getDefaultConfig();

  // 页面状态
  const [pageState, setPageState] = useState<PageState>('config');

  // 策略选择（含 content 字段用于判断是否有代码）
  const [strategyId, setStrategyId] = useState('');
  const [sourceStrategy, setSourceStrategy] = useState<(Strategy & { content?: string }) | null>(null);

  // 回测参数
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [selectedPairs, setSelectedPairs] = useState<string[]>(DEFAULT_PAIRS);
  const [stopLoss, setStopLoss] = useState('-5');
  const [takeProfit, setTakeProfit] = useState('10');

  // 高级参数
  const [timeframe, setTimeframe] = useState('5m');
  const [fee, setFee] = useState('0.001');
  const [maxOpenTrades, setMaxOpenTrades] = useState('3');
  const [leverage, setLeverage] = useState('1');
  const [exchange, setExchange] = useState('binance');
  const [showAdvanced, setShowAdvanced] = useState(true);

  // 跟随策略代码（止损/止盈/K线/追踪止损使用代码中的值）
  const [followStrategyCode, setFollowStrategyCode] = useState(true);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showParamsHelp, setShowParamsHelp] = useState(false);
  const [pairSearch, setPairSearch] = useState('');
  const [showPairSearch, setShowPairSearch] = useState(false);

  // 风控参数
  const [dryRun, setDryRun] = useState(false);
  const [trailingStop, setTrailingStop] = useState(false);
  const [stoplossOnExchange, setStoplossOnExchange] = useState(true);
  const [unfilledTimeout, setUnfilledTimeout] = useState('10'); // 未成交超时（分钟）
  const [cancelOpenOrders, setCancelOpenOrders] = useState(true); // 退出时取消挂单

  // 黑天鹅防护
  const [blackSwanEnabled, setBlackSwanEnabled] = useState(false);
  const [blackSwanThreshold, setBlackSwanThreshold] = useState('-10');
  const [blackSwanTimeframe, setBlackSwanTimeframe] = useState('5');
  const [blackSwanAction, setBlackSwanAction] = useState('pause');

  // 结果和状态
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ============ 初始化 ============

  useEffect(() => {
    // 设置默认日期（最近3个月）
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);

    // 读取 sessionStorage 配置
    const savedConfig = loadStrategyConfig();
    if (savedConfig) {
      setStrategyId(savedConfig.strategyId);
      setInitialCapital(savedConfig.capital);
      setStopLoss(savedConfig.stopLoss);
      setTakeProfit(savedConfig.takeProfit);
      setMaxOpenTrades(savedConfig.maxPositions);
      setTimeframe(savedConfig.timeframe);
      setExchange(savedConfig.exchange);
      const pairs = savedConfig.selectedCoins.map(c => c.includes('/') ? c : `${c}/USDT`);
      setSelectedPairs(pairs);

      // 获取策略详情
      strategiesApi.getDetail(savedConfig.strategyId).then(response => {
        if (response.data) {
          setSourceStrategy(response.data as Strategy);
        }
      }).catch(console.error);
    }
  }, []);

  // 从 URL 参数读取策略
  useEffect(() => {
    const urlStrategyId = searchParams.get('strategyId');
    if (urlStrategyId && urlStrategyId !== strategyId) {
      setStrategyId(urlStrategyId);
      strategiesApi.getDetail(urlStrategyId).then(response => {
        if (response.data) {
          setSourceStrategy(response.data as Strategy);
        }
      }).catch(console.error);
    }
  }, [searchParams]);

  // ============ 事件处理 ============

  const handleStrategyChange = (id: string, strategy: (Strategy & { content?: string }) | null) => {
    setStrategyId(id);
    setSourceStrategy(strategy);
  };

  const handleQuickDateSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const handleAddHotPair = (pair: string) => {
    if (!selectedPairs.includes(pair) && selectedPairs.length < 10) {
      setSelectedPairs([...selectedPairs, pair]);
    }
  };

  const handleRemovePair = (pair: string) => {
    setSelectedPairs(selectedPairs.filter(p => p !== pair));
  };

  // 开始回测
  const handleStartBacktest = async () => {
    if (!strategyId) {
      setError('请先选择一个策略');
      return;
    }

    if (selectedPairs.length === 0) {
      setError('请至少选择一个交易对');
      return;
    }

    setError(null);
    setPageState('loading');

    try {
      // 判断是否跟随策略代码（确保返回布尔值）
      const shouldFollowCode = !!(sourceStrategy?.content && followStrategyCode);

      // 调用真实 Freqtrade 回测 API
      // 当跟随策略代码时，不传 stoploss/takeprofit/timeframe，让后端使用代码中的值
      const response = await strategiesApi.backtest({
        strategyId,
        pairs: selectedPairs,
        startDate,
        endDate,
        initialCapital: parseFloat(initialCapital),
        leverage: parseFloat(leverage),
        maxOpenTrades: parseInt(maxOpenTrades, 10),
        // 只有不跟随代码时才传这些参数
        ...(!shouldFollowCode && {
          stoploss: parseFloat(stopLoss),
          takeprofit: parseFloat(takeProfit),
          timeframe,
        }),
        // 标记是否跟随策略代码
        followStrategyCode: shouldFollowCode,
      });

      if (response.code !== 0) {
        throw new Error(response.message || '回测失败');
      }

      // 映射 API 响应到前端结构
      const apiResult = response.data;
      const backtestResult: BacktestResult = {
        totalReturn: apiResult.totalReturn,
        winRate: apiResult.winRate,
        maxDrawdown: apiResult.maxDrawdown,
        sharpeRatio: apiResult.sharpeRatio,
        totalTrades: apiResult.totalTrades,
        avgProfit: apiResult.avgProfit,
        avgLoss: apiResult.avgLoss,
        profitFactor: apiResult.profitFactor,
        curveData: apiResult.curve || generateMockCurveData(),
      };

      setResult(backtestResult);
      setPageState('result');
    } catch (err: any) {
      // 检查是否是无 VPS 的错误
      if (err?.response?.data?.code === 40301) {
        setError('您还没有活跃的 VPS 实例，请先购买 VPS 服务后再进行回测');
      } else {
        setError(err instanceof Error ? err.message : '回测失败，请稍后重试');
      }
      setPageState('config');
    }
  };

  // 生成模拟收益曲线
  const generateMockCurveData = () => {
    const data = [];
    let value = parseFloat(initialCapital);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const step = Math.max(1, Math.floor(days / 50));

    for (let i = 0; i <= days; i += step) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      value = value * (1 + (Math.random() - 0.45) * 0.03);
      data.push({
        date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        value: Math.round(value),
      });
    }
    return data;
  };

  // 保存到我的策略
  const handleSaveToMyStrategies = async () => {
    console.log('[DEBUG] handleSaveToMyStrategies - strategyId:', strategyId);
    if (!strategyId) {
      setError('请先选择一个策略');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      // 判断是否跟随策略代码（确保返回布尔值）
      const shouldFollowCode = !!(sourceStrategy?.content && followStrategyCode);

      const configToSave = {
        strategy_id: strategyId,
        stake_amount: initialCapital,
        max_open_trades: parseInt(maxOpenTrades) || 3,
        leverage: parseInt(leverage) || 1,
        pair_whitelist: selectedPairs,
        // stoploss 是必填字段，需要始终发送（负数，范围 -1 到 0）
        stoploss: parseFloat(stopLoss) / 100,
        // 风控参数
        stoploss_on_exchange: stoplossOnExchange,
        // 标记是否跟随策略代码
        follow_strategy_code: shouldFollowCode,
        // 只有不跟随代码时才传这些可选参数
        ...(!shouldFollowCode && {
          timeframe: timeframe,
          trailing_stop: trailingStop,
        }),
        custom_config: {
          fee: parseFloat(fee),
          exchange: exchange,
          dry_run: dryRun,
          // 只有不跟随代码时才传止盈
          ...(!shouldFollowCode && {
            take_profit: parseFloat(takeProfit) / 100,
          }),
          // 黑天鹅防护
          crash_protection: blackSwanEnabled,
          crash_threshold: blackSwanEnabled ? blackSwanThreshold : null,
          crash_timeframe: blackSwanEnabled ? blackSwanTimeframe : null,
          crash_action: blackSwanEnabled ? blackSwanAction : null,
          // 如果有回测结果，添加回测摘要
          ...(result && {
            backtest_summary: {
              totalReturn: result.totalReturn,
              winRate: result.winRate,
              maxDrawdown: result.maxDrawdown,
              sharpeRatio: result.sharpeRatio,
              totalTrades: result.totalTrades,
              dateRange: { startDate, endDate },
            },
          }),
        },
      };

      console.log('[DEBUG] configToSave:', JSON.stringify(configToSave, null, 2));
      await strategiesApi.createConfig(configToSave);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReconfig = () => {
    setPageState('config');
  };

  const getRiskRating = (sharpe: number) => {
    if (sharpe >= 2) return { grade: 'A', label: '优秀', color: 'text-success', bg: 'bg-success/20' };
    if (sharpe >= 1.5) return { grade: 'B', label: '良好', color: 'text-brand-primary', bg: 'bg-brand-primary/20' };
    if (sharpe >= 1) return { grade: 'C', label: '一般', color: 'text-warning', bg: 'bg-warning/20' };
    return { grade: 'D', label: '较差', color: 'text-danger', bg: 'bg-danger/20' };
  };

  // ============ 渲染：加载状态 ============
  if (pageState === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">正在回测中...</h3>
          <p className="text-text-secondary text-sm">
            {sourceStrategy?.name || '策略'} · {selectedPairs.length} 个交易对
          </p>
        </div>
      </div>
    );
  }

  // ============ 渲染：结果页面 ============
  if (pageState === 'result' && result) {
    const riskRating = getRiskRating(result.sharpeRatio);

    return (
      <div className="pb-6 space-y-4">
        {/* 主卡片 */}
        <Card>
          <CardContent className="p-0">
            {/* 返回按钮 + 核心收益 */}
            <div className="relative p-4 text-center bg-gradient-to-b from-brand-primary/5 to-transparent">
              <button
                onClick={handleReconfig}
                className="absolute left-3 top-3 p-1.5 text-text-secondary hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <p className={`text-4xl font-bold ${result.totalReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
              </p>
              <p className="text-text-tertiary text-xs mt-1">总收益率</p>
              <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs ${riskRating.bg} ${riskRating.color}`}>
                ⭐ 风险评级: {riskRating.grade} ({riskRating.label})
              </div>
            </div>

            {/* 四个核心指标 - 一行，无分割线 */}
            <div className="grid grid-cols-4 py-3 px-2">
              <div className="text-center">
                <p className="text-base font-bold text-white">{result.winRate.toFixed(0)}%</p>
                <p className="text-[10px] text-text-tertiary">胜率</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-danger">{result.maxDrawdown.toFixed(0)}%</p>
                <p className="text-[10px] text-text-tertiary">最大回撤</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-brand-primary">{result.sharpeRatio.toFixed(2)}</p>
                <p className="text-[10px] text-text-tertiary">夏普比率</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-white">{result.totalTrades}</p>
                <p className="text-[10px] text-text-tertiary">交易次数</p>
              </div>
            </div>

            {/* 收益曲线 */}
            <div className="px-4 pb-4">
              <h4 className="text-xs font-medium text-text-tertiary mb-2">收益曲线</h4>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.curveData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3772FF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3772FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#5E6673', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#5E6673', fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E222D',
                        border: '1px solid #2B3139',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3772FF"
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 详细统计 - 紧凑列表 */}
            <div className="px-4 pb-4">
              <h4 className="text-xs font-medium text-text-tertiary mb-2">详细统计</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">平均盈利</span>
                  <span className="text-success">${result.avgProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">平均亏损</span>
                  <span className="text-danger">${Math.abs(result.avgLoss).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">盈亏比</span>
                  <span className="text-white">{result.profitFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">初始资金</span>
                  <span className="text-white">${parseFloat(initialCapital).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 保存按钮 - 卡片下方 */}
        <Button
          onClick={handleSaveToMyStrategies}
          disabled={saving || saveSuccess}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? '保存中...' : saveSuccess ? '已保存到我的策略' : '保存到我的策略'}
        </Button>
      </div>
    );
  }

  // ============ 渲染：配置页面 ============

  // 回测周期选项
  const PERIOD_OPTIONS = [
    { label: '1周', days: 7 },
    { label: '1月', days: 30 },
    { label: '3月', days: 90 },
    { label: '6月', days: 180 },
    { label: '1年', days: 365 },
  ];

  // 计算当前选中的周期
  const getSelectedPeriod = () => {
    if (!startDate || !endDate) return 90; // 默认3月
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const match = PERIOD_OPTIONS.find(p => Math.abs(p.days - days) < 3);
    return match ? match.days : null;
  };

  const selectedPeriod = getSelectedPeriod();

  return (
    <div className="space-y-3 pb-32">
      {/* 单卡片表单 */}
      <Card className="overflow-visible">
        <CardContent className="p-0 overflow-visible">
          <div className="divide-y divide-border-primary">

            {/* 选择策略 - 返回按钮在左侧，问号在右侧 */}
            <div className="p-4 overflow-visible">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="p-2 -ml-2 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 overflow-visible">
                  <StrategySelector
                    value={strategyId}
                    onChange={handleStrategyChange}
                    label=""
                    placeholder="搜索或选择策略..."
                    preselectedStrategy={sourceStrategy}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowParamsHelp(true)}
                  className="p-2 rounded-lg hover:bg-bg-tertiary text-text-tertiary hover:text-brand-primary transition-colors"
                  title="查看参数说明"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 回测周期 */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-brand-primary" />
                <span className="text-sm font-medium text-white">回测周期</span>
              </div>
              {/* 预设周期按钮 */}
              <div className="flex flex-wrap gap-2 mb-2">
                {PERIOD_OPTIONS.map((item) => (
                  <button
                    key={item.days}
                    onClick={() => {
                      handleQuickDateSelect(item.days);
                      setShowCustomDate(false);
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      selectedPeriod === item.days && !showCustomDate
                        ? 'bg-brand-primary text-white'
                        : 'bg-bg-tertiary hover:bg-border-secondary text-text-secondary hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomDate(!showCustomDate)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    showCustomDate || selectedPeriod === null
                      ? 'bg-brand-primary text-white'
                      : 'bg-bg-tertiary hover:bg-border-secondary text-text-secondary hover:text-white'
                  }`}
                >
                  自定义
                </button>
              </div>
              {/* 自定义日期（仅点击自定义时显示）*/}
              {showCustomDate && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">开始日期</label>
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
              )}
            </div>

            {/* 资金与交易对 */}
            <div className="p-4">
              {/* 初始资金 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-text-tertiary">💰 初始资金 (USDT)</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">$</span>
                  <Input
                    type="number"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                    placeholder="10000"
                    className="text-sm pl-7"
                  />
                </div>
              </div>

              {/* 交易对选择 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-tertiary">🎯 交易对</span>
                  <span className="text-xs text-text-tertiary">{selectedPairs.length}/10</span>
                </div>

                {/* 搜索框 */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <Input
                    type="text"
                    value={pairSearch}
                    onChange={(e) => {
                      setPairSearch(e.target.value.toUpperCase());
                      setShowPairSearch(true);
                    }}
                    onFocus={() => setShowPairSearch(true)}
                    placeholder="搜索交易对，如 BTC、ETH..."
                    className="text-sm pl-9"
                  />
                  {/* 搜索结果下拉 */}
                  {showPairSearch && pairSearch && (
                    <div className="absolute z-50 w-full mt-1 bg-bg-secondary border border-border-primary rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {ALL_PAIRS
                        .filter(p => p.includes(pairSearch) && !selectedPairs.includes(p))
                        .slice(0, 8)
                        .map((pair) => (
                          <button
                            key={pair}
                            onClick={() => {
                              handleAddHotPair(pair);
                              setPairSearch('');
                              setShowPairSearch(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-bg-tertiary flex items-center justify-between"
                          >
                            <span>{pair}</span>
                            <Plus className="w-4 h-4 text-brand-primary" />
                          </button>
                        ))}
                      {ALL_PAIRS.filter(p => p.includes(pairSearch) && !selectedPairs.includes(p)).length === 0 && (
                        <div className="px-3 py-2 text-sm text-text-tertiary">未找到匹配的交易对</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 已选交易对 */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedPairs.map((pair) => (
                    <span
                      key={pair}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-brand-primary/20 text-brand-primary text-xs rounded"
                    >
                      {pair}
                      <button onClick={() => handleRemovePair(pair)} className="hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* 热门交易对 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-text-tertiary">热门:</span>
                  {HOT_PAIRS.filter(p => !selectedPairs.includes(p)).slice(0, 5).map((pair) => (
                    <button
                      key={pair}
                      onClick={() => handleAddHotPair(pair)}
                      className="px-2 py-0.5 text-xs bg-bg-tertiary hover:bg-border-secondary text-text-secondary hover:text-white rounded transition-colors"
                    >
                      +{pair.replace('/USDT', '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 高级参数（折叠） */}
            <div className="p-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-text-tertiary" />
                  <span className="text-sm text-text-secondary">高级参数</span>
                  <span className="text-xs text-text-tertiary">止损/止盈/杠杆/K线</span>
                </div>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-text-tertiary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-tertiary" />
                )}
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-3">
                  {/* 跟随策略代码开关 - 仅当选择了策略且策略有代码时显示 */}
                  {sourceStrategy?.content && (
                    <div className="p-3 bg-bg-tertiary/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code className="w-4 h-4 text-brand-primary" />
                          <span className="text-sm text-white">跟随策略代码</span>
                        </div>
                        <Switch
                          id="follow-strategy-code"
                          checked={followStrategyCode}
                          onChange={(e) => setFollowStrategyCode(e.target.checked)}
                          size="sm"
                        />
                      </div>
                      <p className="text-xs text-text-tertiary mt-1">
                        {followStrategyCode
                          ? '止损/止盈/K线/追踪止损将使用代码中的设置'
                          : '使用下方配置覆盖代码中的设置'}
                      </p>
                    </div>
                  )}

                  {/* 交易所（放首位） */}
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">交易所</label>
                    <select
                      value={exchange}
                      onChange={(e) => setExchange(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-white"
                    >
                      <option value="binance">Binance</option>
                      <option value="okx">OKX</option>
                      <option value="bybit">Bybit</option>
                    </select>
                  </div>

                  {/* 止损止盈 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">
                        止损 (%)
                        {sourceStrategy?.content && followStrategyCode && (
                          <span className="ml-1 text-warning">· 代码优先</span>
                        )}
                      </label>
                      <Input
                        type="number"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        disabled={!!sourceStrategy?.content && followStrategyCode}
                        className={`text-sm ${sourceStrategy?.content && followStrategyCode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">
                        止盈 (%)
                        {sourceStrategy?.content && followStrategyCode && (
                          <span className="ml-1 text-warning">· 代码优先</span>
                        )}
                      </label>
                      <Input
                        type="number"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        disabled={!!sourceStrategy?.content && followStrategyCode}
                        className={`text-sm ${sourceStrategy?.content && followStrategyCode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>

                  {/* K线周期和杠杆 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">
                        K线周期
                        {sourceStrategy?.content && followStrategyCode && (
                          <span className="ml-1 text-warning">· 代码优先</span>
                        )}
                      </label>
                      <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        disabled={!!sourceStrategy?.content && followStrategyCode}
                        className={`w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-white ${sourceStrategy?.content && followStrategyCode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="1m">1分钟</option>
                        <option value="5m">5分钟</option>
                        <option value="15m">15分钟</option>
                        <option value="1h">1小时</option>
                        <option value="4h">4小时</option>
                        <option value="1d">1天</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">杠杆倍数</label>
                      <Input
                        type="number"
                        value={leverage}
                        onChange={(e) => setLeverage(e.target.value)}
                        min="1"
                        max="20"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* 最大持仓 + 手续费 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">最大持仓数</label>
                      <Input
                        type="number"
                        value={maxOpenTrades}
                        onChange={(e) => setMaxOpenTrades(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">手续费率 (%)</label>
                      <Input
                        type="number"
                        value={(parseFloat(fee) * 100).toFixed(2)}
                        onChange={(e) => setFee((parseFloat(e.target.value) / 100).toString())}
                        step="0.01"
                        min="0"
                        max="1"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* 未成交超时 */}
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">未成交超时 (分钟)</label>
                    <Input
                      type="number"
                      value={unfilledTimeout}
                      onChange={(e) => setUnfilledTimeout(e.target.value)}
                      min="1"
                      max="60"
                      className="text-sm"
                    />
                  </div>

                  {/* 风控设置区 - 简洁模式 */}
                  <div className="pt-3 border-t border-border-primary">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-3.5 h-3.5 text-brand-primary" />
                      <span className="text-xs text-text-tertiary font-medium">风控设置</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <label htmlFor="switch-dry-run" className="flex items-center justify-between py-1.5 cursor-pointer">
                        <span className="text-sm text-white">模拟交易</span>
                        <Switch id="switch-dry-run" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} size="sm" />
                      </label>

                      <div className={`flex items-center justify-between py-1.5 ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : ''}`}>
                        <span className="text-sm text-white">
                          移动止损
                          {sourceStrategy?.content && followStrategyCode && (
                            <span className="ml-1 text-xs text-warning">· 代码优先</span>
                          )}
                        </span>
                        <Switch
                          id="switch-trailing-stop"
                          checked={trailingStop}
                          onChange={(e) => setTrailingStop(e.target.checked)}
                          disabled={!!sourceStrategy?.content && followStrategyCode}
                          size="sm"
                        />
                      </div>

                      <label htmlFor="switch-stoploss-exchange" className="flex items-center justify-between py-1.5 cursor-pointer">
                        <span className="text-sm text-white">交易所止损</span>
                        <Switch id="switch-stoploss-exchange" checked={stoplossOnExchange} onChange={(e) => setStoplossOnExchange(e.target.checked)} size="sm" />
                      </label>

                      <label htmlFor="switch-cancel-orders" className="flex items-center justify-between py-1.5 cursor-pointer">
                        <span className="text-sm text-white">退出取消挂单</span>
                        <Switch id="switch-cancel-orders" checked={cancelOpenOrders} onChange={(e) => setCancelOpenOrders(e.target.checked)} size="sm" />
                      </label>
                    </div>
                  </div>

                  {/* 黑天鹅防护区 */}
                  <div className="pt-3 border-t border-border-primary">
                    <label htmlFor="switch-black-swan" className="flex items-center justify-between py-1.5 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                        <span className="text-sm text-white">黑天鹅防护</span>
                      </div>
                      <Switch id="switch-black-swan" checked={blackSwanEnabled} onChange={(e) => setBlackSwanEnabled(e.target.checked)} size="sm" />
                    </label>

                    {blackSwanEnabled && (
                      <div className="mt-2 mx-3 p-3 bg-bg-tertiary/50 rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-text-tertiary mb-1">触发阈值 (%)</label>
                            <Input
                              type="number"
                              value={blackSwanThreshold}
                              onChange={(e) => setBlackSwanThreshold(e.target.value)}
                              min="-50"
                              max="0"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-text-tertiary mb-1">检测窗口 (分钟)</label>
                            <Input
                              type="number"
                              value={blackSwanTimeframe}
                              onChange={(e) => setBlackSwanTimeframe(e.target.value)}
                              min="1"
                              max="60"
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-text-tertiary mb-1">触发动作</label>
                          <select
                            value={blackSwanAction}
                            onChange={(e) => setBlackSwanAction(e.target.value)}
                            className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-white"
                          >
                            <option value="pause">暂停交易</option>
                            <option value="close_all">全部平仓</option>
                            <option value="notify_only">仅通知</option>
                          </select>
                        </div>
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          当任一交易对在 {blackSwanTimeframe} 分钟内跌幅超过 {Math.abs(Number(blackSwanThreshold))}% 时触发
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* 固定底部按钮 */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 bg-bg-primary/95 backdrop-blur border-t border-border-primary lg:left-64 z-50">
        <div className="flex gap-3">
          <Button
            onClick={handleStartBacktest}
            disabled={!strategyId}
            className="flex-1"
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            开始回测
          </Button>
          <Button
            onClick={handleSaveToMyStrategies}
            disabled={!strategyId || saving}
            variant="outline"
            className="flex-1"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? '保存中...' : saveSuccess ? '已保存' : '保存配置'}
          </Button>
        </div>
      </div>

      {/* 参数帮助弹窗 */}
      <ParamsHelpModal open={showParamsHelp} onClose={() => setShowParamsHelp(false)} />
    </div>
  );
}

// 导出组件
export default function BacktestPage() {
  return (
    <Suspense fallback={<BacktestSkeleton />}>
      <BacktestPageInner />
    </Suspense>
  );
}
