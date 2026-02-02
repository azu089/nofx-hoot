'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/provider'

interface StrategyConfigModalProps {
  strategyName: string
  supportedCoins: string[]
  isOpen: boolean
  onClose: () => void
  onConfirm: (config: StrategyConfig) => void
}

interface StrategyConfig {
  exchange: string
  amountPerTrade: number
  selectedCoins: string[]
  stopLoss: number
  takeProfit: number
  maxPositions: number
}

const exchanges = [
  { id: 'binance', name: 'Binance', status: 'connected' },
  { id: 'okx', name: 'OKX', status: 'disconnected' },
  { id: 'bybit', name: 'Bybit', status: 'disconnected' },
]

export function StrategyConfigModal({
  strategyName,
  supportedCoins,
  isOpen,
  onClose,
  onConfirm,
}: StrategyConfigModalProps) {
  const t = useTranslations('modals')
  const [selectedExchange, setSelectedExchange] = useState('binance')
  const [amount, setAmount] = useState('100')
  const [selectedCoins, setSelectedCoins] = useState<string[]>(['BTC', 'ETH'])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [stopLoss, setStopLoss] = useState(5)
  const [takeProfit, setTakeProfit] = useState(10)
  const [maxPositions, setMaxPositions] = useState(5)

  const toggleCoin = (coin: string) => {
    setSelectedCoins((prev) =>
      prev.includes(coin)
        ? prev.filter((c) => c !== coin)
        : [...prev, coin]
    )
  }

  const handleConfirm = () => {
    onConfirm({
      exchange: selectedExchange,
      amountPerTrade: parseFloat(amount),
      selectedCoins,
      stopLoss,
      takeProfit,
      maxPositions,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 bg-[#12121A] border-[#1E1E2E] shadow-2xl">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[#F8F8FC]">
              {t('subscribe', { name: strategyName })}
            </h2>
            <button
              onClick={onClose}
              title={t('close')}
              className="text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="h-px bg-[#1E1E2E] -mx-6 mb-6" />

          {/* Step 1: Select Exchange */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-[#F8F8FC] mb-3">
              <span className="w-6 h-6 rounded-full bg-[#2A2A3A] flex items-center justify-center text-[#F8F8FC] text-xs">
                1
              </span>
              {t('selectExchange')}
            </label>
            <div className="relative">
              <select
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
                className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-4 py-3 text-[#F8F8FC] appearance-none focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {exchanges.map((exchange) => (
                  <option key={exchange.id} value={exchange.id}>
                    {exchange.status === 'connected' ? '🟢' : '⚪'} {exchange.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9090A0] pointer-events-none" />
            </div>
          </div>

          {/* Step 2: Set Amount */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-[#F8F8FC] mb-3">
              <span className="w-6 h-6 rounded-full bg-[#2A2A3A] flex items-center justify-center text-[#F8F8FC] text-xs">
                2
              </span>
              {t('setAmountPerTrade')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9090A0]">
                $
              </span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC] focus:border-cyan-500"
                placeholder="100"
              />
            </div>
            <p className="text-[#606070] text-xs mt-2">
              {t('amountSuggestion')}
            </p>
          </div>

          {/* Step 3: Select Coins */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-[#F8F8FC] mb-3">
              <span className="w-6 h-6 rounded-full bg-[#2A2A3A] flex items-center justify-center text-[#F8F8FC] text-xs">
                3
              </span>
              {t('selectTradingPairs')}
            </label>
            <div className="flex flex-wrap gap-2">
              {supportedCoins.map((coin) => (
                <button
                  key={coin}
                  onClick={() => toggleCoin(coin)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    selectedCoins.includes(coin)
                      ? "bg-[#1E1E2E] border border-[#06B6D4]/50 text-[#F8F8FC]"
                      : "bg-[#1E1E2E] border border-transparent text-[#9090A0] hover:text-[#F8F8FC] hover:border-[#2A2A3A]"
                  )}
                >
                  {selectedCoins.includes(coin) && '✓ '}
                  {coin}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full px-4 py-3 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            >
              <span className="text-sm">{t('advancedSettings')}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs">
                  {t('stopLoss')} {stopLoss}% · {t('takeProfit')} {takeProfit}% · {t('maxPositions', { count: maxPositions })}
                </span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9090A0]">{t('stopLossRatio')}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(parseInt(e.target.value) || 0)}
                      className="w-20 bg-[#12121A] border-[#2A2A3A] text-[#F8F8FC] text-center"
                    />
                    <span className="text-[#9090A0]">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9090A0]">{t('takeProfitRatio')}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(parseInt(e.target.value) || 0)}
                      className="w-20 bg-[#12121A] border-[#2A2A3A] text-[#F8F8FC] text-center"
                    />
                    <span className="text-[#9090A0]">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9090A0]">{t('maxPositionCount')}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={maxPositions}
                      onChange={(e) => setMaxPositions(parseInt(e.target.value) || 0)}
                      className="w-20 bg-[#12121A] border-[#2A2A3A] text-[#F8F8FC] text-center"
                    />
                    <span className="text-[#9090A0]">{t('positions')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-[#1E1E2E] -mx-6 mb-6" />

          {/* Incentive Text */}
          <div className="mb-6 flex items-center gap-2 text-sm text-[#9090A0]">
            <span className="text-lg">✨</span>
            <span>{t('subscribeReward')}</span>
          </div>

          {/* Confirm Button */}
          <Button
            onClick={handleConfirm}
            className="w-full bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F8F8FC] border border-[#2A2A3A] py-6 text-base font-medium"
          >
            {t('confirmSubscribe')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
