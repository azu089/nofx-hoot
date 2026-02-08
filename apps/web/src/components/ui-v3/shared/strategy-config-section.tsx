'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronDown, Check, Search, X, AlertTriangle } from 'lucide-react'
import {
  StrategyConfigData,
  exchanges as defaultExchanges,
  defaultConfig,
  hotPairs,
  fetchExchangePairs,
  getRecentPairs,
  addRecentPair
} from './strategy-config-types'

interface ExchangeOption {
  id: string
  name: string
  connected?: boolean
  balance?: number
}

interface StrategyConfigSectionProps {
  config: StrategyConfigData
  onChange: (config: StrategyConfigData) => void
  showExchangeSelect?: boolean // 是否显示交易所选择
  exchanges?: ExchangeOption[] // 可选的交易所列表（从 API 获取）
  className?: string
}

// Toggle
function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-label={label || (enabled ? '关闭' : '开启')}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// 输入框组件
function Input({ value, onChange, suffix, min, max, step = 1, title }: {
  value: number | string
  onChange: (v: string) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
  title: string
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        title={title}
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-14 px-2 py-1.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded text-sm text-center focus:border-[#06B6D4] focus:outline-none"
      />
      {suffix && <span className="text-[#606070] text-xs">{suffix}</span>}
    </div>
  )
}

export function StrategyConfigSection({
  config,
  onChange,
  showExchangeSelect = true,
  exchanges,
  className = ''
}: StrategyConfigSectionProps) {
  // 使用传入的 exchanges 或默认值
  const exchangeList = exchanges || defaultExchanges

  // UI 状态
  const [showExchangeDD, setShowExchangeDD] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [pairSearch, setPairSearch] = useState('')
  const [showPairPicker, setShowPairPicker] = useState(false)
  const [availablePairs, setAvailablePairs] = useState<string[]>([])
  const [recentPairs, setRecentPairs] = useState<string[]>([])
  const [loadingPairs, setLoadingPairs] = useState(false)

  // 加载交易所支持的币种
  useEffect(() => {
    queueMicrotask(() => setLoadingPairs(true))
    fetchExchangePairs(config.exchange).then(pairs => {
      queueMicrotask(() => {
        setAvailablePairs(pairs)
        setLoadingPairs(false)
      })
    })
    queueMicrotask(() => setRecentPairs(getRecentPairs()))
  }, [config.exchange])

  // 显示的币种
  const displayPairs = useMemo(() => {
    if (pairSearch) {
      return availablePairs.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase()))
    }
    const combined = [...hotPairs]
    recentPairs.forEach(p => {
      if (!combined.includes(p)) combined.push(p)
    })
    return combined.filter(p => availablePairs.includes(p))
  }, [pairSearch, availablePairs, recentPairs])

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const currentExchange = exchangeList.find(e => e.id === config.exchange)

  // 更新配置的辅助函数
  const updateConfig = (partial: Partial<StrategyConfigData>) => {
    onChange({ ...config, ...partial })
  }

  const togglePair = (pair: string) => {
    const newPairs = config.tradingPairs.includes(pair)
      ? config.tradingPairs.filter(p => p !== pair)
      : [...config.tradingPairs, pair]

    if (!config.tradingPairs.includes(pair)) {
      addRecentPair(pair)
      setRecentPairs(getRecentPairs())
    }

    updateConfig({ tradingPairs: newPairs })
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* === 基础配置 === */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        {/* 交易所选择 */}
        {showExchangeSelect && (
          <div className="relative">
            <div className="text-[10px] text-[#606070] mb-1.5">交易所</div>
            <button
              type="button"
              onClick={() => setShowExchangeDD(!showExchangeDD)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="font-medium">{config.exchange}</span>
              </div>
              <div className="flex items-center gap-2">
                {currentExchange?.balance && <span className="text-[#06B6D4] text-sm font-medium">${currentExchange.balance.toLocaleString()}</span>}
                <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showExchangeDD ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {showExchangeDD && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg z-30 overflow-hidden">
                {exchangeList.map(ex => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => { updateConfig({ exchange: ex.id }); setShowExchangeDD(false) }}
                    disabled={!ex.connected}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#1E1E2E] disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${ex.connected ? 'bg-green-400' : 'bg-[#606070]'}`} />
                      <span>{ex.name}</span>
                    </div>
                    {ex.connected && config.exchange === ex.id && <Check className="w-4 h-4 text-[#06B6D4]" />}
                    {!ex.connected && <span className="text-xs text-[#606070]">未连接</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 类型 + 方向 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-[#606070] mb-1.5">类型</div>
            <div className="flex bg-[#0A0A0F] rounded-lg p-0.5 border border-[#1E1E2E]">
              <button
                type="button"
                onClick={() => updateConfig({ tradingType: 'spot' })}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${config.tradingType === 'spot' ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
              >
                现货
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ tradingType: 'futures' })}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${config.tradingType === 'futures' ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
              >
                合约
              </button>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#606070] mb-1.5">方向</div>
            <div className="flex bg-[#0A0A0F] rounded-lg p-0.5 border border-[#1E1E2E]">
              {(['long', 'both', 'short'] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => updateConfig({ direction: d })}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${config.direction === d ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
                >
                  {d === 'long' ? '多' : d === 'short' ? '空' : '双向'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 金额 */}
        <div>
          <div className="text-[10px] text-[#606070] mb-1.5">每笔金额</div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606070]">$</span>
            <input
              type="number"
              value={config.positionAmount}
              onChange={e => updateConfig({ positionAmount: parseFloat(e.target.value) || 0 })}
              placeholder="100"
              title="每笔金额"
              min={5}
              max={100000}
              className="w-full pl-7 pr-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
            />
          </div>
        </div>

        {/* 交易对 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-[#606070]">交易对</span>
            <button
              type="button"
              onClick={() => setShowPairPicker(!showPairPicker)}
              className="text-[10px] text-[#06B6D4]"
            >
              {showPairPicker ? '收起' : '选择'}
            </button>
          </div>
          <div
            className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg min-h-[40px] cursor-text"
            onClick={() => setShowPairPicker(true)}
          >
            {config.tradingPairs.map(pair => (
              <span
                key={pair}
                className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs"
              >
                {pair.replace('/USDT', '')}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={(e) => { e.stopPropagation(); togglePair(pair) }} />
              </span>
            ))}
            {config.tradingPairs.length === 0 && (
              <span className="text-xs text-[#606070]">点击选择交易对...</span>
            )}
          </div>
          {showPairPicker && (
            <div className="mt-2 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
                <input
                  type="text"
                  value={pairSearch}
                  onChange={e => setPairSearch(e.target.value)}
                  placeholder="搜索更多币种..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                />
              </div>
              {!pairSearch && recentPairs.length > 0 && (
                <div className="text-[10px] text-[#606070]">常用</div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {loadingPairs ? (
                  <span className="text-xs text-[#606070] py-2">加载中...</span>
                ) : displayPairs.length > 0 ? (
                  displayPairs.map(pair => (
                    <button
                      key={pair}
                      type="button"
                      onClick={() => { togglePair(pair); setPairSearch('') }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        config.tradingPairs.includes(pair)
                          ? 'bg-[#06B6D4] text-black'
                          : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                      }`}
                    >
                      {pair.replace('/USDT', '')}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-[#606070] py-2">{pairSearch ? '未找到' : '暂无数据'}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* === 交易参数 === */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-3">
        <div className="text-[10px] text-[#606070] font-medium">交易参数</div>

        {/* 合约专属：杠杆 + 保证金模式 */}
        {config.tradingType === 'futures' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-[#606070] mb-1">杠杆</div>
              <div className="flex items-center gap-1 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
                <input
                  type="number"
                  title="杠杆倍数"
                  value={config.leverage}
                  onChange={e => updateConfig({ leverage: parseInt(e.target.value) || 1 })}
                  min={1}
                  max={125}
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
                <span className="text-[#606070] text-sm">x</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#606070] mb-1">保证金</div>
              <div className="flex bg-[#0A0A0F] rounded-lg p-0.5 border border-[#1E1E2E]">
                <button
                  type="button"
                  onClick={() => updateConfig({ marginMode: 'cross' })}
                  className={`flex-1 py-2 rounded-md text-xs font-medium ${config.marginMode === 'cross' ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
                >
                  全仓
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ marginMode: 'isolated' })}
                  className={`flex-1 py-2 rounded-md text-xs font-medium ${config.marginMode === 'isolated' ? 'bg-[#06B6D4] text-black' : 'text-[#9090A0]'}`}
                >
                  逐仓
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 持仓 + 滑点 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] text-[#606070] mb-1">最大持仓</div>
            <div className="flex items-center gap-1 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
              <input
                type="number"
                title="最大持仓"
                value={config.maxPositions}
                onChange={e => updateConfig({ maxPositions: parseInt(e.target.value) || 1 })}
                min={1}
                max={10}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
              <span className="text-[#606070] text-sm">仓</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#606070] mb-1">滑点容忍</div>
            <div className="flex items-center gap-1 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
              <input
                type="number"
                title="滑点容忍"
                value={config.slippage}
                onChange={e => updateConfig({ slippage: parseFloat(e.target.value) || 0.5 })}
                min={0.1}
                max={5}
                step={0.1}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
              <span className="text-[#606070] text-sm">%</span>
            </div>
          </div>
        </div>

        {/* 止盈止损 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] text-[#10B981] mb-1">止盈</div>
            <div className="flex items-center gap-1 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
              <input
                type="number"
                title="止盈"
                value={config.takeProfit}
                onChange={e => updateConfig({ takeProfit: parseFloat(e.target.value) || 0 })}
                min={0.1}
                max={500}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
              <span className="text-[#606070] text-sm">%</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#F43F5E] mb-1">止损</div>
            <div className="flex items-center gap-1 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg">
              <input
                type="number"
                title="止损"
                value={config.stopLoss}
                onChange={e => updateConfig({ stopLoss: parseFloat(e.target.value) || 0 })}
                min={0.1}
                max={50}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
              <span className="text-[#606070] text-sm">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* === 高级配置 === */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        {/* 移动止损 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">移动止损</span>
            <Toggle
              enabled={config.trailingStopEnabled}
              onChange={v => updateConfig({ trailingStopEnabled: v })}
              label="移动止损"
            />
          </div>
          {config.trailingStopEnabled && (
            <div className="pl-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#606070]">激活盈利</span>
                <Input
                  value={config.trailingActivation}
                  onChange={v => updateConfig({ trailingActivation: parseFloat(v) || 0 })}
                  suffix="%"
                  min={1}
                  max={100}
                  title="激活盈利"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#606070]">回撤触发</span>
                <Input
                  value={config.trailingCallback}
                  onChange={v => updateConfig({ trailingCallback: parseFloat(v) || 0 })}
                  suffix="%"
                  min={0.5}
                  max={50}
                  step={0.5}
                  title="回撤触发"
                />
              </div>
            </div>
          )}
        </div>

        {/* 智能补仓 DCA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">智能补仓 DCA</span>
            <Toggle
              enabled={config.dcaEnabled}
              onChange={v => updateConfig({ dcaEnabled: v })}
              label="智能补仓"
            />
          </div>
          {config.dcaEnabled && (
            <div className="pl-2 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#606070]">次数</span>
                  <Input
                    value={config.dcaCount}
                    onChange={v => updateConfig({ dcaCount: parseInt(v) || 1 })}
                    suffix=""
                    min={1}
                    max={10}
                    title="补仓次数"
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#606070]">跌幅</span>
                  <Input
                    value={config.dcaTrigger}
                    onChange={v => updateConfig({ dcaTrigger: parseFloat(v) || 0 })}
                    suffix="%"
                    min={1}
                    max={50}
                    title="触发跌幅"
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#606070]">倍率</span>
                  <Input
                    value={config.dcaMultiplier}
                    onChange={v => updateConfig({ dcaMultiplier: parseFloat(v) || 1 })}
                    suffix="x"
                    min={1}
                    max={5}
                    step={0.1}
                    title="补仓倍率"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs text-[#606070]">防瀑布</span>
                </div>
                <div className="flex items-center gap-2">
                  {config.waterfallProtection && (
                    <Input
                      value={config.waterfallTrigger}
                      onChange={v => updateConfig({ waterfallTrigger: parseFloat(v) || 0 })}
                      suffix="%"
                      min={5}
                      max={50}
                      title="防瀑布触发"
                    />
                  )}
                  <Toggle
                    enabled={config.waterfallProtection}
                    onChange={v => updateConfig({ waterfallProtection: v })}
                    label="防瀑布"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 风控保护 */}
        <div className="space-y-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('risk')}
          >
            <span className="text-sm">风控保护</span>
            <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${expandedSection === 'risk' ? 'rotate-180' : ''}`} />
          </div>
          {expandedSection === 'risk' && (
            <div className="pl-2 space-y-3">
              {/* 黑天鹅保护 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#606070]">黑天鹅保护</span>
                <div className="flex items-center gap-2">
                  {config.blackSwanEnabled && (
                    <Input
                      value={config.blackSwanTrigger}
                      onChange={v => updateConfig({ blackSwanTrigger: parseFloat(v) || 0 })}
                      suffix="%"
                      min={5}
                      max={50}
                      title="触发阈值"
                    />
                  )}
                  <Toggle
                    enabled={config.blackSwanEnabled}
                    onChange={v => updateConfig({ blackSwanEnabled: v })}
                    label="黑天鹅"
                  />
                </div>
              </div>

              {/* 单日最大亏损 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#606070]">单日最大亏损</span>
                <div className="flex items-center gap-2">
                  {config.dailyLossEnabled && (
                    <Input
                      value={config.dailyLossPercent}
                      onChange={v => updateConfig({ dailyLossPercent: parseFloat(v) || 0 })}
                      suffix="%"
                      min={5}
                      max={100}
                      title="单日亏损"
                    />
                  )}
                  <Toggle
                    enabled={config.dailyLossEnabled}
                    onChange={v => updateConfig({ dailyLossEnabled: v })}
                    label="单日亏损"
                  />
                </div>
              </div>

              {/* 共用动作按钮 */}
              {(config.blackSwanEnabled || config.dailyLossEnabled) && (
                <div className="flex gap-2">
                  {(['close_all', 'close_half', 'pause'] as const).map(action => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => updateConfig({ blackSwanAction: action, dailyLossAction: action })}
                      className={`flex-1 py-1.5 rounded text-xs ${config.blackSwanAction === action ? 'bg-[#06B6D4] text-black' : 'bg-[#1E1E2E] text-[#606070]'}`}
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
  )
}

// 导出默认配置供外部使用
export { defaultConfig }
