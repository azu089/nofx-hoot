/* eslint-disable react-hooks/immutability */
'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { ArrowLeft, ChevronDown, Check, Search, X, Loader2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/provider'
import { StrategyConfigData, hotPairs, fetchExchangePairs, getRecentPairs, addRecentPair } from '../shared/strategy-config-types'
import { useStrategySubscription, useApiKeys, useSubscriptionSummary, useExchangeBalance } from '@/hooks/use-strategy'
import type { SubscriptionSummary } from '@/hooks/use-strategy'

interface StrategyConfigPageProps {
  strategyId?: string
  strategyName?: string
  subscriptionId?: string
  onBack?: () => void
  onSave?: (config: StrategyConfigData) => void
  onCancel?: () => void
  onSuccess?: () => void
}

// Toggle
function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-label={label || (enabled ? '关闭' : '开启')}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// 输入框组件
function Input({ value, onChange, suffix, min, max, step = 1, title, className = '' }: {
  value: number | string
  onChange: (v: string) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
  title: string
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        type="number"
        title={title}
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-16 px-2 py-1.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded text-sm text-center focus:border-[#06B6D4] focus:outline-none"
      />
      {suffix && <span className="text-[#606070] text-sm">{suffix}</span>}
    </div>
  )
}

// 多策略风险提示 Banner
function RiskWarningBanner({
  summary,
  exchangeBalance,
  currentAmount,
  currentMaxPositions
}: {
  summary: SubscriptionSummary | null
  exchangeBalance: number | null
  currentAmount: number
  currentMaxPositions: number
}) {
  if (!summary) return null

  // 计算当前配置的敞口（新订阅或更新订阅）
  const currentExposure = currentAmount * currentMaxPositions

  // 总敞口 = 现有订阅总敞口 + 当前配置敞口
  const totalExposure = summary.totalMaxExposure + currentExposure

  // 如果有余额数据，计算占比
  const ratio = exchangeBalance ? totalExposure / exchangeBalance : null

  // 无活跃订阅且当前配置敞口较小时，显示简化提示
  if (summary.activeCount === 0 && currentAmount < 100) {
    return null
  }

  // 判断风险等级
  let level: 'info' | 'warning' | 'danger' = 'info'
  if (ratio && ratio >= 1) {
    level = 'danger'
  } else if (ratio && ratio >= 0.8) {
    level = 'warning'
  } else if (summary.activeCount >= 3) {
    level = 'warning'
  }

  const bgColor = {
    info: 'bg-[#06B6D4]/10 border-[#06B6D4]/30',
    warning: 'bg-[#F59E0B]/10 border-[#F59E0B]/30',
    danger: 'bg-[#EF4444]/10 border-[#EF4444]/30',
  }[level]

  const textColor = {
    info: 'text-[#06B6D4]',
    warning: 'text-[#F59E0B]',
    danger: 'text-[#EF4444]',
  }[level]

  const Icon = level === 'info' ? Info : AlertTriangle

  return (
    <div className={`flex items-start gap-3 p-4 ${bgColor} border rounded-xl mb-4`}>
      <Icon className={`w-5 h-5 ${textColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textColor}`}>
          {level === 'danger' ? '风险提示' : level === 'warning' ? '多策略配置提醒' : '订阅汇总'}
        </p>
        <div className="text-sm text-[#9090A0] mt-1 space-y-1">
          <p>
            已启用 <span className="text-white font-medium">{summary.activeCount}</span> 个策略，
            总最大敞口 <span className="text-white font-medium">${summary.totalMaxExposure.toFixed(2)}</span>
            {currentExposure > 0 && (
              <span className="text-[#606070]"> (+ 当前 ${currentExposure.toFixed(2)})</span>
            )}
          </p>
          {exchangeBalance && (
            <p>
              交易所余额 <span className="text-white font-medium">${exchangeBalance.toFixed(2)}</span>
              {ratio && (
                <span className={ratio >= 0.8 ? textColor : 'text-[#9090A0]'}>
                  {' '}（占比 {(ratio * 100).toFixed(0)}%）
                </span>
              )}
            </p>
          )}
          {level !== 'info' && (
            <p className="text-xs text-[#606070] mt-2">
              并发信号触发时可能导致余额不足，建议降低单笔金额或减少同时运行的策略数量
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function StrategyConfigPage({ strategyId, strategyName = 'MACD趋势跟踪策略', subscriptionId, onBack, onSave, onCancel, onSuccess }: StrategyConfigPageProps) {
  const tc = useTranslations('common')
  // API Hooks
  const { loading: apiLoading, createSubscription, updateSubscription, getSubscriptionConfig } = useStrategySubscription(strategyId || '')
  const { apiKeys, fetchApiKeys, loading: apiKeysLoading } = useApiKeys()
  const { summary, fetchSummary } = useSubscriptionSummary()

  // 是否已加载现有配置
  const [configLoaded, setConfigLoaded] = useState(false)
  const configLoadingRef = useRef(false)

  // 选中的 API Key
  const [selectedApiKeyId, setSelectedApiKeyId] = useState('')
  const [showApiKeyDD, setShowApiKeyDD] = useState(false)

  // 交易所余额
  const { balance: exchangeBalance, fetchBalance } = useExchangeBalance(selectedApiKeyId)

  // 加载用户的 API Keys 和订阅汇总
  useEffect(() => {
    fetchApiKeys().catch(() => {
      // 加载失败时静默处理，用户可以手动重试
    })
    fetchSummary().catch(() => {
      // 加载失败时静默处理
    })
  }, [fetchApiKeys, fetchSummary])

  // 当选择 API Key 后，获取余额
  useEffect(() => {
    if (selectedApiKeyId) {
      fetchBalance().catch(() => {
        // 静默处理
      })
    }
  }, [selectedApiKeyId, fetchBalance])

  // 编辑模式：加载现有订阅配置（需要等 apiKeys 加载完成）
  useEffect(() => {
    if (subscriptionId && !configLoaded && !configLoadingRef.current && apiKeys.length > 0) {
      configLoadingRef.current = true
      getSubscriptionConfig(subscriptionId)
        .then((config) => {
          // 设置基础配置
          setSelectedApiKeyId(config.apiKeyId)
          // 从 apiKeys 列表找到对应的交易所
          const matchedApiKey = apiKeys.find(k => k.id === config.apiKeyId)
          if (matchedApiKey) {
            setExchange(matchedApiKey.exchange)
          }
          setTradingType(config.tradingType)
          setTradingPairs(config.tradingPairs)
          setAmount(String(config.positionAmount))
          setDirection(config.direction)
          // 设置交易参数
          setLeverage(String(config.leverage))
          setMarginMode(config.marginMode)
          setMaxPositions(String(config.maxPositions))
          setTakeProfit(String(config.takeProfit))
          setStopLoss(String(config.stopLoss))
          setSlippage(String(config.slippage))
          // 设置移动止损
          setTrailingEnabled(config.trailingStopEnabled)
          setTrailingActivation(String(config.trailingActivation))
          setTrailingCallback(String(config.trailingCallback))
          // 设置 DCA
          setDcaEnabled(config.dcaEnabled)
          setDcaCount(String(config.dcaCount))
          setDcaTrigger(String(config.dcaTrigger))
          setDcaMultiplier(String(config.dcaMultiplier))
          setWaterfallProtection(config.waterfallProtection)
          setWaterfallTrigger(String(config.waterfallTrigger))
          // 设置风控
          setBlackSwanEnabled(config.blackSwanEnabled)
          setBlackSwanTrigger(String(config.blackSwanTrigger))
          setBlackSwanAction(config.blackSwanAction)
          setDailyLossEnabled(config.dailyLossEnabled)
          setDailyLossPercent(String(config.dailyLossPercent))
          setDailyLossAction(config.dailyLossAction)
          setConfigLoaded(true)
        })
        .catch(() => {
          // 加载失败时使用默认配置
          setConfigLoaded(true)
        })
    }
  }, [subscriptionId, configLoaded, apiKeys, getSubscriptionConfig])

  // 当 API Keys 加载完成后，自动选择第一个（仅新建模式）
  useEffect(() => {
    if (apiKeys.length > 0 && !selectedApiKeyId && !subscriptionId) {
      setSelectedApiKeyId(apiKeys[0].id)
      setExchange(apiKeys[0].exchange)
    }
  }, [apiKeys, selectedApiKeyId, subscriptionId])

  // 基础配置 (using literal values to avoid immutability issues)
  const [exchange, setExchange] = useState('binance')
  const [tradingType, setTradingType] = useState<'spot' | 'futures'>('futures')
  const [tradingPairs, setTradingPairs] = useState<string[]>(['BTC/USDT', 'ETH/USDT'])
  const [amount, setAmount] = useState('100')

  // 交易参数
  const [direction, setDirection] = useState<'long' | 'short' | 'both'>('both')
  const [leverage, setLeverage] = useState('5')
  const [marginMode, setMarginMode] = useState<'cross' | 'isolated'>('isolated')
  const [maxPositions, setMaxPositions] = useState('3')
  const [takeProfit, setTakeProfit] = useState('15')
  const [stopLoss, setStopLoss] = useState('10')
  const [slippage, setSlippage] = useState('0.5')

  // 移动止损
  const [trailingEnabled, setTrailingEnabled] = useState(false)
  const [trailingActivation, setTrailingActivation] = useState('8')
  const [trailingCallback, setTrailingCallback] = useState('3')

  // DCA
  const [dcaEnabled, setDcaEnabled] = useState(false)
  const [dcaCount, setDcaCount] = useState('3')
  const [dcaTrigger, setDcaTrigger] = useState('5')
  const [dcaMultiplier, setDcaMultiplier] = useState('1.5')
  const [waterfallProtection, setWaterfallProtection] = useState(true)
  const [waterfallTrigger, setWaterfallTrigger] = useState('15')

  // 风控
  const [blackSwanEnabled, setBlackSwanEnabled] = useState(false)
  const [blackSwanTrigger, setBlackSwanTrigger] = useState('10')
  const [blackSwanAction, setBlackSwanAction] = useState<'close_all' | 'close_half' | 'pause'>('close_all')
  const [dailyLossEnabled, setDailyLossEnabled] = useState(false)
  const [dailyLossPercent, setDailyLossPercent] = useState('20')
  const [dailyLossAction, setDailyLossAction] = useState<'close_all' | 'close_half' | 'pause'>('close_all')

  // UI
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [pairSearch, setPairSearch] = useState('')
  const [showPairPicker, setShowPairPicker] = useState(false)

  // 动态加载的交易对
  const [availablePairs, setAvailablePairs] = useState<string[]>([])
  const [recentPairs, setRecentPairs] = useState<string[]>([])
  const [loadingPairs, setLoadingPairs] = useState(false)

  // 加载交易所支持的币种
  useEffect(() => {
    setLoadingPairs(true)
    fetchExchangePairs(exchange).then(pairs => {
      setAvailablePairs(pairs)
      setLoadingPairs(false)
    })
    // 加载用户常用币种
    setRecentPairs(getRecentPairs())
  }, [exchange])

  // 显示的币种：搜索时显示搜索结果，否则显示热门+常用
  const displayPairs = useMemo(() => {
    if (pairSearch) {
      // 搜索模式：从所有可用币种中筛选
      return availablePairs.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase()))
    }
    // 默认模式：热门 + 最近使用（去重）
    const combined = [...hotPairs]
    recentPairs.forEach(p => {
      if (!combined.includes(p)) combined.push(p)
    })
    // 只显示当前交易所支持的
    return combined.filter(p => availablePairs.includes(p))
  }, [pairSearch, availablePairs, recentPairs])

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const amountNum = parseFloat(amount) || 0
  const isValid = selectedApiKeyId && amountNum >= 5

  const togglePair = (pair: string) => {
    setTradingPairs(prev => {
      if (prev.includes(pair)) {
        return prev.filter(p => p !== pair)
      } else {
        // 添加到常用币种缓存
        addRecentPair(pair)
        setRecentPairs(getRecentPairs())
        return [...prev, pair]
      }
    })
  }

  const handleSave = async () => {
    // 验证 API Key
    if (!selectedApiKeyId) {
      toast.error(tc('selectApiKey'))
      return
    }

    const data: StrategyConfigData = {
      apiKeyId: selectedApiKeyId,
      exchange,
      tradingType,
      tradingPairs,
      positionAmount: amountNum,
      direction,
      leverage: tradingType === 'futures' ? parseFloat(leverage) || 1 : 1,
      marginMode,
      maxPositions: parseInt(maxPositions) || 3,
      takeProfit: parseFloat(takeProfit) || 15,
      stopLoss: parseFloat(stopLoss) || 10,
      slippage: parseFloat(slippage) || 0.5,
      trailingStopEnabled: trailingEnabled,
      trailingActivation: parseFloat(trailingActivation) || 8,
      trailingCallback: parseFloat(trailingCallback) || 3,
      dcaEnabled,
      dcaCount: parseInt(dcaCount) || 3,
      dcaTrigger: parseFloat(dcaTrigger) || 5,
      dcaMultiplier: parseFloat(dcaMultiplier) || 1.5,
      waterfallProtection,
      waterfallTrigger: parseFloat(waterfallTrigger) || 15,
      blackSwanEnabled,
      blackSwanTrigger: parseFloat(blackSwanTrigger) || 10,
      blackSwanAction,
      dailyLossEnabled,
      dailyLossPercent: parseFloat(dailyLossPercent) || 20,
      dailyLossAction,
    }

    // 如果有 strategyId，调用后端 API
    if (strategyId) {
      try {
        if (subscriptionId) {
          // 更新模式
          await updateSubscription(subscriptionId, data)
          toast.success(tc('configUpdated'))
        } else {
          // 创建模式
          await createSubscription(data)
          toast.success(tc('subscribeSuccess'))
        }
        onSuccess?.()
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('保存失败:', err)
        }
        toast.error(tc('saveFailed'), {
          description: err instanceof Error ? err.message : undefined,
        })
        return
      }
    } else {
      // 本地预览模式
      toast.success(tc('configSaved'))
    }

    // 调用父组件回调
    onSave?.(data)
  }

  // 当前选中的 API Key（防御性检查）
  const selectedApiKey = Array.isArray(apiKeys) ? apiKeys.find(k => k.id === selectedApiKeyId) : undefined

  return (
    <div className="h-full flex flex-col bg-[#0A0A0F] text-white">
      {/* 顶栏 */}
      <div className="flex-shrink-0 border-b border-[#1E1E2E]">
        <div className="flex items-center gap-4 px-6 py-4 max-w-4xl mx-auto">
          <button type="button" onClick={onBack} aria-label="返回" className="p-2 -ml-2 rounded-lg hover:bg-[#1E1E2E]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">订阅配置</h1>
            <p className="text-sm text-[#606070]">{strategyName}</p>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* 多策略风险提示 Banner */}
          <RiskWarningBanner
            summary={summary}
            exchangeBalance={exchangeBalance}
            currentAmount={amountNum}
            currentMaxPositions={parseInt(maxPositions) || 3}
          />

          {/* === 基础配置 === */}
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 space-y-5">
            {/* API Key 选择提示 */}
            {apiKeys.length === 0 && !apiKeysLoading && (
              <div className="flex items-center gap-3 p-4 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-[#F59E0B]">您还没有绑定交易所 API Key</p>
                  <p className="text-xs text-[#9090A0] mt-1">请先到「钱包 - API 管理」绑定交易所 API Key 后再订阅策略</p>
                </div>
              </div>
            )}

            {/* 第一行：API Key + 类型 + 方向 + 金额 */}
            <div className="grid grid-cols-4 gap-4">
              {/* API Key 选择器 */}
              <div className="relative">
                <label className="block text-xs text-[#606070] mb-2">交易所 API</label>
                <button
                  type="button"
                  onClick={() => setShowApiKeyDD(!showApiKeyDD)}
                  disabled={apiKeysLoading || apiKeys.length === 0}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg hover:border-[#2A2A3A] disabled:opacity-50"
                >
                  {apiKeysLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#606070]" />
                      <span className="text-[#606070]">加载中...</span>
                    </div>
                  ) : selectedApiKey ? (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedApiKey.isActive ? 'bg-green-400' : 'bg-[#606070]'}`} />
                      <span>{selectedApiKey.exchange}</span>
                      <span className="text-xs text-[#606070]">({selectedApiKey.label})</span>
                    </div>
                  ) : (
                    <span className="text-[#606070]">{apiKeys.length === 0 ? '请先绑定 API Key' : '选择 API Key'}</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showApiKeyDD ? 'rotate-180' : ''}`} />
                </button>
                {showApiKeyDD && apiKeys.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg z-30 overflow-hidden max-h-60 overflow-y-auto">
                    {apiKeys.map(key => (
                      <button
                        key={key.id}
                        type="button"
                        onClick={() => {
                          setSelectedApiKeyId(key.id)
                          setExchange(key.exchange)
                          setShowApiKeyDD(false)
                        }}
                        disabled={!key.isActive}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1E1E2E] disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${key.isActive ? 'bg-green-400' : 'bg-[#606070]'}`} />
                          <span>{key.exchange}</span>
                          <span className="text-xs text-[#606070]">({key.label})</span>
                        </div>
                        {selectedApiKeyId === key.id && <Check className="w-4 h-4 text-[#06B6D4]" />}
                        {!key.isActive && <span className="text-xs text-[#606070]">已禁用</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 交易类型 */}
              <div>
                <label className="block text-xs text-[#606070] mb-2">类型</label>
                <div className="flex bg-[#0A0A0F] rounded-lg p-0.5 border border-[#1E1E2E]">
                  <button
                    type="button"
                    onClick={() => setTradingType('spot')}
                    className={`flex-1 py-2.5 rounded-md text-sm font-medium ${tradingType === 'spot' ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
                  >
                    现货
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradingType('futures')}
                    className={`flex-1 py-2.5 rounded-md text-sm font-medium ${tradingType === 'futures' ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
                  >
                    合约
                  </button>
                </div>
              </div>

              {/* 方向 */}
              <div>
                <label className="block text-xs text-[#606070] mb-2">方向</label>
                <div className="flex bg-[#0A0A0F] rounded-lg p-0.5 border border-[#1E1E2E]">
                  {(['long', 'both', 'short'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={`flex-1 py-2.5 rounded-md text-sm font-medium ${direction === d ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0] hover:text-white'}`}
                    >
                      {d === 'long' ? '多' : d === 'short' ? '空' : '双向'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 金额 */}
              <div>
                <label className="block text-xs text-[#606070] mb-2">每笔金额</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#606070]">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="100"
                    title="每笔金额"
                    min={5}
                    max={100000}
                    className="w-full pl-8 pr-4 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 选中的 API Key 信息 */}
            {selectedApiKey && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#606070]">已选择:</span>
                <span className="text-[#06B6D4] font-medium">{selectedApiKey.exchange} - {selectedApiKey.label}</span>
              </div>
            )}

            {/* 交易对 - 紧凑布局 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#606070]">交易对</span>
                <button
                  type="button"
                  onClick={() => setShowPairPicker(!showPairPicker)}
                  className="text-xs text-[#06B6D4]"
                >
                  {showPairPicker ? '收起' : '选择更多'}
                </button>
              </div>
              {/* 已选标签 */}
              <div
                className="flex flex-wrap items-center gap-2 p-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg min-h-[48px] cursor-text"
                onClick={() => setShowPairPicker(true)}
              >
                {tradingPairs.map(pair => (
                  <span
                    key={pair}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded-md text-sm"
                  >
                    {pair.replace('/USDT', '')}
                    <X className="w-3.5 h-3.5 cursor-pointer hover:text-white" onClick={(e) => { e.stopPropagation(); togglePair(pair) }} />
                  </span>
                ))}
                {tradingPairs.length === 0 && (
                  <span className="text-sm text-[#606070]">点击选择交易对...</span>
                )}
              </div>
              {/* 展开选择器 */}
              {showPairPicker && (
                <div className="mt-3 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
                    <input
                      type="text"
                      value={pairSearch}
                      onChange={e => setPairSearch(e.target.value)}
                      placeholder="搜索更多币种..."
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                  {!pairSearch && recentPairs.length > 0 && (
                    <div className="text-xs text-[#606070]">热门 & 常用</div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {loadingPairs ? (
                      <span className="text-sm text-[#606070] py-2">加载中...</span>
                    ) : displayPairs.length > 0 ? (
                      displayPairs.map(pair => (
                        <button
                          key={pair}
                          type="button"
                          onClick={() => { togglePair(pair); setPairSearch('') }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            tradingPairs.includes(pair)
                              ? 'bg-[#06B6D4] text-black'
                              : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                          }`}
                        >
                          {pair.replace('/USDT', '')}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-[#606070] py-2">{pairSearch ? '未找到匹配的交易对' : '暂无数据'}</span>
                    )}
                  </div>
                  {pairSearch && displayPairs.length > 0 && (
                    <div className="text-xs text-[#606070]">共 {availablePairs.length} 个币种可选</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* === 交易参数 === */}
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 space-y-4">
            <div className="text-xs text-[#606070] font-medium">交易参数</div>

            {/* 合约专属 + 通用参数 统一网格 */}
            <div className={`grid gap-4 ${tradingType === 'futures' ? 'grid-cols-6' : 'grid-cols-4'}`}>
              {/* 合约专属：杠杆 + 保证金 */}
              {tradingType === 'futures' && (
                <>
                  <div>
                    <label className="block text-xs text-[#606070] mb-2">杠杆</label>
                    <div className="flex items-center gap-1 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
                      <input
                        type="number"
                        title="杠杆倍数"
                        value={leverage}
                        onChange={e => setLeverage(e.target.value)}
                        min={1}
                        max={125}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                      <span className="text-[#606070] text-sm">x</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-2">保证金</label>
                    <div className="flex bg-[#0A0A0F] rounded-lg p-0.5 border border-[#1E1E2E]">
                      <button
                        type="button"
                        onClick={() => setMarginMode('cross')}
                        className={`flex-1 py-2.5 rounded-md text-sm font-medium ${marginMode === 'cross' ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
                      >
                        全仓
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarginMode('isolated')}
                        className={`flex-1 py-2.5 rounded-md text-sm font-medium ${marginMode === 'isolated' ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
                      >
                        逐仓
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* 通用参数 */}
              <div>
                <label className="block text-xs text-[#606070] mb-2">最大持仓</label>
                <div className="flex items-center gap-1 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
                  <input
                    type="number"
                    title="最大持仓"
                    value={maxPositions}
                    onChange={e => setMaxPositions(e.target.value)}
                    min={1}
                    max={10}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                  <span className="text-[#606070] text-sm">仓</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#606070] mb-2">滑点容忍</label>
                <div className="flex items-center gap-1 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
                  <input
                    type="number"
                    title="滑点容忍"
                    value={slippage}
                    onChange={e => setSlippage(e.target.value)}
                    min={0.1}
                    max={5}
                    step={0.1}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                  <span className="text-[#606070] text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#10B981] mb-2">止盈</label>
                <div className="flex items-center gap-1 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
                  <input
                    type="number"
                    title="止盈"
                    value={takeProfit}
                    onChange={e => setTakeProfit(e.target.value)}
                    min={0.1}
                    max={500}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                  <span className="text-[#606070] text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#F43F5E] mb-2">止损</label>
                <div className="flex items-center gap-1 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
                  <input
                    type="number"
                    title="止损"
                    value={stopLoss}
                    onChange={e => setStopLoss(e.target.value)}
                    min={0.1}
                    max={50}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                  <span className="text-[#606070] text-sm">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* === 高级配置（合并卡片） === */}
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 space-y-5">
            {/* 移动止损 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">移动止损</span>
                <Toggle enabled={trailingEnabled} onChange={setTrailingEnabled} label="移动止损" />
              </div>
              {trailingEnabled && (
                <div className="pl-4 space-y-3">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#606070]">激活盈利</span>
                      <Input value={trailingActivation} onChange={setTrailingActivation} suffix="%" min={1} max={100} title="激活盈利" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#606070]">回撤触发</span>
                      <Input value={trailingCallback} onChange={setTrailingCallback} suffix="%" min={0.5} max={50} step={0.5} title="回撤" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 智能补仓 DCA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">智能补仓 DCA</span>
                <Toggle enabled={dcaEnabled} onChange={setDcaEnabled} label="DCA" />
              </div>
              {dcaEnabled && (
                <div className="pl-4 space-y-3">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#606070]">最大次数</span>
                      <Input value={dcaCount} onChange={setDcaCount} suffix="次" min={1} max={10} title="次数" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#606070]">触发跌幅</span>
                      <Input value={dcaTrigger} onChange={setDcaTrigger} suffix="%" min={1} max={50} title="跌幅" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#606070]">补仓倍率</span>
                      <Input value={dcaMultiplier} onChange={setDcaMultiplier} suffix="x" min={1} max={5} step={0.1} title="倍率" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#606070]">防瀑布</span>
                    <div className="flex items-center gap-3">
                      {waterfallProtection && <Input value={waterfallTrigger} onChange={setWaterfallTrigger} suffix="%" min={5} max={50} title="瀑布触发" />}
                      <Toggle enabled={waterfallProtection} onChange={setWaterfallProtection} label="防瀑布" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 风控保护 */}
            <div className="space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('risk')}
              >
                <span className="text-sm">风控保护</span>
                <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${expandedSection === 'risk' ? 'rotate-180' : ''}`} />
              </div>
              {expandedSection === 'risk' && (
                <div className="pl-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#606070]">黑天鹅保护</span>
                    <div className="flex items-center gap-3">
                      {blackSwanEnabled && <Input value={blackSwanTrigger} onChange={setBlackSwanTrigger} suffix="%" min={5} max={50} title="阈值" />}
                      <Toggle enabled={blackSwanEnabled} onChange={setBlackSwanEnabled} label="黑天鹅" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#606070]">单日最大亏损</span>
                    <div className="flex items-center gap-3">
                      {dailyLossEnabled && <Input value={dailyLossPercent} onChange={setDailyLossPercent} suffix="%" min={5} max={100} title="单日亏损" />}
                      <Toggle enabled={dailyLossEnabled} onChange={setDailyLossEnabled} label="单日亏损" />
                    </div>
                  </div>
                  {(blackSwanEnabled || dailyLossEnabled) && (
                    <div className="flex gap-3">
                      {(['close_all', 'close_half', 'pause'] as const).map(action => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => { setBlackSwanAction(action); setDailyLossAction(action); }}
                          className={`flex-1 py-2 rounded-lg text-sm ${blackSwanAction === action ? 'bg-[#06B6D4] text-black' : 'bg-[#1E1E2E] text-[#606070] hover:bg-[#2A2A3A]'}`}
                        >
                          {action === 'close_all' ? '全平' : action === 'close_half' ? '减半' : '暂停'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部栏 */}
      <div className="flex-shrink-0 border-t border-[#1E1E2E] p-4 bg-[#0A0A0F]">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button type="button" onClick={onCancel} disabled={apiLoading} className="flex-1 py-3 border border-[#1E1E2E] rounded-xl text-[#9090A0] hover:bg-[#1E1E2E] disabled:opacity-50">取消</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || apiLoading}
            className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${isValid && !apiLoading ? 'bg-[#06B6D4] text-white hover:bg-[#06B6D4]/80' : 'bg-[#2A2A3A] text-[#606070] cursor-not-allowed'}`}
          >
            {apiLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : !selectedApiKeyId ? (
              '请选择 API Key'
            ) : amountNum < 5 ? (
              '最低 $5'
            ) : subscriptionId ? (
              '更新配置'
            ) : (
              '订阅策略'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
