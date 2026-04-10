'use client'

import { useState } from 'react'
import {
  History,
  Filter,
  Calendar,
  Download,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
// Sidebar 已随旧 dashboard 组件删除

interface Trade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  price: number
  amount: number
  total: number
  fee: number
  pnl?: number
  pnlPercent?: number
  strategy: string
  exchange: string
  status: 'filled' | 'cancelled' | 'pending'
  time: string
}

interface TradingHistoryProps {
  trades?: Trade[]
  stats?: {
    totalTrades: number
    winRate: number
    totalPnl: number
    avgPnl: number
  }
  onExport?: () => void
  onFilter?: (filters: Record<string, unknown>) => void
}

const defaultTrades: Trade[] = [
  {
    id: '1',
    symbol: 'BTC/USDT',
    side: 'buy',
    type: 'market',
    price: 65420.50,
    amount: 0.0152,
    total: 994.39,
    fee: 0.99,
    strategy: 'RSI 抄底策略',
    exchange: 'Binance',
    status: 'filled',
    time: '2026-01-29 14:32:15'
  },
  {
    id: '2',
    symbol: 'BTC/USDT',
    side: 'sell',
    type: 'market',
    price: 67850.00,
    amount: 0.0152,
    total: 1031.32,
    fee: 1.03,
    pnl: 34.90,
    pnlPercent: 3.51,
    strategy: 'RSI 抄底策略',
    exchange: 'Binance',
    status: 'filled',
    time: '2026-01-29 16:45:22'
  },
  {
    id: '3',
    symbol: 'ETH/USDT',
    side: 'buy',
    type: 'market',
    price: 3245.80,
    amount: 0.31,
    total: 1006.20,
    fee: 1.01,
    strategy: '网格交易',
    exchange: 'Binance',
    status: 'filled',
    time: '2026-01-29 12:15:08'
  },
  {
    id: '4',
    symbol: 'ETH/USDT',
    side: 'sell',
    type: 'limit',
    price: 3180.00,
    amount: 0.31,
    total: 985.80,
    fee: 0.99,
    pnl: -21.41,
    pnlPercent: -2.13,
    strategy: '网格交易',
    exchange: 'Binance',
    status: 'filled',
    time: '2026-01-29 18:22:33'
  },
  {
    id: '5',
    symbol: 'SOL/USDT',
    side: 'buy',
    type: 'market',
    price: 98.45,
    amount: 10.2,
    total: 1004.19,
    fee: 1.00,
    strategy: '趋势跟踪',
    exchange: 'OKX',
    status: 'filled',
    time: '2026-01-28 09:45:00'
  },
  {
    id: '6',
    symbol: 'SOL/USDT',
    side: 'sell',
    type: 'market',
    price: 102.30,
    amount: 10.2,
    total: 1043.46,
    fee: 1.04,
    pnl: 37.23,
    pnlPercent: 3.71,
    strategy: '趋势跟踪',
    exchange: 'OKX',
    status: 'filled',
    time: '2026-01-28 15:30:18'
  },
]

const defaultStats = {
  totalTrades: 156,
  winRate: 62.5,
  totalPnl: 1234.56,
  avgPnl: 7.91
}

export function TradingHistory({
  trades = defaultTrades,
  stats = defaultStats,
  onExport,
  onFilter: _onFilter
}: TradingHistoryProps) {
  void _onFilter
  const [activeFilter, setActiveFilter] = useState<'all' | 'buy' | 'sell'>('all')
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState('7d')

  const filteredTrades = trades.filter(trade => {
    if (activeFilter !== 'all' && trade.side !== activeFilter) return false
    if (searchQuery && !trade.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'filled':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans">
      <div className="flex">
        {/* Sidebar 已删除 */}

        {/* Main Content */}
        <main className="flex-1 p-6 ml-60">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <History className="w-7 h-7 text-[#06B6D4]" />
                交易历史
              </h1>
              <p className="text-[#9090A0] text-sm mt-1">查看所有策略的历史交易记录</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="flex items-center gap-2 px-4 py-2 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl text-[#9090A0] hover:text-[#F8F8FC] hover:border-[#2A2A3A] transition-colors"
              >
                <Filter className="w-4 h-4" />
                筛选
              </button>
              <button
                type="button"
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 bg-[#06B6D4] text-black rounded-xl font-medium hover:bg-[#0891B2] transition-colors"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              <div className="text-[#9090A0] text-sm mb-1">总交易次数</div>
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
            </div>
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              <div className="text-[#9090A0] text-sm mb-1">胜率</div>
              <div className="text-2xl font-bold text-green-400">{stats.winRate}%</div>
            </div>
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              <div className="text-[#9090A0] text-sm mb-1">总盈亏</div>
              <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toLocaleString()}
              </div>
            </div>
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
              <div className="text-[#9090A0] text-sm mb-1">平均盈亏</div>
              <div className={`text-2xl font-bold ${stats.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
              <input
                type="text"
                placeholder="搜索交易对..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-[#06B6D4]/50"
              />
            </div>

            {/* Side Filter */}
            <div className="flex gap-1 p-1 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl">
              {[
                { id: 'all', label: '全部' },
                { id: 'buy', label: '买入' },
                { id: 'sell', label: '卖出' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id as typeof activeFilter)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeFilter === filter.id
                      ? 'bg-[#06B6D4] text-black'
                      : 'text-[#9090A0] hover:text-[#F8F8FC]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#606070]" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                aria-label="选择日期范围"
                className="bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl px-3 py-2 text-sm text-[#F8F8FC] focus:outline-none focus:border-[#06B6D4]/50"
              >
                <option value="1d">今天</option>
                <option value="7d">近 7 天</option>
                <option value="30d">近 30 天</option>
                <option value="90d">近 90 天</option>
                <option value="all">全部</option>
              </select>
            </div>

            <button
              type="button"
              className="p-2.5 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl text-[#9090A0] hover:text-[#F8F8FC] hover:border-[#2A2A3A] transition-colors"
              aria-label="刷新"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Trades Table */}
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E1E2E]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#606070] uppercase">时间</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#606070] uppercase">交易对</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#606070] uppercase">方向</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#606070] uppercase">类型</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#606070] uppercase">价格</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#606070] uppercase">数量</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#606070] uppercase">金额</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#606070] uppercase">手续费</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#606070] uppercase">盈亏</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#606070] uppercase">策略</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-[#606070] uppercase">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="border-b border-[#1E1E2E] hover:bg-[#1E1E2E]/50 transition-colors"
                    >
                      <td className="px-4 py-4 text-sm text-[#9090A0]">{trade.time}</td>
                      <td className="px-4 py-4">
                        <span className="font-medium">{trade.symbol}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`flex items-center gap-1 text-sm font-medium ${
                          trade.side === 'buy' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {trade.side === 'buy' ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                          {trade.side === 'buy' ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#9090A0]">
                        {trade.type === 'market' ? '市价' : '限价'}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-sm">
                        ${trade.price.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-sm text-[#9090A0]">
                        {trade.amount}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-sm">
                        ${trade.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-sm text-[#606070]">
                        ${trade.fee.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {trade.pnl !== undefined ? (
                          <div className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            <div className="font-mono text-sm font-medium">
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </div>
                            <div className="text-xs">
                              {trade.pnlPercent !== undefined && (
                                <>({trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%)</>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#606070]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-[#9090A0]">{trade.strategy}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          {getStatusIcon(trade.status)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1E1E2E]">
              <div className="text-sm text-[#606070]">
                显示 {filteredTrades.length} 条记录
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-[#1E1E2E] rounded-lg text-sm text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
                >
                  上一页
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-[#06B6D4] rounded-lg text-sm text-black font-medium"
                >
                  1
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-[#1E1E2E] rounded-lg text-sm text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
                >
                  2
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-[#1E1E2E] rounded-lg text-sm text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
