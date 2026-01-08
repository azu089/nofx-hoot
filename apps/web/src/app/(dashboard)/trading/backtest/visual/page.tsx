'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { SymbolSearch } from '@/components/features/trading';
import { strategiesApi } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  Sliders,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Shield,
  Play,
  Loader2,
  AlertCircle,
  ArrowRight,
  Settings,
  Target,
  Activity,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

// 指标类型
type IndicatorType = 'RSI' | 'MACD' | 'MA' | 'EMA' | 'BOLLINGER' | 'ATR' | 'STOCH' | 'ADX';

// 操作符类型
type OperatorType = '<' | '>' | '==' | 'cross_above' | 'cross_below';

// 指标配置
interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: Record<string, number>;
}

// 条件配置
interface ConditionConfig {
  id: string;
  indicator: string;
  field?: string;
  operator: OperatorType;
  value: number | string;
}

// 风控配置
interface RiskConfig {
  stoploss: number;
  takeProfit: number;
  trailingStop: boolean;
  trailingStopOffset: number;
}

// 策略配置
interface VisualStrategyConfig {
  name: string;
  indicators: IndicatorConfig[];
  buyConditions: ConditionConfig[];
  sellConditions: ConditionConfig[];
  riskManagement: RiskConfig;
}

// 回测结果
interface BacktestResult {
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgProfit: number;
  avgLoss: number;
}

// 指标模板
const INDICATOR_TEMPLATES: Record<IndicatorType, { name: string; description: string; defaultParams: Record<string, number>; fields: string[] }> = {
  RSI: {
    name: 'RSI 相对强弱指数',
    description: '衡量价格变动的速度和幅度，常用于判断超买超卖',
    defaultParams: { period: 14 },
    fields: ['value'],
  },
  MACD: {
    name: 'MACD 移动平均收敛/发散',
    description: '通过两条移动平均线的差值判断趋势方向和动量',
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    fields: ['macd', 'signal', 'histogram'],
  },
  MA: {
    name: 'MA 简单移动平均线',
    description: '计算特定周期内的平均价格，用于判断趋势',
    defaultParams: { period: 20 },
    fields: ['value'],
  },
  EMA: {
    name: 'EMA 指数移动平均线',
    description: '对近期价格赋予更高权重的移动平均线',
    defaultParams: { period: 20 },
    fields: ['value'],
  },
  BOLLINGER: {
    name: '布林带',
    description: '基于移动平均线和标准差构建的通道指标',
    defaultParams: { period: 20, stdDev: 2 },
    fields: ['upper', 'middle', 'lower'],
  },
  ATR: {
    name: 'ATR 真实波动幅度',
    description: '衡量市场波动性的指标',
    defaultParams: { period: 14 },
    fields: ['value'],
  },
  STOCH: {
    name: '随机指标 KDJ',
    description: '通过比较收盘价与价格范围来判断超买超卖',
    defaultParams: { k: 14, d: 3, smooth: 3 },
    fields: ['k', 'd'],
  },
  ADX: {
    name: 'ADX 平均趋向指数',
    description: '衡量趋势强度的指标',
    defaultParams: { period: 14 },
    fields: ['value', 'plus_di', 'minus_di'],
  },
};

// 操作符选项
const OPERATOR_OPTIONS: { value: OperatorType; label: string }[] = [
  { value: '<', label: '小于' },
  { value: '>', label: '大于' },
  { value: '==', label: '等于' },
  { value: 'cross_above', label: '上穿' },
  { value: 'cross_below', label: '下穿' },
];

// 生成唯一 ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function VisualBacktestPage() {
  const router = useRouter();

  // 策略配置
  const [strategyName, setStrategyName] = useState('我的自定义策略');
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const [buyConditions, setBuyConditions] = useState<ConditionConfig[]>([]);
  const [sellConditions, setSellConditions] = useState<ConditionConfig[]>([]);
  const [riskConfig, setRiskConfig] = useState<RiskConfig>({
    stoploss: -5,
    takeProfit: 10,
    trailingStop: false,
    trailingStopOffset: 1,
  });

  // 回测参数
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC/USDT', 'ETH/USDT']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');

  // 状态
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 设置默认日期
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  // 添加指标
  const addIndicator = (type: IndicatorType) => {
    const template = INDICATOR_TEMPLATES[type];
    setIndicators([...indicators, {
      id: generateId(),
      type,
      params: { ...template.defaultParams },
    }]);
  };

  // 移除指标
  const removeIndicator = (id: string) => {
    setIndicators(indicators.filter(i => i.id !== id));
    // 同时移除使用该指标的条件
    setBuyConditions(buyConditions.filter(c => !c.indicator.startsWith(id)));
    setSellConditions(sellConditions.filter(c => !c.indicator.startsWith(id)));
  };

  // 更新指标参数
  const updateIndicatorParam = (id: string, param: string, value: number) => {
    setIndicators(indicators.map(i =>
      i.id === id ? { ...i, params: { ...i.params, [param]: value } } : i
    ));
  };

  // 添加买入条件
  const addBuyCondition = () => {
    if (indicators.length === 0) {
      setError('请先添加至少一个指标');
      return;
    }
    const firstIndicator = indicators[0];
    const template = INDICATOR_TEMPLATES[firstIndicator.type];
    setBuyConditions([...buyConditions, {
      id: generateId(),
      indicator: `${firstIndicator.id}`,
      field: template.fields[0],
      operator: '<',
      value: 30,
    }]);
  };

  // 添加卖出条件
  const addSellCondition = () => {
    if (indicators.length === 0) {
      setError('请先添加至少一个指标');
      return;
    }
    const firstIndicator = indicators[0];
    const template = INDICATOR_TEMPLATES[firstIndicator.type];
    setSellConditions([...sellConditions, {
      id: generateId(),
      indicator: `${firstIndicator.id}`,
      field: template.fields[0],
      operator: '>',
      value: 70,
    }]);
  };

  // 移除条件
  const removeCondition = (type: 'buy' | 'sell', id: string) => {
    if (type === 'buy') {
      setBuyConditions(buyConditions.filter(c => c.id !== id));
    } else {
      setSellConditions(sellConditions.filter(c => c.id !== id));
    }
  };

  // 更新条件
  const updateCondition = (type: 'buy' | 'sell', id: string, updates: Partial<ConditionConfig>) => {
    if (type === 'buy') {
      setBuyConditions(buyConditions.map(c => c.id === id ? { ...c, ...updates } : c));
    } else {
      setSellConditions(sellConditions.map(c => c.id === id ? { ...c, ...updates } : c));
    }
  };

  // 执行回测
  const handleBacktest = async () => {
    setError(null);

    // 验证
    if (indicators.length === 0) {
      setError('请至少添加一个技术指标');
      return;
    }
    if (buyConditions.length === 0) {
      setError('请至少添加一个买入条件');
      return;
    }
    if (sellConditions.length === 0) {
      setError('请至少添加一个卖出条件');
      return;
    }
    if (selectedPairs.length === 0) {
      setError('请至少选择一个交易对');
      return;
    }
    if (!startDate || !endDate) {
      setError('请选择回测时间范围');
      return;
    }

    setLoading(true);

    try {
      // 调用后端可视化回测 API（Master 本地执行，不需要 VPS）
      const response = await strategiesApi.runVisualBacktest({
        name: strategyName,
        indicators: indicators.map(ind => ({
          id: ind.id,
          type: ind.type,
          params: ind.params,
        })),
        buyConditions: buyConditions.map(cond => ({
          id: cond.id,
          indicator: cond.indicator,
          field: cond.field,
          operator: cond.operator,
          value: cond.value,
        })),
        sellConditions: sellConditions.map(cond => ({
          id: cond.id,
          indicator: cond.indicator,
          field: cond.field,
          operator: cond.operator,
          value: cond.value,
        })),
        riskManagement: {
          stoploss: riskConfig.stoploss / 100, // 转换为小数
          takeProfit: riskConfig.takeProfit / 100,
          trailingStop: riskConfig.trailingStop,
          trailingStopOffset: riskConfig.trailingStopOffset / 100,
        },
        pairs: selectedPairs,
        startDate,
        endDate,
        initialCapital: parseFloat(initialCapital) || 10000,
      });

      if (response.code === 0 && response.data) {
        setResult({
          totalReturn: response.data.totalReturn,
          winRate: response.data.winRate,
          totalTrades: response.data.totalTrades,
          maxDrawdown: response.data.maxDrawdown,
          sharpeRatio: response.data.sharpeRatio,
          profitFactor: response.data.profitFactor,
          avgProfit: response.data.avgProfit,
          avgLoss: response.data.avgLoss,
        });
      } else {
        setError(response.message || '回测失败，请稍后重试');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '回测失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取指标显示名称
  const getIndicatorDisplayName = (indicator: IndicatorConfig) => {
    const template = INDICATOR_TEMPLATES[indicator.type];
    const params = Object.entries(indicator.params).map(([k, v]) => `${v}`).join(',');
    return `${indicator.type}(${params})`;
  };

  return (
    <div className="space-y-6">
      <MobileHeader title="自定义策略" />

      {/* 策略名称 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-brand-primary" />
            <Input
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="策略名称"
              className="text-lg font-medium"
            />
          </div>
        </CardContent>
      </Card>

      {/* 技术指标配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-primary" />
              技术指标
            </span>
            <div className="relative group">
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                添加指标
              </Button>
              {/* 下拉菜单 */}
              <div className="absolute right-0 top-full mt-2 w-64 bg-bg-secondary border border-border-primary rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-2 max-h-80 overflow-y-auto">
                  {(Object.keys(INDICATOR_TEMPLATES) as IndicatorType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => addIndicator(type)}
                      className="w-full px-4 py-3 text-left hover:bg-bg-tertiary transition-colors"
                    >
                      <p className="text-text-primary font-medium">{INDICATOR_TEMPLATES[type].name}</p>
                      <p className="text-text-tertiary text-xs mt-0.5">{INDICATOR_TEMPLATES[type].description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {indicators.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂未添加指标</p>
              <p className="text-sm text-text-tertiary mt-1">点击上方按钮添加技术指标</p>
            </div>
          ) : (
            <div className="space-y-3">
              {indicators.map((indicator) => {
                const template = INDICATOR_TEMPLATES[indicator.type];
                return (
                  <div
                    key={indicator.id}
                    className="p-4 bg-bg-tertiary/50 rounded-xl border border-border-primary"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-brand-primary/20 text-brand-primary text-sm font-medium rounded">
                          {indicator.type}
                        </span>
                        <span className="text-text-primary">{template.name}</span>
                      </div>
                      <button
                        onClick={() => removeIndicator(indicator.id)}
                        className="p-1 hover:bg-danger/20 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-danger" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(indicator.params).map(([param, value]) => (
                        <div key={param} className="flex items-center gap-2">
                          <span className="text-text-secondary text-sm capitalize">{param}:</span>
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) => updateIndicatorParam(indicator.id, param, parseInt(e.target.value) || 0)}
                            className="w-20"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 买入条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              买入条件
            </span>
            <Button variant="outline" size="sm" onClick={addBuyCondition}>
              <Plus className="w-4 h-4 mr-1" />
              添加条件
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {buyConditions.length === 0 ? (
            <div className="text-center py-6 text-text-secondary">
              <p className="text-sm">暂无买入条件，满足条件时将自动开仓</p>
            </div>
          ) : (
            <div className="space-y-3">
              {buyConditions.map((condition, index) => (
                <div
                  key={condition.id}
                  className="flex flex-wrap items-center gap-2 p-3 bg-success/5 border border-success/20 rounded-lg"
                >
                  <span className="text-text-tertiary text-sm">{index > 0 ? '且' : '当'}</span>
                  <select
                    value={condition.indicator}
                    onChange={(e) => updateCondition('buy', condition.id, { indicator: e.target.value })}
                    className="bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-sm text-text-primary"
                  >
                    {indicators.map((ind) => (
                      <option key={ind.id} value={ind.id}>
                        {getIndicatorDisplayName(ind)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition('buy', condition.id, { operator: e.target.value as OperatorType })}
                    className="bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-sm text-text-primary"
                  >
                    {OPERATOR_OPTIONS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    value={condition.value}
                    onChange={(e) => updateCondition('buy', condition.id, { value: parseFloat(e.target.value) || 0 })}
                    className="w-20"
                  />
                  <button
                    onClick={() => removeCondition('buy', condition.id)}
                    className="p-1 hover:bg-danger/20 rounded transition-colors ml-auto"
                  >
                    <X className="w-4 h-4 text-danger" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 卖出条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-danger" />
              卖出条件
            </span>
            <Button variant="outline" size="sm" onClick={addSellCondition}>
              <Plus className="w-4 h-4 mr-1" />
              添加条件
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sellConditions.length === 0 ? (
            <div className="text-center py-6 text-text-secondary">
              <p className="text-sm">暂无卖出条件，满足条件时将自动平仓</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sellConditions.map((condition, index) => (
                <div
                  key={condition.id}
                  className="flex flex-wrap items-center gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg"
                >
                  <span className="text-text-tertiary text-sm">{index > 0 ? '且' : '当'}</span>
                  <select
                    value={condition.indicator}
                    onChange={(e) => updateCondition('sell', condition.id, { indicator: e.target.value })}
                    className="bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-sm text-text-primary"
                  >
                    {indicators.map((ind) => (
                      <option key={ind.id} value={ind.id}>
                        {getIndicatorDisplayName(ind)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition('sell', condition.id, { operator: e.target.value as OperatorType })}
                    className="bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-sm text-text-primary"
                  >
                    {OPERATOR_OPTIONS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    value={condition.value}
                    onChange={(e) => updateCondition('sell', condition.id, { value: parseFloat(e.target.value) || 0 })}
                    className="w-20"
                  />
                  <button
                    onClick={() => removeCondition('sell', condition.id)}
                    className="p-1 hover:bg-danger/20 rounded transition-colors ml-auto"
                  >
                    <X className="w-4 h-4 text-danger" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 风险管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-warning" />
            风险管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">止损 (%)</label>
              <Input
                type="number"
                value={riskConfig.stoploss}
                onChange={(e) => setRiskConfig({ ...riskConfig, stoploss: parseFloat(e.target.value) || 0 })}
                step="0.5"
              />
              <p className="text-xs text-text-tertiary mt-1">亏损达到此比例自动止损</p>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">止盈 (%)</label>
              <Input
                type="number"
                value={riskConfig.takeProfit}
                onChange={(e) => setRiskConfig({ ...riskConfig, takeProfit: parseFloat(e.target.value) || 0 })}
                step="0.5"
              />
              <p className="text-xs text-text-tertiary mt-1">盈利达到此比例自动止盈</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={riskConfig.trailingStop}
                onChange={(e) => setRiskConfig({ ...riskConfig, trailingStop: e.target.checked })}
                className="w-4 h-4 rounded border-border-primary bg-bg-tertiary"
              />
              <span className="text-text-primary">启用追踪止损</span>
            </label>
            {riskConfig.trailingStop && (
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-sm">偏移:</span>
                <Input
                  type="number"
                  value={riskConfig.trailingStopOffset}
                  onChange={(e) => setRiskConfig({ ...riskConfig, trailingStopOffset: parseFloat(e.target.value) || 0 })}
                  className="w-20"
                  step="0.1"
                />
                <span className="text-text-tertiary text-sm">%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 回测参数 */}
      <Card>
        <CardHeader>
          <CardTitle
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-text-secondary" />
              回测参数
            </span>
            {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </CardTitle>
        </CardHeader>
        {showAdvanced && (
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">开始日期</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">结束日期</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">初始资金 (USDT)</label>
                <Input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  min="100"
                />
              </div>

              <SymbolSearch
                selectedSymbols={selectedPairs}
                onSelectionChange={setSelectedPairs}
                maxSelection={10}
                label="交易对选择"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-danger/10 border border-danger/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* 开始回测按钮 */}
      <Button
        onClick={handleBacktest}
        disabled={loading}
        className="w-full py-4"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            回测中...
          </>
        ) : (
          <>
            <Play className="w-5 h-5 mr-2" />
            开始回测
          </>
        )}
      </Button>

      {/* 回测结果 */}
      {result && (
        <Card className="border-brand-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-primary" />
              回测结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">总收益率</p>
                <p className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                  {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                </p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">胜率</p>
                <p className="text-2xl font-bold text-text-primary">{result.winRate.toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">总交易次数</p>
                <p className="text-2xl font-bold text-text-primary">{result.totalTrades}</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">最大回撤</p>
                <p className="text-2xl font-bold text-danger">{result.maxDrawdown.toFixed(2)}%</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">夏普比率</p>
                <p className="text-2xl font-bold text-text-primary">{result.sharpeRatio.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">盈亏比</p>
                <p className="text-2xl font-bold text-text-primary">{result.profitFactor.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">平均盈利</p>
                <p className="text-2xl font-bold text-success">+${result.avgProfit.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-bg-tertiary/50 rounded-xl">
                <p className="text-text-secondary text-sm mb-1">平均亏损</p>
                <p className="text-2xl font-bold text-danger">${result.avgLoss.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
