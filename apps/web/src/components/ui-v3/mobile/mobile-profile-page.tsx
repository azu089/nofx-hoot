"use client"

import Image from 'next/image'
import { useState } from 'react'
import {
  Crown,
  Gift,
  Bell,
  Settings,
  HelpCircle,
  Info,
  LogOut,
  Users,
  Copy,
  Check,
  ChevronRight
} from 'lucide-react'

interface MobileProfilePageProps {
  user?: {
    id: string
    username: string
    email: string
    subscriptionTier: 'basic' | 'premium' | 'pro'
  }
  referral?: {
    inviteCount: number
    totalEarnings: number
  }
  unreadNotifications?: number
  appVersion?: string
  onNavigate?: (path: string) => void
  onLogout?: () => void
}

export function MobileProfilePage({
  user = {
    id: 'USR20230315001',
    username: 'CryptoTrader_Pro',
    email: 'use***@example.com',
    subscriptionTier: 'premium'
  },
  referral = {
    inviteCount: 12,
    totalEarnings: 1580.50
  },
  unreadNotifications = 3,
  appVersion = 'v1.19.0',
  onNavigate,
  onLogout
}: MobileProfilePageProps) {
  const [copied, setCopied] = useState(false)

  // 截断 UID 显示
  const truncateId = (id: string) => {
    if (id.length <= 12) return id
    return `${id.slice(0, 6)}...${id.slice(-4)}`
  }

  // 复制 ID 到剪贴板
  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 获取会员等级标签
  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'pro': return '专业版'
      case 'premium': return '高级版'
      default: return '基础版'
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
      label: '会员订阅',
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
      icon: Gift,
      label: '邀请返佣',
      path: '/referral',
      iconColor: 'text-[#EC4899]',
      iconBg: 'bg-[#EC4899]/10',
      rightContent: (
        <div className="flex items-center gap-2">
          <span className="text-[#EC4899] font-medium text-sm">${referral.totalEarnings.toLocaleString()}</span>
          <div className="flex items-center gap-1 text-[#9090A0] text-xs">
            <Users className="w-3 h-3" />
            <span>{referral.inviteCount}</span>
          </div>
        </div>
      )
    },
    {
      icon: Bell,
      label: '通知公告',
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
      icon: Settings,
      label: '设置',
      path: '/settings',
      iconColor: 'text-[#8B5CF6]',
      iconBg: 'bg-[#8B5CF6]/10',
      rightContent: null
    },
    {
      icon: HelpCircle,
      label: '帮助中心',
      path: '/help',
      iconColor: 'text-[#10B981]',
      iconBg: 'bg-[#10B981]/10',
      rightContent: null
    },
    {
      icon: Info,
      label: '关于 Hoot',
      path: '/about',
      iconColor: 'text-[#3B82F6]',
      iconBg: 'bg-[#3B82F6]/10',
      rightContent: <span className="text-[#606070] text-sm">{appVersion}</span>
    }
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-24">
      {/* 页面标题 */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-white">我的</h1>
      </div>

      {/* 用户信息卡片 - 与桌面端对齐 */}
      <div className="px-4 pt-2 pb-4">
        <div className="glass-border-glow relative overflow-hidden rounded-2xl border border-cyan-500/[0.08] bg-[#12121A]/30 backdrop-blur-[72px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-4">
            {/* 头像 - 与桌面端相同的渐变边框 */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#0891B2] p-0.5 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <div className="w-full h-full rounded-full bg-[#1A1A24] flex items-center justify-center overflow-hidden">
                  <Image
                    src="/icons/hoot/logo.png"
                    alt="Avatar"
                    width={56}
                    height={56}
                    className="rounded-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* 用户信息 */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate mb-0.5">{user.username}</h2>
              <p className="text-[#9090A0] text-sm truncate mb-1">{user.email}</p>
              {user.subscriptionTier !== 'basic' && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r ${getTierColor(user.subscriptionTier)} text-white`}>
                  <Crown className="w-2.5 h-2.5" />
                  {getTierLabel(user.subscriptionTier)}
                </span>
              )}
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1.5 text-[#606070] text-xs mt-1 hover:text-[#9090A0] transition-colors active:scale-95"
                aria-label="复制用户ID"
              >
                <span>ID: {truncateId(user.id)}</span>
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-[#10B981]" />
                    <span className="text-[#10B981]">已复制</span>
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
          aria-label="退出登录"
        >
          <LogOut className="w-4 h-4" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  )
}
