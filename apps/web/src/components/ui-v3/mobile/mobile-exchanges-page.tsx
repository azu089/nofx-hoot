'use client'

import { ArrowLeft, ExternalLink, CheckCircle2, Clock, Star } from 'lucide-react'
import Image from 'next/image'
import type { Exchange } from '@/components/ui-v3/exchanges/exchanges-page-v3'
import { defaultExchanges } from '@/components/ui-v3/exchanges/exchanges-page-v3'

interface MobileExchangesPageProps {
  onBack?: () => void
  exchanges?: Exchange[]
}

export function MobileExchangesPage({ onBack, exchanges = defaultExchanges }: MobileExchangesPageProps) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center px-4 h-14">
          <button type="button" onClick={onBack} className="p-1 -ml-1 mr-3">
            <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
          </button>
          <h1 className="text-lg font-bold">推荐交易所</h1>
        </div>
      </div>

      {/* 说明 */}
      <div className="px-4 pt-4">
        <div className="glass-border-glow relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold mb-1">精选安全可靠的交易所</h2>
              <p className="text-xs text-[#9090A0] leading-relaxed">
                以下交易所均已与 HOOT 平台完成 API 对接，注册后绑定 API Key 即可开始自动交易。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 交易所列表 */}
      <div className="px-4 mt-4 pb-24 space-y-3">
        {exchanges.map((exchange) => (
          <div
            key={exchange.id}
            className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="p-4">
              {/* 头部：Logo + 名称 + 状态 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E1E2E] overflow-hidden flex items-center justify-center">
                    <Image
                      src={exchange.logo}
                      alt={exchange.name}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">{exchange.name}</h3>
                    <p className="text-xs text-[#9090A0] mt-0.5">{exchange.description}</p>
                  </div>
                </div>
              </div>

              {/* 特点标签 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {exchange.features.map((feature) => (
                  <span
                    key={feature}
                    className="text-xs px-2 py-1 rounded-md bg-[#1E1E2E] text-[#9090A0]"
                  >
                    {feature}
                  </span>
                ))}
              </div>

              {/* 状态 + 按钮 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {exchange.status === 'supported' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400">已对接</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs text-orange-400">即将支持</span>
                    </>
                  )}
                </div>

                <a
                  href={exchange.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    exchange.status === 'supported'
                      ? 'bg-cyan-500 text-black active:scale-95'
                      : 'bg-[#1E1E2E] text-[#9090A0] cursor-default pointer-events-none'
                  }`}
                >
                  {exchange.status === 'supported' ? (
                    <>
                      立即注册
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    '敬请期待'
                  )}
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* 底部说明 */}
        <div className="text-center py-6">
          <p className="text-xs text-[#9090A0]">
            注册后前往「钱包」页面绑定 API Key 即可开始交易
          </p>
        </div>
      </div>
    </div>
  )
}
