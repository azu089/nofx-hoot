'use client'

import { useState } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
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
  Search,
  FlaskConical,
  Users,
  Grid3x3,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/provider'
import { getActionBadgeStyle, getActionText, formatGridSummary } from '@/lib/execution-log-format'

// ============ Types ============
type MarketType = 'spot' | 'futures'

interface Position {
  id: string | number
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
  source?: string // ai_strategy, ai_research, ai_analysis, strategy, manual
  stopLoss: number
  takeProfit: number
  marketType: MarketType
  // 新增字段
  leverage?: number
  margin?: number
  marginMode?: string
  marginRatio?: string  // 交易所原始保证金比率（%字符串）
  syncSource?: 'exchange' | 'database'
}

interface ExecutionLog {
  id: string | number
  time: string
  strategy: string
  action: string
  symbol: string
  status: 'success' | 'warning' | 'error'
  message: string
  marketType: MarketType
  // 增强字段
  orderId?: string
  executedPrice?: string
  executedAmount?: string
  slippage?: string
  durationMs?: number
  errorCode?: string
  skipReason?: string
  // 执行参数
  leverage?: number
  stopLoss?: number
  takeProfit?: number
  blockedBy?: string
  blockReason?: string
  // AI 决策详情
  confidence?: number
  positionSizePercent?: number
  reasoning?: string
  votes?: Array<{ modelId: string; action: string; confidence: number; reasoning?: string }>
  // Grid 专属
  gridSummary?: string
  gridBuyRange?: string
  gridSellRange?: string
  gridOrderCount?: number
  // 策略类型标识
  strategyType?: 'research' | 'solo' | 'debate' | 'grid' | 'signal'
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
    amountPerTrade?: number
  }
}

interface Account {
  id: string | number
  name: string
  balance: number
}


// 策略类型颜色映射
const strategyTypeColors: Record<string, string> = {
  system: 'bg-cyan-400/10 text-cyan-400',
  external: 'bg-purple-400/10 text-purple-400',
  visual: 'bg-blue-400/10 text-blue-400',
  code: 'bg-orange-400/10 text-orange-400'
}

interface HistoryOrder {
  id: string | number
  symbol: string
  side: 'long' | 'short'
  type: string
  price: number
  entryPrice?: number
  closePrice?: number
  amount: number
  filled: number
  total: number
  pnl: number
  pnlPercent?: number
  fee: number
  time: string
  status: 'filled' | 'cancelled'
  marketType: MarketType
  leverage?: number
  margin?: number
  closeReason?: string
  strategyName?: string
  source?: string
}

interface PnlStatsProps {
  totalAssets: number
  availableBalance: number
  totalPnl: number
  todayPnl: number
  unrealizedPnl: number
}

interface StrategyHealthItem {
  strategyId: string
  strategyName: string
  isOnline: boolean
  lastSignalAt?: string
  minutesSinceLastSignal?: number
  todaySignals: number
  status: 'healthy' | 'degraded' | 'warning' | 'offline'
  message: string
}

// ============ Props ============
interface PositionsPageV3Props {
  positions?: Position[]
  historyOrders?: HistoryOrder[]
  executionLogs?: ExecutionLog[]
  myStrategies?: MyStrategy[]
  accounts?: Account[]
  strategyHealth?: StrategyHealthItem[]
  pnlStats?: PnlStatsProps
  isLoading?: boolean
  onClosePosition?: (positionId: number | string) => void
  onPauseStrategy?: (strategyId: number) => void
  onResumeStrategy?: (strategyId: number) => void
  onEmergencyCloseAll?: () => void
  onEditStrategy?: (strategyId: string) => void
  onDeleteStrategy?: (strategyId: string) => void
  onToggleStrategy?: (strategyId: string, status: 'running' | 'paused') => void
  onViewMarket?: () => void
  onCancelOrder?: (orderId: string) => void
}

// ============ Component ============
export function PositionsPageV3({
  positions = [],
  historyOrders = [],
  executionLogs = [],
  myStrategies = [],
  accounts = [],
  strategyHealth = [],
  pnlStats,
  isLoading = false,
  onClosePosition,
  onPauseStrategy: _onPauseStrategy,
  onResumeStrategy: _onResumeStrategy,
  onEmergencyCloseAll,
  onEditStrategy,
  onDeleteStrategy,
  onToggleStrategy,
  onViewMarket,
  onCancelOrder: _onCancelOrder
}: PositionsPageV3Props) {
  void _onPauseStrategy
  void _onResumeStrategy
  void _onCancelOrder
  const t = useTranslations('trading')
  const [activeTab, setActiveTab] = useState('positions')
  const [selectedAccount, setSelectedAccount] = useState(accounts[0] || { id: 0, name: '未绑定账户', balance: 0 })
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [accountType, setAccountType] = useState<'all' | 'spot' | 'futures'>('all')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-01-29' })
  const [strategySearchQuery, setStrategySearchQuery] = useState('')
  const [strategyStatusFilter, setStrategyStatusFilter] = useState<'all' | 'running' | 'paused'>('all')
  const [visibleLogCount, setVisibleLogCount] = useState(10)

  // ========== 数据过滤（基于 accountType） ==========
  // 持仓过滤
  const filteredPositions = accountType === 'all'
    ? positions
    : positions.filter(pos => pos.marketType === accountType)

  // 执行日志过滤
  const filteredLogs = accountType === 'all'
    ? executionLogs
    : executionLogs.filter(log => log.marketType === accountType)

  // 历史订单过滤
  const filteredHistoryOrders = accountType === 'all'
    ? historyOrders
    : historyOrders.filter(order => order.marketType === accountType)

  // 策略过滤（同时考虑 accountType 和搜索/状态筛选）
  const filteredStrategies = myStrategies.filter(strategy => {
    const matchesMarketType = accountType === 'all' || strategy.marketType === accountType
    const matchesSearch = strategy.name.toLowerCase().includes(strategySearchQuery.toLowerCase())
    const matchesStatus = strategyStatusFilter === 'all' || strategy.status === strategyStatusFilter
    return matchesMarketType && matchesSearch && matchesStatus
  })

  // 获取当前筛选的策略（用于计数，不考虑搜索和状态筛选）
  const strategiesForCount = accountType === 'all'
    ? myStrategies
    : myStrategies.filter(s => s.marketType === accountType)

  const runningCount = strategiesForCount.filter(s => s.status === 'running').length
  const pausedCount = strategiesForCount.filter(s => s.status === 'paused').length

  // ========== 统计数据计算（使用 props 传入的数据） ==========
  const totalAssets = pnlStats?.totalAssets ?? 0
  const availableBalance = pnlStats?.availableBalance ?? 0
  const totalPnl = pnlStats?.totalPnl ?? 0
  const todayPnl = pnlStats?.todayPnl ?? 0
  const totalUnrealizedPnl = pnlStats?.unrealizedPnl ?? filteredPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0)

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-[#F8F8FC]">{t('title')}</h1>
          </div>
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              <p className="text-[#9090A0] text-sm">{t('loading')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[#F8F8FC]">{t('title')}</h1>
        </div>

        {/* Strategy Health Panel */}
        {strategyHealth.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#12121A]/50 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            <span className="text-xs text-[#9090A0] mr-1">策略状态</span>
            {strategyHealth.map((sh) => (
              <div key={sh.strategyId || sh.strategyName} className="flex items-center gap-2 px-3 py-1.5 bg-[#0A0A0F]/50 rounded-lg border border-[#1E1E2E]">
                <div className={`w-2 h-2 rounded-full ${
                  sh.status === 'healthy' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' :
                  sh.status === 'degraded' ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]' :
                  sh.status === 'warning' ? 'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.5)]' :
                  'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'
                }`} />
                <span className="text-xs text-[#F8F8FC]">{sh.strategyName.replace('Strategy', '')}</span>
                <span className="text-xs text-[#606070]">
                  {sh.minutesSinceLastSignal != null
                    ? sh.minutesSinceLastSignal < 60
                      ? `${sh.minutesSinceLastSignal}分钟前`
                      : `${Math.floor(sh.minutesSinceLastSignal / 60)}小时前`
                    : '无数据'}
                </span>
                {sh.todaySignals > 0 && (
                  <span className="text-xs text-[#06B6D4]">今日 {sh.todaySignals}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Controls Row 1 - Account Selector + Type Filter (等宽) */}
        <div className="flex items-center gap-4">
          {/* Account Selector - flex-1 */}
          <div className="flex-1 relative">
            <button
              type="button"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#12121A]/50 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg hover:border-cyan-500/15 transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
            >
              <Wallet className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-sm text-[#F8F8FC]">{selectedAccount.name}</span>
              <ChevronDown className="w-4 h-4 text-[#9090A0]" />
            </button>

            {showAccountDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-[#12121A]/80 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                {accounts.length === 0 ? (
                  <div className="px-4 py-3 text-center text-sm text-[#9090A0]">
                    {t('noAccountsBound')}
                  </div>
                ) : accounts.map((account) => (
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

          {/* 全部/现货/合约切换 - flex-1 */}
          <div className="flex-1 flex bg-[#12121A]/50 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg p-1 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            {(['all', 'spot', 'futures'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  accountType === type
                    ? 'bg-[#06B6D4] text-white'
                    : 'text-[#9090A0] hover:text-[#F8F8FC]'
                }`}
              >
                {type === 'all' ? t('all') : type === 'spot' ? t('spot') : t('futures')}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row - 顺序：总资产 | 可用余额 | 今日盈亏 | 未实现 | 总盈亏 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden p-6">
          <div className="grid grid-cols-5 gap-4 text-center">
            {/* 总资产 */}
            <div className="py-2">
              <div className="text-sm text-[#606070] mb-1">{t('totalAssets')}</div>
              <div className="text-2xl font-bold text-[#F8F8FC]">${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            {/* 可用余额 */}
            <div className="py-2">
              <div className="text-sm text-[#606070] mb-1">{t('availableBalance')}</div>
              <div className="text-2xl font-bold text-[#F8F8FC]">${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            {/* 今日盈亏 */}
            <div className="py-2">
              <div className="text-sm text-[#606070] mb-1">{t('todayPnl')}</div>
              <div className={`text-2xl font-bold ${todayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {todayPnl >= 0 ? '+' : ''}${todayPnl.toLocaleString()}
              </div>
            </div>

            {/* 未实现 */}
            <div className="py-2">
              <div className="text-sm text-[#606070] mb-1">{t('unrealized')}</div>
              <div className={`text-2xl font-bold ${totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
              </div>
            </div>

            {/* 总盈亏 */}
            <div className="py-2">
              <div className="text-sm text-[#606070] mb-1">{t('totalPnl')}</div>
              <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Controls Row 2 - Date Picker + Emergency Close (等宽) */}
        <div className="flex items-center gap-4">
          {/* Date Picker - flex-1 */}
          <div className="flex-1 relative">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#12121A]/50 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg hover:border-cyan-500/15 transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
            >
              <Calendar className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-sm text-[#F8F8FC]">{dateRange.start} ~ {dateRange.end}</span>
              <ChevronDown className="w-4 h-4 text-[#9090A0]" />
            </button>

            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-[#12121A]/80 backdrop-blur-2xl border border-cyan-500/[0.06] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 p-4">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="date-start" className="text-xs text-[#9090A0] mb-1 block">{t('startDate')}</label>
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
                    <label htmlFor="date-end" className="text-xs text-[#9090A0] mb-1 block">{t('endDate')}</label>
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
                    {[{ key: 'thisWeek', label: t('thisWeek') }, { key: 'thisMonth', label: t('thisMonth') }, { key: 'last3Months', label: t('last3Months') }].map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => {
                          const today = new Date()
                          let start = new Date()
                          if (preset.key === 'thisWeek') {
                            start.setDate(today.getDate() - today.getDay())
                          } else if (preset.key === 'thisMonth') {
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
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className="w-full py-2 bg-[#06B6D4] text-white rounded-lg text-sm font-medium hover:bg-[#0891B2] transition-colors"
                  >
                    {t('confirm')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Emergency Close - flex-1 */}
          <button
            type="button"
            onClick={onEmergencyCloseAll}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            {t('emergencyCloseAll')}
          </button>
        </div>

        {/* Main Content */}
        <div className="space-y-6">

            {/* Tab Navigation - 超清悬浮玻璃质感 */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              {/* 顶部高光 */}              {/* 内发光效果 - 青色渐变 */}              <div className="relative z-[2] flex border-b border-[#1E1E2E] overflow-x-auto">
                {[
                  { id: 'positions', label: t('currentPositions'), count: filteredPositions.length, icon: BarChart3 },
                  { id: 'history', label: t('historyOrders'), count: filteredHistoryOrders.length, icon: RefreshCcw },
                  { id: 'logs', label: t('executionLogs'), count: filteredLogs.length, icon: Activity },
                  { id: 'strategies', label: t('strategyManagement'), count: strategiesForCount.length, icon: Zap }
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
                      <h3 className="text-xl font-semibold mb-2">{t('noPositions')}</h3>
                      <p className="text-[#9090A0]">
                        {accountType === 'all' ? t('noPositionsDesc') : accountType === 'spot' ? t('noSpotPositions') : t('noFuturesPositions')}
                      </p>
                    </div>
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-[#9090A0] border-b border-[#1E1E2E]">
                          <th className="pb-3 font-medium">{t('tradingPair')}</th>
                          <th className="pb-3 font-medium">{t('strategy')}</th>
                          <th className="pb-3 font-medium">{t('direction')}</th>
                          <th className="pb-3 font-medium">{t('leverageMargin')}</th>
                          <th className="pb-3 font-medium">{t('quantity')}</th>
                          <th className="pb-3 font-medium">{t('entryPrice')}</th>
                          <th className="pb-3 font-medium">{t('markPrice')}</th>
                          <th className="pb-3 font-medium">{t('stopLossTakeProfit')}</th>
                          <th className="pb-3 font-medium">{t('unrealizedPnl')}</th>
                          <th className="pb-3 font-medium">{t('operation')}</th>
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
                                <span className="font-medium text-[#F8F8FC]">{position.symbol.replace(/:USDT$/, '')}</span>
                              </div>
                            </td>
                            <td className="py-4">
                              {position.strategy ? (
                                <div className="flex items-center gap-2">
                                  {position.source?.startsWith('ai_') ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">AI</span>
                                  ) : (
                                    <Zap className="w-3 h-3 text-amber-400" />
                                  )}
                                  <span className="text-sm text-[#9090A0]">{position.strategy}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-[#606070]">{t('manual') || '手动'}</span>
                              )}
                            </td>
                            <td className="py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                                position.direction === 'long'
                                  ? 'bg-green-400/10 text-green-400 border border-green-400/20'
                                  : 'bg-red-400/10 text-red-400 border border-red-400/20'
                              }`}>
                                {position.direction === 'long' ? t('long') : t('short')}
                                {position.direction === 'long' ? (
                                  <ArrowUpRight className="w-3 h-3" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3" />
                                )}
                              </span>
                            </td>
                            <td className="py-4">
                              <div className="text-xs">
                                <div className="text-cyan-400 font-medium">{position.leverage || 1}x</div>
                                <div className="text-[#9090A0]">${(position.margin || 0).toFixed(2)}</div>
                              </div>
                            </td>
                            <td className="py-4 text-[#F8F8FC]">{position.size}</td>
                            <td className="py-4 text-[#F8F8FC]">${position.entryPrice.toLocaleString()}</td>
                            <td className="py-4 text-[#F8F8FC]">
                              ${position.markPrice.toLocaleString()}
                              {position.syncSource === 'database' && (
                                <span className="ml-1 text-[10px] text-yellow-400/70" title={t('cachedData')}>⏱</span>
                              )}
                            </td>
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
                                {t('closePosition')}
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

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="relative z-[2] p-6">
                  {filteredHistoryOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <RefreshCcw className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">{t('noHistoryOrders')}</h3>
                      <p className="text-[#9090A0]">{t('noHistoryOrdersDesc')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-sm text-[#9090A0] border-b border-[#1E1E2E]">
                            <th className="pb-3 font-medium">{t('tradingPair')}</th>
                            <th className="pb-3 font-medium">{t('direction')}</th>
                            <th className="pb-3 font-medium">{t('leverageMargin')}</th>
                            <th className="pb-3 font-medium">{t('entryPrice')}</th>
                            <th className="pb-3 font-medium">{t('closePrice')}</th>
                            <th className="pb-3 font-medium">{t('quantity')}</th>
                            <th className="pb-3 font-medium">{t('closedPnl')}</th>
                            <th className="pb-3 font-medium">{t('closeTime')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHistoryOrders.map((order) => (
                            <tr key={order.id} className="border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/20 transition-colors">
                              <td className="py-4">
                                <div className="font-medium text-[#F8F8FC]">{order.symbol.replace(/:USDT$/, '')}</div>
                                {order.strategyName && (
                                  <div className="flex items-center gap-1 text-xs text-[#606070]">
                                    {order.source?.startsWith('ai_') && (
                                      <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400">AI</span>
                                    )}
                                    <span>{order.strategyName}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                  order.side === 'long'
                                    ? 'bg-green-400/10 text-green-400'
                                    : 'bg-red-400/10 text-red-400'
                                }`}>
                                  {order.side === 'long' ? t('long') : t('short')}
                                  {order.side === 'long' ? (
                                    <ArrowUpRight className="w-3 h-3" />
                                  ) : (
                                    <ArrowDownRight className="w-3 h-3" />
                                  )}
                                </span>
                              </td>
                              <td className="py-4">
                                <div className="text-xs">
                                  <div className="text-cyan-400 font-medium">{order.leverage || 1}x</div>
                                  <div className="text-[#9090A0]">${(order.margin || 0).toFixed(2)}</div>
                                </div>
                              </td>
                              <td className="py-4 text-[#F8F8FC]">{(order.entryPrice || order.price) ? `$${(order.entryPrice || order.price).toLocaleString()}` : '-'}</td>
                              <td className="py-4 text-[#F8F8FC]">{(order.closePrice || order.price) ? `$${(order.closePrice || order.price).toLocaleString()}` : '-'}</td>
                              <td className="py-4 text-[#F8F8FC]">{order.amount > 0 ? order.amount : '-'}</td>
                              <td className="py-4">
                                <div className={`font-medium ${order.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {order.pnl >= 0 ? '+' : ''}{order.pnl.toFixed(4)} USDT
                                </div>
                                {order.pnlPercent !== undefined && order.pnlPercent !== 0 && (
                                  <div className={`text-xs ${order.pnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                    {order.pnl >= 0 ? '+' : ''}{order.pnlPercent.toFixed(2)}%
                                  </div>
                                )}
                              </td>
                              <td className="py-4 text-[#9090A0] text-sm">
                                {order.time ? new Date(order.time).toLocaleString('zh-CN', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                        <span className="text-[#9090A0]">{t('totalStrategies', { count: strategiesForCount.length })}</span>
                        <span className="text-[#2A2A3A]">|</span>
                        <span className="text-green-400">{t('runningCount', { count: runningCount })}</span>
                        <span className="text-[#2A2A3A]">|</span>
                        <span className="text-yellow-400">{t('pausedCount', { count: pausedCount })}</span>
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
                        placeholder={t('searchStrategies')}
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
                          {status === 'all' ? t('allStatus') : status === 'running' ? t('runningStatus') : t('pausedStatus')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Strategy List */}
                  {filteredStrategies.length === 0 ? (
                    <div className="text-center py-12">
                      <Zap className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">{t('noStrategies')}</h3>
                      <p className="text-[#9090A0] mb-6">{t('noStrategiesDesc')}</p>
                      <div className="flex justify-center gap-3">
                        <Button
                          onClick={onViewMarket}
                          className="bg-[#06B6D4] hover:bg-[#0891B2] text-white"
                        >
                          {t('browseStrategies')}
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
                                  {strategy.status === 'running' ? t('running') : t('pausedStatus')}
                                </span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium",
                                  strategyTypeColors[strategy.type]
                                )}>
                                  {t(`strategyTypes.${strategy.type}`)}
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
                                  {t('lastModified')} {strategy.lastModified}
                                </span>
                              </div>
                            </div>

                            {/* Config Summary */}
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">{t('amountPerTradeLabel')}</span>
                                <span className="font-medium text-cyan-400">
                                  {strategy.config.amountPerTrade ? `$${strategy.config.amountPerTrade}` : '-'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">{t('leverage')}</span>
                                <span className="font-medium">{strategy.config.leverage}x</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">{t('positionSize')}</span>
                                <span className="font-medium">{strategy.config.positionSize}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">{t('stopLoss')}</span>
                                <span className="font-medium text-red-400">{strategy.config.stopLoss}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#606070]">{t('takeProfit')}</span>
                                <span className="font-medium text-green-400">{strategy.config.takeProfit}%</span>
                              </div>
                            </div>

                            {/* Actions - 暂停/启动在右边 */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEditStrategy?.(strategy.id)}
                                className="p-2.5 rounded-lg bg-[#1E1E2E] text-[#9090A0] hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                                title={t('editStrategy')}
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteStrategy?.(strategy.id)}
                                className="p-2.5 rounded-lg bg-[#1E1E2E] text-[#9090A0] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                title={t('deleteStrategy')}
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
                                title={strategy.status === 'running' ? t('pause') : t('start')}
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
                      <span className="text-[#9090A0] text-sm">{t('totalLogs', { count: filteredLogs.length })}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredLogs.slice(0, visibleLogCount).map((log) => (
                      <DesktopLogCard key={log.id} log={log} />
                    ))}
                    {filteredLogs.length > visibleLogCount && (
                      <button
                        type="button"
                        onClick={() => setVisibleLogCount(prev => prev + 10)}
                        className="w-full py-3 text-sm text-[#06B6D4] hover:text-[#0891B2] bg-[#12121A]/50 rounded-xl border border-[#1E1E2E] hover:border-[#06B6D4]/30 transition-colors"
                      >
                        {t('loadMore')} ({visibleLogCount}/{filteredLogs.length})
                      </button>
                    )}
                  </div>

                  {filteredLogs.length === 0 && (
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                      <p className="text-[#9090A0]">
                        {accountType === 'all' ? t('noLogs') : accountType === 'spot' ? t('noSpotLogs') : t('noFuturesLogs')}
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

// ============ 策略类型视觉配置 ============
const STRATEGY_STYLE: Record<string, { color: string; bg: string; border: string; label: string; Icon: typeof Zap }> = {
  research: { color: 'text-[#06B6D4]', bg: 'bg-[#06B6D4]/10', border: 'border-[#06B6D4]/40', label: '深研', Icon: FlaskConical },
  solo:     { color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/40', label: '极速', Icon: Zap },
  debate:   { color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/40', label: '共识', Icon: Users },
  grid:     { color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/40', label: '网格', Icon: Grid3x3 },
  signal:   { color: 'text-[#64748B]', bg: 'bg-[#64748B]/10', border: 'border-[#64748B]/40', label: '信号', Icon: Radio },
}

// getDesktopActionStyle → 已迁移到 getActionBadgeStyle (execution-log-format.ts)

function DesktopConfidenceBar({ value }: { value: number }) {
  const fill = value >= 70 ? '#10B981' : value >= 40 ? '#F59E0B' : '#F43F5E'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[80px] h-1.5 rounded-full bg-[#1E1E2E] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: fill }} />
      </div>
      <span className="text-xs font-mono" style={{ color: fill }}>{value}%</span>
    </div>
  )
}

function DesktopLogCard({ log }: { log: ExecutionLog }) {
  const [expanded, setExpanded] = useState(false)
  const tAi = useTranslations('ai')
  const style = STRATEGY_STYLE[log.strategyType || ''] || STRATEGY_STYLE.signal
  const StIcon = style.Icon

  return (
    <div className={`flex items-start gap-4 p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] hover:border-[#2A2A3A] transition-colors border-l-2 ${style.border}`}>
      {/* 状态图标 */}
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
        {/* 标题行 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-[#F8F8FC]">{log.strategy}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${style.bg} ${style.color}`}>
            <StIcon className="w-3 h-3" />
            {style.label}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${getActionBadgeStyle(log.action)}`}>
            {getActionText(log.action, tAi)}
          </span>
          {log.gridSummary && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] font-mono">
              {formatGridSummary(log.gridSummary, tAi)}
            </span>
          )}
          <span className="text-xs text-[#606070]">{log.symbol?.replace(/:USDT$/, '') || ''}</span>
        </div>

        {/* 消息行 */}
        <p className="text-sm text-[#9090A0] mb-2">{log.message}</p>

        {/* Solo / Debate: 置信度 + 执行参数 */}
        {(log.strategyType === 'solo' || log.strategyType === 'debate') && (
          <div className="space-y-1.5 mb-2">
            {log.confidence != null && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#808090]">置信度</span>
                <DesktopConfidenceBar value={log.confidence} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {log.leverage != null && (
                <span className="text-xs text-[#94A3B8]">
                  杠杆 <span className="text-[#F8F8FC] font-mono">{log.leverage}x</span>
                </span>
              )}
              {log.positionSizePercent != null && (
                <span className="text-xs text-[#94A3B8]">
                  仓位 <span className="text-[#F8F8FC] font-mono">{log.positionSizePercent}%</span>
                </span>
              )}
              {log.stopLoss != null && (
                <span className="text-xs text-[#F43F5E]">
                  止损 <span className="font-mono">${log.stopLoss.toLocaleString()}</span>
                </span>
              )}
              {log.takeProfit != null && (
                <span className="text-xs text-[#10B981]">
                  止盈 <span className="font-mono">${log.takeProfit.toLocaleString()}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Debate: 投票 */}
        {log.strategyType === 'debate' && log.votes && log.votes.length > 0 && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-[#F59E0B] hover:text-[#D97706] transition-colors"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              {log.votes.length}个模型投票
            </button>
            {expanded && (
              <div className="mt-1.5 space-y-1 pl-4 border-l border-[#F59E0B]/20">
                {log.votes.map((v, i) => (
                  <div key={v.modelId || i} className="flex items-center gap-3 text-xs">
                    <span className="text-[#F59E0B] font-mono truncate max-w-[140px]">{(v.modelId || '').split('/').pop()}</span>
                    <span className={`px-1.5 py-0.5 rounded ${getActionBadgeStyle(v.action)}`}>{getActionText(v.action, tAi)}</span>
                    <span className="text-[#808090]">{v.confidence}%</span>
                    {v.reasoning && <span className="text-[#606070] truncate max-w-[200px]">{v.reasoning}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid: 买卖区间 */}
        {log.strategyType === 'grid' && (log.gridBuyRange || log.gridSellRange) && (
          <div className="flex flex-wrap items-center gap-3 mb-2">
            {log.gridBuyRange && (
              <span className="text-xs text-[#10B981]">
                买 <span className="font-mono">{log.gridBuyRange}</span>
              </span>
            )}
            {log.gridSellRange && (
              <span className="text-xs text-[#F43F5E]">
                卖 <span className="font-mono">{log.gridSellRange}</span>
              </span>
            )}
            {log.gridOrderCount != null && (
              <span className="text-xs text-[#94A3B8]">
                共 <span className="text-[#F8F8FC] font-mono">{log.gridOrderCount}</span> 笔
              </span>
            )}
          </div>
        )}

        {/* 风控拦截 */}
        {log.blockedBy && (
          <div className="text-xs text-red-400/80 mb-2 flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-red-400/10 font-mono text-[10px]">{log.blockedBy}</span>
            <span>{log.blockReason}</span>
          </div>
        )}

        {/* 成交/执行详情 */}
        {(log.executedPrice || log.slippage || log.durationMs || log.skipReason) && (
          <div className="flex flex-wrap items-center gap-3 mb-2">
            {log.executedPrice && (
              <span className="text-xs text-[#94A3B8]">
                成交价 <span className="text-[#F8F8FC]">{parseFloat(log.executedPrice).toFixed(2)}</span>
              </span>
            )}
            {log.executedAmount && (
              <span className="text-xs text-[#94A3B8]">
                数量 <span className="text-[#F8F8FC] font-mono">{parseFloat(log.executedAmount)}</span>
              </span>
            )}
            {log.slippage && (
              <span className={`text-xs ${parseFloat(log.slippage) > 0.5 ? 'text-yellow-400' : 'text-[#94A3B8]'}`}>
                滑点 {parseFloat(log.slippage).toFixed(3)}%
              </span>
            )}
            {log.durationMs != null && (
              <span className="text-xs text-[#94A3B8]">
                耗时 {log.durationMs < 1000 ? `${log.durationMs}ms` : `${(log.durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
            {log.skipReason && (
              <span className="text-xs text-yellow-400/80">{log.skipReason}</span>
            )}
            {log.errorCode && (
              <span className="text-xs text-red-400/80">[{log.errorCode}]</span>
            )}
          </div>
        )}

        {/* 推理文本（可展开） */}
        {(log.strategyType === 'solo' || log.strategyType === 'debate') && log.reasoning && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-[#808090] hover:text-[#A0A0B0] transition-colors"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              AI 推理
            </button>
            {expanded && (
              <p className="mt-1 text-xs text-[#808090] leading-relaxed pl-4 border-l border-[#2A2A3A] line-clamp-6">
                {log.reasoning}
              </p>
            )}
          </div>
        )}

        {/* 时间行 */}
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-[#606070]" />
          <span className="text-xs text-[#606070]">{log.time ? new Date(log.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
        </div>
      </div>
    </div>
  )
}

