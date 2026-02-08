'use client'

import { useState, useMemo } from 'react'
import { X, Shield, Zap, Flame, ChevronDown, ChevronUp, Info, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { useTranslations } from '@/i18n/provider'

interface StrategySubscribeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (config: SubscribeConfig) => void
  strategyName: string
  strategyDescription?: string
  expectedReturn?: { min: number; max: number }
  availableBalance?: number
  connectedExchanges?: Exchange[]
}

interface Exchange {
  id: string
  name: string
  icon?: string
  balance?: number
  status: 'active' | 'error'
}

interface SubscribeConfig {
  exchangeId: string
  amount: number
  riskLevel: 'conservative' | 'balanced' | 'aggressive'
  // 高级参数（由风险等级自动映射，也可手动调整）
  stopLoss: number
  takeProfit: number
  leverage: number
  maxPositions: number
}

// 风险等级预设配置
const riskPresetsConfig = {
  conservative: {
    icon: Shield,
    color: 'cyan',
    expectedReturn: '5-15%',
    stopLoss: 5,
    takeProfit: 10,
    leverage: 1,
    maxPositions: 2,
  },
  balanced: {
    icon: Zap,
    color: 'yellow',
    expectedReturn: '15-30%',
    stopLoss: 10,
    takeProfit: 20,
    leverage: 3,
    maxPositions: 3,
  },
  aggressive: {
    icon: Flame,
    color: 'orange',
    expectedReturn: '30-50%',
    stopLoss: 15,
    takeProfit: 35,
    leverage: 5,
    maxPositions: 5,
  },
}

// 默认交易所数据（实际使用时从props传入）
const defaultExchanges: Exchange[] = [
  { id: 'binance', name: 'Binance', icon: '/icons/exchanges/币安.webp', balance: 5000, status: 'active' },
]

export function StrategySubscribeModal({
  isOpen,
  onClose,
  onConfirm,
  strategyName,
  strategyDescription: _strategyDescription,
  availableBalance = 10000,
  connectedExchanges = defaultExchanges,
}: StrategySubscribeModalProps) {
  void _strategyDescription
  const t = useTranslations('modals')

  // Risk presets with translations
  const riskPresets = useMemo(() => ({
    conservative: {
      ...riskPresetsConfig.conservative,
      label: t('conservative'),
      description: t('conservativeDesc'),
    },
    balanced: {
      ...riskPresetsConfig.balanced,
      label: t('balanced'),
      description: t('balancedDesc'),
    },
    aggressive: {
      ...riskPresetsConfig.aggressive,
      label: t('aggressive'),
      description: t('aggressiveDesc'),
    },
  }), [t])

  // 核心配置状态
  const [selectedExchange, setSelectedExchange] = useState(connectedExchanges[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [riskLevel, setRiskLevel] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced')

  // 高级参数（默认跟随风险等级）
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customStopLoss, setCustomStopLoss] = useState<number | null>(null)
  const [customTakeProfit, setCustomTakeProfit] = useState<number | null>(null)
  const [customLeverage, setCustomLeverage] = useState<number | null>(null)
  const [customMaxPositions, setCustomMaxPositions] = useState<number | null>(null)

  // 交易所下拉
  const [showExchangeDropdown, setShowExchangeDropdown] = useState(false)

  // 当前选中的交易所
  const currentExchange = connectedExchanges.find(e => e.id === selectedExchange)

  // 当前风险配置（优先使用自定义值）
  const currentConfig = useMemo(() => {
    const preset = riskPresets[riskLevel]
    return {
      stopLoss: customStopLoss ?? preset.stopLoss,
      takeProfit: customTakeProfit ?? preset.takeProfit,
      leverage: customLeverage ?? preset.leverage,
      maxPositions: customMaxPositions ?? preset.maxPositions,
    }
  }, [riskLevel, customStopLoss, customTakeProfit, customLeverage, customMaxPositions, riskPresets])

  // 预估收益计算
  const estimatedReturn = useMemo(() => {
    const amountNum = parseFloat(amount) || 0
    if (amountNum <= 0) return null
    const preset = riskPresets[riskLevel]
    const [minPercent, maxPercent] = preset.expectedReturn.replace('%', '').split('-').map(Number)
    return {
      min: (amountNum * minPercent / 100).toFixed(2),
      max: (amountNum * maxPercent / 100).toFixed(2),
      period: '月',
    }
  }, [amount, riskLevel, riskPresets])

  // 验证
  const amountNum = parseFloat(amount) || 0
  const isValid = selectedExchange && amountNum >= 50 && amountNum <= (currentExchange?.balance || availableBalance)

  // 快捷金额按钮
  const quickAmounts = [100, 500, 1000, 'MAX']

  const handleQuickAmount = (val: number | 'MAX') => {
    if (val === 'MAX') {
      setAmount(String(currentExchange?.balance || availableBalance))
    } else {
      setAmount(String(val))
    }
  }

  // 切换风险等级时重置自定义参数
  const handleRiskLevelChange = (level: typeof riskLevel) => {
    setRiskLevel(level)
    setCustomStopLoss(null)
    setCustomTakeProfit(null)
    setCustomLeverage(null)
    setCustomMaxPositions(null)
  }

  const handleConfirm = () => {
    onConfirm({
      exchangeId: selectedExchange,
      amount: amountNum,
      riskLevel,
      ...currentConfig,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-[#12121A] border border-[#1E1E2E] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#1E1E2E]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#F8F8FC]">{t('subscribeStrategy')}</h2>
              <p className="text-sm text-[#9090A0] mt-1">{strategyName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#1E1E2E] transition-colors"
            >
              <X className="w-5 h-5 text-[#9090A0]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1: 选择交易所 */}
          <div>
            <label className="block text-sm font-medium text-[#9090A0] mb-2">
              {t('selectExchange')}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExchangeDropdown(!showExchangeDropdown)}
                className="w-full flex items-center justify-between p-3 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl hover:border-[#3A3A4A] transition-colors"
              >
                {currentExchange ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1E1E2E] flex items-center justify-center overflow-hidden relative">
                      {currentExchange.icon ? (
                        <Image src={currentExchange.icon} alt={currentExchange.name} fill className="object-contain" />
                      ) : (
                        <span className="text-sm font-bold">{currentExchange.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-[#F8F8FC]">{currentExchange.name}</div>
                      <div className="text-xs text-[#9090A0]">
                        {t('available')} ${currentExchange.balance?.toLocaleString() || '0'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-[#606070]">{t('pleaseSelectExchange')}</span>
                )}
                <ChevronDown className={cn(
                  "w-5 h-5 text-[#9090A0] transition-transform",
                  showExchangeDropdown && "rotate-180"
                )} />
              </button>

              {showExchangeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#12121A] border border-[#2A2A3A] rounded-xl shadow-xl z-20 overflow-hidden">
                  {connectedExchanges.length === 0 ? (
                    <div className="p-4 text-center text-[#9090A0] text-sm">
                      {t('noConnectedExchanges')}
                    </div>
                  ) : (
                    connectedExchanges.map((exchange) => (
                      <button
                        key={exchange.id}
                        type="button"
                        onClick={() => {
                          setSelectedExchange(exchange.id)
                          setShowExchangeDropdown(false)
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 hover:bg-[#1E1E2E] transition-colors",
                          selectedExchange === exchange.id && "bg-[#1E1E2E]"
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#0A0A0F] flex items-center justify-center overflow-hidden relative">
                          {exchange.icon ? (
                            <Image src={exchange.icon} alt={exchange.name} fill className="object-contain" />
                          ) : (
                            <span className="text-sm font-bold">{exchange.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-[#F8F8FC]">{exchange.name}</div>
                          <div className="text-xs text-[#9090A0]">${exchange.balance?.toLocaleString()}</div>
                        </div>
                        {exchange.status === 'active' && (
                          <span className="w-2 h-2 rounded-full bg-green-400" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: 投入金额 */}
          <div>
            <label className="block text-sm font-medium text-[#9090A0] mb-2">
              {t('investAmount')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#606070] font-medium">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('minAmount')}
                className="w-full pl-8 pr-4 py-3 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:border-[#06B6D4] focus:outline-none transition-colors"
              />
            </div>
            {/* 快捷金额 */}
            <div className="flex gap-2 mt-2">
              {quickAmounts.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val as number | 'MAX')}
                  className="flex-1 py-1.5 text-xs font-medium text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
                >
                  {val === 'MAX' ? t('all') : `$${val}`}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: 风险偏好 */}
          <div>
            <label className="block text-sm font-medium text-[#9090A0] mb-2">
              {t('riskPreference')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(riskPresets) as [keyof typeof riskPresets, typeof riskPresets.conservative][]).map(([key, preset]) => {
                const Icon = preset.icon
                const isSelected = riskLevel === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleRiskLevelChange(key)}
                    className={cn(
                      "relative p-3 rounded-xl border-2 transition-all text-center",
                      isSelected
                        ? preset.color === 'cyan'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : preset.color === 'yellow'
                          ? 'border-yellow-500 bg-yellow-500/10'
                          : 'border-orange-500 bg-orange-500/10'
                        : 'border-[#2A2A3A] bg-[#0A0A0F] hover:border-[#3A3A4A]'
                    )}
                  >
                    <Icon className={cn(
                      "w-5 h-5 mx-auto mb-1",
                      isSelected
                        ? preset.color === 'cyan'
                          ? 'text-cyan-400'
                          : preset.color === 'yellow'
                          ? 'text-yellow-400'
                          : 'text-orange-400'
                        : 'text-[#606070]'
                    )} />
                    <div className={cn(
                      "font-medium text-sm",
                      isSelected ? 'text-[#F8F8FC]' : 'text-[#9090A0]'
                    )}>
                      {preset.label}
                    </div>
                    <div className={cn(
                      "text-xs mt-0.5",
                      isSelected
                        ? preset.color === 'cyan'
                          ? 'text-cyan-400'
                          : preset.color === 'yellow'
                          ? 'text-yellow-400'
                          : 'text-orange-400'
                        : 'text-[#606070]'
                    )}>
                      {preset.expectedReturn}{t('perMonth')}
                    </div>
                    {key === 'balanced' && (
                      <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-medium bg-[#06B6D4] text-white rounded">
                        {t('recommended')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {/* 当前风险等级说明 */}
            <div className="flex items-center gap-2 mt-2 p-2 bg-[#1E1E2E]/50 rounded-lg">
              <Info className="w-4 h-4 text-[#606070] flex-shrink-0" />
              <span className="text-xs text-[#9090A0]">
                {riskPresets[riskLevel].description}
              </span>
            </div>
          </div>

          {/* 预估收益卡片 */}
          {estimatedReturn && (
            <div className="p-4 bg-gradient-to-r from-[#06B6D4]/10 to-[#10B981]/10 border border-[#06B6D4]/20 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#10B981]" />
                  <span className="text-sm text-[#9090A0]">{t('estimatedMonthlyReturn')}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-[#10B981]">
                    ${estimatedReturn.min} ~ ${estimatedReturn.max}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2A2A3A]">
                <span className="text-xs text-[#606070]">{t('stopLossProtection')}</span>
                <span className="text-xs text-[#F43F5E]">-{currentConfig.stopLoss}%</span>
              </div>
            </div>
          )}

          {/* 高级参数（可选） */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('advancedParams')}
              <span className="text-xs text-[#606070]">{t('optional')}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9090A0]">{t('stopLossRatio')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={customStopLoss ?? currentConfig.stopLoss}
                      onChange={(e) => setCustomStopLoss(parseFloat(e.target.value) || null)}
                      className="w-16 px-2 py-1 bg-[#1E1E2E] border border-[#2A2A3A] rounded text-center text-[#F8F8FC] text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                    <span className="text-[#606070] text-sm">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9090A0]">{t('takeProfitRatio')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={customTakeProfit ?? currentConfig.takeProfit}
                      onChange={(e) => setCustomTakeProfit(parseFloat(e.target.value) || null)}
                      className="w-16 px-2 py-1 bg-[#1E1E2E] border border-[#2A2A3A] rounded text-center text-[#F8F8FC] text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                    <span className="text-[#606070] text-sm">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9090A0]">{t('leverageMultiplier')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={customLeverage ?? currentConfig.leverage}
                      onChange={(e) => setCustomLeverage(parseInt(e.target.value) || null)}
                      className="w-16 px-2 py-1 bg-[#1E1E2E] border border-[#2A2A3A] rounded text-center text-[#F8F8FC] text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                    <span className="text-[#606070] text-sm">x</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9090A0]">{t('maxPosition')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={customMaxPositions ?? currentConfig.maxPositions}
                      onChange={(e) => setCustomMaxPositions(parseInt(e.target.value) || null)}
                      className="w-16 px-2 py-1 bg-[#1E1E2E] border border-[#2A2A3A] rounded text-center text-[#F8F8FC] text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                    <span className="text-[#606070] text-sm">{t('positions')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1E1E2E]">
          {/* 风险提示 */}
          <div className="flex items-start gap-2 mb-4 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <span className="text-xs text-[#F59E0B]">
              {t('riskWarning')}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid}
            className={cn(
              "w-full py-3 rounded-xl font-medium transition-all",
              isValid
                ? "bg-[#06B6D4] hover:bg-[#0891B2] text-white shadow-lg shadow-[#06B6D4]/20"
                : "bg-[#2A2A3A] text-[#606070] cursor-not-allowed"
            )}
          >
            {!selectedExchange
              ? t('pleaseSelectExchange')
              : amountNum < 50
              ? t('minInvestAmount')
              : amountNum > (currentExchange?.balance || availableBalance)
              ? t('insufficientBalance')
              : t('confirmSubscribe')
            }
          </button>
        </div>
      </div>
    </div>
  )
}
