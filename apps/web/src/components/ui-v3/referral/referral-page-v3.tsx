'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from '@/i18n/provider'
import {
  Gift,
  Users,
  Copy,
  Twitter,
  Send,
  QrCode,
  Trophy,
  Crown,
  ChevronRight,
  Wallet,
  TrendingUp,
  Check,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react'

interface LeaderboardUser {
  rank: number
  username: string
  referrals: number
  earnings: number
}

interface Referral {
  username: string
  joinDate: string
  status: 'Active' | 'Inactive'
  earnings: number
  level: 1 | 2
}

interface ReferralPageV3Props {
  referralCode?: string
  earnings?: {
    total: number
    activeReferrals: number
    thisMonth: number
  }
  leaderboard?: LeaderboardUser[]
  myReferrals?: Referral[]
  onShare?: (platform: string) => void
}

const defaultLeaderboard: LeaderboardUser[] = [
  { rank: 1, username: 'user***123', referrals: 156, earnings: 5432.10 },
  { rank: 2, username: 'crypto***456', referrals: 134, earnings: 4321.87 },
  { rank: 3, username: 'trader***789', referrals: 98, earnings: 3210.65 },
  { rank: 4, username: 'moon***012', referrals: 87, earnings: 2987.43 },
  { rank: 5, username: 'hodl***345', referrals: 76, earnings: 2654.21 }
]

const defaultReferrals: Referral[] = [
  { username: 'alice***123', joinDate: '2024-01-15', status: 'Active', earnings: 45.67, level: 1 },
  { username: 'bob***456', joinDate: '2024-01-12', status: 'Active', earnings: 32.10, level: 1 },
  { username: 'charlie***789', joinDate: '2024-01-08', status: 'Inactive', earnings: 18.45, level: 2 },
  { username: 'david***012', joinDate: '2024-01-05', status: 'Active', earnings: 67.89, level: 1 },
  { username: 'eve***345', joinDate: '2024-01-02', status: 'Active', earnings: 23.45, level: 2 }
]

// 表头筛选下拉组件
function TableHeaderFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isFiltered = value !== 'all'
  const selectedOption = options.find(o => o.value === value)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 text-sm font-medium transition-colors ${
          isFiltered ? 'text-[#06B6D4]' : 'text-[#9090A0] hover:text-[#F8F8FC]'
        }`}
      >
        <span>{isFiltered ? selectedOption?.label : label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg shadow-xl overflow-hidden min-w-[120px]">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[#2A2A3A] transition-colors ${
                  value === option.value ? 'bg-[#06B6D4]/20 text-[#06B6D4]' : 'text-[#F8F8FC]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ReferralPageV3({
  referralCode = 'HOOT2024XYZ',
  earnings = {
    total: 1234.56,
    activeReferrals: 28,
    thisMonth: 156.78
  },
  leaderboard = defaultLeaderboard,
  myReferrals = defaultReferrals,
  onShare
}: ReferralPageV3Props) {
  const t = useTranslations('referral')
  const [copied, setCopied] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showRules, setShowRules] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  // 筛选状态
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')

  const referralLink = typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${referralCode}` : `https://hoot.trade/register?ref=${referralCode}`

  // 筛选选项
  const levelOptions = [
    { value: 'all', label: t('allLevels') },
    { value: '1', label: t('level1') },
    { value: '2', label: t('level2') }
  ]

  const statusOptions = [
    { value: 'all', label: t('allStatus') },
    { value: 'Active', label: t('active') },
    { value: 'Inactive', label: t('inactive') }
  ]

  const dateOptions = [
    { value: 'all', label: t('allTime') },
    { value: '7days', label: t('last7Days') },
    { value: '30days', label: t('last30Days') },
    { value: '90days', label: t('last90Days') }
  ]

  // 筛选后的数据
  const filteredReferrals = useMemo(() => {
    return myReferrals.filter(referral => {
      // 级别筛选
      if (levelFilter !== 'all' && referral.level !== Number(levelFilter)) {
        return false
      }

      // 状态筛选
      if (statusFilter !== 'all' && referral.status !== statusFilter) {
        return false
      }

      // 时间筛选
      if (dateFilter !== 'all') {
        const joinDate = new Date(referral.joinDate)
        const now = new Date()
        const diffDays = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24))

        if (dateFilter === '7days' && diffDays > 7) return false
        if (dateFilter === '30days' && diffDays > 30) return false
        if (dateFilter === '90days' && diffDays > 90) return false
      }

      return true
    })
  }, [myReferrals, levelFilter, statusFilter, dateFilter])

  // 是否有激活的筛选
  const hasActiveFilters = levelFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all'

  // 清除所有筛选
  const clearFilters = () => {
    setLevelFilter('all')
    setStatusFilter('all')
    setDateFilter('all')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShare = (platform: string) => {
    const text = t('shareText', { code: referralCode })
    const url = referralLink

    if (onShare) {
      onShare(platform)
      return
    }

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)
        break
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)
        break
      case 'tg_bot': {
        // TG Bot 深度链接分享
        const botUsername = 'HootBot' // TG Bot 用户名
        const botDeepLink = `https://t.me/${botUsername}?start=ref_${referralCode}`
        const botShareText = t('shareBotText', { code: referralCode }) || `Join HOOT via Bot and earn rewards! ${botDeepLink}`
        window.open(`https://t.me/share/url?url=${encodeURIComponent(botDeepLink)}&text=${encodeURIComponent(botShareText)}`)
        break
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[#F8F8FC]">{t('title')}</h1>
        </div>

        {/* ========== 核心区域：数据 + 邀请码 ========== */}

        {/* 收益统计卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-[#9090A0] text-sm">{t('totalEarnings')}</span>
            </div>
            <div className="text-2xl font-bold text-[#06B6D4]">
              ${earnings.total.toLocaleString()}
            </div>
          </div>

          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#10B981]" />
              <span className="text-[#9090A0] text-sm">{t('referralCount')}</span>
            </div>
            <div className="text-2xl font-bold text-[#10B981]">
              {earnings.activeReferrals}
            </div>
          </div>

          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-[#9090A0] text-sm">{t('monthlyEarnings')}</span>
            </div>
            <div className="text-2xl font-bold text-[#F59E0B]">
              ${earnings.thisMonth.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 邀请码卡片 - 简洁协调布局 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          {/* 标题栏 */}
          <div className="p-5 border-b border-[#1E1E2E]">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#06B6D4]" />
              <h2 className="text-lg font-bold">{t('myInviteCode')}</h2>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="p-5">
            {/* 主内容：左侧信息 + 右侧二维码 */}
            <div className="flex flex-col md:flex-row gap-5">
              {/* 左侧：邀请码信息区 */}
              <div className="flex-1 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-5">
                {/* 邀请码 */}
                <div className="mb-4">
                  <div className="text-[#606070] text-xs mb-1">{t('inviteCode')}</div>
                  <div className="text-2xl font-mono font-bold text-[#06B6D4] tracking-wider">
                    {referralCode}
                  </div>
                </div>

                {/* 分隔线 */}
                <div className="border-t border-[#1E1E2E] my-4" />

                {/* 邀请链接 */}
                <div>
                  <div className="text-[#606070] text-xs mb-1">{t('inviteLink')}</div>
                  <div className="text-sm font-mono text-[#9090A0] break-all">
                    {referralLink}
                  </div>
                </div>
              </div>

              {/* 右侧：二维码 */}
              <div className="flex-shrink-0 flex items-center justify-center md:justify-start">
                <div className="text-center">
                  <div className="bg-white rounded-xl p-3 inline-block">
                    <QrCode className="w-[100px] h-[100px] text-[#0A0A0F]" />
                  </div>
                  <div className="text-[#606070] text-xs mt-2">{t('scanToInvite')}</div>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-wrap gap-3 mt-5">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-2 bg-[#06B6D4] hover:bg-[#0891B2] text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t('copied') : t('copyLink')}
              </button>

              <button
                type="button"
                onClick={() => handleShare('twitter')}
                className="flex items-center gap-2 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                <Twitter className="w-4 h-4" />
                Twitter
              </button>

              <button
                type="button"
                onClick={() => handleShare('telegram')}
                className="flex items-center gap-2 bg-[#1E1E2E] hover:bg-[#2A2A3A] border border-[#2A2A3A] px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                Telegram
              </button>

              <button
                type="button"
                onClick={() => handleShare('tg_bot')}
                className="flex items-center gap-2 bg-[#0088CC] hover:bg-[#0077B5] text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
                title={t('shareBotTip') || 'Share via TG Bot - Friends can auto-bind referral'}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
                {t('shareBot') || 'TG Bot'}
              </button>
            </div>
          </div>
        </div>

        {/* 我的邀请列表 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          {/* 标题栏 */}
          <div className="p-5 border-b border-[#1E1E2E]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-[#06B6D4]" />
                {t('myReferrals')}
                <span className="text-[#9090A0] text-sm font-normal ml-2">
                  {t('totalCount', { count: filteredReferrals.length })}
                  {hasActiveFilters && (
                    <span className="text-[#606070]"> {t('filteredCount', { total: myReferrals.length })}</span>
                  )}
                </span>
              </h2>

              {/* 清除筛选按钮 */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-[#F87171] hover:text-[#FCA5A5] transition-colors"
                >
                  <X className="w-4 h-4" />
                  {t('clearFilters')}
                </button>
              )}
            </div>
          </div>

          {filteredReferrals.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-[#606070] mx-auto mb-3" />
              {hasActiveFilters ? (
                <>
                  <p className="text-[#9090A0]">{t('noMatchingRecords')}</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[#06B6D4] text-sm mt-2 hover:underline"
                  >
                    {t('clearFilterConditions')}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[#9090A0]">{t('noRecords')}</p>
                  <p className="text-[#606070] text-sm mt-1">{t('shareToEarn')}</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#0A0A0F]/50">
                      <th className="text-left py-3 px-5 text-[#9090A0] text-sm font-medium">{t('user')}</th>
                      <th className="text-left py-3 px-5">
                        <TableHeaderFilter
                          label={t('level')}
                          value={levelFilter}
                          options={levelOptions}
                          onChange={setLevelFilter}
                        />
                      </th>
                      <th className="text-left py-3 px-5">
                        <TableHeaderFilter
                          label={t('registerTime')}
                          value={dateFilter}
                          options={dateOptions}
                          onChange={setDateFilter}
                        />
                      </th>
                      <th className="text-left py-3 px-5">
                        <TableHeaderFilter
                          label={t('status')}
                          value={statusFilter}
                          options={statusOptions}
                          onChange={setStatusFilter}
                        />
                      </th>
                      <th className="text-right py-3 px-5 text-[#9090A0] text-sm font-medium">{t('contributedEarnings')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReferrals.map((referral, index) => (
                      <tr key={index} className="border-t border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/30 transition-colors">
                        <td className="py-4 px-5 font-medium">{referral.username}</td>
                        <td className="py-4 px-5">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            referral.level === 1
                              ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                              : 'bg-[#8B5CF6]/20 text-[#8B5CF6]'
                          }`}>
                            {referral.level === 1 ? t('level1') : t('level2')}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-[#9090A0] text-sm">{referral.joinDate}</td>
                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            referral.status === 'Active'
                              ? 'bg-[#10B981]/20 text-[#10B981]'
                              : 'bg-[#606070]/20 text-[#606070]'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              referral.status === 'Active' ? 'bg-[#10B981]' : 'bg-[#606070]'
                            }`} />
                            {referral.status === 'Active' ? t('active') : t('inactive')}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-mono font-semibold text-[#06B6D4]">
                          +${referral.earnings.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-center p-4 border-t border-[#1E1E2E]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('prevPage')}
                  </button>
                  <span className="px-4 py-1.5 text-[#9090A0] text-sm">
                    {t('pageNumber', { page: currentPage })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="px-3 py-1.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm"
                  >
                    {t('nextPage')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ========== 介绍区域：规则说明 + 排行榜 ========== */}

        {/* 返佣规则（可折叠） */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          <button
            type="button"
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between p-5 hover:bg-[#1E1E2E]/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-[#06B6D4]" />
              <span className="font-bold">{t('commissionRules')}</span>
              <span className="text-[#9090A0] text-sm">{t('level1')} 30% · {t('level2')} 10%</span>
            </div>
            {showRules ? (
              <ChevronUp className="w-5 h-5 text-[#9090A0]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#9090A0]" />
            )}
          </button>

          {showRules && (
            <div className="px-5 pb-5 border-t border-[#1E1E2E]">
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                {/* 一级返佣 */}
                <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-7 h-7 bg-[#06B6D4] rounded-full flex items-center justify-center text-white text-sm font-bold">
                      1
                    </div>
                    <span className="font-semibold">{t('level1Commission')}</span>
                    <span className="text-2xl font-bold text-[#06B6D4] ml-auto">30%</span>
                  </div>
                  <p className="text-[#9090A0] text-sm">{t('level1CommissionDesc')}</p>
                </div>

                {/* 二级返佣 */}
                <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-7 h-7 bg-[#8B5CF6] rounded-full flex items-center justify-center text-white text-sm font-bold">
                      2
                    </div>
                    <span className="font-semibold">{t('level2Commission')}</span>
                    <span className="text-2xl font-bold text-[#8B5CF6] ml-auto">10%</span>
                  </div>
                  <p className="text-[#9090A0] text-sm">{t('level2CommissionDesc')}</p>
                </div>
              </div>

              {/* 规则说明 */}
              <div className="mt-4 p-4 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-[#06B6D4]" />
                    <span className="text-[#9090A0]">{t('realTimeSettlement')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-[#06B6D4]" />
                    <span className="text-[#9090A0]">{t('autoCredit')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-[#06B6D4]" />
                    <span className="text-[#9090A0]">{t('lifetimeValid')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-[#06B6D4]" />
                    <span className="text-[#9090A0]">{t('noLimit')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 邀请排行榜（可折叠） */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          <button
            type="button"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="w-full flex items-center justify-between p-5 hover:bg-[#1E1E2E]/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-[#F59E0B]" />
              <span className="font-bold">{t('leaderboard')}</span>
              <span className="text-[#9090A0] text-sm">TOP 5</span>
            </div>
            {showLeaderboard ? (
              <ChevronUp className="w-5 h-5 text-[#9090A0]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#9090A0]" />
            )}
          </button>

          {showLeaderboard && (
            <div className="px-5 pb-5 border-t border-[#1E1E2E]">
              <div className="space-y-2 mt-4">
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
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        user.rank === 1 ? 'bg-yellow-500 text-black' :
                        user.rank === 2 ? 'bg-gray-400 text-black' :
                        user.rank === 3 ? 'bg-orange-500 text-black' :
                        'bg-[#2A2A3A] text-[#9090A0]'
                      }`}>
                        {user.rank}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{user.username}</div>
                        <div className="text-[#9090A0] text-xs">{user.referrals} {t('referrals')}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-[#06B6D4]">
                        ${user.earnings.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Spacer for mobile nav */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  )
}
