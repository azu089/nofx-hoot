'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { billingApi, userApi } from '@/lib/api';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Server,
  Crown,
  Key,
  Coins,
  Users,
  Gift,
  Check,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Volume2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { IndustryNews } from '@/components/features/dashboard/IndustryNews';

interface DashboardData {
  wallet: {
    usdt_balance: string;
    points_balance: string;
    token_balance?: string;
  } | null;
  todayPnL: {
    todayPnl: string;
    todayProfit: string;
    todayLoss: string;
    todayTrades: number;
    todayWinRate: string;
    todayGasFee: string;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({
    wallet: null,
    todayPnL: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hideBalance, setHideBalance] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hide_balance') === 'true';
    }
    return false;
  });

  const toggleHideBalance = () => {
    const next = !hideBalance;
    setHideBalance(next);
    localStorage.setItem('hide_balance', String(next));
  };

  const fetchData = async () => {
    try {
      const [walletRes, pnlRes] = await Promise.all([
        userApi.getWallet().catch(() => ({ data: null })),
        billingApi.getTodayPnL().catch(() => ({ data: null })),
      ]);

      setData({
        wallet: walletRes.data,
        todayPnL: pnlRes.data,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const pnlValue = parseFloat(data.todayPnL?.todayPnl || '0');
  const isProfitable = pnlValue >= 0;
  const platformBalance = parseFloat(data.wallet?.usdt_balance || '0');
  const pnlPercent = platformBalance > 0 ? (pnlValue / platformBalance) * 100 : 0;

  // 使用 Tailwind 类名映射，避免 inline style
  const quickEntries = [
    { icon: Crown, label: '会员订阅', href: '/instances', bgClass: 'bg-warning/15', iconClass: 'text-warning' },
    { icon: TrendingUp, label: '交易所', href: '/me/exchanges', bgClass: 'bg-success/15', iconClass: 'text-success' },
    { icon: Server, label: 'VPS 实例', href: '/instances', bgClass: 'bg-brand-primary/15', iconClass: 'text-brand-primary' },
    { icon: Key, label: 'API 绑定', href: '/wallet/api-keys', bgClass: 'bg-danger/15', iconClass: 'text-danger' },
    { icon: Coins, label: '生态中心', href: '/ecosystem', bgClass: 'bg-purple-500/15', iconClass: 'text-purple-400' },
    { icon: Users, label: '邀请好友', href: '/referral', bgClass: 'bg-cyan-500/15', iconClass: 'text-cyan-400' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary p-4 space-y-4" aria-busy="true" aria-label="加载中">
        <div className="animate-pulse h-52 bg-bg-secondary rounded-2xl" />
        <div className="animate-pulse h-14 bg-bg-secondary rounded-xl" />
        <div className="animate-pulse h-32 bg-bg-secondary rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* 移动端极简布局 */}
      <div className="lg:hidden">
        {/* ========== 资产英雄卡片 - 光球脉动 ========== */}
        <div className="mx-4 mt-4 mb-6 p-4 rounded-2xl relative bg-bg-secondary overflow-hidden">
          {/* 光球脉动效果 */}
          <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />
          <div className="relative z-10">
          {/* 标题行 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-sm">总资产 (USDT)</span>
              <button
                onClick={toggleHideBalance}
                className="p-1 text-text-tertiary hover:text-white transition-colors"
                aria-label={hideBalance ? '显示资产' : '隐藏资产'}
              >
                {hideBalance ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 -mr-2 text-text-tertiary hover:text-white transition-colors"
              aria-label="刷新数据"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>

          {/* 超大资产数字 */}
          <button
            onClick={() => router.push('/wallet')}
            className="block text-left group mb-3"
            aria-label="查看钱包详情"
          >
            <span className="text-[48px] leading-none font-bold text-white font-mono tracking-tight group-hover:text-text-secondary transition-colors">
              {hideBalance ? '****.**' : `$${platformBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          </button>

          {/* 今日盈亏 */}
          <button
            onClick={() => router.push('/trading')}
            className="flex items-center gap-2 group mb-5"
            aria-label="查看交易详情"
          >
            <div className={`flex items-center justify-center w-7 h-7 rounded-full ${isProfitable ? 'bg-success/15' : 'bg-danger/15'}`}>
              {isProfitable ? (
                <ArrowUpRight className="w-4 h-4 text-success" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-danger" aria-hidden="true" />
              )}
            </div>
            <span className={`text-xl font-bold font-mono ${isProfitable ? 'text-success' : 'text-danger'}`}>
              {hideBalance ? '**.**' : `${isProfitable ? '+' : ''}${pnlPercent.toFixed(2)}`}%
            </span>
            <span className={`text-sm font-mono ${isProfitable ? 'text-success/60' : 'text-danger/60'}`}>
              ({hideBalance ? '****.**' : `${isProfitable ? '+' : ''}$${Math.abs(pnlValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`})
            </span>
            <span className="text-text-tertiary text-xs">今日</span>
          </button>

          {/* 底部余额 - 双列对称布局 */}
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => router.push('/ecosystem/points')}
              className="flex flex-col items-center"
              aria-label="查看点卡余额详情"
            >
              <span className="text-lg font-bold font-mono text-warning">
                {hideBalance ? '****' : parseInt(data.wallet?.points_balance || '0').toLocaleString()}
              </span>
              <span className="text-text-tertiary text-xs mt-0.5">点卡</span>
            </button>
            <div className="w-px h-8 bg-border-primary/30" />
            <button
              onClick={() => router.push('/ecosystem/token')}
              className="flex flex-col items-center"
              aria-label="查看代币余额详情"
            >
              <span className="text-lg font-bold font-mono text-purple-400">
                {hideBalance ? '****' : parseInt(data.wallet?.token_balance || '0').toLocaleString()}
              </span>
              <span className="text-text-tertiary text-xs mt-0.5">代币</span>
            </button>
          </div>
          </div>
        </div>

        {/* ========== 公告横幅 ========== */}
        <div className="flex items-center gap-3 mx-4 px-4 py-3 rounded-xl glass-content" role="alert" aria-live="polite">
          <Volume2 className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap">
              <span className="text-sm text-text-secondary">
                欢迎使用 QuantFi，新用户注册即送 100 积分！
              </span>
              <span className="text-sm text-text-secondary mx-16">•</span>
              <span className="text-sm text-text-secondary">
                欢迎使用 QuantFi，新用户注册即送 100 积分！
              </span>
            </div>
          </div>
        </div>

        {/* ========== 快捷入口 - 6宫格 ========== */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            {quickEntries.map((entry) => (
              <button
                key={entry.label}
                onClick={() => router.push(entry.href)}
                className="flex flex-col items-center gap-2.5 py-2 group"
                aria-label={entry.label}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all group-hover:scale-110 ${entry.bgClass}`}
                >
                  <entry.icon className={`w-5 h-5 ${entry.iconClass}`} aria-hidden="true" />
                </div>
                <span className="text-xs text-text-secondary group-hover:text-white transition-colors">
                  {entry.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ========== 市场情绪指数 ========== */}
        <div className="px-4 pb-4">
          <MarketSentimentMobile />
        </div>

        {/* ========== 新手任务 ========== */}
        <div className="px-4 pb-4">
          <OnboardingSectionMobile />
        </div>

        {/* ========== 行业资讯 ========== */}
        <div className="px-4 pb-20">
          <IndustryNews />
        </div>
      </div>

      {/* 桌面端保持原有卡片布局 */}
      <div className="hidden lg:block p-4 space-y-4">
        {/* ========== 资产英雄卡片 - 光球脉动 ========== */}
        <div className="rounded-2xl relative bg-bg-secondary overflow-hidden">
          {/* 光球脉动效果 */}
          <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />
          <div className="p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-sm">总资产 (USDT)</span>
                <button
                  onClick={toggleHideBalance}
                  className="p-1 text-text-tertiary hover:text-white transition-colors"
                  aria-label={hideBalance ? '显示资产' : '隐藏资产'}
                >
                  {hideBalance ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 -mr-2 text-text-tertiary hover:text-white transition-colors"
                aria-label="刷新数据"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>

            <button
              onClick={() => router.push('/wallet')}
              className="block text-left group mb-3"
              aria-label="查看钱包详情"
            >
              <span className="text-[56px] leading-none font-bold text-white font-mono tracking-tight group-hover:text-text-secondary transition-colors">
                {hideBalance ? '****.**' : `$${platformBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </button>

            <button
              onClick={() => router.push('/trading')}
              className="flex items-center gap-2 group"
              aria-label="查看交易详情"
            >
              <div className={`flex items-center justify-center w-7 h-7 rounded-full ${isProfitable ? 'bg-success/15' : 'bg-danger/15'}`}>
                {isProfitable ? (
                  <ArrowUpRight className="w-4 h-4 text-success" aria-hidden="true" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-danger" aria-hidden="true" />
                )}
              </div>
              <span className={`text-xl font-bold font-mono ${isProfitable ? 'text-success' : 'text-danger'}`}>
                {hideBalance ? '**.**' : `${isProfitable ? '+' : ''}${pnlPercent.toFixed(2)}`}%
              </span>
              <span className={`text-sm font-mono ${isProfitable ? 'text-success/60' : 'text-danger/60'}`}>
                ({hideBalance ? '****.**' : `${isProfitable ? '+' : ''}$${Math.abs(pnlValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`})
              </span>
              <span className="text-text-tertiary text-xs">今日</span>
            </button>

            {/* 底部余额 - 单行内联显示 */}
            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={() => router.push('/ecosystem/points')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
                aria-label="查看点卡余额详情"
              >
                <span className="text-text-tertiary text-sm">点卡</span>
                <span className="text-lg font-bold font-mono text-warning">
                  {hideBalance ? '****' : parseInt(data.wallet?.points_balance || '0').toLocaleString()}
                </span>
              </button>
              <div className="w-1 h-1 rounded-full bg-text-tertiary/30" />
              <button
                onClick={() => router.push('/ecosystem/token')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
                aria-label="查看代币余额详情"
              >
                <span className="text-text-tertiary text-sm">代币</span>
                <span className="text-lg font-bold font-mono text-purple-500">
                  {hideBalance ? '****' : parseInt(data.wallet?.token_balance || '0').toLocaleString()}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 公告横幅 */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary" role="alert" aria-live="polite">
          <Volume2 className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap">
              <span className="text-sm text-text-secondary">
                欢迎使用 QuantFi，新用户注册即送 100 积分！
              </span>
              <span className="text-sm text-text-secondary mx-16">•</span>
              <span className="text-sm text-text-secondary">
                欢迎使用 QuantFi，新用户注册即送 100 积分！
              </span>
            </div>
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="rounded-2xl glass-content p-4">
          <div className="grid grid-cols-3 gap-4">
            {quickEntries.map((entry) => (
              <button
                key={entry.label}
                onClick={() => router.push(entry.href)}
                className="flex flex-col items-center gap-2.5 py-2 group"
                aria-label={entry.label}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${entry.bgClass}`}
                >
                  <entry.icon className={`w-5 h-5 ${entry.iconClass}`} aria-hidden="true" />
                </div>
                <span className="text-xs text-text-secondary group-hover:text-white transition-colors">
                  {entry.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <MarketSentiment />
        <OnboardingSection />
        <IndustryNews />
      </div>
    </div>
  );
}

// ============ 市场情绪 - 移动端极简版 ============
function MarketSentimentMobile() {
  const [data, setData] = useState<{ value: string; value_classification: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(res => res.json())
      .then(result => { if (result.data?.[0]) setData(result.data[0]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-xl relative bg-bg-secondary overflow-hidden" aria-busy="true" aria-label="加载市场情绪指数">
        <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />
        <div className="relative z-10 animate-pulse flex items-center justify-between">
          <div className="h-4 w-32 bg-border-primary rounded" />
          <div className="h-6 w-12 bg-border-primary rounded" />
        </div>
      </div>
    );
  }

  const value = data ? parseInt(data.value) : 50;
  const classification = data?.value_classification || 'Neutral';

  // 使用 Tailwind 类名映射，避免 inline style
  const config: Record<string, { text: string; textClass: string; bgClass: string }> = {
    'Extreme Fear': { text: '极度恐惧', textClass: 'text-danger', bgClass: 'bg-danger/20' },
    'Fear': { text: '恐惧', textClass: 'text-warning', bgClass: 'bg-warning/20' },
    'Neutral': { text: '中性', textClass: 'text-text-secondary', bgClass: 'bg-text-secondary/20' },
    'Greed': { text: '贪婪', textClass: 'text-success', bgClass: 'bg-success/20' },
    'Extreme Greed': { text: '极度贪婪', textClass: 'text-success', bgClass: 'bg-success/20' },
  };
  const { text, textClass, bgClass } = config[classification] || config['Neutral'];

  return (
    <div className="p-4 rounded-xl relative bg-bg-secondary overflow-hidden">
      <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-text-secondary text-sm">市场情绪指数</span>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold font-mono ${textClass}`}>{value}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${bgClass} ${textClass}`}>
              {text}
            </span>
          </div>
        </div>

        <div className="relative h-2.5 rounded-full overflow-hidden bg-gradient-to-r from-danger via-warning to-success">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-[3px] border-bg-primary shadow-lg transition-all duration-500"
            style={{ left: `calc(${value}% - 8px)` }}
          />
        </div>

        <div className="flex justify-between mt-1.5 text-[10px] text-text-tertiary">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

// ============ 市场情绪 - 桌面端 ============
function MarketSentiment() {
  const [data, setData] = useState<{ value: string; value_classification: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://api.alternative.me/fng/?limit=1')
      .then(res => res.json())
      .then(result => { if (result.data?.[0]) setData(result.data[0]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-2xl relative bg-bg-secondary overflow-hidden" aria-busy="true" aria-label="加载市场情绪指数">
        <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />
        <div className="relative z-10 animate-pulse flex items-center justify-between">
          <div className="h-4 w-32 bg-border-primary rounded" />
          <div className="h-6 w-12 bg-border-primary rounded" />
        </div>
      </div>
    );
  }

  const value = data ? parseInt(data.value) : 50;
  const classification = data?.value_classification || 'Neutral';

  // 使用 Tailwind 类名映射，避免 inline style
  const config: Record<string, { text: string; textClass: string; bgClass: string }> = {
    'Extreme Fear': { text: '极度恐惧', textClass: 'text-danger', bgClass: 'bg-danger/20' },
    'Fear': { text: '恐惧', textClass: 'text-warning', bgClass: 'bg-warning/20' },
    'Neutral': { text: '中性', textClass: 'text-text-secondary', bgClass: 'bg-text-secondary/20' },
    'Greed': { text: '贪婪', textClass: 'text-success', bgClass: 'bg-success/20' },
    'Extreme Greed': { text: '极度贪婪', textClass: 'text-success', bgClass: 'bg-success/20' },
  };
  const { text, textClass, bgClass } = config[classification] || config['Neutral'];

  return (
    <div className="p-4 rounded-2xl relative bg-bg-secondary overflow-hidden">
      <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />
      <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-secondary text-sm">市场情绪指数</span>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold font-mono ${textClass}`}>{value}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${bgClass} ${textClass}`}>
            {text}
          </span>
        </div>
      </div>

      <div className="relative h-2.5 rounded-full overflow-hidden bg-gradient-to-r from-danger via-warning to-success">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-[3px] border-bg-primary shadow-lg transition-all duration-500"
          style={{ left: `calc(${value}% - 8px)` }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-[10px] text-text-tertiary">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      </div>
    </div>
  );
}

// ============ 新手任务 - 移动端极简版 ============
function OnboardingSectionMobile() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Array<{
    id: string;
    title: string;
    points: number;
    completed: boolean;
  }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // 任务对应的跳转链接
  const taskHrefMap: Record<string, string> = {
    'bind-api': '/wallet/api-keys',
    'first-deposit': '/wallet/deposit',
    'subscribe-strategy': '/strategies',
    'start-bot': '/trading',
  };

  // 从后端获取任务状态
  const fetchTasks = async () => {
    try {
      const res = await userApi.getOnboardingTasks();
      if (res.data) {
        setTasks(res.data.tasks);
        setTotalPoints(res.data.totalPoints);
        setEarnedPoints(res.data.earnedPoints);
      }
    } catch (error) {
      console.error('Failed to fetch onboarding tasks:', error);
      // 后端请求失败时使用默认任务列表
      setTasks([
        { id: 'bind-api', title: '绑定交易所 API', points: 5, completed: false },
        { id: 'first-deposit', title: '首次充值 ≥50U', points: 20, completed: false },
        { id: 'subscribe-strategy', title: '订阅付费策略', points: 15, completed: false },
        { id: 'start-bot', title: '机器人运行 24h', points: 10, completed: false },
      ]);
      setTotalPoints(50);
      setEarnedPoints(0);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    fetchTasks();
    setCollapsed(localStorage.getItem('onboarding_collapsed') === 'true');
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('onboarding_collapsed', String(next));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (isLoaded && completedCount === totalCount && totalCount > 0) return null;

  return (
    <div className="rounded-xl glass-content overflow-hidden">
      {/* 头部 */}
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between p-4"
        aria-label={collapsed ? '展开新手任务' : '收起新手任务'}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-warning" aria-hidden="true" />
          <span className="text-sm font-medium text-white">新手任务</span>
          <span className="text-xs text-text-tertiary bg-bg-primary px-1.5 py-0.5 rounded">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-warning font-medium">+{totalPoints - earnedPoints} 积分</span>
          <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
        </div>
      </button>

      {/* 进度条 */}
      <div className="px-4 pb-4">
        <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-warning to-[#FBBF24] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 任务列表 */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {tasks.map((task, index) => {
            const href = taskHrefMap[task.id] || '/dashboard';
            return (
              <button
                key={task.id}
                onClick={() => !task.completed && router.push(href)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  task.completed ? 'bg-success/10' : 'bg-bg-primary hover:bg-bg-tertiary'
                }`}
                aria-label={task.completed ? `任务已完成: ${task.title}` : `前往完成任务: ${task.title}`}
                disabled={task.completed}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  task.completed ? 'bg-success' : 'bg-bg-tertiary'
                }`}>
                  {task.completed ? (
                    <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                  ) : (
                    <span className="text-xs text-text-tertiary">{index + 1}</span>
                  )}
                </div>
                <span className={`flex-1 text-left text-sm ${task.completed ? 'text-success line-through' : 'text-white'}`}>
                  {task.title}
                </span>
                {task.completed ? (
                  <span className="text-xs text-success">已完成</span>
                ) : (
                  <div className="flex items-center gap-1 text-warning">
                    <span className="text-xs font-medium">+{task.points}</span>
                    <ChevronRight className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ 新手任务 - 桌面端 ============
function OnboardingSection() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Array<{
    id: string;
    title: string;
    points: number;
    completed: boolean;
  }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // 任务对应的跳转链接
  const taskHrefMap: Record<string, string> = {
    'bind-api': '/wallet/api-keys',
    'first-deposit': '/wallet/deposit',
    'subscribe-strategy': '/strategies',
    'start-bot': '/trading',
  };

  // 从后端获取任务状态
  const fetchTasks = async () => {
    try {
      const res = await userApi.getOnboardingTasks();
      if (res.data) {
        setTasks(res.data.tasks);
        setTotalPoints(res.data.totalPoints);
        setEarnedPoints(res.data.earnedPoints);
      }
    } catch (error) {
      console.error('Failed to fetch onboarding tasks:', error);
      // 后端请求失败时使用默认任务列表
      setTasks([
        { id: 'bind-api', title: '绑定交易所 API', points: 5, completed: false },
        { id: 'first-deposit', title: '首次充值 ≥50U', points: 20, completed: false },
        { id: 'subscribe-strategy', title: '订阅付费策略', points: 15, completed: false },
        { id: 'start-bot', title: '机器人运行 24h', points: 10, completed: false },
      ]);
      setTotalPoints(50);
      setEarnedPoints(0);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    fetchTasks();
    setCollapsed(localStorage.getItem('onboarding_collapsed') === 'true');
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('onboarding_collapsed', String(next));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (isLoaded && completedCount === totalCount && totalCount > 0) return null;

  return (
    <div className="rounded-2xl glass-content overflow-hidden">
      {/* 头部 */}
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between p-4"
        aria-label={collapsed ? '展开新手任务' : '收起新手任务'}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-warning" aria-hidden="true" />
          <span className="text-sm font-medium text-white">新手任务</span>
          <span className="text-xs text-text-tertiary bg-border-primary px-1.5 py-0.5 rounded">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-warning font-medium">+{totalPoints - earnedPoints} 积分</span>
          <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
        </div>
      </button>

      {/* 进度条 */}
      <div className="px-4 pb-4">
        <div className="h-1.5 bg-border-primary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-warning to-[#FBBF24] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 任务列表 */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {tasks.map((task, index) => {
            const href = taskHrefMap[task.id] || '/dashboard';
            return (
              <button
                key={task.id}
                onClick={() => !task.completed && router.push(href)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  task.completed ? 'bg-success/10' : 'bg-bg-tertiary hover:bg-bg-tertiary/80'
                }`}
                aria-label={task.completed ? `任务已完成: ${task.title}` : `前往完成任务: ${task.title}`}
                disabled={task.completed}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  task.completed ? 'bg-success' : 'bg-bg-tertiary border border-border-primary'
                }`}>
                  {task.completed ? (
                    <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                  ) : (
                    <span className="text-xs text-text-tertiary">{index + 1}</span>
                  )}
                </div>
                <span className={`flex-1 text-left text-sm ${task.completed ? 'text-success line-through' : 'text-white'}`}>
                  {task.title}
                </span>
                {task.completed ? (
                  <span className="text-xs text-success">已完成</span>
                ) : (
                  <div className="flex items-center gap-1 text-warning">
                    <span className="text-xs font-medium">+{task.points}</span>
                    <ChevronRight className="w-4 h-4 text-text-tertiary" aria-hidden="true" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
