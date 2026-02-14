'use client'

import { useState } from 'react'
import { ArrowLeft, Star, Users, Calendar, Shield, Clock, Play, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/provider'

// API 返回的策略数据类型（与后端 StrategyDetailResponse 对齐）
export interface StrategyApiData {
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
  // 统计字段（可能为 null，表示暂无数据）
  return7d?: string | null
  return30d?: string | null
  return90d?: string | null
  maxDrawdown?: string | null
  winRate?: string | null
  totalTrades?: number
  isFeatured?: boolean
}

interface StrategyDetailPageProps {
  strategy?: StrategyApiData
  isLoading?: boolean
  onBack?: () => void
  onUseStrategy?: (id: string) => void
}

// 格式化数值显示，null/undefined 显示 "--"
function formatStat(value: string | number | null | undefined, suffix = '', prefix = ''): string {
  if (value === null || value === undefined || value === '') return '--'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '--'
  return `${prefix}${num}${suffix}`
}

// 格式化百分比显示（带正负号）
function formatPercent(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '--'
  const num = parseFloat(value)
  if (isNaN(num)) return '--'
  return `${num >= 0 ? '+' : ''}${num}%`
}

// 计算运行时长
function getRunningDuration(createdAt: string): string {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return '刚刚创建'
  if (diffDays < 30) return `${diffDays} 天`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths} 个月`
}

export function StrategyDetailPage({
  strategy,
  isLoading,
  onBack,
  onUseStrategy
}: StrategyDetailPageProps) {
  const t = useTranslations('strategyDetail')
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trades'>('overview')

  // 加载状态（包括数据未加载完成的情况）
  if (isLoading || !strategy) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  const tags = strategy.tags && strategy.tags.length > 0 ? strategy.tags : []
  const hasStats = strategy.return30d || strategy.maxDrawdown || strategy.winRate

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans p-6">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[#9090A0] hover:text-[#F8F8FC] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToMarket')}
          </button>

          {/* Strategy Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{strategy.name}</h1>
                {tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#06B6D4]/20 text-[#06B6D4]">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm text-[#9090A0]">
                <span className="flex items-center gap-1">
                  by Hoot Labs
                  <Check className="w-4 h-4 text-[#10B981]" />
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {strategy.subscriberCount.toLocaleString()}
                </span>
              </div>
            </div>
            <Button
              className="bg-[#06B6D4] hover:bg-[#0891B2] text-white"
              onClick={() => onUseStrategy?.(strategy.id)}
            >
              <Play className="w-4 h-4 mr-2" />
              {strategy.isSubscribed ? t('subscribed') : t('useNow')}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="col-span-2 space-y-6">
              {/* Quick Stats - 从 API 真实数据 */}
              <Card className="glass-border-glow bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className={cn(
                        "text-2xl font-mono font-bold",
                        !strategy.return30d ? "text-[#9090A0]" :
                        parseFloat(strategy.return30d) >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
                      )}>
                        {formatPercent(strategy.return30d)}
                      </p>
                      <p className="text-[#9090A0] text-xs mt-1">{t('monthlyReturn')}</p>
                    </div>
                    <div className="text-center">
                      <p className={cn(
                        "text-2xl font-mono font-bold",
                        !strategy.maxDrawdown ? "text-[#9090A0]" : "text-[#F43F5E]"
                      )}>
                        {strategy.maxDrawdown ? `${parseFloat(strategy.maxDrawdown)}%` : '--'}
                      </p>
                      <p className="text-[#9090A0] text-xs mt-1">{t('maxDrawdown')}</p>
                    </div>
                    <div className="text-center">
                      <p className={cn(
                        "text-2xl font-mono font-bold",
                        !strategy.winRate ? "text-[#9090A0]" : "text-[#F8F8FC]"
                      )}>
                        {strategy.winRate ? `${parseFloat(strategy.winRate)}%` : '--'}
                      </p>
                      <p className="text-[#9090A0] text-xs mt-1">{t('winRate')}</p>
                    </div>
                    <div className="text-center">
                      <p className={cn(
                        "text-2xl font-mono font-bold",
                        !strategy.totalTrades ? "text-[#9090A0]" : "text-[#F8F8FC]"
                      )}>
                        {strategy.totalTrades || '--'}
                      </p>
                      <p className="text-[#9090A0] text-xs mt-1">{t('totalTrades')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-4 border-b border-[#1E1E2E]">
                {[
                  { id: 'overview', label: t('overview') },
                  { id: 'performance', label: t('performance') },
                  { id: 'trades', label: t('trades') },
                ].map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={cn(
                      "pb-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeTab === tab.id
                        ? "text-[#F8F8FC] border-cyan-500"
                        : "text-[#9090A0] border-transparent hover:text-[#F8F8FC]"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Description */}
                  <Card className="glass-border-glow bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">{t('strategyDescription')}</h3>
                      <p className="text-[#9090A0] text-sm leading-relaxed">
                        {strategy.description || '暂无描述'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Risk Warning */}
                  <Card className="glass-border-glow bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] border-l-4 border-l-[#F59E0B]">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-semibold mb-1">{t('riskWarning')}</h3>
                          <p className="text-[#9090A0] text-sm">
                            {t('riskWarningText')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'performance' && (
                <div className="space-y-6">
                  {/* Detailed Stats */}
                  <Card className="glass-border-glow bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-4">{t('detailedStats')}</h3>
                      {hasStats ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                            <span className="text-[#9090A0] text-sm">7天收益</span>
                            <span className={cn(
                              "font-mono font-bold",
                              !strategy.return7d ? "text-[#9090A0]" :
                              parseFloat(strategy.return7d) >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
                            )}>
                              {formatPercent(strategy.return7d)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                            <span className="text-[#9090A0] text-sm">30天收益</span>
                            <span className={cn(
                              "font-mono font-bold",
                              !strategy.return30d ? "text-[#9090A0]" :
                              parseFloat(strategy.return30d) >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
                            )}>
                              {formatPercent(strategy.return30d)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                            <span className="text-[#9090A0] text-sm">90天收益</span>
                            <span className={cn(
                              "font-mono font-bold",
                              !strategy.return90d ? "text-[#9090A0]" :
                              parseFloat(strategy.return90d) >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
                            )}>
                              {formatPercent(strategy.return90d)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                            <span className="text-[#9090A0] text-sm">{t('maxDrawdown')}</span>
                            <span className={cn(
                              "font-mono font-bold",
                              !strategy.maxDrawdown ? "text-[#9090A0]" : "text-[#F43F5E]"
                            )}>
                              {strategy.maxDrawdown ? `${parseFloat(strategy.maxDrawdown)}%` : '--'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                            <span className="text-[#9090A0] text-sm">{t('winRate')}</span>
                            <span className="font-mono font-bold">
                              {strategy.winRate ? `${parseFloat(strategy.winRate)}%` : '--'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                            <span className="text-[#9090A0] text-sm">{t('totalTrades')}</span>
                            <span className="font-mono font-bold">
                              {strategy.totalTrades || '--'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-[#9090A0]">
                          <p className="text-sm">策略刚刚上线，暂无历史表现数据</p>
                          <p className="text-xs mt-1">数据将在策略运行后自动更新</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'trades' && (
                <Card className="glass-border-glow bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                  <CardContent className="p-4">
                    <div className="text-center py-8 text-[#9090A0]">
                      <p className="text-sm">暂无交易记录</p>
                      <p className="text-xs mt-1">策略产生交易后将在此展示</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Use Strategy */}
            <div className="space-y-4">
              {/* Free Badge & Features */}
              <Card className="glass-border-glow bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30">
                      {t('freeToUse')}
                    </span>
                  </div>

                  <p className="text-sm text-[#9090A0] mb-4">
                    {t('includedInSubscription')}
                  </p>

                  <h4 className="font-semibold mb-3 text-sm">{t('features')}</h4>
                  <ul className="space-y-2 mb-4">
                    {[
                      t('feature1'),
                      t('feature2'),
                      t('feature3'),
                      t('feature4'),
                      t('feature5'),
                    ].map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-[#9090A0] text-sm">
                        <Check className="w-4 h-4 text-[#10B981]" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full bg-[#06B6D4] hover:bg-[#0891B2] text-white"
                    onClick={() => onUseStrategy?.(strategy.id)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {strategy.isSubscribed ? t('subscribed') : t('useNow')}
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card className="glass-border-glow bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0] text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {t('createdAt')}
                      </span>
                      <span className="text-sm">
                        {strategy.createdAt ? new Date(strategy.createdAt).toLocaleDateString('zh-CN') : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0] text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {t('runningTime')}
                      </span>
                      <span className="text-sm">{getRunningDuration(strategy.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0] text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {t('riskLevel')}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        strategy.riskLevel === 'low' ? "bg-[#10B981]/20 text-[#10B981]" :
                        strategy.riskLevel === 'high' ? "bg-[#F43F5E]/20 text-[#F43F5E]" :
                        "bg-[#F59E0B]/20 text-[#F59E0B]"
                      )}>
                        {strategy.riskLevel === 'low' ? t('lowRisk') :
                         strategy.riskLevel === 'high' ? t('highRisk') : t('mediumRisk')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
  )
}
