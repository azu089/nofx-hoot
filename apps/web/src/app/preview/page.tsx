'use client'

import { useState } from 'react'
import { Monitor, Smartphone, Home, TrendingUp, Briefcase, Wallet, Layers, User, Settings, Zap, BarChart3 } from 'lucide-react'
// Desktop components
import { StrategyEditPage } from '@/components/ui-v3/strategies/strategy-edit-page'
import { SettingsPage } from '@/components/ui-v3/settings/settings-page'
// TradingConsole and TradingHistory merged into PositionsPageV3 (交易中心)
import { LandingPage } from '@/components/ui-v3/landing/landing-page'
import { LoginPage } from '@/components/ui-v3/auth/login-page'
import { RegisterPage } from '@/components/ui-v3/auth/register-page'
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
import { CreateStrategyModal } from '@/components/ui-v3/strategies/create-strategy-modal'
import { TradingViewWebhookConfig } from '@/components/ui-v3/strategies/tradingview-webhook-config'
import { VisualStrategyBuilder } from '@/components/ui-v3/strategies/visual-strategy-builder'
import { CodeEditor } from '@/components/ui-v3/strategies/code-editor'
import { StrategyCreatorPage } from '@/components/ui-v3/strategies/strategy-creator-page'
import { StrategyConfigPage } from '@/components/ui-v3/strategies/strategy-config-page'
import { StrategySubscribeModal } from '@/components/ui-v3/strategies/strategy-subscribe-modal'
// New pages
import { NotificationsPage } from '@/components/ui-v3/notifications/notifications-page'
import { HelpCenterPage } from '@/components/ui-v3/help/help-center-page'
import { SubscriptionPage } from '@/components/ui-v3/subscription/subscription-page'
import { AboutPage } from '@/components/ui-v3/about/about-page'
// Mobile components
import { MobileDashboardV3 } from '@/components/ui-v3/mobile/mobile-dashboard-v3'
import { MobileStrategiesV3 } from '@/components/ui-v3/mobile/mobile-strategies-v3'
import { MobilePositionsV3 } from '@/components/ui-v3/mobile/mobile-positions-v3'
import { MobileStrategyDetail } from '@/components/ui-v3/mobile/mobile-strategy-detail'
import { MobileStrategyEdit } from '@/components/ui-v3/mobile/mobile-strategy-edit'
import { MobileEcosystemV3 } from '@/components/ui-v3/mobile/mobile-ecosystem-v3'
import { MobileProfileV3 } from '@/components/ui-v3/mobile/mobile-profile-v3'
import { MobileWalletV3 } from '@/components/ui-v3/mobile/mobile-wallet-v3'
import { MobileReferralV3 } from '@/components/ui-v3/mobile/mobile-referral-v3'
import { MobileSettingsV3 } from '@/components/ui-v3/mobile/mobile-settings-v3'

// Sidebar navigation configuration - 5 tabs only
// 注意：my-strategies 已合并到 trading 页面的"策略管理"Tab
const sidebarNavItems = [
  { id: 'dashboard', label: '首页', icon: Home, pageIds: ['dashboard'] },
  { id: 'strategy-market', label: '策略市场', icon: TrendingUp, pageIds: ['strategy-market', 'strategy-detail', 'strategy-edit', 'strategy-config', 'strategy-creator', 'tradingview-config', 'visual-builder', 'code-editor'] },
  { id: 'trading', label: '交易', icon: BarChart3, pageIds: ['trading', 'my-strategies'] },
  { id: 'wallet', label: '资产', icon: Wallet, pageIds: ['wallet', 'exchange', 'api-keys', 'deposit', 'withdraw'] },
  { id: 'profile', label: '我的', icon: User, pageIds: ['profile', 'referral', 'settings', 'ecosystem', 'notifications', 'help', 'subscription', 'about'] },
]

// Pages that need sidebar (user pages, not public pages)
const pagesWithSidebar = [
  'dashboard', 'strategy-market', 'strategy-detail', 'my-strategies', 'trading',
  'ecosystem', 'profile', 'wallet', 'exchange', 'api-keys', 'deposit', 'withdraw',
  'referral', 'strategy-edit', 'strategy-config', 'strategy-creator', 'settings', 'tradingview-config', 'visual-builder', 'code-editor',
  'notifications', 'help', 'subscription', 'about'
]

type PreviewPage =
  | 'landing'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'strategy-market'
  | 'strategy-detail'
  | 'my-strategies'
  | 'trading'
  | 'ecosystem'
  | 'profile'
  | 'wallet'
  | 'exchange'
  | 'api-keys'
  | 'deposit'
  | 'withdraw'
  | 'referral'
  | 'strategy-edit'
  | 'strategy-config'
  | 'strategy-creator'
  | 'settings'
  | 'tradingview-config'
  | 'visual-builder'
  | 'code-editor'
  | 'notifications'
  | 'help'
  | 'subscription'
  | 'about'

export default function PreviewPage() {
  const [currentPage, setCurrentPage] = useState<PreviewPage>('landing')
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)

  const pages: { id: PreviewPage; name: string; category: string; hasMobile?: boolean }[] = [
    { id: 'landing', name: '首页', category: '公开页面' },
    { id: 'login', name: '登录', category: '公开页面' },
    { id: 'register', name: '注册', category: '公开页面' },
    { id: 'dashboard', name: '仪表盘', category: '用户页面', hasMobile: true },
    { id: 'strategy-market', name: '策略市场', category: '用户页面', hasMobile: true },
    { id: 'strategy-detail', name: '策略详情', category: '用户页面', hasMobile: true },
    { id: 'trading', name: '交易中心', category: '用户页面', hasMobile: true },
    { id: 'my-strategies', name: '策略管理(合并)', category: '用户页面' },
    { id: 'ecosystem', name: '生态', category: '用户页面', hasMobile: true },
    { id: 'profile', name: '个人中心', category: '用户页面', hasMobile: true },
    { id: 'wallet', name: '钱包', category: '钱包页面', hasMobile: true },
    { id: 'exchange', name: '资产兑换', category: '钱包页面' },
    { id: 'api-keys', name: 'API Keys', category: '钱包页面' },
    { id: 'deposit', name: '充值', category: '钱包页面' },
    { id: 'withdraw', name: '提现', category: '钱包页面' },
    { id: 'referral', name: '邀请好友', category: '用户页面', hasMobile: true },
    { id: 'strategy-creator', name: '创建策略', category: '策略创建' },
    { id: 'strategy-config', name: '策略配置(新)', category: '策略创建' },
    { id: 'strategy-edit', name: '策略配置(旧)', category: '策略创建', hasMobile: true },
    { id: 'tradingview-config', name: 'TradingView', category: '策略创建' },
    { id: 'visual-builder', name: '可视化搭建', category: '策略创建' },
    { id: 'code-editor', name: '代码编辑器', category: '策略创建' },
    { id: 'settings', name: '设置', category: '功能页面', hasMobile: true },
    { id: 'notifications', name: '通知公告', category: '功能页面' },
    { id: 'help', name: '帮助中心', category: '功能页面' },
    { id: 'subscription', name: '会员订阅', category: '功能页面' },
    { id: 'about', name: '关于', category: '功能页面' },
  ]

  const categories = ['公开页面', '用户页面', '钱包页面', '策略创建', '功能页面']
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
                {/* Screen */}
                <div className="w-full h-full bg-[#0A0A0F] rounded-[40px] overflow-hidden overflow-y-auto">
                  {currentPage === 'dashboard' && <MobileDashboardV3 />}
                  {currentPage === 'strategy-market' && (
                    <MobileStrategiesV3
                      onStrategyClick={() => setCurrentPage('strategy-detail')}
                      onUseStrategy={(id) => {
                        console.log('配置策略:', id)
                        setCurrentPage('strategy-edit')
                      }}
                    />
                  )}
                  {currentPage === 'strategy-detail' && (
                    <MobileStrategyDetail
                      onBack={() => setCurrentPage('strategy-market')}
                      onUseStrategy={(id) => console.log('使用策略:', id)}
                    />
                  )}
                  {currentPage === 'trading' && <MobilePositionsV3 />}
                  {currentPage === 'ecosystem' && <MobileEcosystemV3 />}
                  {currentPage === 'profile' && (
                    <MobileProfileV3
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
                    <MobileWalletV3
                      onDeposit={() => console.log('充值')}
                      onWithdraw={() => console.log('提现')}
                    />
                  )}
                  {currentPage === 'referral' && <MobileReferralV3 />}
                  {currentPage === 'strategy-edit' && (
                    <MobileStrategyEdit
                      strategyName="量化交易策略 Pro"
                      onSave={(config) => console.log('保存配置:', config)}
                      onBack={() => console.log('返回')}
                    />
                  )}
                  {currentPage === 'settings' && (
                    <MobileSettingsV3
                      onLogout={() => console.log('退出登录')}
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
                  <img src="/icons/hoot/logo.png" alt="Hoot" className="w-8 h-8" />
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
                  onWalletConnect={() => console.log('钱包连接')}
                  onRegister={() => setCurrentPage('register')}
                  onForgotPassword={() => console.log('忘记密码')}
                />
              )}
              {currentPage === 'register' && (
                <RegisterPage
                  onRegister={(data) => console.log('注册:', data)}
                  onWalletConnect={() => console.log('钱包注册')}
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
              {/* my-strategies 已合并到 trading 页面的"策略管理"Tab */}
              {currentPage === 'my-strategies' && (
                <PositionsPageV3
                  onClosePosition={(id) => console.log('平仓:', id)}
                  onPauseStrategy={(id) => console.log('暂停策略:', id)}
                  onResumeStrategy={(id) => console.log('恢复策略:', id)}
                  onEmergencyCloseAll={() => console.log('紧急全部平仓')}
                  onEditStrategy={(id) => {
                    console.log('编辑策略:', id)
                    setCurrentPage('strategy-edit')
                  }}
                  onDeleteStrategy={(id) => console.log('删除策略:', id)}
                  onToggleStrategy={(id, status) => console.log('切换策略状态:', id, status)}
                  onViewMarket={() => setCurrentPage('strategy-market')}
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
                    setCurrentPage('strategy-edit')
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
              {currentPage === 'strategy-edit' && (
                <StrategyEditPage
                  strategyName="量化交易策略 Pro"
                  onSave={(config) => console.log('保存配置:', config)}
                  onCancel={() => setCurrentPage('strategy-market')}
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
                    else if (path === '/help') setCurrentPage('help')
                    else if (path === '/about') setCurrentPage('about')
                    else console.log('导航到:', path)
                  }}
                  onSettingChange={(key, value) => console.log('设置变更:', key, value)}
                />
              )}
              {currentPage === 'notifications' && (
                <NotificationsPage
                  onNavigate={(path) => {
                    if (path === '/me') setCurrentPage('profile')
                    else console.log('导航到:', path)
                  }}
                />
              )}
              {currentPage === 'help' && (
                <HelpCenterPage
                  onNavigate={(path) => {
                    if (path === '/me') setCurrentPage('profile')
                    else console.log('导航到:', path)
                  }}
                />
              )}
              {currentPage === 'subscription' && (
                <SubscriptionPage
                  onSubscribe={(tierId) => console.log('订阅:', tierId)}
                  onCancel={() => setCurrentPage('profile')}
                />
              )}
              {currentPage === 'about' && (
                <AboutPage
                  onNavigate={(path) => {
                    if (path === '/me') setCurrentPage('profile')
                    else console.log('导航到:', path)
                  }}
                />
              )}
              {currentPage === 'tradingview-config' && (
                <TradingViewWebhookConfig
                  onClose={() => setCurrentPage('strategy-market')}
                />
              )}
              {currentPage === 'visual-builder' && (
                <VisualStrategyBuilder
                  onClose={() => setCurrentPage('strategy-market')}
                />
              )}
              {currentPage === 'code-editor' && (
                <CodeEditor
                  onClose={() => setCurrentPage('strategy-market')}
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
          { id: 'binance', name: 'Binance', icon: '/icons/exchanges/币安.png', balance: 5234.56, status: 'active' },
          { id: 'okx', name: 'OKX', icon: '/icons/exchanges/okx.png', balance: 1200.00, status: 'active' },
        ]}
        availableBalance={10000}
      />
    </div>
  )
}
