'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Target,
  Home,
  BarChart3,
  Layers,
  Wallet,
  User
} from 'lucide-react'

interface MobileDashboardV3Props {
  onNavigate?: (tab: string) => void
  onDeposit?: () => void
  onWithdraw?: () => void
  onViewPositions?: () => void
}

export function MobileDashboardV3({
  onNavigate,
  onDeposit,
  onWithdraw,
  onViewPositions
}: MobileDashboardV3Props) {
  const [activeTab, setActiveTab] = useState('home')

  // 计算问候语
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return '早上好'
    if (hour < 18) return '下午好'
    return '晚上好'
  })()

  const quickStats = [
    { label: '今日盈亏', value: '+$2,847.32', change: '+12.4%', positive: true },
    { label: '活跃策略', value: '8', change: '运行中', positive: true },
    { label: '胜率', value: '73.2%', change: '+2.1%', positive: true },
    { label: '交易次数', value: '156', change: '本月', positive: null }
  ]

  const activePositions = [
    { symbol: 'BTC/USDT', direction: 'long', pnl: '+8.42%', amount: '$12,450' },
    { symbol: 'ETH/USDT', direction: 'short', pnl: '-2.18%', amount: '$8,320' },
    { symbol: 'HOOT/USDT', direction: 'long', pnl: '+15.67%', amount: '$5,680' }
  ]

  const recentActivities = [
    { icon: TrendingUp, description: 'BTC/USDT 多头开仓', time: '2分钟前', positive: true },
    { icon: ArrowUpFromLine, description: '提取 USDT 500', time: '1小时前', positive: null },
    { icon: TrendingDown, description: 'ETH/USDT 空头平仓', time: '3小时前', positive: false }
  ]

  const navItems = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'trading', label: '交易', icon: BarChart3 },
    { id: 'strategies', label: '策略', icon: Layers },
    { id: 'wallet', label: '钱包', icon: Wallet },
    { id: 'me', label: '我的', icon: User }
  ]

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onNavigate?.(tabId)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] pb-20">
      {/* Greeting Header */}
      <div className="flex items-center justify-between p-4 pt-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#06B6D4] to-[#0891B2] flex items-center justify-center">
            <span className="text-sm font-semibold">H</span>
          </div>
          <span className="text-lg font-medium">{greeting}</span>
        </div>
        <div className="relative">
          <Bell className="w-6 h-6 text-[#9090A0]" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#06B6D4] rounded-full" />
        </div>
      </div>

      {/* Portfolio Hero Card */}
      <div className="mx-4 mb-6">
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <div className="text-center mb-6">
            <p className="text-[#9090A0] text-sm mb-2">总资产</p>
            <h2 className="text-3xl font-bold mb-2">$47,892.45</h2>
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-[#06B6D4] font-medium">+$3,247.82 (7.26%)</span>
            </div>
          </div>

          <div className="mb-6 p-4 bg-[#1E1E2E]/50 rounded-xl">
            <div className="flex justify-between items-center">
              <span className="text-[#9090A0]">HOOT 余额</span>
              <span className="font-semibold">12,847.32 HOOT</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onDeposit}
              className="flex-1 bg-[#06B6D4] hover:bg-[#0891B2] text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 min-h-[44px] transition-colors"
            >
              <ArrowDownToLine className="w-4 h-4" />
              充值
            </button>
            <button
              type="button"
              onClick={onWithdraw}
              className="flex-1 bg-[#2A2A3A] hover:bg-[#3A3A4A] text-[#F8F8FC] font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 min-h-[44px] transition-colors"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              提取
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="mx-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {quickStats.map((stat, index) => (
            <div key={index} className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
              <p className="text-[#9090A0] text-xs mb-1">{stat.label}</p>
              <p className="font-bold text-lg mb-1">{stat.value}</p>
              <p className={`text-xs ${
                stat.positive === true ? 'text-[#06B6D4]' :
                stat.positive === false ? 'text-red-400' : 'text-[#606070]'
              }`}>
                {stat.change}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Positions */}
      <div className="mx-4 mb-6">
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">持仓概览</h3>
            <button type="button" onClick={onViewPositions} className="text-[#06B6D4] text-sm">查看全部</button>
          </div>

          <div className="space-y-3">
            {activePositions.map((position, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-[#1E1E2E]/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{position.symbol}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      position.direction === 'long'
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'bg-red-400/20 text-red-400'
                    }`}>
                      {position.direction === 'long' ? '多头' : '空头'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${
                    position.pnl.startsWith('+') ? 'text-[#06B6D4]' : 'text-red-400'
                  }`}>
                    {position.pnl}
                  </p>
                  <p className="text-[#9090A0] text-xs">{position.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mx-4 mb-6">
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <h3 className="font-semibold mb-4">最近活动</h3>

          <div className="space-y-3">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-center gap-3 p-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.positive === true ? 'bg-[#06B6D4]/20' :
                  activity.positive === false ? 'bg-red-400/20' : 'bg-[#2A2A3A]'
                }`}>
                  <activity.icon className={`w-4 h-4 ${
                    activity.positive === true ? 'text-[#06B6D4]' :
                    activity.positive === false ? 'text-red-400' : 'text-[#9090A0]'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-[#606070] text-xs">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-[#12121A]/90 border-t border-[#1E1E2E]">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabChange(item.id)}
              className={`flex flex-col items-center gap-1 py-2 px-3 min-h-[44px] justify-center transition-colors ${
                activeTab === item.id ? 'text-[#06B6D4]' : 'text-[#9090A0]'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
