'use client'

import { useState } from 'react'
import {
  Zap,
  Layers,
  Code,
  ArrowLeft,
  ChevronRight,
  Settings,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  Check,
  Loader2,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StrategyConfigSection, defaultConfig } from '@/components/ui-v3/shared/strategy-config-section'
import { StrategyConfigData } from '@/components/ui-v3/shared/strategy-config-types'
import { useStrategySubscription, useApiKeys } from '@/hooks/use-strategy'
import { useTranslations } from '@/i18n/provider'
import { useEffect } from 'react'

type TabType = 'external' | 'visual' | 'code'

interface StrategyData {
  type: 'tradingview' | 'visual' | 'code'
  name?: string
  config?: StrategyConfigData
  conditions?: VisualCondition[]
  actions?: VisualAction[]
  logic?: string
  code?: string
}

interface StrategyCreatorPageProps {
  onSave?: (config: StrategyData) => void
  onNavigate?: (path: string) => void
}

interface TabConfig {
  id: TabType
  labelKey: string
  icon: React.ReactNode
  descriptionKey: string
  tagKey?: string
}

const tabConfigs: TabConfig[] = [
  { id: 'external', labelKey: 'TradingView', icon: <div className="w-8 h-8 rounded-lg overflow-hidden"><img src="/icons/tradingview.webp" alt="TradingView" className="w-full h-full object-cover" /></div>, descriptionKey: 'tradingviewDesc', tagKey: 'recommended' },
  { id: 'visual', labelKey: 'visualBuilder', icon: <Layers className="w-6 h-6" />, descriptionKey: 'visualDesc' },
  { id: 'code', labelKey: 'codeDevelopment', icon: <Code className="w-6 h-6" />, descriptionKey: 'codeDesc', tagKey: 'advanced' }
]

// 可视化条件类型
interface VisualCondition {
  id: string
  type: 'indicator' | 'price' | 'time' | 'volume'
  indicator?: string
  operator: 'above' | 'below' | 'cross_up' | 'cross_down' | 'between'
  value: string
  value2?: string
}

// 可视化动作类型
interface VisualAction {
  id: string
  type: 'buy' | 'sell' | 'close' | 'alert'
  amount: string
  amountType: 'percent' | 'fixed'
}

export function StrategyCreatorPage({
  onSave,
  onNavigate
}: StrategyCreatorPageProps) {
  const t = useTranslations('strategies')
  const [activeTab, setActiveTab] = useState<TabType>('external')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 统一配置状态
  const [config, setConfig] = useState<StrategyConfigData>(defaultConfig)

  // 策略名称
  const [strategyName, setStrategyName] = useState('')

  // API 集成
  const { loading: apiLoading, error: apiError, createSubscription } = useStrategySubscription('')
  const { apiKeys, fetchApiKeys, loading: apiKeysLoading } = useApiKeys()
  const [selectedApiKeyId, setSelectedApiKeyId] = useState('')
  const [showApiKeyDD, setShowApiKeyDD] = useState(false)

  // 加载用户 API Keys
  useEffect(() => {
    fetchApiKeys()
  }, [fetchApiKeys])

  // Helper to get tab label
  const getTabLabel = (key: string) => {
    if (key === 'TradingView') return 'TradingView'
    return t(key as any)
  }

  // 可视化搭建状态
  const [visualConditions, setVisualConditions] = useState<VisualCondition[]>([
    { id: '1', type: 'indicator', indicator: 'RSI', operator: 'below', value: '30' }
  ])
  const [visualActions, setVisualActions] = useState<VisualAction[]>([
    { id: '1', type: 'buy', amount: '10', amountType: 'percent' }
  ])
  const [visualLogic, setVisualLogic] = useState<'and' | 'or'>('and')

  // 代码策略状态
  const [codeContent, setCodeContent] = useState(`# 策略模板示例
class MyStrategy(BaseStrategy):
    def __init__(self):
        self.rsi_period = 14
        self.oversold = 30

    def on_tick(self, data):
        rsi = self.calculate_rsi(data, self.rsi_period)
        if rsi < self.oversold:
            self.buy(size=0.1)
        elif rsi > 70:
            self.sell(size=0.1)`)
  const [showCodeEditor, setShowCodeEditor] = useState(false)

  // 保存策略配置
  const handleSave = async () => {
    if (!selectedApiKeyId) {
      return // 没有选择 API Key
    }

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      // 构建带 apiKeyId 的配置
      const configWithApiKey: StrategyConfigData = {
        ...config,
        apiKeyId: selectedApiKeyId,
      }

      const strategyData: StrategyData = {
        type: activeTab === 'external' ? 'tradingview' : activeTab,
        name: strategyName || `${activeTab}-strategy-${Date.now()}`,
        config: configWithApiKey,
        ...(activeTab === 'visual' && { conditions: visualConditions, actions: visualActions, logic: visualLogic }),
        ...(activeTab === 'code' && { code: codeContent }),
      }

      // 调用 API 创建订阅
      await createSubscription(configWithApiKey)

      // 调用父组件的 onSave
      await onSave?.(strategyData)

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('保存失败:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* 保存成功提示 */}
      {saveSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 px-6 py-3 bg-[#10B981] text-white rounded-xl shadow-lg">
            <Check className="w-5 h-5" />
            <span className="font-medium">{t('strategySaved')}</span>
          </div>
        </div>
      )}

      {/* API 错误提示 */}
      {apiError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl shadow-lg">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">{apiError}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[#1E1E2E] bg-[#0A0A0F]/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate?.('/strategies')}
              title={t('backToMarket')}
              className="p-2 rounded-lg hover:bg-[#1E1E2E] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{t('createStrategy')}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabConfigs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl transition-all",
                activeTab === tab.id
                  ? "bg-[#06B6D4] text-white"
                  : "bg-[#12121A] border border-[#1E1E2E] text-[#9090A0] hover:text-[#F8F8FC] hover:border-[#2A2A3A]"
              )}
            >
              {tab.icon}
              <span className="font-medium">{getTabLabel(tab.labelKey)}</span>
              {tab.tagKey && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-medium",
                  activeTab === tab.id
                    ? "bg-white/20 text-white"
                    : tab.tagKey === 'recommended'
                    ? "bg-cyan-400/20 text-cyan-400"
                    : "bg-yellow-400/20 text-yellow-400"
                )}>
                  {t(tab.tagKey as any)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Description */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-4 mb-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          <div className="flex items-center gap-3">
            <div className={activeTab === 'external' ? "w-12 h-12 rounded-lg overflow-hidden" : "w-12 h-12 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center"}>
              {activeTab === 'external' ? (
                <img src="/icons/tradingview.webp" alt="TradingView" className="w-full h-full object-cover" />
              ) : (
                tabConfigs.find(tc => tc.id === activeTab)?.icon
              )}
            </div>
            <div>
              <h2 className="font-semibold">{getTabLabel(tabConfigs.find(tc => tc.id === activeTab)?.labelKey || '')}</h2>
              <p className="text-sm text-[#9090A0]">{t(tabConfigs.find(tc => tc.id === activeTab)?.descriptionKey as any)}</p>
            </div>
          </div>
        </div>

        {/* 两栏布局：左边特定配置，右边统一风控配置 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左栏：各 Tab 特定内容 */}
          <div className="space-y-4">
            {activeTab === 'external' && (
              <>
                {/* 策略名称 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">{t('strategyName')}</h3>
                  <Input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>

                {/* Webhook 配置 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">{t('webhookConfig')}</h3>
                  <p className="text-[#9090A0] mb-4">{t('webhookDesc')}</p>
                  <div className="bg-[#0A0A0F] rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#606070]">{t('webhookUrl')}</span>
                      <button type="button" className="text-sm text-cyan-400 hover:text-cyan-300">{t('cancel')}</button>
                    </div>
                    <code className="text-sm text-[#F8F8FC] break-all">
                      https://api.hoot.ai/webhook/tv/your-unique-id
                    </code>
                  </div>
                  <Button variant="outline" className="w-full border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC] hover:border-cyan-500/50">
                    {t('generateWebhook')}
                  </Button>
                </div>

                {/* TradingView 使用说明 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-semibold">{t('instructions')}</h3>
                  </div>
                  <ol className="space-y-2 text-sm text-[#9090A0]">
                    <li>{t('instruction1')}</li>
                    <li>{t('instruction2')}</li>
                    <li>{t('instruction3')}</li>
                    <li>{t('instruction4')}</li>
                  </ol>
                </div>
              </>
            )}

            {activeTab === 'visual' && (
              <>
                {/* 策略名称 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{t('strategyInfo')}</h3>
                      <p className="text-xs text-[#606070]">{t('nameYourStrategy')}</p>
                    </div>
                  </div>
                  <Input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>

                {/* 条件区块 - When */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{t('whenConditionsMet')}</h3>
                        <p className="text-xs text-[#606070]">{t('setTriggerConditions')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVisualLogic('and')}
                        className={cn(
                          "px-3 py-1 rounded-lg text-sm transition-all",
                          visualLogic === 'and' ? "bg-cyan-500 text-white" : "bg-[#1E1E2E] text-[#9090A0]"
                        )}
                      >
                        {t('allSatisfied')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisualLogic('or')}
                        className={cn(
                          "px-3 py-1 rounded-lg text-sm transition-all",
                          visualLogic === 'or' ? "bg-cyan-500 text-white" : "bg-[#1E1E2E] text-[#9090A0]"
                        )}
                      >
                        {t('anySatisfied')}
                      </button>
                    </div>
                  </div>

                  {/* 条件列表 */}
                  <div className="space-y-3">
                    {visualConditions.map((condition, index) => (
                      <div key={condition.id} className="flex items-center gap-3 p-4 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E]">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <select
                            value={condition.type}
                            onChange={(e) => {
                              const newConditions = [...visualConditions]
                              newConditions[index] = { ...condition, type: e.target.value as VisualCondition['type'] }
                              setVisualConditions(newConditions)
                            }}
                            title={t('conditionType')}
                            className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                          >
                            <option value="indicator">{t('indicator')}</option>
                            <option value="price">{t('priceCondition')}</option>
                            <option value="volume">{t('volume')}</option>
                            <option value="time">{t('timeCondition')}</option>
                          </select>

                          {condition.type === 'indicator' && (
                            <select
                              value={condition.indicator || 'RSI'}
                              onChange={(e) => {
                                const newConditions = [...visualConditions]
                                newConditions[index] = { ...condition, indicator: e.target.value }
                                setVisualConditions(newConditions)
                              }}
                              title={t('selectIndicator')}
                              className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                            >
                              <option value="RSI">RSI</option>
                              <option value="MACD">MACD</option>
                              <option value="MA">{t('maLine')}</option>
                              <option value="EMA">EMA</option>
                              <option value="BOLL">{t('bollinger')}</option>
                              <option value="KDJ">KDJ</option>
                            </select>
                          )}

                          <select
                            value={condition.operator}
                            onChange={(e) => {
                              const newConditions = [...visualConditions]
                              newConditions[index] = { ...condition, operator: e.target.value as VisualCondition['operator'] }
                              setVisualConditions(newConditions)
                            }}
                            title={t('operator')}
                            className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                          >
                            <option value="above">{t('greaterThan')}</option>
                            <option value="below">{t('lessThan')}</option>
                            <option value="cross_up">{t('crossUp')}</option>
                            <option value="cross_down">{t('crossDown')}</option>
                            <option value="between">{t('inRange')}</option>
                          </select>

                          <Input
                            type="number"
                            value={condition.value}
                            onChange={(e) => {
                              const newConditions = [...visualConditions]
                              newConditions[index] = { ...condition, value: e.target.value }
                              setVisualConditions(newConditions)
                            }}
                            placeholder={t('value')}
                            className="bg-[#1E1E2E] border-[#2A2A3A]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setVisualConditions(visualConditions.filter(c => c.id !== condition.id))}
                          title={t('deleteCondition')}
                          className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors text-[#9090A0] hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setVisualConditions([
                      ...visualConditions,
                      { id: Date.now().toString(), type: 'indicator', indicator: 'RSI', operator: 'below', value: '30' }
                    ])}
                    className="w-full mt-3 p-3 border border-dashed border-[#2A2A3A] rounded-xl text-[#9090A0] hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t('addCondition')}
                  </button>
                </div>

                {/* 动作区块 - Then */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{t('executeActions')}</h3>
                      <p className="text-xs text-[#606070]">{t('autoExecute')}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {visualActions.map((action, index) => (
                      <div key={action.id} className="flex items-center gap-3 p-4 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E]">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <select
                            value={action.type}
                            onChange={(e) => {
                              const newActions = [...visualActions]
                              newActions[index] = { ...action, type: e.target.value as VisualAction['type'] }
                              setVisualActions(newActions)
                            }}
                            title={t('actionType')}
                            className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                          >
                            <option value="buy">{t('buyLong')}</option>
                            <option value="sell">{t('sellShort')}</option>
                            <option value="close">{t('closePosition')}</option>
                            <option value="alert">{t('alertOnly')}</option>
                          </select>

                          {action.type !== 'alert' && (
                            <>
                              <Input
                                type="number"
                                value={action.amount}
                                onChange={(e) => {
                                  const newActions = [...visualActions]
                                  newActions[index] = { ...action, amount: e.target.value }
                                  setVisualActions(newActions)
                                }}
                                placeholder={t('amount')}
                                className="bg-[#1E1E2E] border-[#2A2A3A]"
                              />
                              <select
                                value={action.amountType}
                                onChange={(e) => {
                                  const newActions = [...visualActions]
                                  newActions[index] = { ...action, amountType: e.target.value as VisualAction['amountType'] }
                                  setVisualActions(newActions)
                                }}
                                title={t('amount')}
                                className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                              >
                                <option value="percent">{t('positionPercent')}</option>
                                <option value="fixed">{t('fixedAmount')}</option>
                              </select>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setVisualActions(visualActions.filter(a => a.id !== action.id))}
                          title={t('deleteAction')}
                          className="p-2 hover:bg-[#1E1E2E] rounded-lg transition-colors text-[#9090A0] hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setVisualActions([
                      ...visualActions,
                      { id: Date.now().toString(), type: 'buy', amount: '10', amountType: 'percent' }
                    ])}
                    className="w-full mt-3 p-3 border border-dashed border-[#2A2A3A] rounded-xl text-[#9090A0] hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t('addAction')}
                  </button>
                </div>

                {/* 策略预览 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-semibold">{t('logicPreview')}</h3>
                  </div>
                  <div className="p-4 bg-[#0A0A0F] rounded-xl font-mono text-sm">
                    <p className="text-yellow-400 mb-2">
                      {visualLogic === 'and' ? t('whenAllConditions') : t('whenAnyCondition')}:
                    </p>
                    {visualConditions.map((c, i) => (
                      <p key={c.id} className="text-[#9090A0] ml-4">
                        {i > 0 && <span className="text-cyan-400">{visualLogic === 'and' ? `${t('and')} ` : `${t('or')} `}</span>}
                        {c.type === 'indicator' && c.indicator} {' '}
                        {c.operator === 'above' ? '>' : c.operator === 'below' ? '<' : c.operator === 'cross_up' ? t('crossUp') : c.operator === 'cross_down' ? t('crossDown') : t('inRange')} {' '}
                        {c.value}
                      </p>
                    ))}
                    <p className="text-green-400 mt-4 mb-2">{t('thenExecute')}:</p>
                    {visualActions.map((a) => (
                      <p key={a.id} className="text-[#9090A0] ml-4">
                        {a.type === 'buy' ? t('buyLong') : a.type === 'sell' ? t('sellShort') : a.type === 'close' ? t('closePosition') : t('sendNotification')}
                        {a.type !== 'alert' && ` ${a.amount}${a.amountType === 'percent' ? '%' : ' USDT'}`}
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'code' && (
              <>
                {/* 策略名称 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">{t('strategyName')}</h3>
                  <Input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder={t('customStrategy')}
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>

                {/* 代码编辑器 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{t('codeEditor')}</h3>
                    <button
                      type="button"
                      onClick={() => setShowCodeEditor(!showCodeEditor)}
                      className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      {showCodeEditor ? t('collapseEditor') : t('expandEditor')}
                      {showCodeEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className={cn(
                    "bg-[#0A0A0F] rounded-xl border border-[#1E1E2E] overflow-hidden transition-all",
                    showCodeEditor ? "h-[400px]" : "h-[200px]"
                  )}>
                    <div className="flex items-center justify-between px-4 py-2 bg-[#1E1E2E] border-b border-[#2A2A3A]">
                      <span className="text-xs text-[#606070]">strategy.py</span>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#F43F5E]" />
                        <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                        <span className="w-3 h-3 rounded-full bg-[#10B981]" />
                      </div>
                    </div>
                    <textarea
                      value={codeContent}
                      onChange={(e) => setCodeContent(e.target.value)}
                      placeholder={t('codePlaceholder')}
                      className="w-full h-[calc(100%-40px)] bg-transparent p-4 font-mono text-sm text-[#F8F8FC] resize-none focus:outline-none"
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex gap-3 mt-4">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#2A2A3A]"
                      onClick={() => setShowCodeEditor(true)}
                    >
                      <Code className="w-4 h-4 mr-2" />
                      {t('fullscreenEdit')}
                    </Button>
                    <Button variant="outline" className="border-[#2A2A3A]">
                      <Info className="w-4 h-4 mr-2" />
                      {t('apiDocs')}
                    </Button>
                  </div>
                </div>

                {/* 策略模板 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">{t('quickTemplates')}</h3>
                  <div className="grid gap-3">
                    {[
                      { nameKey: 'meanReversion', descKey: 'meanReversionDesc', code: `# Mean Reversion Strategy\nclass MeanReversionStrategy(BaseStrategy):\n    def __init__(self):\n        self.ma_period = 20\n        self.threshold = 2.0\n\n    def on_tick(self, data):\n        ma = self.calculate_ma(data, self.ma_period)\n        std = self.calculate_std(data, self.ma_period)\n        price = data['close']\n        if price < ma - std * self.threshold:\n            self.buy(size=0.1)\n        elif price > ma + std * self.threshold:\n            self.sell(size=0.1)` },
                      { nameKey: 'momentum', descKey: 'momentumDesc', code: `# Momentum Strategy\nclass MomentumStrategy(BaseStrategy):\n    def __init__(self):\n        self.fast_period = 12\n        self.slow_period = 26\n\n    def on_tick(self, data):\n        fast_ma = self.calculate_ema(data, self.fast_period)\n        slow_ma = self.calculate_ema(data, self.slow_period)\n        if fast_ma > slow_ma:\n            self.buy(size=0.1)\n        elif fast_ma < slow_ma:\n            self.sell(size=0.1)` },
                      { nameKey: 'grid', descKey: 'gridDesc', code: `# Grid Strategy\nclass GridStrategy(BaseStrategy):\n    def __init__(self):\n        self.grid_upper = 50000\n        self.grid_lower = 40000\n        self.grid_count = 10\n\n    def on_tick(self, data):\n        price = data['close']\n        grid_size = (self.grid_upper - self.grid_lower) / self.grid_count\n        for i in range(self.grid_count):\n            level = self.grid_lower + i * grid_size\n            if abs(price - level) < grid_size * 0.1:\n                if price < level:\n                    self.buy(size=0.01)\n                else:\n                    self.sell(size=0.01)` }
                    ].map((template) => (
                      <button
                        key={template.nameKey}
                        type="button"
                        onClick={() => setCodeContent(template.code)}
                        className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-xl hover:bg-[#1E1E2E] transition-colors text-left"
                      >
                        <div>
                          <div className="font-medium">{t(template.nameKey as any)}</div>
                          <div className="text-sm text-[#606070]">{t(template.descKey as any)}</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#606070]" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 右栏：统一风控参数配置 */}
          <div className="space-y-4">
            {/* API Key 选择器 */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('selectApiKey')}</h3>
                  <p className="text-xs text-[#606070]">{t('apiKeyDesc')}</p>
                </div>
              </div>

              {/* API Key 下拉选择 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApiKeyDD(!showApiKeyDD)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
                    selectedApiKeyId
                      ? "bg-[#0A0A0F] border-cyan-500/30"
                      : "bg-[#0A0A0F] border-[#2A2A3A] hover:border-cyan-500/30"
                  )}
                >
                  <span className={selectedApiKeyId ? "text-[#F8F8FC]" : "text-[#606070]"}>
                    {apiKeysLoading
                      ? t('loading')
                      : selectedApiKeyId
                      ? apiKeys.find(k => k.id === selectedApiKeyId)?.label || t('unknownKey')
                      : t('selectApiKeyPlaceholder')}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-[#606070] transition-transform", showApiKeyDD && "rotate-180")} />
                </button>

                {showApiKeyDD && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#12121A] border border-[#2A2A3A] rounded-xl shadow-xl z-20 overflow-hidden">
                    {apiKeys.length === 0 ? (
                      <div className="p-4 text-center text-[#606070] text-sm">
                        {t('noApiKeys')}
                      </div>
                    ) : (
                      apiKeys.map((key) => (
                        <button
                          key={key.id}
                          type="button"
                          onClick={() => {
                            setSelectedApiKeyId(key.id)
                            setShowApiKeyDD(false)
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-3 hover:bg-[#1E1E2E] transition-colors text-left",
                            selectedApiKeyId === key.id && "bg-cyan-500/10"
                          )}
                        >
                          <div>
                            <div className="font-medium text-[#F8F8FC]">{key.label}</div>
                            <div className="text-xs text-[#606070]">{key.exchange}</div>
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

            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('tradingConfig')}</h3>
                  <p className="text-xs text-[#606070]">{t('configDescription')}</p>
                </div>
              </div>

              {/* 使用统一配置组件 */}
              <StrategyConfigSection
                config={config}
                onChange={setConfig}
                showExchangeSelect={true}
              />
            </div>

            {/* 保存按钮 */}
            <Button
              onClick={handleSave}
              disabled={isSaving || apiLoading || !selectedApiKeyId}
              className="w-full bg-[#06B6D4] hover:bg-[#0891B2] py-6 disabled:opacity-50"
            >
              {(isSaving || apiLoading) ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Settings className="w-5 h-5 mr-2" />
              )}
              {(isSaving || apiLoading)
                ? t('saving')
                : !selectedApiKeyId
                ? t('selectApiKeyFirst')
                : activeTab === 'external'
                ? t('saveTradingview')
                : activeTab === 'visual'
                ? t('saveVisual')
                : t('saveCode')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
