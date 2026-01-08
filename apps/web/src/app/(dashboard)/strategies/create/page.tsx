'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button, Switch } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { strategiesApi, instancesApi } from '@/lib/api';
import {
  ArrowLeft,
  Code,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  PlayCircle,
  RotateCcw,
  Shield,
  Sparkles,
  Search,
  Clock,
  Target,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import {
  STRATEGY_TEMPLATES,
  TIMEFRAME_OPTIONS,
  getTemplateById,
  type IndicatorConfig,
  type ConditionConfig,
} from '@/lib/strategy-templates';
import {
  TemplateSelector,
  StrategyConditionCard,
  ParamsHelpModal,
} from '@/components/features/strategies';

// ============ 类型定义 ============

type CreateMode = 'template' | 'code';
type PageState = 'config' | 'loading';

// 所有可选交易对（用于搜索）
const ALL_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'ETC/USDT',
  'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'NEAR/USDT',
  'AAVE/USDT', 'MKR/USDT', 'SNX/USDT', 'CRV/USDT', 'LDO/USDT',
  'SAND/USDT', 'MANA/USDT', 'AXS/USDT', 'GALA/USDT', 'IMX/USDT',
];

// 热门交易对
const HOT_PAIRS = ['SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT'];

// 代码模板
const CODE_TEMPLATE = `# Freqtrade 策略模板
# 文档: https://www.freqtrade.io/en/stable/strategy-customization/

from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class MyCustomStrategy(IStrategy):
    """
    自定义策略示例
    """

    # 策略参数
    minimal_roi = {
        "0": 0.10,    # 10% 止盈
        "30": 0.05,   # 30分钟后 5% 止盈
        "60": 0.02,   # 60分钟后 2% 止盈
    }

    stoploss = -0.05  # 5% 止损

    # 时间周期
    timeframe = '5m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """添加技术指标"""
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        dataframe['sma_20'] = ta.SMA(dataframe, timeperiod=20)
        dataframe['sma_50'] = ta.SMA(dataframe, timeperiod=50)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """买入信号"""
        dataframe.loc[
            (
                (dataframe['rsi'] < 30) &
                (dataframe['sma_20'] > dataframe['sma_50'])
            ),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """卖出信号"""
        dataframe.loc[
            (
                (dataframe['rsi'] > 70) |
                (dataframe['sma_20'] < dataframe['sma_50'])
            ),
            'exit_long'] = 1
        return dataframe
`;

// 危险代码关键词
const DANGEROUS_KEYWORDS = [
  'import os',
  'import subprocess',
  'import sys',
  'exec(',
  'eval(',
  '__import__',
  'open(',
  'file(',
];

// ============ 骨架屏组件 ============

function CreateStrategySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-bg-tertiary rounded-lg w-48" />
      <div className="h-12 bg-bg-tertiary rounded-lg" />
      <div className="h-64 bg-bg-tertiary rounded-lg" />
      <div className="h-24 bg-bg-tertiary rounded-lg" />
    </div>
  );
}

// ============ 主组件 ============

function CreateStrategyPageInner() {
  const router = useRouter();

  // 模式和状态
  const [mode, setMode] = useState<CreateMode>('template');
  const [pageState, setPageState] = useState<PageState>('config');

  // 策略基本信息
  const [strategyName, setStrategyName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('rsi-oversold');

  // 可编辑的指标和条件（从模板初始化，用户可修改参数）
  const [editedIndicators, setEditedIndicators] = useState<IndicatorConfig[]>([]);
  const [editedBuyConditions, setEditedBuyConditions] = useState<ConditionConfig[]>([]);
  const [editedSellConditions, setEditedSellConditions] = useState<ConditionConfig[]>([]);

  // 交易参数
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC/USDT', 'ETH/USDT']);
  const [pairSearch, setPairSearch] = useState('');
  const [showPairSearch, setShowPairSearch] = useState(false);
  const [timeframe, setTimeframe] = useState('1h');
  const [leverage, setLeverage] = useState('1');
  const [maxOpenTrades, setMaxOpenTrades] = useState('3');
  const [exchange, setExchange] = useState('binance');
  const [fee, setFee] = useState('0.001');
  const [unfilledTimeout, setUnfilledTimeout] = useState('10');

  // 风险管理
  const [stoploss, setStoploss] = useState('-5');
  const [takeProfit, setTakeProfit] = useState('10');
  const [trailingStop, setTrailingStop] = useState(false);
  const [stoplossOnExchange, setStoplossOnExchange] = useState(true);
  const [cancelOpenOrders, setCancelOpenOrders] = useState(true);

  // 黑天鹅防护
  const [blackSwanEnabled, setBlackSwanEnabled] = useState(false);
  const [blackSwanThreshold, setBlackSwanThreshold] = useState('-10');
  const [blackSwanTimeframe, setBlackSwanTimeframe] = useState('5');
  const [blackSwanAction, setBlackSwanAction] = useState('pause');

  // 代码模式
  const [code, setCode] = useState(CODE_TEMPLATE);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [codeWarnings, setCodeWarnings] = useState<string[]>([]);

  // 回测参数
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [showCustomDate, setShowCustomDate] = useState(false);

  // 高级参数折叠（默认展开）
  const [showAdvanced, setShowAdvanced] = useState(true);

  // 代码模式：是否跟随策略代码（止损/止盈/K线/追踪止损使用代码中的值）
  const [followStrategyCode, setFollowStrategyCode] = useState(true);

  // 参数帮助弹窗
  const [showParamsHelp, setShowParamsHelp] = useState(false);

  // 状态
  const [error, setError] = useState<string | null>(null);
  const [hasActiveVps, setHasActiveVps] = useState(false);

  // ============ 初始化 ============

  useEffect(() => {
    // 设置默认日期（最近3个月）
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);

    // 检查是否有活跃的 VPS
    instancesApi.list().then(response => {
      const instances = response.data || [];
      const activeInstance = instances.find((i: any) => i.status === 'running');
      setHasActiveVps(!!activeInstance);
    }).catch(console.error);
  }, []);

  // 模板切换时更新默认值和可编辑状态
  useEffect(() => {
    const template = getTemplateById(selectedTemplateId);
    if (template && !template.isCustom) {
      setTimeframe(template.recommendedTimeframe);
      setStoploss(template.defaultRisk.stoploss.toString());
      setTakeProfit(template.defaultRisk.takeProfit.toString());
      setTrailingStop(template.defaultRisk.trailingStop);
      // 深拷贝指标和条件，允许用户修改
      setEditedIndicators(JSON.parse(JSON.stringify(template.indicators)));
      setEditedBuyConditions(JSON.parse(JSON.stringify(template.buyConditions)));
      setEditedSellConditions(JSON.parse(JSON.stringify(template.sellConditions)));
    }
  }, [selectedTemplateId]);

  // 代码验证
  useEffect(() => {
    if (mode !== 'code' || !code.trim()) {
      setCodeValid(null);
      setCodeWarnings([]);
      return;
    }

    const timer = setTimeout(() => {
      const result = validateCode(code);
      setCodeValid(result.valid);
      setCodeWarnings(result.warnings);
      if (!result.valid) {
        setError(result.errors.join('\n'));
      } else {
        setError(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [code, mode]);

  // ============ 验证函数 ============

  const validateCode = (codeToValidate: string) => {
    const foundWarnings: string[] = [];
    const foundErrors: string[] = [];

    for (const keyword of DANGEROUS_KEYWORDS) {
      if (codeToValidate.includes(keyword)) {
        foundErrors.push(`检测到危险代码: "${keyword}"`);
      }
    }

    if (!codeToValidate.includes('class') || !codeToValidate.includes('IStrategy')) {
      foundErrors.push('策略代码必须继承 IStrategy 类');
    }

    if (!codeToValidate.includes('populate_indicators')) {
      foundWarnings.push('建议实现 populate_indicators 方法');
    }
    if (!codeToValidate.includes('populate_entry_trend') && !codeToValidate.includes('populate_buy_trend')) {
      foundErrors.push('必须实现 populate_entry_trend 方法');
    }
    if (!codeToValidate.includes('populate_exit_trend') && !codeToValidate.includes('populate_sell_trend')) {
      foundErrors.push('必须实现 populate_exit_trend 方法');
    }

    return { valid: foundErrors.length === 0, warnings: foundWarnings, errors: foundErrors };
  };

  // ============ 交易对操作 ============

  const handleAddPair = (pair: string) => {
    if (!selectedPairs.includes(pair) && selectedPairs.length < 10) {
      setSelectedPairs([...selectedPairs, pair]);
    }
    setPairSearch('');
    setShowPairSearch(false);
  };

  const handleRemovePair = (pair: string) => {
    if (selectedPairs.length > 1) {
      setSelectedPairs(selectedPairs.filter(p => p !== pair));
    }
  };

  // ============ 日期操作 ============

  const handleQuickDateSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
    setShowCustomDate(false);
  };

  // 回测周期选项
  const PERIOD_OPTIONS = [
    { label: '1周', days: 7 },
    { label: '1月', days: 30 },
    { label: '3月', days: 90 },
    { label: '6月', days: 180 },
  ];

  // 计算当前选中的周期
  const getSelectedPeriod = () => {
    if (!startDate || !endDate) return 90;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const match = PERIOD_OPTIONS.find(p => Math.abs(p.days - days) < 3);
    return match ? match.days : null;
  };

  const selectedPeriod = getSelectedPeriod();

  // ============ 条件编辑回调 ============

  const handleIndicatorChange = (index: number, indicator: IndicatorConfig) => {
    const updated = [...editedIndicators];
    updated[index] = indicator;
    setEditedIndicators(updated);
  };

  const handleBuyConditionChange = (index: number, condition: ConditionConfig) => {
    const updated = [...editedBuyConditions];
    updated[index] = condition;
    setEditedBuyConditions(updated);
  };

  const handleSellConditionChange = (index: number, condition: ConditionConfig) => {
    const updated = [...editedSellConditions];
    updated[index] = condition;
    setEditedSellConditions(updated);
  };

  // ============ 创建策略 ============

  const buildStrategyConfig = () => {
    const template = getTemplateById(selectedTemplateId);

    // 判断是否跟随策略代码（仅代码模式且开关开启时）
    const shouldFollowCode = mode === 'code' && followStrategyCode;

    return {
      name: strategyName || `${template?.name || '自定义'} 策略`,
      description: template?.description || '自定义策略',
      templateId: selectedTemplateId,
      // 交易参数（不受跟随代码影响）
      pairs: selectedPairs,
      leverage: parseInt(leverage) || 1,
      maxOpenTrades: parseInt(maxOpenTrades) || 3,
      exchange,
      fee: parseFloat(fee) || 0.001,
      unfilledTimeout: parseInt(unfilledTimeout) || 10,
      // 标记是否跟随策略代码
      followStrategyCode: shouldFollowCode,
      // 只有不跟随代码时才传这些参数
      ...(!shouldFollowCode && {
        timeframe,
        stoploss: parseFloat(stoploss) || -5,
        takeProfit: parseFloat(takeProfit) || 10,
        trailingStop,
      }),
      // 风险管理（其他不受跟随代码影响的参数）
      stoplossOnExchange,
      cancelOpenOrders,
      // 黑天鹅防护
      blackSwanEnabled,
      blackSwanThreshold: parseFloat(blackSwanThreshold) || -10,
      blackSwanTimeframe: parseInt(blackSwanTimeframe) || 5,
      blackSwanAction,
      // 指标和条件（用户可能修改过的）
      indicators: editedIndicators,
      buyConditions: editedBuyConditions,
      sellConditions: editedSellConditions,
      // 回测参数
      backtestStartDate: startDate,
      backtestEndDate: endDate,
      backtestInitialCapital: parseInt(initialCapital) || 10000,
    };
  };

  const handleBacktest = async () => {
    // 验证
    if (mode === 'code') {
      if (!codeValid) {
        setError('请先修复代码错误');
        return;
      }
      if (!hasActiveVps) {
        setError('代码回测需要运行中的 VPS 实例');
        return;
      }
    }

    if (selectedPairs.length === 0) {
      setError('请至少选择一个交易对');
      return;
    }

    setError(null);
    setPageState('loading');

    try {
      const config = buildStrategyConfig();

      // 保存策略并跳转到回测页面
      const content = mode === 'code' ? code : JSON.stringify({
        type: 'template',
        ...config,
      });

      const response = await strategiesApi.upload({
        name: config.name,
        description: config.description,
        content,
        backtestStartDate: startDate,
        backtestEndDate: endDate,
        backtestInitialCapital: config.backtestInitialCapital,
        backtestPairs: selectedPairs,
      });

      // 跳转到回测页面
      router.push(`/trading/backtest?strategyId=${response.data?.strategyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
      setPageState('config');
    }
  };

  // ============ 渲染：加载状态 ============
  if (pageState === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">正在准备回测...</h3>
          <p className="text-text-secondary text-sm">
            {strategyName || '新策略'} · {selectedPairs.length} 个交易对
          </p>
        </div>
      </div>
    );
  }

  // ============ 渲染：配置页面 ============

  const selectedTemplate = getTemplateById(selectedTemplateId);

  return (
    <div className="space-y-3 pb-32">
      {/* 单卡片表单 */}
      <Card className="overflow-visible">
        <CardContent className="p-4 overflow-visible space-y-4">

            {/* 返回按钮 + 标题 + 问号 */}
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="p-2 -ml-2 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="flex-1 text-lg font-medium text-white">自定义策略</h1>
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

            {/* 模式切换 Tab */}
            <div>
              <div className="flex gap-2 p-1 bg-bg-tertiary rounded-lg">
                <button
                  onClick={() => setMode('template')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    mode === 'template'
                      ? 'bg-brand-primary text-white'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  策略模板
                </button>
                <button
                  onClick={() => setMode('code')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    mode === 'code'
                      ? 'bg-brand-primary text-white'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  代码上传
                </button>
              </div>
            </div>

            {/* 策略名称 */}
            <div>
              <label className="block text-xs text-text-tertiary mb-2">策略名称</label>
              <Input
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder={selectedTemplate ? `我的${selectedTemplate.name}` : '输入策略名称'}
                className="text-sm"
              />
            </div>

            {/* 模板选择（策略模板模式） */}
            {mode === 'template' && (
              <>
                {/* 横向药丸模板选择器 */}
                <div>
                  <label className="block text-xs text-text-tertiary mb-3">选择模板</label>
                  <TemplateSelector
                    selectedId={selectedTemplateId}
                    onSelect={setSelectedTemplateId}
                  />
                </div>

                {/* 策略条件说明卡片 */}
                {selectedTemplate && (
                  <div>
                    <StrategyConditionCard
                      template={selectedTemplate}
                      indicators={editedIndicators}
                      buyConditions={editedBuyConditions}
                      sellConditions={editedSellConditions}
                      onIndicatorChange={handleIndicatorChange}
                      onBuyConditionChange={handleBuyConditionChange}
                      onSellConditionChange={handleSellConditionChange}
                    />
                  </div>
                )}
              </>
            )}

            {/* 代码编辑器（代码模式） */}
            {mode === 'code' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-brand-primary" />
                    <span className="text-sm font-medium text-white">策略代码</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {codeValid === true && (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle className="w-3 h-3" />
                        验证通过
                      </span>
                    )}
                    {codeValid === false && (
                      <span className="flex items-center gap-1 text-xs text-danger">
                        <XCircle className="w-3 h-3" />
                        有错误
                      </span>
                    )}
                    <button
                      onClick={() => setCode(CODE_TEMPLATE)}
                      className="p-1 text-text-tertiary hover:text-white transition-colors"
                      title="重置代码"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-64 p-3 bg-bg-tertiary border border-border-primary rounded-lg text-xs font-mono text-white resize-none focus:outline-none focus:border-brand-primary"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between mt-2 text-xs text-text-tertiary">
                  <span>{code.split('\n').length} 行</span>
                  {!hasActiveVps && (
                    <span className="text-warning">需要运行中的 VPS 才能执行代码回测</span>
                  )}
                </div>
                {codeWarnings.length > 0 && (
                  <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded-lg">
                    {codeWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-warning">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 回测周期 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-brand-primary" />
                <span className="text-sm font-medium text-white">回测周期</span>
              </div>
              {/* 预设周期按钮 */}
              <div className="flex flex-wrap gap-2 mb-2">
                {PERIOD_OPTIONS.map((item) => (
                  <button
                    key={item.days}
                    onClick={() => handleQuickDateSelect(item.days)}
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
              {/* 自定义日期 */}
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
            <div>
              {/* 初始资金 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-text-tertiary">初始资金 (USDT)</span>
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
                            onClick={() => handleAddPair(pair)}
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
                      onClick={() => handleAddPair(pair)}
                      className="px-2 py-0.5 text-xs bg-bg-tertiary hover:bg-border-secondary text-text-secondary hover:text-white rounded transition-colors"
                    >
                      +{pair.replace('/USDT', '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 高级参数（折叠） */}
            <div>
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
                  {/* 代码模式：跟随策略代码开关 */}
                  {mode === 'code' && (
                    <div className="p-3 bg-bg-tertiary/50 rounded-lg border border-border-primary">
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
                      <p className="text-xs text-text-tertiary mt-1.5 ml-6">
                        {followStrategyCode
                          ? '止损/止盈/K线/追踪止损将使用代码中的设置'
                          : '使用下方配置覆盖代码中的设置'}
                      </p>
                    </div>
                  )}

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

                  {/* 止损止盈 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">
                        止损 (%)
                        {mode === 'code' && followStrategyCode && (
                          <span className="ml-1 text-warning">· 代码优先</span>
                        )}
                      </label>
                      <Input
                        type="number"
                        value={stoploss}
                        onChange={(e) => setStoploss(e.target.value)}
                        disabled={mode === 'code' && followStrategyCode}
                        className={`text-sm ${mode === 'code' && followStrategyCode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">
                        止盈 (%)
                        {mode === 'code' && followStrategyCode && (
                          <span className="ml-1 text-warning">· 代码优先</span>
                        )}
                      </label>
                      <Input
                        type="number"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        disabled={mode === 'code' && followStrategyCode}
                        className={`text-sm ${mode === 'code' && followStrategyCode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>

                  {/* K线周期和杠杆 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">
                        K线周期
                        {mode === 'code' && followStrategyCode && (
                          <span className="ml-1 text-warning">· 代码优先</span>
                        )}
                      </label>
                      <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        disabled={mode === 'code' && followStrategyCode}
                        className={`w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-white ${mode === 'code' && followStrategyCode ? 'opacity-50 cursor-not-allowed' : ''}`}
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

                  {/* 风控设置区 */}
                  <div className="pt-3 border-t border-border-primary">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-3.5 h-3.5 text-brand-primary" />
                      <span className="text-xs text-text-tertiary font-medium">风控设置</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <label className={`flex items-center justify-between py-1.5 ${mode === 'code' && followStrategyCode ? 'opacity-50' : 'cursor-pointer'}`}>
                        <span className="text-sm text-white">
                          移动止损
                          {mode === 'code' && followStrategyCode && (
                            <span className="ml-1 text-xs text-warning">· 代码优先</span>
                          )}
                        </span>
                        <Switch
                          checked={trailingStop}
                          onChange={(e) => setTrailingStop(e.target.checked)}
                          disabled={mode === 'code' && followStrategyCode}
                          size="sm"
                        />
                      </label>

                      <label className="flex items-center justify-between py-1.5 cursor-pointer">
                        <span className="text-sm text-white">交易所止损</span>
                        <Switch checked={stoplossOnExchange} onChange={(e) => setStoplossOnExchange(e.target.checked)} size="sm" />
                      </label>

                      <label className="flex items-center justify-between py-1.5 cursor-pointer">
                        <span className="text-sm text-white">退出取消挂单</span>
                        <Switch checked={cancelOpenOrders} onChange={(e) => setCancelOpenOrders(e.target.checked)} size="sm" />
                      </label>
                    </div>
                  </div>

                  {/* 黑天鹅防护区 */}
                  <div className="pt-3 border-t border-border-primary">
                    <label className="flex items-center justify-between py-1.5 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                        <span className="text-sm text-white">黑天鹅防护</span>
                      </div>
                      <Switch checked={blackSwanEnabled} onChange={(e) => setBlackSwanEnabled(e.target.checked)} size="sm" />
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
        <Button
          onClick={handleBacktest}
          disabled={mode === 'code' && !codeValid}
          className="w-full"
        >
          <PlayCircle className="w-4 h-4 mr-2" />
          开始回测
        </Button>
      </div>

      {/* 参数帮助弹窗 */}
      <ParamsHelpModal open={showParamsHelp} onClose={() => setShowParamsHelp(false)} />
    </div>
  );
}

// 导出组件
export default function CreateStrategyPage() {
  return (
    <Suspense fallback={<CreateStrategySkeleton />}>
      <CreateStrategyPageInner />
    </Suspense>
  );
}
