'use client'

import { useState, useCallback } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  Search,
  X,
  AlertTriangle,
  TrendingDown,
  Pause,
  LogOut,
  Settings,
  Shield,
  BarChart3
} from 'lucide-react'

interface MobileStrategyConfigProps {
  strategyName?: string
  onBack?: () => void
  onSave?: (config: StrategyConfigData) => void
  onCancel?: () => void
}

interface StrategyConfigData {
  riskTemplate: string
  exchange: string
  positionAmount: number
  tradingPairs: string[]
  direction: string
  maxPositions: number
  leverage: number
  takeProfit: number
  stopLoss: number
  isTrailingStop: boolean
  trailingActivation: number
  trailingCallback: number
  dcaEnabled: boolean
  dcaCount: number
  dcaTrigger: number
  dcaMultiplier: number
  waterfallProtection: boolean
  blackSwanProtection: boolean
  blackSwanType: string
  blackSwanTrigger: number
  blackSwanAction: string
  dailyMaxLoss: boolean
  dailyMaxLossPercent: number
}

// Toggle 组件
function Toggle({ enabled, onChange }: {
  enabled: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-label={enabled ? '关闭' : '开启'}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// 搜索的交易对
const availablePairs = [
  { symbol: 'BTC', name: 'Bitcoin', price: '$105,230' },
  { symbol: 'ETH', name: 'Ethereum', price: '$3,850' },
  { symbol: 'BNB', name: 'BNB', price: '$580' },
  { symbol: 'SOL', name: 'Solana', price: '$178' },
  { symbol: 'XRP', name: 'XRP', price: '$2.45' },
  { symbol: 'DOGE', name: 'Dogecoin', price: '$0.32' },
  { symbol: 'ADA', name: 'Cardano', price: '$0.85' },
  { symbol: 'AVAX', name: 'Avalanche', price: '$38' },
]

// 风险模板预设值
const riskPresets = {
  conservative: { takeProfit: 8, stopLoss: 5, leverage: 2, maxPositions: 2, dcaCount: 2, trailingActivation: 5, trailingCallback: 2 },
  balanced: { takeProfit: 15, stopLoss: 10, leverage: 5, maxPositions: 3, dcaCount: 3, trailingActivation: 8, trailingCallback: 3 },
  aggressive: { takeProfit: 30, stopLoss: 15, leverage: 10, maxPositions: 5, dcaCount: 5, trailingActivation: 12, trailingCallback: 5 },
}

export function MobileStrategyConfig({
  strategyName: _strategyName = 'MACD趋势跟踪策略',
  onBack,
  onSave,
  onCancel
}: MobileStrategyConfigProps) {
  void _strategyName // 策略名称，后续可显示在标题
  // 基础配置
  const [selectedExchange, setSelectedExchange] = useState('Binance')
  const [showExchangeDropdown, setShowExchangeDropdown] = useState(false)
  const [positionAmount, setPositionAmount] = useState('100')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC', 'ETH'])
  const [direction, setDirection] = useState<'long' | 'short' | 'both'>('both')

  // 风险模版
  const [selectedRisk, setSelectedRisk] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced')

  // 参数配置
  const [maxPositions, setMaxPositions] = useState('3')
  const [leverage, setLeverage] = useState('5')
  const [takeProfit, setTakeProfit] = useState(15)
  const [stopLoss, setStopLoss] = useState(10)
  const [isTrailingStop, setIsTrailingStop] = useState(false)
  const [trailingActivation, setTrailingActivation] = useState('8')
  const [trailingCallback, setTrailingCallback] = useState('3')

  // 补仓设置
  const [dcaEnabled, setDcaEnabled] = useState(true)
  const [dcaCount, setDcaCount] = useState('3')
  const [dcaTrigger, setDcaTrigger] = useState('5')
  const [dcaMultiplier, setDcaMultiplier] = useState('1.5')
  const [waterfallProtection, setWaterfallProtection] = useState(true)
  const [waterfallTrigger] = useState('15')

  // 风控保护
  const [blackSwanProtection, setBlackSwanProtection] = useState(false)
  const [blackSwanType] = useState<'coin_drop' | 'account_loss'>('account_loss')
  const [blackSwanTrigger, setBlackSwanTrigger] = useState('10')
  const [blackSwanAction, setBlackSwanAction] = useState<'close_all' | 'close_half' | 'pause'>('close_all')
  const [dailyMaxLoss, setDailyMaxLoss] = useState(false)
  const [dailyMaxLossPercent, setDailyMaxLossPercent] = useState('20')

  // 风险模板变化时更新参数
  const handleRiskChange = useCallback((risk: 'conservative' | 'balanced' | 'aggressive') => {
    setSelectedRisk(risk)
    const preset = riskPresets[risk]
    setTakeProfit(preset.takeProfit)
    setStopLoss(preset.stopLoss)
    setLeverage(String(preset.leverage))
    setMaxPositions(String(preset.maxPositions))
    setDcaCount(String(preset.dcaCount))
    setTrailingActivation(String(preset.trailingActivation))
    setTrailingCallback(String(preset.trailingCallback))
  }, [])

  const exchanges = [
    { id: 'Binance', name: 'Binance', connected: true },
    { id: 'OKX', name: 'OKX', connected: false },
    { id: 'Bybit', name: 'Bybit', connected: false },
  ]

  const quickAmounts = ['50', '100', '200', '500']

  const blackSwanActions = [
    { id: 'close_all', name: '全部平仓', icon: LogOut },
    { id: 'close_half', name: '减仓50%', icon: TrendingDown },
    { id: 'pause', name: '暂停开仓', icon: Pause },
  ]

  const removePair = (symbol: string) => {
    setSelectedPairs(prev => prev.filter(p => p !== symbol))
  }

  const addPair = (symbol: string) => {
    if (!selectedPairs.includes(symbol)) {
      setSelectedPairs(prev => [...prev, symbol])
    }
    setSearchQuery('')
  }

  const filteredPairs = availablePairs.filter(
    pair =>
      pair.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pair.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSave = () => {
    const config: StrategyConfigData = {
      riskTemplate: selectedRisk,
      exchange: selectedExchange,
      positionAmount: parseFloat(positionAmount),
      tradingPairs: selectedPairs,
      direction,
      maxPositions: parseInt(maxPositions),
      leverage: parseInt(leverage),
      takeProfit,
      stopLoss,
      isTrailingStop,
      trailingActivation: parseFloat(trailingActivation),
      trailingCallback: parseFloat(trailingCallback),
      dcaEnabled,
      dcaCount: parseInt(dcaCount),
      dcaTrigger: parseFloat(dcaTrigger),
      dcaMultiplier: parseFloat(dcaMultiplier),
      waterfallProtection,
      blackSwanProtection,
      blackSwanType,
      blackSwanTrigger: parseFloat(blackSwanTrigger),
      blackSwanAction,
      dailyMaxLoss,
      dailyMaxLossPercent: parseFloat(dailyMaxLossPercent),
    }
    onSave?.(config)
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0F] text-[#F8F8FC]">
      {/* 顶部导航栏 */}
      <div className="flex-shrink-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white">策略配置</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 pb-6 space-y-4">
          {/* 基础配置 */}
          <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-[#06B6D4]" />
              <h2 className="text-sm font-semibold text-[#9090A0]">基础配置</h2>
            </div>

            {/* 交易所 + 金额 */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* 交易所 */}
              <div>
                <label className="block text-xs text-[#606070] mb-1.5">交易所</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExchangeDropdown(!showExchangeDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                      <span>{selectedExchange}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showExchangeDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showExchangeDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg shadow-xl z-30 overflow-hidden">
                      {exchanges.map((exchange) => (
                        <button
                          type="button"
                          key={exchange.id}
                          onClick={() => {
                            setSelectedExchange(exchange.id)
                            setShowExchangeDropdown(false)
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#1E1E2E] transition-colors text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${exchange.connected ? 'bg-green-400' : 'bg-[#606070]'}`} />
                            <span>{exchange.name}</span>
                          </div>
                          {!exchange.connected && <span className="text-xs text-[#606070]">未连接</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 开仓金额 */}
              <div>
                <label className="block text-xs text-[#606070] mb-1.5">开仓金额</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606070] text-sm">$</span>
                  <input
                    type="text"
                    value={positionAmount}
                    onChange={(e) => setPositionAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 快捷金额 */}
            <div className="flex gap-2 mb-3">
              {quickAmounts.map((amount) => (
                <button
                  type="button"
                  key={amount}
                  onClick={() => setPositionAmount(amount)}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${
                    positionAmount === amount
                      ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30'
                      : 'bg-[#1E1E2E] text-[#9090A0]'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* 交易对 */}
            <div className="mb-3">
              <label className="block text-xs text-[#606070] mb-1.5">交易对</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none text-sm"
                  placeholder="搜索币种..."
                />
              </div>
              {selectedPairs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPairs.map((symbol) => (
                    <span
                      key={symbol}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/10 text-[#06B6D4] rounded text-xs"
                    >
                      {symbol}
                      <button type="button" onClick={() => removePair(symbol)} aria-label={`移除${symbol}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {searchQuery && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {filteredPairs.map((pair) => (
                    <button
                      type="button"
                      key={pair.symbol}
                      onClick={() => addPair(pair.symbol)}
                      disabled={selectedPairs.includes(pair.symbol)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        selectedPairs.includes(pair.symbol)
                          ? 'opacity-40'
                          : 'bg-[#0A0A0F] hover:bg-[#1E1E2E]'
                      }`}
                    >
                      <span>{pair.symbol} <span className="text-[#606070]">{pair.name}</span></span>
                      <span className="text-[#606070]">{pair.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 策略方向 */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#606070]">策略方向</label>
              <div className="flex bg-[#0A0A0F] rounded-lg p-0.5">
                {[
                  { id: 'long', name: '做多' },
                  { id: 'short', name: '做空' },
                  { id: 'both', name: '双向' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setDirection(item.id as typeof direction)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      direction === item.id
                        ? 'bg-[#06B6D4] text-black'
                        : 'text-[#9090A0]'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 风险偏好 */}
          <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#06B6D4]" />
                <label className="text-sm font-semibold text-[#9090A0]">风险偏好</label>
              </div>
              <div className="flex bg-[#0A0A0F] rounded-lg p-0.5">
                {[
                  { id: 'conservative', name: '保守' },
                  { id: 'balanced', name: '稳健' },
                  { id: 'aggressive', name: '进取' },
                ].map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => handleRiskChange(template.id as typeof selectedRisk)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      selectedRisk === template.id
                        ? 'bg-[#06B6D4] text-black'
                        : 'text-[#9090A0]'
                    }`}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 参数配置 */}
          <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#06B6D4]" />
              <h2 className="text-sm font-semibold text-[#9090A0]">参数配置</h2>
            </div>

            {/* 仓位 + 杠杆 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-[#606070] mb-1.5">最大持仓</label>
                <div className="relative">
                  <input
                    type="text"
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">仓</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#606070] mb-1.5">杠杆倍数</label>
                <div className="relative">
                  <input
                    type="text"
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">x</span>
                </div>
              </div>
            </div>

            {/* 止盈止损 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-[#F43F5E] mb-1.5">止损</label>
                <div className="relative">
                  <input
                    type="text"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#10B981] mb-1.5">止盈</label>
                <div className="relative">
                  <input
                    type="text"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">%</span>
                </div>
              </div>
            </div>

            {/* 移动止损 */}
            <div className="mb-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">移动止损</span>
                <Toggle enabled={isTrailingStop} onChange={setIsTrailingStop} />
              </div>
              {isTrailingStop && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs text-[#606070] mb-1.5">激活盈利</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={trailingActivation}
                        onChange={(e) => setTrailingActivation(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-1.5">回撤比例</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={trailingCallback}
                        onChange={(e) => setTrailingCallback(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 补仓设置 */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">补仓 (DCA)</span>
                <Toggle enabled={dcaEnabled} onChange={setDcaEnabled} />
              </div>
              {dcaEnabled && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="block text-xs text-[#606070] mb-1">次数</label>
                    <input
                      type="text"
                      value={dcaCount}
                      onChange={(e) => setDcaCount(e.target.value)}
                      className="w-full px-2 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-1">跌幅%</label>
                    <input
                      type="text"
                      value={dcaTrigger}
                      onChange={(e) => setDcaTrigger(e.target.value)}
                      className="w-full px-2 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-1">倍率</label>
                    <input
                      type="text"
                      value={dcaMultiplier}
                      onChange={(e) => setDcaMultiplier(e.target.value)}
                      className="w-full px-2 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 防瀑布 */}
            {dcaEnabled && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">防瀑布保护</span>
                  {waterfallProtection && (
                    <span className="text-xs text-[#606070]">跌幅&gt;{waterfallTrigger}%停止补仓</span>
                  )}
                </div>
                <Toggle enabled={waterfallProtection} onChange={setWaterfallProtection} />
              </div>
            )}
          </div>

          {/* 风控保护 */}
          <div className="bg-[#12121A]/80 backdrop-blur-sm border border-[#1E1E2E] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">🛡️</span>
              <h2 className="text-sm font-semibold text-[#9090A0]">风控保护</h2>
            </div>

            {/* 黑天鹅保护 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🦢</span>
                  <span className="text-sm font-medium">黑天鹅保护</span>
                </div>
                <Toggle enabled={blackSwanProtection} onChange={setBlackSwanProtection} />
              </div>

              {blackSwanProtection && (
                <div className="p-3 bg-[#0A0A0F]/50 rounded-xl space-y-3 mt-2">
                  {/* 触发条件 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[#606070]">当账户亏损达到</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={blackSwanTrigger}
                          onChange={(e) => setBlackSwanTrigger(e.target.value)}
                          className="w-12 px-2 py-1 bg-[#12121A] border border-[#1E1E2E] rounded text-sm text-center focus:border-[#06B6D4] focus:outline-none"
                        />
                        <span className="text-sm text-[#9090A0]">%</span>
                      </div>
                    </div>

                    {/* 杠杆换算提示 */}
                    <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-2">
                      <p className="text-[11px] text-yellow-400/80">
                        💡 {leverage}x 杠杆下，币种跌 {(parseFloat(blackSwanTrigger) / parseFloat(leverage || '1')).toFixed(1)}% 即触发保护
                      </p>
                    </div>

                    {/* 快捷阈值 */}
                    <div className="flex gap-2 mb-2">
                      {['5', '10', '15', '20'].map((val) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setBlackSwanTrigger(val)}
                          className={`flex-1 py-1 rounded text-xs transition-colors ${
                            blackSwanTrigger === val
                              ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                              : 'bg-[#1E1E2E] text-[#606070]'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 执行动作 */}
                  <div>
                    <label className="block text-xs text-[#606070] mb-2">触发后执行</label>
                    <div className="flex gap-2">
                      {blackSwanActions.map((action) => (
                        <button
                          type="button"
                          key={action.id}
                          onClick={() => setBlackSwanAction(action.id as typeof blackSwanAction)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                            blackSwanAction === action.id
                              ? 'bg-[#06B6D4] text-black'
                              : 'bg-[#1E1E2E] text-[#9090A0]'
                          }`}
                        >
                          <action.icon className="w-3.5 h-3.5" />
                          {action.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 单日最大亏损 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">📉</span>
                <span className="text-sm font-medium">单日最大亏损</span>
                {dailyMaxLoss && (
                  <span className="text-xs text-[#606070]">超过{dailyMaxLossPercent}%暂停</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {dailyMaxLoss && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={dailyMaxLossPercent}
                      onChange={(e) => setDailyMaxLossPercent(e.target.value)}
                      className="w-10 px-1.5 py-1 bg-[#0A0A0F] border border-[#1E1E2E] rounded text-xs text-center focus:border-[#06B6D4] focus:outline-none"
                    />
                    <span className="text-xs text-[#606070]">%</span>
                  </div>
                )}
                <Toggle enabled={dailyMaxLoss} onChange={setDailyMaxLoss} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部固定栏 - 在容器内部 */}
      <div className="flex-shrink-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-[#1E1E2E] p-4">
        {/* 摘要 */}
        <div className="flex items-center justify-center gap-4 mb-3 text-xs">
          <span className="text-[#606070]">
            {selectedRisk === 'conservative' ? '🛡️保守' : selectedRisk === 'balanced' ? '🔥稳健' : '🚀进取'}
          </span>
          <span className="text-[#10B981]">止盈{takeProfit}%</span>
          <span className="text-[#F43F5E]">止损{stopLoss}%</span>
          <span className="text-[#F8F8FC]">{leverage}x</span>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 border border-[#1E1E2E] rounded-xl font-medium text-[#9090A0]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] rounded-xl font-medium text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  )
}
