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
  Brain,
  Download
} from 'lucide-react'

interface MobileProfilePageProps {
  user?: {
    id: string
    uid?: number
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
  const [copied, setCopied] = useState(false)

  // user 未加载时不渲染
  if (!user) return null

  // 显示用户 ID（uid + 100000 偏移，避免显示个位数；无 uid 时用 UUID 前 8 位）
  const displayId = user.uid ? String(100000 + user.uid) : user.id.slice(0, 8)

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
      case 'pro': return 'from-amber-400 to-orange-500'
      case 'premium': return 'from-cyan-400 to-blue-500'
      default: return 'from-gray-400 to-gray-500'
    }
  }

  // 菜单项配置 - 与桌面端对齐
  const menuItems = [
    {
      icon: Crown,
      label: t('subscription'),
      path: '/subscription',
      iconColor: 'text-[#F59E0B]',
      iconBg: 'bg-[#F59E0B]/10',
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
      iconColor: 'text-[#06B6D4]',
      iconBg: 'bg-[#06B6D4]/10',
      rightContent: unreadNotifications > 0 ? (
        <span className="bg-[#06B6D4] text-[#0A0A0F] text-xs font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {unreadNotifications}
        </span>
      ) : null
    },
    {
      icon: Brain,
      label: t('aiSettings'),
      path: '/settings/ai',
      iconColor: 'text-[#06B6D4]',
      iconBg: 'bg-[#06B6D4]/10',
      rightContent: null
    },
    {
      icon: Download,
      label: t('installApp'),
      path: 'pwa-install',
      iconColor: 'text-[#10B981]',
      iconBg: 'bg-[#10B981]/10',
      rightContent: null
    },
    {
      icon: Settings,
      label: t('settings'),
      path: '/settings',
      iconColor: 'text-[#8B5CF6]',
      iconBg: 'bg-[#8B5CF6]/10',
      rightContent: null
    },
    {
      icon: HelpCircle,
      label: t('helpCenter'),
      path: '/help',
      iconColor: 'text-[#10B981]',
      iconBg: 'bg-[#10B981]/10',
      rightContent: null
    },
    {
      icon: Info,
      label: t('about'),
      path: '/about',
      iconColor: 'text-[#3B82F6]',
      iconBg: 'bg-[#3B82F6]/10',
      rightContent: <span className="text-[#606070] text-sm">{appVersion}</span>
    }
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      {/* Header - 标题 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-center px-4 h-14">
          <h1 className="text-base font-semibold text-white">{t('title')}</h1>
        </div>
      </div>

      {/* 用户信息卡片 */}
      <div className="px-4 pt-4 pb-4">
        <div className="glass-border-glow relative overflow-hidden rounded-2xl border border-cyan-500/[0.08] bg-[#12121A]/30 backdrop-blur-[72px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
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
                    <Check className="w-3 h-3 text-[#10B981]" />
                    <span className="text-[#10B981]">{tCommon('copied')}</span>
                  </>
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 功能菜单列表 - 与桌面端对齐 */}
      <div className="px-4">
        <div className="glass-border-glow relative overflow-hidden rounded-2xl border border-cyan-500/[0.08] bg-[#12121A]/30 backdrop-blur-[72px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div>
            {menuItems.map((item, index) => {
              const Icon = item.icon
              const isLast = index === menuItems.length - 1
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => onNavigate?.(item.path)}
                  className={`w-full flex items-center gap-4 px-4 py-4 hover:bg-[#1E1E2E]/50 active:bg-[#1E1E2E]/70 transition-colors ${
                    !isLast ? 'border-b border-[#1E1E2E]/50' : ''
                  }`}
                  aria-label={item.label}
                >
                  <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${item.iconColor}`} />
                  </div>
                  <span className="flex-1 text-left text-white font-medium">{item.label}</span>
                  {item.rightContent}
                  <ChevronRight className="w-4 h-4 text-[#404050] ml-1" />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 退出登录按钮 - 与桌面端对齐 */}
      <div className="px-4 mt-4">
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
