'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Play,
  Save,
  AlertTriangle,
  Zap,
  TrendingDown,
  Info,
  X,
  Check,
  RefreshCw,
  Sparkles,
  Pause,
  Square,
  Bell
} from 'lucide-react'

interface MobileVisualBuilderProps {
  onBack?: () => void
  onSave?: (data: VisualStrategyData) => void
}

interface VisualStrategyData {
  name: string
  conditions: Condition[]
  actions: Action[]
  logic: 'and' | 'or'
  tradingPairs: string[]
  amount: string
  leverage: number
  stopLoss: number
  takeProfit: number
}

interface Condition {
  id: string
  indicator: string
  operator: string
  value: string
  period?: string
}

interface Action {
  id: string
  type: 'buy' | 'sell' | 'close' | 'alert'
  amount: string
  amountType: 'percent' | 'fixed'
}

// 指标配置
const indicatorOptions = [
  { id: 'RSI', name: 'RSI 相对强弱', category: '动量', hasParams: true },
  { id: 'MACD', name: 'MACD 指标', category: '动量', hasParams: true },
  { id: 'MA', name: 'MA 均线', category: '趋势', hasParams: true },
  { id: 'EMA', name: 'EMA 指数均线', category: '趋势', hasParams: true },
  { id: 'BOLL', name: '布林带', category: '波动', hasParams: true },
  { id: 'KDJ', name: 'KDJ 指标', category: '动量', hasParams: true },
  { id: 'PRICE', name: '当前价格', category: '价格', hasParams: false },
  { id: 'VOLUME', name: '成交量', category: '成交量', hasParams: false }
]

const operatorOptions = [
  { id: '>', label: '大于', symbol: '>' },
  { id: '<', label: '小于', symbol: '<' },
  { id: '>=', label: '大于等于', symbol: '>=' },
  { id: '<=', label: '小于等于', symbol: '<=' },
  { id: 'cross_up', label: '上穿', symbol: '↗' },
  { id: 'cross_down', label: '下穿', symbol: '↘' }
]

const tradingPairs = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'AVAX', 'MATIC']

export function MobileVisualBuilder({ onBack, onSave }: MobileVisualBuilderProps) {
  const [strategyName, setStrategyName] = useState('')
  const [logic, setLogic] = useState<'and' | 'or'>('and')
  const [conditions, setConditions] = useState<Condition[]>([
    { id: '1', indicator: 'RSI', operator: '<', value: '30', period: '14' }
  ])
  const [actions, setActions] = useState<Action[]>([
    { id: '1', type: 'buy', amount: '10', amountType: 'percent' }
  ])
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC', 'ETH'])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [amount, _setAmount] = useState('100')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [leverage, _setLeverage] = useState(1)
  const [stopLoss, setStopLoss] = useState(5)
  const [takeProfit, setTakeProfit] = useState(10)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stopLossEnabled, _setStopLossEnabled] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [takeProfitEnabled, _setTakeProfitEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editingCondition, setEditingCondition] = useState<string | null>(null)
  const [editingAction, setEditingAction] = useState<string | null>(null)

  // 风控参数状态
  const [isTrailingStop, setIsTrailingStop] = useState(false)
  const [trailingActivation, setTrailingActivation] = useState('5')
  const [trailingCallback, setTrailingCallback] = useState('2')
  const [dcaEnabled, setDcaEnabled] = useState(false)
  const [dcaCount, setDcaCount] = useState('3')
  const [dcaTrigger, setDcaTrigger] = useState('5')
  const [dcaMultiplier, setDcaMultiplier] = useState('1.5')
  const [waterfallProtection, setWaterfallProtection] = useState(true)
  const [blackSwanProtection, setBlackSwanProtection] = useState(false)
  const [blackSwanTrigger, setBlackSwanTrigger] = useState('10')
  const [blackSwanAction, setBlackSwanAction] = useState<'close' | 'pause' | 'notify'>('close')
  const [dailyMaxLoss, setDailyMaxLoss] = useState(false)
  const [dailyMaxLossPercent, setDailyMaxLossPercent] = useState('5')

  const blackSwanActions = [
    { id: 'close', name: '平仓', icon: Square },
    { id: 'pause', name: '暂停', icon: Pause },
    { id: 'notify', name: '通知', icon: Bell },
  ]

  // Toggle 组件
  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      title={enabled ? '关闭' : '开启'}
      aria-label={enabled ? '关闭' : '开启'}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )

  const togglePair = (pair: string) => {
    if (selectedPairs.includes(pair)) {
      setSelectedPairs(selectedPairs.filter(p => p !== pair))
    } else {
      setSelectedPairs([...selectedPairs, pair])
    }
  }

  const addCondition = () => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      indicator: 'RSI',
      operator: '<',
      value: '30',
      period: '14'
    }
    setConditions([...conditions, newCondition])
  }

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id))
  }

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const addAction = () => {
    const newAction: Action = {
      id: Date.now().toString(),
      type: 'buy',
      amount: '10',
      amountType: 'percent'
    }
    setActions([...actions, newAction])
  }

  const removeAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id))
  }

  const updateAction = (id: string, updates: Partial<Action>) => {
    setActions(actions.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const handleSave = async () => {
    setIsSaving(true)
    const data: VisualStrategyData = {
      name: strategyName,
      conditions,
      actions,
      logic,
      tradingPairs: selectedPairs,
      amount,
      leverage,
      stopLoss: stopLossEnabled ? stopLoss : 0,
      takeProfit: takeProfitEnabled ? takeProfit : 0
    }
    await onSave?.(data)
    setIsSaving(false)
  }

  // getIndicatorLabel - 后续可用于显示指标名称
  // const getIndicatorLabel = (id: string) => indicatorOptions.find(i => i.id === id)?.name || id

  const getOperatorLabel = (id: string) => {
    return operatorOptions.find(o => o.id === id)?.symbol || id
  }

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'buy': return '买入开多'
      case 'sell': return '卖出开空'
      case 'close': return '平仓'
      case 'alert': return '仅通知'
      default: return type
    }
  }

  // 条件编辑弹窗
  const ConditionEditor = ({ condition }: { condition: Condition }) => {
    const [localCondition, setLocalCondition] = useState(condition)
    const indicator = indicatorOptions.find(i => i.id === localCondition.indicator)

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
        <div className="w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] max-h-[80vh] overflow-auto">
          <div className="sticky top-0 bg-[#12121A] border-b border-[#1E1E2E] px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold">编辑条件</h3>
            <button type="button" onClick={() => setEditingCondition(null)}>
              <X className="w-5 h-5 text-[#9090A0]" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* 指标选择 */}
            <div>
              <label className="block text-xs text-[#606070] mb-2">选择指标</label>
              <div className="grid grid-cols-2 gap-2">
                {indicatorOptions.map((ind) => (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => setLocalCondition({ ...localCondition, indicator: ind.id })}
                    className={`p-3 rounded-xl text-left transition-all ${
                      localCondition.indicator === ind.id
                        ? 'bg-cyan-500/20 border border-cyan-500/50'
                        : 'bg-[#0A0A0F] border border-[#1E1E2E]'
                    }`}
                  >
                    <div className="text-sm font-medium">{ind.name}</div>
                    <div className="text-[10px] text-[#606070]">{ind.category}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 参数设置 */}
            {indicator?.hasParams && (
              <div>
                <label className="block text-xs text-[#606070] mb-2">周期</label>
                <input
                  type="number"
                  value={localCondition.period || '14'}
                  onChange={(e) => setLocalCondition({ ...localCondition, period: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm focus:border-[#06B6D4] focus:outline-none"
                />
              </div>
            )}

            {/* 运算符 */}
            <div>
              <label className="block text-xs text-[#606070] mb-2">条件</label>
              <div className="grid grid-cols-3 gap-2">
                {operatorOptions.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setLocalCondition({ ...localCondition, operator: op.id })}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      localCondition.operator === op.id
                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                        : 'bg-[#0A0A0F] border border-[#1E1E2E] text-[#9090A0]'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 数值 */}
            <div>
              <label className="block text-xs text-[#606070] mb-2">数值</label>
              <input
                type="number"
                value={localCondition.value}
                onChange={(e) => setLocalCondition({ ...localCondition, value: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm focus:border-[#06B6D4] focus:outline-none"
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-[#12121A] border-t border-[#1E1E2E] p-4">
            <button
              type="button"
              onClick={() => {
                updateCondition(condition.id, localCondition)
                setEditingCondition(null)
              }}
              className="w-full py-3 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] rounded-xl font-medium text-white flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              确认
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 动作编辑弹窗
  const ActionEditor = ({ action }: { action: Action }) => {
    const [localAction, setLocalAction] = useState(action)

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
        <div className="w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] max-h-[80vh] overflow-auto">
          <div className="sticky top-0 bg-[#12121A] border-b border-[#1E1E2E] px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold">编辑操作</h3>
            <button type="button" onClick={() => setEditingAction(null)}>
              <X className="w-5 h-5 text-[#9090A0]" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* 操作类型 */}
            <div>
              <label className="block text-xs text-[#606070] mb-2">操作类型</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'buy', label: '买入开多', color: 'green' },
                  { id: 'sell', label: '卖出开空', color: 'red' },
                  { id: 'close', label: '平仓', color: 'yellow' },
                  { id: 'alert', label: '仅通知', color: 'blue' }
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setLocalAction({ ...localAction, type: type.id as Action['type'] })}
                    className={`p-3 rounded-xl text-sm font-medium transition-all ${
                      localAction.type === type.id
                        ? `bg-${type.color}-500/20 border border-${type.color}-500/50 text-${type.color}-400`
                        : 'bg-[#0A0A0F] border border-[#1E1E2E] text-[#9090A0]'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 金额设置 */}
            {localAction.type !== 'alert' && (
              <>
                <div>
                  <label className="block text-xs text-[#606070] mb-2">金额</label>
                  <input
                    type="number"
                    value={localAction.amount}
                    onChange={(e) => setLocalAction({ ...localAction, amount: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#606070] mb-2">金额类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLocalAction({ ...localAction, amountType: 'percent' })}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                        localAction.amountType === 'percent'
                          ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                          : 'bg-[#0A0A0F] border border-[#1E1E2E] text-[#9090A0]'
                      }`}
                    >
                      百分比 %
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalAction({ ...localAction, amountType: 'fixed' })}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                        localAction.amountType === 'fixed'
                          ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                          : 'bg-[#0A0A0F] border border-[#1E1E2E] text-[#9090A0]'
                      }`}
                    >
                      固定 USDT
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="sticky bottom-0 bg-[#12121A] border-t border-[#1E1E2E] p-4">
            <button
              type="button"
              onClick={() => {
                updateAction(action.id, localAction)
                setEditingAction(null)
              }}
              className="w-full py-3 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] rounded-xl font-medium text-white flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              确认
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0F] text-[#F8F8FC]">
      {/* 顶部导航 */}
      <div className="flex-shrink-0 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">可视化构建</h1>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`p-2 rounded-lg transition-colors ${showPreview ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#9090A0]'}`}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">
          {/* 策略名称 */}
          <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#06B6D4]" />
              <h3 className="font-semibold text-sm">策略信息</h3>
            </div>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="输入策略名称"
              className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm focus:border-[#06B6D4] focus:outline-none"
            />
          </div>

          {/* 交易对选择 */}
          <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
            <label className="block text-xs text-[#606070] mb-2">交易对</label>
            <div className="flex flex-wrap gap-2">
              {tradingPairs.map((pair) => (
                <button
                  key={pair}
                  type="button"
                  onClick={() => togglePair(pair)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    selectedPairs.includes(pair)
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                      : 'bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]'
                  }`}
                >
                  {selectedPairs.includes(pair) && '✓ '}{pair}
                </button>
              ))}
            </div>
          </div>

          {/* 条件区块 */}
          <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <h3 className="font-semibold text-sm">触发条件</h3>
              </div>
              <div className="flex bg-[#0A0A0F] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setLogic('and')}
                  className={`px-2 py-1 rounded text-[10px] ${logic === 'and' ? 'bg-[#06B6D4] text-white' : 'text-[#9090A0]'}`}
                >
                  全部满足
                </button>
                <button
                  type="button"
                  onClick={() => setLogic('or')}
                  className={`px-2 py-1 rounded text-[10px] ${logic === 'or' ? 'bg-[#06B6D4] text-white' : 'text-[#9090A0]'}`}
                >
                  任一满足
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {conditions.map((condition, index) => (
                <div key={condition.id}>
                  {index > 0 && (
                    <div className="text-center text-[#9090A0] text-[10px] py-1">
                      {logic === 'and' ? '且' : '或'}
                    </div>
                  )}
                  <div
                    onClick={() => setEditingCondition(condition.id)}
                    className="p-3 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E] flex items-center justify-between cursor-pointer active:bg-[#1E1E2E]"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-cyan-400 text-xs font-medium">{condition.indicator}</span>
                      {condition.period && (
                        <span className="text-[#606070] text-[10px]">({condition.period})</span>
                      )}
                      <span className="text-yellow-400 text-xs">{getOperatorLabel(condition.operator)}</span>
                      <span className="text-[#F8F8FC] text-xs font-medium">{condition.value}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeCondition(condition.id) }}
                      className="p-1.5 text-[#606070] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addCondition}
              className="w-full py-2.5 border border-dashed border-[#2A2A3A] rounded-xl text-[#9090A0] text-xs flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              添加条件
            </button>
          </div>

          {/* 动作区块 */}
          <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-green-400" />
              <h3 className="font-semibold text-sm">执行操作</h3>
            </div>

            <div className="space-y-2 mb-3">
              {actions.map((action) => (
                <div
                  key={action.id}
                  onClick={() => setEditingAction(action.id)}
                  className="p-3 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E] flex items-center justify-between cursor-pointer active:bg-[#1E1E2E]"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${
                      action.type === 'buy' ? 'text-green-400' :
                      action.type === 'sell' ? 'text-red-400' :
                      action.type === 'close' ? 'text-yellow-400' : 'text-blue-400'
                    }`}>
                      {getActionLabel(action.type)}
                    </span>
                    {action.type !== 'alert' && (
                      <span className="text-[#F8F8FC] text-xs">
                        {action.amount}{action.amountType === 'percent' ? '%' : ' USDT'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAction(action.id) }}
                    className="p-1.5 text-[#606070] hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addAction}
              className="w-full py-2.5 border border-dashed border-[#2A2A3A] rounded-xl text-[#9090A0] text-xs flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              添加操作
            </button>
          </div>

          {/* 风控设置 */}
          <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <h3 className="font-semibold text-sm">风控设置</h3>
            </div>

            {/* 止损止盈 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-[#F43F5E] mb-1.5">止损</label>
                <div className="relative">
                  <input
                    type="text"
                    title="止损比例"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#10B981] mb-1.5">止盈</label>
                <div className="relative">
                  <input
                    type="text"
                    title="止盈比例"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg focus:border-[#06B6D4] focus:outline-none text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">%</span>
                </div>
              </div>
            </div>

            {/* 移动止损 */}
            <div className="mb-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">移动止损</span>
                <Toggle enabled={isTrailingStop} onChange={setIsTrailingStop} />
              </div>
              {isTrailingStop && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs text-[#606070] mb-1.5">激活盈利</label>
                    <div className="relative">
                      <input
                        type="text"
                        title="激活盈利比例"
                        value={trailingActivation}
                        onChange={(e) => setTrailingActivation(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-1.5">回撤比例</label>
                    <div className="relative">
                      <input
                        type="text"
                        title="回撤比例"
                        value={trailingCallback}
                        onChange={(e) => setTrailingCallback(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 补仓设置 */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">补仓 (DCA)</span>
                <Toggle enabled={dcaEnabled} onChange={setDcaEnabled} />
              </div>
              {dcaEnabled && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="block text-xs text-[#606070] mb-1">次数</label>
                    <input
                      type="text"
                      title="补仓次数"
                      value={dcaCount}
                      onChange={(e) => setDcaCount(e.target.value)}
                      className="w-full px-2 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-1">跌幅%</label>
                    <input
                      type="text"
                      title="触发跌幅"
                      value={dcaTrigger}
                      onChange={(e) => setDcaTrigger(e.target.value)}
                      className="w-full px-2 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-1">倍率</label>
                    <input
                      type="text"
                      title="补仓倍率"
                      value={dcaMultiplier}
                      onChange={(e) => setDcaMultiplier(e.target.value)}
                      className="w-full px-2 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 防瀑布 */}
            {dcaEnabled && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">防瀑布保护</span>
                </div>
                <Toggle enabled={waterfallProtection} onChange={setWaterfallProtection} />
              </div>
            )}
          </div>

          {/* 风控保护 */}
          <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">🛡️</span>
              <h3 className="font-semibold text-sm text-[#9090A0]">风控保护</h3>
            </div>

            {/* 黑天鹅保护 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🦢</span>
                  <span className="text-sm font-medium">黑天鹅保护</span>
                </div>
                <Toggle enabled={blackSwanProtection} onChange={setBlackSwanProtection} />
              </div>

              {blackSwanProtection && (
                <div className="p-3 bg-[#0A0A0F]/50 rounded-xl space-y-3 mt-2">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[#606070]">账户亏损达到</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          title="黑天鹅触发阈值"
                          value={blackSwanTrigger}
                          onChange={(e) => setBlackSwanTrigger(e.target.value)}
                          className="w-12 px-2 py-1 bg-[#12121A] border border-[#1E1E2E] rounded text-sm text-center focus:border-[#06B6D4] focus:outline-none"
                        />
                        <span className="text-sm text-[#9090A0]">%</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {['5', '10', '15', '20'].map((val) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setBlackSwanTrigger(val)}
                          title={`设置为${val}%`}
                          className={`flex-1 py-1 rounded text-xs transition-colors ${
                            blackSwanTrigger === val
                              ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                              : 'bg-[#1E1E2E] text-[#606070]'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-2">触发后执行</label>
                    <div className="flex gap-2">
                      {blackSwanActions.map((action) => (
                        <button
                          type="button"
                          key={action.id}
                          onClick={() => setBlackSwanAction(action.id as typeof blackSwanAction)}
                          title={action.name}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                            blackSwanAction === action.id
                              ? 'bg-[#06B6D4] text-black'
                              : 'bg-[#1E1E2E] text-[#9090A0]'
                          }`}
                        >
                          <action.icon className="w-3.5 h-3.5" />
                          {action.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 单日最大亏损 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">📉</span>
                <span className="text-sm font-medium">单日最大亏损</span>
              </div>
              <div className="flex items-center gap-2">
                {dailyMaxLoss && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      title="单日最大亏损比例"
                      value={dailyMaxLossPercent}
                      onChange={(e) => setDailyMaxLossPercent(e.target.value)}
                      className="w-10 px-1.5 py-1 bg-[#0A0A0F] border border-[#1E1E2E] rounded text-xs text-center focus:border-[#06B6D4] focus:outline-none"
                    />
                    <span className="text-xs text-[#606070]">%</span>
                  </div>
                )}
                <Toggle enabled={dailyMaxLoss} onChange={setDailyMaxLoss} />
              </div>
            </div>
          </div>

          {/* 策略预览 */}
          {showPreview && (
            <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-sm">策略逻辑预览</h3>
              </div>
              <div className="p-3 bg-[#0A0A0F] rounded-xl font-mono text-xs">
                <p className="text-yellow-400 mb-1">
                  当 {logic === 'and' ? '以下条件全部满足' : '以下任一条件满足'}:
                </p>
                {conditions.map((c, i) => (
                  <p key={c.id} className="text-[#9090A0] ml-2">
                    {i > 0 && <span className="text-cyan-400">{logic === 'and' ? '且 ' : '或 '}</span>}
                    {c.indicator}{c.period ? `(${c.period})` : ''} {getOperatorLabel(c.operator)} {c.value}
                  </p>
                ))}
                <p className="text-green-400 mt-2 mb-1">则执行:</p>
                {actions.map((a) => (
                  <p key={a.id} className="text-[#9090A0] ml-2">
                    {getActionLabel(a.type)}
                    {a.type !== 'alert' && ` ${a.amount}${a.amountType === 'percent' ? '%' : ' USDT'}`}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex-shrink-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-[#1E1E2E] p-4">
        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 py-3 border border-[#2A2A3A] rounded-xl font-medium text-[#9090A0] flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            回测
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] rounded-xl font-medium text-white flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? '保存中...' : '保存策略'}
          </button>
        </div>
      </div>

      {/* 条件编辑弹窗 */}
      {editingCondition && (
        <ConditionEditor condition={conditions.find(c => c.id === editingCondition)!} />
      )}

      {/* 动作编辑弹窗 */}
      {editingAction && (
        <ActionEditor action={actions.find(a => a.id === editingAction)!} />
      )}
    </div>
  )
}
