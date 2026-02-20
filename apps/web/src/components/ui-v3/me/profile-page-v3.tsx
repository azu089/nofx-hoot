'use client'

import Image from 'next/image'
import { useState } from 'react'
import {
  Crown,
  ChevronRight,
  Settings,
  Bell,
  HelpCircle,
  Info,
  LogOut,
  Copy,
  Check,
  Brain,
  Download
} from 'lucide-react'

interface ProfilePageV3Props {
  user?: {
    id: string
    username: string
    email: string
    memberSince: string
    vipLevel: number
    subscriptionTier: 'basic' | 'premium' | 'pro'
  }
  unreadNotifications?: number
  appVersion?: string
  onNavigate?: (path: string) => void
  onLogout?: () => void
}

export function ProfilePageV3({
  user = {
    id: 'USR20230315001',
    username: 'CryptoTrader_Pro',
    email: 'use***@example.com',
    memberSince: '2023.3.15',
    vipLevel: 12,
    subscriptionTier: 'premium'
  },
  unreadNotifications = 3,
  appVersion = 'v1.19.0',
  onNavigate,
  onLogout
}: ProfilePageV3Props) {
  const [copied, setCopied] = useState(false)

  // 截断 UID 显示（行业标准：前6后4）
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

  // 菜单项配置
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
      icon: Brain,
      label: 'LLM API KEY',
      path: '/settings/ai',
      iconColor: 'text-[#06B6D4]',
      iconBg: 'bg-[#06B6D4]/10',
      rightContent: null
    },
    {
      icon: Download,
      label: '安装应用',
      path: 'pwa-install',
      iconColor: 'text-[#10B981]',
      iconBg: 'bg-[#10B981]/10',
      rightContent: null
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
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-[#F8F8FC]">我的</h1>
        </div>

        {/* User Profile Card */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden">
                <Image src="/icons/hoot/logo.png" alt="Hoot" width={64} height={64} className="w-full h-full object-contain" />
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#F8F8FC] truncate">{user.username}</h2>
                {user.subscriptionTier !== 'basic' && (
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r ${getTierColor(user.subscriptionTier)} flex items-center justify-center`}>
                    <Crown className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <p className="text-[#9090A0] text-sm">{user.email}</p>
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1.5 text-[#606070] text-xs mt-1 hover:text-[#9090A0] transition-colors"
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

        {/* Menu List */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const isLast = index === menuItems.length - 1
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate?.(item.path)}
                className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-[#1E1E2E]/50 transition-colors group ${
                  !isLast ? 'border-b border-[#1E1E2E]/50' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <span className="flex-1 text-left text-[#F8F8FC] font-medium">{item.label}</span>
                {item.rightContent}
                <ChevronRight className="w-4 h-4 text-[#404050] group-hover:text-[#06B6D4] transition-colors ml-1" />
              </button>
            )
          })}
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-4 backdrop-blur-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-2xl transition-all text-red-400 font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>退出登录</span>
        </button>

        {/* Bottom Spacer for mobile nav */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  )
}
