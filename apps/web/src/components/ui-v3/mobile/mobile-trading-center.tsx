'use client'

import { useState, useEffect } from 'react'
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
  // 新增字段
  leverage?: number
  margin?: number
  marginMode?: string
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
}

interface HistoryOrder {
  id: string | number
  symbol: string
  side: 'long' | 'short'
  type: string
  price: number
  entryPrice: number
  closePrice: number
  amount: number
  filled: number
  total: number
  pnl: number
  pnlPercent: number
  fee: number
  time: string
  openTime?: string
  status: 'filled' | 'cancelled'
  marketType: MarketType
  leverage: number
  margin: number
  closeReason?: string
  strategyName?: string
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
  spotValue?: number    // 现货余额
  futuresValue?: number // 合约余额
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
interface MobileTradingCenterProps {
  positions?: Position[]
  historyOrders?: HistoryOrder[]
  executionLogs?: ExecutionLog[]
  myStrategies?: MyStrategy[]
  accounts?: Account[]
  strategyHealth?: StrategyHealthItem[]
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
  strategyHealth = [],
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
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    }
  })
  const [strategySearchQuery, setStrategySearchQuery] = useState('')
  const [strategyStatusFilter, setStrategyStatusFilter] = useState<'all' | 'running' | 'paused'>('all')
  const [showSearchInput, setShowSearchInput] = useState(false)

  // ========== 当 accounts 加载后更新 selectedAccount ==========
  useEffect(() => {
    if (accounts.length > 0 && selectedAccount.id === 0) {
      // 初始状态时选择第一个账户
      setSelectedAccount(accounts[0])
    } else if (accounts.length > 0) {
      // 如果当前选中的账户数据更新了，同步更新
      const updatedAccount = accounts.find(a => a.id === selectedAccount.id)
      if (updatedAccount && (
        updatedAccount.balance !== selectedAccount.balance ||
        updatedAccount.spotValue !== selectedAccount.spotValue ||
        updatedAccount.futuresValue !== selectedAccount.futuresValue
      )) {
        setSelectedAccount(updatedAccount)
      }
    }
  }, [accounts, selectedAccount.id, selectedAccount.balance, selectedAccount.spotValue, selectedAccount.futuresValue])

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

  // ========== 统计数据计算（根据选中账户和类型计算资产） ==========
  // 根据 accountType 计算当前显示的资产
  const getAccountAssets = () => {
    switch (accountType) {
      case 'spot':
        return selectedAccount.spotValue ?? 0
      case 'futures':
        return selectedAccount.futuresValue ?? 0
      case 'all':
      default:
        return selectedAccount.balance ?? 0
    }
  }
  const totalAssets = getAccountAssets()
  const availableBalance = totalAssets // 可用余额暂时等于总资产
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

        {/* 策略健康状态条 */}
        {strategyHealth.length > 0 && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {strategyHealth.map((sh) => (
                <div key={sh.strategyId || sh.strategyName} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#12121A]/50 border border-[#1E1E2E] rounded-lg flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    sh.status === 'healthy' ? 'bg-green-400' :
                    sh.status === 'degraded' ? 'bg-yellow-400' :
                    sh.status === 'warning' ? 'bg-orange-400' :
                    'bg-red-400'
                  }`} />
                  <span className="text-xs text-[#F8F8FC]">{sh.strategyName.replace('Strategy', '')}</span>
                  <span className="text-xs text-[#606070]">
                    {sh.minutesSinceLastSignal != null
                      ? sh.minutesSinceLastSignal < 60
                        ? `${sh.minutesSinceLastSignal}m`
                        : `${Math.floor(sh.minutesSinceLastSignal / 60)}h`
                      : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 资产统计卡片 - 2行布局 */}
        <div className="px-4 pb-3">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-3">
            {/* 第一行：总资产 + 可用余额 */}
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div className="text-center">
                <p className="text-xs text-[#606070] mb-0.5">{t('totalAssets')}</p>
                <p className="text-xl font-bold text-[#F8F8FC]">
                  ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#606070] mb-0.5">{t('availableBalance')}</p>
                <p className="text-xl font-bold text-[#F8F8FC]">${availableBalance.toLocaleString()}</p>
              </div>
            </div>
            {/* 第二行：今日盈亏 + 未实现 + 总盈亏 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-xs text-[#606070] mb-0.5">{t('todayPnl')}</p>
                <p className={`text-sm font-semibold ${todayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {todayPnl >= 0 ? '+' : ''}${todayPnl.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#606070] mb-0.5">{t('unrealized')}</p>
                <p className={`text-sm font-semibold ${totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#606070] mb-0.5">{t('totalPnl')}</p>
                <p className={`text-sm font-semibold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
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
                  {/* 头部 - 交易对 + 方向/保证金模式/杠杆 标签组 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-white">{position.symbol.replace(/:USDT$/, '')}</span>
                      {/* 方向：做多/做空 */}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        position.direction === 'long'
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-red-400/10 text-red-400'
                      }`}>
                        {position.direction === 'long' ? t('long') : t('short')}
                      </span>
                      {/* 保证金模式 */}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#1E1E2E] text-[#9090A0]">
                        {position.marginMode === 'isolated' ? t('isolated') : t('cross')}
                      </span>
                      {/* 杠杆 */}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-400/10 text-yellow-400">
                        {position.leverage || 1}X
                      </span>
                    </div>
                  </div>

                  {/* 策略来源 */}
                  <div className="flex items-center gap-1 text-[10px] text-[#606070] mb-3">
                    <Zap className="w-2.5 h-2.5 text-[#06B6D4]" />
                    <span>{position.strategy}</span>
                  </div>

                  {/* 盈亏区域 - 突出显示 */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-[10px] text-[#606070] mb-0.5">{t('unrealizedPnlLabel')}</p>
                      <p className={`text-lg font-bold ${position.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.unrealizedPnl >= 0 ? '+' : ''}{position.unrealizedPnl.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#606070] mb-0.5">{t('investmentReturn')}</p>
                      <p className={`text-lg font-bold ${position.roe >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.roe >= 0 ? '+' : ''}{position.roe.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* 数据行 */}
                  <div className="space-y-2 text-[11px] mb-3 bg-[#0A0A0F]/50 rounded-lg p-2">
                    {/* 第一行：持仓数量 | 保证金 | 保证金比率 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[#606070]">{t('positionAmount')}</p>
                        <p className="font-medium">{position.size}</p>
                      </div>
                      <div>
                        <p className="text-[#606070]">{t('marginAmount')}</p>
                        <p className="font-medium">{position.margin && position.margin > 0 ? position.margin.toFixed(2) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-[#606070]">{t('marginRatio')}</p>
                        <p className="font-medium text-cyan-400">
                          {position.margin && position.margin > 0 && position.markPrice > 0
                            ? ((position.margin / (position.size * position.markPrice)) * 100).toFixed(2) + '%'
                            : '-'}
                        </p>
                      </div>
                    </div>
                    {/* 第二行：开仓价格 | 标记价格 | 强平价格 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[#606070]">{t('entryPriceLabel')}</p>
                        <p className="font-medium">{position.entryPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[#606070]">{t('markPriceLabel')}</p>
                        <p className="font-medium">{position.markPrice.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-[#606070]">{t('liquidationPriceLabel')}</p>
                        <p className="font-medium text-yellow-400">
                          {position.liquidationPrice > 0 ? position.liquidationPrice.toFixed(4) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 平仓按钮 */}
                  <button
                    type="button"
                    onClick={() => onClosePosition?.(position.id)}
                    className="w-full py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium"
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
                  {/* 头部：币对 + 方向 + 杠杆 + 平仓原因 + 盈亏 */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{order.symbol.replace(/:USDT$/, '')}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        order.side === 'long'
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-red-400/10 text-red-400'
                      }`}>
                        {order.side === 'long' ? '做多' : '做空'}
                      </span>
                      {order.leverage > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-400/10 text-yellow-400 font-medium">
                          {order.leverage}x
                        </span>
                      )}
                      {order.closeReason && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1E1E2E] text-[#9090A0]">
                          {order.closeReason === 'signal' ? '信号平仓' :
                           order.closeReason === 'stop_loss' ? '止损' :
                           order.closeReason === 'take_profit' ? '止盈' :
                           order.closeReason === 'trailing_stop' ? '移动止损' :
                           order.closeReason === 'manual' ? '手动平仓' :
                           order.closeReason === 'manual_cleanup' ? '手动清仓' :
                           order.closeReason === 'black_swan' ? '黑天鹅保护' :
                           order.closeReason === 'daily_loss_limit' ? '日亏损限额' :
                           order.closeReason}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${order.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {order.pnl >= 0 ? '+' : ''}{order.pnl.toFixed(2)} USDT
                      </p>
                      {order.pnlPercent !== 0 && (
                        <p className={`text-[10px] ${order.pnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                          {order.pnlPercent >= 0 ? '+' : ''}{order.pnlPercent.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 数据行：标签在上，数值在下 */}
                  <div className="text-[11px] bg-[#0A0A0F]/50 rounded-lg px-2.5 py-2 space-y-2">
                    {/* 第一行：4列 */}
                    <div className="grid grid-cols-4 gap-1">
                      <div>
                        <p className="text-[#606070] mb-0.5">开仓价格</p>
                        <p className="font-medium">{order.entryPrice.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[#606070] mb-0.5">平仓均价</p>
                        <p className="font-medium">{order.closePrice.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[#606070] mb-0.5">持仓量</p>
                        <p className="font-medium">{order.amount}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#606070] mb-0.5">保证金</p>
                        <p className="font-medium">{order.margin > 0 ? `${order.margin.toFixed(2)}` : '-'}</p>
                      </div>
                    </div>
                    {/* 第二行：时间 左右各占一半 */}
                    <div className="flex">
                      <div className="flex-1">
                        <p className="text-[#606070] mb-0.5">开仓时间</p>
                        <p className="text-[#9090A0]">{order.openTime ? new Date(order.openTime).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</p>
                      </div>
                      <div className="flex-1 text-right">
                        <p className="text-[#606070] mb-0.5">全部平仓时间</p>
                        <p className="text-[#9090A0]">{order.time ? new Date(order.time).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</p>
                      </div>
                    </div>
                    {/* 策略名 右对齐 */}
                    {order.strategyName && (
                      <div className="text-right">
                        <span className="text-cyan-400 text-[10px]">{order.strategyName}</span>
                      </div>
                    )}
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
                        <span className="text-xs text-[#606070]">{log.symbol.replace(/:USDT$/, '')}</span>
                      </div>
                      <p className="text-xs text-[#9090A0] mb-1">{log.message}</p>
                      {/* 增强执行详情 */}
                      {(log.executedPrice || log.slippage || log.durationMs || log.skipReason) && (
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {log.executedPrice && (
                            <span className="text-xs text-[#94A3B8]">
                              成交 <span className="text-[#F8F8FC]">{parseFloat(log.executedPrice).toFixed(2)}</span>
                            </span>
                          )}
                          {log.slippage && (
                            <span className={`text-xs ${parseFloat(log.slippage) > 0.5 ? 'text-yellow-400' : 'text-[#94A3B8]'}`}>
                              滑点 {parseFloat(log.slippage).toFixed(3)}%
                            </span>
                          )}
                          {log.durationMs != null && (
                            <span className="text-xs text-[#94A3B8]">
                              {log.durationMs < 1000 ? `${log.durationMs}ms` : `${(log.durationMs / 1000).toFixed(1)}s`}
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
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#606070]" />
                        <span className="text-xs text-[#606070]">{log.time ? new Date(log.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
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
                  <div key={strategy.id} className="bg-[#0A0A0F]/50 border border-[#1E1E2E]/50 rounded-lg p-3">
                    {/* 头部：策略名 + 状态标签 */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        strategy.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                      }`} />
                      <h3 className="font-medium text-sm truncate">{strategy.name}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                        strategy.status === 'running'
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-yellow-400/10 text-yellow-400'
                      }`}>
                        {strategy.status === 'running' ? t('runningStatus') : t('pausedStatus')}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${strategyTypeColors[strategy.type]}`}>
                        {getStrategyTypeLabel(strategy.type, t)}
                      </span>
                    </div>

                    {/* 参数 - 两行三列 */}
                    <div className="space-y-1.5 text-xs mb-2.5">
                      {/* 第一行：交易所 + 单笔金额 + 杠杆 */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <p className="text-[#606070] text-[10px]">{strategy.exchange}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[#606070] text-[10px]">{t('amountPerTradeLabel')}</p>
                          <p className="font-medium text-cyan-400">
                            {strategy.config.amountPerTrade ? `$${strategy.config.amountPerTrade}` : '-'}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[#606070] text-[10px]">{t('leverage')}</p>
                          <p className="font-medium">{strategy.config.leverage}x</p>
                        </div>
                      </div>
                      {/* 第二行：持仓 + 止损 + 止盈 */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <p className="text-[#606070] text-[10px]">{t('positionSize')}</p>
                          <p className="font-medium">{strategy.config.positionSize}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[#606070] text-[10px]">{t('stopLoss')}</p>
                          <p className="font-medium text-red-400">{strategy.config.stopLoss}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[#606070] text-[10px]">{t('takeProfit')}</p>
                          <p className="font-medium text-green-400">{strategy.config.takeProfit}%</p>
                        </div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditStrategy?.(strategy.id)}
                        className="p-2 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
                        title={t('editStrategy')}
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteStrategy?.(strategy.id)}
                        className="p-2 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-[#9090A0] hover:text-red-400 transition-colors"
                        title={t('deleteStrategy')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStrategy?.(strategy.id, strategy.status === 'running' ? 'paused' : 'running')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${
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
