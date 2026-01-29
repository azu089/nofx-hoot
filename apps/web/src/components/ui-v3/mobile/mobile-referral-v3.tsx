'use client'

import { useState, useMemo } from 'react'
import {
  Gift,
  Users,
  Copy,
  Share2,
  QrCode,
  Trophy,
  Wallet,
  TrendingUp,
  Check,
  ChevronRight,
  ChevronDown,
  Home,
  BarChart3,
  Layers,
  User,
  Filter,
  X
} from 'lucide-react'

interface Referral {
  username: string
  status: 'Active' | 'Inactive'
  earnings: number
  level: 1 | 2
  joinDate: string
}

interface MobileReferralV3Props {
  referralCode?: string
  earnings?: {
    total: number
    activeReferrals: number
    pending: number
  }
  myReferrals?: Referral[]
  onWithdraw?: () => void
  onShare?: (platform: string) => void
  onNavigate?: (tab: string) => void
}

const defaultReferrals: Referral[] = [
  { username: 'alice***123', status: 'Active', earnings: 45.67, level: 1, joinDate: '2024-01-15' },
  { username: 'bob***456', status: 'Active', earnings: 32.10, level: 1, joinDate: '2024-01-12' },
  { username: 'charlie***789', status: 'Inactive', earnings: 18.45, level: 2, joinDate: '2024-01-08' },
  { username: 'david***012', status: 'Active', earnings: 67.89, level: 1, joinDate: '2024-01-05' },
  { username: 'eve***345', status: 'Active', earnings: 23.45, level: 2, joinDate: '2024-01-02' },
]

// 移动端筛选下拉
function MobileFilterDropdown({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find(o => o.value === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg text-xs"
      >
        <span className="text-[#F8F8FC]">{selectedOption?.label}</span>
        <ChevronDown className={`w-3 h-3 text-[#9090A0] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg shadow-xl overflow-hidden min-w-[100px]">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#2A2A3A] transition-colors ${
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

export function MobileReferralV3({
  referralCode = 'HOOT2024XYZ',
  earnings = {
    total: 1234.56,
    activeReferrals: 28,
    pending: 89.32
  },
  myReferrals = defaultReferrals,
  onWithdraw,
  onShare,
  onNavigate
}: MobileReferralV3Props) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals'>('overview')
  const [navTab, setNavTab] = useState('referral')

  // 筛选状态
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const referralLink = `https://hoot.trade/invite/${referralCode}`

  // 筛选选项
  const levelOptions = [
    { value: 'all', label: '全部' },
    { value: '1', label: '一级' },
    { value: '2', label: '二级' }
  ]

  const statusOptions = [
    { value: 'all', label: '全部' },
    { value: 'Active', label: '活跃' },
    { value: 'Inactive', label: '非活跃' }
  ]

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
      console.error('Failed to copy:', err)
    }
  }

  const handleNavChange = (tabId: string) => {
    setNavTab(tabId)
    onNavigate?.(tabId)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] max-w-md mx-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E] px-4 py-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#06B6D4] to-[#0891B2] bg-clip-text text-transparent">
          邀请好友
        </h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Invite Code Card - 重新设计布局 */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-[#06B6D4]" />
            <h2 className="font-semibold">我的邀请码</h2>
          </div>

          {/* 邀请码和二维码并排 */}
          <div className="flex gap-4 mb-4">
            {/* 左侧：邀请码信息 */}
            <div className="flex-1 space-y-3">
              <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-3">
                <div className="text-[#606070] text-xs mb-1">邀请码</div>
                <div className="text-xl font-mono font-bold text-[#06B6D4] tracking-wider">
                  {referralCode}
                </div>
              </div>
              <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-3">
                <div className="text-[#606070] text-xs mb-1">链接</div>
                <div className="text-xs text-[#9090A0] break-all line-clamp-2">
                  {referralLink}
                </div>
              </div>
            </div>

            {/* 右侧：二维码 */}
            <div className="flex-shrink-0">
              <div className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-3 text-center">
                <div className="bg-white rounded-lg p-2 mb-1">
                  <QrCode className="w-16 h-16 text-[#0A0A0F]" />
                </div>
                <div className="text-[#606070] text-xs">扫码邀请</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 bg-[#06B6D4] text-black py-3 rounded-xl font-medium"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? '已复制' : '复制链接'}
            </button>
            <button
              type="button"
              onClick={() => onShare?.('share')}
              className="flex items-center justify-center gap-2 bg-[#1E1E2E] border border-[#2A2A3A] py-3 rounded-xl font-medium"
            >
              <Share2 className="w-4 h-4" />
              分享
            </button>
          </div>
        </div>

        {/* Earnings Overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4 text-center">
            <div className="text-lg font-bold text-[#06B6D4]">${earnings.total.toLocaleString()}</div>
            <div className="text-xs text-[#606070]">累计收益</div>
          </div>
          <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4 text-center">
            <div className="text-lg font-bold">{earnings.activeReferrals}</div>
            <div className="text-xs text-[#606070]">邀请人数</div>
          </div>
          <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl p-4 text-center">
            <div className="text-lg font-bold text-green-400">${earnings.pending}</div>
            <div className="text-xs text-[#606070]">待领取</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          {[
            { id: 'overview', label: '返佣规则' },
            { id: 'referrals', label: '我的邀请' },
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

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Commission Tiers */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-[#06B6D4]" />
                <h3 className="font-semibold">返佣比例</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#06B6D4]/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#06B6D4] rounded-full flex items-center justify-center text-black font-bold">
                      1
                    </div>
                    <span>一级返佣</span>
                  </div>
                  <span className="text-xl font-bold text-[#06B6D4]">30%</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0A0A0F]/50 rounded-xl border border-[#1E1E2E]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#0891B2] rounded-full flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <span>二级返佣</span>
                  </div>
                  <span className="text-xl font-bold text-[#0891B2]">10%</span>
                </div>
              </div>
            </div>

            {/* Rules */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
              <h3 className="font-semibold mb-3">奖励规则</h3>
              <div className="space-y-2 text-sm text-[#9090A0]">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-[#06B6D4] flex-shrink-0" />
                  <span>实时结算，无需等待</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-[#06B6D4] flex-shrink-0" />
                  <span>终身有效，持续收益</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-[#06B6D4] flex-shrink-0" />
                  <span>最低提取金额：10 USDT</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-[#06B6D4] flex-shrink-0" />
                  <span>支持多种提取方式</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'referrals' && (
          <div className="space-y-3">
            {/* 筛选栏 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#9090A0]" />
                <MobileFilterDropdown
                  value={levelFilter}
                  options={levelOptions}
                  onChange={setLevelFilter}
                />
                <MobileFilterDropdown
                  value={statusFilter}
                  options={statusOptions}
                  onChange={setStatusFilter}
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-[#F87171]"
                >
                  <X className="w-3 h-3" />
                  清除
                </button>
              )}
            </div>

            {/* 结果统计 */}
            <div className="text-xs text-[#9090A0]">
              共 {filteredReferrals.length} 人
              {hasActiveFilters && <span className="text-[#606070]"> / 总 {myReferrals.length} 人</span>}
            </div>

            {/* 邀请列表 */}
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden">
              {filteredReferrals.length > 0 ? (
                filteredReferrals.map((referral, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-4 ${
                      index !== filteredReferrals.length - 1 ? 'border-b border-[#1E1E2E]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#2A2A3A] rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-[#9090A0]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{referral.username}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            referral.level === 1
                              ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                              : 'bg-[#8B5CF6]/20 text-[#8B5CF6]'
                          }`}>
                            {referral.level === 1 ? '一级' : '二级'}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            referral.status === 'Active'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {referral.status === 'Active' ? '活跃' : '非活跃'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#06B6D4]">+${referral.earnings.toFixed(2)}</div>
                      <div className="text-xs text-[#606070]">{referral.joinDate}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Users className="w-10 h-10 text-[#606070] mx-auto mb-2" />
                  {hasActiveFilters ? (
                    <>
                      <p className="text-[#9090A0] text-sm">没有符合条件的记录</p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-[#06B6D4] text-xs mt-1"
                      >
                        清除筛选
                      </button>
                    </>
                  ) : (
                    <p className="text-[#606070] text-sm">暂无邀请记录</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Withdraw Button */}
        <button
          type="button"
          onClick={onWithdraw}
          disabled={earnings.pending < 10}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#06B6D4] text-black rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Wallet className="w-5 h-5" />
          提取奖励 (${earnings.pending.toFixed(2)})
        </button>
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
