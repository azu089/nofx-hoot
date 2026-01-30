'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, X, ArrowLeft, TrendingUp, Layers, Target, Settings, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface StrategyEditPageProps {
  strategyId?: string
  strategyName?: string
  initialConfig?: StrategyConfig
  onSave?: (config: StrategyConfig) => void
  onCancel?: () => void
}

interface StrategyConfig {
  // 基础设置
  exchange: string
  selectedCoins: string[]
  // 开仓设置
  openIndicator: string
  strategyDirection: 'long' | 'short' | 'both'
  enableDoubleOpen: boolean
  followTrend: boolean
  cycleType: 'single' | 'continuous' | 'infinite'
  cycleCount: number
  firstOrderAmount: number
  leverage: number
  // 补仓设置
  enableAddPosition: boolean
  addPositionIndicator: string
  addPositionCount: number
  enableWaterfallProtection: boolean
  waterfallProtectionRatio: number
  addPositionMultiplier: number
  addPositionPriceDropPercent: number
  // 盈亏设置
  takeProfitMethod: 'fixed' | 'trailing' | 'indicator'
  takeProfitPercent: number
  enableReverseTakeProfit: boolean
  reverseTakeProfitPercent: number
  enableStopLoss: boolean
  stopLossType: 'fixed' | 'trailing' | 'atr'
  stopLossPercent: number
  enableReverseStopLoss: boolean
  reverseStopLossPercent: number
  maxPositions: number
}

interface TradingPair {
  id: string
  symbol: string
  name: string
}

const exchanges = [
  { id: 'binance', name: 'Binance', status: 'connected', logo: '🟢' },
  { id: 'okx', name: 'OKX', status: 'disconnected', logo: '⚪' },
  { id: 'bybit', name: 'Bybit', status: 'disconnected', logo: '⚪' },
  { id: 'coinbase', name: 'Coinbase', status: 'disconnected', logo: '⚪' },
]

const availablePairs: TradingPair[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum' },
  { id: 'sol', symbol: 'SOL', name: 'Solana' },
  { id: 'bnb', symbol: 'BNB', name: 'BNB Chain' },
  { id: 'xrp', symbol: 'XRP', name: 'Ripple' },
  { id: 'ada', symbol: 'ADA', name: 'Cardano' },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'link', symbol: 'LINK', name: 'Chainlink' },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'matic', symbol: 'MATIC', name: 'Polygon' },
]

const openIndicators = [
  { id: 'macd', name: 'MACD金叉/死叉', desc: '经典趋势指标' },
  { id: 'rsi', name: 'RSI超买超卖', desc: '相对强弱指标' },
  { id: 'bollinger', name: '布林带突破', desc: '波动率指标' },
  { id: 'ema', name: 'EMA均线交叉', desc: '指数移动平均' },
  { id: 'volume', name: '成交量突破', desc: '量价配合' },
  { id: 'custom', name: '自定义条件', desc: '高级用户' },
]

const addPositionIndicators = [
  { id: 'price_drop', name: '价格下跌', desc: '按跌幅加仓' },
  { id: 'time_interval', name: '定时加仓', desc: '按时间间隔' },
  { id: 'indicator', name: '指标触发', desc: '技术指标' },
  { id: 'manual', name: '手动加仓', desc: '仅手动操作' },
]

// 切换开关组件 - 移到组件外部避免每次渲染重新创建
const Toggle = ({ enabled, onChange, title }: { enabled: boolean; onChange: (v: boolean) => void; title?: string }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    title={title || (enabled ? '点击关闭' : '点击开启')}
    className={cn(
      'relative w-11 h-6 rounded-full transition-colors',
      enabled ? 'bg-cyan-500' : 'bg-[#2A2A3A]'
    )}
  >
    <span
      className={cn(
        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
        enabled && 'translate-x-5'
      )}
    />
  </button>
)

export function StrategyEditPage({
  strategyName = '量化交易策略',
  initialConfig,
  onSave,
  onCancel,
}: StrategyEditPageProps) {
  // 基础设置
  const [selectedExchange, setSelectedExchange] = useState(initialConfig?.exchange || 'binance')
  const [isExchangeOpen, setIsExchangeOpen] = useState(false)
  const [selectedPairs, setSelectedPairs] = useState<string[]>(initialConfig?.selectedCoins || ['BTC', 'ETH'])

  // 开仓设置
  const [openIndicator, setOpenIndicator] = useState(initialConfig?.openIndicator || 'macd')
  const [strategyDirection, setStrategyDirection] = useState<'long' | 'short' | 'both'>(initialConfig?.strategyDirection || 'both')
  const [enableDoubleOpen, setEnableDoubleOpen] = useState(initialConfig?.enableDoubleOpen || false)
  const [followTrend, setFollowTrend] = useState<boolean>(initialConfig?.followTrend ?? true)
  const [cycleType, setCycleType] = useState<'single' | 'continuous' | 'infinite'>(initialConfig?.cycleType || 'continuous')
  const [cycleCount, setCycleCount] = useState(initialConfig?.cycleCount || 10)
  const [firstOrderAmount, setFirstOrderAmount] = useState(initialConfig?.firstOrderAmount || 100)
  const [leverage, setLeverage] = useState(initialConfig?.leverage || 5)

  // 补仓设置
  const [enableAddPosition, setEnableAddPosition] = useState(initialConfig?.enableAddPosition ?? true)
  const [addPositionIndicator, setAddPositionIndicator] = useState(initialConfig?.addPositionIndicator || 'price_drop')
  const [addPositionCount, setAddPositionCount] = useState(initialConfig?.addPositionCount || 5)
  const [enableWaterfallProtection, setEnableWaterfallProtection] = useState(initialConfig?.enableWaterfallProtection || false)
  const [waterfallProtectionRatio, setWaterfallProtectionRatio] = useState(initialConfig?.waterfallProtectionRatio || 15)
  const [addPositionMultiplier, setAddPositionMultiplier] = useState(initialConfig?.addPositionMultiplier || 1.5)
  const [addPositionPriceDropPercent, setAddPositionPriceDropPercent] = useState(initialConfig?.addPositionPriceDropPercent || 3)

  // 盈亏设置
  const [takeProfitMethod, setTakeProfitMethod] = useState<'fixed' | 'trailing' | 'indicator'>(initialConfig?.takeProfitMethod || 'fixed')
  const [takeProfitPercent, setTakeProfitPercent] = useState(initialConfig?.takeProfitPercent || 15)
  const [enableReverseTakeProfit, setEnableReverseTakeProfit] = useState(initialConfig?.enableReverseTakeProfit || false)
  const [reverseTakeProfitPercent, setReverseTakeProfitPercent] = useState(initialConfig?.reverseTakeProfitPercent || 5)
  const [enableStopLoss, setEnableStopLoss] = useState(initialConfig?.enableStopLoss ?? true)
  const [stopLossType, setStopLossType] = useState<'fixed' | 'trailing' | 'atr'>(initialConfig?.stopLossType || 'fixed')
  const [stopLossPercent, setStopLossPercent] = useState(initialConfig?.stopLossPercent || 10)
  const [enableReverseStopLoss, setEnableReverseStopLoss] = useState(initialConfig?.enableReverseStopLoss || false)
  const [reverseStopLossPercent, setReverseStopLossPercent] = useState(initialConfig?.reverseStopLossPercent || 3)
  const [maxPositions, setMaxPositions] = useState(initialConfig?.maxPositions || 3)

  // 展开/折叠状态
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    open: true,
    add: false,
    profit: false,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const togglePair = (symbol: string) => {
    setSelectedPairs((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    )
  }

  const removePair = (symbol: string) => {
    setSelectedPairs((prev) => prev.filter((s) => s !== symbol))
  }

  const handleSave = () => {
    onSave?.({
      exchange: selectedExchange,
      selectedCoins: selectedPairs,
      openIndicator,
      strategyDirection,
      enableDoubleOpen,
      followTrend,
      cycleType,
      cycleCount,
      firstOrderAmount,
      leverage,
      enableAddPosition,
      addPositionIndicator,
      addPositionCount,
      enableWaterfallProtection,
      waterfallProtectionRatio,
      addPositionMultiplier,
      addPositionPriceDropPercent,
      takeProfitMethod,
      takeProfitPercent,
      enableReverseTakeProfit,
      reverseTakeProfitPercent,
      enableStopLoss,
      stopLossType,
      stopLossPercent,
      enableReverseStopLoss,
      reverseStopLossPercent,
      maxPositions,
    })
  }

  const currentExchange = exchanges.find((e) => e.id === selectedExchange)

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0A0F]/80 border-b border-[#1E1E2E]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onCancel}
              title="返回"
              className="p-2 rounded-lg hover:bg-[#1E1E2E] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-[#F8F8FC]">
                策略配置
              </h1>
              <p className="text-sm text-[#9090A0]">{strategyName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        {/* 基础设置 */}
        <Card className="bg-[#12121A]/80 backdrop-blur-xl border-[#1E1E2E] shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="w-full p-6 flex items-center justify-between hover:bg-[#1E1E2E]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-[#F8F8FC]">基础设置</h2>
                  <p className="text-sm text-[#9090A0]">交易所、交易对选择</p>
                </div>
              </div>
              {expandedSections.basic ? (
                <ChevronUp className="w-5 h-5 text-[#9090A0]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#9090A0]" />
              )}
            </button>

            {expandedSections.basic && (
              <div className="px-6 pb-6 space-y-6 border-t border-[#1E1E2E]">
                <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Exchange Selector */}
                  <div>
                    <label className="block text-sm font-medium text-[#9090A0] mb-2">
                      交易所
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsExchangeOpen(!isExchangeOpen)}
                        className="w-full backdrop-blur-sm bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl px-4 py-3 text-left text-[#F8F8FC] hover:border-cyan-500/50 transition-all duration-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{currentExchange?.logo}</span>
                          <span>{currentExchange?.name}</span>
                        </div>
                        <ChevronDown
                          className={cn(
                            'w-5 h-5 text-[#9090A0] transition-transform',
                            isExchangeOpen && 'rotate-180'
                          )}
                        />
                      </button>

                      {isExchangeOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 backdrop-blur-xl bg-[#12121A] border border-[#2A2A3A] rounded-xl shadow-2xl z-20 overflow-hidden">
                          {exchanges.map((exchange) => (
                            <button
                              key={exchange.id}
                              type="button"
                              onClick={() => {
                                setSelectedExchange(exchange.id)
                                setIsExchangeOpen(false)
                              }}
                              className={cn(
                                'w-full px-4 py-3 text-left text-[#F8F8FC] hover:bg-[#1E1E2E] transition-colors flex items-center gap-3',
                                selectedExchange === exchange.id && 'bg-[#1E1E2E]'
                              )}
                            >
                              <span className="text-lg">{exchange.logo}</span>
                              <span>{exchange.name}</span>
                              {exchange.status === 'connected' && (
                                <span className="ml-auto text-xs text-cyan-400">已连接</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Max Positions */}
                  <div>
                    <label className="block text-sm font-medium text-[#9090A0] mb-2">
                      最大持仓数
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={maxPositions}
                        onChange={(e) => setMaxPositions(parseInt(e.target.value) || 0)}
                        className="pr-10 bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-12 focus:border-cyan-500"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#606070]">仓</span>
                    </div>
                  </div>
                </div>

                {/* Trading Pairs */}
                <div>
                  <label className="block text-sm font-medium text-[#9090A0] mb-3">
                    交易对选择 ({selectedPairs.length} 已选)
                  </label>
                  {selectedPairs.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedPairs.map((symbol) => (
                        <div
                          key={symbol}
                          className="backdrop-blur-sm bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 text-cyan-300"
                        >
                          <span className="font-medium text-sm">{symbol}/USDT</span>
                          <button
                            type="button"
                            onClick={() => removePair(symbol)}
                            title={`移除 ${symbol}`}
                            className="text-cyan-300 hover:text-white transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {availablePairs.map((pair) => {
                      const isSelected = selectedPairs.includes(pair.symbol)
                      return (
                        <button
                          key={pair.id}
                          type="button"
                          onClick={() => togglePair(pair.symbol)}
                          className={cn(
                            'backdrop-blur-sm border rounded-lg px-3 py-2 text-sm transition-all duration-200',
                            isSelected
                              ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                              : 'bg-[#0A0A0F] border-[#2A2A3A] text-[#9090A0] hover:border-[#3A3A4A] hover:text-[#F8F8FC]'
                          )}
                        >
                          {pair.symbol}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 开仓设置 */}
        <Card className="bg-[#12121A]/80 backdrop-blur-xl border-[#1E1E2E] shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => toggleSection('open')}
              className="w-full p-6 flex items-center justify-between hover:bg-[#1E1E2E]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-[#F8F8FC]">开仓设置</h2>
                  <p className="text-sm text-[#9090A0]">开仓指标、方向、杠杆</p>
                </div>
              </div>
              {expandedSections.open ? (
                <ChevronUp className="w-5 h-5 text-[#9090A0]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#9090A0]" />
              )}
            </button>

            {expandedSections.open && (
              <div className="px-6 pb-6 space-y-6 border-t border-[#1E1E2E]">
                {/* 开仓指标 */}
                <div className="pt-6">
                  <label className="block text-sm font-medium text-[#9090A0] mb-3">开仓指标</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {openIndicators.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => setOpenIndicator(ind.id)}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all',
                          openIndicator === ind.id
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-[#2A2A3A] bg-[#0A0A0F] hover:border-[#3A3A4A]'
                        )}
                      >
                        <div className="font-medium text-sm">{ind.name}</div>
                        <div className="text-xs text-[#606070]">{ind.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 策略方向 */}
                <div>
                  <label className="block text-sm font-medium text-[#9090A0] mb-3">策略方向</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'long', label: '仅做多', color: 'green' },
                      { id: 'short', label: '仅做空', color: 'red' },
                      { id: 'both', label: '双向', color: 'cyan' },
                    ].map((dir) => (
                      <button
                        key={dir.id}
                        type="button"
                        onClick={() => setStrategyDirection(dir.id as typeof strategyDirection)}
                        className={cn(
                          'flex-1 py-3 px-4 rounded-xl border font-medium transition-all',
                          strategyDirection === dir.id
                            ? dir.color === 'green'
                              ? 'border-green-500 bg-green-500/10 text-green-400'
                              : dir.color === 'red'
                              ? 'border-red-500 bg-red-500/10 text-red-400'
                              : 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                            : 'border-[#2A2A3A] bg-[#0A0A0F] text-[#9090A0] hover:border-[#3A3A4A]'
                        )}
                      >
                        {dir.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 数值设置 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#9090A0] mb-2">首单额度</label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={firstOrderAmount}
                        onChange={(e) => setFirstOrderAmount(parseFloat(e.target.value) || 0)}
                        className="pr-16 bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-11 focus:border-cyan-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-sm">USDT</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#9090A0] mb-2">杠杆倍数</label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={leverage}
                        onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
                        className="pr-8 bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-11 focus:border-cyan-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-sm">x</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#9090A0] mb-2">循环类型</label>
                    <select
                      value={cycleType}
                      onChange={(e) => setCycleType(e.target.value as typeof cycleType)}
                      title="选择循环类型"
                      className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 h-11 text-[#F8F8FC] focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="single">单次</option>
                      <option value="continuous">连续</option>
                      <option value="infinite">无限</option>
                    </select>
                  </div>
                  {cycleType === 'continuous' && (
                    <div>
                      <label className="block text-sm font-medium text-[#9090A0] mb-2">循环次数</label>
                      <Input
                        type="number"
                        value={cycleCount}
                        onChange={(e) => setCycleCount(parseInt(e.target.value) || 1)}
                        className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-11 focus:border-cyan-500"
                      />
                    </div>
                  )}
                </div>

                {/* 开关选项 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-xl border border-[#2A2A3A]">
                    <div>
                      <div className="font-medium text-sm">开仓加倍</div>
                      <div className="text-xs text-[#606070]">连续亏损后加倍开仓</div>
                    </div>
                    <Toggle enabled={enableDoubleOpen} onChange={setEnableDoubleOpen} />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-xl border border-[#2A2A3A]">
                    <div>
                      <div className="font-medium text-sm">顺势而为</div>
                      <div className="text-xs text-[#606070]">跟随大趋势方向</div>
                    </div>
                    <Toggle enabled={followTrend} onChange={setFollowTrend} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 补仓设置 */}
        <Card className="bg-[#12121A]/80 backdrop-blur-xl border-[#1E1E2E] shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => toggleSection('add')}
              className="w-full p-6 flex items-center justify-between hover:bg-[#1E1E2E]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                  <Layers className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-[#F8F8FC]">补仓设置</h2>
                  <p className="text-sm text-[#9090A0]">
                    {enableAddPosition ? `已启用 · ${addPositionCount}次 · ${addPositionMultiplier}x倍率` : '未启用'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Toggle enabled={enableAddPosition} onChange={setEnableAddPosition} />
                {expandedSections.add ? (
                  <ChevronUp className="w-5 h-5 text-[#9090A0]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#9090A0]" />
                )}
              </div>
            </button>

            {expandedSections.add && enableAddPosition && (
              <div className="px-6 pb-6 space-y-6 border-t border-[#1E1E2E]">
                {/* 补仓指标 */}
                <div className="pt-6">
                  <label className="block text-sm font-medium text-[#9090A0] mb-3">补仓触发条件</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {addPositionIndicators.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => setAddPositionIndicator(ind.id)}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all',
                          addPositionIndicator === ind.id
                            ? 'border-yellow-500 bg-yellow-500/10'
                            : 'border-[#2A2A3A] bg-[#0A0A0F] hover:border-[#3A3A4A]'
                        )}
                      >
                        <div className="font-medium text-sm">{ind.name}</div>
                        <div className="text-xs text-[#606070]">{ind.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 数值设置 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#9090A0] mb-2">补仓次数</label>
                    <Input
                      type="number"
                      value={addPositionCount}
                      onChange={(e) => setAddPositionCount(parseInt(e.target.value) || 1)}
                      className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-11 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#9090A0] mb-2">补仓倍率</label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={addPositionMultiplier}
                        onChange={(e) => setAddPositionMultiplier(parseFloat(e.target.value) || 1)}
                        className="pr-8 bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-11 focus:border-cyan-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-sm">x</span>
                    </div>
                  </div>
                  {addPositionIndicator === 'price_drop' && (
                    <div>
                      <label className="block text-sm font-medium text-[#9090A0] mb-2">跌幅触发</label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={addPositionPriceDropPercent}
                          onChange={(e) => setAddPositionPriceDropPercent(parseFloat(e.target.value) || 1)}
                          className="pr-8 bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-11 focus:border-cyan-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-sm">%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 防瀑布 */}
                <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-xl border border-[#2A2A3A]">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <div>
                      <div className="font-medium text-sm">防瀑布保护</div>
                      <div className="text-xs text-[#606070]">价格剧烈波动时暂停补仓</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {enableWaterfallProtection && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={waterfallProtectionRatio}
                          onChange={(e) => setWaterfallProtectionRatio(parseFloat(e.target.value) || 10)}
                          className="w-20 bg-[#1E1E2E] border-[#2A2A3A] text-[#F8F8FC] h-8 text-center"
                        />
                        <span className="text-[#606070] text-sm">%</span>
                      </div>
                    )}
                    <Toggle enabled={enableWaterfallProtection} onChange={setEnableWaterfallProtection} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 盈亏设置 */}
        <Card className="bg-[#12121A]/80 backdrop-blur-xl border-[#1E1E2E] shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => toggleSection('profit')}
              className="w-full p-6 flex items-center justify-between hover:bg-[#1E1E2E]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-[#F8F8FC]">盈亏设置</h2>
                  <p className="text-sm text-[#9090A0]">
                    止盈 {takeProfitPercent}% · {enableStopLoss ? `止损 ${stopLossPercent}%` : '止损关闭'}
                  </p>
                </div>
              </div>
              {expandedSections.profit ? (
                <ChevronUp className="w-5 h-5 text-[#9090A0]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#9090A0]" />
              )}
            </button>

            {expandedSections.profit && (
              <div className="px-6 pb-6 space-y-6 border-t border-[#1E1E2E]">
                {/* 止盈设置 */}
                <div className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <h3 className="font-semibold">止盈设置</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-[#9090A0] mb-2">止盈方式</label>
                      <select
                        value={takeProfitMethod}
                        onChange={(e) => setTakeProfitMethod(e.target.value as typeof takeProfitMethod)}
                        title="选择止盈方式"
                        className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 h-11 text-[#F8F8FC] focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="fixed">固定止盈</option>
                        <option value="trailing">移动止盈</option>
                        <option value="indicator">指标止盈</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#9090A0] mb-2">止盈比例</label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={takeProfitPercent}
                          onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value) || 0)}
                          className="pr-8 bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-11 focus:border-green-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070]">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-xl border border-[#2A2A3A]">
                    <div>
                      <div className="font-medium text-sm">反向止盈</div>
                      <div className="text-xs text-[#606070]">盈利回撤一定比例后平仓</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {enableReverseTakeProfit && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={reverseTakeProfitPercent}
                            onChange={(e) => setReverseTakeProfitPercent(parseFloat(e.target.value) || 0)}
                            className="w-20 bg-[#1E1E2E] border-[#2A2A3A] text-[#F8F8FC] h-8 text-center"
                          />
                          <span className="text-[#606070] text-sm">%</span>
                        </div>
                      )}
                      <Toggle enabled={enableReverseTakeProfit} onChange={setEnableReverseTakeProfit} />
                    </div>
                  </div>
                </div>

                {/* 止损设置 */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <h3 className="font-semibold">止损设置</h3>
                    </div>
                    <Toggle enabled={enableStopLoss} onChange={setEnableStopLoss} />
                  </div>

                  {enableStopLoss && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-[#9090A0] mb-2">止损类型</label>
                          <select
                            value={stopLossType}
                            onChange={(e) => setStopLossType(e.target.value as typeof stopLossType)}
                            title="选择止损类型"
                            className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 h-11 text-[#F8F8FC] focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="fixed">固定止损</option>
                            <option value="trailing">移动止损</option>
                            <option value="atr">ATR止损</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#9090A0] mb-2">止损比例</label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={stopLossPercent}
                              onChange={(e) => setStopLossPercent(parseFloat(e.target.value) || 0)}
                              className="pr-8 bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] h-11 focus:border-red-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070]">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-xl border border-[#2A2A3A]">
                        <div>
                          <div className="font-medium text-sm">反向止损</div>
                          <div className="text-xs text-[#606070]">亏损回本一定比例后平仓</div>
                        </div>
                        <div className="flex items-center gap-3">
                          {enableReverseStopLoss && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={reverseStopLossPercent}
                                onChange={(e) => setReverseStopLossPercent(parseFloat(e.target.value) || 0)}
                                className="w-20 bg-[#1E1E2E] border-[#2A2A3A] text-[#F8F8FC] h-8 text-center"
                              />
                              <span className="text-[#606070] text-sm">%</span>
                            </div>
                          )}
                          <Toggle enabled={enableReverseStopLoss} onChange={setEnableReverseStopLoss} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Action Buttons (Mobile) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-[#1E1E2E]">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 h-12 border-[#2A2A3A] text-[#F8F8FC] hover:bg-[#1E1E2E]"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 h-12 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-medium"
            >
              保存配置
            </Button>
          </div>
        </div>

        {/* Desktop Bottom Buttons */}
        <div className="hidden md:flex justify-end gap-4 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="px-6 h-11 border-[#2A2A3A] text-[#F8F8FC] hover:bg-[#1E1E2E]"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            className="px-6 h-11 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-medium shadow-lg shadow-cyan-500/25"
          >
            保存配置
          </Button>
        </div>

        {/* Spacer for mobile bottom bar */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  )
}
