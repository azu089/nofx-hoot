'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Zap,
  Activity,
  BarChart3,
  Clock,
  ChevronRight,
  Layers,
  Key,
  Users,
  Sparkles,
  Gift,
  HelpCircle,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Settings
} from 'lucide-react'

interface Position {
  symbol: string
  side: 'buy' | 'sell'
  size: number
  entryPrice: number
  currentPrice: number
  pnl: number
}

interface Trade {
  time: string
  pair: string
  side: 'buy' | 'sell'
  amount: number
  price: number
  status: 'completed' | 'pending' | 'failed'
}

interface DashboardV3Props {
  portfolioValue?: number
  pnl24h?: { amount: number; percentage: number }
  usdtBalance?: number
  hootBalance?: number
  gasCardBalance?: number  // 点卡余额
  activeStrategies?: number
  tradesToday?: number
  positions?: Position[]
  recentTrades?: Trade[]
  onDeposit?: () => void
  onWithdraw?: () => void
  onStartTrading?: () => void
  onBrowseStrategies?: () => void
  onConnectExchange?: () => void
  onViewAllPositions?: () => void
  onViewAllTrades?: () => void
  // 5-grid quick start
  onGoToEcosystem?: () => void
  onGoToApiKeys?: () => void
  onGoToReferral?: () => void
  onGoToSettings?: () => void
  onGoToNotifications?: () => void
}

export function DashboardV3({
  portfolioValue = 125847.32,
  pnl24h = { amount: 2847.12, percentage: 2.31 },
  usdtBalance = 15420.50,
  hootBalance = 8750.25,
  gasCardBalance = 520.00,
  activeStrategies = 3,
  tradesToday = 12,
  positions = [
    { symbol: 'BTC/USDT', side: 'buy', size: 0.5, entryPrice: 43250, currentPrice: 44180, pnl: 465 },
    { symbol: 'ETH/USDT', side: 'sell', size: 2.1, entryPrice: 2680, currentPrice: 2645, pnl: 73.5 },
    { symbol: 'SOL/USDT', side: 'buy', size: 15, entryPrice: 98.5, currentPrice: 102.3, pnl: 57 }
  ],
  recentTrades = [
    { time: '14:32', pair: 'BTC/USDT', side: 'buy', amount: 0.1, price: 44180, status: 'completed' },
    { time: '14:28', pair: 'ETH/USDT', side: 'sell', amount: 0.5, price: 2645, status: 'completed' },
    { time: '14:15', pair: 'SOL/USDT', side: 'buy', amount: 5, price: 102.3, status: 'completed' },
    { time: '13:58', pair: 'AVAX/USDT', side: 'buy', amount: 10, price: 38.2, status: 'pending' },
    { time: '13:45', pair: 'DOT/USDT', side: 'sell', amount: 25, price: 7.85, status: 'completed' }
  ],
  onDeposit,
  onWithdraw,
  onStartTrading,
  onBrowseStrategies,
  onConnectExchange,
  onViewAllPositions,
  onViewAllTrades,
  onGoToEcosystem,
  onGoToApiKeys,
  onGoToReferral,
  onGoToSettings,
  onGoToNotifications
}: DashboardV3Props) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num)
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(num)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#F8F8FC]">首页</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-lg text-[#9090A0] hover:text-[#F8F8FC] transition-colors">
              <Clock className="w-4 h-4 inline mr-2" />
              实时数据
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero Asset Card */}
          <div className="lg:col-span-2">
            <div className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-[#F8F8FC]">总资产价值</h2>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#06B6D4]" />
                  <span className="text-sm text-[#9090A0]">实时更新</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-4xl md:text-5xl font-bold text-[#F8F8FC] mb-2">
                  ${formatNumber(portfolioValue)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg text-[#9090A0]">24小时盈亏:</span>
                  <div className={`flex items-center gap-1 ${pnl24h.percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnl24h.percentage >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    <span className="text-lg font-semibold">
                      {pnl24h.percentage >= 0 ? '+' : ''}{formatCurrency(pnl24h.amount)} ({pnl24h.percentage >= 0 ? '+' : ''}{pnl24h.percentage}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Mini Chart Placeholder */}
              <div className="h-24 bg-[#0A0A0F]/50 rounded-lg flex items-center justify-center border border-[#1E1E2E]">
                <BarChart3 className="w-8 h-8 text-[#606070]" />
                <span className="ml-2 text-[#606070]">资产走势图</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Card */}
          <div className="space-y-6">
            <div className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
              <h3 className="text-lg font-semibold text-[#F8F8FC] mb-4">快速统计</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1E1E2E]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#10B981]/20 rounded-lg flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-[#10B981]" />
                    </div>
                    <span className="text-[#9090A0] text-sm">可用 USDT</span>
                  </div>
                  <span className="font-semibold text-[#F8F8FC]">${formatNumber(usdtBalance)}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1E1E2E]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#06B6D4]/20 rounded-lg flex items-center justify-center overflow-hidden">
                      <Image src="/icons/hoot/token.png" alt="HOOT" width={20} height={20} className="rounded-full" />
                    </div>
                    <span className="text-[#9090A0] text-sm">HOOT 余额</span>
                  </div>
                  <span className="font-semibold text-[#F8F8FC]">{formatNumber(hootBalance)}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1E1E2E]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#F59E0B]/20 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-[#F59E0B]" />
                    </div>
                    <span className="text-[#9090A0] text-sm">点卡余额</span>
                  </div>
                  <span className="font-semibold text-[#F8F8FC]">${formatNumber(gasCardBalance)}</span>
                </div>

                <div className="h-px bg-[#1E1E2E] my-2" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#0A0A0F]/50 border border-[#1E1E2E]">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-[#8B5CF6]" />
                      <span className="text-[#9090A0] text-xs">活跃策略</span>
                    </div>
                    <span className="text-lg font-bold text-[#F8F8FC]">{activeStrategies}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0A0A0F]/50 border border-[#1E1E2E]">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-4 h-4 text-[#06B6D4]" />
                      <span className="text-[#9090A0] text-xs">今日交易</span>
                    </div>
                    <span className="text-lg font-bold text-[#F8F8FC]">{tradesToday}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions - 6宫格 Quick Start */}
            <div className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
              <h3 className="text-lg font-semibold text-[#F8F8FC] mb-4">快速开始</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* 生态 */}
                <button
                  type="button"
                  onClick={onGoToEcosystem}
                  className="flex flex-col items-center justify-center p-4 bg-[#0A0A0F]/50 hover:bg-[#1E1E2E] border border-[#1E1E2E] hover:border-[#2A2A3A] rounded-xl transition-all group"
                >
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-2 group-hover:bg-cyan-500/20 transition-colors">
                    <Layers className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="text-sm font-medium text-[#9090A0] group-hover:text-[#F8F8FC]">生态</span>
                </button>

                {/* API Keys */}
                <button
                  type="button"
                  onClick={onGoToApiKeys}
                  className="flex flex-col items-center justify-center p-4 bg-[#0A0A0F]/50 hover:bg-[#1E1E2E] border border-[#1E1E2E] hover:border-[#2A2A3A] rounded-xl transition-all group"
                >
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mb-2 group-hover:bg-purple-500/20 transition-colors">
                    <Key className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-[#9090A0] group-hover:text-[#F8F8FC]">API</span>
                </button>

                {/* 邀请 */}
                <button
                  type="button"
                  onClick={onGoToReferral}
                  className="flex flex-col items-center justify-center p-4 bg-[#0A0A0F]/50 hover:bg-[#1E1E2E] border border-[#1E1E2E] hover:border-[#2A2A3A] rounded-xl transition-all group"
                >
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-2 group-hover:bg-green-500/20 transition-colors">
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-sm font-medium text-[#9090A0] group-hover:text-[#F8F8FC]">邀请</span>
                </button>

                {/* 通知 */}
                <button
                  type="button"
                  onClick={onGoToNotifications}
                  className="flex flex-col items-center justify-center p-4 bg-[#0A0A0F]/50 hover:bg-[#1E1E2E] border border-[#1E1E2E] hover:border-[#2A2A3A] rounded-xl transition-all group"
                >
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-2 group-hover:bg-blue-500/20 transition-colors">
                    <Bell className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-[#9090A0] group-hover:text-[#F8F8FC]">通知</span>
                </button>

                {/* 设置 */}
                <button
                  type="button"
                  onClick={onGoToSettings}
                  className="flex flex-col items-center justify-center p-4 bg-[#0A0A0F]/50 hover:bg-[#1E1E2E] border border-[#1E1E2E] hover:border-[#2A2A3A] rounded-xl transition-all group"
                >
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center mb-2 group-hover:bg-orange-500/20 transition-colors">
                    <Settings className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className="text-sm font-medium text-[#9090A0] group-hover:text-[#F8F8FC]">设置</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Positions */}
        <div className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#F8F8FC]">当前持仓</h2>
            <button
              type="button"
              onClick={onViewAllPositions || onStartTrading}
              className="text-[#06B6D4] hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E1E2E]">
                    <th className="text-left py-3 text-[#9090A0] font-medium">交易对</th>
                    <th className="text-left py-3 text-[#9090A0] font-medium">方向</th>
                    <th className="text-right py-3 text-[#9090A0] font-medium">数量</th>
                    <th className="text-right py-3 text-[#9090A0] font-medium">入场价</th>
                    <th className="text-right py-3 text-[#9090A0] font-medium">当前价</th>
                    <th className="text-right py-3 text-[#9090A0] font-medium">盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position, index) => (
                    <tr key={index} className="border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/30 transition-colors">
                      <td className="py-4 text-[#F8F8FC] font-medium">{position.symbol}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          position.side === 'buy'
                            ? 'bg-green-400/20 text-green-400'
                            : 'bg-red-400/20 text-red-400'
                        }`}>
                          {position.side === 'buy' ? '做多' : '做空'}
                        </span>
                      </td>
                      <td className="py-4 text-right text-[#F8F8FC]">{position.size}</td>
                      <td className="py-4 text-right text-[#F8F8FC]">${formatNumber(position.entryPrice)}</td>
                      <td className="py-4 text-right text-[#F8F8FC]">${formatNumber(position.currentPrice)}</td>
                      <td className={`py-4 text-right font-medium ${
                        position.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {position.pnl >= 0 ? '+' : ''}${formatNumber(position.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-[#606070] mx-auto mb-4" />
              <p className="text-[#9090A0]">暂无持仓</p>
              <button
                type="button"
                onClick={onStartTrading}
                className="mt-4 text-cyan-400 hover:text-cyan-300 font-medium"
              >
                开始交易
              </button>
            </div>
          )}
        </div>

        {/* Recent Trades */}
        <div className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#F8F8FC]">最近交易</h2>
            <button
              type="button"
              onClick={onViewAllTrades || onStartTrading}
              className="text-[#06B6D4] hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {recentTrades.map((trade, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]/50 hover:border-[#2A2A3A] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-[#606070] text-sm font-mono">{trade.time}</div>
                  <div className="text-[#F8F8FC] font-medium">{trade.pair}</div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    trade.side === 'buy'
                      ? 'bg-green-400/20 text-green-400'
                      : 'bg-red-400/20 text-red-400'
                  }`}>
                    {trade.side === 'buy' ? '买入' : '卖出'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div className="text-[#F8F8FC]">{trade.amount}</div>
                  <div className="text-[#9090A0]">${formatNumber(trade.price)}</div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    trade.status === 'completed'
                      ? 'bg-green-400/20 text-green-400'
                      : trade.status === 'pending'
                      ? 'bg-yellow-400/20 text-yellow-400'
                      : 'bg-red-400/20 text-red-400'
                  }`}>
                    {trade.status === 'completed' ? '已完成' : trade.status === 'pending' ? '待处理' : '失败'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
