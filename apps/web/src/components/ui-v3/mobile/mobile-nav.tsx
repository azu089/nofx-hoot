'use client'

import { Home, TrendingUp, Briefcase, Wallet, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  activeTab: 'home' | 'strategies' | 'trading' | 'assets' | 'me'
  onTabChange?: (tab: 'home' | 'strategies' | 'trading' | 'assets' | 'me') => void
}

const tabs = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'strategies', label: '策略', icon: TrendingUp },
  { id: 'trading', label: '交易', icon: Briefcase },
  { id: 'assets', label: '资产', icon: Wallet },
  { id: 'me', label: '我的', icon: User },
] as const

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#12121A] border-t border-[#1E1E2E] px-2 py-2 z-50">
      <div className="flex justify-around items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all",
                isActive
                  ? "text-transparent"
                  : "text-[#606070]"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  isActive
                    ? "text-[#F8F8FC]"
                    : "text-[#606070]"
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  isActive
                    ? "text-[#F8F8FC]"
                    : "text-[#606070]"
                )}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
