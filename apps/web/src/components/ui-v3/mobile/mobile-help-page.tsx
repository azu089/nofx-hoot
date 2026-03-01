'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Search,
  BookOpen,
  Key,
  Brain,
  Wallet,
  Coins,
  Users,
  Microscope,
  ShieldCheck,
  CreditCard,
  Mail,
  MessageCircle,
  ChevronDown
} from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface FAQItem {
  questionKey: string
  answerKey: string
}

const quickAccessConfig = [
  { icon: BookOpen, titleKey: 'quickLinksData.gettingStarted', slug: 'getting-started' },
  { icon: Brain, titleKey: 'quickLinksData.aiTrading', slug: 'ai-trading' },
  { icon: Microscope, titleKey: 'quickLinksData.aiResearch', slug: 'ai-research' },
  { icon: Key, titleKey: 'quickLinksData.apiKeys', slug: 'api-keys' },
  { icon: Wallet, titleKey: 'quickLinksData.walletFunds', slug: 'wallet-funds' },
  { icon: Coins, titleKey: 'quickLinksData.hootToken', slug: 'hoot-token' },
  { icon: Users, titleKey: 'quickLinksData.inviteEarn', slug: 'invite-earn' },
  { icon: ShieldCheck, titleKey: 'quickLinksData.billingSecurity', slug: 'billing-security' },
]

const faqItemsConfig: FAQItem[] = [
  { questionKey: 'faqItems.q1', answerKey: 'faqItems.a1' },
  { questionKey: 'faqItems.q2', answerKey: 'faqItems.a2' },
  { questionKey: 'faqItems.q3', answerKey: 'faqItems.a3' },
  { questionKey: 'faqItems.q4', answerKey: 'faqItems.a4' },
  { questionKey: 'faqItems.q5', answerKey: 'faqItems.a5' },
  { questionKey: 'faqItems.q6', answerKey: 'faqItems.a6' },
  { questionKey: 'faqItems.q7', answerKey: 'faqItems.a7' },
  { questionKey: 'faqItems.q8', answerKey: 'faqItems.a8' },
  { questionKey: 'faqItems.q9', answerKey: 'faqItems.a9' },
  { questionKey: 'faqItems.q10', answerKey: 'faqItems.a10' },
]

interface MobileHelpPageProps {
  onBack?: () => void
  onNavigate?: (path: string) => void
}

export function MobileHelpPage({ onBack, onNavigate }: MobileHelpPageProps) {
  const t = useTranslations('help')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  // Build translated FAQ items for search
  const faqItemsWithText = faqItemsConfig.map(item => ({
    ...item,
    question: t(item.questionKey),
    answer: t(item.answerKey)
  }))

  const filteredFAQs = faqItemsWithText.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-8">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">{t('title')}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* 搜索栏 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-[#12121A] border border-[#1E1E2E] rounded-xl text-sm text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* 快速入口 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="grid grid-cols-4">
            {quickAccessConfig.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.titleKey}
                  type="button"
                  onClick={() => onNavigate?.(`/help/${item.slug}`)}
                  className="flex flex-col items-center py-4 hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-2">
                    <Icon className="w-5 h-5 text-cyan-500" />
                  </div>
                  <span className="text-xs text-[#94A3B8]">{t(item.titleKey)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 常见问题 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E1E2E]/50">
            <span className="text-sm font-medium text-white">{t('faq')}</span>
          </div>
          <div className="divide-y divide-[#1E1E2E]/50">
            {filteredFAQs.map((item, index) => {
              const isExpanded = expandedFAQ === index
              return (
                <div key={index}>
                  <button
                    type="button"
                    onClick={() => setExpandedFAQ(isExpanded ? null : index)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left"
                  >
                    <span className="text-sm text-white pr-4">{item.question}</span>
                    <ChevronDown className={`w-4 h-4 text-[#94A3B8] flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3.5">
                      <p className="text-xs text-[#94A3B8] leading-relaxed">{item.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {filteredFAQs.length === 0 && (
            <p className="text-center text-[#94A3B8] text-sm py-8">{t('noResults')}</p>
          )}
        </div>

        {/* 联系客服 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-[#1E1E2E]/50">
            <a
              href="mailto:support@hoot.trade"
              className="flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                <Mail className="w-4 h-4 text-cyan-500" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{t('emailSupport')}</div>
                <div className="text-[11px] text-[#94A3B8]">{t('emailResponseTime')}</div>
              </div>
            </a>
            <button
              type="button"
              className="flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center relative">
                <MessageCircle className="w-4 h-4 text-cyan-500" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#22C55E] rounded-full" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{t('liveChat')}</div>
                <div className="text-[11px] text-[#22C55E]">{t('online')}</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
