'use client'

import { useState } from 'react'
import {
  RefreshCw,
  Square,
  Play,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Position {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  size: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

interface Trade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  timestamp: Date
}

interface TradingConsoleProps {
  accountBalance?: number
  positions?: Position[]
  recentTrades?: Trade[]
  botStatus?: 'running' | 'stopped'
  onStopAll?: () => void
  onStartBot?: () => void
  onRefresh?: () => void
}

// Mock data
const mockPositions: Position[] = [
  {
    id: '1',
    symbol: 'BTCUSDT',
    side: 'LONG',
    size: 0.25,
    entryPrice: 43250.0,
    currentPrice: 43890.5,
    pnl: 160.13,
    pnlPercent: 1.48,
  },
  {
    id: '2',
    symbol: 'ETHUSDT',
    side: 'SHORT',
    size: 2.5,
    entryPrice: 2650.0,
    currentPrice: 2680.25,
    pnl: -75.63,
    pnlPercent: -1.14,
  },
  {
    id: '3',
    symbol: 'SOLUSDT',
    side: 'LONG',
    size: 10,
    entryPrice: 98.5,
    currentPrice: 102.3,
    pnl: 38.0,
    pnlPercent: 3.86,
  },
]

const mockTrades: Trade[] = [
  {
    id: '1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 0.1,
    price: 43890.5,
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: '2',
    symbol: 'ETHUSDT',
    side: 'SELL',
    quantity: 0.5,
    price: 2680.25,
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: '3',
    symbol: 'SOLUSDT',
    side: 'BUY',
    quantity: 5,
    price: 102.3,
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
  },
  {
    id: '4',
    symbol: 'BTCUSDT',
    side: 'SELL',
    quantity: 0.05,
    price: 43750.0,
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
  },
]

export function TradingConsole({
  accountBalance = 12547.83,
  positions = mockPositions,
  recentTrades = mockTrades,
  botStatus: initialBotStatus = 'running',
  onStopAll,
  onStartBot,
  onRefresh,
}: TradingConsoleProps) {
  const [botStatus, setBotStatus] = useState(initialBotStatus)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0)

  const handleStopAll = () => {
    setBotStatus('stopped')
    onStopAll?.()
  }

  const handleStartBot = () => {
    setBotStatus('running')
    onStartBot?.()
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await onRefresh?.()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60)
    if (diff < 1) return '刚刚'
    if (diff < 60) return `${diff}分钟前`
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] font-sans">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0A0F]/80 border-b border-[#1E1E2E]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F8F8FC]">交易</h1>
            <p className="text-[#9090A0] text-sm mt-1">实时监控交易状态</p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-[#2A2A3A] text-[#F8F8FC] hover:bg-[#1E1E2E]"
            >
              <RefreshCw
                className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')}
              />
              刷新
            </Button>

            {botStatus === 'running' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStopAll}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Square className="w-4 h-4 mr-2" />
                全部停止
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleStartBot}
                className="bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
              >
                <Play className="w-4 h-4 mr-2" />
                启动机器人
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Top Row - Account Balance & Bot Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Account Balance */}
          <Card className="lg:col-span-2 bg-[#12121A]/80 backdrop-blur-xl border-[#1E1E2E] shadow-[0_0_30px_rgba(6,182,212,0.05)]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-base font-semibold text-[#F8F8FC]">
                  账户概览
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[#9090A0] text-sm mb-1">可用余额</p>
                  <p className="text-2xl font-bold text-[#F8F8FC]">
                    {formatCurrency(accountBalance)}
                  </p>
                  <p className="text-xs text-[#606070]">USDT</p>
                </div>

                <div>
                  <p className="text-[#9090A0] text-sm mb-1">未实现盈亏</p>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {totalUnrealizedPnL >= 0 ? '+' : ''}
                    {formatCurrency(totalUnrealizedPnL)}
                  </p>
                  <p className="text-xs text-[#606070]">
                    {((totalUnrealizedPnL / accountBalance) * 100).toFixed(2)}%
                  </p>
                </div>

                <div>
                  <p className="text-[#9090A0] text-sm mb-1">总权益</p>
                  <p className="text-2xl font-bold text-[#F8F8FC]">
                    {formatCurrency(accountBalance + totalUnrealizedPnL)}
                  </p>
                  <p className="text-xs text-[#606070]">USDT</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bot Status */}
          <Card className="bg-[#12121A]/80 backdrop-blur-xl border-[#1E1E2E] shadow-[0_0_30px_rgba(6,182,212,0.05)]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-base font-semibold text-[#F8F8FC]">
                  机器人状态
                </h2>
              </div>

              <div className="text-center">
                <div
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
                    botStatus === 'running'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  )}
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      botStatus === 'running'
                        ? 'bg-green-400 animate-pulse'
                        : 'bg-red-400'
                    )}
                  />
                  {botStatus === 'running' ? '运行中' : '已停止'}
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#9090A0]">活跃仓位</span>
                    <span className="text-[#F8F8FC]">{positions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9090A0]">运行时长</span>
                    <span className="text-[#F8F8FC]">2小时34分</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Positions */}
        <Card className="bg-[#12121A]/80 backdrop-blur-xl border-[#1E1E2E] shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-base font-semibold text-[#F8F8FC]">
                活跃仓位
              </h2>
              <span className="ml-auto text-sm text-[#9090A0]">
                {positions.length} 个持仓
              </span>
            </div>

            {positions.length === 0 ? (
              <div className="text-center py-8 text-[#606070]">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>暂无活跃仓位</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2A2A3A]">
                      <th className="text-left py-3 px-2 text-[#9090A0] font-medium text-sm">
                        交易对
                      </th>
                      <th className="text-left py-3 px-2 text-[#9090A0] font-medium text-sm">
                        方向
                      </th>
                      <th className="text-right py-3 px-2 text-[#9090A0] font-medium text-sm">
                        数量
                      </th>
                      <th className="text-right py-3 px-2 text-[#9090A0] font-medium text-sm">
                        开仓价
                      </th>
                      <th className="text-right py-3 px-2 text-[#9090A0] font-medium text-sm">
                        现价
                      </th>
                      <th className="text-right py-3 px-2 text-[#9090A0] font-medium text-sm">
                        盈亏
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position) => (
                      <tr
                        key={position.id}
                        className="border-b border-[#1E1E2E] hover:bg-[#1E1E2E]/50"
                      >
                        <td className="py-3 px-2">
                          <span className="font-medium text-[#F8F8FC]">
                            {position.symbol}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={cn(
                              'px-2 py-1 rounded text-xs font-medium',
                              position.side === 'LONG'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {position.side === 'LONG' ? '做多' : '做空'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-[#F8F8FC]">
                          {position.size}
                        </td>
                        <td className="py-3 px-2 text-right text-[#F8F8FC]">
                          {formatCurrency(position.entryPrice)}
                        </td>
                        <td className="py-3 px-2 text-right text-[#F8F8FC]">
                          {formatCurrency(position.currentPrice)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div
                            className={
                              position.pnl >= 0
                                ? 'text-green-400'
                                : 'text-red-400'
                            }
                          >
                            <div className="font-medium">
                              {position.pnl >= 0 ? '+' : ''}
                              {formatCurrency(position.pnl)}
                            </div>
                            <div className="text-xs">
                              {position.pnlPercent >= 0 ? '+' : ''}
                              {position.pnlPercent.toFixed(2)}%
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="bg-[#12121A]/80 backdrop-blur-xl border-[#1E1E2E] shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-base font-semibold text-[#F8F8FC]">
                最近成交
              </h2>
            </div>

            <div className="space-y-3">
              {recentTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between py-2 border-b border-[#1E1E2E] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'w-1.5 h-8 rounded-full',
                        trade.side === 'BUY' ? 'bg-green-400' : 'bg-red-400'
                      )}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#F8F8FC]">
                          {trade.symbol}
                        </span>
                        <span
                          className={cn(
                            'text-xs',
                            trade.side === 'BUY'
                              ? 'text-green-400'
                              : 'text-red-400'
                          )}
                        >
                          {trade.side === 'BUY' ? '买入' : '卖出'}
                        </span>
                      </div>
                      <div className="text-sm text-[#606070]">
                        {trade.quantity} @ {formatCurrency(trade.price)}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-[#9090A0]">
                    {formatTime(trade.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
