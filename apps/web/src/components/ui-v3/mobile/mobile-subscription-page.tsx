'use client'

import { useState } from 'react'
import {
  Shield,
  Crown,
  TrendingUp,
  Check,
  ArrowLeft,
  Loader2,
  Wallet,
  X,
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

interface MobileSubscriptionPageProps {
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
  onBack?: () => void
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

// Free 功能列表
const freeFeatures = [
  { text: '25% 利润分成' },
  { text: '最多 2 个策略' },
  { text: '自带 LLM Key (BYOK)' },
  { text: 'Solo 交易模式' },
  { text: '基础研究报告' },
  { text: '标准支持' },
]

// Pro 功能列表
const proFeatures = [
  { text: '20% 利润分成' },
  { text: '最多 10 个策略' },
  { text: '平台 LLM 免费使用' },
  { text: 'Solo + Debate 模式' },
  { text: '深度研究报告' },
  { text: '优先客服支持' },
]

const faqs = [
  { question: 'Free 和 Pro 有什么区别？', answer: 'Free 用户可免费使用基础功能，利润分成为 25%，最多 2 个策略。Pro 享受 20% 利润分成，最多 10 个策略，平台 AI 模型免费。' },
  { question: '利润分成如何计算？', answer: 'Gas Fee 仅在盈利时收取。例如 Pro 用户盈利 $100，平台收取 20%（$20），您获得 $80。亏损不收费。' },
  { question: '可以随时取消 Pro 吗？', answer: '可以。取消后在当前计费周期结束时降级为 Free，期间仍享受 Pro 权益。' },
  { question: '支持哪些支付方式？', answer: '目前支持 USDT 和平台积分 (POINT) 支付。' },
]

export function MobileSubscriptionPage({
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
  onBack,
}: MobileSubscriptionPageProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const isPro = tier === 'pro'
  const selectedPlan = plans.find(p => p.code === billingCycle)

  const handleUpgrade = () => {
    setShowConfirmSheet(true)
  }

  const handleConfirmSubscribe = () => {
    if (selectedPlan && onSubscribe) {
      onSubscribe(selectedPlan.code)
    }
  }

  const handleCloseSheet = () => {
    if (!isProcessing) {
      setShowConfirmSheet(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F] [transform:translateZ(0)] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">订阅计划</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Pro 推荐卡片 (放在顶部) */}
        <div className={cn(
          "relative rounded-2xl overflow-hidden border shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          isPro
            ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30'
            : 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30'
        )}>
          {/* 推荐标签 */}
          <div className="absolute top-0 right-0 px-2.5 py-1 bg-cyan-500 text-white text-[10px] font-bold rounded-bl-lg">
            推荐
          </div>

          <div className="p-4">
            {/* 头部 */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#0891B2] flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Pro 专业版</h3>
                <p className="text-xs text-cyan-400">解锁全部功能</p>
              </div>
            </div>

            {/* 计费周期切换 */}
            <div className="flex gap-1 p-1 bg-[#0A0A0F] rounded-xl mb-3">
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
                      "flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                      billingCycle === cycle
                        ? 'bg-[#06B6D4] text-white'
                        : 'text-[#9090A0]'
                    )}
                  >
                    {labels[cycle]}
                  </button>
                )
              })}
            </div>

            {/* 价格 */}
            {selectedPlan && (
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold">${selectedPlan.price}</span>
                {selectedPlan.originalPrice && selectedPlan.originalPrice !== selectedPlan.price && (
                  <span className="text-sm text-[#94A3B8] line-through">${selectedPlan.originalPrice}</span>
                )}
                <span className="text-xs text-[#94A3B8]">≈ ${selectedPlan.monthlyPrice}/月</span>
                {selectedPlan.discountPercent != null && selectedPlan.discountPercent > 0 && (
                  <span className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-medium rounded-full">
                    省 {selectedPlan.discountPercent}%
                  </span>
                )}
              </div>
            )}

            {/* Pro 功能列表 */}
            <div className="space-y-2 mb-4">
              {proFeatures.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <span className="text-xs text-white">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* 操作按钮 */}
            {isPro ? (
              <div className="space-y-2">
                <div className="w-full py-2.5 rounded-xl text-sm font-medium text-center bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  当前计划 — Pro
                </div>
                {currentPeriodEnd && (
                  <p className="text-center text-xs text-[#94A3B8]">
                    有效期至 {currentPeriodEnd} · 剩余 {daysRemaining} 天
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleUpgrade}
                  className="w-full py-2 rounded-xl text-xs font-medium bg-[#1A1A24] text-[#94A3B8] hover:bg-[#1E1E2E]"
                >
                  续费 {selectedPlan?.name}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-cyan-500 hover:bg-cyan-600 text-white transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                升级到 Pro — ${selectedPlan?.price}
              </button>
            )}
          </div>
        </div>

        {/* Free 卡片 */}
        <div className={cn(
          "rounded-2xl overflow-hidden border shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          !isPro
            ? 'bg-[#12121A]/30 border-[#06B6D4]/20'
            : 'bg-[#12121A]/30 border-[#1E1E2E]'
        )}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1A1A24] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Free 免费版</h3>
                  <span className="text-xs text-[#94A3B8]">永久免费</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">$0</span>
              </div>
            </div>

            {/* Free 功能列表 */}
            <div className="space-y-2 mb-4">
              {freeFeatures.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0" />
                  <span className="text-xs text-[#94A3B8]">{feature.text}</span>
                </div>
              ))}
            </div>

            <div className={cn(
              "w-full py-2.5 rounded-xl text-sm font-medium text-center",
              !isPro
                ? 'bg-[#1E1E2E] text-[#94A3B8]'
                : 'bg-[#1A1A24] text-[#64748B]'
            )}>
              {!isPro ? '当前计划' : '免费版'}
            </div>
          </div>
        </div>

        {/* 常见问题 */}
        <div className="pt-2">
          <h2 className="text-base font-semibold text-white mb-3">常见问题</h2>
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl overflow-hidden">
            {faqs.map((faq, index) => (
              <div key={index} className={index < faqs.length - 1 ? 'border-b border-[#1E1E2E]' : ''}>
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-medium text-white pr-4">{faq.question}</span>
                  {expandedFaq === index
                    ? <ChevronUp className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-[#64748B] flex-shrink-0" />
                  }
                </button>
                {expandedFaq === index && (
                  <div className="px-4 pb-4 -mt-1">
                    <p className="text-xs text-[#94A3B8] leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 确认订阅弹窗 (Bottom Sheet) */}
      {showConfirmSheet && selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseSheet}
          />

          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl animate-slide-up">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-[#1E1E2E] rounded-full" />
            </div>

            <div className="p-6 pb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">
                  {isPro ? '续费 Pro' : '升级到 Pro'}
                </h2>
                <button
                  onClick={handleCloseSheet}
                  disabled={isProcessing}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1A1A24] transition-colors disabled:opacity-50"
                  aria-label="关闭"
                >
                  <X className="w-5 h-5 text-[#94A3B8]" />
                </button>
              </div>

              {/* 套餐信息 */}
              <div className="bg-[#1A1A24] rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-base font-semibold text-white mb-1">{selectedPlan.name}</div>
                    <div className="text-sm text-[#94A3B8]">{selectedPlan.durationDays} 天有效期</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">${selectedPlan.price}</div>
                    {selectedPlan.originalPrice && selectedPlan.originalPrice !== selectedPlan.price && (
                      <div className="text-xs text-[#94A3B8] line-through">${selectedPlan.originalPrice}</div>
                    )}
                  </div>
                </div>
                {selectedPlan.discountPercent != null && selectedPlan.discountPercent > 0 && (
                  <div className="text-xs text-green-400 font-medium">
                    立省 {selectedPlan.discountPercent}% · 折合 ${selectedPlan.monthlyPrice}/月
                  </div>
                )}
              </div>

              {/* USDT 余额 */}
              <div className="flex items-center justify-between bg-[#1A1A24] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-[#94A3B8]">USDT 余额</span>
                </div>
                <span className="text-base font-semibold text-white">${usdtBalance}</span>
              </div>

              {/* 余额不足提示 */}
              {parseFloat(usdtBalance) < parseFloat(selectedPlan.price) && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                  <div className="text-xs text-red-400">
                    余额不足，请先充值至少 ${(parseFloat(selectedPlan.price) - parseFloat(usdtBalance)).toFixed(2)} USDT
                  </div>
                </div>
              )}

              {/* 成功提示 */}
              {isSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">{isPro ? '续费成功!' : '升级成功!'}</span>
                  </div>
                </div>
              )}

              {/* 确认按钮 */}
              <button
                type="button"
                onClick={handleConfirmSubscribe}
                disabled={isProcessing || isSuccess || parseFloat(usdtBalance) < parseFloat(selectedPlan.price)}
                className="w-full py-3.5 rounded-xl text-base font-medium transition-all bg-cyan-500 hover:bg-cyan-600 text-white disabled:bg-[#1E1E2E] disabled:text-[#94A3B8] disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>处理中...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>成功</span>
                  </>
                ) : parseFloat(usdtBalance) < parseFloat(selectedPlan.price) ? (
                  '余额不足'
                ) : (
                  `支付 $${selectedPlan.price} USDT`
                )}
              </button>

              <div className="text-xs text-center text-[#64748B] mt-4">
                订阅后立即生效，不支持退款
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
