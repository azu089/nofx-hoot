'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Shield,
  Scale,
  Flame,
} from 'lucide-react'
import { useCreateStrategy, useStrategyControl } from '@/hooks/useAi'
import type { CreateStrategyBody } from '@/types/ai'

type CoinSource = '手动选择' | 'AI推荐' | 'OI榜'
type StrategyStyle = '保守型' | '均衡型' | '激进型'
type StrategyType = '普通策略' | '网格交易'
type TradingMode = 'Solo' | 'Debate'
type Interval = '15m' | '30m' | '60m' | '4h' | '24h'

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
  strategyType: StrategyType
  tradingMode: TradingMode
  interval: Interval
}

const COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ARB', 'OP']

const INTERVALS: Interval[] = ['15m', '30m', '60m', '4h', '24h']

const STRATEGY_PRESETS = {
  保守型: {
    icon: Shield,
    leverage: '1-3x',
    position: '≤30%',
    confidence: '≥80%',
    rr: '≥3:1',
    perTrade: '5-10%',
    drawdown: '5%',
    audience: '稳健投资者',
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
  均衡型: {
    icon: Scale,
    leverage: '3-5x',
    position: '≤50%',
    confidence: '≥70%',
    rr: '≥2:1',
    perTrade: '10-20%',
    drawdown: '10%',
    audience: '大多数交易者',
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
  激进型: {
    icon: Flame,
    leverage: '5-10x',
    position: '≤70%',
    confidence: '≥60%',
    rr: '≥1.5:1',
    perTrade: '20-30%',
    drawdown: '15%',
    audience: '风险偏好者',
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
  const createStrategy = useCreateStrategy()
  const strategyControl = useStrategyControl()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [showCustomParams, setShowCustomParams] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    strategyName: '',
    coinSource: '手动选择',
    selectedCoins: [],
    strategyStyle: '均衡型',
    customParams: STRATEGY_PRESETS.均衡型.params,
    strategyType: '普通策略',
    tradingMode: 'Solo',
    interval: '60m',
  })

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
      customParams: STRATEGY_PRESETS[style].params,
    }))
  }

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
          '15m': 15,
          '30m': 30,
          '60m': 60,
          '4h': 240,
          '24h': 1440,
        }
        return map[interval] || 60
      }

      // 映射策略类型
      const strategyTypeMap: Record<string, string> = {
        '普通策略': 'normal',
        '网格交易': 'grid',
      }

      // 映射交易模式
      const tradingModeMap: Record<string, string> = {
        Solo: 'solo',
        Debate: 'debate',
      }

      // 映射币种来源
      const coinSourceModeMap: Record<string, string> = {
        '手动选择': 'static',
        'AI推荐': 'ai',
        OI榜: 'oi_top',
      }

      // 构建币种列表（期货格式）
      const coins = formData.selectedCoins.map((c) => `${c}/USDT:USDT`)

      // 构建请求体
      const body = {
        name: formData.strategyName,
        strategyType: strategyTypeMap[formData.strategyType],
        tradingMode: tradingModeMap[formData.tradingMode],
        coinSourceConfig: {
          mode: coinSourceModeMap[formData.coinSource],
          coins: coins,
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
          minRiskReward: formData.customParams.minRR,
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
    } catch (error: any) {
      console.error('创建策略失败:', error)
      // TODO: 可以在这里添加错误提示 toast
      alert(`创建失败: ${error.message || '未知错误'}`)
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
            aria-label="返回"
            title="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-base font-semibold">创建 AI 策略</h1>

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
                策略名称
              </label>
              <input
                id="strategy-name"
                type="text"
                placeholder="输入策略名称"
                value={formData.strategyName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    strategyName: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#06B6D4] transition-colors"
                aria-label="策略名称"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">币种来源</label>
              <div className="flex gap-2">
                {(['手动选择', 'AI推荐', 'OI榜'] as CoinSource[]).map(
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
                      aria-label={`选择${source}`}
                      title={source}
                    >
                      {source}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">选择币种</label>
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
                    aria-label={`${coin}币种`}
                    title={coin}
                  >
                    {coin}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[#64748B]">
                已选 {formData.selectedCoins.length} 个
              </p>
            </div>
          </div>
        )}

        {/* Step 2: 策略预设 */}
        {currentStep === 2 && (
          <div className="p-4 space-y-6">
            <h2 className="text-lg font-semibold">选择策略风格</h2>

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
                      aria-label={`选择${style}策略`}
                      title={style}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-[#06B6D4]" />
                          <span className="font-semibold">{style}</span>
                        </div>
                        {style === '均衡型' && (
                          <span className="px-2 py-0.5 bg-[#06B6D4] text-xs rounded-full">
                            推荐
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#94A3B8]">
                        <div>杠杆上限: {preset.leverage}</div>
                        <div>持仓上限: {preset.position}</div>
                        <div>置信度: {preset.confidence}</div>
                        <div>R:R比: {preset.rr}</div>
                        <div>单笔金额: {preset.perTrade}</div>
                        <div>每日回撤: {preset.drawdown}</div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#1E1E2E] text-xs text-[#64748B]">
                        适合: {preset.audience}
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
                aria-label="自定义参数"
                title="自定义参数"
              >
                <span className="text-sm font-medium">自定义参数</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showCustomParams ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showCustomParams && (
                <div className="px-4 pb-4 space-y-4">
                  <SliderField
                    label="最大杠杆"
                    value={formData.customParams.maxLeverage}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, maxLeverage: value },
                      }))
                    }
                    min={1}
                    max={20}
                    unit="x"
                  />
                  <SliderField
                    label="最大持仓"
                    value={formData.customParams.maxPosition}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, maxPosition: value },
                      }))
                    }
                    min={10}
                    max={100}
                    unit="%"
                  />
                  <SliderField
                    label="最小置信度"
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
                    min={50}
                    max={95}
                    unit="%"
                  />
                  <SliderField
                    label="最小R:R"
                    value={formData.customParams.minRR}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, minRR: value },
                      }))
                    }
                    min={1}
                    max={5}
                    step={0.5}
                    unit=":1"
                  />
                  <SliderField
                    label="最小仓位"
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
                    min={1}
                    max={50}
                    unit="%"
                  />
                  <SliderField
                    label="AI资金池"
                    value={formData.customParams.fundPool}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, fundPool: value },
                      }))
                    }
                    min={1000}
                    max={100000}
                    step={1000}
                    unit="$"
                  />
                  <SliderField
                    label="单笔上限"
                    value={formData.customParams.maxPerTrade}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        customParams: { ...prev.customParams, maxPerTrade: value },
                      }))
                    }
                    min={5}
                    max={50}
                    unit="%"
                  />
                  <SliderField
                    label="每日回撤"
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
                    min={3}
                    max={20}
                    unit="%"
                  />

                  <div className="space-y-2">
                    <label
                      htmlFor="main-timeframe"
                      className="block text-xs text-[#94A3B8]"
                    >
                      主时间框架
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
                      aria-label="主时间框架"
                    >
                      <option value="15m">15分钟</option>
                      <option value="1h">1小时</option>
                      <option value="4h">4小时</option>
                      <option value="1d">1天</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="aux-timeframe"
                      className="block text-xs text-[#94A3B8]"
                    >
                      辅助时间框架
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
                      aria-label="辅助时间框架"
                    >
                      <option value="5m">5分钟</option>
                      <option value="15m">15分钟</option>
                      <option value="1h">1小时</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: 交易模式 */}
        {currentStep === 3 && (
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">策略类型</label>
              <div className="grid grid-cols-2 gap-3">
                {(['普通策略', '网格交易'] as StrategyType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, strategyType: type }))
                    }
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      formData.strategyType === type
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#12121A] text-[#94A3B8] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                    }`}
                    aria-label={type}
                    title={type}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">交易模式</label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, tradingMode: 'Solo' }))
                  }
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    formData.tradingMode === 'Solo'
                      ? 'bg-[#12121A] border-2 border-[#06B6D4]'
                      : 'bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                  }`}
                  aria-label="Solo单AI模式"
                  title="Solo单AI模式"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Solo 单AI</span>
                    <span className="text-xs text-[#06B6D4]">⚡ 快速 ~5s</span>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    单一AI快速决策，适合高频交易
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, tradingMode: 'Debate' }))
                  }
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    formData.tradingMode === 'Debate'
                      ? 'bg-[#12121A] border-2 border-[#06B6D4]'
                      : 'bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                  }`}
                  aria-label="Debate多角色辩论模式"
                  title="Debate多角色辩论模式"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Debate 多角色辩论</span>
                    <span className="text-xs text-[#64748B]">🕐 ~30s</span>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    多AI角色辩论决策，提高准确率
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-[#94A3B8]">运行间隔</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {INTERVALS.map((interval) => (
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
              <h3 className="font-semibold text-[#06B6D4] mb-4">配置摘要</h3>

              <SummaryRow label="策略名称" value={formData.strategyName || '未设置'} />
              <SummaryRow
                label="币种"
                value={
                  formData.selectedCoins.length > 0
                    ? formData.selectedCoins.join(', ')
                    : '未选择'
                }
              />
              <SummaryRow label="风格" value={formData.strategyStyle} />
              <SummaryRow
                label="模式"
                value={`${formData.tradingMode} (${formData.interval})`}
              />
              <SummaryRow
                label="杠杆"
                value={`${formData.customParams.maxLeverage}x`}
              />
              <SummaryRow
                label="持仓"
                value={`${formData.customParams.maxPosition}%`}
              />
              <SummaryRow
                label="置信度"
                value={`≥${formData.customParams.minConfidence}%`}
              />
              <SummaryRow
                label="R:R比"
                value={`≥${formData.customParams.minRR}:1`}
              />
              <SummaryRow
                label="资金池"
                value={`$${formData.customParams.fundPool.toLocaleString()}`}
              />
              <SummaryRow
                label="单笔上限"
                value={`${formData.customParams.maxPerTrade}%`}
              />
              <SummaryRow
                label="回撤限制"
                value={`${formData.customParams.dailyDrawdown}%/日`}
              />
              <SummaryRow label="策略类型" value={formData.strategyType} />
            </div>

            <div className="bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94A3B8]">预估月费</span>
                <span className="text-xl font-bold text-[#06B6D4]">
                  ${formData.tradingMode === 'Debate' ? '99' : '49'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-2">
                基于 {formData.tradingMode} 模式和 {formData.interval} 运行间隔
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
                aria-label="保存并启动策略"
                title="保存并启动策略"
              >
                {isSubmitting ? '创建中...' : '保存并启动策略'}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className={`w-full py-3 bg-[#12121A] hover:bg-[#1A1A24] text-[#94A3B8] font-medium rounded-lg border border-[#1E1E2E] transition-colors ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                aria-label="仅保存"
                title="仅保存"
              >
                {isSubmitting ? '保存中...' : '仅保存'}
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
                aria-label="上一步"
                title="上一步"
              >
                上一步
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-3 bg-[#06B6D4] hover:bg-[#0891B2] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              aria-label="下一步"
              title="下一步"
            >
              下一步
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
            aria-label="上一步"
            title="上一步"
          >
            上一步
          </button>
        </div>
      )}
    </div>
  )
}

// 辅助组件：滑块字段
function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[#94A3B8]">{label}</label>
        <span className="text-sm font-semibold text-white">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-[#1A1A24] rounded-lg appearance-none cursor-pointer slider-thumb"
        aria-label={label}
        title={label}
      />
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
