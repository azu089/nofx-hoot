'use client'

import { useState } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RefreshCcw,
  ChevronDown,
  BarChart3,
  Wallet,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Play,
  Pause,
  AlertCircle,
  Calendar,
  Settings,
  Trash2,
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ============ Types ============
type MarketType = 'spot' | 'futures'

interface Position {
  id: number
  symbol: string
  direction: 'long' | 'short'
  size: number
  entryPrice: number
  markPrice: number
  liquidationPrice: number
  unrealizedPnl: number
  roe: number
  icon: string
  strategy: string
  stopLoss: number
  takeProfit: number
  marketType: MarketType
}

interface ExecutionLog {
  id: number
  time: string
  strategy: string
  action: string
  symbol: string
  status: 'success' | 'warning' | 'error'
  message: string
  marketType: MarketType
}

interface ActiveStrategy {
  id: number
  name: string
  status: 'running' | 'paused'
  positions: number
  todayPnl: number
}

interface MyStrategy {
  id: string
  name: string
  description: string
  status: 'running' | 'paused' | 'stopped'
  type: 'system' | 'external' | 'visual' | 'code'
  marketType: MarketType
  exchange: string
  tradingPairs: string[]
  createdAt: string
  lastModified: string
  config: {
    leverage: number
    positionSize: string
    stopLoss: number
    takeProfit: number
  }
}

interface Account {
  id: number
  name: string
  balance: number
}

// ============ Mock Data ============
const mockPositions: Position[] = [
  {
    id: 1,
    symbol: 'BTC-USDT',
    direction: 'long',
    size: 0.5,
    entryPrice: 43250.00,
    markPrice: 43720.50,
    liquidationPrice: 38500.00,
    unrealizedPnl: 1234.56,
    roe: 5.68,
    icon: '₿',
    strategy: 'RSI 智能抄底',
    stopLoss: 41087.50,
    takeProfit: 47575.00,
    marketType: 'futures'
  },
  {
    id: 2,
    symbol: 'ETH-USDT',
    direction: 'short',
    size: 10.2,
    entryPrice: 2650.00,
    markPrice: 2673.20,
    liquidationPrice: 3200.00,
    unrealizedPnl: -234.56,
    roe: -0.87,
    icon: 'Ξ',
    strategy: 'MACD 趋势跟踪',
    stopLoss: 2782.50,
    takeProfit: 2385.00,
    marketType: 'futures'
  },
  {
    id: 3,
    symbol: 'SOL-USDT',
    direction: 'long',
    size: 45.8,
    entryPrice: 98.50,
    markPrice: 100.45,
    liquidationPrice: 85.20,
    unrealizedPnl: 89.12,
    roe: 1.98,
    icon: '◎',
    strategy: 'RSI 智能抄底',
    stopLoss: 93.58,
    takeProfit: 108.35,
    marketType: 'futures'
  },
  {
    id: 4,
    symbol: 'BTC-USDT',
    direction: 'long',
    size: 0.2,
    entryPrice: 42800.00,
    markPrice: 43720.50,
    liquidationPrice: 0,
    unrealizedPnl: 184.10,
    roe: 2.15,
    icon: '₿',
    strategy: 'BTC 定投策略',
    stopLoss: 0,
    takeProfit: 0,
    marketType: 'spot'
  },
  {
    id: 5,
    symbol: 'ETH-USDT',
    direction: 'long',
    size: 5.5,
    entryPrice: 2580.00,
    markPrice: 2673.20,
    liquidationPrice: 0,
    unrealizedPnl: 512.60,
    roe: 6.57,
    icon: 'Ξ',
    strategy: 'ETH 定投策略',
    stopLoss: 0,
    takeProfit: 0,
    marketType: 'spot'
  }
]

const mockExecutionLogs: ExecutionLog[] = [
  { id: 1, time: '2分钟前', strategy: 'RSI 智能抄底', action: '开多', symbol: 'BTC-USDT', status: 'success', message: '信号触发，已开仓 0.5 BTC', marketType: 'futures' },
  { id: 2, time: '15分钟前', strategy: 'MACD 趋势跟踪', action: '开空', symbol: 'ETH-USDT', status: 'success', message: '信号触发，已开仓 10.2 ETH', marketType: 'futures' },
  { id: 3, time: '1小时前', strategy: 'RSI 智能抄底', action: '止盈', symbol: 'DOGE-USDT', status: 'success', message: '止盈触发，盈利 +$156.78', marketType: 'futures' },
  { id: 4, time: '2小时前', strategy: 'BTC 网格策略', action: '跳过', symbol: 'BTC-USDT', status: 'warning', message: '信号触发但余额不足，已跳过', marketType: 'futures' },
  { id: 5, time: '3小时前', strategy: 'BTC 定投策略', action: '买入', symbol: 'BTC-USDT', status: 'success', message: '定投执行，已买入 0.05 BTC', marketType: 'spot' },
  { id: 6, time: '5小时前', strategy: 'ETH 定投策略', action: '买入', symbol: 'ETH-USDT', status: 'success', message: '定投执行，已买入 1.2 ETH', marketType: 'spot' }
]

// 预留数据：活跃策略列表
const _mockActiveStrategies: ActiveStrategy[] = [
  { id: 1, name: 'RSI 智能抄底', status: 'running', positions: 2, todayPnl: 1323.68 },
  { id: 2, name: 'MACD 趋势跟踪', status: 'running', positions: 1, todayPnl: -234.56 },
  { id: 3, name: 'BTC 网格策略', status: 'paused', positions: 0, todayPnl: 0 }
]
void _mockActiveStrategies

const mockMyStrategies: MyStrategy[] = [
  {
    id: '1',
    name: 'RSI 智能抄底',
    description: '基于 RSI 超卖信号的智能抄底策略',
    status: 'running',
    type: 'system',
    marketType: 'futures',
    exchange: 'Binance',
    tradingPairs: ['BTC/USDT', 'ETH/USDT'],
    createdAt: '2025-12-15',
    lastModified: '2026-01-25',
    config: { leverage: 3, positionSize: '10%', stopLoss: 5, takeProfit: 10 }
  },
  {
    id: '2',
    name: 'MACD 趋势跟踪',
    description: '跟踪 MACD 金叉死叉信号的趋势策略',
    status: 'paused',
    type: 'external',
    marketType: 'futures',
    exchange: 'OKX',
    tradingPairs: ['SOL/USDT'],
    createdAt: '2025-11-20',
    lastModified: '2026-01-20',
    config: { leverage: 2, positionSize: '5%', stopLoss: 3, takeProfit: 8 }
  },
  {
    id: '3',
    name: 'BTC 网格策略',
    description: '在震荡区间内自动高抛低吸',
    status: 'running',
    type: 'visual',
    marketType: 'futures',
    exchange: 'Binance',
    tradingPairs: ['BTC/USDT'],
    createdAt: '2025-10-01',
    lastModified: '2026-01-28',
    config: { leverage: 1, positionSize: '20%', stopLoss: 10, takeProfit: 15 }
  },
  {
    id: '4',
    name: 'BTC 定投策略',
    description: '每日定时定额买入 BTC',
    status: 'running',
    type: 'system',
    marketType: 'spot',
    exchange: 'Binance',
    tradingPairs: ['BTC/USDT'],
    createdAt: '2025-09-01',
    lastModified: '2026-01-29',
    config: { leverage: 1, positionSize: '5%', stopLoss: 0, takeProfit: 0 }
  },
  {
    id: '5',
    name: 'ETH 定投策略',
    description: '每周定时定额买入 ETH',
    status: 'running',
    type: 'system',
    marketType: 'spot',
    exchange: 'Binance',
    tradingPairs: ['ETH/USDT'],
    createdAt: '2025-08-15',
    lastModified: '2026-01-28',
    config: { leverage: 1, positionSize: '3%', stopLoss: 0, takeProfit: 0 }
  }
]

const mockAccounts: Account[] = [
  { id: 1, name: 'Binance 主账户', balance: 125430.50 },
  { id: 2, name: 'OKX 交易账户', balance: 89234.20 },
  { id: 3, name: 'Bybit 合约账户', balance: 45678.90 }
]

const strategyTypeLabels: Record<string, { label: string; color: string }> = {
  system: { label: '系统策略', color: 'bg-cyan-400/10 text-cyan-400' },
  external: { label: '外部接入', color: 'bg-purple-400/10 text-purple-400' },
  visual: { label: '可视化', color: 'bg-blue-400/10 text-blue-400' },
  code: { label: '代码', color: 'bg-orange-400/10 text-orange-400' }
}

// ============ Props ============
interface PositionsPageV3Props {
  onClosePosition?: (positionId: number) => void
  onPauseStrategy?: (strategyId: number) => void
  onResumeStrategy?: (strategyId: number) => void
  onEmergencyCloseAll?: () => void
  onEditStrategy?: (strategyId: string) => void
  onDeleteStrategy?: (strategyId: string) => void
  onToggleStrategy?: (strategyId: string, status: 'running' | 'paused') => void
  onViewMarket?: () => void
}

// ============ Component ============
export function PositionsPageV3({
  onClosePosition,
  onPauseStrategy: _onPauseStrategy,
  onResumeStrategy: _onResumeStrategy,
  onEmergencyCloseAll,
  onEditStrategy,
  onDeleteStrategy,
  onToggleStrategy,
  onViewMarket
}: PositionsPageV3Props) {
  void _onPauseStrategy
  void _onResumeStrategy
  const [activeTab, setActiveTab] = useState('positions')
  const [selectedAccount, setSelectedAccount] = useState(mockAccounts[0])
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [accountType, setAccountType] = useState<'all' | 'spot' | 'futures'>('all')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-01-29' })
  const [strategySearchQuery, setStrategySearchQuery] = useState('')
  const [strategyStatusFilter, setStrategyStatusFilter] = useState<'all' | 'running' | 'paused'>('all')

  // ========== 数据过滤（基于 accountType） ==========
  // 持仓过滤
  const filteredPositions = accountType === 'all'
    ? mockPositions
    : mockPositions.filter(pos => pos.marketType === accountType)

  // 执行日志过滤
  const filteredLogs = accountType === 'all'
    ? mockExecutionLogs
    : mockExecutionLogs.filter(log => log.marketType === accountType)

  // 策略过滤（同时考虑 accountType 和搜索/状态筛选）
  const filteredStrategies = mockMyStrategies.filter(strategy => {
    const matchesMarketType = accountType === 'all' || strategy.marketType === accountType
    const matchesSearch = strategy.name.toLowerCase().includes(strategySearchQuery.toLowerCase())
    const matchesStatus = strategyStatusFilter === 'all' || strategy.status === strategyStatusFilter
    return matchesMarketType && matchesSearch && matchesStatus
  })

  // 获取当前筛选的策略（用于计数，不考虑搜索和状态筛选）
  const strategiesForCount = accountType === 'all'
    ? mockMyStrategies
    : mockMyStrategies.filter(s => s.marketType === accountType)

  const runningCount = strategiesForCount.filter(s => s.status === 'running').length
  const pausedCount = strategiesForCount.filter(s => s.status === 'paused').length

  // ========== 统计数据计算 ==========
  // 总资产（不受筛选影响）
  const totalAssets = 125847.32

  // 以下数据受筛选影响
  const availableBalance = accountType === 'all' ? 15420.50
    : accountType === 'spot' ? 8500.00 : 6920.50

  const totalUnrealizedPnl = filteredPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0)

  const totalPnl = accountType === 'all' ? 8945.67
    : accountType === 'spot' ? 2156.78 : 6788.89

  const todayPnl = accountType === 'all' ? 1523.45
    : accountType === 'spot' ? 456.12 : 1067.33

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[#F8F8FC]">交易</h1>
        </div>

        {/* Controls Row - Filters and Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* 全部/现货/合约切换 */}
            <div className="flex bg-[#12121A]/50 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg p-1 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
              {(['all', 'spot', 'futures'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    accountType === type
                      ? 'bg-[#06B6D4] text-white'
                      : 'text-[#9090A0] hover:text-[#F8F8FC]'
                  }`}
                >
                  {type === 'all' ? '全部' : type === 'spot' ? '现货' : '合约'}
                </button>
              ))}
            </div>

            {/* Account Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-[#12121A]/50 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg hover:border-cyan-500/15 transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
              >
                <Wallet className="w-4 h-4 text-[#06B6D4]" />
                <span className="text-sm text-[#F8F8FC]">{selectedAccount.name}</span>
                <ChevronDown className="w-4 h-4 text-[#9090A0]" />
              </button>

              {showAccountDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#12121A]/80 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                  {mockAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccount(account)
                        setShowAccountDropdown(false)
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-[#1E1E2E]/50 transition-colors"
                    >
                      <div className="text-sm text-[#F8F8FC]">{account.name}</div>
                      <div className="text-xs text-[#9090A0]">${account.balance.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-3 py-2 bg-[#12121A]/50 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg hover:border-cyan-500/15 transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
            >
              <Calendar className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-sm text-[#F8F8FC]">{dateRange.start} ~ {dateRange.end}</span>
              <ChevronDown className="w-4 h-4 text-[#9090A0]" />
            </button>

            {showDatePicker && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-[#12121A]/80 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 p-4">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="date-start" className="text-xs text-[#9090A0] mb-1 block">开始日期</label>
                    <input
                      id="date-start"
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      title="选择开始日期"
                      className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="date-end" className="text-xs text-[#9090A0] mb-1 block">结束日期</label>
                    <input
                      id="date-end"
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      title="选择结束日期"
                      className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    {['本周', '本月', '近3月'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const today = new Date()
                          let start = new Date()
                          if (preset === '本周') {
                            start.setDate(today.getDate() - today.getDay())
                          } else if (preset === '本月') {
                            start = new Date(today.getFullYear(), today.getMonth(), 1)
                          } else {
                            start.setMonth(today.getMonth() - 3)
                          }
                          setDateRange({
                            start: start.toISOString().split('T')[0],
                            end: today.toISOString().split('T')[0]
                          })
                        }}
                        className="flex-1 px-3 py-1.5 text-xs bg-[#1E1E2E] text-[#9090A0] rounded hover:bg-[#2A2A3A] hover:text-[#F8F8FC] transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className="w-full py-2 bg-[#06B6D4] text-white rounded-lg text-sm font-medium hover:bg-[#0891B2] transition-colors"
                  >
                    确认
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row - 超清悬浮玻璃卡片 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {/* 总资产 */}
            <div>
              <div className="text-xs text-[#606070] mb-0.5">总资产</div>
              <div className="text-2xl font-bold text-[#F8F8FC]">${totalAssets.toLocaleString()}</div>
            </div>

            {/* 可用余额 */}
            <div>
              <div className="text-xs text-[#606070] mb-0.5">可用余额</div>
              <div className="text-2xl font-bold text-[#F8F8FC]">${availableBalance.toLocaleString()}</div>
            </div>

            {/* 未实现盈亏 */}
            <div>
              <div className="text-xs text-[#606070] mb-0.5">未实现盈亏</div>
              <div className={`text-2xl font-bold ${totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
              </div>
            </div>

            {/* 总盈亏 */}
            <div>
              <div className="text-xs text-[#606070] mb-0.5">总盈亏</div>
              <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
              </div>
            </div>

            {/* 今日盈亏 */}
            <div>
              <div className="text-xs text-[#606070] mb-0.5">今日盈亏</div>
              <div className={`text-2xl font-bold ${todayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {todayPnl >= 0 ? '+' : ''}${todayPnl.toLocaleString()}
              </div>
            </div>

            {/* 紧急平仓 - 右侧 */}
            <div className="ml-auto">
              <button
                type="button"
                onClick={onEmergencyCloseAll}
                className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                紧急平仓
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">

            {/* Tab Navigation - 超清悬浮玻璃质感 */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              {/* 顶部高光 */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent pointer-events-none z-[1]" />
              {/* 内发光效果 - 青色渐变 */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-cyan-400/[0.04] via-transparent to-transparent pointer-events-none z-[1]" />
              <div className="relative z-[2] flex border-b border-[#1E1E2E] overflow-x-auto">
                {[
                  { id: 'positions', label: '当前持仓', count: filteredPositions.length, icon: BarChart3 },
                  { id: 'history', label: '历史订单', count: null, icon: RefreshCcw },
                  { id: 'orders', label: '挂单', count: accountType === 'all' ? 3 : accountType === 'futures' ? 2 : 1, icon: Clock },
                  { id: 'logs', label: '执行日志', count: filteredLogs.length, icon: Activity },
                  { id: 'strategies', label: '策略管理', count: strategiesForCount.length, icon: Zap }
                ].map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-6 py-4 text-sm font-medium transition-colors relative flex items-center gap-2 whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-[2px]'
                          : 'text-[#9090A0] hover:text-[#F8F8FC]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      {tab.count !== null && (
                        <span className="px-2 py-0.5 text-xs bg-[#1E1E2E] rounded-full">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Current Positions Tab */}
              {activeTab === 'positions' && (
                <div className="relative z-[2] p-6">
                  {filteredPositions.length === 0 ? (
                    <div className="text-center py-12">
                      <BarChart3 className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">暂无持仓</h3>
                      <p className="text-[#9090A0]">
                        {accountType === 'all' ? '当前没有持仓' : `当前没有${accountType === 'spot' ? '现货' : '合约'}持仓`}
                      </p>
                    </div>
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-[#9090A0] border-b border-[#1E1E2E]">
                          <th className="pb-3 font-medium">交易对</th>
                          <th className="pb-3 font-medium">策略</th>
                          <th className="pb-3 font-medium">方向</th>
                          <th className="pb-3 font-medium">数量</th>
                          <th className="pb-3 font-medium">入场价</th>
                          <th className="pb-3 font-medium">标记价</th>
                          <th className="pb-3 font-medium">止损/止盈</th>
                          <th className="pb-3 font-medium">未实现盈亏</th>
                          <th className="pb-3 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPositions.map((position) => (
                          <tr key={position.id} className="border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/20 transition-colors">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400 font-bold">
                                  {position.icon}
                                </div>
                                <span className="font-medium text-[#F8F8FC]">{position.symbol}</span>
                              </div>
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                <Zap className="w-3 h-3 text-cyan-400" />
                                <span className="text-sm text-[#9090A0]">{position.strategy}</span>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                                position.direction === 'long'
                                  ? 'bg-green-400/10 text-green-400 border border-green-400/20'
                                  : 'bg-red-400/10 text-red-400 border border-red-400/20'
                              }`}>
                                {position.direction === 'long' ? '做多' : '做空'}
                                {position.direction === 'long' ? (
                                  <ArrowUpRight className="w-3 h-3" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3" />
                                )}
                              </span>
                            </td>
                            <td className="py-4 text-[#F8F8FC]">{position.size}</td>
                            <td className="py-4 text-[#F8F8FC]">${position.entryPrice.toLocaleString()}</td>
                            <td className="py-4 text-[#F8F8FC]">${position.markPrice.toLocaleString()}</td>
                            <td className="py-4">
                              <div className="text-xs">
                                <div className="text-red-400">${position.stopLoss.toLocaleString()}</div>
                                <div className="text-green-400">${position.takeProfit.toLocaleString()}</div>
                              </div>
                            </td>
                            <td className="py-4">
                              <div>
                                <span className={`font-medium ${
                                  position.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                                </span>
                                <div className={`text-xs ${
                                  position.roe >= 0 ? 'text-green-400/70' : 'text-red-400/70'
                                }`}>
                                  {position.roe >= 0 ? '+' : ''}{position.roe.toFixed(2)}%
                                </div>
                              </div>
                            </td>
                            <td className="py-4">
                              <button
                                type="button"
                                onClick={() => onClosePosition?.(position.id)}
                                className="px-3 py-1.5 bg-red-400/10 text-red-400 rounded-lg hover:bg-red-400/20 transition-colors text-sm"
                              >
                                平仓
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div className="relative z-[2] p-12 text-center text-[#9090A0]">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无挂单</p>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="p-12 text-center text-[#9090A0]">
                  <RefreshCcw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无历史订单</p>
                </div>
              )}

              {/* Strategies Tab - 原"我的策略"内容 */}
              {activeTab === 'strategies' && (
                <div className="p-6">
                  {/* Strategy Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      {/* Stats */}
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-[#9090A0]">共 <span className="text-[#F8F8FC] font-semibold">{strategiesForCount.length}</span> 个策略</span>
                        <span className="text-[#2A2A3A]">|</span>
                        <span className="text-green-400">{runningCount} 运行中</span>
                        <span className="text-[#2A2A3A]">|</span>
                        <span className="text-yellow-400">{pausedCount} 已暂停</span>
                      </div>
                    </div>
                  </div>

                  {/* Search & Filter */}
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
                      <input
                        type="text"
                        value={strategySearchQuery}
                        onChange={(e) => setStrategySearchQuery(e.target.value)}
                        placeholder="搜索策略..."
                        className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl pl-10 pr-4 py-2.5 text-[#F8F8FC] placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      {(['all', 'running', 'paused'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setStrategyStatusFilter(status)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                            strategyStatusFilter === status
                              ? "bg-[#06B6D4] text-white"
                              : "bg-[#0A0A0F] border border-[#1E1E2E] text-[#9090A0] hover:text-[#F8F8FC]"
                          )}
                        >
                          {status === 'all' ? '全部' : status === 'running' ? '运行中' : '已暂停'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Strategy List */}
                  {filteredStrategies.length === 0 ? (
                    <div className="text-center py-12">
                      <Zap className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">暂无策略</h3>
                      <p className="text-[#9090A0] mb-6">浏览策略并订阅，或创建自己的交易策略</p>
                      <div className="flex justify-center gap-3">
                        <Button
                          onClick={onViewMarket}
                          className="bg-[#06B6D4] hover:bg-[#0891B2] text-white"
                        >
                          浏览策略
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredStrategies.map((strategy) => (
                        <div
                          key={strategy.id}
                          className="bg-[#0A0A0F]/50 border border-[#1E1E2E] rounded-xl p-5 hover:border-[#2A2A3A] transition-colors"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            {/* Strategy Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className={cn(
                                  "w-3 h-3 rounded-full",
                                  strategy.status === 'running' ? "bg-green-400 animate-pulse" : "bg-yellow-400"
                                )} />
                                <h3 className="text-lg font-semibold">{strategy.name}</h3>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium",
                                  strategy.status === 'running'
                                    ? "bg-green-400/10 text-green-400"
                                    : "bg-yellow-400/10 text-yellow-400"
                                )}>
                                  {strategy.status === 'running' ? '运行中' : '已暂停'}
                                </span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium",
                                  strategyTypeLabels[strategy.type]?.color
                                )}>
                                  {strategyTypeLabels[strategy.type]?.label}
                                </span>
                              </div>
                              <p className="text-[#9090A0] text-sm mb-3">{strategy.description}</p>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-[#606070]">
                                <span>{strategy.exchange}</span>
                                <span>·</span>
                                <span>{strategy.tradingPairs.join(', ')}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  上次修改 {strategy.lastModified}
                                </span>
                              </div>
                            </div>

                            {/* Config Summary */}
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">杠杆:</span>
                                <span className="font-medium">{strategy.config.leverage}x</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">仓位:</span>
                                <span className="font-medium">{strategy.config.positionSize}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">止损:</span>
                                <span className="font-medium text-red-400">{strategy.config.stopLoss}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">止盈:</span>
                                <span className="font-medium text-green-400">{strategy.config.takeProfit}%</span>
                              </div>
                            </div>

                            {/* Actions - 暂停/启动在右边 */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEditStrategy?.(strategy.id)}
                                className="p-2.5 rounded-lg bg-[#1E1E2E] text-[#9090A0] hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                                title="编辑策略"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteStrategy?.(strategy.id)}
                                className="p-2.5 rounded-lg bg-[#1E1E2E] text-[#9090A0] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                title="删除策略"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onToggleStrategy?.(strategy.id, strategy.status === 'running' ? 'paused' : 'running')}
                                className={cn(
                                  "p-2.5 rounded-lg transition-colors",
                                  strategy.status === 'running'
                                    ? "bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20"
                                    : "bg-green-400/10 text-green-400 hover:bg-green-400/20"
                                )}
                                title={strategy.status === 'running' ? '暂停' : '启动'}
                              >
                                {strategy.status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Logs Tab - 执行日志 */}
              {activeTab === 'logs' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-[#06B6D4]" />
                      <span className="text-[#9090A0] text-sm">共 {filteredLogs.length} 条日志</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] hover:border-[#2A2A3A] transition-colors">
                        <div className={`p-2 rounded-full flex-shrink-0 ${
                          log.status === 'success' ? 'bg-green-400/10' :
                          log.status === 'warning' ? 'bg-yellow-400/10' :
                          'bg-red-400/10'
                        }`}>
                          {log.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : log.status === 'warning' ? (
                            <AlertCircle className="w-4 h-4 text-yellow-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-medium text-[#F8F8FC]">{log.strategy}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              log.action === '开多' ? 'bg-green-400/10 text-green-400' :
                              log.action === '开空' ? 'bg-red-400/10 text-red-400' :
                              log.action === '止盈' ? 'bg-cyan-400/10 text-cyan-400' :
                              'bg-yellow-400/10 text-yellow-400'
                            }`}>
                              {log.action}
                            </span>
                            <span className="text-xs text-[#606070]">{log.symbol}</span>
                          </div>
                          <p className="text-sm text-[#9090A0] mb-2">{log.message}</p>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-[#606070]" />
                            <span className="text-xs text-[#606070]">{log.time}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredLogs.length === 0 && (
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                      <p className="text-[#9090A0]">
                        {accountType === 'all' ? '暂无执行日志' : `暂无${accountType === 'spot' ? '现货' : '合约'}执行日志`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  )
}
