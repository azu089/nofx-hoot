'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  ChevronDown,
  TrendingUp,
  Filter,
  Flame,
  Sparkles,
  Crown,
  Eye,
  Play
} from 'lucide-react'

interface Strategy {
  id: string
  name: string
  type: string  // 定投/网格/AI信号/套利
  creator: string
  winRate: number
  totalReturn: number
  riskLevel: '低' | '中' | '高'
  subscribers: number
  badges: ('Hot' | 'New' | 'Pro')[]
  isFree: boolean
}

interface MobileStrategiesV3Props {
  strategies?: Strategy[]
  onStrategyClick?: (id: string) => void
  onUseStrategy?: (id: string) => void
  onNavigate?: (tab: string) => void
  onCreateStrategy?: () => void
}

const mockStrategies: Strategy[] = [
  {
    id: '1',
    name: 'DCA Bot Pro',
    type: '定投',
    creator: 'CryptoMaster',
    winRate: 87.5,
    totalReturn: 156.8,
    riskLevel: '低',
    subscribers: 2847,
    badges: ['Hot', 'Pro'],
    isFree: true
  },
  {
    id: '2',
    name: 'Grid Trading Master',
    type: '网格',
    creator: 'GridKing',
    winRate: 73.2,
    totalReturn: 89.4,
    riskLevel: '中',
    subscribers: 1523,
    badges: ['Pro'],
    isFree: true
  },
  {
    id: '3',
    name: 'AI Signal Hunter',
    type: 'AI信号',
    creator: 'AITrader',
    winRate: 91.3,
    totalReturn: 234.7,
    riskLevel: '高',
    subscribers: 892,
    badges: ['New', 'Hot'],
    isFree: true
  },
  {
    id: '4',
    name: 'Arbitrage Eagle',
    type: '套利',
    creator: 'ArbiMaster',
    winRate: 95.1,
    totalReturn: 67.3,
    riskLevel: '低',
    subscribers: 3241,
    badges: ['Pro'],
    isFree: true
  },
  {
    id: '5',
    name: 'Smart Grid Pro',
    type: '网格',
    creator: 'GridExpert',
    winRate: 78.9,
    totalReturn: 112.5,
    riskLevel: '中',
    subscribers: 1876,
    badges: ['Hot'],
    isFree: true
  },
  {
    id: '6',
    name: 'DCA Steady Growth',
    type: '定投',
    creator: 'SteadyTrader',
    winRate: 82.4,
    totalReturn: 98.7,
    riskLevel: '低',
    subscribers: 2156,
    badges: [],
    isFree: true
  }
]

const filterOptions = ['全部', '定投', '网格', 'AI信号', '套利']
const sortOptions = ['热门', '胜率', '收益', '最新']

export function MobileStrategiesV3({
  strategies = mockStrategies,
  onStrategyClick,
  onUseStrategy,
  onNavigate: _onNavigate,
  onCreateStrategy
}: MobileStrategiesV3Props) {
  void _onNavigate
  const [selectedFilter, setSelectedFilter] = useState('全部')
  const [selectedSort, setSelectedSort] = useState('热门')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const getBadgeIcon = (badge: string) => {
    switch (badge) {
      case 'Hot':
        return <Flame className="w-3 h-3" />
      case 'New':
        return <Sparkles className="w-3 h-3" />
      case 'Pro':
        return <Crown className="w-3 h-3" />
      default:
        return null
    }
  }

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'Hot':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'New':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'Pro':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return ''
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case '低':
        return 'text-green-400'
      case '中':
        return 'text-yellow-400'
      case '高':
        return 'text-red-400'
      default:
        return 'text-[#9090A0]'
    }
  }

  const filteredStrategies = strategies.filter(strategy => {
    const matchesFilter = selectedFilter === '全部' || strategy.type === selectedFilter
    const matchesSearch = strategy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         strategy.creator.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Search Overlay
  if (showSearch) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0F] z-50">
        <div className="flex items-center gap-3 p-4 border-b border-[#1E1E2E]">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
            <input
              type="text"
              placeholder="输入关键词搜索策略"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-[#06B6D4]"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={() => setShowSearch(false)}
            className="text-[#06B6D4] font-medium"
          >
            取消
          </button>
        </div>

        <div className="p-4">
          {searchQuery ? (
            <div className="space-y-3">
              {filteredStrategies.map((strategy) => (
                <div
                  key={strategy.id}
                  onClick={() => {
                    onStrategyClick?.(strategy.id)
                    setShowSearch(false)
                  }}
                  className="p-4 backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[#F8F8FC] font-medium">{strategy.name}</h3>
                    <div className="flex gap-1">
                      {strategy.badges.map((badge) => (
                        <div
                          key={badge}
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getBadgeColor(badge)}`}
                        >
                          {getBadgeIcon(badge)}
                          {badge}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#9090A0]">
                    <span className="px-2 py-1 bg-[#12121A]/50 border border-[#1E1E2E] rounded-lg">
                      {strategy.type}
                    </span>
                    <span>by {strategy.creator}</span>
                  </div>
                </div>
              ))}
              {filteredStrategies.length === 0 && (
                <div className="text-center text-[#606070] py-8">
                  未找到匹配的策略
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-[#606070] py-12">
              输入关键词搜索策略
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-bold text-[#F8F8FC]">策略</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-xl bg-[#12121A]/50 border border-[#1E1E2E] text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
              aria-label="搜索"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onCreateStrategy}
              className="flex items-center gap-2 px-4 py-2 bg-[#06B6D4] text-black font-medium rounded-xl hover:bg-[#06B6D4]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              创建
            </button>
          </div>
        </div>
      </div>

      {/* Filter + Sort Dropdowns */}
      <div className="p-4 border-b border-[#1E1E2E]">
        <div className="flex items-center gap-3">
          {/* Filter Dropdown */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => {
                setShowFilterDropdown(!showFilterDropdown)
                setShowSortDropdown(false)
              }}
              className="flex items-center justify-between gap-2 w-full px-3 py-2.5 bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#9090A0]" />
                <span className={selectedFilter === '全部' ? 'text-[#9090A0]' : 'text-[#F8F8FC]'}>
                  {selectedFilter}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#9090A0] transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showFilterDropdown && (
              <div className="absolute left-0 top-full mt-2 w-full backdrop-blur-xl bg-[#12121A]/95 border border-[#1E1E2E] rounded-xl overflow-hidden z-20">
                {filterOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSelectedFilter(option)
                      setShowFilterDropdown(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      selectedFilter === option
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'text-[#9090A0] hover:text-[#F8F8FC] hover:bg-[#1E1E2E]/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => {
                setShowSortDropdown(!showSortDropdown)
                setShowFilterDropdown(false)
              }}
              className="flex items-center justify-between gap-2 w-full px-3 py-2.5 bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#9090A0]" />
                <span className="text-[#F8F8FC]">{selectedSort}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#9090A0] transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showSortDropdown && (
              <div className="absolute left-0 top-full mt-2 w-full backdrop-blur-xl bg-[#12121A]/95 border border-[#1E1E2E] rounded-xl overflow-hidden z-20">
                {sortOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSelectedSort(option)
                      setShowSortDropdown(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      selectedSort === option
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'text-[#9090A0] hover:text-[#F8F8FC] hover:bg-[#1E1E2E]/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="p-4 space-y-4 pb-24">
        {filteredStrategies.map((strategy) => (
          <div
            key={strategy.id}
            className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4 space-y-3"
          >
            {/* Row 1: Name + Badges */}
            <div className="flex items-center justify-between">
              <h3 className="text-[#F8F8FC] font-medium flex-1 mr-3">{strategy.name}</h3>
              <div className="flex gap-1">
                {strategy.badges.map((badge) => (
                  <div
                    key={badge}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getBadgeColor(badge)}`}
                  >
                    {getBadgeIcon(badge)}
                    {badge}
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2: Type + Creator */}
            <div className="flex items-center gap-2 text-sm text-[#9090A0]">
              <span className="px-2 py-1 bg-[#12121A]/50 border border-[#1E1E2E] rounded-lg">
                {strategy.type}
              </span>
              <span>by {strategy.creator}</span>
            </div>

            {/* Row 3: Stats Grid (4 columns matching desktop) */}
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div className="text-center">
                <div className="text-[#606070] text-xs mb-1">胜率</div>
                <div className="text-[#F8F8FC] font-medium">{strategy.winRate}%</div>
              </div>
              <div className="text-center">
                <div className="text-[#606070] text-xs mb-1">总收益</div>
                <div className="text-green-400 font-medium">+{strategy.totalReturn}%</div>
              </div>
              <div className="text-center">
                <div className="text-[#606070] text-xs mb-1">风险</div>
                <div className={`font-medium ${getRiskColor(strategy.riskLevel)}`}>
                  {strategy.riskLevel}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[#606070] text-xs mb-1">使用</div>
                <div className="text-[#F8F8FC] font-medium">
                  {strategy.subscribers.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Row 4: Action Buttons (matching desktop) */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onStrategyClick?.(strategy.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] rounded-xl text-[#F8F8FC] text-sm font-medium transition-colors"
              >
                <Eye className="w-4 h-4" />
                详情
              </button>
              <button
                type="button"
                onClick={() => onUseStrategy?.(strategy.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 rounded-xl text-black text-sm font-semibold transition-colors"
              >
                <Play className="w-4 h-4" />
                立即使用
              </button>
            </div>
          </div>
        ))}

        {filteredStrategies.length === 0 && (
          <div className="text-center text-[#606070] py-12">
            暂无策略
          </div>
        )}

        {/* Load More Button */}
        {filteredStrategies.length > 0 && (
          <button
            type="button"
            className="w-full py-3 backdrop-blur-xl bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-[#9090A0] text-sm font-medium hover:text-[#F8F8FC] transition-colors"
          >
            加载更多
          </button>
        )}
      </div>
    </div>
  )
}
