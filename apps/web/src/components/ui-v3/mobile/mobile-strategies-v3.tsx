'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  ChevronDown,
  TrendingUp,
  Filter
} from 'lucide-react'

interface Strategy {
  id: string
  name: string
  type: string  // 定投/网格/AI信号/套利
  marketType: '现货' | '合约'  // 现货或合约
  creator: string
  winRate: number
  totalReturn: number
  riskLevel: '低' | '中' | '高'
  subscribers: number
  badges: ('热门' | '最新' | '专业版')[]
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
    marketType: '现货',
    creator: 'CryptoMaster',
    winRate: 87.5,
    totalReturn: 156.8,
    riskLevel: '低',
    subscribers: 2847,
    badges: ['热门', '专业版'],
    isFree: true
  },
  {
    id: '2',
    name: 'Grid Trading Master',
    type: '网格',
    marketType: '合约',
    creator: 'GridKing',
    winRate: 73.2,
    totalReturn: 89.4,
    riskLevel: '中',
    subscribers: 1523,
    badges: ['专业版'],
    isFree: true
  },
  {
    id: '3',
    name: 'AI Signal Hunter',
    type: 'AI信号',
    marketType: '合约',
    creator: 'AITrader',
    winRate: 91.3,
    totalReturn: 234.7,
    riskLevel: '高',
    subscribers: 892,
    badges: ['最新', '热门'],
    isFree: true
  },
  {
    id: '4',
    name: 'Arbitrage Eagle',
    type: '套利',
    marketType: '现货',
    creator: 'ArbiMaster',
    winRate: 95.1,
    totalReturn: 67.3,
    riskLevel: '低',
    subscribers: 3241,
    badges: ['专业版'],
    isFree: true
  },
  {
    id: '5',
    name: 'Smart Grid Pro',
    type: '网格',
    marketType: '现货',
    creator: 'GridExpert',
    winRate: 78.9,
    totalReturn: 112.5,
    riskLevel: '中',
    subscribers: 1876,
    badges: ['热门'],
    isFree: true
  },
  {
    id: '6',
    name: 'DCA Steady Growth',
    type: '定投',
    marketType: '合约',
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
const marketTypeOptions = ['全部', '现货', '合约']
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
  const [selectedMarketType, setSelectedMarketType] = useState('全部')
  const [selectedSort, setSelectedSort] = useState('热门')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showMarketTypeDropdown, setShowMarketTypeDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

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
    const matchesMarketType = selectedMarketType === '全部' || strategy.marketType === selectedMarketType
    const matchesSearch = strategy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         strategy.creator.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesMarketType && matchesSearch
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
                  className="relative p-4 bg-[#12121A]/60 backdrop-blur-xl rounded-2xl active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-xs text-[#606070]">
                      <span>{strategy.type}</span>
                      <span>·</span>
                      <span className={strategy.marketType === '现货' ? 'text-blue-400' : 'text-orange-400'}>
                        {strategy.marketType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {strategy.badges.includes('热门') && <span className="w-2 h-2 rounded-full bg-red-500" />}
                      {strategy.badges.includes('最新') && <span className="w-2 h-2 rounded-full bg-green-500" />}
                      {strategy.badges.includes('专业版') && <span className="w-2 h-2 rounded-full bg-purple-500" />}
                    </div>
                  </div>
                  <h3 className="text-[#F8F8FC] font-semibold mb-0.5">{strategy.name}</h3>
                  <p className="text-[#606070] text-xs">by {strategy.creator}</p>
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

      {/* Filter + Market Type + Sort Dropdowns */}
      <div className="p-4 border-b border-[#1E1E2E]">
        <div className="flex items-center gap-2">
          {/* Filter Dropdown - 策略类型 */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => {
                setShowFilterDropdown(!showFilterDropdown)
                setShowMarketTypeDropdown(false)
                setShowSortDropdown(false)
              }}
              className="flex items-center justify-between gap-1 w-full px-2.5 py-2.5 bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-sm transition-colors"
            >
              <div className="flex items-center gap-1.5">
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

          {/* Market Type Dropdown - 现货/合约 */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => {
                setShowMarketTypeDropdown(!showMarketTypeDropdown)
                setShowFilterDropdown(false)
                setShowSortDropdown(false)
              }}
              className="flex items-center justify-between gap-1 w-full px-2.5 py-2.5 bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-sm transition-colors"
            >
              <span className={selectedMarketType === '全部' ? 'text-[#9090A0]' : selectedMarketType === '现货' ? 'text-blue-400' : 'text-orange-400'}>
                {selectedMarketType === '全部' ? '市场' : selectedMarketType}
              </span>
              <ChevronDown className={`w-4 h-4 text-[#9090A0] transition-transform ${showMarketTypeDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showMarketTypeDropdown && (
              <div className="absolute left-0 top-full mt-2 w-full backdrop-blur-xl bg-[#12121A]/95 border border-[#1E1E2E] rounded-xl overflow-hidden z-20">
                {marketTypeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSelectedMarketType(option)
                      setShowMarketTypeDropdown(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      selectedMarketType === option
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
                setShowMarketTypeDropdown(false)
              }}
              className="flex items-center justify-between gap-1 w-full px-2.5 py-2.5 bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-sm transition-colors"
            >
              <div className="flex items-center gap-1.5">
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

      {/* Strategy Cards - 极简流畅风格 */}
      <div className="p-4 space-y-3 pb-24">
        {filteredStrategies.map((strategy) => (
          <div
            key={strategy.id}
            className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4"
          >
            {/* 顶部：类型标签 + 徽章指示器 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-[#606070]">
                <span>{strategy.type}</span>
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
            <h3 className="text-[#F8F8FC] font-semibold text-base mb-1">{strategy.name}</h3>

            {/* 作者 */}
            <p className="text-[#606070] text-xs mb-4">by {strategy.creator}</p>

            {/* 核心数据 - 横向排列 */}
            <div className="flex items-end justify-between">
              {/* 收益率 - 突出显示 */}
              <div>
                <div className="text-green-400 text-2xl font-bold">+{strategy.totalReturn}%</div>
                <div className="text-[#606070] text-xs mt-0.5">总收益</div>
              </div>

              {/* 其他指标 */}
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="text-[#F8F8FC] font-medium">{strategy.winRate}%</div>
                  <div className="text-[#606070] text-xs">胜率</div>
                </div>
                <div>
                  <div className={`font-medium ${getRiskColor(strategy.riskLevel)}`}>{strategy.riskLevel}</div>
                  <div className="text-[#606070] text-xs">风险</div>
                </div>
                <div>
                  <div className="text-[#F8F8FC] font-medium">{strategy.subscribers.toLocaleString()}</div>
                  <div className="text-[#606070] text-xs">使用</div>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onStrategyClick?.(strategy.id)
                }}
                className="flex-1 py-2.5 bg-[#1A1A24] hover:bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl text-[#94A3B8] text-sm font-medium transition-all"
              >
                详情
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onUseStrategy?.(strategy.id)
                }}
                className="flex-1 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl text-cyan-400 text-sm font-medium transition-all"
              >
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
