'use client'

import { useState } from 'react'
import Image from 'next/image'
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
  Info,
  Clock
} from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface StakeRecord {
  id: string
  amount: number
  stakedAt: string
  unstakedAt?: string // 解押时间（历史记录才有）
  lockPeriod: number // Total lock period in days
  daysRemaining: number // Days until unlock
  weight: number // Weight multiplier
  accumulatedRewards: number // USDT rewards
  status: 'locked' | 'unlocked' | 'unstaked' // 锁定中 | 可解押 | 已解押
}

interface DividendRecord {
  id: string
  date: string
  amount: number // USDT
  stakedAmount: number // 当时的质押量
  weight: number // 当时的权重
  poolTotal: number // 当周总分红池
}

// 质押周期选项
const stakingPeriods = [
  { id: '30', days: 30, weight: 1.0, apr: '8%' },
  { id: '90', days: 90, weight: 1.5, apr: '12%' },
  { id: '180', days: 180, weight: 2.0, apr: '18%' },
  { id: '365', days: 365, weight: 3.0, apr: '25%' },
]

interface LeaderboardEntry {
  rank: number
  address: string
  staked: string
  weight?: string
  rewards: string
}

interface EcosystemPageV3Props {
  tokenPrice?: number
  priceChange24h?: number
  marketCap?: string
  circulatingSupply?: string
  totalSupply?: string
  totalStaked?: string
  userStaked?: number
  pendingRewardsUsdt?: number
  nextDistribution?: string
  stakeRecords?: StakeRecord[]
  dividendRecords?: DividendRecord[]
  totalDividendEarned?: number
  leaderboardData?: LeaderboardEntry[]
  onStake?: (amount: number, periodDays: number) => void
  onUnstake?: (recordId: string) => void
  onClaimRewards?: () => void
}

const defaultLeaderboardData: LeaderboardEntry[] = [
  { rank: 1, address: '0x1234...5678', staked: '2,500,000', rewards: '$1,234.56' },
  { rank: 2, address: '0x2345...6789', staked: '1,800,000', rewards: '$890.12' },
  { rank: 3, address: '0x3456...7890', staked: '1,200,000', rewards: '$543.21' },
  { rank: 4, address: '0x4567...8901', staked: '950,000', rewards: '$412.34' },
  { rank: 5, address: '0x5678...9012', staked: '750,000', rewards: '$345.67' },
]

export function EcosystemPageV3({
  tokenPrice = 0.245,
  priceChange24h = 12.5,
  marketCap = '24.5M',
  circulatingSupply = '60M',
  totalSupply = '100M',
  totalStaked = '35.2M',
  userStaked = 12500,
  pendingRewardsUsdt = 234.56,
  nextDistribution = '周日 00:00 UTC',
  stakeRecords = [
    { id: '1', amount: 5000, stakedAt: '2025-12-01', lockPeriod: 90, daysRemaining: 45, weight: 1.5, accumulatedRewards: 45.23, status: 'locked' as const },
    { id: '2', amount: 7500, stakedAt: '2025-10-15', lockPeriod: 180, daysRemaining: 0, weight: 2.0, accumulatedRewards: 189.33, status: 'unlocked' as const },
    { id: '3', amount: 3000, stakedAt: '2025-11-01', lockPeriod: 365, daysRemaining: 280, weight: 3.0, accumulatedRewards: 67.89, status: 'locked' as const },
    { id: '4', amount: 2000, stakedAt: '2025-06-01', unstakedAt: '2025-09-01', lockPeriod: 90, daysRemaining: 0, weight: 1.5, accumulatedRewards: 56.78, status: 'unstaked' as const },
    { id: '5', amount: 4000, stakedAt: '2025-03-15', unstakedAt: '2025-06-15', lockPeriod: 90, daysRemaining: 0, weight: 1.5, accumulatedRewards: 89.12, status: 'unstaked' as const },
  ],
  dividendRecords = [
    { id: '1', date: '2026-01-26', amount: 45.00, stakedAmount: 12500, weight: 1.75, poolTotal: 8500 },
    { id: '2', date: '2026-01-19', amount: 42.30, stakedAmount: 12500, weight: 1.75, poolTotal: 8200 },
    { id: '3', date: '2026-01-12', amount: 38.50, stakedAmount: 10000, weight: 1.5, poolTotal: 7800 },
    { id: '4', date: '2026-01-05', amount: 41.20, stakedAmount: 10000, weight: 1.5, poolTotal: 8100 },
    { id: '5', date: '2025-12-29', amount: 35.80, stakedAmount: 8000, weight: 1.2, poolTotal: 7500 },
    { id: '6', date: '2025-12-22', amount: 32.10, stakedAmount: 8000, weight: 1.2, poolTotal: 7200 },
  ],
  totalDividendEarned = 234.90,
  leaderboardData = defaultLeaderboardData,
  onStake,
  onUnstake,
  onClaimRewards
}: EcosystemPageV3Props) {
  const t = useTranslations('ecosystem')
  const [stakeAmount, setStakeAmount] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(stakingPeriods[1]) // Default 90 days
  const [activeTab, setActiveTab] = useState<'stake' | 'staking' | 'history' | 'dividends'>('stake')

  // 分类质押记录：质押中 = locked + unlocked，历史质押 = unstaked
  const activeStakes = stakeRecords.filter(r => r.status === 'locked' || r.status === 'unlocked')
  const historicalStakes = stakeRecords.filter(r => r.status === 'unstaked')

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero Token Card */}
          <div className="lg:col-span-2 glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16">
                <Image
                  src="/icons/hoot/token.png"
                  alt="HOOT Token"
                  width={64}
                  height={64}
                  className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold">HOOT Token</h2>
                <p className="text-[#9090A0]">{t('platformToken')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                <div className="text-2xl font-bold text-cyan-400">${tokenPrice}</div>
                <div className="text-sm text-[#9090A0]">{t('currentPrice')}</div>
                <div className={`text-xs font-medium ${priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {priceChange24h >= 0 ? '+' : ''}{priceChange24h}%
                </div>
              </div>
              <div className="text-center p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                <div className="text-lg font-semibold">${marketCap}</div>
                <div className="text-sm text-[#9090A0]">{t('marketCap')}</div>
              </div>
              <div className="text-center p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                <div className="text-lg font-semibold">{circulatingSupply}</div>
                <div className="text-sm text-[#9090A0]">{t('circulatingSupply')}</div>
              </div>
              <div className="text-center p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                <div className="text-lg font-semibold">{totalSupply}</div>
                <div className="text-sm text-[#9090A0]">{t('totalSupply')}</div>
              </div>
            </div>

            {/* Platform Fee Distribution Info */}
            <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-cyan-400/5 border border-cyan-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{t('gasFeeDistribution')}</div>
                  <div className="text-xs text-[#9090A0]">{t('gasFeeDescription')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Claim Rewards Card - USDT Rewards */}
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold">{t('claimDividends')}</h3>
            </div>

            <div className="text-center mb-4 p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
              <div className="text-3xl font-bold text-green-400 mb-1">${pendingRewardsUsdt.toFixed(2)}</div>
              <div className="text-sm text-[#9090A0]">{t('pendingUsdt')}</div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#0A0A0F]/30 rounded-xl mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#9090A0]" />
                <span className="text-sm text-[#9090A0]">{t('nextDistribution')}</span>
              </div>
              <span className="text-sm text-cyan-400">{nextDistribution}</span>
            </div>

            <button
              type="button"
              onClick={onClaimRewards}
              disabled={pendingRewardsUsdt <= 0}
              className={`w-full py-3.5 px-4 rounded-xl font-semibold transition-all ${
                pendingRewardsUsdt > 0
                  ? 'bg-gradient-to-r from-green-500 to-green-400 text-black hover:from-green-400 hover:to-green-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/25'
                  : 'bg-[#2A2A3A] text-[#606070] cursor-not-allowed'
              }`}
            >
              {t('claimDividends')}
            </button>

            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#9090A0]">
                  {t('dividendInfo')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Staking Section - With Lock Periods and Weights */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 mb-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Lock className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-bold">{t('hootStaking')}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-[#9090A0]">
                {t('totalStaked')}: <span className="text-cyan-400 font-semibold">{totalStaked} HOOT</span>
              </div>
              {/* Tab Switcher - 4 tabs */}
              <div className="flex bg-[#0A0A0F]/50 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('stake')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'stake'
                      ? 'bg-[#06B6D4] text-white'
                      : 'text-[#9090A0] hover:text-[#F8F8FC]'
                  }`}
                >
                  {t('stake')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('staking')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'staking'
                      ? 'bg-[#06B6D4] text-white'
                      : 'text-[#9090A0] hover:text-[#F8F8FC]'
                  }`}
                >
                  {t('staking')} ({activeStakes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'history'
                      ? 'bg-[#06B6D4] text-white'
                      : 'text-[#9090A0] hover:text-[#F8F8FC]'
                  }`}
                >
                  {t('stakingHistory')} ({historicalStakes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('dividends')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'dividends'
                      ? 'bg-[#06B6D4] text-white'
                      : 'text-[#9090A0] hover:text-[#F8F8FC]'
                  }`}
                >
                  {t('dividendRecords')}
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'stake' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stake Input with Period Selection */}
              <div className="p-6 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                <h3 className="font-semibold mb-4">{t('newStake')}</h3>

                <div className="space-y-4">
                  {/* Amount Input */}
                  <div>
                    <label htmlFor="stake-amount" className="text-sm text-[#9090A0] mb-2 block">{t('stakeAmount')}</label>
                    <div className="relative">
                      <input
                        id="stake-amount"
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder={t('enterStakeAmount')}
                        className="w-full bg-[#1E1E2E] border border-[#2A2A3A] rounded-xl px-4 py-3 text-[#F8F8FC] placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none transition-colors"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        {t('max')}
                      </button>
                    </div>
                  </div>

                  {/* Period Selection */}
                  <div>
                    <label className="text-sm text-[#9090A0] mb-2 block">{t('lockPeriod')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {stakingPeriods.map((period) => (
                        <button
                          key={period.id}
                          type="button"
                          onClick={() => setSelectedPeriod(period)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selectedPeriod.id === period.id
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-[#2A2A3A] bg-[#1E1E2E]/50 hover:border-[#3A3A4A]'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold">{period.days}{t('days')}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              selectedPeriod.id === period.id
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'bg-[#2A2A3A] text-[#9090A0]'
                            }`}>
                              {period.weight}x {t('weight')}
                            </span>
                          </div>
                          <div className="text-xs text-[#606070]">{t('estimatedApr')} {period.apr}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-3 bg-[#1E1E2E]/50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9090A0]">{t('lockPeriod')}</span>
                      <span className="font-semibold">{selectedPeriod.days} {t('days')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9090A0]">{t('weightMultiplier')}</span>
                      <span className="font-semibold text-cyan-400">{selectedPeriod.weight}x</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9090A0]">{t('estimatedApr')}</span>
                      <span className="font-semibold text-green-400">{selectedPeriod.apr}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStake?.(Number(stakeAmount), selectedPeriod.days)}
                    disabled={!stakeAmount || Number(stakeAmount) <= 0}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                      stakeAmount && Number(stakeAmount) > 0
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-black hover:from-cyan-400 hover:to-cyan-300'
                        : 'bg-[#2A2A3A] text-[#606070] cursor-not-allowed'
                    }`}
                  >
                    {t('confirmStake')}
                  </button>
                </div>
              </div>

              {/* Weight & Rules Info */}
              <div className="space-y-4">
                {/* My Staking Overview */}
                <div className="p-6 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                  <h3 className="font-semibold mb-4">{t('myStakingOverview')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-[#1E1E2E]/50 rounded-lg">
                      <div className="text-xl font-bold">{userStaked.toLocaleString()}</div>
                      <div className="text-xs text-[#9090A0]">{t('totalStakedHoot')}</div>
                    </div>
                    <div className="text-center p-3 bg-[#1E1E2E]/50 rounded-lg">
                      <div className="text-xl font-bold text-cyan-400">1.75x</div>
                      <div className="text-xs text-[#9090A0]">{t('averageWeight')}</div>
                    </div>
                    <div className="text-center p-3 bg-[#1E1E2E]/50 rounded-lg">
                      <div className="text-xl font-bold text-green-400">${pendingRewardsUsdt.toFixed(2)}</div>
                      <div className="text-xs text-[#9090A0]">{t('pendingDividends')}</div>
                    </div>
                    <div className="text-center p-3 bg-[#1E1E2E]/50 rounded-lg">
                      <div className="text-xl font-bold">0.035%</div>
                      <div className="text-xs text-[#9090A0]">{t('stakingShare')}</div>
                    </div>
                  </div>
                </div>

                {/* Weight Rules */}
                <div className="p-6 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                  <h3 className="font-semibold mb-4">{t('weightRules')}</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">{t('rewardFormula')}</div>
                        <div className="text-xs text-[#9090A0] mt-1">
                          {t('rewardFormulaDesc')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-[#1E1E2E]/50 rounded-lg">
                      <Lock className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">{t('lockPeriodExplanation')}</div>
                        <div className="text-xs text-[#9090A0] mt-1">
                          {t('lockPeriodExplanationDesc')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-[#1E1E2E]/50 rounded-lg">
                      <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">{t('dividendDistribution')}</div>
                        <div className="text-xs text-[#9090A0] mt-1">
                          {t('dividendDistributionDesc')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 质押中 Tab */}
          {activeTab === 'staking' && (
            <div className="space-y-3">
              {activeStakes.length > 0 ? (
                activeStakes.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] hover:border-[#2A2A3A] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        record.status === 'locked' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                      }`}>
                        {record.status === 'locked' ? (
                          <Lock className="w-6 h-6 text-yellow-400" />
                        ) : (
                          <Coins className="w-6 h-6 text-green-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">{record.amount.toLocaleString()} HOOT</div>
                        <div className="flex items-center gap-2 text-xs text-[#606070]">
                          <span>{t('stakedAt')} {record.stakedAt}</span>
                          <span>·</span>
                          <span>{record.lockPeriod}{t('lockDays')}</span>
                          <span>·</span>
                          <span className="text-cyan-400">{record.weight}x {t('weight')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className={`text-sm font-medium ${record.status === 'locked' ? 'text-yellow-400' : 'text-green-400'}`}>
                          {record.status === 'locked' ? `${record.daysRemaining}${t('daysUntilUnlock')}` : t('canUnstake')}
                        </div>
                        <div className="text-xs text-[#606070]">{t('status')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-400">${record.accumulatedRewards.toFixed(2)}</div>
                        <div className="text-xs text-[#606070]">{t('accumulatedRewards')}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUnstake?.(record.id)}
                        disabled={record.status === 'locked'}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          record.status === 'locked'
                            ? 'border border-[#2A2A3A] text-[#606070] cursor-not-allowed'
                            : 'border border-[#2A2A3A] text-[#9090A0] hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/10'
                        }`}
                      >
                        {record.status === 'locked' ? t('locked') : t('unstake')}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Coins className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                  <p className="text-[#9090A0]">{t('noActiveStakes')}</p>
                  <p className="text-xs text-[#606070] mt-1">{t('goToStakeTab')}</p>
                </div>
              )}
            </div>
          )}

          {/* 历史质押 Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {historicalStakes.length > 0 ? (
                historicalStakes.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] hover:border-[#2A2A3A] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2A2A3A]">
                        <Coins className="w-6 h-6 text-[#9090A0]" />
                      </div>
                      <div>
                        <div className="font-semibold">{record.amount.toLocaleString()} HOOT</div>
                        <div className="flex items-center gap-2 text-xs text-[#606070]">
                          <span>{t('stakedAt')} {record.stakedAt}</span>
                          <span>·</span>
                          <span>{t('unstakedAt')} {record.unstakedAt}</span>
                          <span>·</span>
                          <span>{record.lockPeriod}{t('lockDays')}</span>
                          <span>·</span>
                          <span className="text-cyan-400">{record.weight}x {t('weight')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm font-medium text-[#9090A0]">{t('unstaked')}</div>
                        <div className="text-xs text-[#606070]">{t('status')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-400">${record.accumulatedRewards.toFixed(2)}</div>
                        <div className="text-xs text-[#606070]">{t('accumulatedRewards')}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                  <p className="text-[#9090A0]">{t('noStakingHistory')}</p>
                </div>
              )}
            </div>
          )}

          {/* 分红记录 Tab */}
          {activeTab === 'dividends' && (
            <div className="space-y-6">
              {/* 累计分红统计 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] text-center">
                  <div className="text-2xl font-bold text-green-400">${totalDividendEarned.toFixed(2)}</div>
                  <div className="text-sm text-[#9090A0]">{t('totalDividendEarned')}</div>
                </div>
                <div className="p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] text-center">
                  <div className="text-2xl font-bold">{dividendRecords.length}</div>
                  <div className="text-sm text-[#9090A0]">{t('dividendCount')}</div>
                </div>
                <div className="p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] text-center">
                  <div className="text-2xl font-bold text-cyan-400">
                    ${dividendRecords.length > 0 ? (totalDividendEarned / dividendRecords.length).toFixed(2) : '0.00'}
                  </div>
                  <div className="text-sm text-[#9090A0]">{t('averageDividend')}</div>
                </div>
              </div>

              {/* 分红记录列表 */}
              <div className="space-y-3">
                {dividendRecords.length > 0 ? (
                  dividendRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] hover:border-[#2A2A3A] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-500/20">
                          <Gift className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                          <div className="font-semibold text-green-400">+${record.amount.toFixed(2)} USDT</div>
                          <div className="flex items-center gap-2 text-xs text-[#606070]">
                            <span>{record.date}</span>
                            <span>·</span>
                            <span>{t('stakedAmount')} {record.stakedAmount.toLocaleString()} HOOT</span>
                            <span>·</span>
                            <span className="text-cyan-400">{record.weight}x {t('weight')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-sm font-medium">${record.poolTotal.toLocaleString()}</div>
                          <div className="text-xs text-[#606070]">{t('weeklyPool')}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-cyan-400">
                            {((record.amount / record.poolTotal) * 100).toFixed(2)}%
                          </div>
                          <div className="text-xs text-[#606070]">{t('sharePercent')}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Gift className="w-12 h-12 text-[#606070] mx-auto mb-4" />
                    <p className="text-[#9090A0]">{t('noDividendRecords')}</p>
                    <p className="text-xs text-[#606070] mt-1">{t('stakeToEarnDividend')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Token Benefits Grid */}
          <div>
            <h2 className="text-2xl font-bold mb-4">{t('tokenBenefits')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] hover:border-cyan-500/20 transition-colors overflow-hidden">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-semibold mb-2">{t('gasFeeRewards')}</h3>
                <p className="text-sm text-[#9090A0]">{t('gasFeeRewardsDesc')}</p>
              </div>
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] hover:border-cyan-500/20 transition-colors overflow-hidden">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Star className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-semibold mb-2">{t('strategyDiscount')}</h3>
                <p className="text-sm text-[#9090A0]">{t('strategyDiscountDesc')}</p>
              </div>
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] hover:border-cyan-500/20 transition-colors overflow-hidden">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Shield className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-semibold mb-2">{t('prioritySupport')}</h3>
                <p className="text-sm text-[#9090A0]">{t('prioritySupportDesc')}</p>
              </div>
              <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] hover:border-cyan-500/20 transition-colors overflow-hidden">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-semibold mb-2">{t('governanceVoting')}</h3>
                <p className="text-sm text-[#9090A0]">{t('governanceVotingDesc')}</p>
              </div>
            </div>
          </div>

          {/* Token Distribution */}
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <h2 className="relative z-[2] text-2xl font-bold mb-4">{t('tokenDistribution')}</h2>
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#1E1E2E"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="3"
                  strokeDasharray="40 60"
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#22D3EE"
                  strokeWidth="3"
                  strokeDasharray="20 80"
                  strokeDashoffset="-40"
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#67E8F9"
                  strokeWidth="3"
                  strokeDasharray="25 75"
                  strokeDashoffset="-60"
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#A5F3FC"
                  strokeWidth="3"
                  strokeDasharray="15 85"
                  strokeDashoffset="-85"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold">100M</div>
                  <div className="text-sm text-[#9090A0]">{t('totalSupply')}</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 hover:bg-[#1E1E2E]/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500" />
                  <span className="text-sm">{t('community')} (40%)</span>
                </div>
                <span className="text-sm text-cyan-400 font-medium">40M</span>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-[#1E1E2E]/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-400" />
                  <span className="text-sm">{t('team')} (20%)</span>
                </div>
                <span className="text-sm text-cyan-400 font-medium">20M</span>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-[#1E1E2E]/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-300" />
                  <span className="text-sm">{t('investors')} (25%)</span>
                </div>
                <span className="text-sm text-cyan-400 font-medium">25M</span>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-[#1E1E2E]/30 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-200" />
                  <span className="text-sm">{t('treasury')} (15%)</span>
                </div>
                <span className="text-sm text-cyan-400 font-medium">15M</span>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Preview */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          <div className="relative z-[2] flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-bold">{t('stakingLeaderboard')}</h2>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium"
            >
              {t('viewAll')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {leaderboardData.map((user) => (
              <div
                key={user.rank}
                className="flex items-center justify-between py-4 px-4 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E] hover:border-[#2A2A3A] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    user.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                    user.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                    user.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                    'bg-[#2A2A3A] text-[#9090A0]'
                  }`}>
                    {user.rank}
                  </div>
                  <div>
                    <div className="font-mono text-sm text-[#F8F8FC]">{user.address}</div>
                    <div className="text-xs text-[#606070]">{t('walletAddress')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-semibold text-[#F8F8FC]">{user.staked} HOOT</div>
                    <div className="text-xs text-[#606070]">{t('stakedQuantity')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-400">{user.rewards}</div>
                    <div className="text-xs text-[#606070]">{t('accumulatedRewards')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  )
}
