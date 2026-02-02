'use client'

import { useState } from 'react'
import { ArrowLeft, Star, Users, Calendar, Shield, Clock, Play, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/provider'

// API 返回的策略数据类型
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
}

// 默认模拟数据（后端暂未提供的字段）
const defaultMockData = {
  author: 'Hoot Labs',
  authorVerified: true,
  tags: ['量化', '现货'],
  rating: 4.8,
  reviewCount: 256,

  // 性能指标
  performance: {
    monthlyReturn: 18.5,
    totalReturn: 156.8,
    maxDrawdown: -8.2,
    sharpeRatio: 2.1,
    winRate: 68.5,
    profitFactor: 2.3,
    avgHoldingDays: 3.2,
    totalTrades: 486,
  },

  // 支持的交易对
  supportedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'],

  // 月度收益
  monthlyReturns: [
    { month: '2025-07', return: 12.5 },
    { month: '2025-08', return: -3.2 },
    { month: '2025-09', return: 18.7 },
    { month: '2025-10', return: 8.9 },
    { month: '2025-11', return: 22.1 },
    { month: '2025-12', return: 15.3 },
    { month: '2026-01', return: 10.8 },
  ],

  // 最近交易
  recentTrades: [
    { pair: 'BTC/USDT', side: 'buy' as const, entry: 42150, exit: 43280, pnl: 2.68, date: '2026-01-27' },
    { pair: 'ETH/USDT', side: 'buy' as const, entry: 2350, exit: 2420, pnl: 2.98, date: '2026-01-26' },
    { pair: 'SOL/USDT', side: 'buy' as const, entry: 98.5, exit: 95.2, pnl: -3.35, date: '2026-01-25' },
    { pair: 'BNB/USDT', side: 'buy' as const, entry: 315, exit: 328, pnl: 4.13, date: '2026-01-24' },
    { pair: 'XRP/USDT', side: 'buy' as const, entry: 0.52, exit: 0.55, pnl: 5.77, date: '2026-01-23' },
  ],
}

interface StrategyDetailPageProps {
  strategy?: StrategyApiData
  isLoading?: boolean
  onBack?: () => void
  onUseStrategy?: (id: string) => void
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

  // 合并真实数据和默认数据
  const strategyData = {
    id: strategy.id,
    name: strategy.name,
    description: strategy?.description || '',
    subscribers: strategy?.subscriberCount || 0,
    createdAt: strategy?.createdAt ? new Date(strategy.createdAt).toLocaleDateString('zh-CN') : '-',
    isSubscribed: strategy?.isSubscribed || false,
    riskLevel: strategy?.riskLevel || 'medium',
    ...defaultMockData,
  }

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
                <h1 className="text-2xl font-bold">{strategyData.name}</h1>
                {strategyData.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#06B6D4]/20 text-[#06B6D4]">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm text-[#9090A0]">
                <span className="flex items-center gap-1">
                  by {strategyData.author}
                  {strategyData.authorVerified && (
                    <Check className="w-4 h-4 text-[#10B981]" />
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                  {strategyData.rating} ({strategyData.reviewCount})
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {strategyData.subscribers.toLocaleString()}
                </span>
              </div>
            </div>
            <Button
              className="bg-[#06B6D4] hover:bg-[#0891B2] text-white"
              onClick={() => onUseStrategy?.(strategyData.id)}
            >
              <Play className="w-4 h-4 mr-2" />
              {strategyData.isSubscribed ? t('subscribed') : t('useNow')}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="col-span-2 space-y-6">
              {/* Quick Stats - 合并为1个卡片 */}
              <Card className="bg-[#12121A] border-[#1E1E2E]">
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className={cn(
                        "text-2xl font-mono font-bold",
                        strategyData.performance.monthlyReturn >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
                      )}>
                        {strategyData.performance.monthlyReturn >= 0 ? '+' : ''}{strategyData.performance.monthlyReturn}%
                      </p>
                      <p className="text-[#9090A0] text-xs mt-1">{t('monthlyReturn')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-mono font-bold text-[#F43F5E]">
                        {strategyData.performance.maxDrawdown}%
                      </p>
                      <p className="text-[#9090A0] text-xs mt-1">{t('maxDrawdown')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-mono font-bold">
                        {strategyData.performance.winRate}%
                      </p>
                      <p className="text-[#9090A0] text-xs mt-1">{t('winRate')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-mono font-bold">
                        {strategyData.performance.sharpeRatio}
                      </p>
                      <p className="text-[#9090A0] text-xs mt-1">{t('sharpeRatio')}</p>
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
                  <Card className="bg-[#12121A] border-[#1E1E2E]">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">{t('strategyDescription')}</h3>
                      <p className="text-[#9090A0] text-sm leading-relaxed">
                        {strategyData.description}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Supported Pairs */}
                  <Card className="bg-[#12121A] border-[#1E1E2E]">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-3">{t('supportedPairs')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {strategyData.supportedPairs.map((pair) => (
                          <span key={pair} className="px-3 py-1.5 rounded-lg bg-[#1E1E2E] text-sm font-mono">
                            {pair}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Risk Warning */}
                  <Card className="bg-[#12121A] border-[#1E1E2E] border-l-4 border-l-[#F59E0B]">
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
                  {/* Monthly Returns Chart Placeholder */}
                  <Card className="bg-[#12121A] border-[#1E1E2E]">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-4">{t('monthlyReturns')}</h3>
                      <div className="flex items-end gap-2 h-48">
                        {strategyData.monthlyReturns.map((item) => (
                          <div key={item.month} className="flex-1 flex flex-col items-center">
                            <div
                              className={cn(
                                "w-full rounded-t",
                                item.return >= 0 ? "bg-[#10B981]" : "bg-[#F43F5E]"
                              )}
                              style={{
                                height: `${Math.abs(item.return) * 4}px`,
                                marginTop: item.return < 0 ? '0' : 'auto'
                              }}
                            />
                            <p className="text-[#606070] text-xs mt-2">{item.month.slice(5)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detailed Stats */}
                  <Card className="bg-[#12121A] border-[#1E1E2E]">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-4">{t('detailedStats')}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                          <span className="text-[#9090A0] text-sm">{t('totalReturn')}</span>
                          <span className="font-mono font-bold text-[#10B981]">
                            +{strategyData.performance.totalReturn}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                          <span className="text-[#9090A0] text-sm">{t('profitFactor')}</span>
                          <span className="font-mono font-bold">
                            {strategyData.performance.profitFactor}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                          <span className="text-[#9090A0] text-sm">{t('avgHoldingDays')}</span>
                          <span className="font-mono font-bold">
                            {strategyData.performance.avgHoldingDays} {t('days')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[#1E1E2E]">
                          <span className="text-[#9090A0] text-sm">{t('totalTrades')}</span>
                          <span className="font-mono font-bold">
                            {strategyData.performance.totalTrades}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'trades' && (
                <Card className="bg-[#12121A] border-[#1E1E2E]">
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1E1E2E]">
                          <th className="text-left p-4 text-[#9090A0] text-xs font-medium">{t('pair')}</th>
                          <th className="text-left p-4 text-[#9090A0] text-xs font-medium">{t('side')}</th>
                          <th className="text-right p-4 text-[#9090A0] text-xs font-medium">{t('entry')}</th>
                          <th className="text-right p-4 text-[#9090A0] text-xs font-medium">{t('exit')}</th>
                          <th className="text-right p-4 text-[#9090A0] text-xs font-medium">{t('pnl')}</th>
                          <th className="text-right p-4 text-[#9090A0] text-xs font-medium">{t('date')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strategyData.recentTrades.map((trade, index) => (
                          <tr key={index} className="border-b border-[#1E1E2E] last:border-0">
                            <td className="p-4 font-mono text-sm">{trade.pair}</td>
                            <td className="p-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-xs",
                                trade.side === 'buy'
                                  ? "bg-[#10B981]/20 text-[#10B981]"
                                  : "bg-[#F43F5E]/20 text-[#F43F5E]"
                              )}>
                                {trade.side === 'buy' ? t('buy') : t('sell')}
                              </span>
                            </td>
                            <td className="p-4 text-right font-mono text-sm">${trade.entry.toLocaleString()}</td>
                            <td className="p-4 text-right font-mono text-sm">${trade.exit.toLocaleString()}</td>
                            <td className={cn(
                              "p-4 text-right font-mono font-bold text-sm",
                              trade.pnl >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
                            )}>
                              {trade.pnl >= 0 ? '+' : ''}{trade.pnl}%
                            </td>
                            <td className="p-4 text-right text-[#9090A0] text-sm">{trade.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Use Strategy */}
            <div className="space-y-4">
              {/* Free Badge & Features */}
              <Card className="bg-[#12121A] border-[#1E1E2E]">
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
                    onClick={() => onUseStrategy?.(strategyData.id)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {strategyData.isSubscribed ? t('subscribed') : t('useNow')}
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card className="bg-[#12121A] border-[#1E1E2E]">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0] text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {t('createdAt')}
                      </span>
                      <span className="text-sm">{strategyData.createdAt}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0] text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {t('runningTime')}
                      </span>
                      <span className="text-sm">8 {t('months')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0] text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {t('riskLevel')}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        strategyData.riskLevel === 'low' ? "bg-[#10B981]/20 text-[#10B981]" :
                        strategyData.riskLevel === 'high' ? "bg-[#F43F5E]/20 text-[#F43F5E]" :
                        "bg-[#F59E0B]/20 text-[#F59E0B]"
                      )}>
                        {strategyData.riskLevel === 'low' ? t('lowRisk') :
                         strategyData.riskLevel === 'high' ? t('highRisk') : t('mediumRisk')}
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
