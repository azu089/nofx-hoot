'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronDown, ChevronUp, DollarSign, X, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StrategyConfig {
  exchange: string
  amountPerTrade: number
  selectedCoins: string[]
  stopLoss: number
  takeProfit: number
  maxPositions: number
}

interface MobileStrategyEditProps {
  strategyId?: string
  strategyName?: string
  initialConfig?: StrategyConfig
  onSave?: (config: StrategyConfig) => void
  onBack?: () => void
}

const exchanges = [
  { id: 'binance', name: 'Binance', connected: true },
  { id: 'okx', name: 'OKX', connected: false },
  { id: 'bybit', name: 'Bybit', connected: false },
  { id: 'coinbase', name: 'Coinbase', connected: false },
]

const tradingPairs = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'XRP', name: 'Ripple' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'LINK', name: 'Chainlink' },
]

export function MobileStrategyEdit({
  strategyId: _strategyId,
  strategyName = '量化交易策略',
  initialConfig,
  onSave,
  onBack,
}: MobileStrategyEditProps) {
  void _strategyId // 预留后续使用
  const [selectedExchange, setSelectedExchange] = useState(
    initialConfig?.exchange || 'binance'
  )
  const [showExchangeDropdown, setShowExchangeDropdown] = useState(false)
  const [amount, setAmount] = useState(
    initialConfig?.amountPerTrade?.toString() || '100'
  )
  const [selectedPairs, setSelectedPairs] = useState<string[]>(
    initialConfig?.selectedCoins || ['BTC', 'ETH']
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [stopLoss, setStopLoss] = useState(
    initialConfig?.stopLoss?.toString() || '5'
  )
  const [takeProfit, setTakeProfit] = useState(
    initialConfig?.takeProfit?.toString() || '15'
  )
  const [maxPositions, setMaxPositions] = useState(
    initialConfig?.maxPositions?.toString() || '3'
  )

  const togglePair = (symbol: string) => {
    setSelectedPairs((prev) =>
      prev.includes(symbol)
        ? prev.filter((p) => p !== symbol)
        : [...prev, symbol]
    )
  }

  const handleSave = () => {
    onSave?.({
      exchange: selectedExchange,
      amountPerTrade: parseFloat(amount) || 0,
      selectedCoins: selectedPairs,
      stopLoss: parseInt(stopLoss) || 0,
      takeProfit: parseInt(takeProfit) || 0,
      maxPositions: parseInt(maxPositions) || 0,
    })
  }

  const currentExchange = exchanges.find((e) => e.id === selectedExchange)

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F] [transform:translateZ(0)] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
            aria-label="返回"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold text-white">编辑策略</h1>
            <p className="text-xs text-[#606070]">{strategyName}</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="text-cyan-400 font-medium px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 transition-colors text-sm"
          >
            保存
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="pt-20 pb-28 px-4 space-y-5">
        {/* Exchange Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#9090A0]">交易所</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExchangeDropdown(!showExchangeDropdown)}
              className="w-full px-4 py-3.5 bg-[#12121A]/80 backdrop-blur-xl border border-[#2A2A3A] rounded-xl text-[#F8F8FC] text-left flex items-center justify-between active:bg-[#1E1E2E] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    currentExchange?.connected ? 'bg-green-400' : 'bg-[#606070]'
                  )}
                />
                <span>{currentExchange?.name}</span>
              </div>
              <ChevronDown
                className={cn(
                  'w-5 h-5 text-[#606070] transition-transform',
                  showExchangeDropdown && 'rotate-180'
                )}
              />
            </button>

            {showExchangeDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#12121A] backdrop-blur-xl border border-[#2A2A3A] rounded-xl overflow-hidden z-20 shadow-xl">
                {exchanges.map((exchange) => (
                  <button
                    type="button"
                    key={exchange.id}
                    onClick={() => {
                      setSelectedExchange(exchange.id)
                      setShowExchangeDropdown(false)
                    }}
                    className={cn(
                      'w-full px-4 py-3.5 text-left flex items-center gap-3 active:bg-[#1E1E2E] transition-colors',
                      selectedExchange === exchange.id && 'bg-[#1E1E2E]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        exchange.connected ? 'bg-green-400' : 'bg-[#606070]'
                      )}
                    />
                    <span className="text-[#F8F8FC]">{exchange.name}</span>
                    {exchange.connected && (
                      <span className="ml-auto text-xs text-cyan-400">已连接</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#9090A0]">每笔金额</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#606070]">
              <DollarSign className="w-5 h-5" />
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-11 pr-16 py-3.5 bg-[#12121A]/80 backdrop-blur-xl border border-[#2A2A3A] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500/50 transition-colors"
              placeholder="100"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#606070] text-sm">
              USDT
            </span>
          </div>
          <p className="text-xs text-[#606070]">建议 $50-500</p>
        </div>

        {/* Trading Pairs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#9090A0]">交易对</label>
            <span className="text-xs text-[#606070]">
              已选 {selectedPairs.length}
            </span>
          </div>

          {/* Selected Chips */}
          {selectedPairs.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {selectedPairs.map((symbol) => (
                <div
                  key={symbol}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-300 text-sm"
                >
                  <span>{symbol}</span>
                  <button
                    type="button"
                    onClick={() => togglePair(symbol)}
                    className="p-0.5 hover:bg-cyan-500/20 rounded-full transition-colors"
                    aria-label={`移除 ${symbol}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Available Pairs Grid */}
          <div className="grid grid-cols-4 gap-2">
            {tradingPairs.map((pair) => {
              const isSelected = selectedPairs.includes(pair.symbol)
              return (
                <button
                  type="button"
                  key={pair.symbol}
                  onClick={() => togglePair(pair.symbol)}
                  className={cn(
                    'py-2.5 px-2 rounded-xl text-center transition-all active:scale-95',
                    isSelected
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                      : 'bg-[#12121A]/80 border border-[#2A2A3A] text-[#9090A0] active:bg-[#1E1E2E]'
                  )}
                >
                  <div className="font-medium text-sm">{pair.symbol}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-[#12121A]/80 backdrop-blur-xl border border-[#2A2A3A] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-3.5 flex items-center justify-between active:bg-[#1E1E2E] transition-colors"
          >
            <div className="flex items-center gap-2 text-[#9090A0]">
              <Settings2 className="w-4 h-4" />
              <span className="text-sm font-medium">高级设置</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#606070]">
                {stopLoss}% / {takeProfit}% / {maxPositions}仓
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-[#606070]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#606070]" />
              )}
            </div>
          </button>

          {showAdvanced && (
            <div className="px-4 pb-4 space-y-4 border-t border-[#2A2A3A] pt-4">
              {/* Stop Loss */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#9090A0]">止损比例</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="w-20 px-3 py-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-[#F8F8FC] text-center text-sm focus:outline-none focus:border-red-500/50"
                  />
                  <span className="text-[#606070] text-sm">%</span>
                </div>
              </div>

              {/* Take Profit */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#9090A0]">止盈比例</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="w-20 px-3 py-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-[#F8F8FC] text-center text-sm focus:outline-none focus:border-green-500/50"
                  />
                  <span className="text-[#606070] text-sm">%</span>
                </div>
              </div>

              {/* Max Positions */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#9090A0]">最大持仓</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(e.target.value)}
                    className="w-20 px-3 py-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-[#F8F8FC] text-center text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                  <span className="text-[#606070] text-sm">仓</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="flex items-start gap-3 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
          <span className="text-lg">💡</span>
          <div className="text-sm text-[#9090A0]">
            <p>提示：合理设置止损止盈可以有效控制风险。</p>
            <p className="text-[#606070] mt-1">建议止损 3-5%，止盈 10-20%</p>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/95 to-transparent pt-8">
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-semibold rounded-xl shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all"
        >
          保存配置
        </button>
        <p className="text-center text-xs text-[#606070] mt-3">
          修改将在下一次交易时生效
        </p>
      </div>
    </div>
  )
}
