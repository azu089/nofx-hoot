'use client'

import { useState } from 'react'
import { Plus, X, Play, Save, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// 可用指标
const indicators = [
  { id: 'rsi', name: 'RSI', category: '动量', params: [{ name: 'period', default: 14, label: '周期' }] },
  { id: 'macd', name: 'MACD', category: '动量', params: [{ name: 'fast', default: 12, label: '快线' }, { name: 'slow', default: 26, label: '慢线' }] },
  { id: 'ma', name: 'MA', category: '趋势', params: [{ name: 'period', default: 20, label: '周期' }] },
  { id: 'ema', name: 'EMA', category: '趋势', params: [{ name: 'period', default: 20, label: '周期' }] },
  { id: 'bb', name: '布林带', category: '波动', params: [{ name: 'period', default: 20, label: '周期' }, { name: 'std', default: 2, label: '标准差' }] },
  { id: 'price', name: '当前价格', category: '价格', params: [] },
  { id: 'volume', name: '成交量', category: '成交量', params: [] },
]

// 运算符
const operators = [
  { id: '>', name: '>' },
  { id: '<', name: '<' },
  { id: '>=', name: '>=' },
  { id: '<=', name: '<=' },
  { id: '==', name: '=' },
  { id: 'cross_above', name: '上穿' },
  { id: 'cross_below', name: '下穿' },
]

// 交易对
const tradingPairs = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE']

interface Condition {
  id: string
  left: string
  leftParams?: Record<string, number>
  operator: string
  right: string
  rightParams?: Record<string, number>
  rightValue?: number
}

interface VisualStrategyBuilderProps {
  onClose?: () => void
}

export function VisualStrategyBuilder({ onClose }: VisualStrategyBuilderProps) {
  const [strategyName, setStrategyName] = useState('')
  const [buyConditions, setBuyConditions] = useState<Condition[]>([
    { id: '1', left: 'rsi', leftParams: { period: 14 }, operator: '<', right: 'value', rightValue: 30 }
  ])
  const [sellConditions, setSellConditions] = useState<Condition[]>([
    { id: '1', left: 'rsi', leftParams: { period: 14 }, operator: '>', right: 'value', rightValue: 70 }
  ])
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['BTC', 'ETH'])
  const [orderAmount, setOrderAmount] = useState('100')
  const [stopLoss, setStopLoss] = useState('5')
  const [takeProfit, setTakeProfit] = useState('10')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const addCondition = (type: 'buy' | 'sell') => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      left: 'rsi',
      leftParams: { period: 14 },
      operator: '<',
      right: 'value',
      rightValue: type === 'buy' ? 30 : 70
    }
    if (type === 'buy') {
      setBuyConditions([...buyConditions, newCondition])
    } else {
      setSellConditions([...sellConditions, newCondition])
    }
  }

  const removeCondition = (type: 'buy' | 'sell', id: string) => {
    if (type === 'buy') {
      setBuyConditions(buyConditions.filter(c => c.id !== id))
    } else {
      setSellConditions(sellConditions.filter(c => c.id !== id))
    }
  }

  const updateCondition = (type: 'buy' | 'sell', id: string, updates: Partial<Condition>) => {
    const update = (conditions: Condition[]) =>
      conditions.map(c => c.id === id ? { ...c, ...updates } : c)

    if (type === 'buy') {
      setBuyConditions(update(buyConditions))
    } else {
      setSellConditions(update(sellConditions))
    }
  }

  const togglePair = (pair: string) => {
    if (selectedPairs.includes(pair)) {
      setSelectedPairs(selectedPairs.filter(p => p !== pair))
    } else {
      setSelectedPairs([...selectedPairs, pair])
    }
  }

  const ConditionRow = ({ condition, type, index }: { condition: Condition, type: 'buy' | 'sell', index: number }) => (
    <div className="space-y-2">
      {index > 0 && (
        <div className="text-center text-[#9090A0] text-sm py-1">AND</div>
      )}
      <div className="flex items-center gap-2 p-3 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E]">
        {/* 左侧指标 */}
        <select
          value={condition.left}
          onChange={(e) => {
            const indicator = indicators.find(i => i.id === e.target.value)
            const params: Record<string, number> = {}
            indicator?.params.forEach(p => { params[p.name] = p.default })
            updateCondition(type, condition.id, { left: e.target.value, leftParams: params })
          }}
          className="bg-[#12121A] border border-[#2A2A3A] rounded px-3 py-2 text-sm text-[#F8F8FC] min-w-[100px]"
        >
          {indicators.map(ind => (
            <option key={ind.id} value={ind.id}>{ind.name}</option>
          ))}
        </select>

        {/* 左侧参数 */}
        {condition.leftParams && Object.keys(condition.leftParams).length > 0 && (
          <div className="flex items-center gap-1 text-[#606070] text-xs">
            (
            {Object.entries(condition.leftParams).map(([key, value], i) => (
              <span key={key}>
                {i > 0 && ', '}
                <input
                  type="number"
                  value={value}
                  onChange={(e) => {
                    const newParams = { ...condition.leftParams, [key]: parseInt(e.target.value) || 0 }
                    updateCondition(type, condition.id, { leftParams: newParams })
                  }}
                  className="w-10 bg-transparent border-b border-[#2A2A3A] text-center text-[#F8F8FC]"
                />
              </span>
            ))}
            )
          </div>
        )}

        {/* 运算符 */}
        <select
          value={condition.operator}
          onChange={(e) => updateCondition(type, condition.id, { operator: e.target.value })}
          className="bg-[#12121A] border border-[#2A2A3A] rounded px-3 py-2 text-sm text-[#F8F8FC]"
        >
          {operators.map(op => (
            <option key={op.id} value={op.id}>{op.name}</option>
          ))}
        </select>

        {/* 右侧值/指标 */}
        <select
          value={condition.right}
          onChange={(e) => {
            if (e.target.value === 'value') {
              updateCondition(type, condition.id, { right: 'value', rightValue: type === 'buy' ? 30 : 70, rightParams: undefined })
            } else {
              const indicator = indicators.find(i => i.id === e.target.value)
              const params: Record<string, number> = {}
              indicator?.params.forEach(p => { params[p.name] = p.default })
              updateCondition(type, condition.id, { right: e.target.value, rightParams: params, rightValue: undefined })
            }
          }}
          className="bg-[#12121A] border border-[#2A2A3A] rounded px-3 py-2 text-sm text-[#F8F8FC] min-w-[100px]"
        >
          <option value="value">数值</option>
          {indicators.map(ind => (
            <option key={ind.id} value={ind.id}>{ind.name}</option>
          ))}
        </select>

        {/* 右侧数值输入 */}
        {condition.right === 'value' && (
          <input
            type="number"
            value={condition.rightValue || 0}
            onChange={(e) => updateCondition(type, condition.id, { rightValue: parseInt(e.target.value) || 0 })}
            className="w-16 bg-[#12121A] border border-[#2A2A3A] rounded px-3 py-2 text-sm text-[#F8F8FC] text-center"
          />
        )}

        {/* 右侧指标参数 */}
        {condition.right !== 'value' && condition.rightParams && Object.keys(condition.rightParams).length > 0 && (
          <div className="flex items-center gap-1 text-[#606070] text-xs">
            (
            {Object.entries(condition.rightParams).map(([key, value], i) => (
              <span key={key}>
                {i > 0 && ', '}
                <input
                  type="number"
                  value={value}
                  onChange={(e) => {
                    const newParams = { ...condition.rightParams, [key]: parseInt(e.target.value) || 0 }
                    updateCondition(type, condition.id, { rightParams: newParams })
                  }}
                  className="w-10 bg-transparent border-b border-[#2A2A3A] text-center text-[#F8F8FC]"
                />
              </span>
            ))}
            )
          </div>
        )}

        {/* 删除按钮 */}
        <button
          onClick={() => removeCondition(type, condition.id)}
          className="p-2 text-[#606070] hover:text-[#F43F5E] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="relative z-10 w-full max-w-2xl bg-[#12121A] border-[#1E1E2E] shadow-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[#F8F8FC]">创建可视化策略</h2>
            <button
              onClick={onClose}
              className="text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Strategy Name */}
          <div className="mb-6">
            <label className="block text-sm text-[#9090A0] mb-2">策略名称</label>
            <Input
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="我的策略"
              className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC]"
            />
          </div>

          <div className="h-px bg-[#1E1E2E] -mx-6 mb-6" />

          {/* Buy Conditions */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#10B981] flex items-center gap-2">
                <span className="text-lg">📈</span> 买入条件
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addCondition('buy')}
                className="border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC]"
              >
                <Plus className="w-4 h-4 mr-1" />
                添加条件
              </Button>
            </div>
            <div className="space-y-2">
              {buyConditions.map((condition, index) => (
                <ConditionRow key={condition.id} condition={condition} type="buy" index={index} />
              ))}
            </div>
          </div>

          <div className="h-px bg-[#1E1E2E] -mx-6 mb-6" />

          {/* Sell Conditions */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#F43F5E] flex items-center gap-2">
                <span className="text-lg">📉</span> 卖出条件
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addCondition('sell')}
                className="border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC]"
              >
                <Plus className="w-4 h-4 mr-1" />
                添加条件
              </Button>
            </div>
            <div className="space-y-2">
              {sellConditions.map((condition, index) => (
                <ConditionRow key={condition.id} condition={condition} type="sell" index={index} />
              ))}
            </div>
          </div>

          <div className="h-px bg-[#1E1E2E] -mx-6 mb-6" />

          {/* Execution Settings */}
          <div className="mb-6">
            <h3 className="font-semibold text-[#F8F8FC] flex items-center gap-2 mb-4">
              <span className="text-lg">⚙️</span> 执行设置
            </h3>

            {/* Trading Pairs */}
            <div className="mb-4">
              <label className="block text-sm text-[#9090A0] mb-2">交易对</label>
              <div className="flex flex-wrap gap-2">
                {tradingPairs.map(pair => (
                  <button
                    key={pair}
                    onClick={() => togglePair(pair)}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                      selectedPairs.includes(pair)
                        ? 'bg-[#1E1E2E] border border-[#06B6D4]/50 text-[#F8F8FC]'
                        : 'bg-[#0A0A0F] border border-[#2A2A3A] text-[#9090A0] hover:border-[#606070]'
                    }`}
                  >
                    {pair} {selectedPairs.includes(pair) && '✓'}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Amount */}
            <div className="mb-4">
              <label className="block text-sm text-[#9090A0] mb-2">每笔金额 (USDT)</label>
              <Input
                type="number"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                placeholder="100"
                className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F8F8FC]"
              />
            </div>

            {/* Advanced Settings */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              高级设置
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-[#0A0A0F] rounded-lg border border-[#1E1E2E] space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[#9090A0] mb-2">止损 (%)</label>
                    <Input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      className="bg-[#12121A] border-[#2A2A3A] text-[#F8F8FC]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#9090A0] mb-2">止盈 (%)</label>
                    <Input
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      className="bg-[#12121A] border-[#2A2A3A] text-[#F8F8FC]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-[#1E1E2E] -mx-6 mb-6" />

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC] hover:bg-[#1E1E2E]"
            >
              <Play className="w-4 h-4 mr-2" />
              回测策略
            </Button>
            <Button
              className="flex-1 bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#F8F8FC] border border-[#2A2A3A]"
            >
              <Save className="w-4 h-4 mr-2" />
              保存并启动
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
