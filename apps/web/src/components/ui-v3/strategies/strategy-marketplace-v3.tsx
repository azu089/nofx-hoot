'use client'

import { useState } from 'react'
import {
  Search,
  Filter,
  TrendingUp,
  ChevronDown,
  Settings,
  Plus,
  Eye,
  Users
} from 'lucide-react'

interface Strategy {
  id: string
  name: string
  type: 'DCA' | 'Grid' | 'Arbitrage' | 'AI Signal'
  creator: string
  winRate: number
  totalReturn: number
  riskLevel: 'low' | 'medium' | 'high'
  subscribers: number
  badges: ('Hot' | 'New' | 'Pro')[]
  isHot: boolean
}

interface StrategyMarketplaceV3Props {
  strategies?: Strategy[]
  onStrategyClick?: (id: string) => void
  onSubscribe?: (id: string) => void
  onConfigureStrategy?: (id: string) => void
  onNavigate?: (path: string) => void
  onSearch?: (query: string) => void
  onFilterChange?: (filter: string) => void
  onCreateStrategy?: () => void
}

const mockStrategies: Strategy[] = [
  {
    id: '1',
    name: 'DCA Bot Pro',
    type: 'DCA',
    creator: 'CryptoMaster',
    winRate: 87.5,
    totalReturn: 156.8,
    riskLevel: 'low',
    subscribers: 2847,
    badges: ['Hot', 'Pro'],
    isHot: true
  },
  {
    id: '2',
    name: 'Grid Trading Master',
    type: 'Grid',
    creator: 'GridKing',
    winRate: 73.2,
    totalReturn: 89.4,
    riskLevel: 'medium',
    subscribers: 1523,
    badges: ['Pro'],
    isHot: false
  },
  {
    id: '3',
    name: 'AI Signal Hunter',
    type: 'AI Signal',
    creator: 'AITrader',
    winRate: 91.3,
    totalReturn: 234.7,
    riskLevel: 'high',
    subscribers: 892,
    badges: ['New', 'Hot'],
    isHot: true
  },
  {
    id: '4',
    name: 'Arbitrage Eagle',
    type: 'Arbitrage',
    creator: 'ArbiMaster',
    winRate: 95.1,
    totalReturn: 67.3,
    riskLevel: 'low',
    subscribers: 3241,
    badges: ['Pro'],
    isHot: false
  },
  {
    id: '5',
    name: 'Smart Grid Pro',
    type: 'Grid',
    creator: 'GridExpert',
    winRate: 78.9,
    totalReturn: 112.5,
    riskLevel: 'medium',
    subscribers: 1876,
    badges: ['Hot'],
    isHot: true
  },
  {
    id: '6',
    name: 'DCA Steady Growth',
    type: 'DCA',
    creator: 'SteadyTrader',
    winRate: 82.4,
    totalReturn: 98.7,
    riskLevel: 'low',
    subscribers: 2156,
    badges: [],
    isHot: false
  }
]

const typeColors: Record<string, string> = {
  'DCA': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Grid': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Arbitrage': 'bg-green-500/20 text-green-400 border-green-500/30',
  'AI Signal': 'bg-orange-500/20 text-orange-400 border-orange-500/30'
}

const riskLevelColors: Record<string, string> = {
  'low': 'text-green-400',
  'medium': 'text-yellow-400',
  'high': 'text-red-400'
}

const riskLevelText: Record<string, string> = {
  'low': '低',
  'medium': '中',
  'high': '高'
}

const badgeStyles: Record<string, string> = {
  'Hot': 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
  'New': 'bg-gradient-to-r from-green-500 to-emerald-500 text-white',
  'Pro': 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white'
}

const typeText: Record<string, string> = {
  'DCA': '定投',
  'Grid': '网格',
  'Arbitrage': '套利',
  'AI Signal': 'AI信号'
}

export function StrategyMarketplaceV3({
  strategies = mockStrategies,
  onStrategyClick,
  onSubscribe,
  onConfigureStrategy,
  onNavigate,
  onSearch,
  onFilterChange,
  onCreateStrategy
}: StrategyMarketplaceV3Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('全部')
  const [selectedSort, setSelectedSort] = useState('热门')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const filterOptions = ['全部', '定投', '网格', '套利', 'AI信号']
  const sortOptions = ['热门', '胜率', '收益', '最新']

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    onSearch?.(query)
  }

  const handleFilterSelect = (filter: string) => {
    setSelectedFilter(filter)
    setShowFilterDropdown(false)
    onFilterChange?.(filter)
  }

  const handleSortSelect = (sort: string) => {
    setSelectedSort(sort)
    setShowSortDropdown(false)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[#F8F8FC]">策略</h1>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#606070] w-5 h-5" />
                <input
                  type="text"
                  placeholder="搜索策略..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-lg text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-[#06B6D4] focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm"
                />
              </div>

              {/* Filter Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowFilterDropdown(!showFilterDropdown)
                    setShowSortDropdown(false)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-lg text-sm text-[#F8F8FC] hover:border-[#2A2A3A] transition-all"
                >
                  <Filter className="w-4 h-4" />
                  {selectedFilter}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showFilterDropdown && (
                  <div className="absolute top-full mt-2 right-0 w-40 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.05)] z-10 overflow-hidden">
                    {filterOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleFilterSelect(option)}
                        className={`w-full px-4 py-2.5 text-left text-sm text-[#F8F8FC] hover:bg-[#1E1E2E] transition-colors ${
                          selectedFilter === option ? 'bg-[#1E1E2E] text-cyan-400' : ''
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSortDropdown(!showSortDropdown)
                    setShowFilterDropdown(false)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-lg text-sm text-[#F8F8FC] hover:border-[#2A2A3A] transition-all"
                >
                  <TrendingUp className="w-4 h-4" />
                  {selectedSort}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showSortDropdown && (
                  <div className="absolute top-full mt-2 right-0 w-32 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.05)] z-10 overflow-hidden">
                    {sortOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleSortSelect(option)}
                        className={`w-full px-4 py-2.5 text-left text-sm text-[#F8F8FC] hover:bg-[#1E1E2E] transition-colors ${
                          selectedSort === option ? 'bg-[#1E1E2E] text-cyan-400' : ''
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Create Strategy Button */}
              <button
                type="button"
                onClick={onCreateStrategy}
                className="flex items-center gap-2 px-4 py-2 bg-[#06B6D4] hover:bg-[#0891B2] rounded-lg text-sm text-white font-medium transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]"
              >
                <Plus className="w-4 h-4" />
                创建策略
              </button>
            </div>
        </div>

        {/* Strategy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] hover:border-cyan-500/20 transition-all cursor-pointer group overflow-hidden"
              onClick={() => onStrategyClick?.(strategy.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-[#F8F8FC] group-hover:text-[#06B6D4] transition-colors">
                      {strategy.name}
                    </h3>
                    {strategy.badges.map((badge) => (
                      <span
                        key={badge}
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeStyles[badge]}`}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-md border ${typeColors[strategy.type]}`}>
                      {typeText[strategy.type]}
                    </span>
                    <span className="text-[#9090A0] text-sm">by {strategy.creator}</span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-[#606070] text-xs mb-1">胜率</div>
                  <div className="text-[#F8F8FC] font-semibold">{strategy.winRate}%</div>
                </div>
                <div>
                  <div className="text-[#606070] text-xs mb-1">总收益</div>
                  <div className="text-green-400 font-semibold">+{strategy.totalReturn}%</div>
                </div>
                <div>
                  <div className="text-[#606070] text-xs mb-1">风险</div>
                  <div className={`font-semibold ${riskLevelColors[strategy.riskLevel]}`}>
                    {riskLevelText[strategy.riskLevel]}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1E1E2E]">
                {/* 订阅人数 */}
                <div className="flex items-center gap-2 text-[#9090A0]">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{strategy.subscribers.toLocaleString()} 人使用</span>
                </div>

                {/* 按钮组 */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStrategyClick?.(strategy.id)
                    }}
                    className="px-3 py-1.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] hover:border-[#3A3A4A] text-[#F8F8FC] text-sm font-medium rounded-lg transition-all flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    详情
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate?.(`/strategies/config?strategyId=${strategy.id}`)
                      onConfigureStrategy?.(strategy.id)
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black text-sm font-semibold rounded-lg hover:from-cyan-400 hover:to-cyan-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    配置
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        <div className="text-center">
          <button
            type="button"
            className="px-8 py-3 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-xl text-[#F8F8FC] hover:border-[#06B6D4] hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all"
          >
            加载更多
          </button>
        </div>
      </div>
    </div>
  )
}
