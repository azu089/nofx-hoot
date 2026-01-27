'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, Button } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { strategiesApi, instancesApi, Strategy } from '@/lib/api';
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
  Download,
  Database,
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
    <>
      {/* 移动端骨架屏 - 极简风格 */}
      <div className="space-y-4 animate-pulse lg:hidden">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-48" />
        <div className="h-32 bg-bg-tertiary/50 rounded-xl" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
      </div>
      {/* 桌面端骨架屏 */}
      <div className="hidden lg:block space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary rounded-lg w-48" />
        <div className="h-32 bg-bg-tertiary rounded-lg" />
        <div className="h-24 bg-bg-tertiary rounded-lg" />
        <div className="h-24 bg-bg-tertiary rounded-lg" />
      </div>
    </>
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

  // 单笔交易金额（实盘用，区分于回测初始资金）
  const [stakeAmount, setStakeAmount] = useState('10');

  // DCA 补仓设置
  const [dcaEnabled, setDcaEnabled] = useState(false);
  const [dcaMaxEntries, setDcaMaxEntries] = useState('3');
  const [dcaEntryPriceDrop, setDcaEntryPriceDrop] = useState('-5');
  const [dcaAntiWaterfall, setDcaAntiWaterfall] = useState(true); // 防瀑布：快速下跌时暂停 DCA

  // 结果和状态
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // K 线数据下载
  const [showKlineSection, setShowKlineSection] = useState(false);
  const [klineStatus, setKlineStatus] = useState<{
    status: 'idle' | 'downloading' | 'completed' | 'error';
    progress?: number;
    message?: string;
  }>({ status: 'idle' });
  const [klineDownloading, setKlineDownloading] = useState(false);
  const [selectedKlineTimeframes, setSelectedKlineTimeframes] = useState<string[]>(['1h', '4h', '1d']);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);

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

  // 获取活跃的 VPS 实例（静默失败，不影响页面主要功能）
  useEffect(() => {
    let isMounted = true;
    const fetchActiveInstance = async () => {
      try {
        const res = await instancesApi.list();
        if (!isMounted) return;
        if (res.data && res.data.length > 0) {
          // 找到第一个运行中的实例
          const runningInstance = res.data.find((inst: any) => inst.status === 'running');
          if (runningInstance) {
            setActiveInstanceId(runningInstance.id);
            // 获取 K 线状态
            try {
              const statusRes = await instancesApi.getKlineStatus(runningInstance.id);
              if (isMounted && statusRes.data) {
                setKlineStatus(statusRes.data);
              }
            } catch {
              // K线状态获取失败，静默处理
            }
          }
        }
      } catch {
        // 实例获取失败，静默处理（用户可能没有购买VPS）
      }
    };
    fetchActiveInstance();
    return () => { isMounted = false; };
  }, []);

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

  // K 线时间周期切换
  const toggleKlineTimeframe = (tf: string) => {
    setSelectedKlineTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf]
    );
  };

  // 下载 K 线数据
  const handleDownloadKline = async () => {
    if (!activeInstanceId) {
      setError('您还没有运行中的 VPS 实例，请先购买 VPS 服务');
      return;
    }

    if (selectedPairs.length === 0) {
      setError('请先选择要下载的交易对');
      return;
    }

    if (selectedKlineTimeframes.length === 0) {
      setError('请至少选择一个 K 线周期');
      return;
    }

    setKlineDownloading(true);
    setError(null);

    try {
      const res = await instancesApi.downloadKline(activeInstanceId, {
        pairs: selectedPairs,
        timeframes: selectedKlineTimeframes,
        startDate: startDate, // 使用回测开始日期
        exchange: exchange,
      });

      if (res.code === 0) {
        setKlineStatus({ status: 'downloading', message: '正在下载历史数据...' });
        // 启动轮询检查状态
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await instancesApi.getKlineStatus(activeInstanceId);
            if (statusRes.data) {
              setKlineStatus(statusRes.data);
              if (statusRes.data.status === 'completed' || statusRes.data.status === 'error') {
                clearInterval(pollInterval);
              }
            }
          } catch (err) {
            console.error('获取下载状态失败:', err);
          }
        }, 3000);
        // 60 秒后停止轮询
        setTimeout(() => clearInterval(pollInterval), 60000);
      } else {
        setError(res.message || '下载启动失败');
      }
    } catch (err: any) {
      setError(err?.message || '下载失败，请稍后重试');
    } finally {
      setKlineDownloading(false);
    }
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
        // 注意：后端期望小数格式（-0.05 = -5%），前端显示百分比格式（-5）
        ...(!shouldFollowCode && {
          stoploss: parseFloat(stopLoss) / 100,
          takeprofit: parseFloat(takeProfit) / 100,
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
        stake_amount: stakeAmount, // 单笔交易金额（实盘用）
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
        // DCA 补仓配置
        position_adjustment_enable: dcaEnabled,
        max_entry_position_adjustment: dcaEnabled ? parseInt(dcaMaxEntries) || 3 : 0,
        custom_config: {
          fee: parseFloat(fee),
          exchange: exchange,
          dry_run: dryRun,
          // 只有不跟随代码时才传止盈
          ...(!shouldFollowCode && {
            take_profit: parseFloat(takeProfit) / 100,
          }),
          // DCA 详细配置
          dca_enabled: dcaEnabled,
          dca_entry_price_drop: dcaEnabled ? parseFloat(dcaEntryPriceDrop) / 100 : null,
          dca_anti_waterfall: dcaEnabled ? dcaAntiWaterfall : null,
          // 黑天鹅防护
          crash_protection: blackSwanEnabled,
          crash_threshold: blackSwanEnabled ? blackSwanThreshold : null,
          crash_timeframe: blackSwanEnabled ? blackSwanTimeframe : null,
          crash_action: blackSwanEnabled ? blackSwanAction : null,
          // 回测初始资金（仅记录，不影响实盘）
          backtest_initial_capital: initialCapital,
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
          {/* 移动端 - 极简图标容器 */}
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4 lg:hidden">
            <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
          </div>
          {/* 桌面端 - 原样式 */}
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin mx-auto mb-4 hidden lg:block" />
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

    // 结果内容组件（共享）
    const ResultContent = ({ isMobile = false }: { isMobile?: boolean }) => (
      <>
        {/* 返回按钮 + 核心收益 */}
        <div className={`relative p-4 text-center ${isMobile ? 'bg-bg-secondary rounded-xl' : 'bg-gradient-to-b from-brand-primary/5 to-transparent'}`}>
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
        <div className={`grid grid-cols-4 py-3 px-2 ${isMobile ? 'bg-bg-secondary rounded-xl mt-3' : ''}`}>
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
        <div className={`px-4 pb-4 ${isMobile ? 'bg-bg-secondary rounded-xl mt-3 pt-4' : ''}`}>
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
        <div className={`px-4 pb-4 ${isMobile ? 'bg-bg-secondary rounded-xl mt-3 pt-4' : ''}`}>
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
      </>
    );

    return (
      <div className="pb-6 space-y-4">
        {/* 移动端 - 极简风格，无 Card */}
        <div className="lg:hidden">
          <ResultContent isMobile={true} />
        </div>

        {/* 桌面端 - 保留 Card */}
        <Card className="hidden lg:block">
          <CardContent className="p-0">
            <ResultContent isMobile={false} />
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

  // 策略选择区块组件
  const StrategySelectorSection = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`p-4 ${isMobile ? 'bg-bg-secondary/50 rounded-xl overflow-hidden' : 'overflow-visible'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-white transition-colors hidden lg:block"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={`flex-1 min-w-0 ${isMobile ? '' : 'overflow-visible'}`}>
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
          className={`p-2 rounded-lg text-text-tertiary hover:text-brand-primary transition-colors flex-shrink-0 ${isMobile ? 'hover:bg-[#1a1d21]' : 'hover:bg-bg-tertiary'}`}
          title="查看参数说明"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // 回测周期区块组件
  const PeriodSection = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`p-4 ${isMobile ? 'bg-bg-secondary/50 rounded-xl mt-3' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={isMobile ? 'w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center' : ''}>
          <Clock className="w-4 h-4 text-brand-primary" />
        </div>
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
                : isMobile
                  ? 'bg-[#1a1d21] hover:bg-[#23272e] text-text-secondary hover:text-white'
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
              : isMobile
                ? 'bg-[#1a1d21] hover:bg-[#23272e] text-text-secondary hover:text-white'
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
  );

  // 交易设置区块组件（移动端）
  const TradingSettingsSection = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`p-4 ${isMobile ? 'bg-bg-secondary/50 rounded-xl mt-3' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={isMobile ? 'w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center' : ''}>
          <Activity className="w-4 h-4 text-brand-primary" />
        </div>
        <span className="text-sm font-medium text-white">交易设置</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 交易所 */}
        <div>
          <label className="block text-xs text-text-tertiary mb-1">交易所</label>
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg text-sm text-white ${isMobile ? 'bg-[#1a1d21]' : 'bg-bg-tertiary border border-border-secondary'}`}
          >
            <option value="binance">Binance</option>
            <option value="okx">OKX</option>
            <option value="bybit">Bybit</option>
          </select>
        </div>

        {/* 单笔交易金额 */}
        <div>
          <label className="block text-xs text-text-tertiary mb-1">单笔金额</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">$</span>
            <Input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="10"
              className="text-sm pl-7"
            />
          </div>
        </div>

        {/* 最大持仓数 */}
        <div>
          <label className="block text-xs text-text-tertiary mb-1">最大持仓</label>
          <Input
            type="number"
            value={maxOpenTrades}
            onChange={(e) => setMaxOpenTrades(e.target.value)}
            min="1"
            max="10"
            className="text-sm"
          />
        </div>

        {/* 杠杆倍数 */}
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

      {/* 交易对选择 */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-tertiary">交易对</span>
          <span className="text-xs text-text-tertiary">{selectedPairs.length}/10</span>
        </div>

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
            placeholder="搜索交易对..."
            className="text-sm pl-9"
          />
          {showPairSearch && pairSearch && (
            <div className={`absolute z-50 w-full mt-1 rounded-lg shadow-lg max-h-40 overflow-y-auto ${isMobile ? 'bg-[#1a1d21]' : 'bg-bg-secondary border border-border-primary'}`}>
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
                    className={`w-full px-3 py-2 text-left text-sm text-white flex items-center justify-between ${isMobile ? 'hover:bg-[#23272e]' : 'hover:bg-bg-tertiary'}`}
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

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-tertiary">热门:</span>
          {HOT_PAIRS.filter(p => !selectedPairs.includes(p)).slice(0, 5).map((pair) => (
            <button
              key={pair}
              onClick={() => handleAddHotPair(pair)}
              className={`px-2 py-0.5 text-xs text-text-secondary hover:text-white rounded transition-colors ${isMobile ? 'bg-[#1a1d21] hover:bg-[#23272e]' : 'bg-bg-tertiary hover:bg-border-secondary'}`}
            >
              +{pair.replace('/USDT', '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // 止盈止损区块组件（移动端）
  const StopLossSection = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`p-4 ${isMobile ? 'bg-bg-secondary/50 rounded-xl mt-3' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={isMobile ? 'w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center' : ''}>
            <Target className="w-4 h-4 text-brand-primary" />
          </div>
          <span className="text-sm font-medium text-white">止盈止损</span>
        </div>
        {sourceStrategy?.content && (
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <span className="text-text-tertiary">跟随代码</span>
            <Switch
              id="follow-strategy-code-mobile-sl"
              checked={followStrategyCode}
              onChange={(e) => setFollowStrategyCode(e.target.checked)}
              size="sm"
            />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-tertiary mb-1">
            止损 (%)
            {sourceStrategy?.content && followStrategyCode && (
              <span className="ml-1 text-warning text-[10px]">代码优先</span>
            )}
          </label>
          <Input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            disabled={!!sourceStrategy?.content && followStrategyCode}
            placeholder="-5"
            className={`text-sm ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : ''}`}
          />
        </div>
        <div>
          <label className="block text-xs text-text-tertiary mb-1">
            止盈 (%)
            {sourceStrategy?.content && followStrategyCode && (
              <span className="ml-1 text-warning text-[10px]">代码优先</span>
            )}
          </label>
          <Input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            disabled={!!sourceStrategy?.content && followStrategyCode}
            placeholder="10"
            className={`text-sm ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : ''}`}
          />
        </div>
      </div>
    </div>
  );

  // DCA 补仓区块组件（移动端）
  const DcaSection = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`p-4 ${isMobile ? 'bg-bg-secondary/50 rounded-xl mt-3' : ''}`}>
      <label htmlFor="switch-dca-enabled-mobile" className="flex items-center justify-between mb-3 cursor-pointer">
        <div className="flex items-center gap-2">
          <div className={isMobile ? 'w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center' : ''}>
            <TrendingDown className="w-4 h-4 text-brand-primary" />
          </div>
          <span className="text-sm font-medium text-white">DCA 补仓</span>
        </div>
        <Switch
          id="switch-dca-enabled-mobile"
          checked={dcaEnabled}
          onChange={(e) => setDcaEnabled(e.target.checked)}
          size="sm"
        />
      </label>

      {dcaEnabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">最大补仓次数</label>
              <Input
                type="number"
                value={dcaMaxEntries}
                onChange={(e) => setDcaMaxEntries(e.target.value)}
                min="1"
                max="10"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">触发跌幅 (%)</label>
              <Input
                type="number"
                value={dcaEntryPriceDrop}
                onChange={(e) => setDcaEntryPriceDrop(e.target.value)}
                min="-50"
                max="0"
                placeholder="-5"
                className="text-sm"
              />
            </div>
          </div>

          <label htmlFor="switch-dca-anti-waterfall-mobile" className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${isMobile ? 'bg-[#1a1d21]' : 'bg-bg-tertiary/50'}`}>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-warning" />
              <span className="text-sm text-white">防瀑布</span>
              <span className="text-xs text-text-tertiary">5分钟跌5%暂停</span>
            </div>
            <Switch
              id="switch-dca-anti-waterfall-mobile"
              checked={dcaAntiWaterfall}
              onChange={(e) => setDcaAntiWaterfall(e.target.checked)}
              size="sm"
            />
          </label>
        </div>
      )}
    </div>
  );

  // 回测配置区块组件 - 极简风格
  const BacktestConfigSection = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`p-4 ${isMobile ? 'bg-bg-secondary/50 rounded-xl mt-3' : ''}`}>
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-brand-primary" />
        <span className="text-sm font-medium text-white">回测配置</span>
      </div>

      {/* 三列布局：周期 | 资金 | K线 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 回测周期 */}
        <div>
          <label className="block text-xs text-text-tertiary mb-2">回测周期</label>
          <div className="flex flex-wrap gap-1.5">
            {PERIOD_OPTIONS.map((item) => (
              <button
                key={item.days}
                onClick={() => {
                  handleQuickDateSelect(item.days);
                  setShowCustomDate(false);
                }}
                className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                  selectedPeriod === item.days && !showCustomDate
                    ? 'bg-brand-primary text-white'
                    : 'bg-bg-tertiary/50 hover:bg-bg-tertiary text-text-secondary hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 回测资金 */}
        <div>
          <label className="block text-xs text-text-tertiary mb-2">回测资金 (USDT)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">$</span>
            <Input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
              placeholder="10000"
              className="text-sm pl-7 h-9"
            />
          </div>
        </div>

        {/* K线周期 + 下载 */}
        <div>
          <label className="block text-xs text-text-tertiary mb-2">
            K线数据
            {klineStatus.status === 'completed' && <span className="ml-1 text-success">✓ 已下载</span>}
            {klineStatus.status === 'downloading' && <span className="ml-1 text-warning">下载中...</span>}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {['5m', '15m', '1h', '4h', '1d'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => toggleKlineTimeframe(tf)}
                  disabled={klineStatus.status === 'downloading'}
                  className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                    selectedKlineTimeframes.includes(tf)
                      ? 'bg-brand-primary text-white'
                      : 'bg-bg-tertiary/50 hover:bg-bg-tertiary text-text-secondary'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <Button
              onClick={handleDownloadKline}
              disabled={!activeInstanceId || klineDownloading || klineStatus.status === 'downloading'}
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs"
            >
              {klineDownloading || klineStatus.status === 'downloading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          {!activeInstanceId && (
            <p className="text-[10px] text-text-tertiary mt-1">
              需要 <button onClick={() => router.push('/instances')} className="text-brand-primary hover:underline">VPS</button> 才能下载
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 pb-32">
      {/* ========== 移动端布局 - 紧凑风格 ========== */}
      <div className="lg:hidden">
        <StrategySelectorSection isMobile={true} />
        <TradingSettingsSection isMobile={true} />
        <StopLossSection isMobile={true} />
        <DcaSection isMobile={true} />

        {/* 高级参数（折叠）- 移动端精简版 */}
        <div className="p-4 bg-bg-secondary/50 rounded-xl mt-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-bg-tertiary/50 flex items-center justify-center">
                <Code className="w-4 h-4 text-text-tertiary" />
              </div>
              <span className="text-sm text-text-secondary">高级参数</span>
              <span className="text-xs text-text-tertiary">K线/风控</span>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-text-tertiary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">
                    K线周期
                    {sourceStrategy?.content && followStrategyCode && (
                      <span className="ml-1 text-warning text-[10px]">代码优先</span>
                    )}
                  </label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    disabled={!!sourceStrategy?.content && followStrategyCode}
                    className={`w-full px-3 py-2 bg-[#1a1d21] rounded-lg text-sm text-white ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : ''}`}
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

              {/* 风控开关组 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <label htmlFor="switch-dry-run-mobile2" className="flex items-center justify-between py-1.5 cursor-pointer">
                  <span className="text-sm text-white">模拟交易</span>
                  <Switch id="switch-dry-run-mobile2" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} size="sm" />
                </label>

                <label htmlFor="switch-trailing-stop-mobile2" className={`flex items-center justify-between py-1.5 ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : 'cursor-pointer'}`}>
                  <span className="text-sm text-white">移动止损</span>
                  <Switch
                    id="switch-trailing-stop-mobile2"
                    checked={trailingStop}
                    onChange={(e) => setTrailingStop(e.target.checked)}
                    disabled={!!sourceStrategy?.content && followStrategyCode}
                    size="sm"
                  />
                </label>

                <label htmlFor="switch-stoploss-exchange-mobile2" className="flex items-center justify-between py-1.5 cursor-pointer">
                  <span className="text-sm text-white">交易所止损</span>
                  <Switch id="switch-stoploss-exchange-mobile2" checked={stoplossOnExchange} onChange={(e) => setStoplossOnExchange(e.target.checked)} size="sm" />
                </label>

                <label htmlFor="switch-cancel-orders-mobile2" className="flex items-center justify-between py-1.5 cursor-pointer">
                  <span className="text-sm text-white">退出取消挂单</span>
                  <Switch id="switch-cancel-orders-mobile2" checked={cancelOpenOrders} onChange={(e) => setCancelOpenOrders(e.target.checked)} size="sm" />
                </label>
              </div>

              {/* 黑天鹅防护 */}
              <div className="pt-2">
                <label htmlFor="switch-black-swan-mobile2" className="flex items-center justify-between py-1.5 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    <span className="text-sm text-white">黑天鹅防护</span>
                  </div>
                  <Switch id="switch-black-swan-mobile2" checked={blackSwanEnabled} onChange={(e) => setBlackSwanEnabled(e.target.checked)} size="sm" />
                </label>

                {blackSwanEnabled && (
                  <div className="mt-2 p-3 bg-[#1a1d21] rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">触发阈值 (%)</label>
                        <Input type="number" value={blackSwanThreshold} onChange={(e) => setBlackSwanThreshold(e.target.value)} min="-50" max="0" className="text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">检测窗口 (分钟)</label>
                        <Input type="number" value={blackSwanTimeframe} onChange={(e) => setBlackSwanTimeframe(e.target.value)} min="1" max="60" className="text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">触发动作</label>
                      <select value={blackSwanAction} onChange={(e) => setBlackSwanAction(e.target.value)} className="w-full px-3 py-2 bg-bg-tertiary rounded-lg text-sm text-white">
                        <option value="pause">暂停交易</option>
                        <option value="close_all">全部平仓</option>
                        <option value="notify_only">仅通知</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 回测配置 - 移动端 */}
        <BacktestConfigSection isMobile={true} />
      </div>

      {/* ========== 桌面端布局 - 紧凑无分割线 ========== */}
      <Card className="overflow-visible hidden lg:block max-w-4xl mx-auto">
        <CardContent className="p-0 overflow-visible">
          <div className="space-y-0">

            {/* 策略选择器 */}
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

            {/* ═══════ 交易设置 ═══════ */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-brand-primary" />
                <span className="text-sm font-medium text-white">交易设置</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 交易所 */}
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

                {/* 单笔交易金额 */}
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">
                    单笔金额 (USDT)
                    <span className="ml-1 text-brand-primary cursor-help" title="每次开仓投入的金额，建议为总资金的1%-5%">?</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">$</span>
                    <Input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="10"
                      className="text-sm pl-7"
                    />
                  </div>
                </div>

                {/* 最大持仓数 */}
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">最大持仓数</label>
                  <Input
                    type="number"
                    value={maxOpenTrades}
                    onChange={(e) => setMaxOpenTrades(e.target.value)}
                    min="1"
                    max="10"
                    className="text-sm"
                  />
                </div>

                {/* 杠杆倍数 */}
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

              {/* 交易对选择 */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-tertiary">交易对</span>
                  <span className="text-xs text-text-tertiary">{selectedPairs.length}/10</span>
                </div>

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
                    placeholder="搜索交易对..."
                    className="text-sm pl-9"
                  />
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

            {/* ═══════ 止盈止损 ═══════ */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-brand-primary" />
                <span className="text-sm font-medium text-white">止盈止损</span>
                {sourceStrategy?.content && (
                  <label className="flex items-center gap-1.5 ml-auto text-xs cursor-pointer">
                    <span className="text-text-tertiary">跟随代码</span>
                    <Switch
                      id="follow-strategy-code-desktop"
                      checked={followStrategyCode}
                      onChange={(e) => setFollowStrategyCode(e.target.checked)}
                      size="sm"
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">
                    止损 (%)
                    {sourceStrategy?.content && followStrategyCode && (
                      <span className="ml-1 text-warning text-[10px]">代码优先</span>
                    )}
                  </label>
                  <Input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    disabled={!!sourceStrategy?.content && followStrategyCode}
                    placeholder="-5"
                    className={`text-sm ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-tertiary mb-1">
                    止盈 (%)
                    {sourceStrategy?.content && followStrategyCode && (
                      <span className="ml-1 text-warning text-[10px]">代码优先</span>
                    )}
                  </label>
                  <Input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    disabled={!!sourceStrategy?.content && followStrategyCode}
                    placeholder="10"
                    className={`text-sm ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* ═══════ DCA 补仓设置 ═══════ */}
            <div className="px-4 pb-4">
              <label htmlFor="switch-dca-enabled" className="flex items-center justify-between mb-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-brand-primary" />
                  <span className="text-sm font-medium text-white">DCA 补仓</span>
                  <span className="text-xs text-text-tertiary">下跌时自动加仓摊薄成本</span>
                </div>
                <Switch
                  id="switch-dca-enabled"
                  checked={dcaEnabled}
                  onChange={(e) => setDcaEnabled(e.target.checked)}
                  size="sm"
                />
              </label>

              {dcaEnabled && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">最大补仓次数</label>
                      <Input
                        type="number"
                        value={dcaMaxEntries}
                        onChange={(e) => setDcaMaxEntries(e.target.value)}
                        min="1"
                        max="10"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">触发跌幅 (%)</label>
                      <Input
                        type="number"
                        value={dcaEntryPriceDrop}
                        onChange={(e) => setDcaEntryPriceDrop(e.target.value)}
                        min="-50"
                        max="0"
                        placeholder="-5"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* 防瀑布开关 */}
                  <label htmlFor="switch-dca-anti-waterfall" className="flex items-center justify-between p-2 bg-bg-tertiary/50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-warning" />
                      <span className="text-sm text-white">防瀑布保护</span>
                      <span className="text-xs text-text-tertiary">5分钟内跌5%暂停补仓</span>
                    </div>
                    <Switch
                      id="switch-dca-anti-waterfall"
                      checked={dcaAntiWaterfall}
                      onChange={(e) => setDcaAntiWaterfall(e.target.checked)}
                      size="sm"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* ═══════ 高级参数（折叠） ═══════ */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-text-tertiary" />
                  <span className="text-sm text-text-secondary">高级参数</span>
                  <span className="text-xs text-text-tertiary">K线/手续费/风控</span>
                </div>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-text-tertiary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-tertiary" />
                )}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">
                        K线周期
                        {sourceStrategy?.content && followStrategyCode && (
                          <span className="ml-1 text-warning text-[10px]">代码优先</span>
                        )}
                      </label>
                      <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        disabled={!!sourceStrategy?.content && followStrategyCode}
                        className={`w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-white ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : ''}`}
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

                  {/* 风控开关组 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <label htmlFor="switch-dry-run-desktop" className="flex items-center justify-between py-1.5 cursor-pointer">
                      <span className="text-sm text-white">模拟交易</span>
                      <Switch id="switch-dry-run-desktop" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} size="sm" />
                    </label>

                    <label htmlFor="switch-trailing-stop-desktop" className={`flex items-center justify-between py-1.5 ${sourceStrategy?.content && followStrategyCode ? 'opacity-50' : 'cursor-pointer'}`}>
                      <span className="text-sm text-white">移动止损</span>
                      <Switch
                        id="switch-trailing-stop-desktop"
                        checked={trailingStop}
                        onChange={(e) => setTrailingStop(e.target.checked)}
                        disabled={!!sourceStrategy?.content && followStrategyCode}
                        size="sm"
                      />
                    </label>

                    <label htmlFor="switch-stoploss-exchange-desktop" className="flex items-center justify-between py-1.5 cursor-pointer">
                      <span className="text-sm text-white">交易所止损</span>
                      <Switch id="switch-stoploss-exchange-desktop" checked={stoplossOnExchange} onChange={(e) => setStoplossOnExchange(e.target.checked)} size="sm" />
                    </label>

                    <label htmlFor="switch-cancel-orders-desktop" className="flex items-center justify-between py-1.5 cursor-pointer">
                      <span className="text-sm text-white">退出取消挂单</span>
                      <Switch id="switch-cancel-orders-desktop" checked={cancelOpenOrders} onChange={(e) => setCancelOpenOrders(e.target.checked)} size="sm" />
                    </label>
                  </div>

                  {/* 黑天鹅防护 */}
                  <div className="pt-2">
                    <label htmlFor="switch-black-swan-desktop" className="flex items-center justify-between py-1.5 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                        <span className="text-sm text-white">黑天鹅防护</span>
                      </div>
                      <Switch id="switch-black-swan-desktop" checked={blackSwanEnabled} onChange={(e) => setBlackSwanEnabled(e.target.checked)} size="sm" />
                    </label>

                    {blackSwanEnabled && (
                      <div className="mt-2 p-3 bg-bg-tertiary/50 rounded-lg space-y-3">
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
                        <p className="text-xs text-text-tertiary">
                          当任一交易对在 {blackSwanTimeframe} 分钟内跌幅超过 {Math.abs(Number(blackSwanThreshold))}% 时触发
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ═══════ 回测配置 - 极简三列布局 ═══════ */}
            <div className="px-4 pt-3 pb-4 bg-bg-tertiary/30">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-brand-primary" />
                <span className="text-sm font-medium text-white">回测配置</span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* 回测周期 */}
                <div>
                  <label className="block text-xs text-text-tertiary mb-2">回测周期</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PERIOD_OPTIONS.map((item) => (
                      <button
                        key={item.days}
                        onClick={() => {
                          handleQuickDateSelect(item.days);
                          setShowCustomDate(false);
                        }}
                        className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                          selectedPeriod === item.days && !showCustomDate
                            ? 'bg-brand-primary text-white'
                            : 'bg-bg-tertiary/50 hover:bg-bg-tertiary text-text-secondary hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 回测资金 */}
                <div>
                  <label className="block text-xs text-text-tertiary mb-2">回测资金 (USDT)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">$</span>
                    <Input
                      type="number"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(e.target.value)}
                      placeholder="10000"
                      className="text-sm pl-7 h-9"
                    />
                  </div>
                </div>

                {/* K线数据 + 下载 */}
                <div>
                  <label className="block text-xs text-text-tertiary mb-2">
                    K线数据
                    {klineStatus.status === 'completed' && <span className="ml-1 text-success">✓ 已下载</span>}
                    {klineStatus.status === 'downloading' && <span className="ml-1 text-warning">下载中...</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {['1h', '4h', '1d'].map((tf) => (
                        <button
                          key={tf}
                          onClick={() => toggleKlineTimeframe(tf)}
                          disabled={klineStatus.status === 'downloading'}
                          className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                            selectedKlineTimeframes.includes(tf)
                              ? 'bg-brand-primary text-white'
                              : 'bg-bg-tertiary/50 hover:bg-bg-tertiary text-text-secondary'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={handleDownloadKline}
                      disabled={!activeInstanceId || klineDownloading || klineStatus.status === 'downloading'}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs"
                    >
                      {klineDownloading || klineStatus.status === 'downloading' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                  {!activeInstanceId && (
                    <p className="text-[10px] text-text-tertiary mt-1">
                      需要 <button onClick={() => router.push('/instances')} className="text-brand-primary hover:underline">VPS</button> 才能下载
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 - 移动端无边框 */}
      {error && (
        <>
          {/* 移动端 */}
          <div className="flex items-center gap-2 p-3 bg-danger/10 rounded-lg lg:hidden mt-3">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
          {/* 桌面端 */}
          <div className="hidden lg:flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        </>
      )}

      {/* 固定底部按钮 */}
      {/* 移动端 - 更浅的边框 */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-bg-primary/95 backdrop-blur border-t border-border-primary/30 z-50 lg:hidden">
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
      {/* 桌面端 */}
      <div className="fixed bottom-0 left-64 right-0 p-4 bg-bg-primary/95 backdrop-blur border-t border-border-primary z-50 hidden lg:block">
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
