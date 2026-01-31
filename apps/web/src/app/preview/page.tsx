'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Monitor, Smartphone, Home, TrendingUp, Wallet, User, BarChart3 } from 'lucide-react'
// Desktop components
import { SettingsPage } from '@/components/ui-v3/settings/settings-page'
import { LandingPage } from '@/components/ui-v3/landing/landing-page'
import { LoginPage } from '@/components/ui-v3/auth/login-page'
import { RegisterPage } from '@/components/ui-v3/auth/register-page'
import { WalletConnectModal } from '@/components/ui-v3/auth/wallet-connect-modal'
import { DashboardV3 } from '@/components/ui-v3/dashboard/dashboard-v3'
import { StrategyMarketplaceV3 } from '@/components/ui-v3/strategies/strategy-marketplace-v3'
import { StrategyDetailPage } from '@/components/ui-v3/strategies/strategy-detail-page'
// MyStrategiesPage 已合并到 PositionsPageV3 的"策略管理"Tab
import { PositionsPageV3 } from '@/components/ui-v3/positions/positions-page-v3'
import { EcosystemPageV3 } from '@/components/ui-v3/ecosystem/ecosystem-page-v3'
import { ProfilePageV3 } from '@/components/ui-v3/me/profile-page-v3'
import { WalletPageV3 } from '@/components/ui-v3/wallet/wallet-page-v3'
import { ApiKeysPage } from '@/components/ui-v3/wallet/api-keys-page'
import { DepositPage } from '@/components/ui-v3/wallet/deposit-page'
import { WithdrawPage } from '@/components/ui-v3/wallet/withdraw-page'
import { ExchangePage } from '@/components/ui-v3/wallet/exchange-page'
import { ReferralPageV3 } from '@/components/ui-v3/referral/referral-page-v3'
// Strategy creation components
import { StrategyCreatorPage } from '@/components/ui-v3/strategies/strategy-creator-page'
import { StrategyConfigPage } from '@/components/ui-v3/strategies/strategy-config-page'
import { StrategySubscribeModal } from '@/components/ui-v3/strategies/strategy-subscribe-modal'
// New pages
import { SubscriptionPage } from '@/components/ui-v3/subscription/subscription-page'
import { HelpCenterPage } from '@/components/ui-v3/help/help-center-page'
import { AboutPage } from '@/components/ui-v3/about/about-page'
import { NotificationsPage } from '@/components/ui-v3/notifications/notifications-page'
// Mobile components
import { MobileDashboardV3 } from '@/components/ui-v3/mobile/mobile-dashboard-v3'
import { MobileStrategiesV3 } from '@/components/ui-v3/mobile/mobile-strategies-v3'
import { MobileTradingCenter } from '@/components/ui-v3/mobile/mobile-trading-center'
import { MobileStrategyDetail } from '@/components/ui-v3/mobile/mobile-strategy-detail'
import { MobileStrategyConfig } from '@/components/ui-v3/mobile/mobile-strategy-config'
import { MobileEcosystemV3 } from '@/components/ui-v3/mobile/mobile-ecosystem-v3'
// Legacy mobile components - replaced by V0 generated versions
// import { MobileProfileV3 } from '@/components/ui-v3/mobile/mobile-profile-v3'
// import { MobileWalletV3 } from '@/components/ui-v3/mobile/mobile-wallet-v3'
// import { MobileReferralV3 } from '@/components/ui-v3/mobile/mobile-referral-v3'
// import { MobileSettingsV3 } from '@/components/ui-v3/mobile/mobile-settings-v3'
import { MobileStrategyCreator } from '@/components/ui-v3/mobile/mobile-strategy-creator'
import { MobileNav } from '@/components/ui-v3/mobile/mobile-nav'
// New mobile wallet pages
import { MobileWalletPage } from '@/components/ui-v3/mobile/mobile-wallet-page'
import { MobileDepositPage } from '@/components/ui-v3/mobile/mobile-deposit-page'
import { MobileWithdrawPage } from '@/components/ui-v3/mobile/mobile-withdraw-page'
import { MobileExchangePage } from '@/components/ui-v3/mobile/mobile-exchange-page'
// New mobile auth and subscription pages
import { MobileLoginPage } from '@/components/ui-v3/mobile/mobile-login-page'
import { MobileRegisterPage } from '@/components/ui-v3/mobile/mobile-register-page'
import { MobileSubscriptionPage } from '@/components/ui-v3/mobile/mobile-subscription-page'
// New mobile profile, referral, settings pages (V0 generated)
import { MobileProfilePage } from '@/components/ui-v3/mobile/mobile-profile-page'
import { MobileReferralPage } from '@/components/ui-v3/mobile/mobile-referral-page'
import { MobileSettingsPage } from '@/components/ui-v3/mobile/mobile-settings-page'
// New mobile notifications, about, help pages (V0 generated)
import { MobileNotificationsPage } from '@/components/ui-v3/mobile/mobile-notifications-page'
import { MobileAboutPage } from '@/components/ui-v3/mobile/mobile-about-page'
import { MobileHelpPage } from '@/components/ui-v3/mobile/mobile-help-page'
// Wallet connect modals
import { MobileWalletConnectModal } from '@/components/ui-v3/mobile/mobile-wallet-connect-modal'

// Sidebar navigation configuration - 5 tabs only
const sidebarNavItems = [
  { id: 'dashboard', label: '首页', icon: Home, pageIds: ['dashboard'] },
  { id: 'strategy-market', label: '策略', icon: TrendingUp, pageIds: ['strategy-market', 'strategy-detail', 'strategy-config', 'strategy-creator'] },
  { id: 'trading', label: '交易', icon: BarChart3, pageIds: ['trading'] },
  { id: 'wallet', label: '资产', icon: Wallet, pageIds: ['wallet', 'exchange', 'api-keys', 'deposit', 'withdraw'] },
  { id: 'profile', label: '我的', icon: User, pageIds: ['profile', 'referral', 'settings', 'ecosystem', 'subscription', 'help', 'about', 'notifications'] },
]

// Pages that need sidebar (user pages, not public pages)
const pagesWithSidebar = [
  'dashboard', 'strategy-market', 'strategy-detail', 'trading',
  'ecosystem', 'profile', 'wallet', 'exchange', 'api-keys', 'deposit', 'withdraw',
  'referral', 'strategy-config', 'strategy-creator', 'settings', 'subscription',
  'help', 'about', 'notifications'
]

type PreviewPage =
  | 'landing'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'strategy-market'
  | 'strategy-detail'
  | 'trading'
  | 'ecosystem'
  | 'profile'
  | 'wallet'
  | 'exchange'
  | 'api-keys'
  | 'deposit'
  | 'withdraw'
  | 'referral'
  | 'strategy-config'
  | 'strategy-creator'
  | 'settings'
  | 'subscription'
  | 'help'
  | 'about'
  | 'notifications'

// 移动端 Tab 映射
type MobileTab = 'home' | 'strategies' | 'trading' | 'assets' | 'me'

const mobileTabToPage: Record<MobileTab, PreviewPage> = {
  home: 'dashboard',
  strategies: 'strategy-market',
  trading: 'trading',
  assets: 'wallet',
  me: 'profile',
}

const pageToMobileTab: Partial<Record<PreviewPage, MobileTab>> = {
  dashboard: 'home',
  'strategy-market': 'strategies',
  'strategy-detail': 'strategies',
  'strategy-config': 'strategies',
  'strategy-creator': 'strategies',
  trading: 'trading',
  wallet: 'assets',
  deposit: 'assets',
  withdraw: 'assets',
  exchange: 'assets',
  profile: 'me',
  referral: 'me',
  settings: 'me',
  ecosystem: 'me',
}

export default function PreviewPage() {
  const [currentPage, setCurrentPage] = useState<PreviewPage>('landing')
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [walletModalMode, setWalletModalMode] = useState<'login' | 'register'>('login')

  // 移动端 Tab 切换处理
  const handleMobileTabChange = (tab: MobileTab) => {
    setCurrentPage(mobileTabToPage[tab])
  }

  // 获取当前移动端激活的 Tab
  const currentMobileTab: MobileTab = pageToMobileTab[currentPage] || 'home'

  const pages: { id: PreviewPage; name: string; category: string; hasMobile?: boolean }[] = [
    // 公开页面
    { id: 'landing', name: 'Landing', category: '公开' },
    { id: 'login', name: '登录', category: '公开', hasMobile: true },
    { id: 'register', name: '注册', category: '公开', hasMobile: true },
    // 核心页面 (5个底部Tab对应)
    { id: 'dashboard', name: '首页', category: '核心', hasMobile: true },
    { id: 'strategy-market', name: '策略', category: '核心', hasMobile: true },
    { id: 'trading', name: '交易', category: '核心', hasMobile: true },
    { id: 'wallet', name: '资产', category: '核心', hasMobile: true },
    { id: 'profile', name: '我的', category: '核心', hasMobile: true },
    // 策略相关
    { id: 'strategy-detail', name: '策略详情', category: '策略', hasMobile: true },
    { id: 'strategy-config', name: '策略配置', category: '策略', hasMobile: true },
    { id: 'strategy-creator', name: '创建策略', category: '策略', hasMobile: true },
    // 资产相关
    { id: 'exchange', name: '兑换', category: '资产', hasMobile: true },
    { id: 'api-keys', name: 'API Keys', category: '资产' },
    { id: 'deposit', name: '充值', category: '资产', hasMobile: true },
    { id: 'withdraw', name: '提现', category: '资产', hasMobile: true },
    { id: 'ecosystem', name: '生态', category: '资产', hasMobile: true },
    // 其他页面
    { id: 'referral', name: '邀请', category: '更多', hasMobile: true },
    { id: 'settings', name: '设置', category: '更多', hasMobile: true },
    { id: 'subscription', name: '会员', category: '更多', hasMobile: true },
    { id: 'help', name: '帮助', category: '更多', hasMobile: true },
    { id: 'about', name: '关于', category: '更多', hasMobile: true },
    { id: 'notifications', name: '公告', category: '更多', hasMobile: true },
  ]

  const categories = ['公开', '核心', '策略', '资产', '更多']
  const currentPageInfo = pages.find(p => p.id === currentPage)

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Page Selector */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#12121A]/95 backdrop-blur-xl border-b border-[#2A2A3A] p-3">
        <div className="flex items-center gap-4 overflow-x-auto">
          <span className="text-cyan-400 text-sm font-bold whitespace-nowrap px-2">
            Hoot 预览
          </span>
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-[#1E1E2E] rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('desktop')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'desktop'
                  ? 'bg-cyan-500 text-black'
                  : 'text-[#9090A0] hover:text-white'
              }`}
              title="桌面端"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mobile')}
              disabled={!currentPageInfo?.hasMobile}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'mobile'
                  ? 'bg-cyan-500 text-black'
                  : currentPageInfo?.hasMobile
                    ? 'text-[#9090A0] hover:text-white'
                    : 'text-[#404050] cursor-not-allowed'
              }`}
              title={currentPageInfo?.hasMobile ? '移动端' : '此页面无移动端版本'}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          <div className="h-6 w-px bg-[#2A2A3A]" />
          {categories.map((category) => (
            <div key={category} className="flex items-center gap-2">
              <span className="text-[#606070] text-xs whitespace-nowrap">{category}:</span>
              {pages
                .filter((p) => p.category === category)
                .map((page) => (
                  <button
                    type="button"
                    key={page.id}
                    onClick={() => setCurrentPage(page.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                      currentPage === page.id
                        ? 'bg-cyan-500 text-black font-medium shadow-lg shadow-cyan-500/25'
                        : 'bg-[#1E1E2E] text-[#9090A0] hover:text-[#F8F8FC] hover:bg-[#2A2A3A]'
                    }`}
                  >
                    {page.name}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="pt-14">
        {/* Mobile Preview Container */}
        {viewMode === 'mobile' && currentPageInfo?.hasMobile ? (
          <div className="flex justify-center py-8 bg-[#0A0A0F]">
            <div className="relative">
              {/* Phone Frame */}
              <div className="w-[390px] h-[844px] bg-[#1A1A1A] rounded-[50px] p-3 shadow-2xl border-4 border-[#2A2A2A]">
                {/* Notch */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-full z-10" />
                {/* Screen - transform-gpu creates new containing block for fixed modals */}
                <div className="w-full h-full bg-[#0A0A0F] rounded-[40px] overflow-hidden relative transform-gpu">
                  {/* 内容区域 - 底部留出导航栏空间 */}
                  <div className="h-[calc(100%-70px)] overflow-y-auto pb-2">
                    {currentPage === 'login' && (
                      <MobileLoginPage
                        onLogin={(email) => console.log('登录:', email)}
                        onWalletConnect={() => {
                          setWalletModalMode('login')
                          setShowWalletModal(true)
                        }}
                        onRegister={() => setCurrentPage('register')}
                        onForgotPassword={() => console.log('忘记密码')}
                      />
                    )}
                    {currentPage === 'register' && (
                      <MobileRegisterPage
                        onRegister={(data) => console.log('注册:', data)}
                        onWalletConnect={() => {
                          setWalletModalMode('register')
                          setShowWalletModal(true)
                        }}
                        onLogin={() => setCurrentPage('login')}
                      />
                    )}
                    {currentPage === 'dashboard' && <MobileDashboardV3 />}
                    {currentPage === 'strategy-market' && (
                      <MobileStrategiesV3
                        onStrategyClick={() => setCurrentPage('strategy-detail')}
                        onUseStrategy={(id) => {
                          console.log('配置策略:', id)
                          setCurrentPage('strategy-config')
                        }}
                        onCreateStrategy={() => setCurrentPage('strategy-creator')}
                      />
                    )}
                    {currentPage === 'strategy-detail' && (
                      <MobileStrategyDetail
                        onBack={() => setCurrentPage('strategy-market')}
                        onUseStrategy={(id) => {
                          console.log('使用策略:', id)
                          setCurrentPage('strategy-config')
                        }}
                      />
                    )}
                    {currentPage === 'trading' && <MobileTradingCenter />}
                    {currentPage === 'ecosystem' && <MobileEcosystemV3 />}
                    {currentPage === 'profile' && (
                      <MobileProfilePage
                        onNavigate={(path) => {
                          if (path === '/subscription') setCurrentPage('subscription')
                          else if (path === '/referral') setCurrentPage('referral')
                          else if (path === '/notifications') setCurrentPage('notifications')
                          else if (path === '/settings') setCurrentPage('settings')
                          else if (path === '/help') setCurrentPage('help')
                          else if (path === '/about') setCurrentPage('about')
                          else console.log('导航到:', path)
                        }}
                        onLogout={() => setCurrentPage('login')}
                      />
                    )}
                    {currentPage === 'wallet' && (
                      <MobileWalletPage
                        onNavigate={(path) => {
                          if (path === '/deposit') setCurrentPage('deposit')
                          else if (path === '/withdraw') setCurrentPage('withdraw')
                          else if (path === '/exchange') setCurrentPage('exchange')
                        }}
                      />
                    )}
                    {currentPage === 'deposit' && (
                      <MobileDepositPage onBack={() => setCurrentPage('wallet')} />
                    )}
                    {currentPage === 'withdraw' && (
                      <MobileWithdrawPage onBack={() => setCurrentPage('wallet')} />
                    )}
                    {currentPage === 'exchange' && (
                      <MobileExchangePage onBack={() => setCurrentPage('wallet')} />
                    )}
                    {currentPage === 'referral' && (
                      <MobileReferralPage onBack={() => setCurrentPage('profile')} />
                    )}
                    {currentPage === 'strategy-config' && (
                      <MobileStrategyConfig
                        strategyName="MACD 趋势跟踪策略"
                        onBack={() => setCurrentPage('strategy-market')}
                        onSave={(config) => {
                          console.log('保存配置:', config)
                          setCurrentPage('trading')
                        }}
                        onCancel={() => setCurrentPage('strategy-market')}
                      />
                    )}
                    {currentPage === 'settings' && (
                      <MobileSettingsPage onBack={() => setCurrentPage('profile')} />
                    )}
                    {currentPage === 'subscription' && (
                      <MobileSubscriptionPage
                        currentTier="basic"
                        onSubscribe={(tierId) => console.log('订阅:', tierId)}
                        onBack={() => setCurrentPage('profile')}
                      />
                    )}
                    {currentPage === 'help' && (
                      <MobileHelpPage onBack={() => setCurrentPage('profile')} />
                    )}
                    {currentPage === 'about' && (
                      <MobileAboutPage onBack={() => setCurrentPage('profile')} />
                    )}
                    {currentPage === 'notifications' && (
                      <MobileNotificationsPage onBack={() => setCurrentPage('profile')} />
                    )}
                    {currentPage === 'strategy-creator' && (
                      <MobileStrategyCreator
                        onBack={() => setCurrentPage('strategy-market')}
                        onSave={(data) => {
                          console.log('保存策略:', data)
                          setCurrentPage('strategy-market')
                        }}
                      />
                    )}
                  </div>
                  {/* 移动端底部导航栏 - 嵌入手机框内 */}
                  <div className="absolute bottom-0 left-0 right-0 rounded-b-[40px] overflow-hidden">
                    <MobileNav
                      activeTab={currentMobileTab}
                      onTabChange={handleMobileTabChange}
                      embedded={true}
                    />
                  </div>
                  {/* 钱包连接弹窗 - 嵌入手机框内 */}
                  {showWalletModal && (
                    <MobileWalletConnectModal
                      isOpen={showWalletModal}
                      onClose={() => setShowWalletModal(false)}
                      onConnect={async (walletId) => {
                        console.log('连接钱包:', walletId)
                        await new Promise(resolve => setTimeout(resolve, 1500))
                        setShowWalletModal(false)
                        setCurrentPage('dashboard')
                      }}
                      mode={walletModalMode}
                      embedded={true}
                    />
                  )}
                </div>
              </div>
              {/* Home Indicator */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
            </div>
          </div>
        ) : (
          /* Desktop View */
          <div className="flex">
            {/* Sidebar - only show for user pages */}
            {pagesWithSidebar.includes(currentPage) && (
              <div className="fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-60 bg-[#12121A] border-r border-[#1E1E2E] z-40">
                {/* Logo */}
                <div className="flex h-16 items-center justify-center gap-2 border-b border-[#1E1E2E]">
                  <Image src="/icons/hoot/logo.png" alt="Hoot" width={32} height={32} className="object-contain" />
                  <h1 className="text-2xl font-bold text-[#F8F8FC]">Hoot</h1>
                </div>

                {/* Navigation Items */}
                <nav className="flex flex-col gap-2 p-4">
                  {sidebarNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = item.pageIds.includes(currentPage)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentPage(item.id as PreviewPage)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 group ${
                          isActive
                            ? 'bg-[#1E1E2E] text-[#F8F8FC] border border-[#2A2A3A]'
                            : 'hover:bg-[#1E1E2E]/50'
                        }`}
                      >
                        <Icon
                          size={20}
                          className={`transition-colors duration-200 ${
                            isActive
                              ? 'text-cyan-400'
                              : 'text-[#9090A0] group-hover:text-[#F8F8FC]'
                          }`}
                        />
                        <span
                          className={`font-medium transition-colors duration-200 ${
                            isActive
                              ? 'text-white'
                              : 'text-[#F8F8FC] group-hover:text-white'
                          }`}
                        >
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </nav>

                {/* Bottom Section */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1E1E2E]">
                  <div className="text-xs text-center text-[#9090A0]">
                    © 2026 Hoot
                  </div>
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className={pagesWithSidebar.includes(currentPage) ? 'ml-60 flex-1' : 'flex-1'}>
              {currentPage === 'landing' && (
                <LandingPage
                  onStartTrading={() => setCurrentPage('register')}
                  onWatchDemo={() => setCurrentPage('login')}
                  onLogin={() => setCurrentPage('login')}
                  onRegister={() => setCurrentPage('register')}
                />
              )}
              {currentPage === 'login' && (
                <LoginPage
                  onLogin={(email, password) => console.log('登录:', email, password)}
                  onWalletConnect={() => {
                    setWalletModalMode('login')
                    setShowWalletModal(true)
                  }}
                  onRegister={() => setCurrentPage('register')}
                  onForgotPassword={() => console.log('忘记密码')}
                />
              )}
              {currentPage === 'register' && (
                <RegisterPage
                  onRegister={(data) => console.log('注册:', data)}
                  onWalletConnect={() => {
                    setWalletModalMode('register')
                    setShowWalletModal(true)
                  }}
                  onLogin={() => setCurrentPage('login')}
                />
              )}
              {currentPage === 'dashboard' && (
                <DashboardV3
                  onNavigate={(path) => setCurrentPage(path as PreviewPage)}
                />
              )}
              {currentPage === 'strategy-market' && (
                <StrategyMarketplaceV3
                  onStrategyClick={() => setCurrentPage('strategy-detail')}
                  onSubscribe={() => setShowSubscribeModal(true)}
                  onSearch={(q) => console.log('搜索:', q)}
                  onFilterChange={(f) => console.log('筛选:', f)}
                  onConfigureStrategy={(id) => {
                    console.log('配置策略:', id)
                    setCurrentPage('strategy-config')
                  }}
                  onCreateStrategy={() => setCurrentPage('strategy-creator')}
                  onNavigate={(path) => {
                    // 处理策略配置页面跳转
                    if (path.startsWith('/strategies/config')) {
                      setCurrentPage('strategy-config')
                    } else if (path === '/strategies') {
                      setCurrentPage('strategy-market')
                    } else {
                      console.log('导航到:', path)
                    }
                  }}
                />
              )}
              {currentPage === 'strategy-detail' && (
                <StrategyDetailPage
                  onBack={() => setCurrentPage('strategy-market')}
                  onUseStrategy={() => setShowSubscribeModal(true)}
                />
              )}
              {currentPage === 'trading' && (
                <PositionsPageV3
                  onClosePosition={(id) => console.log('平仓:', id)}
                  onPauseStrategy={(id) => console.log('暂停策略:', id)}
                  onResumeStrategy={(id) => console.log('恢复策略:', id)}
                  onEmergencyCloseAll={() => console.log('紧急全部平仓')}
                  onEditStrategy={(id) => {
                    console.log('编辑策略:', id)
                    setCurrentPage('strategy-config')
                  }}
                  onDeleteStrategy={(id) => console.log('删除策略:', id)}
                  onToggleStrategy={(id, status) => console.log('切换策略状态:', id, status)}
                  onViewMarket={() => setCurrentPage('strategy-market')}
                />
              )}
              {currentPage === 'ecosystem' && (
                <EcosystemPageV3
                  onStake={(amount, period) => console.log('质押:', amount, 'HOOT,', period, '天')}
                  onUnstake={(id) => console.log('解押记录:', id)}
                  onClaimRewards={() => console.log('领取奖励')}
                />
              )}
              {currentPage === 'profile' && (
                <ProfilePageV3
                  onNavigate={(path) => {
                    if (path === '/subscription') setCurrentPage('subscription')
                    else if (path === '/referral') setCurrentPage('referral')
                    else if (path === '/settings') setCurrentPage('settings')
                    else if (path === '/ecosystem') setCurrentPage('ecosystem')
                    else if (path === '/wallet') setCurrentPage('wallet')
                    else console.log('导航到:', path)
                  }}
                  onLogout={() => setCurrentPage('login')}
                />
              )}
              {currentPage === 'wallet' && (
                <WalletPageV3
                  onDeposit={() => setCurrentPage('deposit')}
                  onWithdraw={() => setCurrentPage('withdraw')}
                  onExchange={() => setCurrentPage('exchange')}
                  onGoToEcosystem={() => setCurrentPage('ecosystem')}
                  onAddExchange={() => setCurrentPage('api-keys')}
                />
              )}
              {currentPage === 'exchange' && <ExchangePage />}
              {currentPage === 'api-keys' && <ApiKeysPage />}
              {currentPage === 'deposit' && <DepositPage />}
              {currentPage === 'withdraw' && <WithdrawPage />}
              {currentPage === 'referral' && (
                <ReferralPageV3
                  onShare={(platform) => console.log('分享到:', platform)}
                />
              )}
              {currentPage === 'strategy-config' && (
                <StrategyConfigPage
                  strategyName="MACD 趋势跟踪策略"
                  onBack={() => setCurrentPage('strategy-market')}
                  onSave={(config) => {
                    console.log('保存配置:', config)
                    setCurrentPage('trading')
                  }}
                  onCancel={() => setCurrentPage('strategy-market')}
                />
              )}
              {currentPage === 'strategy-creator' && (
                <StrategyCreatorPage
                  onSave={(config) => {
                    console.log('策略已保存到我的策略:', config)
                    // 保存后不跳转，保持在当前页面
                  }}
                  onNavigate={(path) => {
                    if (path === '/strategies') {
                      setCurrentPage('strategy-market')
                    } else {
                      console.log('导航到:', path)
                    }
                  }}
                />
              )}
              {currentPage === 'settings' && (
                <SettingsPage
                  onNavigate={(path) => {
                    if (path === '/me') setCurrentPage('profile')
                    else console.log('导航到:', path)
                  }}
                  onSettingChange={(key, value) => console.log('设置变更:', key, value)}
                />
              )}
              {currentPage === 'subscription' && (
                <SubscriptionPage
                  onSubscribe={(tierId) => console.log('订阅:', tierId)}
                  onCancel={() => setCurrentPage('profile')}
                />
              )}
              {currentPage === 'help' && (
                <HelpCenterPage
                  onNavigate={(path) => console.log('导航到:', path)}
                  onContactSupport={(method) => console.log('联系支持:', method)}
                />
              )}
              {currentPage === 'about' && (
                <AboutPage
                  onNavigate={(path) => console.log('导航到:', path)}
                />
              )}
              {currentPage === 'notifications' && (
                <NotificationsPage
                  onNavigate={(path) => console.log('导航到:', path)}
                  onMarkAsRead={(id) => console.log('标记已读:', id)}
                  onMarkAllAsRead={() => console.log('全部标记已读')}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 极简策略订阅弹窗 */}
      <StrategySubscribeModal
        isOpen={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        onConfirm={(config) => {
          console.log('订阅配置:', config)
          setShowSubscribeModal(false)
          // 订阅成功后可跳转到交易中心
          setCurrentPage('trading')
        }}
        strategyName="MACD 趋势跟踪策略"
        connectedExchanges={[
          { id: 'binance', name: 'Binance', icon: '/icons/exchanges/币安.webp', balance: 5234.56, status: 'active' },
          { id: 'okx', name: 'OKX', icon: '/icons/exchanges/okx.webp', balance: 1200.00, status: 'active' },
        ]}
        availableBalance={10000}
      />

      {/* 钱包连接弹窗 - 桌面端 */}
      {viewMode === 'desktop' && (
        <WalletConnectModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onConnect={async (walletId) => {
            console.log('连接钱包:', walletId)
            // 模拟连接延迟
            await new Promise(resolve => setTimeout(resolve, 1500))
            setShowWalletModal(false)
            setCurrentPage('dashboard')
          }}
          mode={walletModalMode}
        />
      )}

    </div>
  )
}
