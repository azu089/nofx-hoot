'use client'

import { useState } from 'react'
import { ChevronLeft, Star, Users, TrendingUp, Calendar, Shield, Clock, Play, Check, AlertCircle, Zap, Settings, Bell, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MobileNav } from './mobile-nav'
import { cn } from '@/lib/utils'

// 策略详情数据
const strategyData = {
  id: 1,
  name: 'RSI 智能抄底策略',
  author: 'Hoot Labs',
  authorVerified: true,
  description: '基于 RSI 超卖信号的智能抄底策略，结合多时间周期确认和动态止损，适合震荡市和回调买入。',
  tags: ['低风险', '现货', '抄底'],
  rating: 4.8,
  reviewCount: 256,
  users: 1234,

  performance: {
    monthlyReturn: 18.5,
    totalReturn: 156.8,
    maxDrawdown: -8.2,
    sharpeRatio: 2.1,
    winRate: 68.5,
  },

  supportedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'],

  // 策略功能特点（免费开箱即用）
  features: [
    { icon: Zap, label: '自动信号执行' },
    { icon: Target, label: '可配置止损止盈' },
    { icon: Bell, label: '实时交易通知' },
    { icon: Settings, label: '参数自定义' },
  ],

  monthlyReturns: [
    { month: '08', return: -3.2 },
    { month: '09', return: 18.7 },
    { month: '10', return: 8.9 },
    { month: '11', return: 22.1 },
    { month: '12', return: 15.3 },
    { month: '01', return: 10.8 },
  ],

  recentTrades: [
    { pair: 'BTC/USDT', side: 'buy', pnl: 2.68, date: '01-27' },
    { pair: 'ETH/USDT', side: 'buy', pnl: 2.98, date: '01-26' },
    { pair: 'SOL/USDT', side: 'buy', pnl: -3.35, date: '01-25' },
  ],
}

interface MobileStrategyDetailProps {
  onBack?: () => void
  onUseStrategy?: (strategyId: number) => void
}

export function MobileStrategyDetail({ onBack, onUseStrategy }: MobileStrategyDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trades'>('overview')

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans pb-32">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 sticky top-0 bg-[#0A0A0F]/80 backdrop-blur-lg z-40">
        <button type="button" onClick={onBack} className="p-1" aria-label="返回">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold truncate">{strategyData.name}</h1>
      </header>

      {/* Main Content */}
      <main className="px-4 space-y-4">
        {/* Strategy Header */}
        <Card className="bg-[#12121A] border-[#1E1E2E]">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {strategyData.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#06B6D4]/20 text-[#06B6D4]">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-[#9090A0] mb-3">
              <span className="flex items-center gap-1">
                by {strategyData.author}
                {strategyData.authorVerified && <Check className="w-3.5 h-3.5 text-[#10B981]" />}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-[#9090A0]">
                <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                {strategyData.rating} ({strategyData.reviewCount})
              </span>
              <span className="flex items-center gap-1 text-[#9090A0]">
                <Users className="w-4 h-4" />
                {strategyData.users.toLocaleString()} 使用者
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="bg-[#12121A] border-[#1E1E2E]">
            <CardContent className="p-2 text-center">
              <p className={cn(
                "text-lg font-mono font-bold",
                strategyData.performance.monthlyReturn >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
              )}>
                +{strategyData.performance.monthlyReturn}%
              </p>
              <p className="text-[#606070] text-[10px]">月化</p>
            </CardContent>
          </Card>
          <Card className="bg-[#12121A] border-[#1E1E2E]">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-mono font-bold text-[#F43F5E]">
                {strategyData.performance.maxDrawdown}%
              </p>
              <p className="text-[#606070] text-[10px]">回撤</p>
            </CardContent>
          </Card>
          <Card className="bg-[#12121A] border-[#1E1E2E]">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-mono font-bold">
                {strategyData.performance.winRate}%
              </p>
              <p className="text-[#606070] text-[10px]">胜率</p>
            </CardContent>
          </Card>
          <Card className="bg-[#12121A] border-[#1E1E2E]">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-mono font-bold">
                {strategyData.performance.sharpeRatio}
              </p>
              <p className="text-[#606070] text-[10px]">夏普</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-[#1E1E2E]">
          {[
            { id: 'overview', label: '概览' },
            { id: 'performance', label: '表现' },
            { id: 'trades', label: '交易' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "pb-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "text-[#F8F8FC] border-[#06B6D4]"
                  : "text-[#9090A0] border-transparent"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Description */}
            <Card className="bg-[#12121A] border-[#1E1E2E]">
              <CardContent className="p-3">
                <h3 className="font-medium text-sm mb-2">策略说明</h3>
                <p className="text-[#9090A0] text-xs leading-relaxed">
                  {strategyData.description}
                </p>
              </CardContent>
            </Card>

            {/* Supported Pairs */}
            <Card className="bg-[#12121A] border-[#1E1E2E]">
              <CardContent className="p-3">
                <h3 className="font-medium text-sm mb-2">支持交易对</h3>
                <div className="flex flex-wrap gap-2">
                  {strategyData.supportedPairs.map((pair) => (
                    <span key={pair} className="px-2 py-1 rounded-lg bg-[#1E1E2E] text-xs font-mono">
                      {pair}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Warning */}
            <Card className="bg-[#12121A] border-[#1E1E2E] border-l-4 border-l-[#F59E0B]">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                  <p className="text-[#9090A0] text-xs leading-relaxed">
                    历史收益不代表未来表现。量化交易存在风险，请谨慎投资。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-4">
            {/* Monthly Returns */}
            <Card className="bg-[#12121A] border-[#1E1E2E]">
              <CardContent className="p-3">
                <h3 className="font-medium text-sm mb-3">月度收益</h3>
                <div className="flex items-end gap-1.5 h-32">
                  {strategyData.monthlyReturns.map((item) => (
                    <div key={item.month} className="flex-1 flex flex-col items-center">
                      <div
                        className={cn(
                          "w-full rounded-t",
                          item.return >= 0 ? "bg-[#10B981]" : "bg-[#F43F5E]"
                        )}
                        style={{
                          height: `${Math.abs(item.return) * 3}px`,
                          marginTop: item.return < 0 ? '0' : 'auto'
                        }}
                      />
                      <p className="text-[#606070] text-[10px] mt-1">{item.month}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-[#12121A] border-[#1E1E2E]">
                <CardContent className="p-3">
                  <p className="text-[#9090A0] text-xs mb-1">累计收益</p>
                  <p className="font-mono font-bold text-[#10B981]">+{strategyData.performance.totalReturn}%</p>
                </CardContent>
              </Card>
              <Card className="bg-[#12121A] border-[#1E1E2E]">
                <CardContent className="p-3">
                  <p className="text-[#9090A0] text-xs mb-1">运行时长</p>
                  <p className="font-mono font-bold">8 个月</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="space-y-2">
            {strategyData.recentTrades.map((trade, index) => (
              <Card key={index} className="bg-[#12121A] border-[#1E1E2E]">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{trade.pair}</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px]",
                        trade.side === 'buy'
                          ? "bg-[#10B981]/20 text-[#10B981]"
                          : "bg-[#F43F5E]/20 text-[#F43F5E]"
                      )}>
                        {trade.side === 'buy' ? '买入' : '卖出'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-mono font-bold text-sm",
                        trade.pnl >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
                      )}>
                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl}%
                      </p>
                      <p className="text-[#606070] text-xs">{trade.date}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Fixed Bottom Bar - 免费开箱即用 */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-[#0A0A0F]/95 backdrop-blur-lg border-t border-[#1E1E2E]">
        {/* 功能特点 */}
        <div className="flex items-center justify-between mb-3 px-2">
          {strategyData.features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <feature.icon className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-[#9090A0] text-[10px]">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* 免费标签 + 使用按钮 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/30">
            <Check className="w-4 h-4 text-[#06B6D4]" />
            <span className="text-[#06B6D4] text-sm font-medium">免费 · 开箱即用</span>
          </div>
          <Button
            onClick={() => onUseStrategy?.(strategyData.id)}
            className="flex-1 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-black font-medium"
          >
            <Play className="w-4 h-4 mr-2" />
            立即使用
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeTab="strategies" />
    </div>
  )
}
