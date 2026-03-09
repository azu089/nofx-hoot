'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Check, ChevronDown, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCreateStrategy, useStrategyControl, useStartResearch, useUpdateAiConfig } from '@/hooks/useAi'
import type { CreateStrategyBody } from '@/types/ai'
import { MODEL_DISPLAY, DEFAULT_DEBATE_MODELS } from '@/constants/debate'
import { ExchangeKeySelector } from '@/components/ui-v3/ai/exchange-key-selector'

// ═══════════════════ Types ═══════════════════

type StrategyMode = 'solo' | 'debate' | 'research' | 'grid'
type ResearchDepth = 'quick' | 'standard' | 'deep'
type CoinSource = 'manual' | 'ai' | 'oi_top'

// ═══════════════════ Constants ═══════════════════

/**
 * 注：solo = "极速"，与共识(debate)逻辑不同：
 *   - 极速/深研/网格：单选 1 个 LLM
 *   - 共识：多选 ≥2 个 LLM（投票机制需要不同观点）
 *   - 深研使用 quickThinkModel/deepThinkModel 两个角色，但可由同一模型担任
 * 模式/深度/来源标签通过 i18n t() 获取，跟随系统语言
 */

const DEPTH_OPTIONS: { value: ResearchDepth; time: string }[] = [
  { value: 'quick', time: '~1min' },
  { value: 'standard', time: '~3min' },
  { value: 'deep', time: '~5min' },
]

const STRATEGY_INTERVALS: Record<StrategyMode, string[]> = {
  solo:     ['3m', '5m', '15m', '30m', '60m'],
  debate:   ['5m', '15m', '30m', '60m'],
  research: ['15m', '30m', '60m', '4h'],
  grid:     ['3m', '5m', '15m', '30m'],
}

const STRATEGY_DEFAULT_INTERVAL: Record<StrategyMode, string> = {
  solo: '60m',
  debate: '60m',
  research: '60m',
  grid: '15m',
}

const COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ARB', 'OP']

const ALL_SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT',
  'MATIC/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'APT/USDT',
  'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'INJ/USDT', 'NEAR/USDT',
  'FTM/USDT', 'AAVE/USDT', 'WIF/USDT', 'PEPE/USDT', 'TIA/USDT',
]

const intervalToMinutes = (v: string): number => {
  const map: Record<string, number> = {
    '3m': 3, '5m': 5, '15m': 15, '30m': 30,
    '60m': 60, '4h': 240, '24h': 1440,
  }
  return map[v] || 60
}

// ═══════════════════ Component ═══════════════════

export function CreateStrategyWizard() {
  const router = useRouter()
  const t = useTranslations('ai')

  // ── i18n label helpers（跟随系统语言）──────────────
  const getModeLabel = (m: StrategyMode): string => ({
    solo: t('modes.solo'),
    debate: t('modes.debate'),
    research: t('modes.research'),
    grid: t('modes.grid'),
  }[m])

  const getDepthLabel = (value: ResearchDepth): string => {
    if (value === 'quick') return t('create.quick')
    if (value === 'deep') return t('create.deep')
    return t('create.standard')
  }

  const getCoinSourceLabel = (src: CoinSource): string => {
    if (src === 'manual') return t('create.coinSourceManual')
    if (src === 'ai') return t('create.coinSourceAI')
    return t('create.coinSourceOIHigh')
  }

  const startResearch = useStartResearch()
  const createStrategy = useCreateStrategy()
  const strategyControl = useStrategyControl()
  const updateAiConfig = useUpdateAiConfig()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Mode ──────────────────────────────────────
  const [mode, setMode] = useState<StrategyMode>('solo')
  const isResearch = mode === 'research'
  const isGrid = mode === 'grid'
  const isDebate = mode === 'debate'

  // ── Strategy name ─────────────────────────────
  const [name, setName] = useState('')

  // ── Exchange ──────────────────────────────────
  const [exchangeApiKeyId, setExchangeApiKeyId] = useState<string | null>(null)

  // ── Coins (solo/debate) ───────────────────────
  const [coinSource, setCoinSource] = useState<CoinSource>('manual')
  const [selectedCoins, setSelectedCoins] = useState<string[]>(['BTC', 'ETH'])
  const [coinSearch, setCoinSearch] = useState('')

  // ── Research: single symbol ───────────────────
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT')
  const [symbolSearch, setSymbolSearch] = useState('')

  // ── Grid: single coin ─────────────────────────
  const [gridSymbol, setGridSymbol] = useState('BTC')

  // ── Interval ──────────────────────────────────
  const [interval, setInterval] = useState('60m')

  // ── LLM selection ─────────────────────────────
  // 极速/深研/网格：单选（selectedModel）
  // 共识：多选（debateModels，≥2 必须）
  const [selectedModel, setSelectedModel] = useState('deepseek-chat')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [debateModels, setDebateModels] = useState([...DEFAULT_DEBATE_MODELS])
  const [showDebateDropdown, setShowDebateDropdown] = useState(false)
  const [showStopConditions, setShowStopConditions] = useState(true)
  const modelRef = useRef<HTMLDivElement>(null)
  const debateRef = useRef<HTMLDivElement>(null)

  // ── Research depth ────────────────────────────
  const [depth, setDepth] = useState<ResearchDepth>('standard')

  // ── Risk params (极速/共识/深研) ──────────────
  // 注：maxDailyDrawdown 单位为 $（美元），不是百分比
  const [riskParams, setRiskParams] = useState({
    allocatedCapital: 10000,
    maxLeverage: 5,
    maxDailyDrawdown: 500,   // $ 美元，非百分比
    minConfidence: 70,
    minRiskRewardRatio: 2,
    minPositionSize: 100,
    maxDailyTrades: 10,
    cooldownMinutes: 30,
  })

  // ── Grid params ───────────────────────────────
  const [gridParams, setGridParams] = useState({
    totalInvestment: 1000,  // 资金上限（$），对应后端 gridConfig.totalInvestment
    leverage: 0,            // 0 = AI 自动决策杠杆
    upperPct: 0,            // 上偏移百分比，0 = AI 自动计算区间
    lowerPct: 0,            // 下偏移百分比，0 = AI 自动计算区间
    gridCount: 10,
    direction: 'neutral' as 'neutral' | 'long' | 'short' | 'long_bias' | 'short_bias',
    distribution: 'uniform' as 'uniform' | 'gaussian' | 'pyramid',
    maxDrawdownPct: 15,
    stopLossPct: 5,
    dailyLossLimitPct: 10,
    autoAdjustThreshold: 20,
    useMakerOnly: true,
    autoPauseOnTrend: true,
    enableDirectionAdjust: false,
    directionBiasRatio: 70,
  })

  // ── 上/下偏移输入中间态（允许输入 0.X 小数）──────────
  const [upperPctStr, setUpperPctStr] = useState('')
  const [lowerPctStr, setLowerPctStr] = useState('')

  // ── 网格交易对实时价格 ─────────────────────────────
  const [gridCurrentPrice, setGridCurrentPrice] = useState(0)
  useEffect(() => {
    if (mode !== 'grid' || !gridSymbol) return
    const sym = `${gridSymbol}USDT`
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api'
    fetch(`${apiBase}/market/price?symbol=${sym}`)
      .then(r => r.json())
      .then(d => setGridCurrentPrice(parseFloat(d.data?.price) || 0))
      .catch(() => {})
  }, [mode, gridSymbol])

  // ── Stop conditions ───────────────────────────
  const [maxCycles, setMaxCycles] = useState(0)
  const [profitTarget, setProfitTarget] = useState(0)
  const [maxLoss, setMaxLoss] = useState(0)

  // ── 网格可行性分析 ──────────────────────────────
  // 后端公式：每层名义值 = (totalInvestment / gridCount) × effectiveLeverage
  // effectiveLeverage = min(userLeverage, REGIME_LEVERAGE_CAP)
  // 最坏 regime（narrow / volatile）杠杆上限 = 2x
  // Binance 合约最低名义值 ≈ $20
  const gridViability = useMemo(() => {
    const { totalInvestment, leverage, gridCount } = gridParams
    if (!gridCount || !totalInvestment) return null
    // 按交易对读取真实最低名义价值（Binance USDT-M：BTC=$100, ETH=$20, 其他=$5）
    const base = selectedSymbol.split('/')[0].toUpperCase()
    const MIN_NOTIONAL = base === 'BTC' ? 100 : base === 'ETH' ? 20 : 5
    const WORST_LEV_CAP = 2           // narrow=2x, volatile=2x（最严格 regime）
    const effLev = Math.min(leverage || 5, WORST_LEV_CAP) // leverage=0 = AI决策，预览按5x估算
    // 每层名义值 = 每层保证金 × 有效杠杆
    const perLayerNotional = (totalInvestment / gridCount) * effLev
    // 最多可运行层数
    const maxViableLayers = Math.floor((totalInvestment * effLev) / MIN_NOTIONAL)
    // 让所有层都能运行所需最低投资额
    const minInvestment = Math.ceil((gridCount * MIN_NOTIONAL) / effLev)
    const idleLayers = Math.max(0, gridCount - maxViableLayers)
    return { perLayerNotional, maxViableLayers, minInvestment, idleLayers, effLev }
  }, [gridParams, selectedSymbol])

  // ── Filtered data ─────────────────────────────
  const filteredCoins = useMemo(() => {
    if (!coinSearch) return COINS
    const q = coinSearch.toUpperCase()
    return COINS.filter((c) => c.includes(q))
  }, [coinSearch])

  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return ALL_SYMBOLS.slice(0, 12)
    const q = symbolSearch.toUpperCase()
    return ALL_SYMBOLS.filter((s) => s.includes(q))
  }, [symbolSearch])

  // ── Click outside ─────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setShowModelDropdown(false)
      if (debateRef.current && !debateRef.current.contains(e.target as Node)) setShowDebateDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Handlers ──────────────────────────────────

  const handleModeChange = (newMode: StrategyMode) => {
    setMode(newMode)
    const newIntervals = STRATEGY_INTERVALS[newMode]
    if (!newIntervals.includes(interval)) {
      setInterval(STRATEGY_DEFAULT_INTERVAL[newMode])
    }
  }

  const handleCoinToggle = (coin: string) => {
    setSelectedCoins((prev) =>
      prev.includes(coin) ? prev.filter((c) => c !== coin) : [...prev, coin]
    )
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

  const updateRisk = <K extends keyof typeof riskParams>(key: K, value: number) => {
    setRiskParams((prev) => ({ ...prev, [key]: value }))
  }

  const updateGrid = <K extends keyof typeof gridParams>(key: K, value: (typeof gridParams)[K]) => {
    setGridParams((prev) => ({ ...prev, [key]: value }))
  }

  // ── Submit ────────────────────────────────────

  const handleSubmit = async (saveOnly: boolean) => {
    try {
      setIsSubmitting(true)
      const mins = intervalToMinutes(interval)

      // ── Research mode ──
      if (isResearch) {
        const result = await startResearch.mutateAsync({
          symbol: selectedSymbol,
          depth,
          autoExecute: !saveOnly,
          quickModel: selectedModel,
          ...(exchangeApiKeyId && { exchangeApiKeyId }),
          cyclingConfig: {
            enabled: true,
            intervalMinutes: mins,
            maxCycles: maxCycles || 0,
            profitTargetPercent: profitTarget || 0,
            maxLossPercent: maxLoss || 0,
          },
          riskControlConfig: {
            allocatedCapital: riskParams.allocatedCapital,
            maxDailyDrawdown: riskParams.maxDailyDrawdown,
            maxDailyTrades: riskParams.maxDailyTrades,
            cooldownMinutes: riskParams.cooldownMinutes,
          },
        })
        router.push(`/ai/research/${result.sessionId}`)
        return
      }

      // ── Strategy modes (solo / debate / grid) ──
      const coinSourceMap: Record<CoinSource, string> = {
        manual: 'static',
        ai: 'ai',
        oi_top: 'oi_top',
      }

      const body: Record<string, unknown> = {
        name: name.trim() || getModeLabel(mode),
        strategyType: isGrid ? 'grid' : 'normal',
        tradingMode: isDebate ? 'debate' : 'solo',
        coinSourceConfig: isGrid
          ? { mode: 'static', coins: [`${gridSymbol}/USDT:USDT`] }
          : {
              mode: coinSourceMap[coinSource],
              coins: selectedCoins.map((c) => `${c}/USDT:USDT`),
            },
        indicatorConfig: {
          timeframe: '1h',
          indicators: ['EMA:20,50', 'MACD', 'RSI:14', 'ATR:14'],
        },
        riskControlConfig: {
          allocatedCapital: isGrid ? undefined : riskParams.allocatedCapital,
          maxLeverage: isGrid ? (gridParams.leverage || 1) : (riskParams.maxLeverage || 1),
          maxDailyDrawdown: riskParams.maxDailyDrawdown,
          minConfidence: riskParams.minConfidence,
          minRiskRewardRatio: riskParams.minRiskRewardRatio,
          minPositionSize: riskParams.minPositionSize,
          maxDailyTrades: riskParams.maxDailyTrades,
          cooldownMinutes: riskParams.cooldownMinutes,
        },
        intervalMinutes: mins,
        models: isDebate ? debateModels : [selectedModel],
        stopConditions: {
          maxCycles: maxCycles || 0,
          profitTargetPercent: profitTarget || 0,
          maxLossPercent: maxLoss || 0,
        },
        ...(exchangeApiKeyId && { exchangeApiKeyId }),
      }

      if (isDebate) {
        body.debateConfig = { maxRounds: 3, riskRounds: 3, temperature: 0.7 };
        (body.coinSourceConfig as Record<string, unknown>).models = debateModels
      } else {
        (body.coinSourceConfig as Record<string, unknown>).models = [selectedModel]
      }

      if (isGrid) {
        body.gridConfig = {
          symbol: `${gridSymbol}/USDT:USDT`,
          gridCount: gridParams.gridCount || 10,
          totalInvestment: gridParams.totalInvestment || 1,
          leverage: gridParams.leverage > 0 ? gridParams.leverage : null,
          // 百分比 → 绝对价格换算；留空(0) → 发送 0 → 后端 AI 决策
          upperBound: (gridCurrentPrice > 0 && gridParams.upperPct > 0)
            ? +(gridCurrentPrice * (1 + gridParams.upperPct / 100)).toFixed(6) : 0,
          lowerBound: (gridCurrentPrice > 0 && gridParams.lowerPct > 0)
            ? +(gridCurrentPrice * (1 - gridParams.lowerPct / 100)).toFixed(6) : 0,
          direction: gridParams.direction,
          distribution: gridParams.distribution,
          maxDrawdownPct: gridParams.maxDrawdownPct || 5,
          stopLossPct: gridParams.stopLossPct || 5,
          dailyLossLimitPct: gridParams.dailyLossLimitPct || 1,
          autoAdjustThreshold: (gridParams.autoAdjustThreshold || 20) / 100,
          useMakerOnly: gridParams.useMakerOnly,
          autoPauseOnTrend: gridParams.autoPauseOnTrend,
          enableDirectionAdjust: gridParams.enableDirectionAdjust,
          directionBiasRatio: (gridParams.directionBiasRatio || 70) / 100,
        }
      }

      // 确保 AI 模块已启用（首次创建策略时 isEnabled 可能为 false）
      await updateAiConfig.mutateAsync({ isEnabled: true })

      const result = await createStrategy.mutateAsync(body as unknown as CreateStrategyBody)

      if (!saveOnly && result.strategy?.id) {
        await strategyControl.mutateAsync({ id: result.strategy.id, action: 'start' })
      }

      router.push(`/ai/strategy/${result.strategy.id}`)
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.error('创建策略失败:', error)
      }
      alert(`创建失败: ${error instanceof Error ? error.message : t('wizard.unknownError')}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────

  const selectedModelInfo = MODEL_DISPLAY[selectedModel]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0A0A0F] border-b border-[#1E1E2E]">
        <div className="flex items-center px-4 py-3 gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 -ml-2 hover:bg-[#12121A] rounded-xl transition-colors"
            aria-label="返回"
            title="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold">创建策略</h1>
        </div>
      </header>

      {/* Single-scroll form */}
      <main className="pb-36 px-4">

        {/* ── 模式选择 ── */}
        <div className="flex gap-1 mt-4 mb-6 p-1 bg-[#12121A] rounded-xl">
          {(['solo', 'debate', 'research', 'grid'] as StrategyMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-[#06B6D4] text-white'
                  : 'text-[#606070] hover:text-[#94A3B8]'
              }`}
              aria-label={getModeLabel(m)}
              title={getModeLabel(m)}
            >
              {getModeLabel(m)}
            </button>
          ))}
        </div>

        {/* ── 策略名称 ── */}
        <div className="mb-5">
          <p className="text-[10px] text-[#606070] mb-1">策略名称</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={getModeLabel(mode)}
            className="w-full px-4 py-3 bg-[#12121A] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4] transition-colors"
            aria-label="策略名称"
          />
        </div>

        {/* ── 交易所 ── */}
        <div className="mb-5">
          <p className="text-[10px] text-[#606070] mb-1">交易所</p>
          <ExchangeKeySelector value={exchangeApiKeyId} onChange={setExchangeApiKeyId} />
        </div>

        {/* ── 交易对 ── */}
        <div className="mb-5">
          <p className="text-[10px] text-[#606070] mb-1">交易对</p>

          {isGrid ? (
            /* 网格：单一交易对 */
            <div>
              <p className="text-[9px] text-[#EF4444] mb-2">⚠ 网格仅支持单一交易对</p>
              <div className="flex flex-wrap gap-2">
                {COINS.map((coin) => (
                  <button
                    key={coin}
                    type="button"
                    onClick={() => setGridSymbol(coin)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      gridSymbol === coin
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#12121A] text-[#94A3B8] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                    }`}
                    aria-label={coin}
                    title={coin}
                  >
                    {coin}
                  </button>
                ))}
              </div>
            </div>
          ) : isResearch ? (
            /* 深研：单个交易对搜索 */
            <div>
              <input
                type="text"
                value={symbolSearch}
                onChange={(e) => setSymbolSearch(e.target.value)}
                placeholder="搜索交易对..."
                className="w-full px-3 py-2 mb-2 bg-[#12121A] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4] transition-colors"
                aria-label="搜索交易对"
              />
              <div className="flex flex-wrap gap-2">
                {filteredSymbols.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => { setSelectedSymbol(sym); setSymbolSearch('') }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedSymbol === sym
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#12121A] text-[#94A3B8] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                    }`}
                    aria-label={sym}
                    title={sym}
                  >
                    {sym.split('/')[0]}
                  </button>
                ))}
              </div>
              {selectedSymbol && (
                <p className="text-xs text-[#606070] mt-1.5">已选：{selectedSymbol}</p>
              )}
            </div>
          ) : (
            /* 极速/共识：多选 + 内联搜索 */
            <div>
              <div className="flex gap-1.5 mb-3">
                {(['manual', 'ai', 'oi_top'] as CoinSource[]).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setCoinSource(src)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      coinSource === src
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#12121A] text-[#94A3B8] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                    }`}
                    aria-label={getCoinSourceLabel(src)}
                    title={getCoinSourceLabel(src)}
                  >
                    {getCoinSourceLabel(src)}
                  </button>
                ))}
              </div>

              {coinSource === 'manual' && (
                <>
                  <input
                    type="text"
                    value={coinSearch}
                    onChange={(e) => setCoinSearch(e.target.value)}
                    placeholder="搜索币种..."
                    className="w-full px-3 py-2 mb-2 bg-[#12121A] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4] transition-colors"
                    aria-label="搜索币种"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {filteredCoins.map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => handleCoinToggle(coin)}
                        className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedCoins.includes(coin)
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
                  {selectedCoins.length > 0 && (
                    <p className="text-xs text-[#606070] mt-1.5">
                      已选 {selectedCoins.length} 个：{selectedCoins.join(', ')}
                    </p>
                  )}
                </>
              )}
              {coinSource !== 'manual' && (
                <p className="text-xs text-[#606070] py-2">AI 将自动选择最优交易对</p>
              )}
            </div>
          )}
        </div>

        {/* ── 运行间隔 ── */}
        <div className="mb-5">
          <p className="text-[10px] text-[#606070] mb-1">运行间隔</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STRATEGY_INTERVALS[mode].map((iv) => (
              <button
                key={iv}
                type="button"
                onClick={() => setInterval(iv)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  interval === iv
                    ? 'bg-[#06B6D4] text-white'
                    : 'bg-[#12121A] text-[#94A3B8] border border-[#1E1E2E] hover:border-[#06B6D4]/50'
                }`}
                aria-label={iv}
                title={iv}
              >
                {iv}
              </button>
            ))}
          </div>
        </div>

        {/* ── LLM ── */}
        <div className="mb-5">
          <p className="text-[10px] text-[#606070] mb-1">LLM</p>

          {isDebate ? (
            /* 共识：多选 ≥2 */
            <div className="relative" ref={debateRef}>
              <button
                type="button"
                onClick={() => setShowDebateDropdown(!showDebateDropdown)}
                className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
                aria-label="选择共识模型"
                title="选择共识模型"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-2">
                    {debateModels.slice(0, 4).map((id) => {
                      const m = MODEL_DISPLAY[id]
                      return m?.logo ? (
                        <Image
                          key={id}
                          src={m.logo}
                          alt={m.name}
                          width={24}
                          height={24}
                          className="w-6 h-6 rounded-full border-2 border-[#12121A] object-cover"
                          title={m.name}
                        />
                      ) : (
                        <div
                          key={id}
                          className="w-6 h-6 rounded-full border-2 border-[#12121A] bg-[#1E1E2E]"
                          title={m?.name}
                        />
                      )
                    })}
                  </div>
                  <span className="text-sm text-[#94A3B8]">{debateModels.length} 个模型</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showDebateDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showDebateDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                  <p className="px-4 pt-3 pb-1 text-xs text-[#606070]">共识模式需选 2-5 个模型参与投票</p>
                  {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                    const sel = debateModels.includes(modelId)
                    return (
                      <button
                        key={modelId}
                        type="button"
                        onClick={() => handleModelToggle(modelId)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                          sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'
                        }`}
                        aria-label={info.name}
                        title={info.name}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#06B6D4]' : 'bg-[#1E1E2E]'}`}>
                          {sel && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <Image
                          src={info.logo}
                          alt={info.name}
                          width={22}
                          height={22}
                          className="w-5.5 h-5.5 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 text-left min-w-0">
                          <span className="text-sm text-[#F8F8FC]">{info.name}</span>
                          <span className="text-xs text-[#606070] ml-2">{info.provider}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 极速/深研/网格：单选 */
            <div className="relative" ref={modelRef}>
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
                aria-label="选择模型"
                title="选择模型"
              >
                <div className="flex items-center gap-3">
                  {selectedModelInfo?.logo ? (
                    <Image
                      src={selectedModelInfo.logo}
                      alt={selectedModelInfo.name}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-lg bg-[#1E1E2E] flex-shrink-0" />
                  )}
                  <span className="text-sm text-[#F8F8FC]">
                    {selectedModelInfo?.name || selectedModel}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showModelDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                    const sel = selectedModel === modelId
                    return (
                      <button
                        key={modelId}
                        type="button"
                        onClick={() => { setSelectedModel(modelId); setShowModelDropdown(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                          sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'
                        }`}
                        aria-label={info.name}
                        title={info.name}
                      >
                        <Image
                          src={info.logo}
                          alt={info.name}
                          width={22}
                          height={22}
                          className="w-5.5 h-5.5 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 text-left min-w-0">
                          <span className="text-sm text-[#F8F8FC]">{info.name}</span>
                          <span className="text-xs text-[#606070] ml-2">{info.provider}</span>
                        </div>
                        {sel && <Check className="w-4 h-4 text-[#06B6D4]" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 研究深度（仅深研模式）── */}
        {isResearch && (
          <div className="mb-5">
            <p className="text-[10px] text-[#606070] mb-1">研究深度</p>
            <div className="flex gap-2">
              {DEPTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDepth(opt.value)}
                  className={`flex-1 py-2.5 rounded-xl text-center transition-colors ${
                    depth === opt.value
                      ? 'bg-[#06B6D4]/10 border border-[#06B6D4] text-[#06B6D4]'
                      : 'bg-[#12121A] border border-[#1E1E2E] text-[#94A3B8] hover:border-[#06B6D4]/50'
                  }`}
                  aria-label={getDepthLabel(opt.value)}
                  title={getDepthLabel(opt.value)}
                >
                  <div className="text-sm font-medium">{getDepthLabel(opt.value)}</div>
                  <div className="text-[10px] text-[#606070]">{opt.time}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 风控参数 ── */}
        <div className="mb-5">
          <p className="text-[10px] text-[#606070] mb-2">风控参数</p>

          {isGrid ? (
            /* 网格专属参数 */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <RiskField label="资金上限" suffix="$" prefix>
                  <input
                    type="number"
                    title="资金上限"
                    value={gridParams.totalInvestment}
                    onChange={(e) => updateGrid('totalInvestment', Number(e.target.value) || 0)}
                    min={1}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
                <RiskField label="杠杆" suffix="x">
                  <input
                    type="number"
                    title="杠杆"
                    value={gridParams.leverage || ''}
                    onChange={(e) => updateGrid('leverage', e.target.value === '' ? 0 : Number(e.target.value))}
                    min={1} max={20}
                    placeholder="AI决策"
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                  />
                </RiskField>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RiskField label="上偏移" suffix="%">
                  <input
                    type="text"
                    inputMode="decimal"
                    title="上偏移百分比"
                    value={upperPctStr}
                    onChange={(e) => {
                      setUpperPctStr(e.target.value)
                      if (e.target.value === '') { updateGrid('upperPct', 0); return }
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val) && val >= 0 && val <= 50) updateGrid('upperPct', val)
                    }}
                    placeholder="公式自动"
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                  />
                </RiskField>
                <RiskField label="下偏移" suffix="%">
                  <input
                    type="text"
                    inputMode="decimal"
                    title="下偏移百分比"
                    value={lowerPctStr}
                    onChange={(e) => {
                      setLowerPctStr(e.target.value)
                      if (e.target.value === '') { updateGrid('lowerPct', 0); return }
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val) && val >= 0 && val <= 50) updateGrid('lowerPct', val)
                    }}
                    placeholder="公式自动"
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                  />
                </RiskField>
              </div>
              {/* 实时换算预览 */}
              {gridCurrentPrice > 0 && (
                <div className="flex items-center justify-between text-[10px] text-[#606070] px-1 -mt-1">
                  {gridParams.upperPct > 0 && gridParams.lowerPct > 0 ? (
                    <>
                      <span>≈ ${(gridCurrentPrice * (1 - gridParams.lowerPct / 100)).toFixed(2)}</span>
                      <span>当前: ${gridCurrentPrice.toFixed(2)}</span>
                      <span>≈ ${(gridCurrentPrice * (1 + gridParams.upperPct / 100)).toFixed(2)}</span>
                    </>
                  ) : (
                    <span>当前价: ${gridCurrentPrice.toFixed(2)} · 留空则自动计算边界，上下各约 {(3 * gridParams.gridCount / 10).toFixed(1)}%，每格间距 0.6%</span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <RiskField label="格数" suffix="格">
                  <input
                    type="number"
                    title="格数"
                    value={gridParams.gridCount}
                    onChange={(e) => updateGrid('gridCount', Number(e.target.value) || 0)}
                    min={2} max={100}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
                <RiskField label="峰值回撤" suffix="%">
                  <input
                    type="number"
                    title="峰值回撤"
                    value={gridParams.maxDrawdownPct}
                    onChange={(e) => updateGrid('maxDrawdownPct', Number(e.target.value) || 0)}
                    min={1} max={50}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
              </div>
              {/* 网格初始方向 + 分布方式 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-[#9090A0]">初始方向</p>
                  <select
                    value={gridParams.direction}
                    onChange={(e) => updateGrid('direction', e.target.value as typeof gridParams.direction)}
                    className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-3 py-2.5 text-sm text-[#F8F8FC] outline-none"
                    aria-label="网格初始方向"
                  >
                    <option value="neutral">中性</option>
                    <option value="long_bias">偏多</option>
                    <option value="short_bias">偏空</option>
                    <option value="long">纯多</option>
                    <option value="short">纯空</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[#9090A0]">格线分布</p>
                  <select
                    value={gridParams.distribution}
                    onChange={(e) => updateGrid('distribution', e.target.value as typeof gridParams.distribution)}
                    className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-3 py-2.5 text-sm text-[#F8F8FC] outline-none"
                    aria-label="格线分布"
                  >
                    <option value="uniform">均匀</option>
                    <option value="gaussian">正态</option>
                    <option value="pyramid">金字塔</option>
                  </select>
                </div>
              </div>
              {/* 单格止损 */}
              <div className="grid grid-cols-2 gap-2">
                <RiskField label="单格止损" suffix="%">
                  <input
                    type="number"
                    title="单格止损阈值"
                    value={gridParams.stopLossPct}
                    onChange={(e) => updateGrid('stopLossPct', Number(e.target.value) || 5)}
                    min={1} max={20}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <RiskField label="冷却时间" suffix="min">
                  <input
                    type="number"
                    title="冷却时间"
                    value={riskParams.cooldownMinutes}
                    onChange={(e) => updateRisk('cooldownMinutes', Number(e.target.value) || 0)}
                    min={0}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
              </div>

              {/* 网格可行性提示 — 实时告知用户当前配置能运行几格 */}
              {gridViability && (
                <div className={`px-3 py-2.5 rounded-lg border text-xs ${
                  gridViability.idleLayers === 0
                    ? 'bg-[#22C55E]/5 border-[#22C55E]/15'
                    : 'bg-[#F59E0B]/5 border-[#F59E0B]/15'
                }`}>
                  {gridViability.idleLayers === 0 ? (
                    <span className="text-[#22C55E]">
                      ✓ 所有 {gridParams.gridCount} 格均可运行（极端市场每格约 ${gridViability.perLayerNotional.toFixed(0)}）
                    </span>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-[#F59E0B] font-medium">
                        ⚠ 极端市场下仅 {gridViability.maxViableLayers} 格可下单，{gridViability.idleLayers} 格将空转
                      </div>
                      <div className="text-[#707070]">
                        建议投入 ≥ ${gridViability.minInvestment}，或将层数减至 {gridViability.maxViableLayers} 格
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* 极速/共识/深研 风控参数 */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <RiskField label="资金上限" suffix="$" prefix>
                  <input
                    type="number"
                    title="资金上限"
                    value={riskParams.allocatedCapital}
                    onChange={(e) => updateRisk('allocatedCapital', Number(e.target.value) || 0)}
                    min={1}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
                <RiskField label="最大杠杆" suffix="x">
                  <input
                    type="number"
                    title="最大杠杆"
                    value={riskParams.maxLeverage}
                    onChange={(e) => updateRisk('maxLeverage', Number(e.target.value) || 0)}
                    min={1} max={20}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RiskField label="日亏损上限" suffix="$" prefix>
                  <input
                    type="number"
                    title="日亏损上限（美元）"
                    value={riskParams.maxDailyDrawdown}
                    onChange={(e) => updateRisk('maxDailyDrawdown', Number(e.target.value) || 0)}
                    min={0}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
                <RiskField label="最低置信度" suffix="%">
                  <input
                    type="number"
                    title="最低置信度"
                    value={riskParams.minConfidence}
                    onChange={(e) => updateRisk('minConfidence', Number(e.target.value) || 0)}
                    min={50} max={95}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RiskField label="最低盈亏比" suffix=":1">
                  <input
                    type="number"
                    title="最低盈亏比"
                    value={riskParams.minRiskRewardRatio}
                    onChange={(e) => updateRisk('minRiskRewardRatio', Number(e.target.value) || 0)}
                    min={1} max={10} step={0.5}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
                <RiskField label="最小持仓" suffix="$" prefix>
                  <input
                    type="number"
                    title="最小持仓（美元）"
                    value={riskParams.minPositionSize}
                    onChange={(e) => updateRisk('minPositionSize', Number(e.target.value) || 0)}
                    min={0}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RiskField label="每日最大交易" suffix="次">
                  <input
                    type="number"
                    title="每日最大交易次数"
                    value={riskParams.maxDailyTrades}
                    onChange={(e) => updateRisk('maxDailyTrades', Number(e.target.value) || 0)}
                    min={1} max={100}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
                <RiskField label="冷却时间" suffix="min">
                  <input
                    type="number"
                    title="冷却时间（分钟）"
                    value={riskParams.cooldownMinutes}
                    onChange={(e) => updateRisk('cooldownMinutes', Number(e.target.value) || 0)}
                    min={0}
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                  />
                </RiskField>
              </div>
            </div>
          )}
        </div>

        {/* ── 止停条件 ── */}
        <div className="rounded-xl border border-[#1E1E2E] overflow-hidden mb-6">
          <button type="button" onClick={() => setShowStopConditions(!showStopConditions)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-sm font-medium text-[#9090A0]">止停条件（选填）</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showStopConditions ? 'rotate-180' : ''}`} />
          </button>
          {showStopConditions && (
            <div className="px-4 pb-4 space-y-2">
              <p className="text-xs text-[#606070]">达到任一条件后策略自动停止，0=不限</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-[#9090A0]">最大周期</p>
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                    <input type="number" min={0} value={maxCycles || ''} onChange={(e) => setMaxCycles(Number(e.target.value) || 0)}
                      placeholder="0" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                      aria-label="最大周期"
                    />
                    <span className="text-[#606070] text-xs shrink-0">次</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[#9090A0]">盈利目标</p>
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                    <input type="number" min={0} step={0.1} value={profitTarget || ''} onChange={(e) => setProfitTarget(Number(e.target.value) || 0)}
                      placeholder="0" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                      aria-label="盈利目标"
                    />
                    <span className="text-[#606070] text-xs shrink-0">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[#9090A0]">最大亏损</p>
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                    <input type="number" min={0} step={0.1} value={maxLoss || ''} onChange={(e) => setMaxLoss(Number(e.target.value) || 0)}
                      placeholder="0" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                      aria-label="最大亏损"
                    />
                    <span className="text-[#606070] text-xs shrink-0">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[#9090A0]">日内亏损</p>
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                    <input type="number" min={0} max={20} value={isGrid ? (gridParams.dailyLossLimitPct || '') : ''}
                      onChange={(e) => isGrid && updateGrid('dailyLossLimitPct', Number(e.target.value) || 0)}
                      placeholder="0" disabled={!isGrid}
                      className={`flex-1 bg-transparent text-sm outline-none min-w-0 placeholder:text-[#606070] ${isGrid ? 'text-[#F8F8FC]' : 'text-[#606070] cursor-not-allowed'}`}
                      aria-label="日内亏损"
                    />
                    <span className="text-[#606070] text-xs shrink-0">%</span>
                  </div>
                </div>
                {isGrid && (
                  <div className="space-y-1 col-span-2">
                    <p className="text-xs text-[#9090A0]">网格重建阈值 <span className="text-[#606070]">（价格偏离中点超过此值自动重建，20=激进/趋势，30=保守/横盘）</span></p>
                    <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <input type="number" min={10} max={50} step={5} value={gridParams.autoAdjustThreshold || ''}
                        onChange={(e) => updateGrid('autoAdjustThreshold', Number(e.target.value) || 20)}
                        placeholder="20" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                        aria-label="网格重建阈值"
                      />
                      <span className="text-[#606070] text-xs shrink-0">%</span>
                    </div>
                  </div>
                )}
                {isGrid && (
                  <div className="flex items-center justify-between col-span-2 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                    <span className="text-xs text-[#9090A0]">Maker 限价单（省手续费）</span>
                    <button
                      type="button"
                      onClick={() => updateGrid('useMakerOnly', !gridParams.useMakerOnly)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 overflow-hidden ${gridParams.useMakerOnly ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'}`}
                      aria-label="PostOnly限价单"
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${gridParams.useMakerOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
                {isGrid && (
                  <div className="flex items-center justify-between col-span-2 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl opacity-50">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-[#9090A0]">趋势市场自动暂停</p>
                        <span className="text-[10px] text-[#606070] border border-[#2A2A3A] rounded px-1">开发中</span>
                      </div>
                      <p className="text-[10px] text-[#606070]">检测到强趋势时软暂停，回震荡后恢复</p>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="relative w-11 h-6 rounded-full bg-[#2A2A3A] flex-shrink-0 overflow-hidden cursor-not-allowed"
                      aria-label="趋势市场自动暂停（开发中）"
                    >
                      <span className="absolute top-1 translate-x-1 w-4 h-4 bg-white rounded-full" />
                    </button>
                  </div>
                )}
                {isGrid && (
                  <div className="flex items-center justify-between col-span-2 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                    <div>
                      <p className="text-xs text-[#9090A0]">方向自动切换</p>
                      <p className="text-[10px] text-[#606070]">突破时偏转方向，回归后恢复中性</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateGrid('enableDirectionAdjust', !gridParams.enableDirectionAdjust)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 overflow-hidden ${
                        gridParams.enableDirectionAdjust ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        gridParams.enableDirectionAdjust ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                )}
                {isGrid && gridParams.enableDirectionAdjust && (
                  <div className="space-y-1 col-span-2">
                    <p className="text-xs text-[#9090A0]">偏向比例 <span className="text-[#606070]">（偏向方向的格线占比，默认 70）</span></p>
                    <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <input type="number" min={50} max={90} step={5} value={gridParams.directionBiasRatio || ''}
                        onChange={(e) => updateGrid('directionBiasRatio', Number(e.target.value) || 70)}
                        placeholder="70" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                        aria-label="偏向比例"
                      />
                      <span className="text-[#606070] text-xs shrink-0">%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 提交按钮 ── */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className={`w-full py-4 bg-[#06B6D4] hover:bg-[#0891B2] text-white font-semibold rounded-xl transition-all duration-100 select-none ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] active:opacity-80'
            }`}
            aria-label="保存并启动"
            title="保存并启动"
          >
            {isSubmitting ? '创建中...' : '保存并启动'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className={`w-full py-3 bg-[#12121A] hover:bg-[#1A1A24] text-[#94A3B8] font-medium rounded-xl border border-[#1E1E2E] transition-all duration-100 select-none ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] active:opacity-80'
            }`}
            aria-label="仅保存"
            title="仅保存"
          >
            仅保存
          </button>
        </div>
      </main>
    </div>
  )
}

// ── 辅助组件：风控输入框 ──────────────────────────────────────

interface RiskFieldProps {
  label: string
  suffix: string
  prefix?: boolean
  children: React.ReactNode
}

function RiskField({ label, suffix, prefix = false, children }: RiskFieldProps) {
  return (
    <div>
      <p className="text-[10px] text-[#606070] mb-1">{label}</p>
      <div className="flex items-center gap-1 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
        {prefix && <span className="text-[#606070] text-xs flex-shrink-0">{suffix}</span>}
        {children}
        {!prefix && <span className="text-[#606070] text-xs flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

export default function Page() {
  return <CreateStrategyWizard />
}
