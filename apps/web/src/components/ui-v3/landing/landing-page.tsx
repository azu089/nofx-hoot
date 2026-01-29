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
} from 'lucide-react'
import Image from 'next/image'

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

// 策略亮点数据
const featuredStrategies = [
  {
    name: 'AI趋势跟踪',
    return30d: '+15.2%',
    subscribers: 2847,
    riskLevel: '中',
    riskColor: 'text-yellow-400',
  },
  {
    name: '稳健网格',
    return30d: '+8.7%',
    subscribers: 4521,
    riskLevel: '低',
    riskColor: 'text-green-400',
  },
  {
    name: '波段猎手',
    return30d: '+22.4%',
    subscribers: 1893,
    riskLevel: '高',
    riskColor: 'text-red-400',
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

// 支持的交易所
const exchanges = [
  { name: 'Binance', logo: '/icons/exchanges/币安.png' },
  { name: 'OKX', logo: '/icons/exchanges/okx.png' },
  { name: 'Bybit', logo: '/icons/exchanges/bybit.png' },
  { name: 'Bitget', logo: '/icons/exchanges/bitget.png' },
]

export function LandingPage({
  onStartTrading,
  onWatchDemo,
  onLogin,
  onRegister,
  onViewStrategies,
}: LandingPageProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // 轮播自动播放
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length)
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
            <span className="text-sm text-[#06B6D4]">AI 智能量化交易</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-[#F8F8FC] to-[#06B6D4] bg-clip-text text-transparent">
              用 AI 策略
            </span>
            <span className="block text-[#06B6D4] mt-2">让交易变简单</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[#9090A0] mb-8 max-w-2xl mx-auto leading-relaxed">
            连接你的交易所，选择专业策略
            <br />
            7x24小时自动执行，告别盯盘
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <button
              type="button"
              onClick={onRegister || onStartTrading}
              className="group px-8 py-4 bg-gradient-to-r from-[#06B6D4] to-cyan-400 hover:from-cyan-400 hover:to-[#06B6D4] rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center text-black shadow-lg shadow-[#06B6D4]/25"
            >
              免费开始
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              type="button"
              onClick={onLogin || onWatchDemo}
              className="px-8 py-4 bg-[#F8F8FC]/5 hover:bg-[#F8F8FC]/10 backdrop-blur-sm border border-[#F8F8FC]/20 rounded-xl font-semibold transition-all duration-300"
            >
              查看演示
            </button>
          </div>

          {/* Exchange Logos */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <span className="text-sm text-[#606070]">支持交易所:</span>
            {exchanges.map((exchange) => (
              <div
                key={exchange.name}
                className="w-8 h-8 rounded-lg bg-[#1E1E2E] p-1.5 flex items-center justify-center"
                title={exchange.name}
              >
                <Image
                  src={exchange.logo}
                  alt={exchange.name}
                  width={20}
                  height={20}
                  className="opacity-60 hover:opacity-100 transition-opacity"
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
                {carouselSlides.map((slide, index) => (
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
              aria-label="上一张"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 p-2 rounded-full bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#9090A0]" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="下一张"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 p-2 rounded-full bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/50 transition-colors"
            >
              <ArrowRight className="w-5 h-5 text-[#9090A0]" />
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {carouselSlides.map((_, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`切换到第 ${index + 1} 张`}
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
                三步开始赚钱
              </span>
            </h2>
            <p className="text-[#9090A0]">简单几步，即可开启自动化交易之旅</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: Users,
                title: '注册账号',
                description: '邮箱注册，1分钟完成',
              },
              {
                step: '02',
                icon: Link2,
                title: '绑定交易所',
                description: 'API安全连接，资金始终在你账户',
              },
              {
                step: '03',
                icon: TrendingUp,
                title: '选择策略',
                description: '一键启动，自动执行，开始盈利',
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
                明星策略
              </span>
            </h2>
            <p className="text-[#9090A0]">精选优质策略，助你稳健盈利</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {featuredStrategies.map((strategy, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-[#12121A]/80 backdrop-blur-xl border border-[#1E1E2E] hover:border-[#06B6D4]/30 hover:shadow-[0_0_40px_rgba(6,182,212,0.1)] transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#F8F8FC]">
                    {strategy.name}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded-full bg-[#1E1E2E] ${strategy.riskColor}`}>
                    {strategy.riskLevel}风险
                  </span>
                </div>
                <div className="text-3xl font-bold text-emerald-400 mb-4">
                  {strategy.return30d}
                </div>
                <div className="flex items-center justify-between text-sm text-[#9090A0]">
                  <span>30天收益</span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {strategy.subscribers.toLocaleString()} 订阅
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onViewStrategies}
              className="inline-flex items-center text-[#06B6D4] hover:text-cyan-300 transition-colors"
            >
              查看更多策略
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
                安全可信赖
              </span>
            </h2>
          </div>

          {/* Exchange Logos */}
          <div className="flex items-center justify-center gap-8 flex-wrap mb-12">
            <span className="text-sm text-[#606070] w-full text-center mb-4">
              支持主流交易所
            </span>
            {exchanges.map((exchange) => (
              <div
                key={exchange.name}
                className="w-16 h-16 rounded-xl bg-[#1E1E2E] p-3 flex items-center justify-center hover:bg-[#2A2A3A] transition-colors"
                title={exchange.name}
              >
                <Image
                  src={exchange.logo}
                  alt={exchange.name}
                  width={40}
                  height={40}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
          </div>

          {/* Security Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: 'API 无提款权限',
                description: '仅授权交易权限，资金无法被转移',
              },
              {
                icon: Wallet,
                title: '资金始终在你账户',
                description: '我们不托管任何用户资金',
              },
              {
                icon: Shield,
                title: '银行级加密',
                description: 'AES-256加密传输，数据安全保障',
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
                用户评价
              </span>
            </h2>
            <p className="text-[#9090A0]">听听他们怎么说</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((item, index) => (
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
                <p className="text-[#9090A0] leading-relaxed">"{item.content}"</p>
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
                常见问题
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
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
              准备好开始了吗？
            </h2>
            <p className="text-lg text-[#9090A0] mb-8 max-w-2xl mx-auto">
              加入数千名已经在使用 Hoot 进行自动化交易的用户
            </p>
            <button
              type="button"
              onClick={onRegister}
              className="px-8 py-4 bg-gradient-to-r from-[#06B6D4] to-cyan-400 hover:from-cyan-400 hover:to-[#06B6D4] rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 text-black shadow-lg shadow-[#06B6D4]/25"
            >
              立即免费注册
            </button>
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[#1E1E2E]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-lg font-semibold text-[#F8F8FC] mb-4">产品</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    策略市场
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    定价
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
              <h4 className="text-lg font-semibold text-[#F8F8FC] mb-4">关于我们</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    团队
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    博客
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    加入我们
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-[#F8F8FC] mb-4">支持</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    帮助中心
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    联系我们
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    服务状态
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-[#F8F8FC] mb-4">法律</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    隐私政策
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    服务条款
                  </a>
                </li>
                <li>
                  <a href="#" className="text-[#9090A0] hover:text-[#06B6D4] transition-colors">
                    安全
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
                className="mr-2"
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
