'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Copy,
  Check,
  Plus,
  X,
  AlertTriangle,
  Pause,
  Square,
  Bell
} from 'lucide-react'

// Toggle 组件
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      title={enabled ? '关闭' : '开启'}
      aria-label={enabled ? '关闭' : '开启'}
      className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

type TabType = 'tradingview' | 'visual' | 'code'

type Exchange = 'Binance' | 'OKX' | 'Bybit'
type Symbol = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'MATIC' | 'AVAX'
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
  const [activeTab, setActiveTab] = useState<TabType>('tradingview')
  const [copied, setCopied] = useState(false)
  
  // TradingView Tab State
  const [webhookUrl] = useState('https://api.example.com/webhook/tv/abc123xyz')
  const [exchange, setExchange] = useState<Exchange>('Binance')
  const [selectedSymbols, setSelectedSymbols] = useState<Symbol[]>(['BTC', 'ETH'])
  const [amount, setAmount] = useState('100')
  const [maxPositions, setMaxPositions] = useState('3')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stopLossEnabled, _setStopLossEnabled] = useState(false)
  const [stopLossPercent, setStopLossPercent] = useState(5)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [takeProfitEnabled, _setTakeProfitEnabled] = useState(false)
  const [takeProfitPercent, setTakeProfitPercent] = useState(10)

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
  const [dailyMaxTrades, setDailyMaxTrades] = useState(false)
  const [dailyMaxTradesCount, setDailyMaxTradesCount] = useState('20')
  const [leverage, setLeverage] = useState(1)

  const blackSwanActions = [
    { id: 'close', name: '平仓', icon: Square },
    { id: 'pause', name: '暂停', icon: Pause },
    { id: 'notify', name: '通知', icon: Bell },
  ]
  
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

  const symbols: Symbol[] = ['BTC', 'ETH', 'SOL', 'BNB', 'MATIC', 'AVAX']
  const exchanges: Exchange[] = ['Binance', 'OKX', 'Bybit']
  const indicators: Indicator[] = ['RSI', 'MACD', 'MA', 'KDJ', 'BOLL']
  const operators: Operator[] = ['大于', '小于', '上穿', '下穿', '等于']
  const actionTypes: ActionType[] = ['买入', '卖出', '平仓']

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleSymbol = (symbol: Symbol) => {
    setSelectedSymbols(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    )
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

  const handleSave = () => {
    const data = {
      type: activeTab,
      config: {
        exchange,
        symbols: selectedSymbols,
        amount,
        maxPositions,
        stopLoss: stopLossEnabled ? stopLossPercent : null,
        takeProfit: takeProfitEnabled ? takeProfitPercent : null,
        conditions,
        conditionLogic,
        actions,
        strategyName,
        code
      }
    }
    onSave?.(data)
  }

  const loadTemplate = (template: string) => {
    const templates = {
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
    setCode(templates[template as keyof typeof templates])
  }

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0F] text-white">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white">创建策略</h1>
          <div className="w-10" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1E1E2E]">
          <button
            type="button"
            onClick={() => setActiveTab('tradingview')}
            className={`flex-1 py-3 text-sm font-medium relative transition-colors ${
              activeTab === 'tradingview'
                ? 'text-[#06B6D4]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            aria-label="TradingView 信号"
          >
            TradingView 信号
            {activeTab === 'tradingview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`flex-1 py-3 text-sm font-medium relative transition-colors ${
              activeTab === 'visual'
                ? 'text-[#06B6D4]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            aria-label="可视化搭建"
          >
            可视化搭建
            {activeTab === 'visual' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-3 text-sm font-medium relative transition-colors ${
              activeTab === 'code'
                ? 'text-[#06B6D4]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            aria-label="代码开发"
          >
            代码开发
            {activeTab === 'code' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* TradingView Tab */}
        {activeTab === 'tradingview' && (
          <div className="space-y-4 py-4">
            {/* TradingView Banner */}
            <div className="glass-border-glow relative bg-gradient-to-r from-[#131722]/30 to-[#1E222D]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg width="32" height="32" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 22V6H18V22H14Z" fill="#2962FF"/>
                  <path d="M20 22V10H24V22H20Z" fill="#2962FF"/>
                  <path d="M26 22V14H30V22H26Z" fill="#2962FF"/>
                  <path d="M8 22V2H12V22H8Z" fill="#2962FF"/>
                  <path d="M2 22V8H6V22H2Z" fill="#2962FF"/>
                </svg>
                <div>
                  <h3 className="text-white font-semibold">TradingView 信号接入</h3>
                  <p className="text-xs text-[#787B86]">连接你的 TradingView 警报</p>
                </div>
              </div>
              <p className="text-sm text-[#94A3B8]">
                将 TradingView 的 Alert 信号自动转化为实盘交易，支持 Pine Script 策略
              </p>
            </div>

            {/* Webhook URL */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">Webhook URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm text-[#94A3B8] font-mono"
                  aria-label="Webhook URL"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2.5 bg-[#06B6D4] hover:bg-[#0891B2] rounded-lg transition-colors"
                  aria-label="复制 URL"
                  title="复制"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Risk Control */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <h3 className="text-base font-semibold mb-4">风控配置</h3>
              
              {/* Exchange */}
              <div className="mb-4">
                <label className="block text-sm text-[#94A3B8] mb-2">交易所</label>
                <div className="flex gap-2">
                  {exchanges.map((ex) => (
                    <button
                      type="button"
                      key={ex}
                      onClick={() => setExchange(ex)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        exchange === ex
                          ? 'bg-[#06B6D4] text-white'
                          : 'bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]'
                      }`}
                      aria-label={`选择${ex}`}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trading Pairs */}
              <div className="mb-4">
                <label className="block text-sm text-[#94A3B8] mb-2">交易对</label>
                <div className="grid grid-cols-3 gap-2">
                  {symbols.map((symbol) => (
                    <button
                      type="button"
                      key={symbol}
                      onClick={() => toggleSymbol(symbol)}
                      className={`relative py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedSymbols.includes(symbol)
                          ? 'bg-[#06B6D4] text-white'
                          : 'bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]'
                      }`}
                      aria-label={`${selectedSymbols.includes(symbol) ? '取消选择' : '选择'}${symbol}`}
                    >
                      {symbol}
                      {selectedSymbols.includes(symbol) && (
                        <Check className="w-4 h-4 absolute top-1 right-1" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Max Positions */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-2">单笔金额 (USDT)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm"
                    aria-label="单笔金额"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-2">最大持仓数</label>
                  <input
                    type="number"
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(e.target.value)}
                    className="w-full bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm"
                    aria-label="最大持仓数"
                  />
                </div>
              </div>

              {/* 止损止盈 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-[#F43F5E] mb-1.5">止损</label>
                  <div className="relative">
                    <input
                      type="text"
                      title="止损比例"
                      value={stopLossPercent}
                      onChange={(e) => setStopLossPercent(parseInt(e.target.value) || 0)}
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
                      value={takeProfitPercent}
                      onChange={(e) => setTakeProfitPercent(parseInt(e.target.value) || 0)}
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
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🛡️</span>
                <h3 className="text-sm font-semibold text-[#9090A0]">风控保护</h3>
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

              {/* 每日最大交易次数 */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔢</span>
                  <span className="text-sm font-medium">每日最大交易次数</span>
                </div>
                <div className="flex items-center gap-2">
                  {dailyMaxTrades && (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        title="每日最大交易次数"
                        value={dailyMaxTradesCount}
                        onChange={(e) => setDailyMaxTradesCount(e.target.value)}
                        className="w-12 px-1.5 py-1 bg-[#0A0A0F] border border-[#1E1E2E] rounded text-xs text-center focus:border-[#06B6D4] focus:outline-none"
                      />
                      <span className="text-xs text-[#606070]">次</span>
                    </div>
                  )}
                  <Toggle enabled={dailyMaxTrades} onChange={setDailyMaxTrades} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visual Tab */}
        {activeTab === 'visual' && (
          <div className="space-y-4 py-4">
            {/* Strategy Name */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">策略名称</label>
              <input
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="输入策略名称"
                className="w-full bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm"
                aria-label="策略名称"
              />
            </div>

            {/* Exchange Selection */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">交易所</label>
              <div className="flex gap-2">
                {exchanges.map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    onClick={() => setExchange(ex)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      exchange === ex
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]'
                    }`}
                    aria-label={`选择${ex}`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Trading Pairs */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">交易对</label>
              <div className="grid grid-cols-3 gap-2">
                {symbols.map((symbol) => (
                  <button
                    type="button"
                    key={symbol}
                    onClick={() => toggleSymbol(symbol)}
                    className={`relative py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedSymbols.includes(symbol)
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]'
                    }`}
                    aria-label={`${selectedSymbols.includes(symbol) ? '取消选择' : '选择'}${symbol}`}
                  >
                    {symbol}
                    {selectedSymbols.includes(symbol) && (
                      <Check className="w-4 h-4 absolute top-1 right-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount & Max Positions */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-2">单笔金额 (USDT)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm"
                    aria-label="单笔金额"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-2">最大持仓数</label>
                  <input
                    type="number"
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(e.target.value)}
                    className="w-full bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm"
                    aria-label="最大持仓数"
                  />
                </div>
              </div>
            </div>

            {/* Leverage */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">杠杆倍数</label>
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 5, 10, 20].map((lev) => (
                  <button
                    type="button"
                    key={lev}
                    onClick={() => setLeverage(lev)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      leverage === lev
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]'
                    }`}
                    aria-label={`${lev}倍杠杆`}
                  >
                    {lev}x
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger Conditions */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">触发条件</h3>
                <button
                  type="button"
                  onClick={addCondition}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#06B6D4] hover:bg-[#0891B2] rounded-lg text-sm transition-colors"
                  aria-label="添加条件"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加</span>
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
                        : 'bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]'
                    }`}
                    aria-label={logic}
                  >
                    {logic}
                  </button>
                ))}
              </div>

              {/* Conditions List */}
              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={condition.id} className="bg-[#1A1A24] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-[#94A3B8]">条件 {index + 1}</span>
                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCondition(condition.id)}
                          className="p-1 hover:bg-[#1E1E2E] rounded transition-colors"
                          aria-label="删除条件"
                          title="删除"
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
                        aria-label="选择指标"
                      >
                        {indicators.map((ind) => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(condition.id, 'operator', e.target.value)}
                        className="bg-[#12121A] border border-[#1E1E2E] rounded-lg px-2 py-2 text-sm"
                        aria-label="选择运算符"
                      >
                        {operators.map((op) => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                        placeholder="数值"
                        className="bg-[#12121A] border border-[#1E1E2E] rounded-lg px-2 py-2 text-sm"
                        aria-label="输入数值"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Execute Actions */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">执行动作</h3>
                <button
                  type="button"
                  onClick={addAction}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#06B6D4] hover:bg-[#0891B2] rounded-lg text-sm transition-colors"
                  aria-label="添加动作"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加</span>
                </button>
              </div>

              {/* Actions List */}
              <div className="space-y-3">
                {actions.map((action, index) => (
                  <div key={action.id} className="bg-[#1A1A24] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-[#94A3B8]">动作 {index + 1}</span>
                      {actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
                          className="p-1 hover:bg-[#1E1E2E] rounded transition-colors"
                          aria-label="删除动作"
                          title="删除"
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
                        aria-label="选择动作类型"
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
                          aria-label="输入百分比"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 风控配置 - 与 TradingView tab 相同 */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <h3 className="text-base font-semibold mb-4">风控配置</h3>

              {/* 止损止盈 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-[#F43F5E] mb-1.5">止损</label>
                  <div className="relative">
                    <input
                      type="text"
                      title="止损比例"
                      value={stopLossPercent}
                      onChange={(e) => setStopLossPercent(parseInt(e.target.value) || 0)}
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
                      value={takeProfitPercent}
                      onChange={(e) => setTakeProfitPercent(parseInt(e.target.value) || 0)}
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
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🛡️</span>
                <h3 className="text-sm font-semibold text-[#9090A0]">风控保护</h3>
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

              {/* 每日最大交易次数 */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔢</span>
                  <span className="text-sm font-medium">每日最大交易次数</span>
                </div>
                <div className="flex items-center gap-2">
                  {dailyMaxTrades && (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        title="每日最大交易次数"
                        value={dailyMaxTradesCount}
                        onChange={(e) => setDailyMaxTradesCount(e.target.value)}
                        className="w-12 px-1.5 py-1 bg-[#0A0A0F] border border-[#1E1E2E] rounded text-xs text-center focus:border-[#06B6D4] focus:outline-none"
                      />
                      <span className="text-xs text-[#606070]">次</span>
                    </div>
                  )}
                  <Toggle enabled={dailyMaxTrades} onChange={setDailyMaxTrades} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Code Tab */}
        {activeTab === 'code' && (
          <div className="space-y-4 py-4">
            {/* Strategy Name */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">策略名称</label>
              <input
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="输入策略名称"
                className="w-full bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm"
                aria-label="策略名称"
              />
            </div>

            {/* Exchange Selection */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">交易所</label>
              <div className="flex gap-2">
                {exchanges.map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    onClick={() => setExchange(ex)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      exchange === ex
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]'
                    }`}
                    aria-label={`选择${ex}`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Trading Pairs */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">交易对</label>
              <div className="grid grid-cols-3 gap-2">
                {symbols.map((symbol) => (
                  <button
                    type="button"
                    key={symbol}
                    onClick={() => toggleSymbol(symbol)}
                    className={`relative py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedSymbols.includes(symbol)
                        ? 'bg-[#06B6D4] text-white'
                        : 'bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]'
                    }`}
                    aria-label={`${selectedSymbols.includes(symbol) ? '取消选择' : '选择'}${symbol}`}
                  >
                    {symbol}
                    {selectedSymbols.includes(symbol) && (
                      <Check className="w-4 h-4 absolute top-1 right-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Templates */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-3">快速模板</label>
              <div className="grid grid-cols-3 gap-2">
                {['均值回归', '动量', '网格'].map((template) => (
                  <button
                    type="button"
                    key={template}
                    onClick={() => loadTemplate(template)}
                    className="py-2.5 bg-[#1A1A24] hover:bg-[#1E1E2E] rounded-lg text-sm font-medium transition-colors"
                    aria-label={`加载${template}模板`}
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Editor */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <label className="block text-sm text-[#94A3B8] mb-2">策略代码</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-80 bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm font-mono resize-none"
                spellCheck={false}
                aria-label="策略代码"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Save Button - Inside the phone frame */}
      <div className="shrink-0 p-4 bg-[#0A0A0F] border-t border-[#1E1E2E]">
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3.5 bg-[#06B6D4] hover:bg-[#0891B2] rounded-xl font-semibold transition-colors"
          aria-label="保存策略"
        >
          保存策略
        </button>
      </div>
    </div>
  )
}
