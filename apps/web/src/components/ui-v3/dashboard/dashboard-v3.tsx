'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Users, Play, Pause, Volume2, ExternalLink, Loader2, Building2, Gift } from 'lucide-react'
import Image from 'next/image'
import { useHomepageData, formatPrice, formatChange, formatTimeAgo, type CoinPrice, type CryptoNews, type Announcement, type MarqueeItem, type MarqueeConfig } from '@/hooks/useMarket'
import { useTranslations } from '@/i18n/provider'

interface DashboardV3Props {
  onNavigate?: (path: string) => void
}

// 轮播组件
function Carousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const t = useTranslations('dashboard')

  const slides = [
    {
      titleKey: 'carousel.autoTradeTitle',
      subtitleKey: 'carousel.autoTradeSubtitle',
      descriptionKey: 'carousel.autoTradeDesc',
      gradient: 'from-teal-500/20 to-violet-500/20',
      iconBg: 'bg-teal-500/20',
      ctaKey: 'carousel.autoTradeCta'
    },
    {
      titleKey: 'carousel.newFeature',
      subtitleKey: 'carousel.aiRebalancing',
      descriptionKey: 'carousel.aiRebalancingDesc',
      gradient: 'from-purple-500/20 to-cyan-500/20',
      iconBg: 'bg-purple-500/20',
      ctaKey: 'carousel.tryNow'
    },
    {
      type: 'standard',
      titleKey: 'carousel.hotStrategy',
      subtitleKey: 'carousel.gridTradingPro',
      descriptionKey: 'carousel.gridTradingDesc',
      gradient: 'from-emerald-500/20 to-cyan-500/20',
      iconBg: 'bg-emerald-500/20',
      ctaKey: 'carousel.viewDetails'
    },
    {
      type: 'standard',
      titleKey: 'carousel.inviteFriends',
      subtitleKey: 'carousel.earnReward',
      descriptionKey: 'carousel.inviteDesc',
      gradient: 'from-orange-500/20 to-red-500/20',
      iconBg: 'bg-orange-500/20',
      ctaKey: 'carousel.inviteNow'
    },
    {
      type: 'standard',
      titleKey: 'carousel.support24h',
      subtitleKey: 'carousel.onlineAlways',
      descriptionKey: 'carousel.supportDesc',
      gradient: 'from-blue-500/20 to-indigo-500/20',
      iconBg: 'bg-blue-500/20',
      ctaKey: 'carousel.contactSupport'
    }
  ]

  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [isPlaying, slides.length])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  return (
    <div className="relative w-full h-48 md:h-56 rounded-2xl overflow-hidden">
      <div className="relative w-full h-full">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className={`relative w-full h-full bg-gradient-to-br ${slide.gradient} backdrop-blur-xl border border-[#1E1E2E] rounded-2xl flex items-center`}>
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent rounded-2xl" />
                <div className="relative z-10 px-6 md:px-10">
                  <div className="text-sm text-[#9090A0] mb-1">{t(slide.titleKey)}</div>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#F8F8FC] mb-2">
                    {t(slide.subtitleKey)}
                  </h2>
                  <p className="text-[#9090A0] text-sm mb-4 max-w-md">
                    {t(slide.descriptionKey)}
                  </p>
                  <button type="button" className="bg-[#06B6D4] hover:bg-[#06B6D4]/80 text-black px-5 py-2 rounded-lg font-medium transition-colors text-sm">
                    {t(slide.ctaKey)}
                  </button>
                </div>
              </div>
          </div>
        ))}
      </div>

      {/* 控制按钮 */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label={t('previousSlide')}
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={nextSlide}
        aria-label={t('nextSlide')}
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* 播放/暂停按钮 */}
      <button
        type="button"
        onClick={() => setIsPlaying(!isPlaying)}
        aria-label={isPlaying ? t('pause') : t('play')}
        className="absolute bottom-3 right-3 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* 指示器 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2">
        {slides.map((_, index) => (
          <button
            type="button"
            key={index}
            onClick={() => setCurrentSlide(index)}
            aria-label={t('switchToSlide', { n: index + 1 })}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentSlide ? 'w-6 bg-[#06B6D4]' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// 跑马灯公告栏
function Marquee({
  marquees,
  config,
  announcements: announcementsData
}: {
  marquees?: MarqueeItem[]
  config?: MarqueeConfig
  announcements?: Announcement[]
}) {
  const t = useTranslations('dashboard')

  // 跑马灯文案：使用 i18n 本地化默认文案（10 语言精翻）
  // 管理后台配置跑马灯后，可切换为 API 数据
  const defaultAnnouncements = [
    t('defaultAnnouncements.welcome'),
    t('defaultAnnouncements.aiStrategy'),
    t('defaultAnnouncements.security'),
    t('defaultAnnouncements.referral')
  ]
  const displayItems = defaultAnnouncements.map(text => ({ text, link: undefined as string | undefined }))

  // 跑马灯动画 12s 循环（对标 Binance/OKX）
  const animationDuration = 12

  return (
    <div className="relative bg-[#12121A]/60 border border-[#1E1E2E] rounded-xl overflow-hidden h-10 flex items-center px-4">
      <div className="flex items-center gap-2 mr-4 whitespace-nowrap">
        <Volume2 className="w-4 h-4 text-[#F7931A]" />
        <span className="text-sm font-medium text-[#B0B0C0]">{t('announcement')}</span>
      </div>
      <div className="flex-1 overflow-hidden marquee-container">
        <div
          className="whitespace-nowrap text-sm text-[#B0B0C0] marquee-track"
          style={{
            animation: `marquee ${animationDuration}s linear infinite`,
          }}
        >
          {displayItems.map((item, index) => (
            <span key={index}>
              {index > 0 && <span className="mx-4 text-[#333]">|</span>}
              {item.link ? (
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  className="hover:text-[#06B6D4] transition-colors cursor-pointer">
                  {item.text}
                </a>
              ) : (
                <span>{item.text}</span>
              )}
            </span>
          ))}
          <span className="mx-4 text-[#333]">|</span>
          {displayItems.map((item, index) => (
            <span key={`dup-${index}`}>
              {index > 0 && <span className="mx-4 text-[#333]">|</span>}
              {item.link ? (
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  className="hover:text-[#06B6D4] transition-colors cursor-pointer">
                  {item.text}
                </a>
              ) : (
                <span>{item.text}</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// 快捷访问卡片 - 一个卡片内包含4个入口
function QuickAccessCards({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const t = useTranslations('dashboard')

  const cards = [
    {
      icon: Building2,
      titleKey: 'quickAccess.exchanges',
      path: '/exchanges',
      gradient: 'from-cyan-500 to-blue-500'
    },
    {
      icon: TrendingUp,
      titleKey: 'quickAccess.strategies',
      path: '/strategies',
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      icon: Gift,
      titleKey: 'quickAccess.checkin',
      path: '/airdrop',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: Users,
      titleKey: 'quickAccess.inviteFriends',
      path: '/referral',
      gradient: 'from-orange-500 to-red-500'
    }
  ]

  return (
    <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-cyan-400/[0.04] via-transparent to-transparent pointer-events-none z-[1]" />
      <div className="relative z-[2] grid grid-cols-4 divide-x divide-[#1E1E2E]">
        {cards.map((card) => (
          <button
            type="button"
            key={card.path}
            onClick={() => onNavigate?.(card.path)}
            className="flex flex-col items-center justify-center py-5 px-4 hover:bg-[#1E1E2E]/30 transition-all group"
          >
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-r ${card.gradient} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform shadow-lg`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-[#F8F8FC] font-medium text-sm group-hover:text-[#06B6D4] transition-colors">
              {t(card.titleKey)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// 市场价格和新闻标签页
function MarketTabs({ prices, news, isLoading }: {
  prices?: CoinPrice[]
  news?: CryptoNews[]
  isLoading?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'market' | 'news'>('market')
  const t = useTranslations('dashboard')

  // 默认数据（当 API 未返回时使用）
  const defaultMarketData: CoinPrice[] = [
    { symbol: 'BTC', name: 'Bitcoin', price: 105230, change24h: 2.35 },
    { symbol: 'ETH', name: 'Ethereum', price: 3850, change24h: 1.82 },
    { symbol: 'BNB', name: 'BNB', price: 580, change24h: -0.54 },
    { symbol: 'SOL', name: 'Solana', price: 178, change24h: 3.21 },
    { symbol: 'XRP', name: 'XRP', price: 2.45, change24h: 0.87 },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.32, change24h: -1.23 }
  ]

  const defaultNewsData = [
    { id: '1', title: 'BTC突破10万美元大关，机构持续加仓', source: 'CoinDesk', publishedAt: '2026-02-08T00:00:00.000Z', sentiment: 'positive' as const },
    { id: '2', title: 'ETH升级完成，Gas费降低80%', source: 'The Block', publishedAt: '2026-02-07T19:00:00.000Z', sentiment: 'positive' as const },
    { id: '3', title: '美联储暗示2025年可能降息，加密市场反弹', source: 'Bloomberg', publishedAt: '2026-02-07T16:00:00.000Z', sentiment: 'neutral' as const },
    { id: '4', title: 'Solana生态TVL创新高，DeFi项目活跃', source: 'DeFi Llama', publishedAt: '2026-02-07T12:00:00.000Z', sentiment: 'positive' as const }
  ]

  const marketData = prices && prices.length > 0 ? prices : defaultMarketData
  const newsData = news && news.length > 0 ? news : defaultNewsData

  // 新闻来源图标颜色映射
  const getSourceColor = (source: string): string => {
    const colorMap: Record<string, string> = {
      'CoinDesk': '#F7931A',
      'The Block': '#6366F1',
      'Bloomberg': '#2563EB',
      'Reuters': '#FF6600',
      'Decrypt': '#8B5CF6',
      'DeFi Llama': '#22C55E',
      'CoinTelegraph': '#06B6D4',
      'Messari': '#3B82F6',
    }
    return colorMap[source] || '#' + Math.abs(source.split('').reduce((a, c) => a + c.charCodeAt(0) * 37, 0) % 0xFFFFFF).toString(16).padStart(6, '0')
  }

  return (
    <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-cyan-400/[0.04] via-transparent to-transparent pointer-events-none z-[1]" />
      {/* 标签页头部 */}
      <div className="relative z-[2] flex border-b border-[#1E1E2E]">
        <button
          type="button"
          onClick={() => setActiveTab('market')}
          className={`flex-1 py-4 font-medium transition-colors relative ${
            activeTab === 'market'
              ? 'text-[#06B6D4]'
              : 'text-[#9090A0] hover:text-[#F8F8FC]'
          }`}
        >
          {t('marketQuotes')}
          {activeTab === 'market' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('news')}
          className={`flex-1 py-4 font-medium transition-colors relative ${
            activeTab === 'news'
              ? 'text-[#06B6D4]'
              : 'text-[#9090A0] hover:text-[#F8F8FC]'
          }`}
        >
          {t('industryNews')}
          {activeTab === 'news' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
          )}
        </button>
      </div>

      {/* 标签页内容 */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#06B6D4] animate-spin" />
          </div>
        ) : activeTab === 'market' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {marketData.map((coin) => {
              const isUp = coin.change24h >= 0
              return (
                <div
                  key={coin.symbol}
                  className="p-4 bg-[#0A0A0F]/50 border border-[#1E1E2E] rounded-xl hover:border-[#2A2A3A] transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                      {coin.image ? (
                        <Image src={coin.image} alt={coin.symbol} width={28} height={28} className="w-7 h-7" unoptimized />
                      ) : (
                        <span className="text-sm font-bold text-[#06B6D4]">
                          {coin.symbol.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-[#F8F8FC] text-sm">{coin.symbol}</div>
                      <div className="text-xs text-[#606070]">{coin.name}</div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-base font-bold text-[#F8F8FC]">
                      ${formatPrice(coin.price)}
                    </div>
                    <div className={`text-sm font-medium flex items-center gap-1 ${
                      isUp ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {formatChange(coin.change24h)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {newsData.map((item) => {
              const tag = item.sentiment === 'positive' ? t('hot') : item.sentiment === 'negative' ? t('warning') : ''
              return (
                <div
                  key={item.id}
                  className="p-4 bg-[#0A0A0F]/50 border border-[#1E1E2E] rounded-xl hover:border-[#2A2A3A] transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {tag && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            item.sentiment === 'positive'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {tag}
                          </span>
                        )}
                        <span
                          className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ backgroundColor: getSourceColor(item.source) }}
                        >
                          {item.source.charAt(0)}
                        </span>
                        <span className="text-xs text-[#606070]">{item.source}</span>
                        <span className="text-xs text-[#606070]">·</span>
                        <span className="text-xs text-[#606070]">{formatTimeAgo(item.publishedAt)}</span>
                      </div>
                      <h4 className="text-[#F8F8FC] text-sm group-hover:text-[#06B6D4] transition-colors">
                        {item.title}
                      </h4>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#606070] group-hover:text-[#06B6D4] transition-colors flex-shrink-0 mt-1" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// 主仪表板组件
export function DashboardV3({ onNavigate }: DashboardV3Props) {
  // 获取首页数据（行情、新闻、公告）
  const { data, isLoading } = useHomepageData()

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* 轮播图 */}
        <Carousel />

        {/* 跑马灯公告 */}
        <Marquee
          marquees={data?.marquees}
          config={data?.marqueeConfig}
          announcements={data?.announcements}
        />

        {/* 快捷入口 */}
        <QuickAccessCards onNavigate={onNavigate} />

        {/* 市场行情/资讯 Tab */}
        <MarketTabs
          prices={data?.prices}
          news={data?.news}
          isLoading={isLoading}
        />
      </div>

    </div>
  )
}
