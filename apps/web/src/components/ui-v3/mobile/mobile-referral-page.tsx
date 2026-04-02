'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Wallet,
  Users,
  TrendingUp,
  Copy,
  ChevronDown,
  ChevronUp,
  Check,
  Trophy,
  Crown,
  QrCode,
  Send,
  Filter,
  X
} from 'lucide-react'

interface Referral {
  id: string
  username: string
  joinDate: string
  status: 'Active' | 'Inactive'
  earnings: number
  level: 1 | 2
}

interface LeaderboardUser {
  rank: number
  username: string
  referrals: number
  earnings: number
}

interface MobileReferralPageProps {
  onBack?: () => void
  referralCode?: string
  earnings?: {
    total: number
    activeReferrals: number
    thisMonth: number
  }
  myReferrals?: Referral[]
  leaderboard?: LeaderboardUser[]
  bindSection?: React.ReactNode
}

const defaultReferrals: Referral[] = []

const defaultLeaderboard: LeaderboardUser[] = []

export function MobileReferralPage({
  onBack,
  referralCode = 'HOOT2024XYZ',
  earnings = {
    total: 1234.56,
    activeReferrals: 28,
    thisMonth: 156.78
  },
  myReferrals = defaultReferrals,
  leaderboard = defaultLeaderboard,
  bindSection,
}: MobileReferralPageProps) {
  const t = useTranslations('referral')
  const [copied, setCopied] = useState(false)
  const [rulesExpanded, setRulesExpanded] = useState(false)
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // 筛选状态
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const referralLink = typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${referralCode}` : `https://hoot.trade/register?ref=${referralCode}`

  // 筛选后的数据
  const filteredReferrals = useMemo(() => {
    return myReferrals.filter(referral => {
      if (levelFilter !== 'all' && referral.level !== Number(levelFilter)) {
        return false
      }
      if (statusFilter !== 'all' && referral.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [myReferrals, levelFilter, statusFilter])

  const hasActiveFilters = levelFilter !== 'all' || statusFilter !== 'all'

  const clearFilters = () => {
    setLevelFilter('all')
    setStatusFilter('all')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error(t('copyFailed') + ':', err)
      }
    }
  }

  const handleShare = (platform: string) => {
    const text = t('shareText', { code: referralCode })
    const url = referralLink

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)
        break
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)
        break
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-8">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F] pt-[env(safe-area-inset-top)] [transform:translateZ(0)] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('back')}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">{t('title')}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-6 space-y-4">
        {/* 绑定上级入口（由父组件注入） */}
        {bindSection}

        {/* 统计卡片 - 合并为一个卡片 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />
          <div className="grid grid-cols-3 divide-x divide-[#1E1E2E]/50">
            {/* 累计收益 */}
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-[#94A3B8]">{t('totalEarnings')}</span>
              </div>
              <div className="text-lg font-bold text-cyan-400">
                ${earnings.total.toLocaleString()}
              </div>
            </div>

            {/* 邀请人数 */}
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Users className="w-4 h-4 text-[#10B981]" />
                <span className="text-xs text-[#94A3B8]">{t('referralCount')}</span>
              </div>
              <div className="text-lg font-bold text-[#10B981]">
                {earnings.activeReferrals}
              </div>
            </div>

            {/* 本月收益 */}
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-xs text-[#94A3B8]">{t('monthlyEarnings')}</span>
              </div>
              <div className="text-lg font-bold text-[#F59E0B]">
                ${earnings.thisMonth.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* 邀请码卡片 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />

          <div className="p-5">
            {/* 邀请码 + 二维码 */}
            <div className="flex items-start gap-4">
              {/* 左侧信息 */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#94A3B8] mb-1">{t('inviteCode')}</div>
                <div className="text-2xl font-mono font-bold text-cyan-400 tracking-wider mb-4">
                  {referralCode}
                </div>

                <div className="text-xs text-[#94A3B8] mb-1">{t('inviteLink')}</div>
                <div className="text-xs font-mono text-[#94A3B8] break-all leading-relaxed">
                  {referralLink}
                </div>
              </div>

              {/* 右侧二维码 */}
              <div className="flex-shrink-0">
                <div className="bg-white rounded-xl p-2">
                  <QrCode className="w-16 h-16 text-[#0A0A0F]" />
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white py-3 rounded-xl font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t('copied') : t('copyLink')}
              </button>

              <button
                type="button"
                onClick={() => handleShare('twitter')}
                aria-label={t('shareToTwitter')}
                className="flex items-center justify-center w-12 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl hover:border-cyan-500/30 transition-colors"
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleShare('telegram')}
                aria-label={t('shareToTelegram')}
                className="flex items-center justify-center w-12 bg-[#1A1A24] border border-[#1E1E2E] rounded-xl hover:border-cyan-500/30 transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* 我的邀请列表 - 带筛选功能 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />

          {/* 标题栏 */}
          <div className="p-4 border-b border-[#1E1E2E]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold">{t('myReferrals')}</span>
                <span className="text-[#94A3B8] text-sm">
                  {filteredReferrals.length}
                  {hasActiveFilters && <span className="text-[#606070]"> / {myReferrals.length}</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[#EF4444] hover:text-[#FCA5A5] transition-colors"
                  >
                    <X className="w-3 h-3" />
                    {t('clear')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                    showFilters || hasActiveFilters
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {t('filter')}
                </button>
              </div>
            </div>

            {/* 筛选面板 */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-[#1E1E2E]/50 space-y-3">
                {/* 级别筛选 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8] w-12">{t('level')}</span>
                  <div className="flex gap-2">
                    {[
                      { value: 'all', label: t('all') },
                      { value: '1', label: t('level1') },
                      { value: '2', label: t('level2') }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLevelFilter(opt.value)}
                        className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                          levelFilter === opt.value
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-[#1A1A24] text-[#94A3B8] border border-transparent hover:border-[#1E1E2E]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 状态筛选 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8] w-12">{t('status')}</span>
                  <div className="flex gap-2">
                    {[
                      { value: 'all', label: t('all') },
                      { value: 'Active', label: t('active') },
                      { value: 'Inactive', label: t('inactive') }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatusFilter(opt.value)}
                        className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                          statusFilter === opt.value
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-[#1A1A24] text-[#94A3B8] border border-transparent hover:border-[#1E1E2E]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {filteredReferrals.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-10 h-10 text-[#94A3B8] mx-auto mb-2" />
              {hasActiveFilters ? (
                <>
                  <p className="text-[#94A3B8] text-sm">{t('noMatchingRecords')}</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-cyan-400 text-sm mt-2 hover:underline"
                  >
                    {t('clearFilterConditions')}
                  </button>
                </>
              ) : (
                <p className="text-[#94A3B8] text-sm">{t('noReferralRecords')}</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#1E1E2E]/50">
              {filteredReferrals.map((referral) => (
                <div key={referral.id} className="p-4 flex items-center gap-3">
                  {/* 用户信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{referral.username}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        referral.level === 1
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {referral.level === 1 ? t('level1') : t('level2')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#94A3B8]">{referral.joinDate}</span>
                      <span className={`inline-flex items-center gap-1 text-xs ${
                        referral.status === 'Active' ? 'text-[#10B981]' : 'text-[#94A3B8]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          referral.status === 'Active' ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
                        }`} />
                        {referral.status === 'Active' ? t('active') : t('inactive')}
                      </span>
                    </div>
                  </div>

                  {/* 收益 */}
                  <div className="text-right">
                    <div className="font-mono font-semibold text-cyan-400">
                      +${referral.earnings.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 返佣规则 - 可折叠 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />

          <button
            type="button"
            onClick={() => setRulesExpanded(!rulesExpanded)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-cyan-400" />
              <span className="font-semibold">{t('commissionRules')}</span>
              <span className="text-[#94A3B8] text-xs">{t('commissionRateDesc')}</span>
            </div>
            {rulesExpanded ? (
              <ChevronUp className="w-5 h-5 text-[#94A3B8]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#94A3B8]" />
            )}
          </button>

          {rulesExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-[#1E1E2E]">
              {/* 返佣比例 */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                    <span className="text-sm font-medium">{t('level1Commission')}</span>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">30%</div>
                </div>
                <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                    <span className="text-sm font-medium">{t('level2Commission')}</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-400">10%</div>
                </div>
              </div>

              {/* 规则说明 */}
              <div className="flex flex-wrap gap-2">
                {[t('realTimeSettlement'), t('autoCredit'), t('lifetimeValid'), t('noLimit')].map((item) => (
                  <span key={item} className="px-2 py-1 bg-[#1A1A24] rounded text-xs text-[#94A3B8]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 排行榜 - 可折叠 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />

          <button
            type="button"
            onClick={() => setLeaderboardExpanded(!leaderboardExpanded)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#F59E0B]" />
              <span className="font-semibold">{t('leaderboard')}</span>
              <span className="text-[#94A3B8] text-xs">{t('topRanking', { count: 5 })}</span>
            </div>
            {leaderboardExpanded ? (
              <ChevronUp className="w-5 h-5 text-[#94A3B8]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#94A3B8]" />
            )}
          </button>

          {leaderboardExpanded && (
            <div className="px-4 pb-4 space-y-2 border-t border-[#1E1E2E] mt-0 pt-3">
              {leaderboard.map((user) => (
                <div
                  key={user.rank}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    user.rank <= 3
                      ? 'bg-gradient-to-r from-[#F59E0B]/10 to-transparent border border-[#F59E0B]/20'
                      : 'bg-[#0A0A0F] border border-[#1E1E2E]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      user.rank === 1 ? 'bg-yellow-500 text-black' :
                      user.rank === 2 ? 'bg-gray-400 text-black' :
                      user.rank === 3 ? 'bg-orange-500 text-black' :
                      'bg-[#2A2A3A] text-[#94A3B8]'
                    }`}>
                      {user.rank}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{user.username}</div>
                      <div className="text-[#94A3B8] text-xs">{user.referrals} {t('referrals')}</div>
                    </div>
                  </div>
                  <div className="font-mono font-semibold text-cyan-400">
                    ${user.earnings.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
