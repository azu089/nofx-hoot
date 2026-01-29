'use client'

import { useState } from 'react'
import {
  Check,
  Crown,
  Zap,
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

interface SubscriptionPageProps {
  currentTier?: 'basic' | 'premium' | 'pro'
  currentPeriodEnd?: string
  onSubscribe?: (tierId: string) => void
  onCancel?: () => void
}

export function SubscriptionPage({
  currentTier = 'basic',
  currentPeriodEnd = '2026-02-28',
  onSubscribe,
  onCancel
}: SubscriptionPageProps) {
  const [isYearly, setIsYearly] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium' | 'pro' | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const plans = [
    {
      id: 'basic' as const,
      name: '基础版',
      nameEn: 'Basic',
      icon: Shield,
      gasFee: '22%',
      price: 0,
      yearlyPrice: 0,
      iconBg: 'bg-[#9090A0]/20',
      iconColor: 'text-[#9090A0]',
      features: [
        '基础交易功能',
        '标准客户支持',
        '基础市场数据',
        '社区访问权限',
        '最多 1 个交易所'
      ],
      popular: false
    },
    {
      id: 'premium' as const,
      name: '高级版',
      nameEn: 'Premium',
      icon: Crown,
      gasFee: '18%',
      price: 29,
      yearlyPrice: 24,
      iconBg: 'bg-[#06B6D4]/20',
      iconColor: 'text-[#06B6D4]',
      features: [
        '降低 Gas 费用 4%',
        '优先信号推送',
        '高级图表工具',
        '优先客户支持',
        '高级市场分析',
        '最多 3 个交易所',
        '自动交易策略'
      ],
      popular: true
    },
    {
      id: 'pro' as const,
      name: '专业版',
      nameEn: 'Pro',
      icon: Zap,
      gasFee: '15%',
      price: 99,
      yearlyPrice: 82,
      iconBg: 'bg-[#F59E0B]/20',
      iconColor: 'text-[#F59E0B]',
      features: [
        '最低 Gas 费用',
        '实时 VIP 信号',
        '专属客户经理',
        '提前功能体验',
        '无限制 API 调用',
        '无限交易所连接',
        '定制交易策略',
        '机构级数据'
      ],
      popular: false
    }
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
      question: '年度订阅真的能节省 17% 吗？',
      answer: '是的，选择年度付费可以享受约 17% 的折扣。例如，高级版年付仅需 $288，相比月付 ($348) 节省 $60。'
    },
    {
      question: '可以随时取消订阅吗？',
      answer: '当然可以。您可以随时取消订阅，取消后将在当前计费周期结束时生效，期间您仍可继续享受会员权益。'
    },
    {
      question: 'Gas 费用是如何计算的？',
      answer: 'Gas 费用是从您的交易盈利中收取的服务费。例如，如果您盈利 $100，18% Gas Fee 意味着平台收取 $18，您获得 $82。'
    },
    {
      question: '支持哪些支付方式？',
      answer: '目前支持 USDT 支付。您可以使用钱包余额直接支付订阅费用，安全便捷。'
    }
  ]

  const getCurrentPlan = () => plans.find(p => p.id === currentTier)

  const getButtonText = (planId: string) => {
    if (planId === currentTier) return '当前计划'
    const currentIndex = plans.findIndex(p => p.id === currentTier)
    const planIndex = plans.findIndex(p => p.id === planId)
    return planIndex > currentIndex ? '立即升级' : '降级'
  }

  const getPrice = (plan: typeof plans[0]) => {
    if (plan.price === 0) return '免费'
    const price = isYearly ? plan.yearlyPrice * 12 : plan.price
    return `$${price}`
  }

  const getPriceLabel = (plan: typeof plans[0]) => {
    if (plan.price === 0) return '永久免费'
    return isYearly ? '/年' : '/月'
  }

  const handlePlanSelect = (planId: 'basic' | 'premium' | 'pro') => {
    if (planId === currentTier) return
    setSelectedPlan(planId)
  }

  const handleSubscribe = () => {
    if (!selectedPlan || selectedPlan === currentTier) return
    setShowConfirmModal(true)
  }

  const handleConfirmPayment = async () => {
    setIsProcessing(true)
    // 模拟支付处理
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsProcessing(false)
    setPaymentSuccess(true)
    // 2秒后关闭弹窗
    setTimeout(() => {
      setShowConfirmModal(false)
      setPaymentSuccess(false)
      onSubscribe?.(selectedPlan!)
      setSelectedPlan(null)
    }, 2000)
  }

  const getSelectedPlanDetails = () => plans.find(p => p.id === selectedPlan)

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
          <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.08)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {(() => {
                  const plan = getCurrentPlan()
                  const IconComponent = plan?.icon
                  return (
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center",
                      plan?.iconBg
                    )}>
                      {IconComponent && (
                        <IconComponent className={cn("w-7 h-7", plan?.iconColor)} />
                      )}
                    </div>
                  )
                })()}
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold">{getCurrentPlan()?.name}</h3>
                    <span className="px-3 py-1 bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] text-xs font-medium rounded-full">
                      当前方案
                    </span>
                  </div>
                  <p className="text-[#9090A0] text-sm mt-1">
                    {currentTier === 'basic' ? '永不过期' : `有效期至 ${currentPeriodEnd}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#06B6D4]">
                    {getCurrentPlan()?.gasFee}
                  </div>
                  <p className="text-sm text-[#9090A0]">Gas 费率</p>
                </div>
                {currentTier !== 'basic' && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-sm text-[#9090A0] hover:text-red-400 transition-colors underline underline-offset-4"
                  >
                    取消订阅
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] rounded-2xl p-1.5">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={cn(
                "px-8 py-3 rounded-xl font-medium transition-all",
                !isYearly
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white shadow-lg shadow-[#06B6D4]/20'
                  : 'text-[#9090A0] hover:text-[#F8F8FC]'
              )}
            >
              按月付费
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={cn(
                "relative px-8 py-3 rounded-xl font-medium transition-all",
                isYearly
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white shadow-lg shadow-[#06B6D4]/20'
                  : 'text-[#9090A0] hover:text-[#F8F8FC]'
              )}
            >
              按年付费
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium rounded-full">
                省17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isCurrentPlan = plan.id === currentTier
            const isSelected = selectedPlan === plan.id
            const currentIndex = plans.findIndex(p => p.id === currentTier)
            const planIndex = plans.findIndex(p => p.id === plan.id)
            const isUpgrade = planIndex > currentIndex

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => handlePlanSelect(plan.id)}
                disabled={isCurrentPlan}
                className={cn(
                  "relative backdrop-blur-xl border rounded-2xl p-8 transition-all duration-300 text-left",
                  plan.popular
                    ? 'bg-gradient-to-b from-[#06B6D4]/10 to-[#12121A]/80 border-[#06B6D4]/50 shadow-[0_0_60px_rgba(6,182,212,0.15)] scale-[1.02]'
                    : 'bg-[#12121A]/80 border-[#1E1E2E] hover:border-[#2A2A3A]',
                  isCurrentPlan && 'ring-2 ring-[#06B6D4]/30 cursor-default',
                  isSelected && !isCurrentPlan && 'ring-2 ring-[#10B981] border-[#10B981]',
                  !isCurrentPlan && 'cursor-pointer hover:scale-[1.01]'
                )}
              >
                {/* Popular Badge */}
                {plan.popular && (
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
                    plan.popular
                      ? 'bg-gradient-to-r from-[#06B6D4] to-[#0891B2]'
                      : plan.iconBg
                  )}>
                    <Icon className={cn(
                      "w-8 h-8",
                      plan.popular ? 'text-white' : plan.iconColor
                    )} />
                  </div>

                  <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-[#606070] mb-4">{plan.nameEn}</p>

                  {/* Gas Fee */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E1E2E] rounded-lg mb-4">
                    <span className="text-[#9090A0] text-sm">Gas Fee</span>
                    <span className={cn(
                      "text-xl font-bold",
                      plan.id === 'pro' ? 'text-[#F59E0B]' : plan.id === 'premium' ? 'text-[#06B6D4]' : 'text-[#9090A0]'
                    )}>
                      {plan.gasFee}
                    </span>
                  </div>

                  {/* Price */}
                  <div>
                    <span className="text-4xl font-bold">{getPrice(plan)}</span>
                    <span className="text-[#9090A0] ml-1">{getPriceLabel(plan)}</span>
                    {isYearly && plan.price > 0 && (
                      <div className="text-sm text-green-400 mt-2">
                        每月仅 ${plan.yearlyPrice}，节省 ${(plan.price - plan.yearlyPrice) * 12}/年
                      </div>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className={cn(
                        "w-5 h-5 flex-shrink-0 mt-0.5",
                        plan.popular ? 'text-[#06B6D4]' : 'text-[#606070]'
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
                        : plan.popular || isUpgrade
                          ? 'bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-white'
                          : 'bg-[#1E1E2E] text-[#F8F8FC]'
                  )}
                >
                  {isSelected && !isCurrentPlan && <Check className="w-4 h-4" />}
                  {isUpgrade && !isCurrentPlan && !isSelected && <Sparkles className="w-4 h-4" />}
                  {isSelected ? '已选择' : getButtonText(plan.id)}
                </div>
              </button>
            )
          })}
        </div>

        {/* Confirm Subscribe Button */}
        {selectedPlan && selectedPlan !== currentTier && (
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#10B981]/30 rounded-2xl p-6 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {(() => {
                    const plan = getSelectedPlanDetails()
                    const IconComponent = plan?.icon
                    return (
                      <>
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          plan?.iconBg
                        )}>
                          {IconComponent && (
                            <IconComponent className={cn("w-6 h-6", plan?.iconColor)} />
                          )}
                        </div>
                        <div>
                          <p className="text-[#9090A0] text-sm">已选择方案</p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{plan?.name}</span>
                            <span className="text-[#10B981] font-semibold">
                              {plan?.price === 0 ? '免费' : `$${isYearly ? plan!.yearlyPrice * 12 : plan?.price}${isYearly ? '/年' : '/月'}`}
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
                    onClick={() => setSelectedPlan(null)}
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
                  className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-6 hover:border-[#2A2A3A] transition-all group"
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
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6">常见问题</h2>
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
            onClick={() => !isProcessing && !paymentSuccess && setShowConfirmModal(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-md backdrop-blur-xl bg-[#12121A] border border-[#1E1E2E] rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.15)] animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            {!isProcessing && !paymentSuccess && (
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
              {paymentSuccess ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#10B981]/20 flex items-center justify-center animate-in zoom-in duration-300">
                    <Check className="w-10 h-10 text-[#10B981]" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">订阅成功!</h3>
                  <p className="text-[#9090A0]">
                    您已成功升级到 {getSelectedPlanDetails()?.name}
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
                      const price = plan?.price === 0 ? 0 : (isYearly ? plan!.yearlyPrice * 12 : plan?.price)
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[#9090A0]">订阅方案</span>
                            <span className="font-semibold">{plan?.name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#9090A0]">计费周期</span>
                            <span className="font-semibold">{isYearly ? '按年付费' : '按月付费'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#9090A0]">Gas 费率</span>
                            <span className="font-semibold text-[#06B6D4]">{plan?.gasFee}</span>
                          </div>
                          <div className="border-t border-[#1E1E2E] pt-4 flex items-center justify-between">
                            <span className="text-[#9090A0]">支付金额</span>
                            <span className="text-2xl font-bold text-[#10B981]">
                              {price === 0 ? '免费' : `$${price}`}
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
