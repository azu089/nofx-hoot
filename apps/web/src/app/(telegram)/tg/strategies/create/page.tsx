'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { strategiesApi, instancesApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button, Switch } from '@/components/ui';
import {
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
  ArrowLeft,
} from 'lucide-react';
import {
  getTemplateById,
  type IndicatorConfig,
  type ConditionConfig,
} from '@/lib/strategy-templates';
import {
  TemplateSelector,
  StrategyConditionCard,
  ParamsHelpModal,
} from '@/components/features/strategies';

type CreateMode = 'template' | 'code';
type PageState = 'config' | 'loading';

const ALL_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'ETC/USDT',
];

const HOT_PAIRS = ['SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT'];

const CODE_TEMPLATE = `# Freqtrade 策略模板
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class MyCustomStrategy(IStrategy):
    minimal_roi = {"0": 0.10, "30": 0.05, "60": 0.02}
    stoploss = -0.05
    timeframe = '5m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[(dataframe['rsi'] < 30), 'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[(dataframe['rsi'] > 70), 'exit_long'] = 1
        return dataframe
`;

const DANGEROUS_KEYWORDS = ['import os', 'import subprocess', 'exec(', 'eval(', '__import__'];

function TgCreateStrategySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-bg-tertiary/50 rounded-lg w-48" />
      <div className="h-12 bg-bg-tertiary/50 rounded-lg" />
      <div className="h-64 bg-bg-tertiary/50 rounded-lg" />
    </div>
  );
}

function TgCreateStrategyInner() {
  const router = useRouter();
  const { haptic } = useTelegramContext();

  const [mode, setMode] = useState<CreateMode>('template');
  const [pageState, setPageState] = useState<PageState>('config');
  const [strategyName, setStrategyName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('rsi-oversold');

  const [editedIndicators, setEditedIndicators] = useState<IndicatorConfig[]>([]);
  const [editedBuyConditions, setEditedBuyConditions] = useState<ConditionConfig[]>([]);
  const [editedSellConditions, setEditedSellConditions] = useState<ConditionConfig[]>([]);

  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC/USDT', 'ETH/USDT']);
  const [pairSearch, setPairSearch] = useState('');
  const [showPairSearch, setShowPairSearch] = useState(false);
  const [timeframe, setTimeframe] = useState('1h');
  const [leverage, setLeverage] = useState('1');
  const [maxOpenTrades, setMaxOpenTrades] = useState('3');
  const [exchange, setExchange] = useState('binance');
  const [fee, setFee] = useState('0.001');

  const [stoploss, setStoploss] = useState('-5');
  const [takeProfit, setTakeProfit] = useState('10');
  const [trailingStop, setTrailingStop] = useState(false);

  const [code, setCode] = useState(CODE_TEMPLATE);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [codeWarnings, setCodeWarnings] = useState<string[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showParamsHelp, setShowParamsHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveVps, setHasActiveVps] = useState(false);

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);

    instancesApi.list().then(response => {
      const instances = response.data || [];
      const activeInstance = instances.find((i: any) => i.status === 'running');
      setHasActiveVps(!!activeInstance);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const template = getTemplateById(selectedTemplateId);
    if (template && !template.isCustom) {
      setTimeframe(template.recommendedTimeframe);
      setStoploss(template.defaultRisk.stoploss.toString());
      setTakeProfit(template.defaultRisk.takeProfit.toString());
      setTrailingStop(template.defaultRisk.trailingStop);
      setEditedIndicators(JSON.parse(JSON.stringify(template.indicators)));
      setEditedBuyConditions(JSON.parse(JSON.stringify(template.buyConditions)));
      setEditedSellConditions(JSON.parse(JSON.stringify(template.sellConditions)));
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    if (mode !== 'code' || !code.trim()) {
      setCodeValid(null);
      setCodeWarnings([]);
      return;
    }

    const timer = setTimeout(() => {
      const foundWarnings: string[] = [];
      const foundErrors: string[] = [];

      for (const keyword of DANGEROUS_KEYWORDS) {
        if (code.includes(keyword)) {
          foundErrors.push(`检测到危险代码: "${keyword}"`);
        }
      }

      if (!code.includes('class') || !code.includes('IStrategy')) {
        foundErrors.push('策略代码必须继承 IStrategy 类');
      }

      if (!code.includes('populate_entry_trend')) {
        foundErrors.push('必须实现 populate_entry_trend 方法');
      }

      setCodeValid(foundErrors.length === 0);
      setCodeWarnings(foundWarnings);
      if (foundErrors.length > 0) {
        setError(foundErrors.join('\n'));
      } else {
        setError(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [code, mode]);

  const handleAddPair = (pair: string) => {
    if (!selectedPairs.includes(pair) && selectedPairs.length < 10) {
      setSelectedPairs([...selectedPairs, pair]);
      haptic('selection');
    }
    setPairSearch('');
    setShowPairSearch(false);
  };

  const handleRemovePair = (pair: string) => {
    if (selectedPairs.length > 1) {
      setSelectedPairs(selectedPairs.filter(p => p !== pair));
      haptic('selection');
    }
  };

  const handleQuickDateSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
    haptic('selection');
  };

  const PERIOD_OPTIONS = [
    { label: '1周', days: 7 },
    { label: '1月', days: 30 },
    { label: '3月', days: 90 },
  ];

  const handleBacktest = async () => {
    if (mode === 'code' && !codeValid) {
      setError('请先修复代码错误');
      return;
    }

    if (selectedPairs.length === 0) {
      setError('请至少选择一个交易对');
      return;
    }

    setError(null);
    setPageState('loading');
    haptic('impact_medium');

    try {
      const template = getTemplateById(selectedTemplateId);
      const config = {
        name: strategyName || `${template?.name || '自定义'} 策略`,
        description: template?.description || '自定义策略',
        templateId: selectedTemplateId,
        pairs: selectedPairs,
        leverage: parseInt(leverage) || 1,
        maxOpenTrades: parseInt(maxOpenTrades) || 3,
        exchange,
        fee: parseFloat(fee) || 0.001,
        timeframe,
        stoploss: parseFloat(stoploss) || -5,
        takeProfit: parseFloat(takeProfit) || 10,
        trailingStop,
        indicators: editedIndicators,
        buyConditions: editedBuyConditions,
        sellConditions: editedSellConditions,
        backtestStartDate: startDate,
        backtestEndDate: endDate,
        backtestInitialCapital: parseInt(initialCapital) || 10000,
      };

      const content = mode === 'code' ? code : JSON.stringify({ type: 'template', ...config });

      const response = await strategiesApi.upload({
        name: config.name,
        description: config.description,
        content,
        backtestStartDate: startDate,
        backtestEndDate: endDate,
        backtestInitialCapital: config.backtestInitialCapital,
        backtestPairs: selectedPairs,
      });

      haptic('notification_success');
      router.push(`/tg/strategies/${response.data?.strategyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
      setPageState('config');
      haptic('notification_error');
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">正在准备回测...</h3>
          <p className="text-text-secondary text-sm">
            {strategyName || '新策略'} · {selectedPairs.length} 个交易对
          </p>
        </div>
      </div>
    );
  }

  const selectedTemplate = getTemplateById(selectedTemplateId);

  return (
    <div className="space-y-4 pb-32">
      {/* 返回按钮 */}
      <button
        onClick={() => {
          haptic('selection');
          router.back();
        }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span>返回</span>
      </button>

      {/* 模式切换 */}
      <div className="relative">
        <button
          onClick={() => setShowParamsHelp(true)}
          className="absolute -top-1 -right-1 p-1.5 rounded-full bg-bg-secondary text-text-tertiary"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <div className="flex gap-2 p-1 bg-bg-secondary rounded-lg">
          <button
            onClick={() => { setMode('template'); haptic('selection'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium ${
              mode === 'template' ? 'bg-brand-primary text-white' : 'text-text-secondary'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            策略模板
          </button>
          <button
            onClick={() => { setMode('code'); haptic('selection'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium ${
              mode === 'code' ? 'bg-brand-primary text-white' : 'text-text-secondary'
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

      {/* 模板选择 */}
      {mode === 'template' && (
        <>
          <TemplateSelector
            selectedId={selectedTemplateId}
            onSelect={(id) => { setSelectedTemplateId(id); haptic('selection'); }}
          />
          {selectedTemplate && (
            <StrategyConditionCard
              template={selectedTemplate}
              indicators={editedIndicators}
              buyConditions={editedBuyConditions}
              sellConditions={editedSellConditions}
              onIndicatorChange={(i, ind) => { const u = [...editedIndicators]; u[i] = ind; setEditedIndicators(u); }}
              onBuyConditionChange={(i, c) => { const u = [...editedBuyConditions]; u[i] = c; setEditedBuyConditions(u); }}
              onSellConditionChange={(i, c) => { const u = [...editedSellConditions]; u[i] = c; setEditedSellConditions(u); }}
            />
          )}
        </>
      )}

      {/* 代码编辑器 */}
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
                  <CheckCircle className="w-3 h-3" /> 验证通过
                </span>
              )}
              {codeValid === false && (
                <span className="flex items-center gap-1 text-xs text-danger">
                  <XCircle className="w-3 h-3" /> 有错误
                </span>
              )}
              <button onClick={() => setCode(CODE_TEMPLATE)} className="p-1.5 text-text-tertiary">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-48 p-3 bg-bg-secondary rounded-lg text-xs font-mono text-white resize-none focus:outline-none"
            spellCheck={false}
          />
          {!hasActiveVps && (
            <p className="text-xs text-warning mt-2">需要运行中的 VPS 才能执行代码回测</p>
          )}
        </div>
      )}

      {/* 回测周期 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-brand-primary" />
          <span className="text-sm font-medium text-white">回测周期</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((item) => (
            <button
              key={item.days}
              onClick={() => handleQuickDateSelect(item.days)}
              className="px-3 py-1.5 text-xs rounded-lg bg-bg-secondary text-text-secondary"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 初始资金 */}
      <div>
        <label className="block text-xs text-text-tertiary mb-2">初始资金 (USDT)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">$</span>
          <Input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            className="text-sm pl-7"
          />
        </div>
      </div>

      {/* 交易对选择 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-tertiary">交易对</span>
          <span className="text-xs text-text-tertiary">{selectedPairs.length}/10</span>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <Input
            value={pairSearch}
            onChange={(e) => { setPairSearch(e.target.value.toUpperCase()); setShowPairSearch(true); }}
            onFocus={() => setShowPairSearch(true)}
            placeholder="搜索交易对..."
            className="text-sm pl-9"
          />
          {showPairSearch && pairSearch && (
            <div className="absolute z-50 w-full mt-1 bg-bg-secondary rounded-lg max-h-40 overflow-y-auto">
              {ALL_PAIRS.filter(p => p.includes(pairSearch) && !selectedPairs.includes(p)).slice(0, 6).map((pair) => (
                <button
                  key={pair}
                  onClick={() => handleAddPair(pair)}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-bg-tertiary flex items-center justify-between"
                >
                  <span>{pair}</span>
                  <Plus className="w-4 h-4 text-brand-primary" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedPairs.map((pair) => (
            <span key={pair} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-primary/20 text-brand-primary text-xs rounded">
              {pair}
              <button onClick={() => handleRemovePair(pair)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-tertiary">热门:</span>
          {HOT_PAIRS.filter(p => !selectedPairs.includes(p)).slice(0, 4).map((pair) => (
            <button
              key={pair}
              onClick={() => handleAddPair(pair)}
              className="px-2 py-0.5 text-xs bg-bg-secondary text-text-secondary rounded"
            >
              +{pair.replace('/USDT', '')}
            </button>
          ))}
        </div>
      </div>

      {/* 高级参数 */}
      <div className="bg-bg-secondary rounded-xl p-4">
        <button onClick={() => { setShowAdvanced(!showAdvanced); haptic('selection'); }} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-text-tertiary" />
            <span className="text-sm text-text-secondary">高级参数</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-tertiary mb-1">止损 (%)</label>
                <Input type="number" value={stoploss} onChange={(e) => setStoploss(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1">止盈 (%)</label>
                <Input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-tertiary mb-1">K线周期</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary rounded-lg text-sm text-white"
                >
                  <option value="5m">5分钟</option>
                  <option value="15m">15分钟</option>
                  <option value="1h">1小时</option>
                  <option value="4h">4小时</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1">杠杆</label>
                <Input type="number" value={leverage} onChange={(e) => setLeverage(e.target.value)} min="1" max="20" className="text-sm" />
              </div>
            </div>
            <label className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white">移动止损</span>
              <Switch checked={trailingStop} onChange={(e) => setTrailingStop(e.target.checked)} size="sm" />
            </label>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger/10 rounded-lg">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-bg-primary/95 backdrop-blur border-t border-border-primary/30">
        <Button onClick={handleBacktest} disabled={mode === 'code' && !codeValid} className="w-full">
          <PlayCircle className="w-4 h-4 mr-2" />
          开始回测
        </Button>
      </div>

      <ParamsHelpModal open={showParamsHelp} onClose={() => setShowParamsHelp(false)} />
    </div>
  );
}

export default function TgCreateStrategyPage() {
  return (
    <Suspense fallback={<TgCreateStrategySkeleton />}>
      <TgCreateStrategyInner />
    </Suspense>
  );
}
