'use client'

import { Home, TrendingUp, Briefcase, Wallet, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/provider'

interface MobileNavProps {
  activeTab: 'home' | 'strategies' | 'trading' | 'assets' | 'me'
  onTabChange?: (tab: 'home' | 'strategies' | 'trading' | 'assets' | 'me') => void
  /** 是否嵌入容器内（非fixed定位） */
  embedded?: boolean
  className?: string
}

const tabConfig = [
  { id: 'home', labelKey: 'home', icon: Home },
  { id: 'strategies', labelKey: 'strategies', icon: TrendingUp },
  { id: 'trading', labelKey: 'trading', icon: Briefcase },
  { id: 'assets', labelKey: 'wallet', icon: Wallet },
  { id: 'me', labelKey: 'profile', icon: User },
] as const

export function MobileNav({ activeTab, onTabChange, embedded = false, className }: MobileNavProps) {
  const t = useTranslations('nav')
  return (
    <nav className={cn(
      "bg-[#12121A] border-t border-[#1E1E2E] px-2 py-2",
      embedded ? "" : "fixed bottom-0 left-0 right-0 z-50",
      className
    )}>
      <div className="flex justify-around items-center">
        {tabConfig.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              type="button"
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
                {t(tab.labelKey)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
