'use client'

import { useState } from 'react'
import {
  Search,
  BookOpen,
  Key,
  TrendingUp,
  CreditCard,
  Shield,
  Receipt,
  Brain,
  Wallet,
  Coins,
  Users,
  Microscope,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  ArrowLeft,
  ExternalLink,
  FileText
} from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface QuickLink {
  id: string
  titleKey: string
  descKey: string
  icon: React.ComponentType<{ className?: string }>
}

interface FAQItem {
  id: string
  questionKey: string
  answerKey: string
}

interface HelpCenterPageProps {
  appVersion?: string
  onNavigate?: (path: string) => void
  onContactSupport?: (method: 'email' | 'chat') => void
}

const quickLinksConfig: QuickLink[] = [
  { id: 'getting-started', titleKey: 'quickLinksData.gettingStarted', descKey: 'quickLinksData.gettingStartedDesc', icon: BookOpen },
  { id: 'ai-trading', titleKey: 'quickLinksData.aiTrading', descKey: 'quickLinksData.aiTradingDesc', icon: Brain },
  { id: 'ai-research', titleKey: 'quickLinksData.aiResearch', descKey: 'quickLinksData.aiResearchDesc', icon: Microscope },
  { id: 'api-keys', titleKey: 'quickLinksData.apiKeys', descKey: 'quickLinksData.apiKeysDesc', icon: Key },
  { id: 'wallet-funds', titleKey: 'quickLinksData.walletFunds', descKey: 'quickLinksData.walletFundsDesc', icon: Wallet },
  { id: 'hoot-token', titleKey: 'quickLinksData.hootToken', descKey: 'quickLinksData.hootTokenDesc', icon: Coins },
  { id: 'invite-earn', titleKey: 'quickLinksData.inviteEarn', descKey: 'quickLinksData.inviteEarnDesc', icon: Users },
  { id: 'billing-security', titleKey: 'quickLinksData.billingSecurity', descKey: 'quickLinksData.billingSecurityDesc', icon: ShieldCheck },
]

const faqItemsConfig: FAQItem[] = [
  { id: '1', questionKey: 'faqItems.q1', answerKey: 'faqItems.a1' },
  { id: '2', questionKey: 'faqItems.q2', answerKey: 'faqItems.a2' },
  { id: '3', questionKey: 'faqItems.q3', answerKey: 'faqItems.a3' },
  { id: '4', questionKey: 'faqItems.q4', answerKey: 'faqItems.a4' },
  { id: '5', questionKey: 'faqItems.q5', answerKey: 'faqItems.a5' },
  { id: '6', questionKey: 'faqItems.q6', answerKey: 'faqItems.a6' },
  { id: '7', questionKey: 'faqItems.q7', answerKey: 'faqItems.a7' },
  { id: '8', questionKey: 'faqItems.q8', answerKey: 'faqItems.a8' },
  { id: '9', questionKey: 'faqItems.q9', answerKey: 'faqItems.a9' },
  { id: '10', questionKey: 'faqItems.q10', answerKey: 'faqItems.a10' }
]

export function HelpCenterPage({
  appVersion = 'v1.19.0',
  onNavigate,
  onContactSupport
}: HelpCenterPageProps) {
  const t = useTranslations('help')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id)
  }

  // Build translated FAQ items for search
  const faqItemsWithText = faqItemsConfig.map(item => ({
    ...item,
    question: t(item.questionKey),
    answer: t(item.answerKey)
  }))

  const filteredFAQs = faqItemsWithText.filter(
    item =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={() => onNavigate?.('/profile')}
              className="p-2 hover:bg-[#12121A] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
            </button>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4]/50 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Quick Links Section */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-[#F8F8FC]">{t('quickLinks')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quickLinksConfig.map((link) => {
              const IconComponent = link.icon
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onNavigate?.(`/help/${link.id}`)}
                  className="p-4 rounded-xl bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] hover:border-[#06B6D4]/50 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center mb-3 group-hover:bg-[#06B6D4]/20 transition-colors">
                    <IconComponent className="w-5 h-5 text-[#06B6D4]" />
                  </div>
                  <h3 className="font-medium text-[#F8F8FC] mb-1">{t(link.titleKey)}</h3>
                  <p className="text-xs text-[#9090A0]">{t(link.descKey)}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* FAQ Section */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-[#F8F8FC]">{t('faq')}</h2>
          <div className="space-y-3">
            {filteredFAQs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-[#606070]" />
                <p className="text-[#9090A0]">{t('noResults')}</p>
              </div>
            ) : (
              filteredFAQs.map((faq) => (
                <div
                  key={faq.id}
                  className="bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleFAQ(faq.id)}
                    className="w-full p-4 text-left flex items-center justify-between hover:bg-[#1E1E2E]/30 transition-colors"
                  >
                    <h3 className="font-medium text-[#F8F8FC] pr-4">{faq.question}</h3>
                    {expandedFAQ === faq.id ? (
                      <ChevronUp className="w-5 h-5 flex-shrink-0 text-[#06B6D4]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 flex-shrink-0 text-[#606070]" />
                    )}
                  </button>
                  {expandedFAQ === faq.id && (
                    <div className="px-4 pb-4">
                      <p className="text-[#9090A0] leading-relaxed text-sm">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Contact Support Section */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-[#F8F8FC]">{t('contactSupport')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onContactSupport?.('email')}
              className="p-5 rounded-xl bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] hover:border-[#06B6D4]/50 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center group-hover:bg-[#06B6D4]/20 transition-colors">
                  <Mail className="w-6 h-6 text-[#06B6D4]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#F8F8FC] mb-1">{t('emailSupport')}</h3>
                  <p className="text-sm text-[#9090A0] mb-2">{t('emailResponseTime')}</p>
                  <div className="flex items-center gap-1 text-[#06B6D4] text-sm">
                    <span>support@hoot.ai</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onContactSupport?.('chat')}
              className="p-5 rounded-xl bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] hover:border-[#06B6D4]/50 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center group-hover:bg-[#06B6D4]/20 transition-colors">
                  <MessageCircle className="w-6 h-6 text-[#06B6D4]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#F8F8FC] mb-1">{t('liveChat')}</h3>
                  <p className="text-sm text-[#9090A0] mb-2">{t('instantResponse')}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm text-green-400">{t('online')}</span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* User Guide Link */}
        <section>
          <button
            type="button"
            onClick={() => onNavigate?.('/help')}
            className="w-full p-5 rounded-xl bg-gradient-to-r from-[#06B6D4]/10 to-[#8B5CF6]/10 border border-[#06B6D4]/20 hover:border-[#06B6D4]/40 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-[#06B6D4]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#F8F8FC] mb-1">{t('fullGuide')}</h3>
                  <p className="text-sm text-[#9090A0]">{t('learnAllFeatures')}</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-[#606070] group-hover:text-[#06B6D4] transition-colors" />
            </div>
          </button>
        </section>

        {/* App Version */}
        <div className="text-center py-6 border-t border-[#1E1E2E]">
          <p className="text-sm text-[#606070]">Hoot {appVersion}</p>
          <p className="text-xs text-[#404050] mt-1">© 2026 Hoot. All rights reserved.</p>
        </div>

        {/* Bottom Spacer */}
        <div className="h-20 md:h-0" />
      </div>
    </div>
  )
}
