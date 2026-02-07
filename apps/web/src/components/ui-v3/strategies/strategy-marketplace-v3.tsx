'use client'

import { useState } from 'react'
import {
  Search,
  Filter,
  TrendingUp,
  ChevronDown,
  Plus
} from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface Strategy {
  id: string
  name: string
  type: 'DCA' | 'Grid' | 'Arbitrage' | 'AI Signal'
  marketType: 'spot' | 'futures'  // spot or futures
  creator: string
  winRate: number
  totalReturn: number
  riskLevel: 'low' | 'medium' | 'high'
  subscribers: number
  badges: ('hot' | 'new' | 'pro')[]
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
  onLoadMore?: () => void
  hasMore?: boolean // 是否有更多数据
  isLoadingMore?: boolean // 是否正在加载更多
}

const riskLevelColors: Record<string, string> = {
  'low': 'text-emerald-400',
  'medium': 'text-amber-400',
  'high': 'text-rose-400'
}

const riskDotColors: Record<string, string> = {
  'low': 'bg-emerald-400',
  'medium': 'bg-amber-400',
  'high': 'bg-rose-400'
}

const filterOptions = ['all', 'DCA', 'Grid', 'AI Signal', 'Arbitrage']
const marketTypeOptions = ['all', 'spot', 'futures']
const sortOptions = ['hot', 'winRate', 'return', 'new']

export function StrategyMarketplaceV3({
  strategies = [],
  onStrategyClick,
  onSubscribe: _onSubscribe,
  onConfigureStrategy,
  onNavigate,
  onSearch,
  onFilterChange,
  onCreateStrategy,
  onLoadMore,
  hasMore = true,
  isLoadingMore = false
}: StrategyMarketplaceV3Props) {
  void _onSubscribe
  const t = useTranslations('strategies')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedMarketType, setSelectedMarketType] = useState('all')
  const [selectedSort, setSelectedSort] = useState('hot')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showMarketTypeDropdown, setShowMarketTypeDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const getFilterLabel = (key: string) => {
    if (key === 'all') return t('all')
    return key // DCA, Grid, etc. stay as-is
  }

  const getMarketTypeLabel = (key: string) => {
    switch (key) {
      case 'all': return t('all')
      case 'spot': return t('spot')
      case 'futures': return t('futures')
      default: return key
    }
  }

  const getSortLabel = (key: string) => {
    switch (key) {
      case 'hot': return t('hot')
      case 'winRate': return t('winRate')
      case 'return': return t('return')
      case 'new': return t('new')
      default: return key
    }
  }

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'low': return t('lowRisk')
      case 'medium': return t('mediumRisk')
      case 'high': return t('highRisk')
      default: return risk
    }
  }

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
    const matchesFilter = selectedFilter === 'all' || strategy.type === selectedFilter
    const matchesMarketType = selectedMarketType === 'all' || strategy.marketType === selectedMarketType
    return matchesSearch && matchesFilter && matchesMarketType
  })

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[#F8F8FC]">{t('pageTitle')}</h1>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#606070] w-5 h-5" />
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
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
                  {getFilterLabel(selectedFilter)}
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
                        {getFilterLabel(option)}
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
                    selectedMarketType === 'spot' ? 'text-blue-400' : selectedMarketType === 'futures' ? 'text-orange-400' : 'text-[#F8F8FC]'
                  }`}
                >
                  {selectedMarketType === 'all' ? t('market') : getMarketTypeLabel(selectedMarketType)}
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
                        {getMarketTypeLabel(option)}
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
                  {getSortLabel(selectedSort)}
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
                        {getSortLabel(option)}
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
                {t('create')}
              </button>
            </div>
        </div>

        {/* Strategy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {filteredStrategies.map((strategy) => (
            <div
              key={strategy.id}
              className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 hover:shadow-[0_8px_32px_rgba(6,182,212,0.08)] transition-all cursor-pointer group"
              onClick={() => onStrategyClick?.(strategy.id)}
            >
              {/* 第一行：策略名称 */}
              <h3 className="text-[#F8F8FC] font-semibold text-lg mb-3 group-hover:text-cyan-400 transition-colors">
                {strategy.name}
              </h3>

              {/* 第二行：类型标签 + 收益率 + 使用按钮 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-[#606070]">
                  <span>{strategy.type}</span>
                  <span>·</span>
                  <span className={strategy.marketType === 'spot' ? 'text-blue-400' : 'text-orange-400'}>
                    {getMarketTypeLabel(strategy.marketType)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-xl font-bold ${strategy.totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {strategy.totalReturn >= 0 ? '+' : ''}{strategy.totalReturn}%
                    </span>
                    <span className="text-[10px] text-[#606070] ml-1">{t('totalReturnShort')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate?.(`/strategies/config?strategyId=${strategy.id}`)
                      onConfigureStrategy?.(strategy.id)
                    }}
                    className="px-4 py-1.5 bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 border border-[#06B6D4]/20 rounded-lg text-[#06B6D4] text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    {t('useNow')} →
                  </button>
                </div>
              </div>

              {/* 第三行：胜率 + 风险等级 */}
              <div className="flex items-center gap-3 text-xs text-[#606070]">
                <span>{t('winRate')} <span className="text-[#F8F8FC] font-medium">{strategy.winRate}%</span></span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${riskDotColors[strategy.riskLevel] || 'bg-[#606070]'}`} />
                  <span className={riskLevelColors[strategy.riskLevel] || 'text-[#606070]'}>{getRiskLabel(strategy.riskLevel)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Load More / All Loaded */}
        <div className="text-center py-4">
          {hasMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-8 py-3 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-xl text-[#F8F8FC] hover:border-[#06B6D4] hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? t('loading') : t('loadMore')}
            </button>
          ) : (
            <p className="text-[#606070] text-sm">{t('allLoaded')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
