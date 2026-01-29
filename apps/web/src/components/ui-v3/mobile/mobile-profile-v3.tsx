'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  User,
  Bell,
  HelpCircle,
  LogOut,
  Crown,
  TrendingUp,
  Wallet,
  ChevronRight,
  Settings,
  Home,
  BarChart3,
  Layers
} from 'lucide-react'

interface MobileProfileV3Props {
  user?: {
    username: string
    email: string
    memberSince: string
    vipLevel: number
    subscriptionTier: 'basic' | 'premium' | 'pro'
  }
  notifications?: {
    unreadCount: number
  }
  onNavigate?: (path: string) => void
  onLogout?: () => void
}

const recentActivities = [
  { icon: TrendingUp, color: '#10B981', title: '策略执行成功', desc: 'BTC/USDT 获利 +$2,847', time: '2小时前' },
  { icon: Settings, color: '#06B6D4', title: '更新API密钥', desc: 'Binance API配置', time: '1天前' },
  { icon: Crown, color: '#F59E0B', title: '升级会员', desc: '升级到高级版', time: '3天前' },
]

export function MobileProfileV3({
  user = {
    username: 'CryptoTrader_Pro',
    email: 'use***@example.com',
    memberSince: '2023年3月15日',
    vipLevel: 12,
    subscriptionTier: 'premium'
  },
  notifications = {
    unreadCount: 3
  },
  onNavigate,
  onLogout
}: MobileProfileV3Props) {
  const [navTab, setNavTab] = useState('me')

  const handleNavChange = (tabId: string) => {
    setNavTab(tabId)
    onNavigate?.(tabId)
  }

  const subscriptionTierText = {
    basic: '基础版',
    premium: '高级版',
    pro: '专业版'
  }

  const gasFeeRate = {
    basic: '22%',
    premium: '18%',
    pro: '15%'
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] max-w-md mx-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E] px-4 py-3">
        <h1 className="text-xl font-bold">个人中心</h1>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Profile Card with Stats integrated */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            {/* 使用项目 Logo 作为头像 */}
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#0891B2] p-0.5">
                <div className="w-full h-full rounded-full bg-[#1A1A24] flex items-center justify-center overflow-hidden">
                  <Image src="/icons/hoot/logo.png" alt="Hoot" width={32} height={32} className="rounded-full" />
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#06B6D4] rounded-full flex items-center justify-center">
                <Crown className="w-2.5 h-2.5 text-[#0A0A0F]" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base font-bold truncate">{user.username}</h2>
                <span className="px-1.5 py-0.5 bg-[#06B6D4]/20 border border-[#06B6D4]/30 rounded text-[10px] text-[#06B6D4] font-medium flex-shrink-0">
                  VIP {user.vipLevel}
                </span>
              </div>
              <p className="text-[#9090A0] text-xs truncate">{user.email}</p>
            </div>

            {/* Subscription Badge inline */}
            <button
              type="button"
              onClick={() => onNavigate?.('/subscription')}
              className="px-2 py-1 bg-[#F59E0B]/20 border border-[#F59E0B]/30 rounded-lg flex items-center gap-1"
            >
              <span className="text-[#F59E0B] text-xs font-medium">{subscriptionTierText[user.subscriptionTier]}</span>
              <ChevronRight className="w-3 h-3 text-[#F59E0B]" />
            </button>
          </div>

          {/* 会员自注册日期 */}
          <div className="pt-3 border-t border-[#1E1E2E]">
            <p className="text-[#606070] text-xs text-center">会员自 {user.memberSince}</p>
          </div>
        </div>

        {/* Quick Actions 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('/subscription')}
            className="flex flex-col items-center justify-center p-4 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl hover:bg-[#1E1E2E]/50 transition-colors"
          >
            <Crown className="w-6 h-6 text-[#F59E0B] mb-1.5" />
            <span className="text-sm text-[#9090A0]">会员订阅</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/announcements')}
            className="flex flex-col items-center justify-center p-4 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl hover:bg-[#1E1E2E]/50 transition-colors relative"
          >
            <Bell className="w-6 h-6 text-[#8B5CF6] mb-1.5" />
            <span className="text-sm text-[#9090A0]">通知公告</span>
            {notifications.unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-[#EF4444] rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/settings')}
            className="flex flex-col items-center justify-center p-4 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl hover:bg-[#1E1E2E]/50 transition-colors"
          >
            <Settings className="w-6 h-6 text-[#06B6D4] mb-1.5" />
            <span className="text-sm text-[#9090A0]">设置</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/help')}
            className="flex flex-col items-center justify-center p-4 bg-[#12121A]/80 border border-[#1E1E2E] rounded-xl hover:bg-[#1E1E2E]/50 transition-colors"
          >
            <HelpCircle className="w-6 h-6 text-[#9090A0] mb-1.5" />
            <span className="text-sm text-[#9090A0]">帮助中心</span>
          </button>
        </div>

        {/* Recent Activity - More compact */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">最近活动</h3>
            <button
              type="button"
              onClick={() => onNavigate?.('/activity')}
              className="text-xs text-[#06B6D4] flex items-center gap-0.5"
            >
              更多 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-[#0A0A0F]/50">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${activity.color}15` }}
                >
                  <activity.icon className="w-3.5 h-3.5" style={{ color: activity.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{activity.title}</div>
                  <div className="text-[10px] text-[#606070] truncate">{activity.desc}</div>
                </div>
                <div className="text-[10px] text-[#606070] flex-shrink-0">{activity.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout Button - More compact */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">退出登录</span>
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
