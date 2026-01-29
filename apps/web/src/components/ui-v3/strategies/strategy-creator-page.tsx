'use client'

import { useState } from 'react'
import {
  Zap,
  Globe,
  Layers,
  Code,
  ArrowLeft,
  ChevronRight,
  Settings,
  Plus,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type TabType = 'external' | 'visual' | 'code'

interface StrategyCreatorPageProps {
  onSave?: (config: any) => void
  onNavigate?: (path: string) => void
}

const tabs: { id: TabType; label: string; icon: React.ReactNode; description: string; tag?: string }[] = [
  { id: 'external', label: 'TradingView', icon: <Globe className="w-4 h-4" />, description: '连接你的 TradingView 账户，将 Alert 信号自动转化为实盘交易', tag: '推荐' },
  { id: 'visual', label: '可视化搭建', icon: <Layers className="w-4 h-4" />, description: '无需编程，通过条件组合搭建自己的量化策略逻辑' },
  { id: 'code', label: '代码开发', icon: <Code className="w-4 h-4" />, description: '使用 Python 编写完全自定义的策略，适合专业量化开发者', tag: '高级' }
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

// TradingView 风控配置
interface TVRiskConfig {
  selectedExchange: string
  selectedCoins: string[]
  amountPerTrade: number
  maxPositions: number
  stopLossEnabled: boolean
  stopLossPercent: number
  takeProfitEnabled: boolean
  takeProfitPercent: number
  trailingStopEnabled: boolean
  trailingStopPercent: number
  maxDailyLoss: number
  maxDailyTrades: number
}

// 可视化策略风控配置
interface VisualRiskConfig {
  selectedExchange: string
  selectedCoins: string[]
  amountPerTrade: number
  maxPositions: number
  stopLossEnabled: boolean
  stopLossPercent: number
  takeProfitEnabled: boolean
  takeProfitPercent: number
  maxDailyLoss: number
  maxDailyTrades: number
  leverage: number
}

// 代码策略配置
interface CodeStrategyConfig {
  selectedExchange: string
  selectedCoins: string[]
  strategyName: string
  code: string
}

export function StrategyCreatorPage({
  onSave,
  onNavigate
}: StrategyCreatorPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('external')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 保存策略配置到"我的策略"
  const handleSave = async (strategyData: any) => {
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      // 调用父组件的 onSave（如果有的话，用于实际 API 调用）
      await onSave?.(strategyData)

      // 显示成功状态
      setSaveSuccess(true)

      // 3秒后重置成功状态
      setTimeout(() => {
        setSaveSuccess(false)
      }, 3000)
    } catch (error) {
      console.error('保存失败:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // TradingView 风控配置状态
  const [tvConfig, setTvConfig] = useState<TVRiskConfig>({
    selectedExchange: 'binance',
    selectedCoins: ['BTC', 'ETH'],
    amountPerTrade: 100,
    maxPositions: 5,
    stopLossEnabled: true,
    stopLossPercent: 5,
    takeProfitEnabled: true,
    takeProfitPercent: 10,
    trailingStopEnabled: false,
    trailingStopPercent: 3,
    maxDailyLoss: 500,
    maxDailyTrades: 20,
  })
  const [showTvAdvanced, setShowTvAdvanced] = useState(false)

  // 可视化搭建状态
  const [visualConditions, setVisualConditions] = useState<VisualCondition[]>([
    { id: '1', type: 'indicator', indicator: 'RSI', operator: 'below', value: '30' }
  ])
  const [visualActions, setVisualActions] = useState<VisualAction[]>([
    { id: '1', type: 'buy', amount: '10', amountType: 'percent' }
  ])
  const [visualLogic, setVisualLogic] = useState<'and' | 'or'>('and')

  // 可视化策略风控配置
  const [visualConfig, setVisualConfig] = useState<VisualRiskConfig>({
    selectedExchange: 'binance',
    selectedCoins: ['BTC', 'ETH'],
    amountPerTrade: 100,
    maxPositions: 5,
    stopLossEnabled: true,
    stopLossPercent: 5,
    takeProfitEnabled: true,
    takeProfitPercent: 10,
    maxDailyLoss: 500,
    maxDailyTrades: 20,
    leverage: 1,
  })
  const [showVisualAdvanced, setShowVisualAdvanced] = useState(false)

  // 代码策略配置
  const [codeConfig, setCodeConfig] = useState<CodeStrategyConfig>({
    selectedExchange: 'binance',
    selectedCoins: ['BTC', 'ETH'],
    strategyName: '',
    code: `# 策略模板示例
class MyStrategy(BaseStrategy):
    def __init__(self):
        self.rsi_period = 14
        self.oversold = 30

    def on_tick(self, data):
        rsi = self.calculate_rsi(data, self.rsi_period)
        if rsi < self.oversold:
            self.buy(size=0.1)
        elif rsi > 70:
            self.sell(size=0.1)`
  })
  const [showCodeEditor, setShowCodeEditor] = useState(false)

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
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#06B6D4]/10">
              {tabs.find(t => t.id === activeTab)?.icon}
            </div>
            <div>
              <h2 className="font-semibold">{tabs.find(t => t.id === activeTab)?.label}</h2>
              <p className="text-sm text-[#9090A0]">{tabs.find(t => t.id === activeTab)?.description}</p>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'external' && (
          <div className="space-y-4">
            {/* Webhook 配置 */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
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

            {/* 风控参数配置 */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold">风控参数配置</h3>
              </div>

              {/* 交易所选择 */}
              <div className="mb-4">
                <label className="block text-sm text-[#9090A0] mb-2">交易所</label>
                <select
                  value={tvConfig.selectedExchange}
                  onChange={(e) => setTvConfig({ ...tvConfig, selectedExchange: e.target.value })}
                  title="选择交易所"
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-4 py-3 text-[#F8F8FC]"
                >
                  <option value="binance">Binance</option>
                  <option value="okx">OKX</option>
                  <option value="bybit">Bybit</option>
                </select>
              </div>

              {/* 交易对选择 */}
              <div className="mb-4">
                <label className="block text-sm text-[#9090A0] mb-2">交易对</label>
                <div className="flex flex-wrap gap-2">
                  {['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'].map((coin) => (
                    <button
                      key={coin}
                      type="button"
                      onClick={() => {
                        const newCoins = tvConfig.selectedCoins.includes(coin)
                          ? tvConfig.selectedCoins.filter(c => c !== coin)
                          : [...tvConfig.selectedCoins, coin]
                        setTvConfig({ ...tvConfig, selectedCoins: newCoins })
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
                        tvConfig.selectedCoins.includes(coin)
                          ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400"
                          : "bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]"
                      )}
                    >
                      {tvConfig.selectedCoins.includes(coin) && '✓ '}{coin}
                    </button>
                  ))}
                </div>
              </div>

              {/* 基础参数 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="tv-amount" className="block text-sm text-[#9090A0] mb-2">每笔金额 (USDT)</label>
                  <Input
                    id="tv-amount"
                    type="number"
                    value={tvConfig.amountPerTrade}
                    onChange={(e) => setTvConfig({ ...tvConfig, amountPerTrade: Number(e.target.value) })}
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>
                <div>
                  <label htmlFor="tv-max-positions" className="block text-sm text-[#9090A0] mb-2">最大持仓数</label>
                  <Input
                    id="tv-max-positions"
                    type="number"
                    value={tvConfig.maxPositions}
                    onChange={(e) => setTvConfig({ ...tvConfig, maxPositions: Number(e.target.value) })}
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>
              </div>

              {/* 止损止盈 */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="text-sm">止损</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, stopLossEnabled: !tvConfig.stopLossEnabled })}
                      title={tvConfig.stopLossEnabled ? "关闭止损" : "开启止损"}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative",
                        tvConfig.stopLossEnabled ? "bg-cyan-500" : "bg-[#2A2A3A]"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        tvConfig.stopLossEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                    {tvConfig.stopLossEnabled && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={tvConfig.stopLossPercent}
                          onChange={(e) => setTvConfig({ ...tvConfig, stopLossPercent: Number(e.target.value) })}
                          className="w-16 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                        />
                        <span className="text-[#9090A0] text-sm">%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm">止盈</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, takeProfitEnabled: !tvConfig.takeProfitEnabled })}
                      title={tvConfig.takeProfitEnabled ? "关闭止盈" : "开启止盈"}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative",
                        tvConfig.takeProfitEnabled ? "bg-cyan-500" : "bg-[#2A2A3A]"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        tvConfig.takeProfitEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                    {tvConfig.takeProfitEnabled && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={tvConfig.takeProfitPercent}
                          onChange={(e) => setTvConfig({ ...tvConfig, takeProfitPercent: Number(e.target.value) })}
                          className="w-16 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                        />
                        <span className="text-[#9090A0] text-sm">%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm">移动止损</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTvConfig({ ...tvConfig, trailingStopEnabled: !tvConfig.trailingStopEnabled })}
                      title={tvConfig.trailingStopEnabled ? "关闭移动止损" : "开启移动止损"}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative",
                        tvConfig.trailingStopEnabled ? "bg-cyan-500" : "bg-[#2A2A3A]"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        tvConfig.trailingStopEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                    {tvConfig.trailingStopEnabled && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={tvConfig.trailingStopPercent}
                          onChange={(e) => setTvConfig({ ...tvConfig, trailingStopPercent: Number(e.target.value) })}
                          className="w-16 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                        />
                        <span className="text-[#9090A0] text-sm">%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 高级设置 */}
              <button
                type="button"
                onClick={() => setShowTvAdvanced(!showTvAdvanced)}
                className="flex items-center justify-between w-full p-3 bg-[#0A0A0F] rounded-lg text-[#9090A0] hover:text-[#F8F8FC]"
              >
                <span className="text-sm">高级风控设置</span>
                {showTvAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTvAdvanced && (
                <div className="mt-3 p-4 bg-[#0A0A0F] rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm">每日最大亏损</span>
                      <p className="text-xs text-[#606070]">达到后暂停交易</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[#9090A0] text-sm">$</span>
                      <Input
                        type="number"
                        value={tvConfig.maxDailyLoss}
                        onChange={(e) => setTvConfig({ ...tvConfig, maxDailyLoss: Number(e.target.value) })}
                        className="w-20 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm">每日最大交易次数</span>
                      <p className="text-xs text-[#606070]">防止过度交易</p>
                    </div>
                    <Input
                      type="number"
                      value={tvConfig.maxDailyTrades}
                      onChange={(e) => setTvConfig({ ...tvConfig, maxDailyTrades: Number(e.target.value) })}
                      className="w-20 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 保存按钮 */}
            <Button
              onClick={() => handleSave({ type: 'tradingview', config: tvConfig })}
              disabled={isSaving}
              className="w-full bg-[#06B6D4] hover:bg-[#0891B2] py-6 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Settings className="w-5 h-5 mr-2" />
              )}
              {isSaving ? '保存中...' : '保存 TradingView 配置'}
            </Button>
          </div>
        )}

        {activeTab === 'visual' && (
          <div className="space-y-4">
            {/* 交易所和交易对选择 */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold">选择交易所和交易对</h3>
                  <p className="text-xs text-[#606070]">策略将在选定的交易所执行</p>
                </div>
              </div>

              {/* 交易所选择 */}
              <div className="mb-4">
                <label className="block text-sm text-[#9090A0] mb-2">交易所</label>
                <select
                  value={visualConfig.selectedExchange}
                  onChange={(e) => setVisualConfig({ ...visualConfig, selectedExchange: e.target.value })}
                  title="选择交易所"
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-4 py-3 text-[#F8F8FC]"
                >
                  <option value="binance">Binance 币安</option>
                  <option value="okx">OKX</option>
                  <option value="bybit">Bybit</option>
                  <option value="gate">Gate.io</option>
                  <option value="bitget">Bitget</option>
                </select>
              </div>

              {/* 交易对选择 */}
              <div>
                <label className="block text-sm text-[#9090A0] mb-2">交易对</label>
                <div className="flex flex-wrap gap-2">
                  {['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'AVAX', 'MATIC'].map((coin) => (
                    <button
                      key={coin}
                      type="button"
                      onClick={() => {
                        const newCoins = visualConfig.selectedCoins.includes(coin)
                          ? visualConfig.selectedCoins.filter(c => c !== coin)
                          : [...visualConfig.selectedCoins, coin]
                        setVisualConfig({ ...visualConfig, selectedCoins: newCoins })
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
                        visualConfig.selectedCoins.includes(coin)
                          ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400"
                          : "bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]"
                      )}
                    >
                      {visualConfig.selectedCoins.includes(coin) && '✓ '}{coin}/USDT
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 条件区块 - When */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
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
                      {/* 条件类型 */}
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

                      {/* 指标选择 */}
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

                      {/* 操作符 */}
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

                      {/* 数值 */}
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

                    {/* 删除条件 */}
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

              {/* 添加条件 */}
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
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold">执行以下操作</h3>
                  <p className="text-xs text-[#606070]">条件满足时自动执行</p>
                </div>
              </div>

              {/* 动作列表 */}
              <div className="space-y-3">
                {visualActions.map((action, index) => (
                  <div key={action.id} className="flex items-center gap-3 p-4 bg-[#0A0A0F] rounded-xl border border-[#1E1E2E]">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* 动作类型 */}
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

                      {/* 金额 */}
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

                    {/* 删除动作 */}
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

              {/* 添加动作 */}
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

            {/* 风控参数配置 */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold">风控参数配置</h3>
                  <p className="text-xs text-[#606070]">设置止损止盈和风险控制</p>
                </div>
              </div>

              {/* 基础参数 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="visual-amount" className="block text-sm text-[#9090A0] mb-2">每笔金额 (USDT)</label>
                  <Input
                    id="visual-amount"
                    type="number"
                    value={visualConfig.amountPerTrade}
                    onChange={(e) => setVisualConfig({ ...visualConfig, amountPerTrade: Number(e.target.value) })}
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>
                <div>
                  <label htmlFor="visual-max-positions" className="block text-sm text-[#9090A0] mb-2">最大持仓数</label>
                  <Input
                    id="visual-max-positions"
                    type="number"
                    value={visualConfig.maxPositions}
                    onChange={(e) => setVisualConfig({ ...visualConfig, maxPositions: Number(e.target.value) })}
                    className="bg-[#0A0A0F] border-[#2A2A3A]"
                  />
                </div>
              </div>

              {/* 杠杆设置 */}
              <div className="mb-4">
                <label className="block text-sm text-[#9090A0] mb-2">杠杆倍数</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 5, 10, 20].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setVisualConfig({ ...visualConfig, leverage: lev })}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm transition-all flex-1",
                        visualConfig.leverage === lev
                          ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400"
                          : "bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]"
                      )}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* 止损止盈 */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="text-sm">止损</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisualConfig({ ...visualConfig, stopLossEnabled: !visualConfig.stopLossEnabled })}
                      title={visualConfig.stopLossEnabled ? "关闭止损" : "开启止损"}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative",
                        visualConfig.stopLossEnabled ? "bg-cyan-500" : "bg-[#2A2A3A]"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        visualConfig.stopLossEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                    {visualConfig.stopLossEnabled && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={visualConfig.stopLossPercent}
                          onChange={(e) => setVisualConfig({ ...visualConfig, stopLossPercent: Number(e.target.value) })}
                          className="w-16 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                        />
                        <span className="text-[#9090A0] text-sm">%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm">止盈</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisualConfig({ ...visualConfig, takeProfitEnabled: !visualConfig.takeProfitEnabled })}
                      title={visualConfig.takeProfitEnabled ? "关闭止盈" : "开启止盈"}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative",
                        visualConfig.takeProfitEnabled ? "bg-cyan-500" : "bg-[#2A2A3A]"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        visualConfig.takeProfitEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                    {visualConfig.takeProfitEnabled && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={visualConfig.takeProfitPercent}
                          onChange={(e) => setVisualConfig({ ...visualConfig, takeProfitPercent: Number(e.target.value) })}
                          className="w-16 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                        />
                        <span className="text-[#9090A0] text-sm">%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 高级设置 */}
              <button
                type="button"
                onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
                className="flex items-center justify-between w-full p-3 bg-[#0A0A0F] rounded-lg text-[#9090A0] hover:text-[#F8F8FC]"
              >
                <span className="text-sm">高级风控设置</span>
                {showVisualAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showVisualAdvanced && (
                <div className="mt-3 p-4 bg-[#0A0A0F] rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm">每日最大亏损</span>
                      <p className="text-xs text-[#606070]">达到后暂停交易</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[#9090A0] text-sm">$</span>
                      <Input
                        type="number"
                        value={visualConfig.maxDailyLoss}
                        onChange={(e) => setVisualConfig({ ...visualConfig, maxDailyLoss: Number(e.target.value) })}
                        className="w-20 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm">每日最大交易次数</span>
                      <p className="text-xs text-[#606070]">防止过度交易</p>
                    </div>
                    <Input
                      type="number"
                      value={visualConfig.maxDailyTrades}
                      onChange={(e) => setVisualConfig({ ...visualConfig, maxDailyTrades: Number(e.target.value) })}
                      className="w-20 bg-[#12121A] border-[#2A2A3A] text-center text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 策略预览 */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
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

            {/* 保存按钮 */}
            <Button
              onClick={() => handleSave({ type: 'visual', conditions: visualConditions, actions: visualActions, logic: visualLogic, config: visualConfig })}
              disabled={isSaving}
              className="w-full bg-[#06B6D4] hover:bg-[#0891B2] py-6 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Settings className="w-5 h-5 mr-2" />
              )}
              {isSaving ? '保存中...' : '保存可视化策略'}
            </Button>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="space-y-4">
            {/* 策略基本信息 */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">策略配置</h3>

              {/* 策略名称 */}
              <div className="mb-4">
                <label htmlFor="code-strategy-name" className="block text-sm text-[#9090A0] mb-2">策略名称</label>
                <Input
                  id="code-strategy-name"
                  type="text"
                  value={codeConfig.strategyName}
                  onChange={(e) => setCodeConfig({ ...codeConfig, strategyName: e.target.value })}
                  placeholder="我的自定义策略"
                  className="bg-[#0A0A0F] border-[#2A2A3A]"
                />
              </div>

              {/* 交易所选择 */}
              <div className="mb-4">
                <label className="block text-sm text-[#9090A0] mb-2">交易所</label>
                <select
                  value={codeConfig.selectedExchange}
                  onChange={(e) => setCodeConfig({ ...codeConfig, selectedExchange: e.target.value })}
                  title="选择交易所"
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-4 py-3 text-[#F8F8FC]"
                >
                  <option value="binance">Binance 币安</option>
                  <option value="okx">OKX</option>
                  <option value="bybit">Bybit</option>
                  <option value="gate">Gate.io</option>
                  <option value="bitget">Bitget</option>
                </select>
              </div>

              {/* 交易对选择 */}
              <div>
                <label className="block text-sm text-[#9090A0] mb-2">交易对</label>
                <div className="flex flex-wrap gap-2">
                  {['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'AVAX', 'MATIC'].map((coin) => (
                    <button
                      key={coin}
                      type="button"
                      onClick={() => {
                        const newCoins = codeConfig.selectedCoins.includes(coin)
                          ? codeConfig.selectedCoins.filter(c => c !== coin)
                          : [...codeConfig.selectedCoins, coin]
                        setCodeConfig({ ...codeConfig, selectedCoins: newCoins })
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all",
                        codeConfig.selectedCoins.includes(coin)
                          ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400"
                          : "bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0]"
                      )}
                    >
                      {codeConfig.selectedCoins.includes(coin) && '✓ '}{coin}/USDT
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 代码编辑器 */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
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

              {/* 代码编辑区域 */}
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
                  value={codeConfig.code}
                  onChange={(e) => setCodeConfig({ ...codeConfig, code: e.target.value })}
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
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">快速模板</h3>
              <div className="grid gap-3">
                {[
                  { name: '均值回归策略', desc: '基于价格偏离均值的反转策略', code: `# 均值回归策略
class MeanReversionStrategy(BaseStrategy):
    def __init__(self):
        self.ma_period = 20
        self.threshold = 2.0  # 标准差倍数

    def on_tick(self, data):
        ma = self.calculate_ma(data, self.ma_period)
        std = self.calculate_std(data, self.ma_period)
        price = data['close']

        if price < ma - std * self.threshold:
            self.buy(size=0.1)
        elif price > ma + std * self.threshold:
            self.sell(size=0.1)` },
                  { name: '动量策略', desc: '追踪价格动量的趋势策略', code: `# 动量策略
class MomentumStrategy(BaseStrategy):
    def __init__(self):
        self.fast_period = 12
        self.slow_period = 26

    def on_tick(self, data):
        fast_ma = self.calculate_ema(data, self.fast_period)
        slow_ma = self.calculate_ema(data, self.slow_period)

        if fast_ma > slow_ma:
            self.buy(size=0.1)
        elif fast_ma < slow_ma:
            self.sell(size=0.1)` },
                  { name: '网格策略', desc: '自动在网格区间内高抛低吸', code: `# 网格策略
class GridStrategy(BaseStrategy):
    def __init__(self):
        self.grid_upper = 50000  # 网格上限
        self.grid_lower = 40000  # 网格下限
        self.grid_count = 10    # 网格数量

    def on_tick(self, data):
        price = data['close']
        grid_size = (self.grid_upper - self.grid_lower) / self.grid_count

        for i in range(self.grid_count):
            level = self.grid_lower + i * grid_size
            if abs(price - level) < grid_size * 0.1:
                if price < level:
                    self.buy(size=0.01)
                else:
                    self.sell(size=0.01)` }
                ].map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => setCodeConfig({ ...codeConfig, code: template.code })}
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

            {/* 保存按钮 */}
            <Button
              onClick={() => handleSave({ type: 'code', config: codeConfig })}
              disabled={isSaving}
              className="w-full bg-[#06B6D4] hover:bg-[#0891B2] py-6 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Settings className="w-5 h-5 mr-2" />
              )}
              {isSaving ? '保存中...' : '保存代码策略'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
