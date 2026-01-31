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
import { useStrategySubscription } from '@/hooks/use-strategy'

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

const tabs: { id: TabType; label: string; icon: React.ReactNode; description: string; tag?: string }[] = [
  { id: 'external', label: 'TradingView', icon: <div className="w-8 h-8 rounded-lg overflow-hidden"><img src="/icons/tradingview.webp" alt="TradingView" className="w-full h-full object-cover scale-150" /></div>, description: '连接你的 TradingView 账户，将 Alert 信号自动转化为实盘交易', tag: '推荐' },
  { id: 'visual', label: '可视化搭建', icon: <Layers className="w-6 h-6" />, description: '无需编程，通过条件组合搭建自己的量化策略逻辑' },
  { id: 'code', label: '代码开发', icon: <Code className="w-6 h-6" />, description: '使用 Python 编写完全自定义的策略，适合专业量化开发者', tag: '高级' }
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
  const [activeTab, setActiveTab] = useState<TabType>('external')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 统一配置状态
  const [config, setConfig] = useState<StrategyConfigData>(defaultConfig)

  // 策略名称
  const [strategyName, setStrategyName] = useState('')

  // API 集成
  const { loading: apiLoading, error: apiError, createSubscription } = useStrategySubscription('')

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
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const strategyData: StrategyData = {
        type: activeTab === 'external' ? 'tradingview' : activeTab,
        name: strategyName || `${activeTab}-strategy-${Date.now()}`,
        config,
        ...(activeTab === 'visual' && { conditions: visualConditions, actions: visualActions, logic: visualLogic }),
        ...(activeTab === 'code' && { code: codeContent }),
      }

      // 调用 API 创建订阅
      const apiKeyId = config.exchange.toLowerCase()
      await createSubscription(config, apiKeyId)

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
            <span className="font-medium">策略已保存到我的策略</span>
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
              title="返回策略市场"
              className="p-2 rounded-lg hover:bg-[#1E1E2E] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">创建策略</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
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
              <span className="font-medium">{tab.label}</span>
              {tab.tag && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-medium",
                  activeTab === tab.id
                    ? "bg-white/20 text-white"
                    : tab.tag === '推荐'
                    ? "bg-cyan-400/20 text-cyan-400"
                    : "bg-yellow-400/20 text-yellow-400"
                )}>
                  {tab.tag}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Description */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-4 mb-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center">
              {activeTab === 'external' ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden">
                  <img src="/icons/tradingview.webp" alt="TradingView" className="w-full h-full object-cover scale-150" />
                </div>
              ) : (
                tabs.find(t => t.id === activeTab)?.icon
              )}
            </div>
            <div>
              <h2 className="font-semibold">{tabs.find(t => t.id === activeTab)?.label}</h2>
              <p className="text-sm text-[#9090A0]">{tabs.find(t => t.id === activeTab)?.description}</p>
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
                  <h3 className="text-lg font-semibold mb-4">策略名称</h3>
                  <Input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder="输入策略名称"
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>

                {/* Webhook 配置 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">TradingView Webhook</h3>
                  <p className="text-[#9090A0] mb-4">通过 TradingView Alert 接收交易信号</p>
                  <div className="bg-[#0A0A0F] rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#606070]">Webhook URL</span>
                      <button type="button" className="text-sm text-cyan-400 hover:text-cyan-300">复制</button>
                    </div>
                    <code className="text-sm text-[#F8F8FC] break-all">
                      https://api.hoot.ai/webhook/tv/your-unique-id
                    </code>
                  </div>
                  <Button variant="outline" className="w-full border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC] hover:border-cyan-500/50">
                    生成新的 Webhook
                  </Button>
                </div>

                {/* TradingView 使用说明 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-semibold">使用说明</h3>
                  </div>
                  <ol className="space-y-2 text-sm text-[#9090A0]">
                    <li>1. 在 TradingView 创建 Alert</li>
                    <li>2. 设置 Webhook URL 为上方地址</li>
                    <li>3. 配置 Alert 消息格式（JSON）</li>
                    <li>4. 保存后系统将自动执行交易</li>
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
                      <h3 className="font-semibold">策略信息</h3>
                      <p className="text-xs text-[#606070]">为你的策略命名</p>
                    </div>
                  </div>
                  <Input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder="输入策略名称"
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
                        <h3 className="font-semibold">当满足以下条件时</h3>
                        <p className="text-xs text-[#606070]">设置触发交易的条件</p>
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
                        全部满足
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisualLogic('or')}
                        className={cn(
                          "px-3 py-1 rounded-lg text-sm transition-all",
                          visualLogic === 'or' ? "bg-cyan-500 text-white" : "bg-[#1E1E2E] text-[#9090A0]"
                        )}
                      >
                        任一满足
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
                            title="选择条件类型"
                            className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                          >
                            <option value="indicator">技术指标</option>
                            <option value="price">价格条件</option>
                            <option value="volume">成交量</option>
                            <option value="time">时间条件</option>
                          </select>

                          {condition.type === 'indicator' && (
                            <select
                              value={condition.indicator || 'RSI'}
                              onChange={(e) => {
                                const newConditions = [...visualConditions]
                                newConditions[index] = { ...condition, indicator: e.target.value }
                                setVisualConditions(newConditions)
                              }}
                              title="选择指标"
                              className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                            >
                              <option value="RSI">RSI</option>
                              <option value="MACD">MACD</option>
                              <option value="MA">MA均线</option>
                              <option value="EMA">EMA</option>
                              <option value="BOLL">布林带</option>
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
                            title="选择操作符"
                            className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                          >
                            <option value="above">大于</option>
                            <option value="below">小于</option>
                            <option value="cross_up">上穿</option>
                            <option value="cross_down">下穿</option>
                            <option value="between">区间内</option>
                          </select>

                          <Input
                            type="number"
                            value={condition.value}
                            onChange={(e) => {
                              const newConditions = [...visualConditions]
                              newConditions[index] = { ...condition, value: e.target.value }
                              setVisualConditions(newConditions)
                            }}
                            placeholder="数值"
                            className="bg-[#1E1E2E] border-[#2A2A3A]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setVisualConditions(visualConditions.filter(c => c.id !== condition.id))}
                          title="删除条件"
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
                    添加条件
                  </button>
                </div>

                {/* 动作区块 - Then */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">执行以下操作</h3>
                      <p className="text-xs text-[#606070]">条件满足时自动执行</p>
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
                            title="选择动作类型"
                            className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                          >
                            <option value="buy">买入开多</option>
                            <option value="sell">卖出开空</option>
                            <option value="close">平仓</option>
                            <option value="alert">仅通知</option>
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
                                placeholder="金额"
                                className="bg-[#1E1E2E] border-[#2A2A3A]"
                              />
                              <select
                                value={action.amountType}
                                onChange={(e) => {
                                  const newActions = [...visualActions]
                                  newActions[index] = { ...action, amountType: e.target.value as VisualAction['amountType'] }
                                  setVisualActions(newActions)
                                }}
                                title="选择金额类型"
                                className="bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-[#F8F8FC]"
                              >
                                <option value="percent">仓位百分比 %</option>
                                <option value="fixed">固定金额 USDT</option>
                              </select>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setVisualActions(visualActions.filter(a => a.id !== action.id))}
                          title="删除动作"
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
                    添加动作
                  </button>
                </div>

                {/* 策略预览 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-semibold">策略逻辑预览</h3>
                  </div>
                  <div className="p-4 bg-[#0A0A0F] rounded-xl font-mono text-sm">
                    <p className="text-yellow-400 mb-2">
                      当 {visualLogic === 'and' ? '以下条件全部满足' : '以下任一条件满足'}:
                    </p>
                    {visualConditions.map((c, i) => (
                      <p key={c.id} className="text-[#9090A0] ml-4">
                        {i > 0 && <span className="text-cyan-400">{visualLogic === 'and' ? '且 ' : '或 '}</span>}
                        {c.type === 'indicator' && c.indicator} {' '}
                        {c.operator === 'above' ? '>' : c.operator === 'below' ? '<' : c.operator === 'cross_up' ? '上穿' : c.operator === 'cross_down' ? '下穿' : '在'} {' '}
                        {c.value}
                      </p>
                    ))}
                    <p className="text-green-400 mt-4 mb-2">则执行:</p>
                    {visualActions.map((a) => (
                      <p key={a.id} className="text-[#9090A0] ml-4">
                        {a.type === 'buy' ? '买入开多' : a.type === 'sell' ? '卖出开空' : a.type === 'close' ? '平仓' : '发送通知'}
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
                  <h3 className="text-lg font-semibold mb-4">策略名称</h3>
                  <Input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder="我的自定义策略"
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>

                {/* 代码编辑器 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Python 代码编辑器</h3>
                    <button
                      type="button"
                      onClick={() => setShowCodeEditor(!showCodeEditor)}
                      className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      {showCodeEditor ? '收起编辑器' : '展开编辑器'}
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
                      placeholder="在此编写 Python 策略代码..."
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
                      全屏编辑
                    </Button>
                    <Button variant="outline" className="border-[#2A2A3A]">
                      <Info className="w-4 h-4 mr-2" />
                      API 文档
                    </Button>
                  </div>
                </div>

                {/* 策略模板 */}
                <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">快速模板</h3>
                  <div className="grid gap-3">
                    {[
                      { name: '均值回归策略', desc: '基于价格偏离均值的反转策略', code: `# 均值回归策略\nclass MeanReversionStrategy(BaseStrategy):\n    def __init__(self):\n        self.ma_period = 20\n        self.threshold = 2.0\n\n    def on_tick(self, data):\n        ma = self.calculate_ma(data, self.ma_period)\n        std = self.calculate_std(data, self.ma_period)\n        price = data['close']\n        if price < ma - std * self.threshold:\n            self.buy(size=0.1)\n        elif price > ma + std * self.threshold:\n            self.sell(size=0.1)` },
                      { name: '动量策略', desc: '追踪价格动量的趋势策略', code: `# 动量策略\nclass MomentumStrategy(BaseStrategy):\n    def __init__(self):\n        self.fast_period = 12\n        self.slow_period = 26\n\n    def on_tick(self, data):\n        fast_ma = self.calculate_ema(data, self.fast_period)\n        slow_ma = self.calculate_ema(data, self.slow_period)\n        if fast_ma > slow_ma:\n            self.buy(size=0.1)\n        elif fast_ma < slow_ma:\n            self.sell(size=0.1)` },
                      { name: '网格策略', desc: '自动在网格区间内高抛低吸', code: `# 网格策略\nclass GridStrategy(BaseStrategy):\n    def __init__(self):\n        self.grid_upper = 50000\n        self.grid_lower = 40000\n        self.grid_count = 10\n\n    def on_tick(self, data):\n        price = data['close']\n        grid_size = (self.grid_upper - self.grid_lower) / self.grid_count\n        for i in range(self.grid_count):\n            level = self.grid_lower + i * grid_size\n            if abs(price - level) < grid_size * 0.1:\n                if price < level:\n                    self.buy(size=0.01)\n                else:\n                    self.sell(size=0.01)` }
                    ].map((template) => (
                      <button
                        key={template.name}
                        type="button"
                        onClick={() => setCodeContent(template.code)}
                        className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-xl hover:bg-[#1E1E2E] transition-colors text-left"
                      >
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-[#606070]">{template.desc}</div>
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
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold">交易参数配置</h3>
                  <p className="text-xs text-[#606070]">设置交易所、止损止盈和风险控制</p>
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
              disabled={isSaving || apiLoading}
              className="w-full bg-[#06B6D4] hover:bg-[#0891B2] py-6 disabled:opacity-50"
            >
              {(isSaving || apiLoading) ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Settings className="w-5 h-5 mr-2" />
              )}
              {(isSaving || apiLoading) ? '保存中...' : `保存${activeTab === 'external' ? ' TradingView' : activeTab === 'visual' ? '可视化' : '代码'}策略`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
