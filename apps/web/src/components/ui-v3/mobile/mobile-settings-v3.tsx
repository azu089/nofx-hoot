'use client'

import { useState } from 'react'
import {
  User,
  Shield,
  Bell,
  Globe,
  Info,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Home,
  BarChart3,
  Layers,
  Wallet
} from 'lucide-react'

interface MobileSettingsV3Props {
  user?: {
    email: string
    username: string
  }
  onBack?: () => void
  onLogout?: () => void
  onNavigate?: (path: string) => void
}

export function MobileSettingsV3({
  user = {
    email: 'user@example.com',
    username: 'cryptotrader'
  },
  onBack,
  onLogout,
  onNavigate
}: MobileSettingsV3Props) {
  const [navTab, setNavTab] = useState('me')
  const [settings, setSettings] = useState({
    twoFactorEnabled: true,
    emailNotifications: true,
    pushNotifications: false,
    tradingAlerts: true,
    darkMode: true,
    language: '简体中文'
  })

  const handleNavChange = (tabId: string) => {
    setNavTab(tabId)
    onNavigate?.(tabId)
  }

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const Toggle = ({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`切换${label}`}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-[#06B6D4]' : 'bg-[#3A3A4A]'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
          enabled ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )

  const menuSections = [
    {
      title: '账户',
      icon: User,
      items: [
        { label: '邮箱', value: user.email, type: 'info' as const },
        { label: '用户名', value: user.username, type: 'info' as const },
      ]
    },
    {
      title: '安全',
      icon: Shield,
      items: [
        { label: '双重验证 (2FA)', key: 'twoFactorEnabled' as const, type: 'toggle' as const },
        { label: '修改密码', type: 'link' as const, path: '/settings/password' },
      ]
    },
    {
      title: '通知',
      icon: Bell,
      items: [
        { label: '邮件通知', key: 'emailNotifications' as const, type: 'toggle' as const },
        { label: '推送通知', key: 'pushNotifications' as const, type: 'toggle' as const },
        { label: '交易提醒', key: 'tradingAlerts' as const, type: 'toggle' as const },
      ]
    },
    {
      title: '语言与外观',
      icon: Globe,
      items: [
        { label: '语言', value: settings.language, type: 'link' as const, path: '/settings/language' },
        { label: '深色模式', key: 'darkMode' as const, type: 'toggle' as const },
      ]
    },
    {
      title: '关于',
      icon: Info,
      items: [
        { label: '版本信息', value: 'v1.0.0', type: 'info' as const },
        { label: '帮助与支持', type: 'link' as const, path: '/help' },
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] max-w-md mx-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-[#1E1E2E] px-4 py-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-1" aria-label="返回">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">设置</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {menuSections.map((section) => (
          <div key={section.title} className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E1E2E]">
              <section.icon className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-sm font-medium text-[#9090A0]">{section.title}</span>
            </div>

            {section.items.map((item, index) => (
              <div
                key={item.label}
                className={`flex items-center justify-between px-4 py-3 ${
                  index !== section.items.length - 1 ? 'border-b border-[#1E1E2E]' : ''
                }`}
              >
                <span className="text-[#F8F8FC]">{item.label}</span>

                {item.type === 'info' && (
                  <span className="text-sm text-[#606070]">{item.value}</span>
                )}

                {item.type === 'toggle' && item.key && (
                  <Toggle
                    enabled={settings[item.key] as boolean}
                    onToggle={() => handleToggle(item.key as keyof typeof settings)}
                    label={item.label}
                  />
                )}

                {item.type === 'link' && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.(item.path || '')}
                    className="flex items-center gap-1 text-sm text-[#606070]"
                  >
                    {'value' in item && item.value && <span>{item.value}</span>}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Logout Button */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">退出登录</span>
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
