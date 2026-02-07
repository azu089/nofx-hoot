'use client'

import { useState } from 'react'
import {
  Check,
  Crown,
  Shield,
  TrendingUp,
  Users,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  Wallet,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MembershipPlan {
  id: string
  code: string  // 'monthly' | 'quarterly' | 'yearly'
  name: string  // '月度会员' | '季度会员' | '年度会员'
  price: string  // '15' | '36' | '99'
  durationDays: number  // 30 | 90 | 365
  originalPrice?: string  // 原价
  discountPercent?: number | null  // 折扣百分比
  monthlyPrice: string  // 折合月费
  maxStrategies: number
}

interface SubscriptionPageProps {
  plans?: MembershipPlan[]
  currentPlanCode?: string  // 当前套餐code
  currentPeriodEnd?: string  // 到期日期
  isMember?: boolean
  daysRemaining?: number
  usdtBalance?: string
  onSubscribe?: (planCode: string) => void  // 改为传planCode
  isProcessing?: boolean  // 外部控制加载状态
  isSuccess?: boolean  // 外部控制成功状态
}

export function SubscriptionPage({
  plans = [],
  currentPlanCode,
  currentPeriodEnd,
  isMember = false,
  daysRemaining = 0,
  usdtBalance = '0',
  onSubscribe,
  isProcessing = false,
  isSuccess = false
}: SubscriptionPageProps) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // 会员权益列表（所有套餐功能相同）
  const memberFeatures = [
    '10 个策略',
    '无限交易对',
    '20 个持仓',
    'Gas费率 15%',
    'TradingView 信号接入',
    'AI 无限解读',
    '优先客户支持'
  ]

  const benefits = [
    {
      icon: TrendingUp,
      title: '降低 Gas 费用',
      description: '享受更低的交易手续费，最高可节省 7% 的交易成本',
      color: 'from-[#06B6D4] to-[#0891B2]',
      bg: 'bg-[#06B6D4]/10'
    },
    {
      icon: Star,
      title: '优先信号推送',
      description: '获得实时市场信号和交易机会，抢占先机',
      color: 'from-[#8B5CF6] to-[#7C3AED]',
      bg: 'bg-[#8B5CF6]/10'
    },
    {
      icon: Users,
      title: 'VIP 专属支持',
      description: '24/7 专属客服支持，快速解决您的问题',
      color: 'from-[#10B981] to-[#059669]',
      bg: 'bg-[#10B981]/10'
    },
    {
      icon: Clock,
      title: '提前功能体验',
      description: '抢先体验最新功能和工具，保持竞争优势',
      color: 'from-[#F59E0B] to-[#D97706]',
      bg: 'bg-[#F59E0B]/10'
    }
  ]

  const faqs = [
    {
      question: '如何升级我的订阅计划？',
      answer: '您可以随时在此页面升级您的订阅计划。升级后，新的费率和功能将立即生效。差价将按剩余天数折算。'
    },
    {
      question: '季度订阅真的能节省吗？',
      answer: '是的，选择季度或年度付费可以享受折扣。例如，季度会员折合月费更低，年度会员优惠力度最大。'
    },
    {
      question: '可以随时取消订阅吗？',
      answer: '当然可以。您可以随时取消订阅，取消后将在当前计费周期结束时生效，期间您仍可继续享受会员权益。'
    },
    {
      question: 'Gas 费用是如何计算的？',
      answer: 'Gas 费用是从您的交易盈利中收取的服务费。例如，如果您盈利 $100，15% Gas Fee 意味着平台收取 $15，您获得 $85。'
    },
    {
      question: '支持哪些支付方式？',
      answer: '目前支持 USDT 支付。您可以使用钱包余额直接支付订阅费用，安全便捷。'
    }
  ]

  const getCurrentPlan = () => plans.find(p => p.code === currentPlanCode)

  const handlePlanSelect = (planCode: string) => {
    if (planCode === currentPlanCode) return
    setSelectedPlanCode(planCode)
  }

  const handleSubscribe = () => {
    if (!selectedPlanCode || selectedPlanCode === currentPlanCode) return
    setShowConfirmModal(true)
  }

  const handleConfirmPayment = () => {
    if (selectedPlanCode && onSubscribe) {
      onSubscribe(selectedPlanCode)
    }
  }

  const getSelectedPlanDetails = () => plans.find(p => p.code === selectedPlanCode)

  // 根据套餐类型返回图标和样式
  const getPlanStyle = (code: string) => {
    switch (code) {
      case 'monthly':
        return {
          icon: Shield,
          iconBg: 'bg-[#9090A0]/20',
          iconColor: 'text-[#9090A0]',
          popular: false
        }
      case 'quarterly':
        return {
          icon: TrendingUp,
          iconBg: 'bg-[#06B6D4]/20',
          iconColor: 'text-[#06B6D4]',
          popular: true
        }
      case 'yearly':
        return {
          icon: Crown,
          iconBg: 'bg-[#8B5CF6]/20',
          iconColor: 'text-[#8B5CF6]',
          popular: false
        }
      default:
        return {
          icon: Shield,
          iconBg: 'bg-[#9090A0]/20',
          iconColor: 'text-[#9090A0]',
          popular: false
        }
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#06B6D4]/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#06B6D4]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-[#8B5CF6]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-full text-[#06B6D4] text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            解锁更多交易潜能
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[#F8F8FC] via-[#06B6D4] to-[#8B5CF6] bg-clip-text text-transparent">
            Hoot 会员订阅
          </h1>
          <p className="text-lg text-[#9090A0] max-w-2xl mx-auto">
            选择适合您的交易计划，享受更低的 Gas 费用和专业的交易工具
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12">
        {/* Current Subscription Status */}
        <div className="mb-10">
          <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
            <div className="relative z-[2] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {isMember && currentPlanCode ? (
                  (() => {
                    const plan = getCurrentPlan()
                    const style = getPlanStyle(currentPlanCode)
                    const IconComponent = style.icon
                    return (
                      <>
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center",
                          style.iconBg
                        )}>
                          <IconComponent className={cn("w-7 h-7", style.iconColor)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold">{plan?.name}</h3>
                            <span className="px-3 py-1 bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] text-xs font-medium rounded-full">
                              当前方案
                            </span>
                          </div>
                          <p className="text-[#9090A0] text-sm mt-1">
                            有效期至 {currentPeriodEnd} • 剩余 {daysRemaining} 天
                          </p>
                        </div>
                      </>
                    )
                  })()
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[#1E1E2E]">
                      <Shield className="w-7 h-7 text-[#606070]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold">未订阅</h3>
                      </div>
                      <p className="text-[#9090A0] text-sm mt-1">
                        选择套餐开始您的量化交易之旅
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#06B6D4]">
                    {isMember ? '15%' : '22%'}
                  </div>
                  <p className="text-sm text-[#9090A0]">Gas 费率</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        {plans.length > 0 && (
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {plans.map((plan) => {
              const style = getPlanStyle(plan.code)
              const Icon = style.icon
              const isCurrentPlan = plan.code === currentPlanCode
              const isSelected = selectedPlanCode === plan.code

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handlePlanSelect(plan.code)}
                  disabled={isCurrentPlan}
                  className={cn(
                    "relative backdrop-blur-xl border rounded-2xl p-8 transition-all duration-300 text-left",
                    style.popular
                      ? 'bg-gradient-to-b from-[#06B6D4]/10 to-[#12121A]/80 border-[#06B6D4]/50 shadow-[0_0_60px_rgba(6,182,212,0.15)] scale-[1.02]'
                      : 'bg-[#12121A]/80 border-[#1E1E2E] hover:border-[#2A2A3A]',
                    isCurrentPlan && 'ring-2 ring-[#06B6D4]/30 cursor-default',
                    isSelected && !isCurrentPlan && 'ring-2 ring-[#10B981] border-[#10B981]',
                    !isCurrentPlan && 'cursor-pointer hover:scale-[1.01]'
                  )}
                >
                  {/* Popular Badge */}
                  {style.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <div className="px-4 py-1.5 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white text-sm font-medium rounded-full shadow-lg">
                        ✨ 推荐选择
                      </div>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="text-center mb-8">
                    <div className={cn(
                      "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center",
                      style.popular
                        ? 'bg-gradient-to-r from-[#06B6D4] to-[#0891B2]'
                        : style.iconBg
                    )}>
                      <Icon className={cn(
                        "w-8 h-8",
                        style.popular ? 'text-white' : style.iconColor
                      )} />
                    </div>

                    <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                    <p className="text-sm text-[#606070] mb-4">{plan.durationDays} 天</p>

                    {/* Price */}
                    <div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-4xl font-bold">${plan.price}</span>
                        {plan.originalPrice && plan.originalPrice !== plan.price && (
                          <span className="text-[#606070] line-through text-lg">
                            ${plan.originalPrice}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#9090A0] mt-2">
                        折合月费 ${plan.monthlyPrice}
                      </div>
                      {plan.discountPercent != null && plan.discountPercent > 0 && (
                        <div className="inline-block mt-2 px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium rounded-full">
                          省 {plan.discountPercent}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {memberFeatures.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className={cn(
                          "w-5 h-5 flex-shrink-0 mt-0.5",
                          style.popular ? 'text-[#06B6D4]' : 'text-[#606070]'
                        )} />
                        <span className="text-[#F8F8FC] text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Status Display */}
                  <div
                    className={cn(
                      "w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2",
                      isCurrentPlan
                        ? 'bg-[#1E1E2E] text-[#606070]'
                        : isSelected
                          ? 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white'
                          : style.popular
                            ? 'bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white'
                            : 'bg-[#1E1E2E] text-[#F8F8FC]'
                    )}
                  >
                    {isSelected && !isCurrentPlan && <Check className="w-4 h-4" />}
                    {!isCurrentPlan && !isSelected && style.popular && <Sparkles className="w-4 h-4" />}
                    {isCurrentPlan ? '当前计划' : isSelected ? '已选择' : '选择此方案'}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Confirm Subscribe Button */}
        {selectedPlanCode && selectedPlanCode !== currentPlanCode && (
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#10B981]/30 rounded-2xl p-6 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {(() => {
                    const plan = getSelectedPlanDetails()
                    const style = getPlanStyle(plan?.code || '')
                    const IconComponent = style.icon
                    return (
                      <>
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          style.iconBg
                        )}>
                          <IconComponent className={cn("w-6 h-6", style.iconColor)} />
                        </div>
                        <div>
                          <p className="text-[#9090A0] text-sm">已选择方案</p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{plan?.name}</span>
                            <span className="text-[#10B981] font-semibold">
                              ${plan?.price}
                            </span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedPlanCode(null)}
                    className="flex-1 md:flex-none px-6 py-3 rounded-xl font-medium bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSubscribe}
                    className="flex-1 md:flex-none px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#10B981] to-[#059669] text-white hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    确认订阅
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">订阅优势</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <div
                  key={index}
                  className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] hover:border-cyan-500/20 transition-all group overflow-hidden"
                >
                  <div className={cn(
                    "w-14 h-14 mb-4 rounded-xl flex items-center justify-center bg-gradient-to-r",
                    benefit.color
                  )}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-[#9090A0] text-sm leading-relaxed">{benefit.description}</p>
                </div>
              )
            })}
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
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isProcessing && !isSuccess && setShowConfirmModal(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-md backdrop-blur-xl bg-[#12121A] border border-[#1E1E2E] rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.15)] animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
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
              {/* Success State */}
              {isSuccess ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#10B981]/20 flex items-center justify-center animate-in zoom-in duration-300">
                    <Check className="w-10 h-10 text-[#10B981]" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">订阅成功!</h3>
                  <p className="text-[#9090A0]">
                    您已成功订阅 {getSelectedPlanDetails()?.name}
                  </p>
                </div>
              ) : isProcessing ? (
                /* Processing State */
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#06B6D4]/20 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-[#06B6D4] animate-spin" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">处理中...</h3>
                  <p className="text-[#9090A0]">正在处理您的订阅请求，请稍候</p>
                </div>
              ) : (
                /* Confirm State */
                <>
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-[#06B6D4] to-[#0891B2] flex items-center justify-center">
                      <Wallet className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-1">确认订阅</h3>
                    <p className="text-[#9090A0] text-sm">请确认以下订阅信息</p>
                  </div>

                  {/* Plan Details */}
                  <div className="bg-[#0A0A0F] rounded-xl p-5 mb-6 space-y-4">
                    {(() => {
                      const plan = getSelectedPlanDetails()
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[#9090A0]">订阅方案</span>
                            <span className="font-semibold">{plan?.name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#9090A0]">时长</span>
                            <span className="font-semibold">{plan?.durationDays} 天</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#9090A0]">折合月费</span>
                            <span className="font-semibold">${plan?.monthlyPrice}/月</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#9090A0]">当前余额</span>
                            <span className="font-semibold text-[#06B6D4]">${usdtBalance} USDT</span>
                          </div>
                          <div className="border-t border-[#1E1E2E] pt-4 flex items-center justify-between">
                            <span className="text-[#9090A0]">支付金额</span>
                            <span className="text-2xl font-bold text-[#10B981]">
                              ${plan?.price}
                            </span>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-3 p-4 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl mb-6">
                    <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[#F59E0B]">
                      订阅费用将从您的 USDT 余额中扣除。请确保余额充足。
                    </p>
                  </div>

                  {/* Actions */}
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
                      className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-[#10B981] to-[#059669] text-white hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      确认支付
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
