'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  TrendingUp,
  Lock,
  Gift,
  Crown,
  ChevronRight,
  Clock,
  Percent,
  Vote,
  Zap,
  History
} from 'lucide-react'

interface StakeRecord {
  id: string
  amount: number
  lockPeriod: number
  stakeDate: string
  unlockDate: string
  weight: number
  rewards: number
  status: 'staking' | 'unlocked' | 'history'
}

interface DividendRecord {
  id: string
  date: string
  amount: number
  source: string
}

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
  circulatingSupply?: string
  totalSupply?: string
  totalStaked?: string
  userStaked?: number
  pendingRewards?: number
  nextDistribution?: string
  stakeRecords?: StakeRecord[]
  dividendRecords?: DividendRecord[]
  onStake?: (amount: number, periodDays: number) => void
  onUnstake?: (recordId: string) => void
  onClaimRewards?: () => void
}

const leaderboardData = [
  { rank: 1, address: '0x1234...5678', staked: '2.5M', weight: '3.0x', rewards: '$1,234' },
  { rank: 2, address: '0x2345...6789', staked: '1.8M', weight: '2.8x', rewards: '$890' },
  { rank: 3, address: '0x3456...7890', staked: '1.2M', weight: '2.5x', rewards: '$543' },
  { rank: 4, address: '0x4567...8901', staked: '980K', weight: '2.2x', rewards: '$321' },
  { rank: 5, address: '0x5678...9012', staked: '750K', weight: '2.0x', rewards: '$245' },
]

const defaultDividendRecords: DividendRecord[] = [
  { id: '1', date: '2024-01-21', amount: 125.50, source: '平台手续费分红' },
  { id: '2', date: '2024-01-14', amount: 98.30, source: '平台手续费分红' },
  { id: '3', date: '2024-01-07', amount: 112.80, source: '平台手续费分红' },
]

export function MobileEcosystemV3({
  tokenPrice = 0.245,
  priceChange24h = 12.5,
  marketCap = '24.5M',
  circulatingSupply = '45.2M',
  totalSupply = '100M',
  totalStaked = '35.2M',
  userStaked = 12500,
  pendingRewards = 234.56,
  nextDistribution = '周日 00:00',
  stakeRecords = [
    { id: '1', amount: 5000, lockPeriod: 90, stakeDate: '2025-01-15', unlockDate: '2025-04-15', weight: 1.5, rewards: 45.23, status: 'staking' as const },
    { id: '2', amount: 8000, lockPeriod: 180, stakeDate: '2024-12-01', unlockDate: '2025-05-30', weight: 2.0, rewards: 120.50, status: 'staking' as const },
    { id: '3', amount: 3000, lockPeriod: 90, stakeDate: '2024-10-01', unlockDate: '2025-01-01', weight: 1.5, rewards: 89.12, status: 'unlocked' as const },
    { id: '4', amount: 2000, lockPeriod: 90, stakeDate: '2025-06-01', unlockDate: '2025-09-01', weight: 1.5, rewards: 56.78, status: 'history' as const },
    { id: '5', amount: 4000, lockPeriod: 90, stakeDate: '2025-03-15', unlockDate: '2025-06-15', weight: 1.5, rewards: 89.12, status: 'history' as const },
  ],
  dividendRecords = defaultDividendRecords,
  onStake,
  onUnstake: _onUnstake,
  onClaimRewards
}: MobileEcosystemV3Props) {
  void _onUnstake // 后续实现解押功能时使用
  const [activeTab, setActiveTab] = useState<'token' | 'staking' | 'leaderboard'>('token')
  const [stakingSubTab, setStakingSubTab] = useState<'stake' | 'staking' | 'history' | 'dividends'>('stake')
  const [selectedPeriod, setSelectedPeriod] = useState(stakingPeriods[1])
  const [stakeAmount, setStakeAmount] = useState('')

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      {/* Sub Tab - 使用下划线样式区分主Tab */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex border-b border-[#1E1E2E]">
          {[
            { id: 'token', label: '代币' },
            { id: 'staking', label: '质押' },
            { id: 'leaderboard', label: '排行' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-[#06B6D4]'
                  : 'text-[#94A3B8]'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#06B6D4] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {/* Token Tab */}
        {activeTab === 'token' && (
          <>
            {/* Token Hero Card */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              {/* Token Info with Image */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src="/icons/hoot/logo.png"
                    alt="HOOT"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-[#94A3B8]">HOOT</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">${tokenPrice}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      priceChange24h >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                    }`}>
                      {priceChange24h >= 0 ? '+' : ''}{priceChange24h}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats 2x2 Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0A0A0F]/50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-semibold">${marketCap}</div>
                  <div className="text-[10px] text-[#94A3B8]">市值</div>
                </div>
                <div className="bg-[#0A0A0F]/50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-semibold">{circulatingSupply}</div>
                  <div className="text-[10px] text-[#94A3B8]">流通量</div>
                </div>
                <div className="bg-[#0A0A0F]/50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-semibold">{totalSupply}</div>
                  <div className="text-[10px] text-[#94A3B8]">总供应量</div>
                </div>
                <div className="bg-[#0A0A0F]/50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-semibold">{totalStaked}</div>
                  <div className="text-[10px] text-[#94A3B8]">总质押</div>
                </div>
              </div>
            </div>

            {/* Rewards Card */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Gift className="w-4 h-4 text-[#22C55E]" />
                    <span className="text-sm text-[#94A3B8]">待领取分红</span>
                  </div>
                  <div className="text-2xl font-bold text-[#22C55E]">${pendingRewards.toFixed(2)}</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-[#94A3B8]">
                    <Clock className="w-3 h-3" />
                    <span>下次 {nextDistribution}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClaimRewards}
                  disabled={pendingRewards <= 0}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
                    pendingRewards > 0
                      ? 'bg-[#22C55E] text-black'
                      : 'bg-[#1A1A24] text-[#94A3B8]'
                  }`}
                >
                  领取
                </button>
              </div>
            </div>

            {/* 燃油费收入分红 Info Banner */}
            <div className="p-3 bg-gradient-to-r from-cyan-500/10 to-cyan-400/5 border border-cyan-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="font-semibold text-xs">燃油费收入分红</div>
                  <div className="text-[10px] text-[#94A3B8]">燃油费收入的 40% 分配给质押用户，10% 用于代币回购销毁</div>
                </div>
              </div>
            </div>

            {/* Benefits Grid - 4 Icon Cards */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#0A0A0F]/50 rounded-lg p-2.5 text-center">
                  <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                    <Percent className="w-4 h-4 text-[#22C55E]" />
                  </div>
                  <div className="text-[10px] text-white">40% 分红</div>
                </div>
                <div className="bg-[#0A0A0F]/50 rounded-lg p-2.5 text-center">
                  <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[#06B6D4]" />
                  </div>
                  <div className="text-[10px] text-white">订阅折扣</div>
                </div>
                <div className="bg-[#0A0A0F]/50 rounded-lg p-2.5 text-center">
                  <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                    <Vote className="w-4 h-4 text-[#8B5CF6]" />
                  </div>
                  <div className="text-[10px] text-white">治理投票</div>
                </div>
                <div className="bg-[#0A0A0F]/50 rounded-lg p-2.5 text-center">
                  <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <div className="text-[10px] text-white">优先参与</div>
                </div>
              </div>
            </div>

            {/* 代币分配 Pie Chart */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <h3 className="text-sm font-semibold mb-3">代币分配</h3>
              <div className="flex items-center gap-4">
                {/* Pie Chart */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#1E1E2E" strokeWidth="4" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#06B6D4" strokeWidth="4" strokeDasharray="40 60" strokeLinecap="round" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#22D3EE" strokeWidth="4" strokeDasharray="20 80" strokeDashoffset="-40" strokeLinecap="round" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#67E8F9" strokeWidth="4" strokeDasharray="25 75" strokeDashoffset="-60" strokeLinecap="round" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#A5F3FC" strokeWidth="4" strokeDasharray="15 85" strokeDashoffset="-85" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-xs font-bold">100M</div>
                      <div className="text-[8px] text-[#94A3B8]">总量</div>
                    </div>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#06B6D4]" />
                      <span className="text-[10px] text-[#94A3B8]">社区 40%</span>
                    </div>
                    <span className="text-[10px] text-cyan-400">40M</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#22D3EE]" />
                      <span className="text-[10px] text-[#94A3B8]">团队 20%</span>
                    </div>
                    <span className="text-[10px] text-cyan-400">20M</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#67E8F9]" />
                      <span className="text-[10px] text-[#94A3B8]">投资者 25%</span>
                    </div>
                    <span className="text-[10px] text-cyan-400">25M</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#A5F3FC]" />
                      <span className="text-[10px] text-[#94A3B8]">国库 15%</span>
                    </div>
                    <span className="text-[10px] text-cyan-400">15M</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Staking Tab */}
        {activeTab === 'staking' && (
          <>
            {/* Overview */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0A0A0F]/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{userStaked.toLocaleString()}</div>
                  <div className="text-xs text-[#94A3B8]">我的质押</div>
                </div>
                <div className="bg-[#0A0A0F]/50 rounded-lg p-3 text-center border border-[#22C55E]/20">
                  <div className="text-lg font-bold text-[#22C55E]">${pendingRewards.toFixed(2)}</div>
                  <div className="text-xs text-[#94A3B8]">待领取</div>
                </div>
              </div>
            </div>

            {/* Staking Sub-tabs - 4 Tabs */}
            <div className="flex gap-1 bg-[#12121A]/50 rounded-lg p-1">
              {[
                { id: 'stake', label: '质押' },
                { id: 'staking', label: '质押中', count: stakeRecords.filter(r => r.status === 'staking' || r.status === 'unlocked').length },
                { id: 'history', label: '历史质押', count: stakeRecords.filter(r => r.status === 'history').length },
                { id: 'dividends', label: '分红记录' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStakingSubTab(tab.id as typeof stakingSubTab)}
                  className={`flex-1 py-1.5 px-1 rounded-md text-[10px] font-medium transition-colors ${
                    stakingSubTab === tab.id
                      ? 'bg-[#06B6D4] text-black'
                      : 'text-[#94A3B8]'
                  }`}
                >
                  {tab.label}
                  {'count' in tab && tab.count !== undefined && (
                    <span className="ml-0.5">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Stake Form */}
            {stakingSubTab === 'stake' && (
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">
                <span className="text-sm font-medium">新建质押</span>

                {/* Amount */}
                <div className="relative">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="输入数量"
                    className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2.5 text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#06B6D4]"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-400">
                    最大
                  </button>
                </div>

                {/* Period */}
                <div className="grid grid-cols-4 gap-2">
                  {stakingPeriods.map((period) => (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                        selectedPeriod.id === period.id
                          ? 'bg-[#06B6D4] text-black'
                          : 'bg-[#1A1A24] text-[#94A3B8]'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>

                {/* Weight Rules */}
                <div className="bg-[#0A0A0F]/30 rounded-lg p-2.5 space-y-1">
                  <span className="text-[10px] text-[#94A3B8]">权重规则</span>
                  <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                    {stakingPeriods.map((p) => (
                      <div key={p.id} className={`text-center ${selectedPeriod.id === p.id ? 'text-cyan-400' : 'text-[#606070]'}`}>
                        <div className="font-medium">{p.weight}x</div>
                        <div>{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-center justify-between text-xs text-[#94A3B8] px-1">
                  <span>权重 {selectedPeriod.weight}x</span>
                  <span>年化 {selectedPeriod.apr}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onStake?.(Number(stakeAmount), selectedPeriod.days)}
                  disabled={!stakeAmount || Number(stakeAmount) <= 0}
                  className={`w-full py-3 rounded-xl text-sm font-medium ${
                    stakeAmount && Number(stakeAmount) > 0
                      ? 'bg-[#06B6D4] text-black'
                      : 'bg-[#1A1A24] text-[#94A3B8]'
                  }`}
                >
                  确认质押
                </button>
              </div>
            )}

            {/* 质押中 Tab */}
            {stakingSubTab === 'staking' && (
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">

                {stakeRecords.filter(r => r.status === 'staking' || r.status === 'unlocked').length > 0 ? (
                  <div className="space-y-2">
                    {stakeRecords.filter(r => r.status === 'staking' || r.status === 'unlocked').map((record) => (
                      <div key={record.id} className="bg-[#0A0A0F]/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              record.status === 'staking' ? 'bg-[#06B6D4]/10' : 'bg-[#22C55E]/10'
                            }`}>
                              <Lock className={`w-3.5 h-3.5 ${record.status === 'staking' ? 'text-[#06B6D4]' : 'text-[#22C55E]'}`} />
                            </div>
                            <div>
                              <span className="text-sm font-bold">{record.amount.toLocaleString()} HOOT</span>
                              <span className="text-xs text-cyan-400 ml-2">{record.weight}x 权重</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              record.status === 'staking' ? 'bg-[#06B6D4]/10 text-[#06B6D4]' : 'bg-[#22C55E]/10 text-[#22C55E]'
                            }`}>
                              {record.status === 'staking' ? '质押中' : '已解押'}
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-[#606070] mb-2">
                          质押于 {record.stakeDate} · 解押于 {record.unlockDate} · {record.lockPeriod}天锁定期
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#94A3B8]">累计收益</span>
                          <span className="text-sm font-bold text-[#22C55E]">${record.rewards.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-[#94A3B8]">暂无质押中记录</div>
                )}
              </div>
            )}

            {/* 历史质押 Tab */}
            {stakingSubTab === 'history' && (
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">

                {stakeRecords.filter(r => r.status === 'history').length > 0 ? (
                  <div className="space-y-2">
                    {stakeRecords.filter(r => r.status === 'history').map((record) => (
                      <div key={record.id} className="bg-[#0A0A0F]/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#94A3B8]/10 flex items-center justify-center">
                              <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />
                            </div>
                            <div>
                              <span className="text-sm font-bold">{record.amount.toLocaleString()} HOOT</span>
                              <span className="text-xs text-cyan-400 ml-2">{record.weight}x 权重</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs px-2 py-0.5 rounded bg-[#94A3B8]/10 text-[#94A3B8]">
                              已解押
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-[#606070] mb-2">
                          质押于 {record.stakeDate} · 解押于 {record.unlockDate} · {record.lockPeriod}天锁定期
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#94A3B8]">累计收益</span>
                          <span className="text-sm font-bold text-[#22C55E]">${record.rewards.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-[#94A3B8]">暂无历史质押记录</div>
                )}
              </div>
            )}

            {/* Dividend Records */}
            {stakingSubTab === 'dividends' && (
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">

                {dividendRecords.length > 0 ? (
                  <div className="space-y-2">
                    {dividendRecords.map((record) => (
                      <div key={record.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                            <History className="w-3.5 h-3.5 text-[#22C55E]" />
                          </div>
                          <div>
                            <span className="text-sm font-medium">{record.source}</span>
                            <p className="text-xs text-[#94A3B8]">{record.date}</p>
                          </div>
                        </div>
                        <span className="text-sm text-[#22C55E]">+${record.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-[#94A3B8]">暂无分红记录</div>
                )}
              </div>
            )}
          </>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <>
            {/* My Rank */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#94A3B8]">我的排名</span>
                  <div className="text-2xl font-bold">#128</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#94A3B8]">我的质押</span>
                  <div className="text-lg font-bold text-cyan-400">{userStaked.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-sm font-medium">TOP 5</span>
              </div>

              <div className="space-y-2">
                {leaderboardData.map((user) => (
                  <div key={user.rank} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        user.rank === 1 ? 'bg-[#F59E0B] text-black' :
                        user.rank === 2 ? 'bg-gray-400 text-black' :
                        user.rank === 3 ? 'bg-orange-500 text-white' :
                        'bg-[#1E1E2E] text-[#94A3B8]'
                      }`}>
                        {user.rank}
                      </div>
                      <div>
                        <span className="text-sm font-mono">{user.address}</span>
                        <p className="text-xs text-[#94A3B8]">{user.staked} HOOT</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-cyan-400">{user.weight}</span>
                      <p className="text-xs text-[#22C55E]">{user.rewards}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" className="w-full py-2 text-sm text-[#94A3B8] flex items-center justify-center gap-1">
                查看全部 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
