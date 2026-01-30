'use client'

import { useState } from 'react'
import {
  Search,
  Filter,
  TrendingUp,
  ChevronDown,
  Plus
} from 'lucide-react'

interface Strategy {
  id: string
  name: string
  type: 'DCA' | 'Grid' | 'Arbitrage' | 'AI Signal'
  marketType: '现货' | '合约'  // 现货或合约
  creator: string
  winRate: number
  totalReturn: number
  riskLevel: 'low' | 'medium' | 'high'
  subscribers: number
  badges: ('热门' | '最新' | '专业版')[]
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
    marketType: '现货',
    creator: 'CryptoMaster',
    winRate: 87.5,
    totalReturn: 156.8,
    riskLevel: 'low',
    subscribers: 2847,
    badges: ['热门', '专业版'],
    isHot: true
  },
  {
    id: '2',
    name: 'Grid Trading Master',
    type: 'Grid',
    marketType: '合约',
    creator: 'GridKing',
    winRate: 73.2,
    totalReturn: 89.4,
    riskLevel: 'medium',
    subscribers: 1523,
    badges: ['专业版'],
    isHot: false
  },
  {
    id: '3',
    name: 'AI Signal Hunter',
    type: 'AI Signal',
    marketType: '合约',
    creator: 'AITrader',
    winRate: 91.3,
    totalReturn: 234.7,
    riskLevel: 'high',
    subscribers: 892,
    badges: ['最新', '热门'],
    isHot: true
  },
  {
    id: '4',
    name: 'Arbitrage Eagle',
    type: 'Arbitrage',
    marketType: '现货',
    creator: 'ArbiMaster',
    winRate: 95.1,
    totalReturn: 67.3,
    riskLevel: 'low',
    subscribers: 3241,
    badges: ['专业版'],
    isHot: false
  },
  {
    id: '5',
    name: 'Smart Grid Pro',
    type: 'Grid',
    marketType: '现货',
    creator: 'GridExpert',
    winRate: 78.9,
    totalReturn: 112.5,
    riskLevel: 'medium',
    subscribers: 1876,
    badges: ['热门'],
    isHot: true
  },
  {
    id: '6',
    name: 'DCA Steady Growth',
    type: 'DCA',
    marketType: '合约',
    creator: 'SteadyTrader',
    winRate: 82.4,
    totalReturn: 98.7,
    riskLevel: 'low',
    subscribers: 2156,
    badges: [],
    isHot: false
  }
]

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

const typeText: Record<string, string> = {
  'DCA': '定投',
  'Grid': '网格',
  'Arbitrage': '套利',
  'AI Signal': 'AI信号'
}

export function StrategyMarketplaceV3({
  strategies = mockStrategies,
  onStrategyClick,
  onSubscribe: _onSubscribe,
  onConfigureStrategy,
  onNavigate,
  onSearch,
  onFilterChange,
  onCreateStrategy
}: StrategyMarketplaceV3Props) {
  void _onSubscribe
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('全部')
  const [selectedMarketType, setSelectedMarketType] = useState('全部')
  const [selectedSort, setSelectedSort] = useState('热门')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showMarketTypeDropdown, setShowMarketTypeDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const filterOptions = ['全部', '定投', '网格', 'AI信号', '套利']
  const marketTypeOptions = ['全部', '现货', '合约']
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

  const handleMarketTypeSelect = (marketType: string) => {
    setSelectedMarketType(marketType)
    setShowMarketTypeDropdown(false)
  }

  const handleSortSelect = (sort: string) => {
    setSelectedSort(sort)
    setShowSortDropdown(false)
  }

  // 筛选策略
  const filteredStrategies = strategies.filter(strategy => {
    const matchesSearch = strategy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         strategy.creator.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = selectedFilter === '全部' || typeText[strategy.type] === selectedFilter
    const matchesMarketType = selectedMarketType === '全部' || strategy.marketType === selectedMarketType
    return matchesSearch && matchesFilter && matchesMarketType
  })

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

              {/* Filter Dropdown - 策略类型 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowFilterDropdown(!showFilterDropdown)
                    setShowMarketTypeDropdown(false)
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

              {/* Market Type Dropdown - 现货/合约 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowMarketTypeDropdown(!showMarketTypeDropdown)
                    setShowFilterDropdown(false)
                    setShowSortDropdown(false)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-lg text-sm hover:border-[#2A2A3A] transition-all ${
                    selectedMarketType === '现货' ? 'text-blue-400' : selectedMarketType === '合约' ? 'text-orange-400' : 'text-[#F8F8FC]'
                  }`}
                >
                  {selectedMarketType === '全部' ? '市场' : selectedMarketType}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showMarketTypeDropdown && (
                  <div className="absolute top-full mt-2 right-0 w-32 bg-[#12121A]/95 backdrop-blur-xl border border-[#1E1E2E] rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.05)] z-10 overflow-hidden">
                    {marketTypeOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleMarketTypeSelect(option)}
                        className={`w-full px-4 py-2.5 text-left text-sm text-[#F8F8FC] hover:bg-[#1E1E2E] transition-colors ${
                          selectedMarketType === option ? 'bg-[#1E1E2E] text-cyan-400' : ''
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
                    setShowMarketTypeDropdown(false)
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

        {/* Strategy Cards Grid - 极简流畅风格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {filteredStrategies.map((strategy) => (
            <div
              key={strategy.id}
              className="relative bg-[#12121A]/60 backdrop-blur-xl rounded-2xl p-5 hover:bg-[#12121A]/80 transition-all duration-200 cursor-pointer group"
              onClick={() => onStrategyClick?.(strategy.id)}
            >
              {/* 顶部：类型 + 徽章指示器 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-[#606070]">
                  <span>{typeText[strategy.type]}</span>
                  <span>·</span>
                  <span className={strategy.marketType === '现货' ? 'text-blue-400' : 'text-orange-400'}>
                    {strategy.marketType}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {strategy.badges.includes('热门') && (
                    <span className="w-2 h-2 rounded-full bg-red-500" title="热门" />
                  )}
                  {strategy.badges.includes('最新') && (
                    <span className="w-2 h-2 rounded-full bg-green-500" title="最新" />
                  )}
                  {strategy.badges.includes('专业版') && (
                    <span className="w-2 h-2 rounded-full bg-purple-500" title="专业版" />
                  )}
                </div>
              </div>

              {/* 策略名称 */}
              <h3 className="text-[#F8F8FC] font-semibold text-lg mb-1 group-hover:text-cyan-400 transition-colors">
                {strategy.name}
              </h3>

              {/* 作者 */}
              <p className="text-[#606070] text-sm mb-5">by {strategy.creator}</p>

              {/* 核心数据 */}
              <div className="flex items-end justify-between mb-4">
                {/* 收益率 - 突出显示 */}
                <div>
                  <div className="text-green-400 text-3xl font-bold">+{strategy.totalReturn}%</div>
                  <div className="text-[#606070] text-xs mt-1">总收益</div>
                </div>

                {/* 其他指标 */}
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <div className="text-[#F8F8FC] font-semibold">{strategy.winRate}%</div>
                    <div className="text-[#606070] text-xs">胜率</div>
                  </div>
                  <div>
                    <div className={`font-semibold ${riskLevelColors[strategy.riskLevel]}`}>
                      {riskLevelText[strategy.riskLevel]}
                    </div>
                    <div className="text-[#606070] text-xs">风险</div>
                  </div>
                  <div>
                    <div className="text-[#F8F8FC] font-semibold">{strategy.subscribers.toLocaleString()}</div>
                    <div className="text-[#606070] text-xs">使用</div>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onNavigate?.(`/strategies/config?strategyId=${strategy.id}`)
                  onConfigureStrategy?.(strategy.id)
                }}
                className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl text-cyan-400 text-sm font-medium transition-all"
              >
                立即使用
              </button>
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
