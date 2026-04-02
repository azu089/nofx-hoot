'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Users,
  Shield,
  BarChart3,
  Clock,
  Activity,
  Play,
  Calendar,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react'

// API 返回的策略数据类型（与桌面端共用）
export interface MobileStrategyApiData {
  id: string
  name: string
  description: string
  freqtradeId?: string
  isActive: boolean
  createdAt: string
  subscriberCount: number
  isSubscribed: boolean
  riskLevel?: string
  imageUrl?: string
  tags?: string[]
  return7d?: string | null
  return30d?: string | null
  return90d?: string | null
  maxDrawdown?: string | null
  winRate?: string | null
  totalTrades?: number
  isFeatured?: boolean
}

interface MobileStrategyDetailProps {
  strategy?: MobileStrategyApiData
  isLoading?: boolean
  onBack?: () => void
  onUseStrategy?: (id: string) => void
}

// 格式化百分比，null/undefined 显示 "--"
function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '--'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '--'
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`
}

// 格式化统计值
function formatStat(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined) return '--'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '--'
  return `${num}${suffix}`
}

// 计算运行时长
function getRunningDuration(createdAt: string): string {
  try {
    const created = new Date(createdAt)
    const now = new Date()
    const diffMs = now.getTime() - created.getTime()
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days < 1) return '刚刚创建'
    if (days < 30) return `${days} 天`
    const months = Math.floor(days / 30)
    const remainDays = days % 30
    if (remainDays === 0) return `${months} 个月`
    return `${months} 个月 ${remainDays} 天`
  } catch {
    return '--'
  }
}

// 策略固定特性（不依赖后端数据）
const STRATEGY_FEATURES = [
  '自动信号执行',
  '可配置止损止盈',
  '实时交易通知',
  '多交易对支持',
  '风控参数自定义'
]

export function MobileStrategyDetail({
  strategy,
  isLoading,
  onBack,
  onUseStrategy
}: MobileStrategyDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trades'>('overview')

  // 加载状态
  if (isLoading || !strategy) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  const riskLevel = strategy.riskLevel || 'medium'
  const tags = strategy.tags && strategy.tags.length > 0 ? strategy.tags : []

  const tabs = [
    { id: 'overview' as const, label: '策略概览' },
    { id: 'performance' as const, label: '历史表现' },
    { id: 'trades' as const, label: '交易记录' },
  ]

  const renderOverviewTab = () => (
    <div className="space-y-4">
      {/* 策略说明 */}
      <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
        <h3 className="text-[#F8F8FC] font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#06B6D4]" />
          策略说明
        </h3>
        <p className="text-[#9090A0] text-sm leading-relaxed">
          {strategy.description || '暂无策略说明'}
        </p>
      </div>

      {/* 策略特性 */}
      <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
        <h3 className="text-[#F8F8FC] font-semibold mb-3 flex items-center gap-2">
          <Check className="w-4 h-4 text-[#10B981]" />
          策略特性
        </h3>
        <ul className="space-y-2">
          {STRATEGY_FEATURES.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-[#9090A0] text-sm">
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* 快速信息 */}
      <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#9090A0] text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              创建时间
            </span>
            <span className="text-sm text-[#F8F8FC]">
              {strategy.createdAt ? new Date(strategy.createdAt).toLocaleDateString('zh-CN') : '--'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9090A0] text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              运行时长
            </span>
            <span className="text-sm text-[#F8F8FC]">
              {strategy.createdAt ? getRunningDuration(strategy.createdAt) : '--'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9090A0] text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              风险等级
            </span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              riskLevel === 'low' ? 'bg-[#10B981]/20 text-[#10B981]' :
              riskLevel === 'high' ? 'bg-[#F43F5E]/20 text-[#F43F5E]' :
              'bg-[#F59E0B]/20 text-[#F59E0B]'
            }`}>
              {riskLevel === 'low' ? '低风险' :
               riskLevel === 'high' ? '高风险' : '中风险'}
            </span>
          </div>
        </div>
      </div>

      {/* 风险提示 */}
      <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-[#F59E0B]/20 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
        <h3 className="text-[#F59E0B] font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          风险提示
        </h3>
        <p className="text-[#9090A0] text-sm leading-relaxed">
          历史收益不代表未来表现。量化交易存在风险，请根据自身风险承受能力谨慎投资。
          建议新用户先使用小额资金测试策略效果。
        </p>
      </div>
    </div>
  )

  const renderPerformanceTab = () => {
    const hasData = strategy.return7d || strategy.return30d || strategy.return90d || strategy.maxDrawdown

    if (!hasData) {
      return (
        <div className="space-y-4">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-8">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-[#9090A0]/30 mx-auto mb-3" />
              <p className="text-[#9090A0] text-sm">暂无历史表现数据</p>
              <p className="text-[#9090A0]/60 text-xs mt-1">策略运行后将自动统计</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* 详细数据 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
          <h3 className="text-[#F8F8FC] font-semibold mb-4">详细数据</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1E1E2E]/50 rounded-lg p-3 text-center">
              <div className="text-[#10B981] text-lg font-bold font-mono">
                {formatPercent(strategy.return7d)}
              </div>
              <div className="text-[#9090A0] text-xs mt-1">7日收益</div>
            </div>
            <div className="bg-[#1E1E2E]/50 rounded-lg p-3 text-center">
              <div className="text-[#10B981] text-lg font-bold font-mono">
                {formatPercent(strategy.return30d)}
              </div>
              <div className="text-[#9090A0] text-xs mt-1">30日收益</div>
            </div>
            <div className="bg-[#1E1E2E]/50 rounded-lg p-3 text-center">
              <div className="text-[#F43F5E] text-lg font-bold font-mono">
                {formatPercent(strategy.maxDrawdown)}
              </div>
              <div className="text-[#9090A0] text-xs mt-1">最大回撤</div>
            </div>
            <div className="bg-[#1E1E2E]/50 rounded-lg p-3 text-center">
              <div className="text-[#F8F8FC] text-lg font-bold font-mono">
                {formatStat(strategy.totalTrades)}
              </div>
              <div className="text-[#9090A0] text-xs mt-1">总交易次数</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderTradesTab = () => (
    <div className="space-y-4">
      <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-8">
        <div className="text-center">
          <Activity className="w-12 h-12 text-[#9090A0]/30 mx-auto mb-3" />
          <p className="text-[#9090A0] text-sm">暂无交易记录</p>
          <p className="text-[#9090A0]/60 text-xs mt-1">策略执行交易后将在此显示</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex flex-col">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F] pt-[env(safe-area-inset-top)] [transform:translateZ(0)] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">策略详情</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">
          {/* 策略头部信息 */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold leading-tight">{strategy.name}</h2>

            {/* 标签 */}
            {tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-xs bg-[#06B6D4]/20 text-[#06B6D4]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* 统计信息 */}
            <div className="flex items-center gap-3 text-sm text-[#9090A0] pt-1">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {strategy.subscriberCount.toLocaleString()} 订阅者
              </span>
              {strategy.isActive && (
                <span className="flex items-center gap-1 text-[#10B981]">
                  <Activity className="w-4 h-4" />
                  运行中
                </span>
              )}
            </div>
          </div>

          {/* 快速数据卡片 */}
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xl font-mono font-bold text-[#10B981]">
                  {formatPercent(strategy.return30d)}
                </p>
                <p className="text-[#9090A0] text-xs mt-1">30日收益</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-mono font-bold text-[#F43F5E]">
                  {formatPercent(strategy.maxDrawdown)}
                </p>
                <p className="text-[#9090A0] text-xs mt-1">最大回撤</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-mono font-bold text-[#F8F8FC]">
                  {formatStat(strategy.winRate, '%')}
                </p>
                <p className="text-[#9090A0] text-xs mt-1">胜率</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-mono font-bold text-[#F8F8FC]">
                  {formatStat(strategy.totalTrades)}
                </p>
                <p className="text-[#9090A0] text-xs mt-1">总交易次数</p>
              </div>
            </div>
          </div>

          {/* Tab 切换 */}
          <div className="flex border-b border-[#1E1E2E]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#F8F8FC] border-[#06B6D4]'
                    : 'text-[#9090A0] border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 内容 */}
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'performance' && renderPerformanceTab()}
          {activeTab === 'trades' && renderTradesTab()}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-[#1E1E2E] p-4">
        <button
          type="button"
          onClick={() => onUseStrategy?.(strategy.id)}
          className="w-full py-3 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] active:opacity-80 transition-all duration-100 select-none shadow-[0_0_20px_rgba(6,182,212,0.3)]"
        >
          <Play className="w-5 h-5" />
          {strategy.isSubscribed ? '已订阅' : '立即使用'}
        </button>
      </div>
    </div>
  )
}
