'use client'

import { useState } from 'react'
import {
  Coins,
  TrendingUp,
  Lock,
  Gift,
  Star,
  Shield,
  Users,
  Crown,
  ChevronRight,
  Home,
  BarChart3,
  Layers,
  Wallet,
  User,
  Clock,
  Info
} from 'lucide-react'

interface StakeRecord {
  id: string
  amount: number
  stakedAt: string
  lockPeriod: number // 锁定期天数
  daysRemaining: number // 剩余解锁天数
  weight: number
  accumulatedRewards: number // USDT rewards
  status: 'locked' | 'unlocked'
}

// 质押周期选项
const stakingPeriods = [
  { id: '30', days: 30, label: '30天', weight: 1.0, apr: '8%' },
  { id: '90', days: 90, label: '90天', weight: 1.5, apr: '12%' },
  { id: '180', days: 180, label: '180天', weight: 2.0, apr: '18%' },
  { id: '365', days: 365, label: '365天', weight: 3.0, apr: '25%' },
]

interface MobileEcosystemV3Props {
  tokenPrice?: number
  priceChange24h?: number
  marketCap?: string
  totalStaked?: string
  userStaked?: number
  pendingRewardsUsdt?: number
  nextDistribution?: string
  stakeRecords?: StakeRecord[]
  onBuy?: () => void
  onSell?: () => void
  onStake?: (amount: number, periodDays: number) => void
  onUnstake?: (recordId: string) => void
  onClaimRewards?: () => void
  onNavigate?: (tab: string) => void
}

const leaderboardData = [
  { rank: 1, address: '0x1234...5678', staked: '2.5M', weight: '3.0x', rewards: '$1,234' },
  { rank: 2, address: '0x2345...6789', staked: '1.8M', weight: '2.8x', rewards: '$890' },
  { rank: 3, address: '0x3456...7890', staked: '1.2M', weight: '2.5x', rewards: '$543' },
]

const tokenBenefits = [
  { icon: TrendingUp, label: '燃油费分红', desc: '40% USDT' },
  { icon: Star, label: '策略折扣', desc: '订阅优惠' },
  { icon: Shield, label: '优先支持', desc: '专属客服' },
  { icon: Users, label: '治理投票', desc: '参与决策' },
]

export function MobileEcosystemV3({
  tokenPrice = 0.245,
  priceChange24h = 12.5,
  marketCap = '24.5M',
  totalStaked = '35.2M',
  userStaked = 12500,
  pendingRewardsUsdt = 234.56,
  nextDistribution = '周日 00:00',
  stakeRecords = [
    { id: '1', amount: 5000, stakedAt: '2025-12-01', lockPeriod: 90, daysRemaining: 45, weight: 1.5, accumulatedRewards: 45.23, status: 'locked' as const },
    { id: '2', amount: 7500, stakedAt: '2025-10-15', lockPeriod: 180, daysRemaining: 0, weight: 2.0, accumulatedRewards: 189.33, status: 'unlocked' as const },
  ],
  onBuy,
  onSell,
  onStake,
  onUnstake,
  onClaimRewards,
  onNavigate
}: MobileEcosystemV3Props) {
  const [activeTab, setActiveTab] = useState<'token' | 'staking' | 'leaderboard'>('token')
  const [navTab, setNavTab] = useState('ecosystem')
  const [selectedPeriod, setSelectedPeriod] = useState(stakingPeriods[1]) // Default 90 days
  const [stakeAmount, setStakeAmount] = useState('')

  const handleNavChange = (tabId: string) => {
    setNavTab(tabId)
    onNavigate?.(tabId)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] max-w-md mx-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E] px-4 py-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
          HOOT 生态
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 py-3 flex gap-2">
        {[
          { id: 'token', label: '代币' },
          { id: 'staking', label: '质押' },
          { id: 'leaderboard', label: '排行榜' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#06B6D4] text-black'
                : 'bg-[#12121A]/50 border border-[#1E1E2E] text-[#9090A0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {activeTab === 'token' && (
          <div className="space-y-4">
            {/* Token Hero Card */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-xl flex items-center justify-center border border-cyan-500/20">
                  <Coins className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">HOOT Token</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-cyan-400">${tokenPrice}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      priceChange24h >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {priceChange24h >= 0 ? '+' : ''}{priceChange24h}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                  <div className="text-lg font-semibold">${marketCap}</div>
                  <div className="text-xs text-[#606070]">市值</div>
                </div>
                <div className="text-center p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                  <div className="text-lg font-semibold">{totalStaked}</div>
                  <div className="text-xs text-[#606070]">总质押量</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBuy}
                  className="flex-1 bg-[#06B6D4] text-black py-3 rounded-xl font-semibold"
                >
                  买入
                </button>
                <button
                  type="button"
                  onClick={onSell}
                  className="flex-1 border border-[#2A2A3A] text-[#F8F8FC] py-3 rounded-xl font-semibold"
                >
                  卖出
                </button>
              </div>
            </div>

            {/* Claim Rewards Card - USDT */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold">领取分红</h3>
              </div>

              <div className="flex items-center justify-between mb-3 p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                <div>
                  <div className="text-2xl font-bold text-green-400">${pendingRewardsUsdt.toFixed(2)}</div>
                  <div className="text-xs text-[#606070]">待领取 USDT</div>
                </div>
                <button
                  type="button"
                  onClick={onClaimRewards}
                  disabled={pendingRewardsUsdt <= 0}
                  className={`px-4 py-2 rounded-xl font-medium text-sm ${
                    pendingRewardsUsdt > 0
                      ? 'bg-green-500 text-black'
                      : 'bg-[#2A2A3A] text-[#606070]'
                  }`}
                >
                  领取
                </button>
              </div>

              <div className="flex items-center justify-between p-2 bg-[#0A0A0F]/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#606070]" />
                  <span className="text-sm text-[#9090A0]">下次发放</span>
                </div>
                <span className="text-sm text-cyan-400">{nextDistribution}</span>
              </div>
            </div>

            {/* Token Benefits */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <h3 className="font-semibold mb-3">代币权益</h3>
              <div className="grid grid-cols-2 gap-3">
                {tokenBenefits.map((benefit, index) => (
                  <div key={index} className="p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                    <benefit.icon className="w-5 h-5 text-cyan-400 mb-2" />
                    <div className="text-sm font-medium">{benefit.label}</div>
                    <div className="text-xs text-[#606070]">{benefit.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staking' && (
          <div className="space-y-4">
            {/* Staking Overview */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold">质押概览</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                  <div className="text-lg font-semibold">{userStaked.toLocaleString()}</div>
                  <div className="text-xs text-[#606070]">我的总质押</div>
                </div>
                <div className="text-center p-3 bg-[#0A0A0F]/50 rounded-xl border border-green-500/30">
                  <div className="text-lg font-semibold text-green-400">${pendingRewardsUsdt.toFixed(2)}</div>
                  <div className="text-xs text-[#606070]">待领取 USDT</div>
                </div>
              </div>

              {/* 分红规则说明 */}
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#9090A0]">
                    燃油费 40% 分给质押用户，10% 回购销毁
                  </p>
                </div>
              </div>
            </div>

            {/* New Stake Form */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <h3 className="font-semibold mb-4">新建质押</h3>

              {/* Amount Input */}
              <div className="mb-4">
                <label htmlFor="mobile-stake-amount" className="text-sm text-[#9090A0] mb-2 block">质押数量</label>
                <div className="relative">
                  <input
                    id="mobile-stake-amount"
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="输入质押数量"
                    className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-4 py-3 text-[#F8F8FC] placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-400"
                  >
                    最大
                  </button>
                </div>
              </div>

              {/* Period Selection */}
              <div className="mb-4">
                <label className="text-sm text-[#9090A0] mb-2 block">锁定周期</label>
                <div className="grid grid-cols-2 gap-2">
                  {stakingPeriods.map((period) => (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedPeriod.id === period.id
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-[#1E1E2E] bg-[#0A0A0F]/50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm">{period.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          selectedPeriod.id === period.id
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-[#1E1E2E] text-[#9090A0]'
                        }`}>
                          {period.weight}x
                        </span>
                      </div>
                      <div className="text-xs text-[#606070]">年化 {period.apr}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onStake?.(Number(stakeAmount), selectedPeriod.days)}
                disabled={!stakeAmount || Number(stakeAmount) <= 0}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  stakeAmount && Number(stakeAmount) > 0
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-black'
                    : 'bg-[#2A2A3A] text-[#606070] cursor-not-allowed'
                }`}
              >
                确认质押
              </button>
            </div>

            {/* My Stake Records */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <h3 className="font-semibold mb-3">我的质押记录</h3>
              {stakeRecords.length > 0 ? (
                <div className="space-y-3">
                  {stakeRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            record.status === 'locked' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                          }`}>
                            {record.status === 'locked' ? (
                              <Lock className="w-4 h-4 text-yellow-400" />
                            ) : (
                              <Coins className="w-4 h-4 text-green-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium">{record.amount.toLocaleString()} HOOT</span>
                            <div className="text-xs text-[#606070]">{record.lockPeriod}天锁定</div>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-cyan-400">
                          {record.weight.toFixed(1)}x
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${record.status === 'locked' ? 'text-yellow-400' : 'text-green-400'}`}>
                          {record.status === 'locked' ? `${record.daysRemaining}天后解锁` : '可解押'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400">${record.accumulatedRewards.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => onUnstake?.(record.id)}
                            disabled={record.status === 'locked'}
                            className={`px-2 py-1 text-xs rounded ${
                              record.status === 'locked'
                                ? 'border border-[#2A2A3A] text-[#606070] cursor-not-allowed'
                                : 'border border-cyan-500/50 text-cyan-400'
                            }`}
                          >
                            {record.status === 'locked' ? '锁定中' : '解押'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Coins className="w-10 h-10 text-[#606070] mx-auto mb-2" />
                  <p className="text-[#9090A0] text-sm">暂无质押记录</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {/* Leaderboard */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold">质押排行榜</h3>
              </div>

              <div className="space-y-3">
                {leaderboardData.map((user) => (
                  <div
                    key={user.rank}
                    className="flex items-center justify-between p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        user.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                        user.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                        user.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                        'bg-[#2A2A3A] text-[#9090A0]'
                      }`}>
                        {user.rank}
                      </div>
                      <div>
                        <div className="font-mono text-sm">{user.address}</div>
                        <div className="text-xs text-[#606070]">{user.staked} HOOT</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-cyan-400">{user.weight}</div>
                      <div className="text-xs text-green-400">{user.rewards}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="w-full mt-4 py-3 text-center text-sm text-[#9090A0] hover:text-[#F8F8FC] transition-colors flex items-center justify-center gap-1"
              >
                查看完整排行榜
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* My Rank */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-cyan-500/30 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#9090A0] mb-1">我的排名</div>
                  <div className="text-2xl font-bold">#128</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#9090A0] mb-1">我的质押</div>
                  <div className="text-lg font-semibold text-cyan-400">{userStaked.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md backdrop-blur-xl bg-[#0A0A0F]/95 border-t border-[#1E1E2E]">
        <div className="grid grid-cols-5 py-2">
          {[
            { id: 'home', icon: Home, label: '首页' },
            { id: 'trading', icon: BarChart3, label: '交易' },
            { id: 'strategies', icon: Layers, label: '策略' },
            { id: 'wallet', icon: Wallet, label: '钱包' },
            { id: 'me', icon: User, label: '我的' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavChange(tab.id)}
              className={`flex flex-col items-center py-2 px-1 transition-colors ${
                navTab === tab.id ? 'text-[#06B6D4]' : 'text-[#606070]'
              }`}
            >
              <tab.icon className="w-5 h-5 mb-1" />
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
