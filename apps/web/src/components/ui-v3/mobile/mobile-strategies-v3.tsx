'use client'

import { useState } from 'react'
import {
  Search,
  Plus,
  ChevronDown,
  TrendingUp,
  Filter,
  ArrowLeft
} from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface Strategy {
  id: string
  name: string
  type: string  // DCA/Grid/AI Signal/Arbitrage
  marketType: 'spot' | 'futures'  // spot or futures
  creator: string
  winRate: number
  totalReturn: number
  riskLevel: 'low' | 'medium' | 'high'
  subscribers: number
  badges: ('hot' | 'new' | 'pro')[]
  isHot?: boolean
}

interface MobileStrategiesV3Props {
  strategies?: Strategy[]
  onStrategyClick?: (id: string) => void
  onUseStrategy?: (id: string) => void
  onNavigate?: (tab: string) => void
  onCreateStrategy?: () => void
  onLoadMore?: () => void
  onBack?: () => void
  hasMore?: boolean // 是否有更多数据
  isLoadingMore?: boolean // 是否正在加载更多
}

const filterOptions = ['all', 'DCA', 'Grid', 'AI Signal', 'Arbitrage']
const marketTypeOptions = ['all', 'spot', 'futures']
const sortOptions = ['hot', 'winRate', 'return', 'new']

export function MobileStrategiesV3({
  strategies = [],
  onStrategyClick,
  onUseStrategy,
  onNavigate: _onNavigate,
  onCreateStrategy,
  onLoadMore,
  onBack,
  hasMore = true,
  isLoadingMore = false
}: MobileStrategiesV3Props) {
  void _onNavigate
  const t = useTranslations('strategies')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedMarketType, setSelectedMarketType] = useState('all')
  const [selectedSort, setSelectedSort] = useState('hot')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showMarketTypeDropdown, setShowMarketTypeDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-400'
      case 'medium':
        return 'text-yellow-400'
      case 'high':
        return 'text-red-400'
      default:
        return 'text-[#9090A0]'
    }
  }

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'low':
        return t('lowRisk')
      case 'medium':
        return t('mediumRisk')
      case 'high':
        return t('highRisk')
      default:
        return risk
    }
  }

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

  const filteredStrategies = strategies.filter(strategy => {
    const matchesFilter = selectedFilter === 'all' || strategy.type === selectedFilter
    const matchesMarketType = selectedMarketType === 'all' || strategy.marketType === selectedMarketType
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
              placeholder={t('searchPlaceholder')}
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
            {t('cancel')}
          </button>
        </div>

        <div className="p-4">
          {searchQuery ? (
            <div className="space-y-3">
              {filteredStrategies.map((strategy) => (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => {
                    onStrategyClick?.(strategy.id)
                    setShowSearch(false)
                  }}
                  className="w-full flex items-center justify-between p-4 glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] active:bg-[#1E1E2E]/50 transition-colors text-left"
                >
                  <div>
                    <div className="text-[#F8F8FC] font-medium">{strategy.name}</div>
                    <div className="text-[#606070] text-xs mt-0.5">{strategy.type} · {getMarketTypeLabel(strategy.marketType)}</div>
                  </div>
                  <span className={`text-sm font-semibold ${strategy.totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {strategy.totalReturn >= 0 ? '+' : ''}{strategy.totalReturn}%
                  </span>
                </button>
              ))}
              {filteredStrategies.length === 0 && (
                <div className="text-center text-[#606070] py-8">
                  {t('noResults')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-[#606070] py-12">
              {t('searchPlaceholder')}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header - 标题 + 创建按钮 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#1E1E2E] transition-colors"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">{t('title')}</h1>
          <button
            type="button"
            onClick={onCreateStrategy}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#06B6D4] text-black"
            aria-label={t('create')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter + Market Type + Sort + Search Dropdowns */}
      <div className="px-4 py-4 border-b border-[#1E1E2E]">
        <div className="flex items-center gap-2">
          {/* Search Button */}
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="p-2.5 rounded-xl bg-[#12121A]/50 border border-[#1E1E2E] text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            aria-label={t('search')}
          >
            <Search className="w-5 h-5" />
          </button>
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
                <span className={selectedFilter === 'all' ? 'text-[#9090A0]' : 'text-[#F8F8FC]'}>
                  {getFilterLabel(selectedFilter)}
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
                    {getFilterLabel(option)}
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
              <span className={selectedMarketType === 'all' ? 'text-[#9090A0]' : selectedMarketType === 'spot' ? 'text-blue-400' : 'text-orange-400'}>
                {selectedMarketType === 'all' ? t('market') : getMarketTypeLabel(selectedMarketType)}
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
                    {getMarketTypeLabel(option)}
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
                <span className="text-[#F8F8FC]">{getSortLabel(selectedSort)}</span>
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
                    {getSortLabel(option)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="p-4 space-y-3 pb-20">
        {filteredStrategies.map((strategy) => (
          <div
            key={strategy.id}
            onClick={() => onStrategyClick?.(strategy.id)}
            className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-4 py-3.5 active:scale-[0.98] transition-all"
          >
            {/* 第一行：策略名称 */}
            <h3 className="text-[15px] font-semibold text-white mb-2">{strategy.name}</h3>

            {/* 第二行：类型标签 + 收益率 + 使用按钮 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-[#606070]">
                <span>{strategy.type}</span>
                <span>·</span>
                <span className={strategy.marketType === 'spot' ? 'text-blue-400' : 'text-orange-400'}>
                  {getMarketTypeLabel(strategy.marketType)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`text-lg font-bold ${strategy.totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {strategy.totalReturn >= 0 ? '+' : ''}{strategy.totalReturn}%
                  </span>
                  <span className="text-[10px] text-[#606070] ml-1">{t('totalReturnShort')}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUseStrategy?.(strategy.id)
                  }}
                  className="px-3 py-1.5 bg-[#06B6D4]/10 border border-[#06B6D4]/20 rounded-lg text-[#06B6D4] text-xs font-medium active:bg-[#06B6D4]/20 transition-colors whitespace-nowrap"
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
                <span className={`w-1.5 h-1.5 rounded-full ${
                  strategy.riskLevel === 'low' ? 'bg-emerald-400' : strategy.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-rose-400'
                }`} />
                <span className={getRiskColor(strategy.riskLevel)}>{getRiskLabel(strategy.riskLevel)}</span>
              </span>
            </div>
          </div>
        ))}

        {filteredStrategies.length === 0 && (
          <div className="text-center text-[#606070] py-12">
            {t('noStrategies')}
          </div>
        )}

        {/* Load More / All Loaded */}
        {filteredStrategies.length > 0 && (
          <div className="text-center py-2">
            {hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="w-full py-3 backdrop-blur-xl bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-[#9090A0] text-sm font-medium hover:text-[#F8F8FC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? t('loading') : t('loadMore')}
              </button>
            ) : (
              <p className="text-[#606070] text-sm py-3">{t('allLoaded')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
