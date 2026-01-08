/**
 * 策略模板配置
 * 用于创建策略页面的预设模板
 */

// 指标类型
export type IndicatorType = 'RSI' | 'MACD' | 'MA' | 'EMA' | 'BOLLINGER' | 'ATR' | 'STOCH' | 'ADX';

// 条件运算符
export type ConditionOperator = '<' | '>' | '==' | 'cross_above' | 'cross_below';

// 风险等级
export type RiskLevel = 'low' | 'medium' | 'high';

// 指标配置
export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: Record<string, number>;
}

// 条件配置
export interface ConditionConfig {
  id: string;
  indicator: string;
  field: string;
  operator: ConditionOperator;
  value: number;
}

// 风险配置
export interface RiskConfig {
  stoploss: number;      // 止损百分比（负数）
  takeProfit: number;    // 止盈百分比（正数）
  trailingStop: boolean; // 是否启用追踪止损
  trailingStopOffset: number; // 追踪止损偏移
}

// 策略模板
export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  riskLevel: RiskLevel;
  recommendedTimeframe: string;
  marketType: string;
  indicators: IndicatorConfig[];
  buyConditions: ConditionConfig[];
  sellConditions: ConditionConfig[];
  defaultRisk: RiskConfig;
  isCustom?: boolean;
}

// 预设策略模板
export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'rsi-oversold',
    name: 'RSI 超卖反弹',
    description: '当 RSI 低于 30 时买入，高于 70 时卖出，适合震荡行情',
    icon: '📈',
    riskLevel: 'medium',
    recommendedTimeframe: '1h',
    marketType: '震荡行情',
    indicators: [
      { id: 'rsi-1', type: 'RSI', params: { period: 14 } }
    ],
    buyConditions: [
      { id: 'buy-1', indicator: 'rsi-1', field: 'rsi', operator: '<', value: 30 }
    ],
    sellConditions: [
      { id: 'sell-1', indicator: 'rsi-1', field: 'rsi', operator: '>', value: 70 }
    ],
    defaultRisk: {
      stoploss: -5,
      takeProfit: 10,
      trailingStop: false,
      trailingStopOffset: 1
    }
  },
  {
    id: 'macd-golden-cross',
    name: 'MACD 金叉',
    description: 'MACD 上穿信号线买入，下穿卖出，适合趋势启动阶段',
    icon: '📊',
    riskLevel: 'medium',
    recommendedTimeframe: '4h',
    marketType: '趋势启动',
    indicators: [
      { id: 'macd-1', type: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } }
    ],
    buyConditions: [
      { id: 'buy-1', indicator: 'macd-1', field: 'macd', operator: 'cross_above', value: 0 }
    ],
    sellConditions: [
      { id: 'sell-1', indicator: 'macd-1', field: 'macd', operator: 'cross_below', value: 0 }
    ],
    defaultRisk: {
      stoploss: -6,
      takeProfit: 12,
      trailingStop: true,
      trailingStopOffset: 2
    }
  },
  {
    id: 'dual-ma-cross',
    name: '双均线交叉',
    description: 'MA20 上穿 MA50 买入，下穿卖出，经典趋势跟踪策略',
    icon: '📉',
    riskLevel: 'low',
    recommendedTimeframe: '1d',
    marketType: '趋势行情',
    indicators: [
      { id: 'ma-20', type: 'MA', params: { period: 20 } },
      { id: 'ma-50', type: 'MA', params: { period: 50 } }
    ],
    buyConditions: [
      { id: 'buy-1', indicator: 'ma-20', field: 'ma', operator: 'cross_above', value: 0 }
    ],
    sellConditions: [
      { id: 'sell-1', indicator: 'ma-20', field: 'ma', operator: 'cross_below', value: 0 }
    ],
    defaultRisk: {
      stoploss: -8,
      takeProfit: 15,
      trailingStop: true,
      trailingStopOffset: 3
    }
  },
  {
    id: 'bollinger-breakout',
    name: '布林带突破',
    description: '价格触及下轨买入，触及上轨卖出，适合震荡区间交易',
    icon: '📏',
    riskLevel: 'medium',
    recommendedTimeframe: '1h',
    marketType: '震荡行情',
    indicators: [
      { id: 'boll-1', type: 'BOLLINGER', params: { period: 20, stdDev: 2 } }
    ],
    buyConditions: [
      { id: 'buy-1', indicator: 'boll-1', field: 'lower', operator: '>', value: 0 }
    ],
    sellConditions: [
      { id: 'sell-1', indicator: 'boll-1', field: 'upper', operator: '<', value: 0 }
    ],
    defaultRisk: {
      stoploss: -4,
      takeProfit: 8,
      trailingStop: false,
      trailingStopOffset: 1
    }
  },
  {
    id: 'rsi-macd-combo',
    name: 'RSI + MACD 组合',
    description: 'RSI 超卖且 MACD 金叉时买入，双重确认降低误判',
    icon: '🔗',
    riskLevel: 'low',
    recommendedTimeframe: '4h',
    marketType: '综合行情',
    indicators: [
      { id: 'rsi-1', type: 'RSI', params: { period: 14 } },
      { id: 'macd-1', type: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } }
    ],
    buyConditions: [
      { id: 'buy-1', indicator: 'rsi-1', field: 'rsi', operator: '<', value: 35 },
      { id: 'buy-2', indicator: 'macd-1', field: 'macd', operator: 'cross_above', value: 0 }
    ],
    sellConditions: [
      { id: 'sell-1', indicator: 'rsi-1', field: 'rsi', operator: '>', value: 65 }
    ],
    defaultRisk: {
      stoploss: -5,
      takeProfit: 12,
      trailingStop: true,
      trailingStopOffset: 2
    }
  },
];

// 时间周期选项
export const TIMEFRAME_OPTIONS = [
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
];

// 常用交易对
export const POPULAR_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'DOGE/USDT',
  'ADA/USDT',
  'AVAX/USDT',
];

// 风险等级颜色
export const RISK_LEVEL_STYLES: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-success/15', text: 'text-success', label: '低风险' },
  medium: { bg: 'bg-warning/15', text: 'text-warning', label: '中风险' },
  high: { bg: 'bg-danger/15', text: 'text-danger', label: '高风险' },
};

// 根据 ID 获取模板
export function getTemplateById(id: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find(t => t.id === id);
}

// 获取模板的默认配置（用于表单初始化）
export function getTemplateDefaults(templateId: string) {
  const template = getTemplateById(templateId);
  if (!template) return null;

  return {
    name: '',
    template: templateId,
    timeframe: template.recommendedTimeframe,
    pairs: ['BTC/USDT'],
    leverage: 1,
    maxOpenTrades: 3,
    stoploss: template.defaultRisk.stoploss,
    takeProfit: template.defaultRisk.takeProfit,
    trailingStop: template.defaultRisk.trailingStop,
    trailingStopOffset: template.defaultRisk.trailingStopOffset,
    indicators: template.indicators,
    buyConditions: template.buyConditions,
    sellConditions: template.sellConditions,
  };
}

// ============================================================
// 精细化优化：参数选项、运算符映射、条件解释
// ============================================================

// 指标参数选项（用于下拉编辑）
export interface ParamOption {
  paramName: string;
  label: string;
  options: number[];
}

export const INDICATOR_PARAM_OPTIONS: Record<IndicatorType, ParamOption[]> = {
  RSI: [
    { paramName: 'period', label: '周期', options: [7, 14, 21, 28] }
  ],
  MACD: [
    { paramName: 'fastPeriod', label: '快线', options: [6, 8, 10, 12] },
    { paramName: 'slowPeriod', label: '慢线', options: [20, 24, 26, 30] },
    { paramName: 'signalPeriod', label: '信号', options: [5, 7, 9, 12] },
  ],
  MA: [
    { paramName: 'period', label: '周期', options: [5, 10, 20, 50, 100, 200] }
  ],
  EMA: [
    { paramName: 'period', label: '周期', options: [5, 10, 20, 50, 100, 200] }
  ],
  BOLLINGER: [
    { paramName: 'period', label: '周期', options: [10, 15, 20, 25, 30] },
    { paramName: 'stdDev', label: '标准差', options: [1, 1.5, 2, 2.5, 3] },
  ],
  ATR: [
    { paramName: 'period', label: '周期', options: [7, 14, 21, 28] }
  ],
  STOCH: [
    { paramName: 'kPeriod', label: 'K周期', options: [5, 9, 14, 21] },
    { paramName: 'dPeriod', label: 'D周期', options: [3, 5, 7, 9] },
  ],
  ADX: [
    { paramName: 'period', label: '周期', options: [7, 14, 21, 28] }
  ],
};

// 运算符显示映射
export const OPERATOR_DISPLAY: Record<ConditionOperator, string> = {
  '<': '小于',
  '>': '大于',
  '==': '等于',
  'cross_above': '上穿',
  'cross_below': '下穿',
};

// 指标字段显示名
export const INDICATOR_FIELD_DISPLAY: Record<string, string> = {
  rsi: 'RSI 值',
  macd: 'MACD 柱',
  signal: '信号线',
  histogram: '柱状图',
  ma: '均线值',
  ema: 'EMA 值',
  upper: '上轨',
  middle: '中轨',
  lower: '下轨',
  atr: 'ATR 值',
  k: 'K 值',
  d: 'D 值',
  adx: 'ADX 值',
};

// 指标类型显示名
export const INDICATOR_TYPE_DISPLAY: Record<IndicatorType, string> = {
  RSI: '相对强弱指数',
  MACD: 'MACD 指标',
  MA: '移动平均线',
  EMA: '指数移动平均',
  BOLLINGER: '布林带',
  ATR: '平均真实波幅',
  STOCH: '随机指标',
  ADX: '趋向指标',
};

// 条件阈值选项（用于下拉编辑）
export interface ThresholdOption {
  indicatorType: IndicatorType;
  field: string;
  operator: ConditionOperator;
  options: number[];
}

export const CONDITION_THRESHOLD_OPTIONS: ThresholdOption[] = [
  // RSI 阈值
  { indicatorType: 'RSI', field: 'rsi', operator: '<', options: [20, 25, 30, 35, 40] },
  { indicatorType: 'RSI', field: 'rsi', operator: '>', options: [60, 65, 70, 75, 80] },
  // MACD 金叉死叉（值为 0）
  { indicatorType: 'MACD', field: 'macd', operator: 'cross_above', options: [0] },
  { indicatorType: 'MACD', field: 'macd', operator: 'cross_below', options: [0] },
  // 均线交叉（值为 0，表示与另一条均线比较）
  { indicatorType: 'MA', field: 'ma', operator: 'cross_above', options: [0] },
  { indicatorType: 'MA', field: 'ma', operator: 'cross_below', options: [0] },
  // 布林带（值为 0，表示价格与轨道比较）
  { indicatorType: 'BOLLINGER', field: 'lower', operator: '>', options: [0] },
  { indicatorType: 'BOLLINGER', field: 'upper', operator: '<', options: [0] },
];

// 获取条件的人话解释
export function getConditionExplanation(
  condition: ConditionConfig,
  indicator: IndicatorConfig
): string {
  const { operator, value, field } = condition;
  const { type, params } = indicator;

  switch (type) {
    case 'RSI': {
      const period = params.period || 14;
      if (operator === '<') {
        return `当 RSI(${period}) 低于 ${value} 时，表示市场可能处于超卖状态，价格有反弹潜力`;
      }
      if (operator === '>') {
        return `当 RSI(${period}) 高于 ${value} 时，表示市场可能处于超买状态，价格有回落风险`;
      }
      break;
    }
    case 'MACD': {
      if (operator === 'cross_above') {
        return `当 MACD 线从下方穿越信号线（金叉）时，表示短期动能转强，可能开启上涨趋势`;
      }
      if (operator === 'cross_below') {
        return `当 MACD 线从上方穿越信号线（死叉）时，表示短期动能转弱，可能开启下跌趋势`;
      }
      break;
    }
    case 'MA':
    case 'EMA': {
      const period = params.period || 20;
      if (operator === 'cross_above') {
        return `当短周期均线(${period})上穿长周期均线时，形成金叉，表示趋势可能转为上涨`;
      }
      if (operator === 'cross_below') {
        return `当短周期均线(${period})下穿长周期均线时，形成死叉，表示趋势可能转为下跌`;
      }
      break;
    }
    case 'BOLLINGER': {
      if (field === 'lower' && operator === '>') {
        return `当价格触及布林带下轨时，表示价格可能被低估，有反弹机会`;
      }
      if (field === 'upper' && operator === '<') {
        return `当价格触及布林带上轨时，表示价格可能被高估，有回落风险`;
      }
      break;
    }
    case 'STOCH': {
      if (operator === '<') {
        return `当随机指标低于 ${value} 时，表示市场处于超卖区域`;
      }
      if (operator === '>') {
        return `当随机指标高于 ${value} 时，表示市场处于超买区域`;
      }
      break;
    }
    case 'ADX': {
      if (operator === '>') {
        return `当 ADX 高于 ${value} 时，表示当前趋势较强，适合趋势跟踪策略`;
      }
      break;
    }
  }

  return `当 ${INDICATOR_TYPE_DISPLAY[type]} ${OPERATOR_DISPLAY[operator]} ${value} 时触发`;
}

// 格式化条件为可读文本
export function formatConditionText(
  condition: ConditionConfig,
  indicator: IndicatorConfig
): string {
  const { operator, value, field } = condition;
  const { type, params } = indicator;

  const typeName = INDICATOR_TYPE_DISPLAY[type];
  const operatorName = OPERATOR_DISPLAY[operator];

  // 构建参数字符串
  const paramParts: string[] = [];
  const paramOptions = INDICATOR_PARAM_OPTIONS[type];
  if (paramOptions) {
    paramOptions.forEach(opt => {
      const val = params[opt.paramName];
      if (val !== undefined) {
        paramParts.push(`${opt.label}: ${val}`);
      }
    });
  }
  const paramStr = paramParts.length > 0 ? `(${paramParts.join(', ')})` : '';

  // 特殊处理交叉类型
  if (operator === 'cross_above' || operator === 'cross_below') {
    if (type === 'MACD') {
      return `${typeName}${paramStr} ${operatorName}信号线`;
    }
    if (type === 'MA' || type === 'EMA') {
      return `短期${typeName}${paramStr} ${operatorName}长期均线`;
    }
    return `${typeName}${paramStr} ${operatorName}`;
  }

  // 特殊处理布林带
  if (type === 'BOLLINGER') {
    const fieldName = INDICATOR_FIELD_DISPLAY[field] || field;
    return `价格触及${typeName}${paramStr}的${fieldName}`;
  }

  // 常规格式
  const fieldName = INDICATOR_FIELD_DISPLAY[field] || field;
  return `${typeName}${paramStr} ${fieldName} ${operatorName} ${value}`;
}
