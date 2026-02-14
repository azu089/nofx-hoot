'use client'

import { useState, useEffect, TouchEvent } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Bell,
  Megaphone,
  Loader2,
  Building2,
  Download,
  Gift,
} from 'lucide-react'
import { useHomepageData, formatPrice, formatChange, formatTimeAgo, type CoinPrice, type CryptoNews } from '@/hooks/useMarket'
import { useTranslations } from '@/i18n/provider'
import { AiDashboardCards } from './ai-dashboard-cards'

interface MobileDashboardV3Props {
  onNavigate?: (path: string) => void
}

export function MobileDashboardV3({ onNavigate }: MobileDashboardV3Props) {
  const [activeTab, setActiveTab] = useState<'market' | 'news'>('market')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const t = useTranslations('dashboard')
  const tNav = useTranslations('nav')

  // 监听 PWA 安装事件
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      ;(window as PwaWindow).__pwaInstallPrompt = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // 获取真实数据
  const { data, isLoading } = useHomepageData()

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

  // 默认数据（当 API 未返回时使用）
  const defaultMarketData: CoinPrice[] = [
    { symbol: 'BTC', name: 'Bitcoin', price: 105230, change24h: 2.35 },
    { symbol: 'ETH', name: 'Ethereum', price: 3850, change24h: 1.82 },
    { symbol: 'BNB', name: 'BNB', price: 580, change24h: -0.54 },
    { symbol: 'SOL', name: 'Solana', price: 178, change24h: 3.21 },
    { symbol: 'XRP', name: 'XRP', price: 2.45, change24h: 0.87 },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.32, change24h: -1.23 }
  ]

  const defaultNewsData: CryptoNews[] = [
    { id: '1', title: 'BTC突破10万美元大关，机构持续加仓', source: 'CoinDesk', url: '#', publishedAt: '2026-02-08T00:00:00.000Z', sentiment: 'positive' },
    { id: '2', title: 'ETH升级完成，Gas费降低80%', source: 'The Block', url: '#', publishedAt: '2026-02-07T19:00:00.000Z', sentiment: 'positive' },
    { id: '3', title: '美联储暗示2025年可能降息，加密市场反弹', source: 'Bloomberg', url: '#', publishedAt: '2026-02-07T16:00:00.000Z', sentiment: 'neutral' },
    { id: '4', title: 'Solana生态TVL创新高，DeFi项目活跃', source: 'DeFi Llama', url: '#', publishedAt: '2026-02-07T12:00:00.000Z', sentiment: 'positive' }
  ]

  const marketData = data?.prices && data.prices.length > 0 ? data.prices : defaultMarketData
  const newsData = data?.news && data.news.length > 0 ? data.news : defaultNewsData

  const carouselSlides = [
    {
      titleKey: 'carousel.autoTradeTitle',
      subtitleKey: 'carousel.autoTradeSubtitle',
      descriptionKey: 'carousel.autoTradeDesc',
      gradient: 'from-teal-500/20 to-violet-500/20',
      ctaKey: 'carousel.autoTradeCta'
    },
    {
      titleKey: 'carousel.newFeature',
      subtitleKey: 'carousel.aiRebalancing',
      descriptionKey: 'carousel.aiRebalancingDesc',
      gradient: 'from-purple-500/20 to-cyan-500/20',
      ctaKey: 'carousel.tryNow'
    },
    {
      type: 'standard',
      titleKey: 'carousel.hotStrategy',
      subtitleKey: 'carousel.gridTradingPro',
      descriptionKey: 'carousel.gridTradingDesc',
      gradient: 'from-emerald-500/20 to-cyan-500/20',
      ctaKey: 'carousel.viewDetails'
    },
    {
      type: 'standard',
      titleKey: 'carousel.inviteFriends',
      subtitleKey: 'carousel.earnReward',
      descriptionKey: 'carousel.inviteDesc',
      gradient: 'from-orange-500/20 to-red-500/20',
      ctaKey: 'carousel.inviteNow'
    },
    {
      type: 'standard',
      titleKey: 'carousel.support24h',
      subtitleKey: 'carousel.onlineAlways',
      descriptionKey: 'carousel.supportDesc',
      gradient: 'from-blue-500/20 to-indigo-500/20',
      ctaKey: 'carousel.contactSupport'
    }
  ]

  const quickAccessItems = [
    { titleKey: 'quickAccess.exchanges', icon: Building2, path: '/exchanges', gradient: 'from-cyan-500 to-blue-500' },
    { titleKey: 'quickAccess.installApp', icon: Download, path: 'pwa-install', gradient: 'from-emerald-500 to-teal-500' },
    { titleKey: 'quickAccess.checkin', icon: Gift, path: '/airdrop', gradient: 'from-purple-500 to-pink-500' },
    { titleKey: 'quickAccess.inviteFriends', icon: Users, path: '/referral', gradient: 'from-orange-500 to-red-500' }
  ]

  // 公告数据：优先使用 API 数据，根据系统语言选择对应内容
  const defaultAnnouncements = [
    t('defaultAnnouncements.maintenance'),
    t('defaultAnnouncements.newStrategy'),
    t('defaultAnnouncements.referralEvent'),
    t('defaultAnnouncements.aiStrategy')
  ]

  // API 已返回翻译后的内容，直接使用即可
  // 跑马灯使用 marquees 数据，不是 announcements
  const marqueeTexts = data?.marquees && data.marquees.length > 0
    ? data.marquees.map(m => m.content)
    : defaultAnnouncements

  // 跑马灯配置
  const marqueeConfig = data?.marqueeConfig || { scrollSpeed: 50, pauseOnHover: true, displayDuration: 5 }
  // 根据速度计算动画时长（速度越快时长越短）
  // scrollSpeed 单位是 px/s，假设内容宽度约 1500px
  // 时长 = 宽度 / 速度
  // 例：80px/s → 1500/80 ≈ 19秒，150px/s → 10秒
  const marqueeDuration = Math.max(8, 1500 / marqueeConfig.scrollSpeed)

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
    }, 8000)
    return () => clearInterval(timer)
  }, [carouselSlides.length])

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* Header - 标题 + 通知 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="w-10" />
          <h1 className="text-base font-semibold text-white">{tNav('home')}</h1>
          <button type="button" className="relative w-10 h-10 flex items-center justify-center" aria-label={t('announcement')}>
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
                        <div className="text-xs text-[#9090A0] mb-0.5">{t(slide.titleKey)}</div>
                        <h2 className="text-xl font-bold text-[#F8F8FC] mb-1">
                          {t(slide.subtitleKey)}
                        </h2>
                        <p className="text-[#9090A0] text-xs mb-3">
                          {t(slide.descriptionKey)}
                        </p>
                        <button type="button" className="bg-[#06B6D4] text-black px-4 py-1.5 rounded-lg font-medium text-xs">
                          {t(slide.ctaKey)}
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
                aria-label={t('switchToSlide', { n: index + 1 })}
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
              <div
                className="whitespace-nowrap text-[#9090A0] text-xs"
                style={{
                  animation: `marquee ${marqueeDuration}s linear infinite`,
                }}
              >
                {marqueeTexts.map((text, index) => (
                  <span key={index} className="mx-6">{text}</span>
                ))}
                {marqueeTexts.map((text, index) => (
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
                onClick={() => {
                  if (item.path === 'pwa-install') {
                    // PWA 安装逻辑
                    const deferredPrompt = (window as PwaWindow).__pwaInstallPrompt
                    if (deferredPrompt) {
                      deferredPrompt.prompt()
                      deferredPrompt.userChoice.then(() => {
                        ;(window as PwaWindow).__pwaInstallPrompt = null
                      })
                    } else {
                      // 已安装或不支持，跳转到提示页
                      alert('请使用浏览器菜单中的「添加到主屏幕」安装应用')
                    }
                    return
                  }
                  onNavigate?.(item.path)
                }}
                className="flex flex-col items-center py-2 active:scale-95 transition-transform"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${item.gradient} flex items-center justify-center mb-1.5 shadow-lg`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[#F8F8FC] font-medium text-xs">
                  {t(item.titleKey)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Trading Cards */}
        <AiDashboardCards
          onResearchClick={() => onNavigate?.('/ai-research')}
          onStrategyClick={() => onNavigate?.('/ai-trading')}
        />

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
              {t('marketQuotes')}
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
              {t('industryNews')}
              {activeTab === 'news' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06B6D4]" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#06B6D4] animate-spin" />
              </div>
            ) : activeTab === 'market' ? (
              <div className="grid grid-cols-2 gap-2">
                {marketData.map((coin) => {
                  const isUp = coin.change24h >= 0
                  return (
                    <div
                      key={coin.symbol}
                      className="p-3 bg-[#0A0A0F]/50 border border-[#1E1E2E] rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                          {coin.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coin.image} alt={coin.symbol} className="w-5 h-5" />
                          ) : (
                            <span className="text-xs font-bold text-[#06B6D4]">
                              {coin.symbol.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[#F8F8FC] text-xs">{coin.symbol}</div>
                          <div className="text-[10px] text-[#606070]">{coin.name}</div>
                        </div>
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="text-sm font-bold text-[#F8F8FC]">
                          ${formatPrice(coin.price)}
                        </div>
                        <div className={`text-xs font-medium flex items-center gap-0.5 ${
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
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#2A2A3A] scrollbar-track-transparent">
                {newsData.map((news) => {
                  const tag = news.sentiment === 'positive' ? t('hot') : news.sentiment === 'negative' ? t('warning') : ''
                  return (
                    <a
                      key={news.id}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-[#0A0A0F]/50 border border-[#1E1E2E] rounded-lg hover:border-[#06B6D4]/30 transition-colors"
                    >
                      <div className="flex gap-3">
                        {/* 新闻配图 */}
                        {news.image && (
                          <div className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-[#1E1E2E]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={news.image}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // 图片加载失败时隐藏
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {tag && (
                              <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                                news.sentiment === 'positive'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-orange-500/20 text-orange-400'
                              }`}>
                                {tag}
                              </span>
                            )}
                            <span
                              className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                              style={{ backgroundColor: getSourceColor(news.source) }}
                            >
                              {news.source.charAt(0)}
                            </span>
                            <span className="text-[10px] text-[#606070]">{news.source}</span>
                            <span className="text-[10px] text-[#606070]">·</span>
                            <span className="text-[10px] text-[#606070]">{formatTimeAgo(news.publishedAt)}</span>
                          </div>
                          <h4 className="text-[#F8F8FC] text-xs line-clamp-2">
                            {news.title}
                          </h4>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
