'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Globe,
  Layers,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Zap,
  AlertTriangle,
  Play,
  Save,
  RefreshCw,
  Info,
  ChevronRight
} from 'lucide-react'

type TabType = 'external' | 'visual' | 'code'

interface MobileStrategyCreatorProps {
  onBack?: () => void
  onSave?: (data: StrategyData) => void
  onNavigate?: (path: string) => void
}

interface StrategyData {
  type: 'tradingview' | 'visual' | 'code'
  config?: unknown
  conditions?: VisualCondition[]
  actions?: VisualAction[]
  logic?: string
}

interface VisualCondition {
  id: string
  type: 'indicator' | 'price' | 'time' | 'volume'
  indicator?: string
  operator: 'above' | 'below' | 'cross_up' | 'cross_down' | 'between'
  value: string
}

interface VisualAction {
  id: string
  type: 'buy' | 'sell' | 'close' | 'alert'
  amount: string
  amountType: 'percent' | 'fixed'
}

// Toggle 组件
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
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
}

const tabs: { id: TabType; label: string; icon: React.ElementType; tag?: string }[] = [
  { id: 'external', label: 'TradingView', icon: Globe, tag: '推荐' },
  { id: 'visual', label: '可视化', icon: Layers },
  { id: 'code', label: '代码', icon: Code, tag: '高级' }
]

const exchanges = ['Binance', 'OKX', 'Bybit', 'Gate.io', 'Bitget']
const coins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'AVAX', 'MATIC']
const indicators = ['RSI', 'MACD', 'MA', 'EMA', 'BOLL', 'KDJ']
const operators = [
  { id: 'above', label: '>' },
  { id: 'below', label: '<' },
  { id: 'cross_up', label: '上穿' },
  { id: 'cross_down', label: '下穿' }
]

export function MobileStrategyCreator({ onBack, onSave }: MobileStrategyCreatorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('external')
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // TradingView 配置
  const [tvExchange, setTvExchange] = useState('Binance')
  const [tvCoins, setTvCoins] = useState<string[]>(['BTC', 'ETH'])
  const [tvAmount, setTvAmount] = useState('100')
  const [tvMaxPositions, setTvMaxPositions] = useState('5')
  const [tvStopLoss, setTvStopLoss] = useState(5)
  const [tvTakeProfit, setTvTakeProfit] = useState(10)
  const [tvStopLossEnabled, setTvStopLossEnabled] = useState(true)
  const [tvTakeProfitEnabled, setTvTakeProfitEnabled] = useState(true)
  const [tvTrailingEnabled, setTvTrailingEnabled] = useState(false)
  const [tvTrailingPercent, setTvTrailingPercent] = useState(3)
  const [showTvAdvanced, setShowTvAdvanced] = useState(false)
  const [tvMaxDailyLoss, setTvMaxDailyLoss] = useState('500')
  const [tvMaxDailyTrades, setTvMaxDailyTrades] = useState('20')
  const [showExchangeDropdown, setShowExchangeDropdown] = useState(false)

  // 可视化配置
  const [visualExchange, setVisualExchange] = useState('Binance')
  const [visualCoins, setVisualCoins] = useState<string[]>(['BTC', 'ETH'])
  const [visualLogic, setVisualLogic] = useState<'and' | 'or'>('and')
  const [visualConditions, setVisualConditions] = useState<VisualCondition[]>([
    { id: '1', type: 'indicator', indicator: 'RSI', operator: 'below', value: '30' }
  ])
  const [visualActions, setVisualActions] = useState<VisualAction[]>([
    { id: '1', type: 'buy', amount: '10', amountType: 'percent' }
  ])
  const [visualAmount, setVisualAmount] = useState('100')
  const [visualLeverage, setVisualLeverage] = useState(1)
  const [visualStopLoss, setVisualStopLoss] = useState(5)
  const [visualTakeProfit, setVisualTakeProfit] = useState(10)
  const [visualStopLossEnabled, setVisualStopLossEnabled] = useState(true)
  const [visualTakeProfitEnabled, setVisualTakeProfitEnabled] = useState(true)
  const [showVisualAdvanced, setShowVisualAdvanced] = useState(false)
  const [showVisualExchangeDropdown, setShowVisualExchangeDropdown] = useState(false)

  // 代码配置
  const [codeExchange, setCodeExchange] = useState('Binance')
  const [codeCoins, setCodeCoins] = useState<string[]>(['BTC', 'ETH'])
  const [codeName, setCodeName] = useState('')
  const [codeContent, setCodeContent] = useState(`# 策略模板
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
  const [showCodeExchangeDropdown, setShowCodeExchangeDropdown] = useState(false)

  const webhookUrl = 'https://api.hoot.ai/webhook/tv/your-unique-id'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleCoin = (coin: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(coin)) {
      setList(list.filter(c => c !== coin))
    } else {
      setList([...list, coin])
    }
  }

  const addCondition = () => {
    setVisualConditions([
      ...visualConditions,
      { id: Date.now().toString(), type: 'indicator', indicator: 'RSI', operator: 'below', value: '30' }
    ])
  }

  const removeCondition = (id: string) => {
    setVisualConditions(visualConditions.filter(c => c.id !== id))
  }

  const updateCondition = (id: string, updates: Partial<VisualCondition>) => {
    setVisualConditions(visualConditions.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const addAction = () => {
    setVisualActions([
      ...visualActions,
      { id: Date.now().toString(), type: 'buy', amount: '10', amountType: 'percent' }
    ])
  }

  const removeAction = (id: string) => {
    setVisualActions(visualActions.filter(a => a.id !== id))
  }

  const updateAction = (id: string, updates: Partial<VisualAction>) => {
    setVisualActions(visualActions.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const handleSave = async () => {
    setIsSaving(true)
    const data: StrategyData = activeTab === 'external'
      ? { type: 'tradingview', config: { exchange: tvExchange, coins: tvCoins } }
      : activeTab === 'visual'
      ? { type: 'visual', conditions: visualConditions, actions: visualActions, logic: visualLogic }
      : { type: 'code', config: { name: codeName, code: codeContent } }

    await onSave?.(data)
    setIsSaving(false)
  }

  const codeTemplates = [
    { name: '均值回归', desc: '基于价格偏离均值反转' },
    { name: '动量策略', desc: '追踪价格动量趋势' },
    { name: '网格策略', desc: '网格区间高抛低吸' }
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex flex-col">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            title="返回"
            aria-label="返回"
            className="p-2 -ml-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">创建策略</h1>
          <div className="w-9" />
        </div>

        {/* Tab 切换 */}
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#06B6D4] text-white'
                      : 'bg-[#12121A] border border-[#1E1E2E] text-[#9090A0]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.tag && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      isActive ? 'bg-white/20' : 'bg-cyan-400/20 text-cyan-400'
                    }`}>
                      {tab.tag}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto pb-24">
        <div className="p-4 space-y-4">
          {/* TradingView Tab */}
          {activeTab === 'external' && (
            <>
              {/* Webhook 配置 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-[#06B6D4]" />
                  <h3 className="font-semibold text-sm">TradingView Webhook</h3>
                </div>
                <p className="text-xs text-[#9090A0] mb-3">通过 TradingView Alert 接收交易信号</p>

                <div className="bg-[#0A0A0F] rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#606070]">Webhook URL</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-xs text-cyan-400"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <code className="text-xs text-[#F8F8FC] break-all">{webhookUrl}</code>
                </div>

                <button
                  type="button"
                  className="w-full py-2.5 border border-[#2A2A3A] rounded-xl text-sm text-[#9090A0] flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  生成新的 Webhook
                </button>
              </div>

              {/* 基础配置 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-[#06B6D4]" />
                  <h3 className="font-semibold text-sm">风控参数配置</h3>
                </div>

                {/* 交易所 */}
                <div className="mb-4">
                  <label className="block text-xs text-[#606070] mb-1.5">交易所</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowExchangeDropdown(!showExchangeDropdown)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm"
                    >
                      <span>{tvExchange}</span>
                      <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showExchangeDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showExchangeDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-xl z-20 overflow-hidden">
                        {exchanges.map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => { setTvExchange(ex); setShowExchangeDropdown(false) }}
                            className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#1E1E2E] ${tvExchange === ex ? 'text-[#06B6D4]' : 'text-[#F8F8FC]'}`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 交易对 */}
                <div className="mb-4">
                  <label className="block text-xs text-[#606070] mb-1.5">交易对</label>
                  <div className="flex flex-wrap gap-2">
                    {coins.map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => toggleCoin(coin, tvCoins, setTvCoins)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                          tvCoins.includes(coin)
                            ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                            : 'bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]'
                        }`}
                      >
                        {tvCoins.includes(coin) && '✓ '}{coin}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 金额和持仓 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-[#606070] mb-1.5">每笔金额</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606070] text-sm">$</span>
                      <input
                        type="number"
                        value={tvAmount}
                        onChange={(e) => setTvAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm focus:border-[#06B6D4] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-1.5">最大持仓</label>
                    <input
                      type="number"
                      value={tvMaxPositions}
                      onChange={(e) => setTvMaxPositions(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm focus:border-[#06B6D4] focus:outline-none"
                    />
                  </div>
                </div>

                {/* 止损止盈 */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-xl">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <span className="text-sm">止损</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={tvStopLossEnabled} onChange={setTvStopLossEnabled} />
                      {tvStopLossEnabled && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={tvStopLoss}
                            onChange={(e) => setTvStopLoss(Number(e.target.value))}
                            className="w-12 px-2 py-1 bg-[#12121A] border border-[#2A2A3A] rounded text-xs text-center"
                          />
                          <span className="text-xs text-[#9090A0]">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-xl">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm">止盈</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={tvTakeProfitEnabled} onChange={setTvTakeProfitEnabled} />
                      {tvTakeProfitEnabled && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={tvTakeProfit}
                            onChange={(e) => setTvTakeProfit(Number(e.target.value))}
                            className="w-12 px-2 py-1 bg-[#12121A] border border-[#2A2A3A] rounded text-xs text-center"
                          />
                          <span className="text-xs text-[#9090A0]">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-xl">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm">移动止损</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={tvTrailingEnabled} onChange={setTvTrailingEnabled} />
                      {tvTrailingEnabled && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={tvTrailingPercent}
                            onChange={(e) => setTvTrailingPercent(Number(e.target.value))}
                            className="w-12 px-2 py-1 bg-[#12121A] border border-[#2A2A3A] rounded text-xs text-center"
                          />
                          <span className="text-xs text-[#9090A0]">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 高级设置 */}
                <button
                  type="button"
                  onClick={() => setShowTvAdvanced(!showTvAdvanced)}
                  className="flex items-center justify-between w-full p-3 bg-[#0A0A0F] rounded-xl text-[#9090A0]"
                >
                  <span className="text-sm">高级风控设置</span>
                  {showTvAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showTvAdvanced && (
                  <div className="mt-3 p-3 bg-[#0A0A0F] rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm">每日最大亏损</span>
                        <p className="text-[10px] text-[#606070]">达到后暂停交易</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-[#9090A0]">$</span>
                        <input
                          type="number"
                          value={tvMaxDailyLoss}
                          onChange={(e) => setTvMaxDailyLoss(e.target.value)}
                          className="w-16 px-2 py-1 bg-[#12121A] border border-[#2A2A3A] rounded text-xs text-center"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm">每日最大交易</span>
                        <p className="text-[10px] text-[#606070]">防止过度交易</p>
                      </div>
                      <input
                        type="number"
                        value={tvMaxDailyTrades}
                        onChange={(e) => setTvMaxDailyTrades(e.target.value)}
                        className="w-16 px-2 py-1 bg-[#12121A] border border-[#2A2A3A] rounded text-xs text-center"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 可视化 Tab */}
          {activeTab === 'visual' && (
            <>
              {/* 交易所和交易对 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-[#06B6D4]" />
                  <h3 className="font-semibold text-sm">选择交易所和交易对</h3>
                </div>

                <div className="mb-4">
                  <label className="block text-xs text-[#606070] mb-1.5">交易所</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowVisualExchangeDropdown(!showVisualExchangeDropdown)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm"
                    >
                      <span>{visualExchange}</span>
                      <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showVisualExchangeDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showVisualExchangeDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-xl z-20 overflow-hidden">
                        {exchanges.map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => { setVisualExchange(ex); setShowVisualExchangeDropdown(false) }}
                            className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#1E1E2E] ${visualExchange === ex ? 'text-[#06B6D4]' : 'text-[#F8F8FC]'}`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#606070] mb-1.5">交易对</label>
                  <div className="flex flex-wrap gap-2">
                    {coins.map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => toggleCoin(coin, visualCoins, setVisualCoins)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                          visualCoins.includes(coin)
                            ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                            : 'bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]'
                        }`}
                      >
                        {visualCoins.includes(coin) && '✓ '}{coin}/USDT
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 条件设置 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <h3 className="font-semibold text-sm">当满足以下条件时</h3>
                  </div>
                  <div className="flex bg-[#0A0A0F] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setVisualLogic('and')}
                      className={`px-2 py-1 rounded text-[10px] ${visualLogic === 'and' ? 'bg-[#06B6D4] text-white' : 'text-[#9090A0]'}`}
                    >
                      全部满足
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisualLogic('or')}
                      className={`px-2 py-1 rounded text-[10px] ${visualLogic === 'or' ? 'bg-[#06B6D4] text-white' : 'text-[#9090A0]'}`}
                    >
                      任一满足
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  {visualConditions.map((condition, index) => (
                    <div key={condition.id} className="p-3 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E]">
                      {index > 0 && (
                        <div className="text-center text-[#9090A0] text-[10px] mb-2">
                          {visualLogic === 'and' ? '且' : '或'}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <select
                          value={condition.indicator || 'RSI'}
                          onChange={(e) => updateCondition(condition.id, { indicator: e.target.value })}
                          className="flex-1 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-2 py-2 text-xs"
                        >
                          {indicators.map(ind => (
                            <option key={ind} value={ind}>{ind}</option>
                          ))}
                        </select>
                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(condition.id, { operator: e.target.value as VisualCondition['operator'] })}
                          className="w-16 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-2 py-2 text-xs"
                        >
                          {operators.map(op => (
                            <option key={op.id} value={op.id}>{op.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={condition.value}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          className="w-14 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-2 py-2 text-xs text-center"
                        />
                        <button
                          type="button"
                          onClick={() => removeCondition(condition.id)}
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

              {/* 动作设置 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-green-400" />
                  <h3 className="font-semibold text-sm">执行以下操作</h3>
                </div>

                <div className="space-y-2 mb-3">
                  {visualActions.map((action) => (
                    <div key={action.id} className="p-3 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E]">
                      <div className="flex items-center gap-2">
                        <select
                          value={action.type}
                          onChange={(e) => updateAction(action.id, { type: e.target.value as VisualAction['type'] })}
                          className="flex-1 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-2 py-2 text-xs"
                        >
                          <option value="buy">买入开多</option>
                          <option value="sell">卖出开空</option>
                          <option value="close">平仓</option>
                          <option value="alert">仅通知</option>
                        </select>
                        {action.type !== 'alert' && (
                          <>
                            <input
                              type="number"
                              value={action.amount}
                              onChange={(e) => updateAction(action.id, { amount: e.target.value })}
                              className="w-14 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-2 py-2 text-xs text-center"
                            />
                            <select
                              value={action.amountType}
                              onChange={(e) => updateAction(action.id, { amountType: e.target.value as VisualAction['amountType'] })}
                              className="w-16 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg px-1 py-2 text-[10px]"
                            >
                              <option value="percent">%</option>
                              <option value="fixed">USDT</option>
                            </select>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
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
                  onClick={addAction}
                  className="w-full py-2.5 border border-dashed border-[#2A2A3A] rounded-xl text-[#9090A0] text-xs flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  添加动作
                </button>
              </div>

              {/* 风控参数 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-red-400" />
                  <h3 className="font-semibold text-sm">风控参数配置</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-[#606070] mb-1.5">每笔金额</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606070] text-xs">$</span>
                      <input
                        type="number"
                        value={visualAmount}
                        onChange={(e) => setVisualAmount(e.target.value)}
                        className="w-full pl-6 pr-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm focus:border-[#06B6D4] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#606070] mb-1.5">杠杆倍数</label>
                    <div className="flex gap-1">
                      {[1, 2, 5, 10].map((lev) => (
                        <button
                          key={lev}
                          type="button"
                          onClick={() => setVisualLeverage(lev)}
                          className={`flex-1 py-2 rounded-lg text-xs ${
                            visualLeverage === lev
                              ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                              : 'bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]'
                          }`}
                        >
                          {lev}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 止损止盈 */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-xl">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <span className="text-sm">止损</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={visualStopLossEnabled} onChange={setVisualStopLossEnabled} />
                      {visualStopLossEnabled && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={visualStopLoss}
                            onChange={(e) => setVisualStopLoss(Number(e.target.value))}
                            className="w-12 px-2 py-1 bg-[#12121A] border border-[#2A2A3A] rounded text-xs text-center"
                          />
                          <span className="text-xs text-[#9090A0]">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-xl">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm">止盈</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={visualTakeProfitEnabled} onChange={setVisualTakeProfitEnabled} />
                      {visualTakeProfitEnabled && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={visualTakeProfit}
                            onChange={(e) => setVisualTakeProfit(Number(e.target.value))}
                            className="w-12 px-2 py-1 bg-[#12121A] border border-[#2A2A3A] rounded text-xs text-center"
                          />
                          <span className="text-xs text-[#9090A0]">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 高级设置 */}
                <button
                  type="button"
                  onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
                  className="flex items-center justify-between w-full p-3 bg-[#0A0A0F] rounded-xl text-[#9090A0]"
                >
                  <span className="text-sm">高级风控设置</span>
                  {showVisualAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showVisualAdvanced && (
                  <div className="mt-3 p-3 bg-[#0A0A0F] rounded-xl">
                    <p className="text-xs text-[#606070]">更多高级设置将在后续版本开放</p>
                  </div>
                )}
              </div>

              {/* 策略预览 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-semibold text-sm">策略逻辑预览</h3>
                </div>
                <div className="p-3 bg-[#0A0A0F] rounded-xl font-mono text-xs">
                  <p className="text-yellow-400 mb-1">
                    当 {visualLogic === 'and' ? '以下条件全部满足' : '以下任一条件满足'}:
                  </p>
                  {visualConditions.map((c, i) => (
                    <p key={c.id} className="text-[#9090A0] ml-2">
                      {i > 0 && <span className="text-cyan-400">{visualLogic === 'and' ? '且 ' : '或 '}</span>}
                      {c.indicator} {operators.find(o => o.id === c.operator)?.label} {c.value}
                    </p>
                  ))}
                  <p className="text-green-400 mt-2 mb-1">则执行:</p>
                  {visualActions.map((a) => (
                    <p key={a.id} className="text-[#9090A0] ml-2">
                      {a.type === 'buy' ? '买入' : a.type === 'sell' ? '卖出' : a.type === 'close' ? '平仓' : '通知'}
                      {a.type !== 'alert' && ` ${a.amount}${a.amountType === 'percent' ? '%' : ' USDT'}`}
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 代码 Tab */}
          {activeTab === 'code' && (
            <>
              {/* 策略配置 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <h3 className="font-semibold text-sm mb-4">策略配置</h3>

                <div className="mb-4">
                  <label className="block text-xs text-[#606070] mb-1.5">策略名称</label>
                  <input
                    type="text"
                    value={codeName}
                    onChange={(e) => setCodeName(e.target.value)}
                    placeholder="我的自定义策略"
                    className="w-full px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs text-[#606070] mb-1.5">交易所</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCodeExchangeDropdown(!showCodeExchangeDropdown)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm"
                    >
                      <span>{codeExchange}</span>
                      <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showCodeExchangeDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showCodeExchangeDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-xl z-20 overflow-hidden">
                        {exchanges.map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => { setCodeExchange(ex); setShowCodeExchangeDropdown(false) }}
                            className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#1E1E2E] ${codeExchange === ex ? 'text-[#06B6D4]' : 'text-[#F8F8FC]'}`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#606070] mb-1.5">交易对</label>
                  <div className="flex flex-wrap gap-2">
                    {coins.map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => toggleCoin(coin, codeCoins, setCodeCoins)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                          codeCoins.includes(coin)
                            ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                            : 'bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]'
                        }`}
                      >
                        {codeCoins.includes(coin) && '✓ '}{coin}/USDT
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 代码编辑器 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Python 代码</h3>
                  <span className="text-[10px] text-[#606070]">strategy.py</span>
                </div>
                <div className="bg-[#0A0A0F] rounded-xl border border-[#1E1E2E] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-[#1E1E2E] border-b border-[#2A2A3A]">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <button type="button" className="text-[10px] text-cyan-400">API 文档</button>
                  </div>
                  <textarea
                    value={codeContent}
                    onChange={(e) => setCodeContent(e.target.value)}
                    className="w-full h-48 p-3 bg-transparent font-mono text-xs text-[#F8F8FC] resize-none focus:outline-none"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* 快速模板 */}
              <div className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
                <h3 className="font-semibold text-sm mb-3">快速模板</h3>
                <div className="space-y-2">
                  {codeTemplates.map((template) => (
                    <button
                      key={template.name}
                      type="button"
                      className="w-full flex items-center justify-between p-3 bg-[#0A0A0F] rounded-xl hover:bg-[#1E1E2E] transition-colors"
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">{template.name}</div>
                        <div className="text-[10px] text-[#606070]">{template.desc}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#606070]" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-[#1E1E2E] p-4 z-20">
        <div className="flex gap-3">
          {activeTab === 'visual' && (
            <button
              type="button"
              className="flex-1 py-3 border border-[#2A2A3A] rounded-xl font-medium text-[#9090A0] flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              回测策略
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`${activeTab === 'visual' ? 'flex-1' : 'w-full'} py-3 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] rounded-xl font-medium text-white flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50`}
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
    </div>
  )
}
