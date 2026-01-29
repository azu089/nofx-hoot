'use client'

import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Shield,
  AlertTriangle,
  Globe,
  Mail,
  MessageCircle,
  ExternalLink
} from 'lucide-react'

interface AboutPageProps {
  appVersion?: string
  buildNumber?: string
  onNavigate?: (path: string) => void
}

export function AboutPage({
  appVersion = 'v1.19.0',
  buildNumber = '2026.01.30',
  onNavigate
}: AboutPageProps) {
  // 法律文档链接
  const legalItems = [
    {
      icon: FileText,
      label: '用户协议',
      path: '/legal/terms'
    },
    {
      icon: Shield,
      label: '隐私政策',
      path: '/legal/privacy'
    },
    {
      icon: AlertTriangle,
      label: '风险提示',
      path: '/legal/risk'
    }
  ]

  // 社交媒体链接
  const socialLinks = [
    {
      icon: Globe,
      label: '官方网站',
      url: 'https://hoot.trade',
      external: true
    },
    {
      icon: MessageCircle,
      label: 'Telegram',
      url: 'https://t.me/hoot_official',
      external: true
    },
    {
      icon: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      label: 'Twitter / X',
      url: 'https://x.com/hoot_trade',
      external: true
    },
    {
      icon: Mail,
      label: '联系我们',
      url: 'mailto:support@hoot.trade',
      external: true
    }
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header with Back */}
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => onNavigate?.('/me')}
            className="p-2 -ml-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#9090A0]" />
          </button>
          <h1 className="text-2xl font-bold text-[#F8F8FC]">关于 Hoot</h1>
        </div>

        {/* App Info Card */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-8 shadow-[0_0_30px_rgba(6,182,212,0.05)] text-center">
          {/* Logo */}
          <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#06B6D4] to-[#0891B2] p-0.5 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            <div className="w-full h-full rounded-2xl bg-[#1A1A24] flex items-center justify-center overflow-hidden">
              <Image
                src="/icons/hoot/logo.png"
                alt="Hoot"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>
          </div>

          {/* App Name & Tagline */}
          <h2 className="text-2xl font-bold mb-2">Hoot</h2>
          <p className="text-[#9090A0] text-sm mb-4">AI 驱动的量化交易平台</p>

          {/* Version Info */}
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-[#1E1E2E] rounded-full text-sm">
            <span className="text-[#9090A0]">版本</span>
            <span className="font-mono text-[#06B6D4]">{appVersion}</span>
            <span className="text-[#404050]">|</span>
            <span className="text-[#606070] font-mono">{buildNumber}</span>
          </div>
        </div>

        {/* Legal Documents */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <div className="px-5 py-3 border-b border-[#1E1E2E]/50">
            <h3 className="text-sm font-medium text-[#9090A0]">法律条款</h3>
          </div>
          {legalItems.map((item, index) => {
            const Icon = item.icon
            const isLast = index === legalItems.length - 1
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate?.(item.path)}
                className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-[#1E1E2E]/50 transition-colors group ${
                  !isLast ? 'border-b border-[#1E1E2E]/50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5 text-[#9090A0]" />
                </div>
                <span className="flex-1 text-left text-[#F8F8FC]">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-[#404050] group-hover:text-[#06B6D4] transition-colors" />
              </button>
            )
          })}
        </div>

        {/* Social & Contact */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.05)]">
          <div className="px-5 py-3 border-b border-[#1E1E2E]/50">
            <h3 className="text-sm font-medium text-[#9090A0]">联系我们</h3>
          </div>
          {socialLinks.map((item, index) => {
            const Icon = item.icon
            const isLast = index === socialLinks.length - 1
            return (
              <a
                key={item.url}
                href={item.url}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-[#1E1E2E]/50 transition-colors group ${
                  !isLast ? 'border-b border-[#1E1E2E]/50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5 text-[#9090A0]" />
                </div>
                <span className="flex-1 text-left text-[#F8F8FC]">{item.label}</span>
                {item.external && (
                  <ExternalLink className="w-4 h-4 text-[#404050] group-hover:text-[#06B6D4] transition-colors" />
                )}
              </a>
            )
          })}
        </div>

        {/* Copyright */}
        <div className="text-center py-4">
          <p className="text-[#606070] text-sm">
            © 2024-2026 Hoot. All rights reserved.
          </p>
        </div>

        {/* Bottom Spacer for mobile nav */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  )
}
