'use client'

import { useState, useEffect } from 'react'
import {
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Shield,
  Zap,
  Bot,
  Users,
  Wallet,
  Link2,
  Star,
  ChevronDown,
  ChevronUp,
  Twitter,
  MessageCircle,
  Mail,
  Lock,
  Award,
  Loader2,
} from 'lucide-react'
import Image from 'next/image'
import { useFeaturedStrategies, formatReturn, getRiskDisplay, type Strategy } from '@/hooks/useStrategies'
import { useTranslations } from '@/i18n/provider'

interface LandingPageProps {
  onStartTrading?: () => void
  onWatchDemo?: () => void
  onLogin?: () => void
  onRegister?: () => void
  onViewStrategies?: () => void
}

// 轮播图数据
const carouselSlides = [
  {
    type: 'profit',
    title: '本月收益 +28.5%',
    subtitle: 'AI趋势策略',
    description: '连续6个月正收益，最大回撤仅8%',
    gradient: 'from-emerald-500/20 to-cyan-500/20',
  },
  {
    type: 'security',
    title: '资金安全有保障',
    subtitle: '资金存储在你自己的交易所账户',
    description: 'API无提款权限，银行级加密传输',
    gradient: 'from-blue-500/20 to-purple-500/20',
  },
  {
    type: 'promo',
    title: '新用户专属福利',
    subtitle: '注册即送 $50 体验金',
    description: '零门槛体验AI量化交易',
    gradient: 'from-orange-500/20 to-red-500/20',
  },
  {
    type: 'feature',
    title: '智能交易，自动执行',
    subtitle: '7x24小时不间断运行',
    description: '告别盯盘，让AI帮你赚钱',
    gradient: 'from-cyan-500/20 to-teal-500/20',
  },
]

// 默认策略数据（当 API 未返回时使用）
const defaultStrategies = [
  {
    id: '1',
    name: 'AI趋势跟踪',
    return30d: '15.2',
    subscriberCount: 2847,
    riskLevel: 'medium' as const,
  },
  {
    id: '2',
    name: '稳健网格',
    return30d: '8.7',
    subscriberCount: 4521,
    riskLevel: 'low' as const,
  },
  {
    id: '3',
    name: '波段猎手',
    return30d: '22.4',
    subscriberCount: 1893,
    riskLevel: 'high' as const,
  },
]

// 用户评价数据
const testimonials = [
  {
    avatar: '👨‍💼',
    name: '张**',
    content: '小白也能用，3个月收益翻倍，终于不用天天盯盘了！',
    rating: 5,
  },
  {
    avatar: '👩‍💻',
    name: '李**',
    content: '策略很稳，回撤控制得好，比自己瞎操作强多了。',
    rating: 5,
  },
  {
    avatar: '👨‍🎓',
    name: '王**',
    content: '客服响应很快，遇到问题都能及时解决，推荐！',
    rating: 5,
  },
  {
    avatar: '👩‍🔬',
    name: '陈**',
    content: '用了半年了，整体收益很满意，打算长期使用。',
    rating: 5,
  },
]

// FAQ数据
const faqs = [
  {
    q: '资金安全吗？',
    a: '绝对安全。您的资金始终存储在您自己的交易所账户中，我们只通过API进行交易操作，无法提取您的资金。API权限仅限于交易，不包含提款权限。',
  },
  {
    q: '需要编程知识吗？',
    a: '完全不需要！我们的平台专为非技术用户设计，只需简单几步：注册账号、绑定交易所、选择策略，即可开始自动交易。',
  },
  {
    q: '最低多少钱可以开始？',
    a: '建议最低 $100 起步，以确保策略有足够的资金进行合理的仓位管理。部分策略可能有更高的最低要求，请查看具体策略说明。',
  },
  {
    q: '收益有保障吗？',
    a: '投资有风险，我们无法保证收益。但我们的AI策略基于大量历史数据回测，并有严格的风控机制。建议使用闲置资金，分散投资。',
  },
  {
    q: '支持哪些交易所？',
    a: '目前支持币安(Binance)、OKX、Bybit、Bitget等主流交易所，更多交易所正在接入中。',
  },
]

// 支持的交易所 - 6个主流交易所
const exchanges = [
  { name: 'Binance', logo: '/icons/exchanges/币安.webp' },
  { name: 'OKX', logo: '/icons/exchanges/okx.webp' },
  { name: 'Bybit', logo: '/icons/exchanges/bybit.webp' },
  { name: 'Bitget', logo: '/icons/exchanges/bitget.webp' },
  { name: 'Coinbase', logo: '/icons/exchanges/coinbase.webp' },
  { name: 'Gate', logo: '/icons/exchanges/gate.webp' },
]

export function LandingPage({
  onStartTrading,
  onWatchDemo,
  onLogin,
  onRegister,
  onViewStrategies,
}: LandingPageProps) {
  const t = useTranslations('landing')
  const [isVisible] = useState(true) // 直接初始化为 true
  const [currentSlide, setCurrentSlide] = useState(0)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  // 获取首页推荐策略
  const { data: strategiesData, isLoading: strategiesLoading } = useFeaturedStrategies()

  // 创建翻译后的默认策略
  const translatedDefaultStrategies = [
    { ...defaultStrategies[0], name: t('defaultStrategies.aiTrend') },
    { ...defaultStrategies[1], name: t('defaultStrategies.stableGrid') },
    { ...defaultStrategies[2], name: t('defaultStrategies.swingHunter') },
  ]
  const featuredStrategies = strategiesData && strategiesData.length > 0 ? strategiesData : translatedDefaultStrategies

  // 翻译后的轮播数据
  const carouselSlidesTranslated = [
    {
      type: 'profit',
      title: t('carousel.profitTitle'),
      subtitle: t('carousel.profitSubtitle'),
      description: t('carousel.profitDesc'),
      gradient: 'from-emerald-500/20 to-cyan-500/20',
    },
    {
      type: 'security',
      title: t('carousel.securityTitle'),
      subtitle: t('carousel.securitySubtitle'),
      description: t('carousel.securityDesc'),
      gradient: 'from-blue-500/20 to-purple-500/20',
    },
    {
      type: 'promo',
      title: t('carousel.promoTitle'),
      subtitle: t('carousel.promoSubtitle'),
      description: t('carousel.promoDesc'),
      gradient: 'from-orange-500/20 to-red-500/20',
    },
    {
      type: 'feature',
      title: t('carousel.featureTitle'),
      subtitle: t('carousel.featureSubtitle'),
      description: t('carousel.featureDesc'),
      gradient: 'from-cyan-500/20 to-teal-500/20',
    },
  ]

  // 翻译后的用户评价
  const testimonialsTranslated = [
    { avatar: '👨‍💼', name: t('testimonials.user1Name'), content: t('testimonials.user1Content'), rating: 5 },
    { avatar: '👩‍💻', name: t('testimonials.user2Name'), content: t('testimonials.user2Content'), rating: 5 },
    { avatar: '👨‍🎓', name: t('testimonials.user3Name'), content: t('testimonials.user3Content'), rating: 5 },
    { avatar: '👩‍🔬', name: t('testimonials.user4Name'), content: t('testimonials.user4Content'), rating: 5 },
  ]

  // 翻译后的FAQ
  const faqsTranslated = [
    { q: t('faqItems.q1'), a: t('faqItems.a1') },
    { q: t('faqItems.q2'), a: t('faqItems.a2') },
    { q: t('faqItems.q3'), a: t('faqItems.a3') },
    { q: t('faqItems.q4'), a: t('faqItems.a4') },
    { q: t('faqItems.q5'), a: t('faqItems.a5') },
  ]

  // 轮播自动播放
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlidesTranslated.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [carouselSlidesTranslated.length])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlidesTranslated.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlidesTranslated.length) % carouselSlidesTranslated.length)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] overflow-hidden">
      {/* 1. Hero 区域 */}
      <section className="relative min-h-[70vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
          <div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse"
            style={{ animationDelay: '1s' }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[200px] opacity-5" />
        </div>

        <div
          className={`relative z-10 text-center max-w-5xl mx-auto transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-[#06B6D4]/10 backdrop-blur-sm border border-[#06B6D4]/20 mb-8">
            <Bot className="w-4 h-4 text-[#06B6D4] mr-2" />
            <span className="text-sm text-[#06B6D4]">{t('aiQuantTrading')}</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-[#F8F8FC] to-[#06B6D4] bg-clip-text text-transparent">
              {t('useAiStrategy')}
            </span>
            <span className="block text-[#06B6D4] mt-2">{t('makeTradeSimple')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[#9090A0] mb-8 max-w-2xl mx-auto leading-relaxed">
            {t('heroSubtitle1')}
            <br />
            {t('heroSubtitle2')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <button
              type="button"
              onClick={onRegister || onStartTrading}
              className="group px-8 py-4 bg-gradient-to-r from-[#06B6D4] to-cyan-400 hover:from-cyan-400 hover:to-[#06B6D4] rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center text-black shadow-lg shadow-[#06B6D4]/25"
            >
              {t('startFree')}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              type="button"
              onClick={onLogin || onWatchDemo}
              className="px-8 py-4 bg-[#F8F8FC]/5 hover:bg-[#F8F8FC]/10 backdrop-blur-sm border border-[#F8F8FC]/20 rounded-xl font-semibold transition-all duration-300"
            >
              {t('watchDemo')}
            </button>
          </div>

          {/* Exchange Logos */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <span className="text-sm text-[#606070]">{t('supportedExchanges')}</span>
            {exchanges.map((exchange) => (
              <div
                key={exchange.name}
                className="w-10 h-10 rounded-xl overflow-hidden bg-[#1E1E2E] flex items-center justify-center hover:scale-110 transition-transform"
                title={exchange.name}
              >
                <Image
                  src={exchange.logo}
                  alt={exchange.name}
                  width={40}
                  height={40}
                  className="w-full h-full object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. 社会证明轮播 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Carousel Container */}
            <div className="overflow-hidden rounded-2xl">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {carouselSlidesTranslated.map((slide, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-2">
                    <div
                      className={`p-8 sm:p-12 rounded-2xl bg-gradient-to-br ${slide.gradient} backdrop-blur-xl border border-[#1E1E2E]`}
                    >
                      <div className="text-center">
                        {slide.type === 'profit' && (
                          <TrendingUp className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                        )}
                        {slide.type === 'security' && (
                          <Shield className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                        )}
                        {slide.type === 'promo' && (
                          <Award className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                        )}
                        {slide.type === 'feature' && (
                          <Zap className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                        )}
                        <h3 className="text-3xl sm:text-4xl font-bold text-[#F8F8FC] mb-2">
                          {slide.title}
                        </h3>
                        <p className="text-lg text-[#06B6D4] mb-2">{slide.subtitle}</p>
                        <p className="text-[#9090A0]">{slide.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            <button
              type="button"
              onClick={prevSlide}
              aria-label={t('prevSlide')}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 p-2 rounded-full bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label={t('nextSlide')}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 p-2 rounded-full bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/50 transition-colors"
            >
              <ArrowRight className="w-5 h-5 text-[#9090A0]" />
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {carouselSlidesTranslated.map((_, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  aria-label={t('switchToSlide', { n: index + 1 })}
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentSlide === index
                      ? 'w-6 bg-[#06B6D4]'
                      : 'bg-[#1E1E2E] hover:bg-[#2A2A3A]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. 三步入门流程 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[#F8F8FC] to-[#06B6D4] bg-clip-text text-transparent">
                {t('threeSteps')}
              </span>
            </h2>
            <p className="text-[#9090A0]">{t('stepsSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: Users,
                title: t('step1Title'),
                description: t('step1Desc'),
              },
              {
                step: '02',
                icon: Link2,
                title: t('step2Title'),
                description: t('step2Desc'),
              },
              {
                step: '03',
                icon: TrendingUp,
                title: t('step3Title'),
                description: t('step3Desc'),
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="p-6 rounded-2xl bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] hover:border-[#06B6D4]/30 transition-all text-center">
                  <div className="w-14 h-14 bg-gradient-to-r from-[#06B6D4] to-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold text-black">
                    {item.step}
                  </div>
                  <item.icon className="w-8 h-8 text-[#06B6D4] mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-[#F8F8FC] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#9090A0]">{item.description}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-[#06B6D4] to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. 策略亮点卡片 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[#F8F8FC] to-[#06B6D4] bg-clip-text text-transparent">
                {t('starStrategies')}
              </span>
            </h2>
            <p className="text-[#9090A0]">{t('selectQualityStrategies')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {strategiesLoading ? (
              <div className="col-span-3 flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-[#06B6D4] animate-spin" />
              </div>
            ) : (
              featuredStrategies.map((strategy) => {
                const risk = getRiskDisplay(strategy.riskLevel)
                const returnValue = formatReturn(strategy.return30d)
                return (
                  <div
                    key={strategy.id}
                    className="p-6 rounded-2xl bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] hover:border-[#06B6D4]/30 hover:shadow-[0_0_40px_rgba(6,182,212,0.1)] transition-all duration-300 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-[#F8F8FC]">
                        {strategy.name}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-full bg-[#1E1E2E] ${risk.color}`}>
                        {risk.label}{t('riskSuffix')}
                      </span>
                    </div>
                    <div className="text-3xl font-bold text-emerald-400 mb-4">
                      {returnValue}
                    </div>
                    <div className="flex items-center justify-between text-sm text-[#9090A0]">
                      <span>{t('return30d')}</span>
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {(strategy.subscriberCount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onViewStrategies}
              className="inline-flex items-center text-[#06B6D4] hover:text-cyan-300 transition-colors"
            >
              {t('viewMoreStrategies')}
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </section>

      {/* 5. 信任背书区 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#0D0D14]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[#F8F8FC] to-[#06B6D4] bg-clip-text text-transparent">
                {t('safeTrust')}
              </span>
            </h2>
          </div>

          {/* Exchange Logos */}
          <div className="flex items-center justify-center gap-6 flex-wrap mb-12">
            <span className="text-sm text-[#606070] w-full text-center mb-4">
              {t('supportMainExchanges')}
            </span>
            {exchanges.map((exchange) => (
              <div
                key={exchange.name}
                className="w-14 h-14 rounded-xl overflow-hidden bg-[#1E1E2E] flex items-center justify-center hover:scale-110 transition-transform"
                title={exchange.name}
              >
                <Image
                  src={exchange.logo}
                  alt={exchange.name}
                  width={56}
                  height={56}
                  className="w-full h-full object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
          </div>

          {/* Security Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: t('apiNoWithdraw'),
                description: t('apiNoWithdrawDesc'),
              },
              {
                icon: Wallet,
                title: t('fundsInYourAccount'),
                description: t('fundsInYourAccountDesc'),
              },
              {
                icon: Shield,
                title: t('bankEncryption'),
                description: t('bankEncryptionDesc'),
              },
            ].map((item, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-[#12121A]/50 border border-[#1E1E2E] text-center"
              >
                <item.icon className="w-10 h-10 text-[#06B6D4] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[#F8F8FC] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[#9090A0]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. 用户评价 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[#F8F8FC] to-[#06B6D4] bg-clip-text text-transparent">
                {t('userReviews')}
              </span>
            </h2>
            <p className="text-[#9090A0]">{t('listenToThem')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonialsTranslated.map((item, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#1E1E2E] flex items-center justify-center text-2xl">
                    {item.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-[#F8F8FC]">{item.name}</div>
                    <div className="flex">
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 text-yellow-400 fill-yellow-400"
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[#9090A0] leading-relaxed">&ldquo;{item.content}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#0D0D14]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[#F8F8FC] to-[#06B6D4] bg-clip-text text-transparent">
                {t('faq')}
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqsTranslated.map((faq, index) => (
              <div
                key={index}
                className="rounded-xl bg-[#12121A]/80 border border-[#1E1E2E] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="font-semibold text-[#F8F8FC]">{faq.q}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-[#06B6D4]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#9090A0]" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-4 text-[#9090A0] leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. 底部 CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-10 rounded-3xl bg-gradient-to-r from-[#06B6D4]/10 to-cyan-400/5 backdrop-blur-xl border border-[#06B6D4]/20">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#F8F8FC]">
              {t('readyToStart')}
            </h2>
            <p className="text-lg text-[#9090A0] mb-8 max-w-2xl mx-auto">
              {t('joinThousands')}
            </p>
            <button
              type="button"
              onClick={onRegister}
              className="px-8 py-4 bg-gradient-to-r from-[#06B6D4] to-cyan-400 hover:from-cyan-400 hover:to-[#06B6D4] rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 text-black shadow-lg shadow-[#06B6D4]/25"
            >
              {t('registerNow')}
            </button>
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[#1E1E2E]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-lg font-semibold text-[#F8F8FC] mb-4">{t('product')}</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('strategyMarket')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('pricing')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    API
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-[#F8F8FC] mb-4">{t('aboutUs')}</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('team')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('blog')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('joinUsLink')}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-[#F8F8FC] mb-4">{t('support')}</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('helpCenter')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('contactUs')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('serviceStatus')}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-[#F8F8FC] mb-4">{t('legal')}</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('privacy')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('terms')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    {t('security')}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-[#1E1E2E]">
            <div className="flex items-center mb-4 md:mb-0">
              <Image
                src="/icons/hoot/logo.png"
                alt="Hoot"
                width={32}
                height={32}
                className="mr-2 object-contain"
              />
              <span className="text-xl font-bold text-[#F8F8FC]">Hoot</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="p-2 rounded-lg bg-[#1E1E2E] hover:bg-[#2A2A3A] transition-colors"
              >
                <Twitter className="w-5 h-5 text-[#9090A0]" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-[#1E1E2E] hover:bg-[#2A2A3A] transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-[#9090A0]" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-[#1E1E2E] hover:bg-[#2A2A3A] transition-colors"
              >
                <Mail className="w-5 h-5 text-[#9090A0]" />
              </a>
            </div>
          </div>

          <div className="text-center mt-8 text-sm text-[#606070]">
            © 2024 Hoot. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  )
}
