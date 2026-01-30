'use client'

import { useState, useEffect, TouchEvent } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  BarChart3,
  Bell,
  Target,
  Megaphone
} from 'lucide-react'

interface MobileDashboardV3Props {
  onNavigate?: (path: string) => void
}

interface CryptoPrice {
  symbol: string
  name: string
  price: string
  change: string
  isUp: boolean
}

interface NewsItem {
  id: number
  title: string
  time: string
  source: string
  tag?: string
}

export function MobileDashboardV3({ onNavigate }: MobileDashboardV3Props) {
  const [activeTab, setActiveTab] = useState<'market' | 'news'>('market')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Mock crypto data - matching desktop version (6 coins)
  const cryptoPrices: CryptoPrice[] = [
    { symbol: 'BTC', name: 'Bitcoin', price: '105,230', change: '+2.35', isUp: true },
    { symbol: 'ETH', name: 'Ethereum', price: '3,850', change: '+1.82', isUp: true },
    { symbol: 'BNB', name: 'BNB', price: '580', change: '-0.54', isUp: false },
    { symbol: 'SOL', name: 'Solana', price: '178', change: '+3.21', isUp: true },
    { symbol: 'XRP', name: 'XRP', price: '2.45', change: '+0.87', isUp: true },
    { symbol: 'DOGE', name: 'Dogecoin', price: '0.32', change: '-1.23', isUp: false }
  ]

  // Mock news data - matching desktop version (4 news)
  const newsItems: NewsItem[] = [
    { id: 1, title: 'BTC突破10万美元大关，机构持续加仓', source: 'CoinDesk', time: '2小时前', tag: '热门' },
    { id: 2, title: 'ETH升级完成，Gas费降低80%', source: 'The Block', time: '5小时前', tag: '重要' },
    { id: 3, title: '美联储暗示2025年可能降息，加密市场反弹', source: 'Bloomberg', time: '8小时前' },
    { id: 4, title: 'Solana生态TVL创新高，DeFi项目活跃', source: 'DeFi Llama', time: '12小时前' }
  ]

  const carouselSlides = [
    {
      title: '新功能上线',
      subtitle: 'AI智能调仓',
      description: '根据市场变化自动优化持仓比例',
      gradient: 'from-purple-500/20 to-cyan-500/20',
      cta: '立即体验'
    },
    {
      title: '热门策略推荐',
      subtitle: '网格交易Pro',
      description: '本月收益 +18.5%，低风险稳健增长',
      gradient: 'from-emerald-500/20 to-cyan-500/20',
      cta: '查看详情'
    },
    {
      title: '邀请好友',
      subtitle: '得 $50 奖励',
      description: '好友交易你赚佣金，永久返利',
      gradient: 'from-orange-500/20 to-red-500/20',
      cta: '立即邀请'
    },
    {
      title: '24小时客服',
      subtitle: '随时在线',
      description: '专业团队为您解答任何问题',
      gradient: 'from-blue-500/20 to-indigo-500/20',
      cta: '联系客服'
    }
  ]

  const quickAccessItems = [
    { title: '策略市场', icon: Target, path: '/strategies', gradient: 'from-cyan-500 to-blue-500' },
    { title: '交易中心', icon: BarChart3, path: '/trading', gradient: 'from-emerald-500 to-teal-500' },
    { title: '钱包资产', icon: Wallet, path: '/wallet', gradient: 'from-purple-500 to-pink-500' },
    { title: '邀请好友', icon: Users, path: '/referral', gradient: 'from-orange-500 to-red-500' }
  ]

  const announcements = [
    '📢 系统维护通知：1月30日凌晨2点进行例行维护',
    '🔥 新策略上线：趋势追踪Pro，回测收益超200%',
    '🎁 邀请返佣活动进行中，邀请好友最高得$100',
    '📈 BTC突破10万美元，AI策略精准捕捉行情'
  ]

  // Touch handlers for carousel
  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe && currentSlide < carouselSlides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    }
    if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [carouselSlides.length])

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-[#F8F8FC]">首页</h1>
          <button type="button" className="relative p-2" aria-label="通知">
            <Bell className="w-5 h-5 text-[#9090A0]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#06B6D4] rounded-full" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Carousel */}
        <div className="relative">
          <div
            className="overflow-hidden rounded-xl"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {carouselSlides.map((slide, index) => (
                <div key={index} className="w-full flex-shrink-0">
                  <div className={`relative bg-gradient-to-br ${slide.gradient} backdrop-blur-xl border border-[#1E1E2E] rounded-xl h-36 flex items-center overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent rounded-xl" />
                    <div className="relative z-10 px-4">
                      <div className="text-xs text-[#9090A0] mb-0.5">{slide.title}</div>
                      <h2 className="text-xl font-bold text-[#F8F8FC] mb-1">
                        {slide.subtitle}
                      </h2>
                      <p className="text-[#9090A0] text-xs mb-3">
                        {slide.description}
                      </p>
                      <button type="button" className="bg-[#06B6D4] text-black px-4 py-1.5 rounded-lg font-medium text-xs">
                        {slide.cta}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Carousel Indicators */}
          <div className="flex justify-center mt-2 space-x-1.5">
            {carouselSlides.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`切换到第 ${index + 1} 张`}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentSlide ? 'w-4 bg-[#06B6D4]' : 'w-1.5 bg-white/30'
                }`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </div>

        {/* Scrolling Marquee */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden py-2 px-3">
          <div className="flex items-center">
            <Megaphone className="w-3.5 h-3.5 text-[#06B6D4] mr-2 flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <div className="animate-marquee whitespace-nowrap text-[#9090A0] text-xs">
                {announcements.map((text, index) => (
                  <span key={index} className="mx-6">{text}</span>
                ))}
                {announcements.map((text, index) => (
                  <span key={`dup-${index}`} className="mx-6">{text}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access Grid */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-3">
          <div className="grid grid-cols-4 gap-2">
            {quickAccessItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate?.(item.path)}
                className="flex flex-col items-center py-2 active:scale-95 transition-transform"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${item.gradient} flex items-center justify-center mb-1.5 shadow-lg`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[#F8F8FC] font-medium text-xs">
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Switcher - Market/News */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">

          {/* Tab Headers */}
          <div className="flex border-b border-[#1E1E2E]">
            <button
              type="button"
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'market'
                  ? 'text-[#06B6D4]'
                  : 'text-[#9090A0]'
              }`}
              onClick={() => setActiveTab('market')}
            >
              市场行情
              {activeTab === 'market' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
              )}
            </button>
            <button
              type="button"
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'news'
                  ? 'text-[#06B6D4]'
                  : 'text-[#9090A0]'
              }`}
              onClick={() => setActiveTab('news')}
            >
              行业资讯
              {activeTab === 'news' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3">
            {activeTab === 'market' ? (
              <div className="grid grid-cols-2 gap-2">
                {cryptoPrices.map((crypto) => (
                  <div
                    key={crypto.symbol}
                    className="p-3 bg-[#0A0A0F]/50 border border-[#1E1E2E] rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-[#1E1E2E] flex items-center justify-center">
                        <span className="text-xs font-bold text-[#06B6D4]">
                          {crypto.symbol.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-[#F8F8FC] text-xs">{crypto.symbol}</div>
                        <div className="text-[10px] text-[#606070]">{crypto.name}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="text-sm font-bold text-[#F8F8FC]">
                        ${crypto.price}
                      </div>
                      <div className={`text-xs font-medium flex items-center gap-0.5 ${
                        crypto.isUp ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {crypto.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {crypto.change}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {newsItems.map((news) => (
                  <div
                    key={news.id}
                    className="p-3 bg-[#0A0A0F]/50 border border-[#1E1E2E] rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {news.tag && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                          news.tag === '热门'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {news.tag}
                        </span>
                      )}
                      <span className="text-[10px] text-[#606070]">{news.source}</span>
                      <span className="text-[10px] text-[#606070]">·</span>
                      <span className="text-[10px] text-[#606070]">{news.time}</span>
                    </div>
                    <h4 className="text-[#F8F8FC] text-xs">
                      {news.title}
                    </h4>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
