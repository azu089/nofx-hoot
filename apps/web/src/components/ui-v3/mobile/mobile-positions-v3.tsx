'use client'

import { useState } from 'react'
import {
  Clock,
  X,
  ChevronDown,
  Home,
  BarChart3,
  Layers,
  Wallet,
  User,
  Zap,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Activity
} from 'lucide-react'

interface Position {
  id: string
  symbol: string
  direction: 'long' | 'short'
  entryPrice: number
  currentPrice: number
  size: number
  pnl: number
  pnlPercent: number
  strategy: string
  stopLoss: number
  takeProfit: number
}

interface ExecutionLog {
  id: number
  time: string
  strategy: string
  action: string
  symbol: string
  status: 'success' | 'warning'
  message: string
}

interface ActiveStrategy {
  id: number
  name: string
  status: 'running' | 'paused'
  positions: number
  todayPnl: number
}

interface MobilePositionsV3Props {
  positions?: Position[]
  executionLogs?: ExecutionLog[]
  activeStrategies?: ActiveStrategy[]
  accountData?: {
    balance: number
    unrealizedPnl: number
    marginUsage: number
  }
  onClosePosition?: (id: string) => void
  onPauseStrategy?: (id: number) => void
  onResumeStrategy?: (id: number) => void
  onEmergencyCloseAll?: () => void
  onNavigate?: (tab: string) => void
}

const defaultPositions: Position[] = [
  {
    id: '1',
    symbol: 'BTC/USDT',
    direction: 'long',
    entryPrice: 43250.00,
    currentPrice: 43580.50,
    size: 0.25,
    pnl: 82.63,
    pnlPercent: 0.76,
    strategy: 'RSI 智能抄底',
    stopLoss: 41087.50,
    takeProfit: 47575.00
  },
  {
    id: '2',
    symbol: 'ETH/USDT',
    direction: 'short',
    entryPrice: 2650.30,
    currentPrice: 2598.75,
    size: 2.5,
    pnl: 128.88,
    pnlPercent: 1.95,
    strategy: 'MACD 趋势跟踪',
    stopLoss: 2782.82,
    takeProfit: 2385.27
  }
]

const defaultExecutionLogs: ExecutionLog[] = [
  { id: 1, time: '2分钟前', strategy: 'RSI 智能抄底', action: '开多', symbol: 'BTC/USDT', status: 'success', message: '已开仓 0.25 BTC' },
  { id: 2, time: '15分钟前', strategy: 'MACD 趋势跟踪', action: '开空', symbol: 'ETH/USDT', status: 'success', message: '已开仓 2.5 ETH' },
  { id: 3, time: '1小时前', strategy: 'RSI 智能抄底', action: '止盈', symbol: 'DOGE/USDT', status: 'success', message: '盈利 +$156.78' },
  { id: 4, time: '2小时前', strategy: 'BTC 网格策略', action: '跳过', symbol: 'BTC/USDT', status: 'warning', message: '余额不足' }
]

const defaultActiveStrategies: ActiveStrategy[] = [
  { id: 1, name: 'RSI 智能抄底', status: 'running', positions: 1, todayPnl: 82.63 },
  { id: 2, name: 'MACD 趋势跟踪', status: 'running', positions: 1, todayPnl: 128.88 },
  { id: 3, name: 'BTC 网格策略', status: 'paused', positions: 0, todayPnl: 0 }
]

const defaultAccountData = {
  balance: 12580.45,
  unrealizedPnl: 211.51,
  marginUsage: 45
}

export function MobilePositionsV3({
  positions = defaultPositions,
  executionLogs = defaultExecutionLogs,
  activeStrategies = defaultActiveStrategies,
  accountData = defaultAccountData,
  onClosePosition,
  onPauseStrategy,
  onResumeStrategy,
  onEmergencyCloseAll,
  onNavigate
}: MobilePositionsV3Props) {
  const [activeTab, setActiveTab] = useState<'positions' | 'logs' | 'strategies'>('positions')
  const [navTab, setNavTab] = useState('trading')

  const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0)

  const handleNavChange = (tabId: string) => {
    setNavTab(tabId)
    onNavigate?.(tabId)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] pb-20">
      {/* Header with Tabs */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#12121A]/80 border-b border-[#1E1E2E]">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold">交易中心</h1>
            <div className="text-right">
              <div className="text-xs text-[#9090A0]">总盈亏</div>
              <div className={`text-sm font-medium ${totalPnl >= 0 ? 'text-[#06B6D4]' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex space-x-1 bg-[#1E1E2E] rounded-lg p-1">
            {[
              { id: 'positions', label: '持仓' },
              { id: 'logs', label: '执行日志' },
              { id: 'strategies', label: '策略' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#06B6D4] text-white'
                    : 'text-[#9090A0] hover:text-[#F8F8FC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Account Overview Card */}
      <div className="p-4">
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs text-[#9090A0] mb-1">账户余额</div>
              <div className="text-lg font-semibold">${accountData.balance.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-[#9090A0] mb-1">未实现盈亏</div>
              <div className={`text-lg font-semibold ${accountData.unrealizedPnl >= 0 ? 'text-[#06B6D4]' : 'text-red-400'}`}>
                {accountData.unrealizedPnl >= 0 ? '+' : ''}${accountData.unrealizedPnl.toFixed(2)}
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#9090A0]">保证金使用率</span>
              <span className="text-xs text-[#F8F8FC]">{accountData.marginUsage}%</span>
            </div>
            <div className="w-full bg-[#1E1E2E] rounded-full h-2">
              <div
                className="bg-[#06B6D4] h-2 rounded-full transition-all duration-300"
                style={{ width: `${accountData.marginUsage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-3">
        {/* Positions Tab */}
        {activeTab === 'positions' && (
          positions.length > 0 ? (
            positions.map((position) => (
              <div key={position.id} className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{position.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      position.direction === 'long'
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'bg-red-400/20 text-red-400'
                    }`}>
                      {position.direction === 'long' ? '做多' : '做空'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#9090A0]">
                    <Zap className="w-3 h-3 text-[#06B6D4]" />
                    {position.strategy}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                  <div>
                    <div className="text-xs text-[#9090A0] mb-1">开仓价</div>
                    <div>${position.entryPrice.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#9090A0] mb-1">当前价</div>
                    <div>${position.currentPrice.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#9090A0] mb-1">止损</div>
                    <div className="text-red-400">${position.stopLoss.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#9090A0] mb-1">止盈</div>
                    <div className="text-green-400">${position.takeProfit.toLocaleString()}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-[#9090A0]">数量</div>
                    <div className="text-sm">{position.size}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#9090A0]">盈亏</div>
                    <div className={`text-sm font-medium ${position.pnl >= 0 ? 'text-[#06B6D4]' : 'text-red-400'}`}>
                      {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} ({position.pnl >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onClosePosition?.(position.id)}
                  className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  平仓
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Activity className="w-10 h-10 text-[#606070] mx-auto mb-3" />
              <div className="text-[#606070] mb-1">暂无持仓</div>
              <div className="text-xs text-[#606070]">策略触发信号后将自动开仓</div>
            </div>
          )
        )}

        {/* Execution Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            {executionLogs.map((log) => (
              <div key={log.id} className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-full flex-shrink-0 mt-0.5 ${
                    log.status === 'success' ? 'bg-green-400/10' : 'bg-yellow-400/10'
                  }`}>
                    {log.status === 'success' ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-yellow-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[#F8F8FC]">{log.strategy}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        log.action === '开多' ? 'bg-green-400/10 text-green-400' :
                        log.action === '开空' ? 'bg-red-400/10 text-red-400' :
                        log.action === '止盈' ? 'bg-cyan-400/10 text-cyan-400' :
                        'bg-yellow-400/10 text-yellow-400'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-[#606070]">{log.symbol}</span>
                    </div>
                    <p className="text-xs text-[#9090A0]">{log.message}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-[#606070]" />
                      <span className="text-xs text-[#606070]">{log.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Strategies Tab */}
        {activeTab === 'strategies' && (
          <div className="space-y-3">
            {activeStrategies.map((strategy) => (
              <div key={strategy.id} className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${strategy.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                    <span className="font-medium">{strategy.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => strategy.status === 'running' ? onPauseStrategy?.(strategy.id) : onResumeStrategy?.(strategy.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      strategy.status === 'running'
                        ? 'bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20'
                        : 'bg-green-400/10 text-green-400 hover:bg-green-400/20'
                    }`}
                  >
                    {strategy.status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9090A0]">{strategy.positions} 个持仓</span>
                  <span className={strategy.todayPnl >= 0 ? 'text-[#06B6D4]' : 'text-red-400'}>
                    今日 {strategy.todayPnl >= 0 ? '+' : ''}${strategy.todayPnl.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            {/* Emergency Close All Button */}
            <button
              type="button"
              onClick={onEmergencyCloseAll}
              className="w-full py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <AlertTriangle className="w-4 h-4" />
              紧急全部平仓
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-[#12121A]/95 border-t border-[#1E1E2E]">
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'home', icon: Home, label: '首页' },
            { id: 'trading', icon: BarChart3, label: '交易' },
            { id: 'strategies', icon: Layers, label: '策略' },
            { id: 'wallet', icon: Wallet, label: '钱包' },
            { id: 'me', icon: User, label: '我的' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavChange(item.id)}
              className="flex flex-col items-center py-2 px-3 min-w-0"
            >
              <item.icon className={`w-5 h-5 mb-1 ${navTab === item.id ? 'text-[#06B6D4]' : 'text-[#606070]'}`} />
              <span className={`text-xs ${navTab === item.id ? 'text-[#06B6D4]' : 'text-[#606070]'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
