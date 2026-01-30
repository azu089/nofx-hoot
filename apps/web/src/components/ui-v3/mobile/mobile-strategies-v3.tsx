'use client'

import { useState } from 'react'
import {
  Search,
  Filter,
  Zap,
  TrendingUp,
  Users,
  Star,
  Settings,
  Home,
  BarChart3,
  Layers,
  Wallet,
  User,
  Sparkles,
  Crown
} from 'lucide-react'

interface Strategy {
  id: string
  name: string
  type: string
  creator: string
  winRate: number
  totalReturn: number
  subscribers: number
  badges: ('Hot' | 'New' | 'Pro')[]
  isFree: boolean
}

interface MobileStrategiesV3Props {
  strategies?: Strategy[]
  onStrategyClick?: (id: string) => void
  onUseStrategy?: (id: string) => void
  onNavigate?: (tab: string) => void
}

const defaultStrategies: Strategy[] = [
  {
    id: '1',
    name: 'BTC智能网格',
    type: '网格',
    creator: 'CryptoMaster',
    winRate: 87.5,
    totalReturn: 156.8,
    subscribers: 2341,
    badges: ['Hot', 'Pro'],
    isFree: true
  },
  {
    id: '2',
    name: 'ETH定投策略',
    type: '定投',
    creator: 'AITrader',
    winRate: 92.1,
    totalReturn: 234.5,
    subscribers: 1876,
    badges: ['New'],
    isFree: true
  },
  {
    id: '3',
    name: 'AI信号追踪',
    type: 'AI信号',
    creator: 'QuantBot',
    winRate: 78.9,
    totalReturn: 189.2,
    subscribers: 3456,
    badges: ['Hot'],
    isFree: true
  },
  {
    id: '4',
    name: '套利机器人',
    type: '套利',
    creator: 'ArbiMaster',
    winRate: 95.2,
    totalReturn: 312.7,
    subscribers: 987,
    badges: ['Pro'],
    isFree: true
  }
]

const filterOptions = [
  { id: 'all', label: '全部' },
  { id: 'dca', label: '定投' },
  { id: 'grid', label: '网格' },
  { id: 'ai', label: 'AI信号' },
  { id: 'arbitrage', label: '套利' }
]

// 预定义的高度值，避免在渲染时调用 Math.random()
const sparklineHeights = [65, 45, 80, 55, 90, 40, 75, 60]

function SparklinePlaceholder() {
  return (
    <div className="w-16 h-8 flex items-end space-x-0.5">
      {sparklineHeights.map((height, i) => (
        <div
          key={i}
          className="bg-gradient-to-t from-cyan-500/60 to-cyan-400/80 rounded-sm flex-1"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}

function StrategyCard({
  strategy,
  onUse
}: {
  strategy: Strategy
  onUse?: (id: string) => void
}) {
  return (
    <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4 mb-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-[#F8F8FC] font-semibold text-base">{strategy.name}</h3>
            <div className="flex gap-1">
              {strategy.badges.map((badge) => (
                <span
                  key={badge}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    badge === 'Hot'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : badge === 'New'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}
                >
                  {badge === 'Hot' && <Zap className="w-3 h-3 inline mr-1" />}
                  {badge === 'New' && <Sparkles className="w-3 h-3 inline mr-1" />}
                  {badge === 'Pro' && <Crown className="w-3 h-3 inline mr-1" />}
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-[#2A2A3A]/50 border border-[#2A2A3A] rounded-lg text-[#9090A0] text-xs">
              {strategy.type}
            </span>
            <span className="text-[#606070] text-xs">by {strategy.creator}</span>
          </div>
        </div>
        <SparklinePlaceholder />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-[#F8F8FC] font-semibold text-sm">{strategy.winRate}%</div>
          <div className="text-[#606070] text-xs">胜率</div>
        </div>
        <div className="text-center">
          <div className="text-[#06B6D4] font-semibold text-sm">+{strategy.totalReturn}%</div>
          <div className="text-[#606070] text-xs">收益率</div>
        </div>
        <div className="text-center">
          <div className="text-[#F8F8FC] font-semibold text-sm">{strategy.subscribers.toLocaleString()}</div>
          <div className="text-[#606070] text-xs">订阅者</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {strategy.isFree && (
            <span className="px-2 py-1 bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-lg text-[#06B6D4] text-xs font-medium">
              免费 - 开箱即用
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onUse?.(strategy.id)}
          className="flex items-center gap-2 px-4 py-2 bg-[#06B6D4] hover:bg-[#06B6D4]/90 rounded-xl text-white text-sm font-medium transition-colors"
        >
          <Settings className="w-4 h-4" />
          配置策略
        </button>
      </div>
    </div>
  )
}

export function MobileStrategiesV3({
  strategies = defaultStrategies,
  onStrategyClick,
  onUseStrategy,
  onNavigate
}: MobileStrategiesV3Props) {
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [showSearchOverlay, setShowSearchOverlay] = useState(false)
  const [activeTab, setActiveTab] = useState('strategies')

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onNavigate?.(tabId)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] max-w-md mx-auto relative">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E] px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#F8F8FC]">策略市场</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSearchOverlay(true)}
              className="p-2 hover:bg-[#12121A]/50 rounded-xl transition-colors"
            >
              <Search className="w-5 h-5 text-[#9090A0]" />
            </button>
            <button type="button" className="p-2 hover:bg-[#12121A]/50 rounded-xl transition-colors">
              <Filter className="w-5 h-5 text-[#9090A0]" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="px-4 py-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedFilter(option.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                selectedFilter === option.id
                  ? 'bg-[#06B6D4] text-white'
                  : 'bg-[#12121A]/50 border border-[#1E1E2E] text-[#9090A0] hover:bg-[#12121A]/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="px-4 pb-24">
        {strategies.map((strategy) => (
          <StrategyCard key={strategy.id} strategy={strategy} onUse={onUseStrategy} />
        ))}

        {/* Load More Button */}
        <button
          type="button"
          className="w-full py-3 mt-4 backdrop-blur-xl bg-[#12121A]/50 border border-[#1E1E2E] rounded-xl text-[#9090A0] font-medium hover:bg-[#12121A]/80 transition-colors"
        >
          加载更多
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md backdrop-blur-xl bg-[#0A0A0F]/95 border-t border-[#1E1E2E]">
        <div className="grid grid-cols-5 py-2">
          {[
            { id: 'home', icon: Home, label: '首页' },
            { id: 'trading', icon: BarChart3, label: '交易' },
            { id: 'strategies', icon: Layers, label: '策略' },
            { id: 'wallet', icon: Wallet, label: '钱包' },
            { id: 'me', icon: User, label: '我的' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center py-2 px-1 transition-colors ${
                activeTab === tab.id ? 'text-[#06B6D4]' : 'text-[#606070] hover:text-[#9090A0]'
              }`}
            >
              <tab.icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search Overlay */}
      {showSearchOverlay && (
        <div className="fixed inset-0 z-50 backdrop-blur-xl bg-[#0A0A0F]/95">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
                <input
                  type="text"
                  placeholder="搜索策略..."
                  className="w-full pl-10 pr-4 py-3 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-[#06B6D4]"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => setShowSearchOverlay(false)}
                className="px-4 py-3 text-[#9090A0] font-medium"
              >
                取消
              </button>
            </div>

            <div className="text-[#606070] text-sm text-center mt-12">
              输入关键词搜索策略
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
