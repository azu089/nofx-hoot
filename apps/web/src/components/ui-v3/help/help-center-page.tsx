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
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  ArrowLeft,
  ExternalLink,
  FileText
} from 'lucide-react'

interface QuickLink {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

interface FAQItem {
  id: string
  question: string
  answer: string
}

interface HelpCenterPageProps {
  appVersion?: string
  onNavigate?: (path: string) => void
  onContactSupport?: (method: 'email' | 'chat') => void
}

const quickLinks: QuickLink[] = [
  {
    id: 'getting-started',
    title: '新手入门',
    description: '了解 Hoot 平台的基础操作',
    icon: BookOpen
  },
  {
    id: 'api-keys',
    title: 'API 密钥',
    description: '管理您的交易所 API 连接',
    icon: Key
  },
  {
    id: 'strategies',
    title: '策略使用',
    description: '探索和配置交易策略',
    icon: TrendingUp
  },
  {
    id: 'deposits-withdrawals',
    title: '充值提现',
    description: '资金充值和提现操作指南',
    icon: CreditCard
  },
  {
    id: 'security',
    title: '安全设置',
    description: '保护您的账户安全',
    icon: Shield
  },
  {
    id: 'billing',
    title: '订阅计费',
    description: '管理会员订阅和账单',
    icon: Receipt
  }
]

const faqItems: FAQItem[] = [
  {
    id: '1',
    question: '如何开始使用 Hoot？',
    answer: '要开始使用 Hoot，只需创建账户、完成身份验证，然后连接您的交易所 API。我们的新手入门指南会引导您完成每个步骤。您可以在"钱包"页面添加交易所 API Key 来连接您的交易账户。'
  },
  {
    id: '2',
    question: 'Hoot 支持哪些交易所？',
    answer: 'Hoot 支持主流加密货币交易所，包括币安 (Binance)、OKX、Bybit、Gate.io、Coinbase 等。我们持续扩展支持的交易所列表。您可以在"钱包 > 交易所"页面查看完整的支持列表。'
  },
  {
    id: '3',
    question: '如何设置交易所 API Key？',
    answer: '前往您的交易所账户设置，创建一个新的 API Key。确保只启用"交易"和"读取"权限，不要启用"提现"权限以保证资金安全。然后在 Hoot 的"钱包 > 交易所"页面添加您的 API Key。'
  },
  {
    id: '4',
    question: 'Hoot 的交易费用是多少？',
    answer: 'Hoot 采用按盈利分成的计费模式。基础版 Gas Fee 为盈利的 22%，高级版为 18%，专业版为 15%。只有在策略盈利时才会收取费用，亏损时不收取任何费用。'
  },
  {
    id: '5',
    question: '如何确保我的资金安全？',
    answer: '您的资金始终保存在您自己的交易所账户中，Hoot 不托管任何用户资金。我们只通过 API 执行交易指令。建议您启用双重身份验证 (2FA)，并且 API Key 不要开启提现权限。'
  },
  {
    id: '6',
    question: '策略信号是如何执行的？',
    answer: '当策略产生交易信号时，系统会通过您绑定的交易所 API 自动执行交易。您可以在策略配置中设置每笔交易的金额上限和风控参数，确保交易符合您的风险偏好。'
  },
  {
    id: '7',
    question: '如何订阅会员服务？',
    answer: '前往"我的 > 会员订阅"页面，选择适合您的会员等级。您可以使用 USDT 或 HOOT 代币支付订阅费用。使用 HOOT 代币支付可享受额外折扣。'
  },
  {
    id: '8',
    question: '遇到问题如何获取帮助？',
    answer: '您可以通过页面下方的"联系客服"发送邮件或在线客服获取帮助。我们的客服团队会在 24 小时内回复您的问题。紧急问题建议使用在线客服获得即时帮助。'
  }
]

export function HelpCenterPage({
  appVersion = 'v1.19.0',
  onNavigate,
  onContactSupport
}: HelpCenterPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id)
  }

  const filteredFAQs = faqItems.filter(
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
              onClick={() => onNavigate?.('/me')}
              className="p-2 hover:bg-[#12121A] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
            </button>
            <h1 className="text-2xl font-bold">帮助中心</h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
            <input
              type="text"
              placeholder="搜索帮助文章、常见问题..."
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
          <h2 className="text-lg font-semibold mb-4 text-[#F8F8FC]">快速入口</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quickLinks.map((link) => {
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
                  <h3 className="font-medium text-[#F8F8FC] mb-1">{link.title}</h3>
                  <p className="text-xs text-[#9090A0]">{link.description}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* FAQ Section */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-[#F8F8FC]">常见问题</h2>
          <div className="space-y-3">
            {filteredFAQs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-[#606070]" />
                <p className="text-[#9090A0]">未找到相关问题</p>
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
          <h2 className="text-lg font-semibold mb-4 text-[#F8F8FC]">联系客服</h2>
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
                  <h3 className="font-medium text-[#F8F8FC] mb-1">邮件支持</h3>
                  <p className="text-sm text-[#9090A0] mb-2">24 小时内回复</p>
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
                  <h3 className="font-medium text-[#F8F8FC] mb-1">在线客服</h3>
                  <p className="text-sm text-[#9090A0] mb-2">即时响应</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm text-green-400">在线</span>
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
            onClick={() => onNavigate?.('/help/user-guide')}
            className="w-full p-5 rounded-xl bg-gradient-to-r from-[#06B6D4]/10 to-[#8B5CF6]/10 border border-[#06B6D4]/20 hover:border-[#06B6D4]/40 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-[#06B6D4]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#F8F8FC] mb-1">完整使用指南</h3>
                  <p className="text-sm text-[#9090A0]">详细了解 Hoot 的所有功能</p>
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
