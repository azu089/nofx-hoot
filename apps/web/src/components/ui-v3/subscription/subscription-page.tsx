'use client'

import { useState } from 'react'
import {
  Check,
  Crown,
  Shield,
  TrendingUp,
  X,
  Wallet,
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
  MessageSquare,
  Search,
  Headphones,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MembershipPlan {
  id: string
  code: string
  name: string
  price: string
  durationDays: number
  originalPrice?: string
  discountPercent?: number | null
  monthlyPrice: string
  maxStrategies: number
  gasFeeRate?: string
}

interface SubscriptionPageProps {
  plans?: MembershipPlan[]
  currentPlanCode?: string
  currentPeriodEnd?: string
  isMember?: boolean
  daysRemaining?: number
  usdtBalance?: string
  tier?: 'free' | 'pro'
  gasFeeRate?: string
  maxStrategies?: number
  onSubscribe?: (planCode: string) => void
  isProcessing?: boolean
  isSuccess?: boolean
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

// Free 层级功能
const freeFeatures = [
  { icon: TrendingUp, text: '25% 利润分成' },
  { icon: Zap, text: '最多 2 个策略' },
  { icon: Shield, text: '自带 LLM Key (BYOK)' },
  { icon: TrendingUp, text: 'Solo 交易模式' },
  { icon: Search, text: '基础研究报告' },
  { icon: Headphones, text: '标准支持' },
]

// Pro 层级功能
const proFeatures = [
  { icon: TrendingUp, text: '20% 利润分成', highlight: true },
  { icon: Zap, text: '最多 10 个策略', highlight: true },
  { icon: Crown, text: '平台 LLM 免费使用', highlight: true },
  { icon: MessageSquare, text: 'Solo + Debate 模式', highlight: true },
  { icon: Search, text: '深度研究报告', highlight: true },
  { icon: Headphones, text: '优先客服支持', highlight: true },
]

const faqs = [
  {
    question: 'Free 和 Pro 有什么区别？',
    answer: 'Free 用户可免费使用基础功能，利润分成为 25%，最多订阅 2 个策略。Pro 用户享受更低的 20% 利润分成，最多 10 个策略，并免费使用平台 AI 模型和 Debate 高级交易模式。',
  },
  {
    question: '利润分成 (Gas Fee) 是如何计算的？',
    answer: 'Gas Fee 仅在盈利时收取。例如 Pro 用户盈利 $100，平台收取 20%（$20），您获得 $80。亏损时不收费。',
  },
  {
    question: '可以随时取消 Pro 吗？',
    answer: '可以。取消后在当前计费周期结束时自动降级为 Free，期间仍享受 Pro 权益。',
  },
  {
    question: '季度和年度付费有什么优惠？',
    answer: '季度付费省 17%（折合 $16.66/月），年度付费省 37%（折合 $12.50/月），相比月付更划算。',
  },
  {
    question: '支持哪些支付方式？',
    answer: '目前支持 USDT 和平台积分 (POINT) 支付。',
  },
]

export function SubscriptionPage({
  plans = [],
  currentPlanCode,
  currentPeriodEnd,
  isMember = false,
  daysRemaining = 0,
  usdtBalance = '0',
  tier = 'free',
  gasFeeRate = '0.25',
  maxStrategies = 2,
  onSubscribe,
  isProcessing = false,
  isSuccess = false,
}: SubscriptionPageProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const isPro = tier === 'pro'

  // 获取当前选择的 Pro 套餐
  const getSelectedPlan = () => plans.find(p => p.code === billingCycle)

  const handleUpgrade = () => {
    setShowConfirmModal(true)
  }

  const handleConfirmPayment = () => {
    const plan = getSelectedPlan()
    if (plan && onSubscribe) {
      onSubscribe(plan.code)
    }
  }

  const selectedPlan = getSelectedPlan()

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#06B6D4]/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#06B6D4]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-[#8B5CF6]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 pt-12 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-full text-[#06B6D4] text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            选择适合您的交易计划
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[#F8F8FC] via-[#06B6D4] to-[#8B5CF6] bg-clip-text text-transparent">
            Hoot 订阅计划
          </h1>
          <p className="text-lg text-[#9090A0] max-w-2xl mx-auto">
            Free 用户即可开始交易，升级 Pro 解锁更低费率和高级功能
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12">
        {/* Two-column: Free vs Pro */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Free Card */}
          <div className={cn(
            "relative backdrop-blur-xl border rounded-2xl p-8 transition-all",
            isPro
              ? 'bg-[#12121A]/80 border-[#1E1E2E]'
              : 'bg-[#12121A]/80 border-[#06B6D4]/30 ring-2 ring-[#06B6D4]/20'
          )}>
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#1E1E2E] flex items-center justify-center">
                  <Shield className="w-6 h-6 text-[#9090A0]" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Free</h3>
                  <p className="text-sm text-[#606070]">免费版</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-[#9090A0] text-sm">/ 永久免费</span>
              </div>
            </div>

            {/* Free Features */}
            <ul className="space-y-4 mb-8">
              {freeFeatures.map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#606070] flex-shrink-0" />
                    <span className="text-[#9090A0] text-sm">{feature.text}</span>
                  </li>
                )
              })}
            </ul>

            {/* Status button */}
            <div className={cn(
              "w-full py-4 rounded-xl font-semibold text-center",
              !isPro
                ? 'bg-[#1E1E2E] text-[#9090A0]'
                : 'bg-[#1E1E2E] text-[#606070]'
            )}>
              {!isPro ? '当前计划' : '免费版'}
            </div>
          </div>

          {/* Pro Card */}
          <div className={cn(
            "relative backdrop-blur-xl border rounded-2xl p-8 transition-all",
            isPro
              ? 'bg-gradient-to-b from-[#06B6D4]/10 to-[#12121A]/80 border-[#06B6D4]/50 shadow-[0_0_60px_rgba(6,182,212,0.15)] ring-2 ring-[#06B6D4]/20'
              : 'bg-gradient-to-b from-[#06B6D4]/10 to-[#12121A]/80 border-[#06B6D4]/50 shadow-[0_0_60px_rgba(6,182,212,0.15)]'
          )}>
            {/* Recommended Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="px-4 py-1.5 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white text-sm font-medium rounded-full shadow-lg">
                ✨ 推荐
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#0891B2] flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Pro</h3>
                  <p className="text-sm text-[#06B6D4]">专业版</p>
                </div>
              </div>

              {/* Billing Cycle Switcher */}
              <div className="flex gap-1 p-1 bg-[#0A0A0F] rounded-xl mb-4">
                {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map((cycle) => {
                  const labels: Record<BillingCycle, string> = {
                    monthly: '月付',
                    quarterly: '季付',
                    yearly: '年付',
                  }
                  return (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => setBillingCycle(cycle)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                        billingCycle === cycle
                          ? 'bg-[#06B6D4] text-white'
                          : 'text-[#9090A0] hover:text-white'
                      )}
                    >
                      {labels[cycle]}
                    </button>
                  )
                })}
              </div>

              {/* Price Display */}
              {selectedPlan && (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">${selectedPlan.price}</span>
                    {selectedPlan.originalPrice && selectedPlan.originalPrice !== selectedPlan.price && (
                      <span className="text-[#606070] line-through text-lg">
                        ${selectedPlan.originalPrice}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-[#9090A0]">
                      折合 ${selectedPlan.monthlyPrice}/月
                    </span>
                    {selectedPlan.discountPercent != null && selectedPlan.discountPercent > 0 && (
                      <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium rounded-full">
                        省 {selectedPlan.discountPercent}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pro Features */}
            <ul className="space-y-4 mb-8">
              {proFeatures.map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-[#06B6D4] flex-shrink-0" />
                    <span className="text-[#F8F8FC] text-sm font-medium">{feature.text}</span>
                  </li>
                )
              })}
            </ul>

            {/* Action Button */}
            {isPro ? (
              <div className="space-y-2">
                <div className="w-full py-4 rounded-xl font-semibold text-center bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30">
                  当前计划 — Pro
                </div>
                {currentPeriodEnd && (
                  <p className="text-center text-sm text-[#9090A0]">
                    有效期至 {currentPeriodEnd} · 剩余 {daysRemaining} 天
                  </p>
                )}
                {/* 续费按钮 */}
                <button
                  type="button"
                  onClick={handleUpgrade}
                  className="w-full py-3 rounded-xl font-medium bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-all text-sm"
                >
                  续费 {selectedPlan?.name}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                升级到 Pro — ${selectedPlan?.price}
              </button>
            )}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          <h2 className="relative z-[2] text-2xl font-bold mb-6">常见问题</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border-b border-[#1E1E2E] last:border-0 pb-4 last:pb-0"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between py-2 text-left group"
                >
                  <h4 className="font-medium group-hover:text-[#06B6D4] transition-colors">
                    {faq.question}
                  </h4>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-[#06B6D4]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#606070]" />
                  )}
                </button>
                {expandedFaq === index && (
                  <p className="text-[#9090A0] text-sm mt-2 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Spacer for mobile nav */}
        <div className="h-20 md:h-0" />
      </div>

      {/* Payment Confirmation Modal */}
      {showConfirmModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isProcessing && !isSuccess && setShowConfirmModal(false)}
          />

          <div className="relative w-full max-w-md backdrop-blur-xl bg-[#12121A] border border-[#1E1E2E] rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.15)] animate-in fade-in zoom-in-95 duration-200">
            {!isProcessing && !isSuccess && (
              <button
                type="button"
                title="关闭"
                aria-label="关闭弹窗"
                onClick={() => setShowConfirmModal(false)}
                className="absolute top-4 right-4 p-2 text-[#606070] hover:text-[#F8F8FC] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="p-8">
              {isSuccess ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#10B981]/20 flex items-center justify-center animate-in zoom-in duration-300">
                    <Check className="w-10 h-10 text-[#10B981]" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{isPro ? '续费成功!' : '升级成功!'}</h3>
                  <p className="text-[#9090A0]">
                    您已成功{isPro ? '续费' : '升级到'} {selectedPlan.name}
                  </p>
                </div>
              ) : isProcessing ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#06B6D4]/20 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-[#06B6D4] animate-spin" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">处理中...</h3>
                  <p className="text-[#9090A0]">正在处理您的请求，请稍候</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-[#06B6D4] to-[#0891B2] flex items-center justify-center">
                      <Crown className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-1">{isPro ? '续费 Pro' : '升级到 Pro'}</h3>
                    <p className="text-[#9090A0] text-sm">请确认以下信息</p>
                  </div>

                  <div className="bg-[#0A0A0F] rounded-xl p-5 mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0]">订阅方案</span>
                      <span className="font-semibold">{selectedPlan.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0]">时长</span>
                      <span className="font-semibold">{selectedPlan.durationDays} 天</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0]">折合月费</span>
                      <span className="font-semibold">${selectedPlan.monthlyPrice}/月</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#9090A0]">当前余额</span>
                      <span className="font-semibold text-[#06B6D4]">${usdtBalance} USDT</span>
                    </div>
                    <div className="border-t border-[#1E1E2E] pt-4 flex items-center justify-between">
                      <span className="text-[#9090A0]">支付金额</span>
                      <span className="text-2xl font-bold text-[#10B981]">
                        ${selectedPlan.price}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const balance = parseFloat(usdtBalance)
                    const price = parseFloat(selectedPlan.price)
                    const insufficient = balance < price
                    return insufficient ? (
                      <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-6">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">
                          余额不足，请先充值至少 ${(price - balance).toFixed(2)} USDT
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 p-4 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl mb-6">
                        <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-[#F59E0B]">
                          费用将从 USDT 余额扣除。订阅后立即生效，不支持退款。
                        </p>
                      </div>
                    )
                  })()}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-3 rounded-xl font-medium bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-all"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPayment}
                      disabled={parseFloat(usdtBalance) < parseFloat(selectedPlan.price)}
                      className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#10B981] to-[#059669] text-white hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                    >
                      <Check className="w-4 h-4" />
                      {parseFloat(usdtBalance) < parseFloat(selectedPlan.price) ? '余额不足' : '确认支付'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
