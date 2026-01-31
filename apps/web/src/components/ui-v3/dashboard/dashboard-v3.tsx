'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Target, BarChart3, Users, Play, Pause, Megaphone, ExternalLink, Loader2 } from 'lucide-react'
import { useHomepageData, formatPrice, formatChange, formatTimeAgo, type CoinPrice, type CryptoNews, type Announcement } from '@/hooks/useMarket'

interface DashboardV3Props {
  onNavigate?: (path: string) => void
}

// 轮播组件
function Carousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  const slides = [
    {
      title: '新功能上线',
      subtitle: 'AI智能调仓',
      description: '根据市场变化自动优化持仓比例',
      gradient: 'from-purple-500/20 to-cyan-500/20',
      iconBg: 'bg-purple-500/20',
      cta: '立即体验'
    },
    {
      title: '热门策略推荐',
      subtitle: '网格交易Pro',
      description: '本月收益 +18.5%，低风险稳健增长',
      gradient: 'from-emerald-500/20 to-cyan-500/20',
      iconBg: 'bg-emerald-500/20',
      cta: '查看详情'
    },
    {
      title: '邀请好友',
      subtitle: '得 $50 奖励',
      description: '好友交易你赚佣金，永久返利',
      gradient: 'from-orange-500/20 to-red-500/20',
      iconBg: 'bg-orange-500/20',
      cta: '立即邀请'
    },
    {
      title: '24小时客服',
      subtitle: '随时在线',
      description: '专业团队为您解答任何问题',
      gradient: 'from-blue-500/20 to-indigo-500/20',
      iconBg: 'bg-blue-500/20',
      cta: '联系客服'
    }
  ]

  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)

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
                <div className="text-sm text-[#9090A0] mb-1">{slide.title}</div>
                <h2 className="text-2xl md:text-3xl font-bold text-[#F8F8FC] mb-2">
                  {slide.subtitle}
                </h2>
                <p className="text-[#9090A0] text-sm mb-4 max-w-md">
                  {slide.description}
                </p>
                <button type="button" className="bg-[#06B6D4] hover:bg-[#06B6D4]/80 text-black px-5 py-2 rounded-lg font-medium transition-colors text-sm">
                  {slide.cta}
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
        aria-label="上一张"
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={nextSlide}
        aria-label="下一张"
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* 播放/暂停按钮 */}
      <button
        type="button"
        onClick={() => setIsPlaying(!isPlaying)}
        aria-label={isPlaying ? '暂停' : '播放'}
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
            aria-label={`切换到第 ${index + 1} 张`}
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
function Marquee({ announcements: announcementsData }: { announcements?: Announcement[] }) {
  const defaultAnnouncements = [
    '📢 系统维护通知：每周日凌晨2点进行例行维护',
    '🔥 新策略上线：趋势追踪Pro，回测收益超200%',
    '🎁 邀请返佣活动进行中，邀请好友最高得$100',
    '📈 AI策略精准捕捉行情，让交易更简单'
  ]

  // 将公告数据格式化为字符串
  const announcements = announcementsData && announcementsData.length > 0
    ? announcementsData.map(a => a.title)
    : defaultAnnouncements

  return (
    <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden p-3">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-cyan-400/[0.04] via-transparent to-transparent pointer-events-none z-[1]" />
      <div className="relative z-[2] flex items-center">
        <div className="flex items-center gap-2 text-[#06B6D4] font-medium mr-4 whitespace-nowrap">
          <Megaphone className="w-4 h-4" />
          <span className="text-sm">公告</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap text-[#9090A0] text-sm">
            {announcements.map((text, index) => (
              <span key={index} className="mx-8">{text}</span>
            ))}
            {announcements.map((text, index) => (
              <span key={`dup-${index}`} className="mx-8">{text}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 快捷访问卡片 - 一个卡片内包含4个入口
function QuickAccessCards({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const cards = [
    {
      icon: Target,
      title: '策略市场',
      path: '/strategies',
      gradient: 'from-cyan-500 to-blue-500'
    },
    {
      icon: BarChart3,
      title: '交易中心',
      path: '/trading',
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      icon: Wallet,
      title: '钱包资产',
      path: '/wallet',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: Users,
      title: '邀请好友',
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
              {card.title}
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

  // 默认数据（当 API 未返回时使用）
  const defaultMarketData = [
    { symbol: 'BTC', name: 'Bitcoin', price: 105230, change24h: 2.35 },
    { symbol: 'ETH', name: 'Ethereum', price: 3850, change24h: 1.82 },
    { symbol: 'BNB', name: 'BNB', price: 580, change24h: -0.54 },
    { symbol: 'SOL', name: 'Solana', price: 178, change24h: 3.21 },
    { symbol: 'XRP', name: 'XRP', price: 2.45, change24h: 0.87 },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.32, change24h: -1.23 }
  ]

  const defaultNewsData = [
    { id: '1', title: 'BTC突破10万美元大关，机构持续加仓', source: 'CoinDesk', publishedAt: new Date().toISOString(), sentiment: 'positive' as const },
    { id: '2', title: 'ETH升级完成，Gas费降低80%', source: 'The Block', publishedAt: new Date(Date.now() - 5*3600000).toISOString(), sentiment: 'positive' as const },
    { id: '3', title: '美联储暗示2025年可能降息，加密市场反弹', source: 'Bloomberg', publishedAt: new Date(Date.now() - 8*3600000).toISOString(), sentiment: 'neutral' as const },
    { id: '4', title: 'Solana生态TVL创新高，DeFi项目活跃', source: 'DeFi Llama', publishedAt: new Date(Date.now() - 12*3600000).toISOString(), sentiment: 'positive' as const }
  ]

  const marketData = prices && prices.length > 0 ? prices : defaultMarketData
  const newsData = news && news.length > 0 ? news : defaultNewsData

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
          市场行情
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
          行业资讯
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
                    <div className="w-9 h-9 rounded-full bg-[#1E1E2E] flex items-center justify-center">
                      <span className="text-sm font-bold text-[#06B6D4]">
                        {coin.symbol.charAt(0)}
                      </span>
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
              const tag = item.sentiment === 'positive' ? '热门' : item.sentiment === 'negative' ? '警示' : ''
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
                            tag === '热门'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {tag}
                          </span>
                        )}
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
        <Marquee announcements={data?.announcements} />

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
