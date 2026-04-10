"use client"

import Image from 'next/image'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Crown,
  Bell,
  Settings,
  HelpCircle,
  Info,
  LogOut,
  Copy,
  Check,
  ChevronRight,
  Download,
  Users,
  BarChart3
} from 'lucide-react'

interface MobileProfilePageProps {
  user?: {
    id: string
    uid?: number
    userCode?: string | null
    username: string
    email: string
    subscriptionTier: 'basic' | 'premium' | 'pro'
  }
  unreadNotifications?: number
  appVersion?: string
  onNavigate?: (path: string) => void
  onLogout?: () => void
}

export function MobileProfilePage({
  user,
  unreadNotifications = 0,
  appVersion = 'v1.19.0',
  onNavigate,
  onLogout
}: MobileProfilePageProps) {
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const tDashboard = useTranslations('dashboard')
  const [copied, setCopied] = useState(false)

  // user 未加载时不渲染
  if (!user) return null

  // 显示用户 ID（优先用 userCode；无时用 UUID 前 8 位）
  const displayId = user.userCode ?? user.id.slice(0, 8)

  // 复制 ID 到剪贴板
  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(displayId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Copy failed:', err)
      }
    }
  }

  // 获取会员等级标签
  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'pro': return t('pro')
      case 'premium': return t('premium')
      default: return t('basic')
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro': return 'from-emerald-300 to-emerald-500'
      case 'premium': return 'from-emerald-400/70 to-emerald-500/70'
      default: return 'from-gray-400 to-gray-500'
    }
  }

  // 菜单项配置
  const menuItems = [
    {
      icon: BarChart3,
      label: t('positions'),
      path: '/trading',
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-400/10',
      rightContent: null
    },
    {
      icon: Users,
      label: tDashboard('quickAccess.inviteFriends'),
      path: '/referral',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      rightContent: null
    },
    {
      icon: Crown,
      label: t('subscription'),
      path: '/subscription',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      rightContent: (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r ${getTierColor(user.subscriptionTier)} text-white`}>
          {getTierLabel(user.subscriptionTier)}
        </span>
      )
    },
    {
      icon: Bell,
      label: t('notifications'),
      path: '/notifications',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      rightContent: unreadNotifications > 0 ? (
        <span className="bg-emerald-400 text-[#052015] text-xs font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {unreadNotifications}
        </span>
      ) : null
    },
    {
      icon: Download,
      label: t('installApp'),
      path: 'pwa-install',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      rightContent: null
    },
    {
      icon: Settings,
      label: t('settings'),
      path: '/settings',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      rightContent: null
    },
    {
      icon: HelpCircle,
      label: t('helpCenter'),
      path: '/help',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      rightContent: null
    },
    {
      icon: Info,
      label: t('about'),
      path: '/about',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-400/10',
      rightContent: <span className="text-[#606070] text-sm">{appVersion}</span>
    }
  ]

  return (
    <div className="min-h-screen pb-20">
      {/* 用户信息卡片 */}
      <div className="px-3 pt-3 pb-3">
        <div className="bubble-card p-5">
          <div className="flex items-center gap-4">
            {/* 头像 */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden">
                <Image
                  src="/icons/hoot/token.png"
                  alt="Avatar"
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
            </div>

            {/* 用户信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h2 className="text-lg font-bold text-white truncate">{user.username}</h2>
                {user.subscriptionTier !== 'basic' && (
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r ${getTierColor(user.subscriptionTier)} flex items-center justify-center`}>
                    <Crown className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <p className="text-[#9090A0] text-sm truncate mb-1">{user.email}</p>
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1.5 text-[#606070] text-xs mt-1 hover:text-[#9090A0] transition-colors active:scale-95"
                aria-label={tCommon('copy')}
              >
                <span>ID: {displayId}</span>
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">{tCommon('copied')}</span>
                  </>
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 功能菜单列表 - nofx bubble-card 风格 */}
      <div className="px-3">
        <div className="bubble-card p-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate?.(item.path)}
                className="row-divider group w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-emerald-400/5 active:bg-emerald-400/10 transition-all"
                aria-label={item.label}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/40 border border-white/10 flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Icon className={`w-[18px] h-[18px] ${item.iconColor}`} />
                </div>
                <span className="flex-1 text-left text-sm font-medium text-white truncate">{item.label}</span>
                {item.rightContent}
                <ChevronRight className="w-4 h-4 text-zinc-600 ml-1" />
              </button>
            )
          })}
        </div>
      </div>

      {/* 退出登录按钮 - 与桌面端对齐 */}
      <div className="px-3 mt-3">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-4 backdrop-blur-xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 border border-red-500/30 rounded-2xl transition-all text-red-400 font-medium"
          aria-label={t('logout')}
        >
          <LogOut className="w-4 h-4" />
          <span>{t('logout')}</span>
        </button>
      </div>
    </div>
  )
}
