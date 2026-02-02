'use client'

import { useState } from 'react'
import {
  AlertTriangle,
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
  Search,
  RefreshCcw
} from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

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
  stopLoss: number
  takeProfit: number
  marketType: MarketType
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
}

interface HistoryOrder {
  id: string | number
  symbol: string
  side: 'buy' | 'sell'
  type: string
  price: number
  amount: number
  filled: number
  total: number
  pnl: number
  fee: number
  time: string
  status: 'filled' | 'cancelled'
  marketType: MarketType
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

// 策略类型映射函数 - 返回翻译后的标签
const getStrategyTypeLabel = (type: string, t: (key: string) => string) => {
  const typeKey = `strategyTypes.${type}` as const
  return t(typeKey as any) || type
}

// 盈亏统计类型
interface PnlStatsProps {
  totalAssets: number
  availableBalance: number
  totalPnl: number
  todayPnl: number
  unrealizedPnl: number
}

// ============ Props ============
interface MobileTradingCenterProps {
  positions?: Position[]
  historyOrders?: HistoryOrder[]
  executionLogs?: ExecutionLog[]
  myStrategies?: MyStrategy[]
  accounts?: Account[]
  pnlStats?: PnlStatsProps
  onClosePosition?: (positionId: number | string) => void
  onEmergencyCloseAll?: () => void
  onEditStrategy?: (strategyId: string) => void
  onDeleteStrategy?: (strategyId: string) => void
  onToggleStrategy?: (strategyId: string, status: 'running' | 'paused') => void
  onViewMarket?: () => void
}

// ============ Component ============
export function MobileTradingCenter({
  positions = [],
  historyOrders = [],
  executionLogs = [],
  myStrategies = [],
  accounts = [],
  pnlStats,
  onClosePosition,
  onEmergencyCloseAll,
  onEditStrategy,
  onDeleteStrategy,
  onToggleStrategy,
  onViewMarket
}: MobileTradingCenterProps) {
  const t = useTranslations('trading')
  const [activeTab, setActiveTab] = useState('positions')
  const [selectedAccount, setSelectedAccount] = useState(accounts[0] || { id: 0, name: t('noAccountsBound'), balance: 0 })
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [accountType, setAccountType] = useState<'all' | 'spot' | 'futures'>('all')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-01-29' })
  const [strategySearchQuery, setStrategySearchQuery] = useState('')
  const [strategyStatusFilter, setStrategyStatusFilter] = useState<'all' | 'running' | 'paused'>('all')
  const [showSearchInput, setShowSearchInput] = useState(false)

  // ========== 数据过滤（基于 accountType） ==========
  const filteredPositions = accountType === 'all'
    ? positions
    : positions.filter(pos => pos.marketType === accountType)

  const filteredLogs = accountType === 'all'
    ? executionLogs
    : executionLogs.filter(log => log.marketType === accountType)

  const filteredStrategies = myStrategies.filter(strategy => {
    const matchesMarketType = accountType === 'all' || strategy.marketType === accountType
    const matchesSearch = strategy.name.toLowerCase().includes(strategySearchQuery.toLowerCase())
    const matchesStatus = strategyStatusFilter === 'all' || strategy.status === strategyStatusFilter
    return matchesMarketType && matchesSearch && matchesStatus
  })

  const filteredHistoryOrders = accountType === 'all'
    ? historyOrders
    : historyOrders.filter(order => order.marketType === accountType)

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

  const tabs = [
    { id: 'positions', labelKey: 'currentPositions', count: filteredPositions.length, icon: BarChart3 },
    { id: 'history', labelKey: 'historyOrders', count: filteredHistoryOrders.length, icon: RefreshCcw },
    { id: 'logs', labelKey: 'executionLogs', count: filteredLogs.length, icon: Activity },
    { id: 'strategies', labelKey: 'strategy', count: strategiesForCount.length, icon: Zap }
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex flex-col">
      {/* Header - 标题 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-center px-4 h-14">
          <h1 className="text-base font-semibold text-white">{t('title')}</h1>
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-auto pb-20">
        {/* 筛选器行 - 全部/现货/合约 + 账户选择 */}
        <div className="px-4 pt-3 pb-3 flex items-center gap-3">
          {/* 全部/现货/合约切换 */}
          <div className="flex-1 flex gap-2 p-1 bg-[#12121A] rounded-xl">
            {(['all', 'spot', 'futures'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  accountType === type
                    ? 'bg-[#06B6D4] text-white shadow-lg shadow-[#06B6D4]/20'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {type === 'all' ? t('all') : type === 'spot' ? t('spot') : t('futures')}
              </button>
            ))}
          </div>

          {/* 账户选择器 */}
          <div className="flex-1 relative">
            <button
              type="button"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#12121A] border border-[#1E1E2E] rounded-xl text-sm"
            >
              <Wallet className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span className="truncate">{selectedAccount.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#9090A0]" />
            </button>

            {showAccountDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-xl shadow-xl z-50 overflow-hidden">
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
        </div>

        {/* 资产统计卡片 */}
        <div className="px-4 pb-3">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
            {/* 主要盈亏数据 - 突出显示 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-[#0A0A0F]/50 rounded-xl">
                <p className="text-xs text-[#9090A0] mb-1">{t('totalPnl')}</p>
                <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-3 bg-[#0A0A0F]/50 rounded-xl">
                <p className="text-xs text-[#9090A0] mb-1">{t('todayPnl')}</p>
                <p className={`text-2xl font-bold ${todayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {todayPnl >= 0 ? '+' : ''}${todayPnl.toLocaleString()}
                </p>
              </div>
            </div>
            {/* 次要数据 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-[#606070] mb-1">{t('totalAssets')}</p>
                <p className="text-base font-semibold text-[#F8F8FC]">${totalAssets.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#606070] mb-1">{t('availableBalance')}</p>
                <p className="text-base font-semibold text-[#F8F8FC]">${availableBalance.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#606070] mb-1">{t('unrealized')}</p>
                <p className={`text-base font-semibold ${totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 日期选择器 + 紧急清仓 - 等宽 */}
        <div className="px-4 pb-3 flex items-center gap-3">
          {/* 日期选择器 */}
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-xs text-[#9090A0]"
          >
            <Calendar className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>
              {dateRange.start.slice(5)}～{dateRange.end.slice(5)}
            </span>
          </button>

          {/* 紧急清仓按钮 */}
          <button
            type="button"
            onClick={onEmergencyCloseAll}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t('emergencyClose')}</span>
          </button>
        </div>

        {/* 日期选择弹窗 */}
        {showDatePicker && (
          <div className="mx-4 mb-3 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-xl shadow-xl p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="m-date-start" className="text-xs text-[#9090A0] mb-1 block">{t('startDate')}</label>
                  <input
                    id="m-date-start"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-date-end" className="text-xs text-[#9090A0] mb-1 block">{t('endDate')}</label>
                  <input
                    id="m-date-end"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
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
                    className="flex-1 px-3 py-1.5 text-xs bg-[#1E1E2E] text-[#9090A0] rounded hover:bg-[#2A2A3A] transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="w-full py-2 bg-[#06B6D4] text-white rounded-lg text-sm font-medium"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        )}

        {/* Tab 导航 + 内容 - 统一卡片 */}
        <div className="px-4">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Tab 导航 */}
            <div className="grid grid-cols-4 p-1.5 gap-1 border-b border-[#1E1E2E]">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className="relative flex flex-col items-center justify-center py-2.5 rounded-lg transition-all"
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${isActive ? 'text-[#06B6D4]' : 'text-[#606070]'}`} />
                    <span className={`text-[10px] font-medium ${isActive ? 'text-[#06B6D4]' : 'text-[#9090A0]'}`}>
                      {t(tab.labelKey as any)}
                    </span>
                    {/* 数字徽章 - 绝对定位不影响居中 */}
                    <span className={`absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[8px] font-medium ${
                      isActive
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'bg-[#1E1E2E] text-[#9090A0]'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Tab 内容 */}
            <div className="p-3 space-y-3">
          {/* 持仓 Tab */}
          {activeTab === 'positions' && (
            filteredPositions.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('noPositions')}</h3>
                <p className="text-sm text-[#9090A0]">
                  {accountType === 'all' ? t('noPositionsDesc') : accountType === 'spot' ? t('noSpotPositions') : t('noFuturesPositions')}
                </p>
              </div>
            ) : (
              filteredPositions.map((position) => (
                <div key={position.id} className="bg-[#0A0A0F]/50 border border-[#1E1E2E]/50 rounded-lg p-3">
                  {/* 头部 - 紧凑布局 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400 font-bold text-xs flex-shrink-0">
                        {position.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{position.symbol}</span>
                          <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                            position.direction === 'long'
                              ? 'bg-green-400/10 text-green-400'
                              : 'bg-red-400/10 text-red-400'
                          }`}>
                            {position.direction === 'long' ? t('long') : t('short')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#9090A0] truncate">
                          <Zap className="w-2.5 h-2.5 text-[#06B6D4] flex-shrink-0" />
                          <span className="truncate">{position.strategy}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className={`font-semibold text-sm ${position.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(0)}
                      </p>
                      <p className={`text-[10px] ${position.roe >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                        {position.roe >= 0 ? '+' : ''}{position.roe.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* 数据行 - 2行3列布局 */}
                  <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 text-[11px] mb-2 bg-[#0A0A0F]/50 rounded-lg p-2">
                    <div>
                      <p className="text-[#606070]">{t('size')}</p>
                      <p className="font-medium">{position.size}</p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('entry')}</p>
                      <p className="font-medium">${(position.entryPrice / 1000).toFixed(1)}k</p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('current')}</p>
                      <p className="font-medium">${(position.markPrice / 1000).toFixed(1)}k</p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('stopLossLabel')}</p>
                      <p className="font-medium text-red-400">
                        {position.stopLoss > 0 ? `$${(position.stopLoss / 1000).toFixed(1)}k` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('takeProfitLabel')}</p>
                      <p className="font-medium text-green-400">
                        {position.takeProfit > 0 ? `$${(position.takeProfit / 1000).toFixed(1)}k` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('liquidation')}</p>
                      <p className="font-medium text-yellow-400">
                        {position.liquidationPrice > 0 ? `$${(position.liquidationPrice / 1000).toFixed(1)}k` : '-'}
                      </p>
                    </div>
                  </div>

                  {/* 平仓按钮 */}
                  <button
                    type="button"
                    onClick={() => onClosePosition?.(position.id)}
                    className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium"
                  >
                    {t('closePosition')}
                  </button>
                </div>
              ))
            )
          )}

          {/* 历史 Tab */}
          {activeTab === 'history' && (
            filteredHistoryOrders.length === 0 ? (
              <div className="text-center py-12">
                <RefreshCcw className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('noHistoryOrders')}</h3>
                <p className="text-sm text-[#9090A0]">{t('historyOrdersDesc')}</p>
              </div>
            ) : (
              filteredHistoryOrders.map((order) => (
                <div key={order.id} className="bg-[#0A0A0F]/50 border border-[#1E1E2E]/50 rounded-lg p-3">
                  {/* 头部 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{order.symbol}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        order.side === 'buy'
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-red-400/10 text-red-400'
                      }`}>
                        {order.side === 'buy' ? t('buy') : t('sell')}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1E1E2E] text-[#9090A0]">
                        {order.type}
                      </span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      order.status === 'filled'
                        ? 'bg-green-400/10 text-green-400'
                        : 'bg-yellow-400/10 text-yellow-400'
                    }`}>
                      {order.status === 'filled' ? t('filledStatus') : t('cancelledStatus')}
                    </span>
                  </div>

                  {/* 数据行 */}
                  <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 text-[11px] mb-2 bg-[#0A0A0F]/50 rounded-lg p-2">
                    <div>
                      <p className="text-[#606070]">{t('price')}</p>
                      <p className="font-medium">${order.price.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('amount')}</p>
                      <p className="font-medium">{order.amount}</p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('filled')}</p>
                      <p className="font-medium">{order.filled}</p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('total')}</p>
                      <p className="font-medium">${order.total.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('pnl')}</p>
                      <p className={`font-medium ${order.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {order.pnl >= 0 ? '+' : ''}${order.pnl.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#606070]">{t('fee')}</p>
                      <p className="font-medium text-[#9090A0]">${order.fee.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* 时间 */}
                  <div className="flex items-center gap-1 text-[10px] text-[#606070]">
                    <Clock className="w-3 h-3" />
                    <span>{order.time}</span>
                  </div>
                </div>
              ))
            )
          )}

          {/* 日志 Tab */}
          {activeTab === 'logs' && (
            filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('noLogs')}</h3>
                <p className="text-sm text-[#9090A0]">
                  {accountType === 'all' ? t('noLogs') : accountType === 'spot' ? t('noSpotLogs') : t('noFuturesLogs')}
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="bg-[#0A0A0F]/50 border border-[#1E1E2E]/50 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-full flex-shrink-0 ${
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
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium">{log.strategy}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          log.action === '开多' || log.action === '买入' ? 'bg-green-400/10 text-green-400' :
                          log.action === '开空' || log.action === '卖出' ? 'bg-red-400/10 text-red-400' :
                          log.action === '止盈' ? 'bg-cyan-400/10 text-cyan-400' :
                          'bg-yellow-400/10 text-yellow-400'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-xs text-[#606070]">{log.symbol}</span>
                      </div>
                      <p className="text-xs text-[#9090A0] mb-1">{log.message}</p>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#606070]" />
                        <span className="text-xs text-[#606070]">{log.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {/* 策略 Tab */}
          {activeTab === 'strategies' && (
            <>
              {/* 搜索和筛选 */}
              <div className="space-y-3 mb-4">
                {/* 筛选行 + 搜索图标 */}
                <div className="flex items-center gap-2">
                  {/* 全部/运行中/已暂停 - 带数量 */}
                  <div className="flex-1 flex bg-[#12121A] border border-[#1E1E2E] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setStrategyStatusFilter('all')}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        strategyStatusFilter === 'all' ? 'bg-[#06B6D4] text-white' : 'text-[#9090A0]'
                      }`}
                    >
                      {t('allStatus')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrategyStatusFilter('running')}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        strategyStatusFilter === 'running' ? 'bg-[#06B6D4] text-white' : 'text-[#9090A0]'
                      }`}
                    >
                      {t('runningStatus')} <span className={strategyStatusFilter === 'running' ? 'text-white/80' : 'text-green-400'}>{runningCount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrategyStatusFilter('paused')}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        strategyStatusFilter === 'paused' ? 'bg-[#06B6D4] text-white' : 'text-[#9090A0]'
                      }`}
                    >
                      {t('pausedStatus')} <span className={strategyStatusFilter === 'paused' ? 'text-white/80' : 'text-yellow-400'}>{pausedCount}</span>
                    </button>
                  </div>
                  {/* 搜索图标按钮 */}
                  <button
                    type="button"
                    onClick={() => setShowSearchInput(!showSearchInput)}
                    title={t('searchStrategies')}
                    aria-label={t('searchStrategies')}
                    className={`p-2 rounded-lg transition-colors ${
                      showSearchInput ? 'bg-[#06B6D4] text-white' : 'bg-[#1E1E2E] text-[#9090A0]'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
                {/* 展开的搜索框 */}
                {showSearchInput && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
                    <input
                      type="text"
                      value={strategySearchQuery}
                      onChange={(e) => setStrategySearchQuery(e.target.value)}
                      placeholder={t('searchStrategies')}
                      autoFocus
                      className="w-full bg-[#12121A] border border-[#1E1E2E] rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 策略列表 */}
              {filteredStrategies.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('noStrategies')}</h3>
                  <p className="text-sm text-[#9090A0] mb-4">{t('noStrategiesDesc')}</p>
                  <button
                    type="button"
                    onClick={onViewMarket}
                    className="px-6 py-2.5 bg-[#06B6D4] text-white rounded-xl text-sm font-medium"
                  >
                    {t('browseStrategies')}
                  </button>
                </div>
              ) : (
                filteredStrategies.map((strategy) => (
                  <div key={strategy.id} className="bg-[#0A0A0F]/50 border border-[#1E1E2E]/50 rounded-lg p-4">
                    {/* 头部 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <div className={`w-2 h-2 rounded-full ${
                            strategy.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                          }`} />
                          <h3 className="font-medium">{strategy.name}</h3>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            strategy.status === 'running'
                              ? 'bg-green-400/10 text-green-400'
                              : 'bg-yellow-400/10 text-yellow-400'
                          }`}>
                            {strategy.status === 'running' ? t('runningStatus') : t('pausedStatus')}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${strategyTypeColors[strategy.type]}`}>
                            {getStrategyTypeLabel(strategy.type, t)}
                          </span>
                        </div>
                        <p className="text-xs text-[#9090A0] line-clamp-1">{strategy.description}</p>
                      </div>
                    </div>

                    {/* 配置信息 */}
                    <div className="flex items-center gap-3 text-xs text-[#606070] mb-3">
                      <span>{strategy.exchange}</span>
                      <span>·</span>
                      <span>{strategy.tradingPairs.join(', ')}</span>
                    </div>

                    {/* 参数 */}
                    <div className="grid grid-cols-4 gap-2 text-xs mb-3 p-2 bg-[#0A0A0F]/50 rounded-lg">
                      <div className="text-center">
                        <p className="text-[#606070]">{t('leverage')}</p>
                        <p className="font-medium">{strategy.config.leverage}x</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[#606070]">{t('positionSize')}</p>
                        <p className="font-medium">{strategy.config.positionSize}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[#606070]">{t('stopLoss')}</p>
                        <p className="font-medium text-red-400">{strategy.config.stopLoss}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[#606070]">{t('takeProfit')}</p>
                        <p className="font-medium text-green-400">{strategy.config.takeProfit}%</p>
                      </div>
                    </div>

                    {/* 操作按钮 - 统一尺寸，暂停在右边 */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditStrategy?.(strategy.id)}
                        className="p-2.5 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
                        title={t('editStrategy')}
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteStrategy?.(strategy.id)}
                        className="p-2.5 rounded-xl bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0] hover:text-red-400 transition-colors"
                        title={t('deleteStrategy')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStrategy?.(strategy.id, strategy.status === 'running' ? 'paused' : 'running')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 ${
                          strategy.status === 'running'
                            ? 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-400'
                            : 'bg-green-400/10 border border-green-400/20 text-green-400'
                        }`}
                      >
                        {strategy.status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {strategy.status === 'running' ? t('pause') : t('start')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
