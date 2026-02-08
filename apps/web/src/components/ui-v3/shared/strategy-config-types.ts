'use client'

// API Key 数据结构
export interface ApiKeyData {
  id: string
  exchange: string
  label: string
  isActive: boolean
  createdAt: string
}

// 统一的策略配置数据结构（移动端/桌面端共用）
export interface StrategyConfigData {
  // API Key（必选）
  apiKeyId: string
  // 基础配置
  exchange: string
  tradingType: 'spot' | 'futures'
  tradingPairs: string[]  // 交易对列表
  positionAmount: number
  // 交易参数
  direction: 'long' | 'short' | 'both'
  leverage: number
  marginMode: 'cross' | 'isolated'
  maxPositions: number
  takeProfit: number
  stopLoss: number
  slippage: number
  // 移动止损
  trailingStopEnabled: boolean
  trailingActivation: number  // 激活盈利 %
  trailingCallback: number    // 回撤比例 %
  // 智能补仓 DCA
  dcaEnabled: boolean
  dcaCount: number           // 最大补仓次数
  dcaTrigger: number         // 触发跌幅 %
  dcaMultiplier: number      // 补仓倍率
  waterfallProtection: boolean  // 防瀑布
  waterfallTrigger: number      // 防瀑布触发 %
  // 风控保护
  blackSwanEnabled: boolean
  blackSwanTrigger: number   // 触发阈值 %
  blackSwanAction: 'close_all' | 'close_half' | 'pause'
  dailyLossEnabled: boolean
  dailyLossPercent: number   // 单日最大亏损 %
  dailyLossAction: 'close_all' | 'close_half' | 'pause'
}

// 交易所数据（ID 使用小写，与后端 API 一致）
export const exchanges = [
  { id: 'binance', name: 'Binance', connected: true, balance: 5000 },
  { id: 'okx', name: 'OKX', connected: false },
  { id: 'bybit', name: 'Bybit', connected: false },
]

// 交易所支持的全部交易对（模拟后端数据，key 使用小写与后端一致）
export const exchangePairs: Record<string, string[]> = {
  binance: [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
    'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'TRX/USDT', 'LINK/USDT',
    'DOT/USDT', 'MATIC/USDT', 'SHIB/USDT', 'LTC/USDT', 'BCH/USDT',
    'NEAR/USDT', 'UNI/USDT', 'APT/USDT', 'ICP/USDT', 'ETC/USDT',
    'FIL/USDT', 'ARB/USDT', 'OP/USDT', 'ATOM/USDT', 'IMX/USDT',
    'INJ/USDT', 'HBAR/USDT', 'VET/USDT', 'MKR/USDT', 'GRT/USDT',
    'PEPE/USDT', 'WIF/USDT', 'FLOKI/USDT', 'BONK/USDT',
    'FET/USDT', 'RNDR/USDT', 'AGIX/USDT', 'WLD/USDT',
    'STRK/USDT', 'MANTA/USDT',
  ],
  okx: [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT',
    'ADA/USDT', 'AVAX/USDT', 'LINK/USDT', 'DOT/USDT', 'MATIC/USDT',
    'LTC/USDT', 'UNI/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT',
    'PEPE/USDT', 'WIF/USDT', 'FET/USDT', 'WLD/USDT',
  ],
  bybit: [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT',
    'ADA/USDT', 'AVAX/USDT', 'LINK/USDT', 'DOT/USDT', 'MATIC/USDT',
    'LTC/USDT', 'ARB/USDT', 'OP/USDT', 'PEPE/USDT', 'WIF/USDT',
  ],
}

// 默认热门币种（显示在选择器中）
export const hotPairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT', 'PEPE/USDT']

// Top N 币种预设（按市值/交易量排序）
export const topPairsPresets = {
  10: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'TRX/USDT', 'LINK/USDT'],
  20: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'TRX/USDT', 'LINK/USDT', 'DOT/USDT', 'MATIC/USDT', 'SHIB/USDT', 'LTC/USDT', 'BCH/USDT', 'NEAR/USDT', 'UNI/USDT', 'APT/USDT', 'ICP/USDT', 'ETC/USDT'],
  30: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'TRX/USDT', 'LINK/USDT', 'DOT/USDT', 'MATIC/USDT', 'SHIB/USDT', 'LTC/USDT', 'BCH/USDT', 'NEAR/USDT', 'UNI/USDT', 'APT/USDT', 'ICP/USDT', 'ETC/USDT', 'FIL/USDT', 'ARB/USDT', 'OP/USDT', 'ATOM/USDT', 'IMX/USDT', 'INJ/USDT', 'HBAR/USDT', 'VET/USDT', 'MKR/USDT', 'GRT/USDT'],
  50: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'TRX/USDT', 'LINK/USDT', 'DOT/USDT', 'MATIC/USDT', 'SHIB/USDT', 'LTC/USDT', 'BCH/USDT', 'NEAR/USDT', 'UNI/USDT', 'APT/USDT', 'ICP/USDT', 'ETC/USDT', 'FIL/USDT', 'ARB/USDT', 'OP/USDT', 'ATOM/USDT', 'IMX/USDT', 'INJ/USDT', 'HBAR/USDT', 'VET/USDT', 'MKR/USDT', 'GRT/USDT', 'PEPE/USDT', 'WIF/USDT', 'FLOKI/USDT', 'BONK/USDT', 'FET/USDT', 'RNDR/USDT', 'AGIX/USDT', 'WLD/USDT', 'STRK/USDT', 'MANTA/USDT', 'SEI/USDT', 'SUI/USDT', 'TIA/USDT', 'JUP/USDT', 'PYTH/USDT', 'ORDI/USDT', 'STX/USDT', 'RUNE/USDT', 'AAVE/USDT', 'SNX/USDT'],
}

// 获取 Top N 币种（只返回交易所支持的）
export function getTopPairs(count: 10 | 20 | 30 | 50, availablePairs: string[]): string[] {
  const preset = topPairsPresets[count] || topPairsPresets[10]
  return preset.filter(pair => availablePairs.includes(pair))
}

// 获取交易所支持的币种（模拟 API 调用）
export async function fetchExchangePairs(exchangeId: string): Promise<string[]> {
  // TODO: 替换为真实 API 调用
  // const res = await fetch(`/api/exchanges/${exchangeId}/pairs`)
  // return res.json()
  await new Promise(r => setTimeout(r, 100)) // 模拟网络延迟
  return exchangePairs[exchangeId] || []
}

// 用户常用币种缓存
const RECENT_PAIRS_KEY = 'hoot_recent_pairs'
const MAX_RECENT = 5

export function getRecentPairs(): string[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(RECENT_PAIRS_KEY)
  return stored ? JSON.parse(stored) : []
}

export function addRecentPair(pair: string): void {
  if (typeof window === 'undefined') return
  const recent = getRecentPairs().filter(p => p !== pair)
  recent.unshift(pair)
  localStorage.setItem(RECENT_PAIRS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

// 默认配置（深度冻结以确保不可变性）
export const defaultConfig: Readonly<StrategyConfigData> = Object.freeze({
  apiKeyId: '', // 必须由用户选择
  exchange: 'binance',
  tradingType: 'futures',
  tradingPairs: Object.freeze(['BTC/USDT', 'ETH/USDT']),
  positionAmount: 100,
  direction: 'both',
  leverage: 5,
  marginMode: 'isolated',
  maxPositions: 3,
  takeProfit: 15,
  stopLoss: 10,
  slippage: 0.5,
  trailingStopEnabled: false,
  trailingActivation: 8,
  trailingCallback: 3,
  dcaEnabled: false,
  dcaCount: 3,
  dcaTrigger: 5,
  dcaMultiplier: 1.5,
  waterfallProtection: true,
  waterfallTrigger: 15,
  blackSwanEnabled: false,
  blackSwanTrigger: 10,
  blackSwanAction: 'close_all',
  dailyLossEnabled: false,
  dailyLossPercent: 20,
  dailyLossAction: 'close_all',
}) as StrategyConfigData
