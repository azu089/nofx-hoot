'use client'

import { useState } from 'react'
import {
  Zap,
  Play,
  Pause,
  Settings,
  Trash2,
  Clock,
  Plus,
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MyStrategy {
  id: string
  name: string
  description: string
  status: 'running' | 'paused' | 'stopped'
  type: 'system' | 'external' | 'visual' | 'code' // 策略类型
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

interface MyStrategiesPageProps {
  strategies?: MyStrategy[]
  onEditStrategy?: (strategyId: string) => void
  onDeleteStrategy?: (strategyId: string) => void
  onToggleStrategy?: (strategyId: string, status: 'running' | 'paused') => void
  onCreateStrategy?: () => void
  onViewMarket?: () => void
}

const mockStrategies: MyStrategy[] = [
  {
    id: '1',
    name: 'RSI 智能抄底',
    description: '基于 RSI 超卖信号的智能抄底策略',
    status: 'running',
    type: 'system',
    exchange: 'Binance',
    tradingPairs: ['BTC/USDT', 'ETH/USDT'],
    createdAt: '2025-12-15',
    lastModified: '2026-01-25',
    config: {
      leverage: 3,
      positionSize: '10%',
      stopLoss: 5,
      takeProfit: 10
    }
  },
  {
    id: '2',
    name: 'MACD 趋势跟踪',
    description: '跟踪 MACD 金叉死叉信号的趋势策略',
    status: 'paused',
    type: 'external',
    exchange: 'OKX',
    tradingPairs: ['SOL/USDT'],
    createdAt: '2025-11-20',
    lastModified: '2026-01-20',
    config: {
      leverage: 2,
      positionSize: '5%',
      stopLoss: 3,
      takeProfit: 8
    }
  },
  {
    id: '3',
    name: 'BTC 网格策略',
    description: '在震荡区间内自动高抛低吸',
    status: 'running',
    type: 'visual',
    exchange: 'Binance',
    tradingPairs: ['BTC/USDT'],
    createdAt: '2025-10-01',
    lastModified: '2026-01-28',
    config: {
      leverage: 1,
      positionSize: '20%',
      stopLoss: 10,
      takeProfit: 15
    }
  }
]

const strategyTypeLabels: Record<string, { label: string; color: string }> = {
  system: { label: '系统策略', color: 'bg-cyan-400/10 text-cyan-400' },
  external: { label: '外部接入', color: 'bg-purple-400/10 text-purple-400' },
  visual: { label: '可视化', color: 'bg-blue-400/10 text-blue-400' },
  code: { label: '代码', color: 'bg-orange-400/10 text-orange-400' }
}

export function MyStrategiesPage({
  strategies = mockStrategies,
  onEditStrategy,
  onDeleteStrategy,
  onToggleStrategy,
  onCreateStrategy,
  onViewMarket
}: MyStrategiesPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'paused'>('all')

  const filteredStrategies = strategies.filter(strategy => {
    const matchesSearch = strategy.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || strategy.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const runningCount = strategies.filter(s => s.status === 'running').length
  const pausedCount = strategies.filter(s => s.status === 'paused').length

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">我的策略</h1>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={onViewMarket}
              variant="outline"
              className="border-[#2A2A3A] text-[#F8F8FC] hover:bg-[#1E1E2E]"
            >
              <Search className="w-4 h-4 mr-2" />
              浏览策略市场
            </Button>
            <Button
              onClick={onCreateStrategy}
              className="bg-[#06B6D4] hover:bg-[#0891B2] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              创建策略
            </Button>
          </div>
        </div>

        {/* Stats Overview - Simplified */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="text-[#9090A0] text-sm mb-1">策略总数</div>
            <div className="text-2xl font-bold">{strategies.length}</div>
          </div>
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="text-[#9090A0] text-sm mb-1">运行中</div>
            <div className="text-2xl font-bold text-green-400">{runningCount}</div>
          </div>
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="text-[#9090A0] text-sm mb-1">已暂停</div>
            <div className="text-2xl font-bold text-yellow-400">{pausedCount}</div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索策略..."
              className="w-full bg-[#12121A] border border-[#1E1E2E] rounded-xl pl-10 pr-4 py-2.5 text-[#F8F8FC] placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'running', 'paused'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  statusFilter === status
                    ? "bg-[#06B6D4] text-white"
                    : "bg-[#1E1E2E] text-[#9090A0] hover:text-[#F8F8FC]"
                )}
              >
                {status === 'all' ? '全部' : status === 'running' ? '运行中' : '已暂停'}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy List */}
        {filteredStrategies.length === 0 ? (
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-12 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <Zap className="w-12 h-12 text-[#606070] mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">暂无策略</h3>
            <p className="text-[#9090A0] mb-6">从策略市场选择策略，或创建自己的交易策略</p>
            <div className="flex justify-center gap-3">
              <Button
                onClick={onViewMarket}
                variant="outline"
                className="border-[#2A2A3A] text-[#F8F8FC] hover:bg-[#1E1E2E]"
              >
                浏览策略市场
              </Button>
              <Button
                onClick={onCreateStrategy}
                className="bg-[#06B6D4] hover:bg-[#0891B2] text-white"
              >
                创建策略
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStrategies.map((strategy) => (
              <div
                key={strategy.id}
                className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] hover:border-cyan-500/20 transition-colors overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Strategy Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        strategy.status === 'running' ? "bg-green-400 animate-pulse" : "bg-yellow-400"
                      )} />
                      <h3 className="text-lg font-semibold">{strategy.name}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        strategy.status === 'running'
                          ? "bg-green-400/10 text-green-400"
                          : "bg-yellow-400/10 text-yellow-400"
                      )}>
                        {strategy.status === 'running' ? '运行中' : '已暂停'}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        strategyTypeLabels[strategy.type]?.color
                      )}>
                        {strategyTypeLabels[strategy.type]?.label}
                      </span>
                    </div>
                    <p className="text-[#9090A0] text-sm mb-3">{strategy.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-[#606070]">
                      <span>{strategy.exchange}</span>
                      <span>·</span>
                      <span>{strategy.tradingPairs.join(', ')}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        上次修改 {strategy.lastModified}
                      </span>
                    </div>
                  </div>

                  {/* Config Summary */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[#606070]">杠杆:</span>
                      <span className="font-medium">{strategy.config.leverage}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#606070]">仓位:</span>
                      <span className="font-medium">{strategy.config.positionSize}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#606070]">止损:</span>
                      <span className="font-medium text-red-400">{strategy.config.stopLoss}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#606070]">止盈:</span>
                      <span className="font-medium text-green-400">{strategy.config.takeProfit}%</span>
                    </div>
                  </div>

                  {/* Actions - 暂停/启动在右边 */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditStrategy?.(strategy.id)}
                      className="p-2.5 rounded-lg bg-[#1E1E2E] text-[#9090A0] hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                      title="编辑策略"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteStrategy?.(strategy.id)}
                      className="p-2.5 rounded-lg bg-[#1E1E2E] text-[#9090A0] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="删除策略"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleStrategy?.(strategy.id, strategy.status === 'running' ? 'paused' : 'running')}
                      className={cn(
                        "p-2.5 rounded-lg transition-colors",
                        strategy.status === 'running'
                          ? "bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20"
                          : "bg-green-400/10 text-green-400 hover:bg-green-400/20"
                      )}
                      title={strategy.status === 'running' ? '暂停' : '启动'}
                    >
                      {strategy.status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
