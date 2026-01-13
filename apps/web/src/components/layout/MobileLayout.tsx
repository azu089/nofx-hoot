'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MobileHeader } from './MobileHeader';
import { MobileTabBar } from './MobileTabBar';

interface MobileLayoutProps {
  children: ReactNode;
}

// 主 Tab 页面路径（不显示顶部 Header）
const MAIN_TAB_PATHS = ['/dashboard', '/trading', '/strategies', '/wallet', '/me'];

// 子页面标题映射
const PAGE_TITLES: Record<string, string> = {
  // 设置相关
  '/settings': '设置',
  '/settings/security': '安全设置',
  '/settings/notifications': '通知设置',
  '/settings/account': '账户信息',
  '/settings/appearance': '外观设置',
  '/settings/language': '语言设置',
  '/settings/about': '关于',
  '/settings/panic': '紧急按钮',
  '/settings/blacklist': '黑名单',
  // 钱包相关
  '/wallet/deposit': '充值',
  '/wallet/withdraw': '提现',
  '/wallet/api-keys': 'API Key',
  '/wallet/billing': '账单明细',
  '/wallet/cards': '银行卡',
  '/wallet/exchange': '闪兑',
  '/wallet/exchange/history': '兑换记录',
  // 交易相关
  '/trading/history': '交易历史',
  '/trading/backtest': '回测系统',
  '/trading/ai': 'AI 策略',
  '/trading/ai/analysis': 'AI 分析',
  '/trading/signals': '交易信号',
  // 策略相关
  '/strategies/create': '创建策略',
  '/strategies/manage': '策略管理',
  '/strategies/my': '我的策略',
  // 生态相关
  '/ecosystem': '生态中心',
  '/ecosystem/staking': '生态中心',
  '/ecosystem/exchange': '积分兑换',
  '/ecosystem/vesting': '释放进度',
  '/ecosystem/leaderboard': '排行榜',
  '/ecosystem/token': '代币',
  '/ecosystem/points': '积分',
  // 实例相关
  '/instances': '实例管理',
  // 其他
  '/announcements': '公告中心',
  '/subscription': '会员订阅',
  '/help': '帮助中心',
  '/referral': '邀请好友',
  '/me/exchanges': '交易所',
  // 管理后台
  '/agent': '代理商中心',
  '/admin': '管理后台',
};

/**
 * 移动端固定布局
 *
 * 参考主流 App 设计（币安、Robinhood）：
 * - 主 Tab 页面：无顶部 Header，直接展示内容
 * - 子页面：显示返回按钮 + 页面标题
 *
 * 结构：
 * - 固定顶部 Header (子页面时显示，56px)
 * - 可滚动内容区 (flex-1)
 * - 固定底部 TabBar (56px + safe-area)
 */
export function MobileLayout({ children }: MobileLayoutProps) {
  const pathname = usePathname();

  // 判断是否为主 Tab 页面
  const isMainTab = MAIN_TAB_PATHS.some(
    (path) => pathname === path || pathname === '/'
  );

  // 获取子页面标题
  const getPageTitle = () => {
    // 精确匹配
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];

    // 动态路由特殊处理
    if (pathname.match(/^\/strategies\/[^/]+$/)) return '策略详情';
    if (pathname.match(/^\/instances\/[^/]+$/)) return '实例详情';

    // 前缀匹配（如 /admin/xxx）
    const matchedPath = Object.keys(PAGE_TITLES).find(
      (path) => pathname.startsWith(path + '/')
    );
    if (matchedPath) return PAGE_TITLES[matchedPath];

    return '';
  };

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden relative">
      {/* 顶部安全区域 - 星空蓝黑背景（覆盖刘海区域） */}
      <div className="fixed top-0 left-0 right-0 h-safe bg-bg-primary z-50" />

      {/* Web3 背景效果 v3.0 */}
      <div className="bg-gradient-overlay" />
      <div className="bg-grid-pattern" />
      <div className="bg-orbs" />
      <div className="scanline" />

      {/* 子页面显示顶部 Header（返回按钮 + 标题） */}
      {!isMainTab && (
        <MobileHeader showBack={true} title={getPageTitle()} />
      )}

      {/* 可滚动内容区 */}
      {/* 主 Tab 页面添加顶部安全区 padding（避免刘海遮挡） */}
      <main className={`flex-1 overflow-y-auto overscroll-contain pb-[calc(76px+env(safe-area-inset-bottom,0px))] relative z-10 ${
        isMainTab ? 'pt-safe' : ''
      }`}>
        {children}
      </main>

      {/* 固定底部 TabBar */}
      <MobileTabBar />
    </div>
  );
}
