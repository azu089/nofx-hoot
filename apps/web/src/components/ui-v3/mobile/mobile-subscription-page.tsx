'use client'

import { useState } from 'react'
import { Shield, Crown, Zap, Check, ArrowLeft } from 'lucide-react'

type Tier = 'basic' | 'premium' | 'pro'

interface MobileSubscriptionPageProps {
  currentTier?: Tier
  onSubscribe?: (tier: Tier, isYearly: boolean) => void
  onBack?: () => void
}

interface Plan {
  id: Tier
  name: string
  icon: typeof Shield
  iconColor: string
  gasFee: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  recommended?: boolean
}

const plans: Plan[] = [
  {
    id: 'basic',
    name: '基础版',
    icon: Shield,
    iconColor: 'text-gray-400',
    gasFee: '22%',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ['基础交易功能', '实时市场数据', 'Gas费率 22%'],
  },
  {
    id: 'premium',
    name: '高级版',
    icon: Crown,
    iconColor: 'text-cyan-400',
    gasFee: '18%',
    monthlyPrice: 29,
    yearlyPrice: 290,
    recommended: true,
    features: ['高级交易信号', '优先客户支持', 'Gas费率 18%'],
  },
  {
    id: 'pro',
    name: '专业版',
    icon: Zap,
    iconColor: 'text-yellow-400',
    gasFee: '15%',
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: ['独家专业信号', 'VIP专属支持', 'Gas费率 15%', 'API访问权限'],
  },
]

export function MobileSubscriptionPage({
  currentTier = 'basic',
  onSubscribe,
  onBack,
}: MobileSubscriptionPageProps) {
  const [isYearly, setIsYearly] = useState(false)

  const handleSubscribe = (tier: Tier) => {
    onSubscribe?.(tier, isYearly)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-medium text-white">会员订阅</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* 计费周期切换 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl overflow-hidden p-1">
          <div className="flex">
            <button
              onClick={() => setIsYearly(false)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                !isYearly
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-[#94A3B8]'
              }`}
            >
              按月
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                isYearly
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-[#94A3B8]'
              }`}
            >
              按年
              <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 bg-cyan-500 text-white text-[10px] font-bold rounded">
                省17%
              </span>
            </button>
          </div>
        </div>

        {/* 套餐列表 */}
        {plans.map((plan) => {
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
          const isCurrent = currentTier === plan.id
          const Icon = plan.icon

          return (
            <div
              key={plan.id}
              className={`glass-border-glow relative rounded-2xl overflow-hidden ${
                plan.recommended
                  ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30'
                  : 'bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08]'
              } shadow-[0_8px_32px_rgba(0,0,0,0.5)]`}
            >
              {plan.recommended && (
                <div className="absolute top-0 right-0 px-2.5 py-1 bg-cyan-500 text-white text-[10px] font-bold rounded-bl-lg">
                  推荐
                </div>
              )}

              <div className="p-4">
                {/* 头部 */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${plan.recommended ? 'bg-cyan-500/20' : 'bg-[#1A1A24]'} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${plan.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">{plan.name}</h3>
                      <span className={`text-xs ${plan.iconColor}`}>Gas {plan.gasFee}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {price === 0 ? (
                      <span className="text-xl font-bold">免费</span>
                    ) : (
                      <>
                        <span className="text-xl font-bold">¥{price}</span>
                        <span className="text-xs text-[#94A3B8]">/{isYearly ? '年' : '月'}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 功能列表 */}
                <div className="space-y-2 mb-4">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs text-[#94A3B8]">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* 按钮 */}
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-[#1E1E2E] text-[#94A3B8] cursor-not-allowed'
                      : plan.recommended
                      ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                      : 'bg-[#1A1A24] hover:bg-[#1E1E2E] text-white border border-[#1E1E2E]'
                  }`}
                >
                  {isCurrent ? '当前计划' : '立即订阅'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
