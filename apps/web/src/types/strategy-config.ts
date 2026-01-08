/**
 * 策略配置类型定义
 * 用于策略详情页、回测页面、我的策略之间共享配置
 */

// 分阶段止盈配置
export interface MinimalRoiEntry {
  minutes: number;
  roi: number; // 小数形式，如 0.1 表示 10%
}

// 完整的策略配置（用于跨页面传递）
export interface StrategyConfig {
  // 基础参数
  strategyId: string;
  strategyName?: string;
  capital: string;
  leverage: string;
  stopLoss: string; // 百分比字符串，如 "-10"
  takeProfit: string; // 百分比字符串，如 "30"
  maxPositions: string;
  selectedCoins: string[]; // 白名单币种，如 ['BTC', 'ETH']

  // 高级参数
  timeframe: string; // K 线周期，如 '5m'
  exchange: string; // 交易所，如 'binance'
  fee?: string; // 手续费率，如 '0.001'

  // 分阶段止盈
  minimalRoi: MinimalRoiEntry[];

  // 移动止损
  trailingStop: boolean;
  trailingStopPositive: string;
  trailingStopOffset: string;
  trailingOnlyOffsetReached: boolean;

  // 交易所级止损
  stoplossOnExchange: boolean;

  // 黑名单币种
  blacklist: string[];
}

// sessionStorage 的 key
export const STRATEGY_CONFIG_KEY = 'quantfi_strategy_config';

/**
 * 保存策略配置到 sessionStorage
 */
export function saveStrategyConfig(config: StrategyConfig): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(STRATEGY_CONFIG_KEY, JSON.stringify(config));
  }
}

/**
 * 从 sessionStorage 读取策略配置
 * @param clear 读取后是否清除（默认 true）
 */
export function loadStrategyConfig(clear = true): StrategyConfig | null {
  if (typeof window === 'undefined') return null;

  const data = sessionStorage.getItem(STRATEGY_CONFIG_KEY);
  if (!data) return null;

  try {
    const config = JSON.parse(data) as StrategyConfig;
    if (clear) {
      sessionStorage.removeItem(STRATEGY_CONFIG_KEY);
    }
    return config;
  } catch {
    return null;
  }
}

/**
 * 清除策略配置
 */
export function clearStrategyConfig(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STRATEGY_CONFIG_KEY);
  }
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): Omit<StrategyConfig, 'strategyId'> {
  return {
    capital: '',
    leverage: '1',
    stopLoss: '-10',
    takeProfit: '30',
    maxPositions: '3',
    selectedCoins: ['BTC', 'ETH'],
    timeframe: '5m',
    exchange: 'binance',
    fee: '0.001',
    minimalRoi: [
      { minutes: 0, roi: 0.1 },
      { minutes: 30, roi: 0.05 },
      { minutes: 60, roi: 0.02 },
    ],
    trailingStop: false,
    trailingStopPositive: '0.01',
    trailingStopOffset: '0.02',
    trailingOnlyOffsetReached: true,
    stoplossOnExchange: true,
    blacklist: [],
  };
}
