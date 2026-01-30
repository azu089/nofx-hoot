'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Search,
  BookOpen,
  Key,
  TrendingUp,
  Shield,
  Mail,
  MessageCircle,
  ChevronDown
} from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

const quickAccessItems = [
  { icon: BookOpen, title: '新手入门' },
  { icon: Key, title: 'API密钥' },
  { icon: TrendingUp, title: '策略使用' },
  { icon: Shield, title: '安全设置' },
]

const faqItems: FAQItem[] = [
  {
    question: '如何创建交易策略？',
    answer: '进入策略管理，点击"创建策略"，选择交易对和参数后启动即可。'
  },
  {
    question: 'API密钥如何保证安全？',
    answer: '建议启用IP白名单限制，定期更换密钥，并为不同用途创建不同权限的密钥。'
  },
  {
    question: '支持哪些交易所？',
    answer: '目前支持币安、OKX、火币等主流交易所。'
  },
  {
    question: '如何提现资产？',
    answer: '进入资产管理，选择提现，输入金额和钱包地址即可。'
  },
]

interface MobileHelpPageProps {
  onBack?: () => void
}

export function MobileHelpPage({ onBack }: MobileHelpPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  const filteredFAQs = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-8">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-medium text-white">帮助中心</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* 搜索栏 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            type="search"
            placeholder="搜索帮助..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-[#12121A] border border-[#1E1E2E] rounded-xl text-sm text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* 快速入口 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="grid grid-cols-4 divide-x divide-[#1E1E2E]/50">
            {quickAccessItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.title}
                  type="button"
                  className="flex flex-col items-center py-4 hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-2">
                    <Icon className="w-5 h-5 text-cyan-500" />
                  </div>
                  <span className="text-xs text-[#94A3B8]">{item.title}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 常见问题 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E1E2E]/50">
            <span className="text-sm font-medium text-white">常见问题</span>
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
            <p className="text-center text-[#94A3B8] text-sm py-8">未找到相关问题</p>
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
                <div className="text-sm font-medium text-white">邮件</div>
                <div className="text-[11px] text-[#94A3B8]">24h内回复</div>
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
                <div className="text-sm font-medium text-white">在线客服</div>
                <div className="text-[11px] text-[#22C55E]">在线</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
