'use client'

import { ExternalLink, CheckCircle2, Clock, Star } from 'lucide-react'
import Image from 'next/image'

export interface Exchange {
  id: string
  name: string
  logo: string
  description: string
  features: string[]
  affiliateUrl: string
  status: 'supported' | 'coming_soon'
}

// 硬编码兜底数据（API 不可用时使用）
export const defaultExchanges: Exchange[] = [
  {
    id: 'binance',
    name: 'Binance',
    logo: '/icons/exchanges/币安.webp',
    description: '全球最大加密货币交易所，交易量稳居第一',
    features: ['现货交易', '合约交易', '理财产品'],
    affiliateUrl: 'https://accounts.binance.com/register',
    status: 'supported',
  },
  {
    id: 'okx',
    name: 'OKX',
    logo: '/icons/exchanges/okx.webp',
    description: '领先的 Web3 交易平台，功能全面',
    features: ['现货交易', '合约交易', 'Web3 钱包'],
    affiliateUrl: 'https://www.okx.com/join',
    status: 'supported',
  },
  {
    id: 'bybit',
    name: 'Bybit',
    logo: '/icons/exchanges/bybit.webp',
    description: '专业衍生品交易平台，深度好',
    features: ['现货交易', '合约交易', '跟单交易'],
    affiliateUrl: 'https://www.bybit.com/invite',
    status: 'supported',
  },
  {
    id: 'gate',
    name: 'Gate.io',
    logo: '/icons/exchanges/gate.webp',
    description: '币种丰富的老牌交易所',
    features: ['现货交易', '合约交易', '新币首发'],
    affiliateUrl: 'https://www.gate.io/signup',
    status: 'supported',
  },
  {
    id: 'bitget',
    name: 'Bitget',
    logo: '/icons/exchanges/bitget.webp',
    description: '跟单交易领先平台',
    features: ['现货交易', '合约交易', '一键跟单'],
    affiliateUrl: 'https://www.bitget.com/register',
    status: 'supported',
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    logo: '/icons/exchanges/coinbase.webp',
    description: '美国最大合规交易所',
    features: ['现货交易', '机构服务', '合规安全'],
    affiliateUrl: 'https://www.coinbase.com/join',
    status: 'coming_soon',
  },
]

interface ExchangesPageProps {
  exchanges?: Exchange[]
}

export function ExchangesPageV3({ exchanges = defaultExchanges }: ExchangesPageProps) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">推荐交易所</h1>
      <p className="text-[#9090A0] text-sm mb-6">精选安全可靠的交易所，注册后绑定 API Key 即可开始自动交易</p>

      {/* 提示卡片 */}
      <div className="glass-border-glow relative bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 mb-6">
        <div className="flex items-start gap-3">
          <Star className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold mb-1">如何开始使用 HOOT 自动交易？</h2>
            <p className="text-xs text-[#9090A0] leading-relaxed">
              1. 在推荐交易所注册账号 → 2. 创建 API Key（仅开启交易权限） → 3. 在 HOOT 钱包页面绑定 API Key → 4. 订阅策略开始自动交易
            </p>
          </div>
        </div>
      </div>

      {/* 交易所网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exchanges.map((exchange) => (
          <div
            key={exchange.id}
            className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 hover:shadow-[0_8px_32px_rgba(6,182,212,0.08)] transition-all"
          >
            {/* Logo + 名称 */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-[#1E1E2E] overflow-hidden flex items-center justify-center">
                <Image
                  src={exchange.logo}
                  alt={exchange.name}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold">{exchange.name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
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
              </div>
            </div>

            {/* 描述 */}
            <p className="text-sm text-[#9090A0] mb-3">{exchange.description}</p>

            {/* 特点标签 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {exchange.features.map((feature) => (
                <span
                  key={feature}
                  className="text-xs px-2 py-1 rounded-md bg-[#1E1E2E] text-[#9090A0]"
                >
                  {feature}
                </span>
              ))}
            </div>

            {/* 按钮 */}
            <a
              href={exchange.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                exchange.status === 'supported'
                  ? 'bg-cyan-500 text-black hover:bg-cyan-400'
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
        ))}
      </div>
    </div>
  )
}
