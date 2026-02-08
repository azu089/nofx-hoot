'use client'

import { useState } from 'react'
import { Shield, Crown, TrendingUp, Check, ArrowLeft, Loader2, Wallet, X, Star, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface MembershipPlan {
  id: string
  code: string  // 'monthly' | 'quarterly' | 'yearly'
  name: string  // '月度会员' | '季度会员' | '年度会员'
  price: string  // '15' | '36' | '99'
  durationDays: number  // 30 | 90 | 365
  originalPrice?: string
  discountPercent?: number | null
  monthlyPrice: string  // 折合月费
  maxStrategies: number
}

interface MobileSubscriptionPageProps {
  plans?: MembershipPlan[]
  currentPlanCode?: string
  currentPeriodEnd?: string
  isMember?: boolean
  daysRemaining?: number
  usdtBalance?: string
  onSubscribe?: (planCode: string) => void
  isProcessing?: boolean
  isSuccess?: boolean
  onBack?: () => void
}

// 默认套餐数据（用于预览或后端数据未加载时）
const defaultPlans: MembershipPlan[] = [
  {
    id: '1',
    code: 'monthly',
    name: '月度会员',
    price: '15',
    durationDays: 30,
    monthlyPrice: '15',
    maxStrategies: 10,
  },
  {
    id: '2',
    code: 'quarterly',
    name: '季度会员',
    price: '36',
    durationDays: 90,
    originalPrice: '45',
    discountPercent: 20,
    monthlyPrice: '12',
    maxStrategies: 10,
  },
  {
    id: '3',
    code: 'yearly',
    name: '年度会员',
    price: '99',
    durationDays: 365,
    originalPrice: '180',
    discountPercent: 45,
    monthlyPrice: '8.25',
    maxStrategies: 10,
  },
]

// 会员权益（所有套餐功能相同）
const memberBenefits = [
  '10 个策略',
  '无限交易对',
  '20 个持仓',
  'Gas费率 20%',
  'TradingView 信号接入',
  'AI 无限解读',
  '优先客户支持',
]

// 套餐配置
const planConfig: Record<string, { icon: typeof Shield; iconColor: string; bgColor: string; isRecommended?: boolean }> = {
  monthly: {
    icon: Shield,
    iconColor: 'text-gray-400',
    bgColor: 'bg-[#1A1A24]',
  },
  quarterly: {
    icon: TrendingUp,
    iconColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    isRecommended: true,
  },
  yearly: {
    icon: Crown,
    iconColor: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
}

// 订阅优势
const benefits = [
  { icon: TrendingUp, title: '降低 Gas 费用', desc: '享受更低的交易手续费，最高可节省 7%', color: 'bg-cyan-500/20', iconColor: 'text-cyan-400' },
  { icon: Star, title: '优先信号推送', desc: '获得实时市场信号和交易机会', color: 'bg-purple-500/20', iconColor: 'text-purple-400' },
  { icon: Users, title: 'VIP 专属支持', desc: '24/7 专属客服支持', color: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
  { icon: Clock, title: '提前功能体验', desc: '抢先体验最新功能和工具', color: 'bg-amber-500/20', iconColor: 'text-amber-400' },
]

// 常见问题
const faqs = [
  { question: '如何升级我的订阅计划？', answer: '您可以随时在此页面升级您的订阅计划。升级后，新的费率和功能将立即生效。差价将按剩余天数折算。' },
  { question: '季度订阅真的能节省吗？', answer: '是的，选择季度或年度付费可以享受折扣。例如，季度会员折合月费更低，年度会员优惠力度最大。' },
  { question: '可以随时取消订阅吗？', answer: '当然可以。您可以随时取消订阅，取消后将在当前计费周期结束时生效，期间您仍可继续享受会员权益。' },
  { question: 'Gas 费用是如何计算的？', answer: 'Gas 费用是从您的交易盈利中收取的服务费。例如，如果您盈利 $100，20% Gas Fee 意味着平台收取 $20，您获得 $80。' },
  { question: '支持哪些支付方式？', answer: '目前支持 USDT 支付。您可以使用钱包余额直接支付订阅费用，安全便捷。' },
]

export function MobileSubscriptionPage({
  plans = defaultPlans,
  currentPlanCode,
  currentPeriodEnd,
  isMember = false,
  daysRemaining = 0,
  usdtBalance = '0',
  onSubscribe,
  isProcessing = false,
  isSuccess = false,
  onBack,
}: MobileSubscriptionPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const handleSubscribeClick = (plan: MembershipPlan) => {
    setSelectedPlan(plan)
    setShowConfirmSheet(true)
  }

  const handleConfirmSubscribe = () => {
    if (selectedPlan) {
      onSubscribe?.(selectedPlan.code)
    }
  }

  const handleCloseSheet = () => {
    if (!isProcessing) {
      setShowConfirmSheet(false)
      setSelectedPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
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
          <h1 className="text-base font-semibold text-white">会员订阅</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* 当前会员状态 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[#94A3B8] mb-1">当前会员</div>
              {isMember ? (
                <>
                  <div className="text-base font-semibold text-white">
                    {plans.find(p => p.code === currentPlanCode)?.name || '会员'}
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-1">
                    {currentPeriodEnd && <>有效期至 {currentPeriodEnd} · </>}剩余 {daysRemaining} 天
                  </div>
                </>
              ) : (
                <>
                  <div className="text-base font-semibold text-[#94A3B8]">未订阅</div>
                  <div className="text-xs text-[#64748B] mt-1">选择套餐开始您的量化交易之旅</div>
                </>
              )}
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isMember ? 'text-cyan-400' : 'text-[#94A3B8]'}`}>
                {isMember ? '20%' : '20%'}
              </div>
              <div className="text-[10px] text-[#64748B]">Gas 费率</div>
            </div>
          </div>
        </div>

        {/* 套餐列表 */}
        {plans.map((plan) => {
          const config = planConfig[plan.code] || planConfig.monthly
          const Icon = config.icon
          const isCurrent = currentPlanCode === plan.code

          return (
            <div
              key={plan.id}
              className={`glass-border-glow relative rounded-2xl overflow-hidden ${
                config.isRecommended
                  ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30'
                  : 'bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08]'
              } shadow-[0_8px_32px_rgba(0,0,0,0.5)]`}
            >
              {config.isRecommended && (
                <div className="absolute top-0 right-0 px-2.5 py-1 bg-cyan-500 text-white text-[10px] font-bold rounded-bl-lg">
                  推荐
                </div>
              )}

              <div className="p-4">
                {/* 头部 */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">{plan.name}</h3>
                      <span className="text-xs text-[#94A3B8]">{plan.durationDays} 天</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold">${plan.price}</span>
                      {plan.originalPrice && plan.originalPrice !== plan.price && (
                        <span className="text-xs text-[#94A3B8] line-through">${plan.originalPrice}</span>
                      )}
                    </div>
                    <div className="text-xs text-cyan-400">≈ ${plan.monthlyPrice}/月</div>
                    {plan.discountPercent != null && plan.discountPercent > 0 && (
                      <div className="text-[10px] text-green-400 font-medium">省 {plan.discountPercent}%</div>
                    )}
                  </div>
                </div>

                {/* 功能列表 */}
                <div className="space-y-2 mb-4">
                  {memberBenefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span className="text-xs text-[#94A3B8]">{benefit}</span>
                    </div>
                  ))}
                </div>

                {/* 按钮 */}
                <button
                  onClick={() => handleSubscribeClick(plan)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-[#1E1E2E] text-[#94A3B8] cursor-not-allowed'
                      : config.isRecommended
                      ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                      : 'bg-[#1A1A24] hover:bg-[#1E1E2E] text-white border border-[#1E1E2E]'
                  }`}
                >
                  {isCurrent ? '当前套餐' : '立即订阅'}
                </button>
              </div>
            </div>
          )
        })}

        {/* 订阅优势 */}
        <div className="pt-2">
          <h2 className="text-base font-semibold text-white mb-3">订阅优势</h2>
          <div className="grid grid-cols-2 gap-3">
            {benefits.map((b, i) => {
              const Icon = b.icon
              return (
                <div key={i} className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl p-3 overflow-hidden">
                  <div className={`w-9 h-9 rounded-lg ${b.color} flex items-center justify-center mb-2`}>
                    <Icon className={`w-4.5 h-4.5 ${b.iconColor}`} />
                  </div>
                  <div className="text-sm font-medium text-white mb-1">{b.title}</div>
                  <div className="text-[11px] text-[#94A3B8] leading-relaxed">{b.desc}</div>
                </div>
              )
            })}
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
        <div className="fixed inset-0 z-50 flex items-end">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseSheet}
          />

          {/* 弹窗内容 */}
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl animate-slide-up">
            {/* 顶部拖拽指示器 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-[#1E1E2E] rounded-full" />
            </div>

            <div className="p-6 pb-8">
              {/* 标题和关闭按钮 */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">确认订阅</h2>
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

              {/* 成功动画 */}
              {isSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">订阅成功！</span>
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
                    <span>订阅成功</span>
                  </>
                ) : parseFloat(usdtBalance) < parseFloat(selectedPlan.price) ? (
                  '余额不足'
                ) : (
                  `支付 $${selectedPlan.price} USDT`
                )}
              </button>

              {/* 提示文字 */}
              <div className="text-xs text-center text-[#64748B] mt-4">
                订阅后将立即生效，不支持退款
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
