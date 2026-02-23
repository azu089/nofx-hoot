'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  Scale,
  Flame,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCreateStrategy, useStrategyControl } from '@/hooks/useAi'
import type { CreateStrategyBody } from '@/types/ai'
import { PillGroup } from '@/components/ui-v3/ai/pill-group'
import { NumberStepper } from '@/components/ui-v3/ai/number-stepper'
import { MODEL_DISPLAY, DEFAULT_DEBATE_MODELS } from '@/constants/debate'

type CoinSource = 'manual' | 'ai' | 'oi_top'
type StrategyStyle = 'conservative' | 'balanced' | 'aggressive'
type StrategyMode = 'solo' | 'debate' | 'research' | 'grid'
type Interval = '3m' | '5m' | '15m' | '30m' | '60m' | '4h' | '24h'

interface FormData {
  strategyName: string
  coinSource: CoinSource
  selectedCoins: string[]
  strategyStyle: StrategyStyle
  customParams: {
    maxLeverage: number
    maxPosition: number
    minConfidence: number
    minRR: number
    minPositionSize: number
    fundPool: number
    maxPerTrade: number
    dailyDrawdown: number
    mainTimeframe: string
    auxTimeframe: string
  }
  strategyMode: StrategyMode
  interval: Interval
}

const COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ARB', 'OP']

/** 按策略性质提供不同间隔选项 */
const STRATEGY_INTERVALS: Record<StrategyMode, Interval[]> = {
  research: ['15m', '30m', '60m', '4h'],
  solo:     ['3m', '5m', '15m', '30m', '60m'],
  debate:   ['5m', '15m', '30m', '60m'],
  grid:     ['3m', '5m', '15m', '30m'],
}
const STRATEGY_DEFAULT_INTERVAL: Record<StrategyMode, Interval> = {
  research: '30m',
  solo:     '3m',
  debate:   '5m',
  grid:     '3m',
}

const STRATEGY_PRESET_PARAMS = {
  conservative: {
    icon: Shield,
    leverage: '1-3x',
    position: '≤30%',
    confidence: '≥80%',
    rr: '≥3:1',
    perTrade: '5-10%',
    drawdown: '5%',
    params: {
      maxLeverage: 3,
      maxPosition: 30,
      minConfidence: 80,
      minRR: 3,
      minPositionSize: 5,
      fundPool: 10000,
      maxPerTrade: 10,
      dailyDrawdown: 5,
      mainTimeframe: '4h',
      auxTimeframe: '1h',
    },
  },
  balanced: {
    icon: Scale,
    leverage: '3-5x',
    position: '≤50%',
    confidence: '≥70%',
    rr: '≥2:1',
    perTrade: '10-20%',
    drawdown: '10%',
    params: {
      maxLeverage: 5,
      maxPosition: 50,
      minConfidence: 70,
      minRR: 2,
      minPositionSize: 10,
      fundPool: 10000,
      maxPerTrade: 20,
      dailyDrawdown: 10,
      mainTimeframe: '1h',
      auxTimeframe: '15m',
    },
  },
  aggressive: {
    icon: Flame,
    leverage: '5-10x',
    position: '≤70%',
    confidence: '≥60%',
    rr: '≥1.5:1',
    perTrade: '20-30%',
    drawdown: '15%',
    params: {
      maxLeverage: 10,
      maxPosition: 70,
      minConfidence: 60,
      minRR: 1.5,
      minPositionSize: 20,
      fundPool: 10000,
      maxPerTrade: 30,
      dailyDrawdown: 15,
      mainTimeframe: '15m',
      auxTimeframe: '5m',
    },
  },
}

export function CreateStrategyWizard() {
  const router = useRouter()
  const t = useTranslations('ai')
  const createStrategy = useCreateStrategy()
  const strategyControl = useStrategyControl()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [showCustomParams, setShowCustomParams] = useState(false)
  const [debateModels, setDebateModels] = useState([...DEFAULT_DEBATE_MODELS])
  const [showModelListDropdown, setShowModelListDropdown] = useState(false)
  const modelListRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState<FormData>({
    strategyName: '',
    coinSource: 'manual',
    selectedCoins: [],
    strategyStyle: 'balanced',
    customParams: STRATEGY_PRESET_PARAMS.balanced.params,
    strategyMode: 'solo',
    interval: STRATEGY_DEFAULT_INTERVAL.solo,
  })

  // 中文标签映射（依赖 t，放在组件内）
  const COIN_SOURCE_LABELS: Record<CoinSource, string> = {
    manual: t('wizard.coinManual'),
    ai: t('wizard.coinAI'),
    oi_top: t('wizard.coinOI'),
  }

  const STRATEGY_STYLE_LABELS: Record<StrategyStyle, string> = {
    conservative: t('wizard.styleConservative'),
    balanced: t('wizard.styleBalanced'),
    aggressive: t('wizard.styleAggressive'),
  }

  const STRATEGY_MODE_LABELS: Record<StrategyMode, string> = {
    solo: t('modes.solo'),
    debate: t('modes.debate'),
    research: t('modes.research'),
    grid: t('modes.grid'),
  }

  // 策略预设（audience 字段依赖 t）
  const STRATEGY_PRESETS = {
    conservative: {
      ...STRATEGY_PRESET_PARAMS.conservative,
      audience: t('wizard.audienceConservative'),
    },
    balanced: {
      ...STRATEGY_PRESET_PARAMS.balanced,
      audience: t('wizard.audienceBalanced'),
    },
    aggressive: {
      ...STRATEGY_PRESET_PARAMS.aggressive,
      audience: t('wizard.audienceAggressive'),
    },
  }

  const handleCoinToggle = (coin: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCoins: prev.selectedCoins.includes(coin)
        ? prev.selectedCoins.filter((c) => c !== coin)
        : [...prev.selectedCoins, coin],
    }))
  }

  const handleStyleChange = (style: StrategyStyle) => {
    setFormData((prev) => ({
      ...prev,
      strategyStyle: style,
      customParams: STRATEGY_PRESET_PARAMS[style].params,
    }))
  }

  const handleModelToggle = (modelId: string) => {
    setDebateModels((prev) => {
      const next = prev.includes(modelId)
        ? prev.filter((m) => m !== modelId)
        : [...prev, modelId]
      if (next.length < 2 || next.length > 5) return prev
      return next
    })
  }

  // Click-outside 关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelListRef.current && !modelListRef.current.contains(e.target as Node)) setShowModelListDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1)
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async (saveOnly: boolean) => {
    try {
      setIsSubmitting(true)

      // 辅助函数：将间隔转换为分钟
      const intervalToMinutes = (interval: string): number => {
        const map: Record<string, number> = {
          '3m': 3,
          '5m': 5,
          '15m': 15,
          '30m': 30,
          '60m': 60,
          '4h': 240,
          '24h': 1440,
        }
        return map[interval] || 60
      }

      // 映射币种来源
      const coinSourceModeMap: Record<CoinSource, string> = {
        manual: 'static',
        ai: 'ai',
        oi_top: 'oi_top',
      }

      // 构建币种列表（期货格式）
      const coins = formData.selectedCoins.map((c) => `${c}/USDT:USDT`)

      // 从 strategyMode 派生 API 字段
      const isGrid = formData.strategyMode === 'grid'
      const isDebate = formData.strategyMode === 'debate'

      // 构建请求体
      const body = {
        name: formData.strategyName,
        strategyType: isGrid ? 'grid' : 'normal',
        tradingMode: isDebate ? 'debate' : 'solo',
        coinSourceConfig: {
          mode: coinSourceModeMap[formData.coinSource],
          coins: coins,
          ...(isDebate ? { models: debateModels } : {}),
        },
        indicatorConfig: {
          timeframe: formData.customParams.mainTimeframe,
          secondaryTimeframe: formData.customParams.auxTimeframe,
          indicators: [],
        },
        riskControlConfig: {
          maxPositions: 3,
          minPositionSize: formData.customParams.minPositionSize,
          maxLeverage: formData.customParams.maxLeverage,
          maxPositionPercent: formData.customParams.maxPosition,
          minConfidence: formData.customParams.minConfidence,
          minRiskRewardRatio: formData.customParams.minRR,
          amountPerTrade:
            formData.customParams.fundPool *
            (formData.customParams.maxPerTrade / 100),
          maxDailyDrawdown:
            formData.customParams.fundPool *
            (formData.customParams.dailyDrawdown / 100),
        },
        intervalMinutes: intervalToMinutes(formData.interval),
      }

      // 创建策略
      const result = await createStrategy.mutateAsync(body as CreateStrategyBody)

      // 如果不是仅保存，且策略创建成功，则启动策略
      if (!saveOnly && result.strategy?.id) {
        await strategyControl.mutateAsync({
          id: result.strategy.id,
          action: 'start',
        })
      }

      // 导航到策略详情页
      router.push(`/ai-trading/${result.strategy.id}`)
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.error('创建策略失败:', error)
      }
      // TODO: 可以在这里添加错误提示 toast
      alert(`${t('wizard.createFailed')}: ${error instanceof Error ? error.message : t('wizard.unknownError')}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-[#0A0A0F] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 -ml-2 hover:bg-[#12121A] rounded-lg transition-colors"
            aria-label={t('wizard.prevStep')}
            title={t('wizard.prevStep')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-base font-semibold">{t('wizard.pageTitle')}</h1>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step <= currentStep ? 'bg-[#06B6D4]' : 'bg-[#1E1E2E]'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* 表单内容 */}
      <main className="pb-24">
        {/* Step 1: 基本信息+币种 */}
        {currentStep === 1 && (
          <div className="p-4 space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="strategy-name"
                className="block text-sm text-[#94A3B8]"
              >
                {t('wizard.strategyName')}
              </label>
              <input
                id="strategy-name"
                type="text"
                placeholder={t('wizard.namePlaceholder')}
                value={formData.strategyName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    strategyName: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#06B6D4] transition-colors"
                aria-label={t('wizard.strategyName')}
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">{t('wizard.coinSource')}</label>
              <div className="flex gap-2">
                {(['manual', 'ai', 'oi_top'] as CoinSource[]).map(
                  (source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, coinSource: source }))
                      }
                      className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        formData.coinSource === source
                          ? 'bg-[#06B6D4] text-white'
                          : 'bg-[#12121A] text-[#94A3B8] hover:bg-[#1A1A24]'
                      }`}
                      aria-label={COIN_SOURCE_LABELS[source]}
                      title={COIN_SOURCE_LABELS[source]}
                    >
                      {COIN_SOURCE_LABELS[source]}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">{t('wizard.selectCoins')}</label>
              <div className="grid grid-cols-4 gap-2">
                {COINS.map((coin) => (
                  <button
                    key={coin}
                    type="button"
                    onClick={() => handleCoinToggle(coin)}
                    className={`aspect-square rounded-lg text-sm font-semibold transition-all ${
                      formData.selectedCoins.includes(coin)
                        ? 'bg-[#06B6D4]/10 border-2 border-[#06B6D4] text-[#06B6D4]'
                        : 'bg-[#12121A] border border-[#1E1E2E] text-[#94A3B8] hover:border-[#06B6D4]/50'
                    }`}
                    aria-label={coin}
                    title={coin}
                  >
                    {coin}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[#64748B]">
                {t('wizard.selectedCount', { count: formData.selectedCoins.length })}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: 策略预设 */}
        {currentStep === 2 && (
          <div className="p-4 space-y-6">
            <h2 className="text-lg font-semibold">{t('wizard.selectStyle')}</h2>

            <div className="space-y-3">
              {(Object.keys(STRATEGY_PRESETS) as StrategyStyle[]).map(
                (style) => {
                  const preset = STRATEGY_PRESETS[style]
                  const Icon = preset.icon
                  const isSelected = formData.strategyStyle === style

                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => handleStyleChange(style)}
                      className={`w-full p-4 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-[#12121A] border-2 border-[#06B6D4]'
                          : 'bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                      }`}
                      aria-label={STRATEGY_STYLE_LABELS[style]}
                      title={STRATEGY_STYLE_LABELS[style]}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-[#06B6D4]" />
                          <span className="font-semibold">{STRATEGY_STYLE_LABELS[style]}</span>
                        </div>
                        {style === 'balanced' && (
                          <span className="px-2 py-0.5 bg-[#06B6D4] text-xs rounded-full">
                            {t('wizard.recommended')}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#94A3B8]">
                        <div>{t('wizard.leverageLimit')}: {preset.leverage}</div>
                        <div>{t('wizard.positionLimit')}: {preset.position}</div>
                        <div>{t('wizard.confidenceLabel')}: {preset.confidence}</div>
                        <div>{t('wizard.rrLabel')}: {preset.rr}</div>
                        <div>{t('wizard.perTradeLabel')}: {preset.perTrade}</div>
                        <div>{t('wizard.drawdownLabel')}: {preset.drawdown}</div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#1E1E2E] text-xs text-[#64748B]">
                        {t('wizard.suitableFor')}: {preset.audience}
                      </div>
                    </button>
                  )
                }
              )}
            </div>

            {/* 自定义参数 */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCustomParams(!showCustomParams)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1A1A24] transition-colors"
                aria-label={t('wizard.customParams')}
                title={t('wizard.customParams')}
              >
                <span className="text-sm font-medium">{t('wizard.customParams')}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showCustomParams ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showCustomParams && (
                <div className="px-4 pb-4 space-y-4">
                  <PillGroup
                    label={t('wizard.maxLeverage')}
                    value={formData.customParams.maxLeverage}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, maxLeverage: value },
                      }))
                    }
                    options={[
                      { value: 1, label: '1x' },
                      { value: 2, label: '2x' },
                      { value: 3, label: '3x' },
                      { value: 5, label: '5x' },
                      { value: 10, label: '10x' },
                      { value: 15, label: '15x' },
                      { value: 20, label: '20x' },
                    ]}
                  />
                  <PillGroup
                    label={t('wizard.maxPosition')}
                    value={formData.customParams.maxPosition}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, maxPosition: value },
                      }))
                    }
                    options={[
                      { value: 10, label: '10%' },
                      { value: 20, label: '20%' },
                      { value: 30, label: '30%' },
                      { value: 50, label: '50%' },
                      { value: 70, label: '70%' },
                      { value: 100, label: '100%' },
                    ]}
                  />
                  <PillGroup
                    label={t('wizard.minConfidence')}
                    value={formData.customParams.minConfidence}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: {
                          ...prev.customParams,
                          minConfidence: value,
                        },
                      }))
                    }
                    options={[
                      { value: 50, label: '50%' },
                      { value: 60, label: '60%' },
                      { value: 70, label: '70%' },
                      { value: 80, label: '80%' },
                      { value: 90, label: '90%' },
                      { value: 95, label: '95%' },
                    ]}
                  />
                  <PillGroup
                    label={t('wizard.minRR')}
                    value={formData.customParams.minRR}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, minRR: value },
                      }))
                    }
                    options={[
                      { value: 1, label: '1:1' },
                      { value: 1.5, label: '1.5:1' },
                      { value: 2, label: '2:1' },
                      { value: 2.5, label: '2.5:1' },
                      { value: 3, label: '3:1' },
                      { value: 5, label: '5:1' },
                    ]}
                  />
                  <PillGroup
                    label={t('wizard.minPositionSize')}
                    value={formData.customParams.minPositionSize}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: {
                          ...prev.customParams,
                          minPositionSize: value,
                        },
                      }))
                    }
                    options={[
                      { value: 1, label: '1%' },
                      { value: 5, label: '5%' },
                      { value: 10, label: '10%' },
                      { value: 20, label: '20%' },
                      { value: 30, label: '30%' },
                      { value: 50, label: '50%' },
                    ]}
                  />
                  <NumberStepper
                    label={t('wizard.fundPool')}
                    value={formData.customParams.fundPool}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, fundPool: value },
                      }))
                    }
                    prefix="$"
                    min={1000}
                    max={100000}
                    step={1000}
                  />
                  <PillGroup
                    label={t('wizard.maxPerTrade')}
                    value={formData.customParams.maxPerTrade}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, maxPerTrade: value },
                      }))
                    }
                    options={[
                      { value: 5, label: '5%' },
                      { value: 10, label: '10%' },
                      { value: 20, label: '20%' },
                      { value: 30, label: '30%' },
                      { value: 50, label: '50%' },
                    ]}
                  />
                  <PillGroup
                    label={t('wizard.dailyDrawdown')}
                    value={formData.customParams.dailyDrawdown}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: {
                          ...prev.customParams,
                          dailyDrawdown: value,
                        },
                      }))
                    }
                    options={[
                      { value: 3, label: '3%' },
                      { value: 5, label: '5%' },
                      { value: 8, label: '8%' },
                      { value: 10, label: '10%' },
                      { value: 15, label: '15%' },
                      { value: 20, label: '20%' },
                    ]}
                  />

                  <div className="space-y-2">
                    <label
                      htmlFor="main-timeframe"
                      className="block text-xs text-[#94A3B8]"
                    >
                      {t('wizard.mainTimeframe')}
                    </label>
                    <select
                      id="main-timeframe"
                      value={formData.customParams.mainTimeframe}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customParams: {
                            ...prev.customParams,
                            mainTimeframe: e.target.value,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 bg-[#1A1A24] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-[#06B6D4] transition-colors"
                      aria-label={t('wizard.mainTimeframe')}
                    >
                      <option value="15m">{t('wizard.tf15m')}</option>
                      <option value="1h">{t('wizard.tf1h')}</option>
                      <option value="4h">{t('wizard.tf4h')}</option>
                      <option value="1d">{t('wizard.tf1d')}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="aux-timeframe"
                      className="block text-xs text-[#94A3B8]"
                    >
                      {t('wizard.auxTimeframe')}
                    </label>
                    <select
                      id="aux-timeframe"
                      value={formData.customParams.auxTimeframe}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customParams: {
                            ...prev.customParams,
                            auxTimeframe: e.target.value,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 bg-[#1A1A24] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-[#06B6D4] transition-colors"
                      aria-label={t('wizard.auxTimeframe')}
                    >
                      <option value="5m">{t('wizard.tf5m')}</option>
                      <option value="15m">{t('wizard.tf15m')}</option>
                      <option value="1h">{t('wizard.tf1h')}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: 策略模式 */}
        {currentStep === 3 && (
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">{t('create.reasoningMode')}</label>
              <div className="grid grid-cols-2 gap-3">
                {(['solo', 'debate', 'research', 'grid'] as StrategyMode[]).map((mode) => {
                  const sel = formData.strategyMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => {
                          const newIntervals = STRATEGY_INTERVALS[mode]
                          const newInterval = newIntervals.includes(prev.interval) ? prev.interval : STRATEGY_DEFAULT_INTERVAL[mode]
                          return { ...prev, strategyMode: mode, interval: newInterval }
                        })
                      }
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        sel
                          ? 'bg-[#06B6D4]/10 border-2 border-[#06B6D4] text-[#06B6D4]'
                          : 'bg-[#12121A] text-[#94A3B8] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                      }`}
                      aria-label={STRATEGY_MODE_LABELS[mode]}
                      title={STRATEGY_MODE_LABELS[mode]}
                    >
                      {STRATEGY_MODE_LABELS[mode]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 共识模型下拉（仅 debate 模式） */}
            {formData.strategyMode === 'debate' && (
              <div className="space-y-2">
                <label className="block text-sm text-[#94A3B8]">{t('create.consensusModels', { count: debateModels.length })}</label>
                <div className="relative" ref={modelListRef}>
                  <button type="button"
                    onClick={() => setShowModelListDropdown(!showModelListDropdown)}
                    className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center -space-x-2">
                      {debateModels.map((id) => {
                        const m = MODEL_DISPLAY[id]
                        return m?.logo
                          ? <Image key={id} src={m.logo} alt={m.name} width={28} height={28}
                              className="w-7 h-7 rounded-full border-2 border-[#12121A] object-cover" title={m.name} />
                          : <div key={id} className="w-7 h-7 rounded-full border-2 border-[#12121A]"
                              style={{ backgroundColor: m?.color || '#1E1E2E' }} title={m?.name} />
                      })}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#606070] transition-transform ${showModelListDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showModelListDropdown && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-2xl max-h-[320px] overflow-y-auto">
                      <p className="px-4 pt-3 pb-1 text-xs text-[#606070]">{t('create.consensusModelsDesc')}</p>
                      {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                        const sel = debateModels.includes(modelId)
                        return (
                          <button key={modelId} type="button" onClick={() => handleModelToggle(modelId)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                              sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'
                            }`}
                            title={info.name}
                          >
                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#06B6D4]' : 'bg-[#1E1E2E]'}`}>
                              {sel && <Check className="w-3 h-3 text-[#F8F8FC]" />}
                            </div>
                            <Image src={info.logo} alt={info.name} width={24} height={24}
                              className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0 text-left">
                              <span className="text-sm text-[#F8F8FC]">{info.name}</span>
                              <span className="text-xs text-[#606070] ml-2">{info.provider}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">{t('wizard.runInterval')}</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(STRATEGY_INTERVALS[formData.strategyMode] || STRATEGY_INTERVALS.solo).map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, interval }))
                    }
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      formData.interval === interval
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#12121A] text-[#94A3B8] hover:bg-[#1A1A24]'
                    }`}
                    aria-label={`${interval}间隔`}
                    title={interval}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: 确认并创建 */}
        {currentStep === 4 && (
          <div className="p-4 space-y-6">
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-[#06B6D4] mb-4">{t('wizard.configSummary')}</h3>

              <SummaryRow label={t('wizard.summaryName')} value={formData.strategyName || t('wizard.notSet')} />
              <SummaryRow
                label={t('wizard.summaryCoins')}
                value={
                  formData.selectedCoins.length > 0
                    ? formData.selectedCoins.join(', ')
                    : t('wizard.notSelected')
                }
              />
              <SummaryRow label={t('wizard.summaryStyle')} value={STRATEGY_STYLE_LABELS[formData.strategyStyle]} />
              <SummaryRow
                label={t('wizard.summaryMode')}
                value={`${STRATEGY_MODE_LABELS[formData.strategyMode]} (${formData.interval})`}
              />
              <SummaryRow
                label={t('wizard.summaryLeverage')}
                value={`${formData.customParams.maxLeverage}x`}
              />
              <SummaryRow
                label={t('wizard.summaryPosition')}
                value={`${formData.customParams.maxPosition}%`}
              />
              <SummaryRow
                label={t('wizard.summaryConfidence')}
                value={`≥${formData.customParams.minConfidence}%`}
              />
              <SummaryRow
                label={t('wizard.summaryRR')}
                value={`≥${formData.customParams.minRR}:1`}
              />
              <SummaryRow
                label={t('wizard.summaryFundPool')}
                value={`$${formData.customParams.fundPool.toLocaleString()}`}
              />
              <SummaryRow
                label={t('wizard.summaryPerTrade')}
                value={`${formData.customParams.maxPerTrade}%`}
              />
              <SummaryRow
                label={t('wizard.summaryDrawdown')}
                value={`${formData.customParams.dailyDrawdown}%${t('wizard.perDay')}`}
              />
              <SummaryRow label={t('wizard.summaryType')} value={STRATEGY_MODE_LABELS[formData.strategyMode]} />
            </div>

            <div className="bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94A3B8]">{t('wizard.estimatedCost')}</span>
                <span className="text-xl font-bold text-[#06B6D4]">
                  ${formData.strategyMode === 'debate' ? '99' : '49'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-2">
                {t('wizard.costDesc', { mode: STRATEGY_MODE_LABELS[formData.strategyMode], interval: formData.interval })}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className={`w-full py-3 bg-[#06B6D4] hover:bg-[#0891B2] text-white font-semibold rounded-lg transition-colors ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                aria-label={t('wizard.saveAndStart')}
                title={t('wizard.saveAndStart')}
              >
                {isSubmitting ? t('wizard.creating') : t('wizard.saveAndStart')}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className={`w-full py-3 bg-[#12121A] hover:bg-[#1A1A24] text-[#94A3B8] font-medium rounded-lg border border-[#1E1E2E] transition-colors ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                aria-label={t('wizard.saveOnly')}
                title={t('wizard.saveOnly')}
              >
                {isSubmitting ? t('wizard.saving') : t('wizard.saveOnly')}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 底部按钮栏 */}
      {currentStep < 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0F] border-t border-[#1E1E2E] p-4">
          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex-1 py-3 bg-[#12121A] hover:bg-[#1A1A24] text-[#94A3B8] font-medium rounded-lg border border-[#1E1E2E] transition-colors"
                aria-label={t('wizard.prevStep')}
                title={t('wizard.prevStep')}
              >
                {t('wizard.prevStep')}
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-3 bg-[#06B6D4] hover:bg-[#0891B2] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              aria-label={t('wizard.nextStep')}
              title={t('wizard.nextStep')}
            >
              {t('wizard.nextStep')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0F] border-t border-[#1E1E2E] p-4">
          <button
            type="button"
            onClick={handlePrev}
            className="w-full py-3 bg-[#12121A] hover:bg-[#1A1A24] text-[#94A3B8] font-medium rounded-lg border border-[#1E1E2E] transition-colors"
            aria-label={t('wizard.prevStep')}
            title={t('wizard.prevStep')}
          >
            {t('wizard.prevStep')}
          </button>
        </div>
      )}
    </div>
  )
}

// 辅助组件：摘要行
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1E1E2E] last:border-0">
      <span className="text-sm text-[#94A3B8]">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  )
}

export default function Page() {
  return <CreateStrategyWizard />
}
