'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Home,
  TrendingUp,
  Briefcase,
  Wallet,
  User,
  Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/provider'

const navigationItemsConfig = [
  { id: 'home', labelKey: 'home', icon: Home, href: '/dashboard' },
  { id: 'ai', labelKey: 'ai', icon: Brain, href: '/ai' },
  { id: 'strategy', labelKey: 'strategies', icon: TrendingUp, href: '/strategies' },
  { id: 'trading', labelKey: 'trading', icon: Briefcase, href: '/trading' },
  { id: 'assets', labelKey: 'wallet', icon: Wallet, href: '/wallet' },
  { id: 'profile', labelKey: 'profile', icon: User, href: '/profile' },
]

interface SidebarProps {
  activeItem?: string
}

export function Sidebar({ activeItem = 'home' }: SidebarProps) {
  const t = useTranslations('nav')
  const [active, setActive] = useState(activeItem)

  const navigationItems = navigationItemsConfig.map(item => ({
    ...item,
    label: t(item.labelKey)
  }))

  return (
    <div className="fixed left-0 top-0 h-full w-60 bg-[#12121A] border-r border-[#1E1E2E]">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center gap-2 border-b border-[#1E1E2E]">
        <Image src="/icons/hoot/token.png" alt="Hoot" width={32} height={32} className="object-contain" priority />
        <h1 className="text-2xl font-bold text-[#F8F8FC]">
          Hoot
        </h1>
      </div>

      {/* Navigation Items */}
      <nav className="flex flex-col gap-2 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id

          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 group",
                isActive
                  ? "bg-[#1E1E2E] text-[#F8F8FC] border border-[#2A2A3A]"
                  : "hover:bg-[#1E1E2E]/50"
              )}
            >
              <Icon
                size={20}
                className={cn(
                  "transition-colors duration-200",
                  isActive
                    ? "text-white"
                    : "text-[#9090A0] group-hover:text-[#F8F8FC]"
                )}
              />
              <span
                className={cn(
                  "font-medium transition-colors duration-200",
                  isActive
                    ? "text-white"
                    : "text-[#F8F8FC] group-hover:text-white"
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1E1E2E]">
        <div className="text-xs text-center text-[#9090A0]">
          © 2026 Hoot
        </div>
      </div>
    </div>
  )
}
