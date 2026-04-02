'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Copy,
  Check,
  Plus,
  X,
  Loader2
} from 'lucide-react'
import { StrategyConfigSection } from '../shared/strategy-config-section'
import { StrategyConfigData, defaultConfig } from '../shared/strategy-config-types'
import { useStrategySubscription, useApiKeys } from '@/hooks/use-strategy'
import { useTranslations } from '@/i18n/provider'
import { useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

type TabType = 'tradingview' | 'visual' | 'code'

type Indicator = 'RSI' | 'MACD' | 'MA' | 'KDJ' | 'BOLL'
type Operator = '大于' | '小于' | '上穿' | '下穿' | '等于'
type ActionType = '买入' | '卖出' | '平仓'
type ConditionLogic = '全部满足' | '任一满足'

interface Condition {
  id: string
  indicator: Indicator
  operator: Operator
  value: string
}

interface Action {
  id: string
  type: ActionType
  percentage: string
}

interface MobileStrategyCreatorProps {
  onBack?: () => void
  onSave?: (data: unknown) => void
}

export function MobileStrategyCreator({ onBack, onSave }: MobileStrategyCreatorProps) {
  const t = useTranslations('strategies')
  const tc = useTranslations('common')
  const [activeTab, setActiveTab] = useState<TabType>('tradingview')
  const [copied, setCopied] = useState(false)

  // 统一的策略配置状态
  const [config, setConfig] = useState<StrategyConfigData>(defaultConfig)

  // TradingView 专属
  const [webhookUrl] = useState('https://api.hoot.trade/webhook/tv/abc123xyz')

  // API Hook
  const { loading: apiLoading, error: apiError, createSubscription } = useStrategySubscription('')
  const { apiKeys, fetchApiKeys, loading: apiKeysLoading } = useApiKeys()
  const [selectedApiKeyId, setSelectedApiKeyId] = useState('')
  const [showApiKeyDD, setShowApiKeyDD] = useState(false)

  // 加载用户 API Keys
  useEffect(() => {
    fetchApiKeys()
  }, [fetchApiKeys])

  // Visual Tab State
  const [conditions, setConditions] = useState<Condition[]>([
    { id: '1', indicator: 'RSI', operator: '小于', value: '30' }
  ])
  const [conditionLogic, setConditionLogic] = useState<ConditionLogic>('全部满足')
  const [actions, setActions] = useState<Action[]>([
    { id: '1', type: '买入', percentage: '50' }
  ])

  // Code Tab State
  const [strategyName, setStrategyName] = useState('')
  const [code, setCode] = useState(`# 策略示例
def on_bar(bar):
    # 获取技术指标
    rsi = get_indicator('RSI', 14)

    # 交易逻辑
    if rsi < 30:
        buy(amount=100)
    elif rsi > 70:
        sell(amount=100)
`)

  const indicators: Indicator[] = ['RSI', 'MACD', 'MA', 'KDJ', 'BOLL']
  const operators: Operator[] = ['大于', '小于', '上穿', '下穿', '等于']
  const actionTypes: ActionType[] = ['买入', '卖出', '平仓']

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: Date.now().toString(), indicator: 'RSI', operator: '大于', value: '' }
    ])
  }

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id))
  }

  const updateCondition = (id: string, field: keyof Condition, value: string) => {
    setConditions(conditions.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ))
  }

  const addAction = () => {
    setActions([
      ...actions,
      { id: Date.now().toString(), type: '买入', percentage: '50' }
    ])
  }

  const removeAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id))
  }

  const updateAction = (id: string, field: keyof Action, value: string) => {
    setActions(actions.map(a =>
      a.id === id ? { ...a, [field]: value } : a
    ))
  }

  const handleSave = async () => {
    if (!selectedApiKeyId) {
      return // 没有选择 API Key
    }

    // 构建带 apiKeyId 的配置
    const configWithApiKey: StrategyConfigData = {
      ...config,
      apiKeyId: selectedApiKeyId,
    }

    // 构建策略数据
    const strategyData = {
      type: activeTab,
      name: strategyName || `${activeTab}-strategy-${Date.now()}`,
      config: configWithApiKey,
      // 可视化搭建的条件和动作
      ...(activeTab === 'visual' && { conditions, conditionLogic, actions }),
      // 代码开发的代码
      ...(activeTab === 'code' && { code }),
    }

    // 调用 API 创建订阅
    try {
      await createSubscription(configWithApiKey)
      onSave?.(strategyData)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('创建策略失败:', err)
      }
    }
  }

  const loadTemplate = (template: string) => {
    const templates: Record<string, string> = {
      '均值回归': `# 均值回归策略
def on_bar(bar):
    ma20 = get_indicator('MA', 20)
    price = bar.close

    deviation = (price - ma20) / ma20

    if deviation < -0.02:  # 价格低于均线2%
        buy(amount=100)
    elif deviation > 0.02:  # 价格高于均线2%
        sell(amount=100)
`,
      '动量': `# 动量策略
def on_bar(bar):
    rsi = get_indicator('RSI', 14)
    macd = get_indicator('MACD')

    if rsi > 50 and macd['diff'] > 0:
        buy(amount=100)
    elif rsi < 50 and macd['diff'] < 0:
        sell(amount=100)
`,
      '网格': `# 网格交易策略
def on_bar(bar):
    price = bar.close
    grid_size = 100  # 网格间距

    # 计算网格价格
    grid_level = round(price / grid_size)

    if price <= grid_level * grid_size - grid_size/2:
        buy(amount=50)
    elif price >= grid_level * grid_size + grid_size/2:
        sell(amount=50)
`
    }
    setCode(templates[template] || code)
  }

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0F] text-white">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F] pt-[env(safe-area-inset-top)] [transform:translateZ(0)] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label={tc('back')}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">{t('createStrategy')}</h1>
          <div className="w-10" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1E1E2E]">
          {(['tradingview', 'visual', 'code'] as TabType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium relative transition-colors ${
                activeTab === tab ? 'text-[#06B6D4]' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              {tab === 'tradingview' ? 'TradingView' : tab === 'visual' ? t('visualTab') : t('codeTab')}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* TradingView Tab */}
        {activeTab === 'tradingview' && (
          <div className="space-y-4 py-4">
            {/* TradingView Banner */}
            <div className="bg-gradient-to-r from-[#131722]/50 to-[#1E222D]/50 border border-[#1E1E2E] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-14 h-14 rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icons/tradingview.webp"
                    alt="TradingView"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{t('tradingviewSignalIntegration')}</h3>
                  <p className="text-xs text-[#787B86]">{t('connectTradingViewAlerts')}</p>
                </div>
              </div>
              <p className="text-sm text-[#94A3B8]">
                {t('alertToTrade')}
              </p>
            </div>

            {/* Webhook URL */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">{t('webhookUrl')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm text-[#94A3B8] font-mono"
                  aria-label="Webhook URL"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2.5 bg-[#06B6D4] hover:bg-[#0891B2] rounded-lg transition-colors"
                  aria-label={t('copyUrl')}
                  title={tc('copy')}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* API Key 选择器 */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">{t('selectApiKey')}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApiKeyDD(!showApiKeyDD)}
                  className={`w-full flex items-center justify-between bg-[#0A0A0F] border rounded-lg px-3 py-2.5 text-sm ${
                    selectedApiKeyId ? 'border-cyan-500/30' : 'border-[#1E1E2E]'
                  }`}
                >
                  <span className={selectedApiKeyId ? 'text-white' : 'text-[#94A3B8]'}>
                    {apiKeysLoading
                      ? t('loading')
                      : selectedApiKeyId
                      ? apiKeys.find(k => k.id === selectedApiKeyId)?.label || t('unknownKey')
                      : t('selectApiKeyPlaceholder')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${showApiKeyDD ? 'rotate-180' : ''}`} />
                </button>

                {showApiKeyDD && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                    {apiKeys.length === 0 ? (
                      <div className="p-3 text-center text-[#94A3B8] text-sm">{t('noApiKeys')}</div>
                    ) : (
                      apiKeys.map((key) => (
                        <button
                          key={key.id}
                          type="button"
                          onClick={() => {
                            setSelectedApiKeyId(key.id)
                            setShowApiKeyDD(false)
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#1E1E2E] transition-colors text-left ${
                            selectedApiKeyId === key.id ? 'bg-cyan-500/10' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-white text-sm">{key.label}</div>
                            <div className="text-xs text-[#94A3B8]">{key.exchange}</div>
                          </div>
                          {selectedApiKeyId === key.id && <Check className="w-4 h-4 text-cyan-400" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {!selectedApiKeyId && (
                <p className="mt-2 text-xs text-yellow-500">{t('apiKeyRequired')}</p>
              )}
            </div>

            {/* 使用统一的策略配置组件 */}
            <StrategyConfigSection config={config} onChange={setConfig} />
          </div>
        )}

        {/* Visual Tab */}
        {activeTab === 'visual' && (
          <div className="space-y-4 py-4">
            {/* Strategy Name */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">{t('strategyName')}</label>
              <input
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm"
                aria-label={t('strategyName')}
              />
            </div>

            {/* Trigger Conditions */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('triggerConditions')}</h3>
                <button
                  type="button"
                  onClick={addCondition}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#06B6D4] hover:bg-[#0891B2] rounded-lg text-sm transition-colors"
                  aria-label={t('addCondition')}
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('add')}</span>
                </button>
              </div>

              {/* Condition Logic */}
              <div className="flex gap-2 mb-4">
                {(['全部满足', '任一满足'] as ConditionLogic[]).map((logic) => (
                  <button
                    type="button"
                    key={logic}
                    onClick={() => setConditionLogic(logic)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      conditionLogic === logic
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#0A0A0F] text-[#94A3B8] hover:bg-[#1E1E2E]'
                    }`}
                  >
                    {logic}
                  </button>
                ))}
              </div>

              {/* Conditions List */}
              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={condition.id} className="bg-[#0A0A0F] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-[#94A3B8]">{t('condition')} {index + 1}</span>
                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCondition(condition.id)}
                          className="p-1 hover:bg-[#1E1E2E] rounded transition-colors"
                          aria-label={t('deleteCondition')}
                          title={tc('delete')}
                        >
                          <X className="w-4 h-4 text-[#EF4444]" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={condition.indicator}
                        onChange={(e) => updateCondition(condition.id, 'indicator', e.target.value)}
                        className="bg-[#12121A] border border-[#1E1E2E] rounded-lg px-2 py-2 text-sm"
                        aria-label={t('selectIndicator')}
                      >
                        {indicators.map((ind) => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(condition.id, 'operator', e.target.value)}
                        className="bg-[#12121A] border border-[#1E1E2E] rounded-lg px-2 py-2 text-sm"
                        aria-label={t('selectOperator')}
                      >
                        {operators.map((op) => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                        placeholder={t('enterValue')}
                        className="bg-[#12121A] border border-[#1E1E2E] rounded-lg px-2 py-2 text-sm"
                        aria-label={t('inputValue')}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Execute Actions */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('executeActionsTitle')}</h3>
                <button
                  type="button"
                  onClick={addAction}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#06B6D4] hover:bg-[#0891B2] rounded-lg text-sm transition-colors"
                  aria-label={t('addAction')}
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('add')}</span>
                </button>
              </div>

              {/* Actions List */}
              <div className="space-y-3">
                {actions.map((action, index) => (
                  <div key={action.id} className="bg-[#0A0A0F] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-[#94A3B8]">动作 {index + 1}</span>
                      {actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
                          className="p-1 hover:bg-[#1E1E2E] rounded transition-colors"
                          aria-label={t('deleteAction')}
                          title={tc('delete')}
                        >
                          <X className="w-4 h-4 text-[#EF4444]" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(action.id, 'type', e.target.value)}
                        className="bg-[#12121A] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm"
                        aria-label={t('actionType')}
                      >
                        {actionTypes.map((type) => (
                          <option key={type} value={type}>
                            {type === '买入' && '🟢 '}
                            {type === '卖出' && '🔴 '}
                            {type === '平仓' && '⚪ '}
                            {type}
                          </option>
                        ))}
                      </select>
                      <div className="relative">
                        <input
                          type="number"
                          value={action.percentage}
                          onChange={(e) => updateAction(action.id, 'percentage', e.target.value)}
                          className="w-full bg-[#12121A] border border-[#1E1E2E] rounded-lg pl-3 pr-8 py-2 text-sm"
                          aria-label={t('positionPercent')}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* API Key 选择器 */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">{t('selectApiKey')}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApiKeyDD(!showApiKeyDD)}
                  className={`w-full flex items-center justify-between bg-[#0A0A0F] border rounded-lg px-3 py-2.5 text-sm ${
                    selectedApiKeyId ? 'border-cyan-500/30' : 'border-[#1E1E2E]'
                  }`}
                >
                  <span className={selectedApiKeyId ? 'text-white' : 'text-[#94A3B8]'}>
                    {apiKeysLoading
                      ? t('loading')
                      : selectedApiKeyId
                      ? apiKeys.find(k => k.id === selectedApiKeyId)?.label || t('unknownKey')
                      : t('selectApiKeyPlaceholder')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${showApiKeyDD ? 'rotate-180' : ''}`} />
                </button>

                {showApiKeyDD && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                    {apiKeys.length === 0 ? (
                      <div className="p-3 text-center text-[#94A3B8] text-sm">{t('noApiKeys')}</div>
                    ) : (
                      apiKeys.map((key) => (
                        <button
                          key={key.id}
                          type="button"
                          onClick={() => {
                            setSelectedApiKeyId(key.id)
                            setShowApiKeyDD(false)
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#1E1E2E] transition-colors text-left ${
                            selectedApiKeyId === key.id ? 'bg-cyan-500/10' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-white text-sm">{key.label}</div>
                            <div className="text-xs text-[#94A3B8]">{key.exchange}</div>
                          </div>
                          {selectedApiKeyId === key.id && <Check className="w-4 h-4 text-cyan-400" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {!selectedApiKeyId && (
                <p className="mt-2 text-xs text-yellow-500">{t('apiKeyRequired')}</p>
              )}
            </div>

            {/* 使用统一的策略配置组件 */}
            <StrategyConfigSection config={config} onChange={setConfig} />
          </div>
        )}

        {/* Code Tab */}
        {activeTab === 'code' && (
          <div className="space-y-4 py-4">
            {/* Strategy Name */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">{t('strategyName')}</label>
              <input
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm"
                aria-label={t('strategyName')}
              />
            </div>

            {/* Code Templates */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <label className="block text-sm text-[#94A3B8] mb-3">{t('quickTemplates')}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: '均值回归', label: t('meanReversion') },
                  { key: '动量', label: t('momentum') },
                  { key: '网格', label: t('grid') }
                ].map((template) => (
                  <button
                    type="button"
                    key={template.key}
                    onClick={() => loadTemplate(template.key)}
                    className="py-2.5 bg-[#0A0A0F] hover:bg-[#1E1E2E] rounded-lg text-sm font-medium transition-colors"
                    aria-label={template.label}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Editor */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">{t('codeEditor')}</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-60 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm font-mono resize-none"
                spellCheck={false}
                aria-label={t('codeEditor')}
              />
            </div>

            {/* API Key 选择器 */}
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">{t('selectApiKey')}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApiKeyDD(!showApiKeyDD)}
                  className={`w-full flex items-center justify-between bg-[#0A0A0F] border rounded-lg px-3 py-2.5 text-sm ${
                    selectedApiKeyId ? 'border-cyan-500/30' : 'border-[#1E1E2E]'
                  }`}
                >
                  <span className={selectedApiKeyId ? 'text-white' : 'text-[#94A3B8]'}>
                    {apiKeysLoading
                      ? t('loading')
                      : selectedApiKeyId
                      ? apiKeys.find(k => k.id === selectedApiKeyId)?.label || t('unknownKey')
                      : t('selectApiKeyPlaceholder')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${showApiKeyDD ? 'rotate-180' : ''}`} />
                </button>

                {showApiKeyDD && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                    {apiKeys.length === 0 ? (
                      <div className="p-3 text-center text-[#94A3B8] text-sm">{t('noApiKeys')}</div>
                    ) : (
                      apiKeys.map((key) => (
                        <button
                          key={key.id}
                          type="button"
                          onClick={() => {
                            setSelectedApiKeyId(key.id)
                            setShowApiKeyDD(false)
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#1E1E2E] transition-colors text-left ${
                            selectedApiKeyId === key.id ? 'bg-cyan-500/10' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-white text-sm">{key.label}</div>
                            <div className="text-xs text-[#94A3B8]">{key.exchange}</div>
                          </div>
                          {selectedApiKeyId === key.id && <Check className="w-4 h-4 text-cyan-400" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {!selectedApiKeyId && (
                <p className="mt-2 text-xs text-yellow-500">{t('apiKeyRequired')}</p>
              )}
            </div>

            {/* 使用统一的策略配置组件 */}
            <StrategyConfigSection config={config} onChange={setConfig} />
          </div>
        )}
      </div>

      {/* Bottom Save Button */}
      <div className="shrink-0 p-4 bg-[#0A0A0F] border-t border-[#1E1E2E]">
        {/* API 错误提示 */}
        {apiError && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
            {apiError}
          </div>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={apiLoading || !selectedApiKeyId}
          className="w-full py-3.5 bg-[#06B6D4] hover:bg-[#0891B2] disabled:opacity-50 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          aria-label={tc('save')}
        >
          {apiLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {apiLoading ? t('saving') : !selectedApiKeyId ? t('selectApiKeyFirst') : tc('save')}
        </button>
      </div>
    </div>
  )
}
