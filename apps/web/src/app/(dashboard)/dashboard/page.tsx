'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button } from '@/components/ui';
import { billingApi, userApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AnnouncementBanner } from '@/components/features/dashboard';
import { usePWA } from '@/hooks/usePWA';
import {
  RefreshCw,
  Coins,
  Server,
  Crown,
  Download,
  Key,
  Users,
  ChevronRight,
  ChevronDown,
  Check,
  Gift,
  Newspaper,
  ExternalLink,
  Clock,
} from 'lucide-react';

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
  const { canInstall, install, isIOS, isSafari } = usePWA();
  const [data, setData] = useState<DashboardData>({
    wallet: null,
    todayPnL: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [walletRes, pnlRes] = await Promise.all([
        userApi.getWallet().catch(() => ({ data: null })),
        billingApi.getTodayPnL().catch(() => ({ data: null })),
      ]);
      setData({ wallet: walletRes.data, todayPnL: pnlRes.data });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const handlePWAInstall = () => {
    if (canInstall) install();
    else if (isIOS && isSafari) alert('请点击底部分享按钮，选择「添加到主屏幕」');
    else alert('当前浏览器不支持安装，请使用 Chrome 或 Safari');
  };

  const pnlValue = parseFloat(data.todayPnL?.todayPnl || '0');
  const isProfitable = pnlValue >= 0;
  const totalBalance = parseFloat(data.wallet?.usdt_balance || '0');
  const pnlPercent = totalBalance > 0 ? (pnlValue / totalBalance) * 100 : 0;

  const quickEntries = [
    { icon: Server, label: 'VPS 实例', href: '/instances', color: 'text-brand-primary' },
    { icon: Crown, label: '会员订阅', href: '/subscription', color: 'text-warning' },
    { icon: Download, label: '安装 APP', href: '#pwa', color: 'text-success', onClick: handlePWAInstall },
    { icon: Key, label: 'API 绑定', href: '/wallet/api-keys', color: 'text-danger' },
    { icon: Coins, label: '生态中心', href: '/ecosystem/staking', color: 'text-purple-400' },
    { icon: Users, label: '邀请好友', href: '/referral', color: 'text-cyan-400' },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-40 bg-bg-tertiary rounded-xl" />
        <div className="animate-pulse h-12 bg-bg-tertiary rounded-xl" />
        <div className="animate-pulse h-24 bg-bg-tertiary rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 资产卡片 */}
      <Card variant="glass" className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-brand-primary/20 via-bg-secondary to-brand-secondary/10 p-5">
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-text-secondary text-sm">总资产 (USDT)</p>
                <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-7 w-7 p-0">
                  <RefreshCw className={`w-4 h-4 text-text-tertiary ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="cursor-pointer" onClick={() => router.push('/wallet')}>
                <span className="text-4xl font-bold text-white font-mono tracking-tight">
                  {formatCurrency(data.wallet?.usdt_balance || '0')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="cursor-pointer" onClick={() => router.push('/trading')}>
                <p className="text-text-tertiary text-xs mb-1">今日盈亏</p>
                <p className={`text-lg font-bold font-mono ${isProfitable ? 'text-success' : 'text-danger'}`}>
                  {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
                </p>
              </div>
              <div className="cursor-pointer" onClick={() => router.push('/ecosystem/points')}>
                <p className="text-text-tertiary text-xs mb-1">点卡</p>
                <p className="text-lg font-bold font-mono text-warning">
                  {parseInt(data.wallet?.points_balance || '0').toLocaleString()}
                </p>
              </div>
              <div className="cursor-pointer" onClick={() => router.push('/ecosystem/token')}>
                <p className="text-text-tertiary text-xs mb-1">代币</p>
                <p className="text-lg font-bold font-mono text-purple-400">
                  {parseInt(data.wallet?.token_balance || '0').toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 公告横幅 */}
      <AnnouncementBanner />

      {/* 快捷入口 - 6宫格 */}
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            {quickEntries.map((entry) => (
              <button
                key={entry.label}
                onClick={() => entry.onClick ? entry.onClick() : router.push(entry.href)}
                className="flex flex-col items-center gap-2 py-2 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center group-hover:bg-bg-primary/50 transition-colors">
                  <entry.icon className={`w-5 h-5 ${entry.color}`} />
                </div>
                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">{entry.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 市场情绪 - 仪表盘样式 */}
      <FearGreedGauge />

      {/* 新手任务 - 可收起卡片 */}
      <OnboardingCard />

      {/* 热门资讯 - 默认收起 */}
      <CryptoNewsCard />
    </div>
  );
}

// 市场情绪指数 - 专业横条样式
function FearGreedGauge() {
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
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 bg-bg-tertiary rounded" />
            <div className="h-2 bg-bg-tertiary rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const value = data ? parseInt(data.value) : 50;
  const classification = data?.value_classification || 'Neutral';

  const config: Record<string, { label: string; color: string; bgColor: string }> = {
    'Extreme Fear': { label: '极度恐惧', color: 'text-[#EA3943]', bgColor: 'bg-[#EA3943]' },
    'Fear': { label: '恐惧', color: 'text-[#EA8C00]', bgColor: 'bg-[#EA8C00]' },
    'Neutral': { label: '中性', color: 'text-[#93959B]', bgColor: 'bg-[#93959B]' },
    'Greed': { label: '贪婪', color: 'text-[#16C784]', bgColor: 'bg-[#16C784]' },
    'Extreme Greed': { label: '极度贪婪', color: 'text-[#16C784]', bgColor: 'bg-[#16C784]' },
  };
  const { label, color, bgColor } = config[classification] || config['Neutral'];

  return (
    <Card variant="glass">
      <CardContent className="p-4">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-secondary">Fear & Greed Index</span>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold font-mono ${color}`}>{value}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${bgColor} text-white font-medium`}>
              {label}
            </span>
          </div>
        </div>

        {/* 渐变进度条 */}
        <div className="relative">
          <div className="h-2 rounded-full bg-gradient-to-r from-[#EA3943] via-[#F3D42F] to-[#16C784]" />
          {/* 指示器 */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
            style={{ left: `${value}%` }}
          >
            <div className="relative -translate-x-1/2">
              <div className="w-3 h-3 rounded-full bg-white border-2 border-bg-primary shadow-lg" />
            </div>
          </div>
        </div>

        {/* 刻度标签 */}
        <div className="flex justify-between mt-1.5 text-[10px] text-text-tertiary">
          <span>0 极度恐惧</span>
          <span>50 中性</span>
          <span>100 极度贪婪</span>
        </div>
      </CardContent>
    </Card>
  );
}

// 新手任务卡片
function OnboardingCard() {
  const router = useRouter();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const tasks = [
    {
      id: 'bind-api',
      title: '绑定交易所 API',
      description: '连接您的交易所账户',
      href: '/wallet/api-keys',
      checkKey: 'onboarding_api_bound',
      points: 5
    },
    {
      id: 'first-deposit',
      title: '首次充值 ≥50U',
      description: '充值 USDT 开启量化交易',
      href: '/wallet/deposit',
      checkKey: 'onboarding_first_deposit',
      points: 20
    },
    {
      id: 'subscribe-strategy',
      title: '订阅付费策略',
      description: '选择一个策略开始跟单',
      href: '/strategies',
      checkKey: 'onboarding_strategy_subscribed',
      points: 15
    },
    {
      id: 'start-bot',
      title: '机器人运行 24h',
      description: '让策略持续运行一天',
      href: '/trading',
      checkKey: 'onboarding_bot_started',
      points: 10
    },
  ];

  useEffect(() => {
    const completed = new Set<string>();
    tasks.forEach((task) => {
      if (localStorage.getItem(task.checkKey) === 'true') completed.add(task.id);
    });
    setCompletedTasks(completed);
    setIsLoaded(true);
    setCollapsed(localStorage.getItem('onboarding_collapsed') === 'true');
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('onboarding_collapsed', String(next));
  };

  const completedCount = completedTasks.size;
  const totalCount = tasks.length;
  const progress = (completedCount / totalCount) * 100;
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0);
  const earnedPoints = tasks.filter((t) => completedTasks.has(t.id)).reduce((sum, t) => sum + t.points, 0);

  // 全部完成则不显示
  if (isLoaded && completedCount === totalCount) return null;

  return (
    <Card variant="glass">
      <CardContent className="p-4">
        {/* 标题行 - 可点击收起 */}
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium text-text-primary">新手任务</span>
            <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">{completedCount}/{totalCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-warning font-medium">+{totalPoints - earnedPoints} 积分待领</span>
            <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          </div>
        </button>

        {/* 进度条 */}
        <div className="mt-3 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-text-tertiary mt-1">已完成 {completedCount}/{totalCount}，获得 {earnedPoints}/{totalPoints} 积分</p>

        {/* 任务列表 - 可收起 */}
        {!collapsed && (
          <div className="mt-4 space-y-2">
            {tasks.map((task, index) => {
              const done = completedTasks.has(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => !done && router.push(task.href)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                    done
                      ? 'bg-success/10 cursor-default'
                      : 'bg-bg-tertiary hover:bg-bg-tertiary/70'
                  }`}
                >
                  {/* 序号或完成图标 */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done
                      ? 'bg-success text-white'
                      : 'bg-bg-secondary text-text-tertiary border border-border-primary'
                  }`}>
                    {done ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>

                  {/* 任务内容 */}
                  <div className="flex-1 text-left min-w-0">
                    <p className={`text-sm font-medium ${done ? 'text-success line-through' : 'text-text-primary'}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">{task.description}</p>
                  </div>

                  {/* 积分奖励 */}
                  <div className={`flex items-center gap-1 flex-shrink-0 ${done ? 'text-success' : 'text-warning'}`}>
                    {done ? (
                      <span className="text-xs">已领取</span>
                    ) : (
                      <>
                        <span className="text-xs font-medium">+{task.points}</span>
                        <ChevronRight className="w-4 h-4 text-text-tertiary" />
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 加密资讯卡片接口
interface CryptoNews {
  id: string;
  title: string;
  url: string;
  source: string;
  published_on: number;
  imageurl: string;
}

// 热门资讯卡片 - 默认收起
function CryptoNewsCard() {
  const [news, setNews] = useState<CryptoNews[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(true); // 默认收起
  const [hasLoaded, setHasLoaded] = useState(false);

  // 展开时才加载数据
  const loadNews = async () => {
    if (hasLoaded) return;
    setLoading(true);
    try {
      const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular');
      const data = await res.json();
      if (data.Data) {
        setNews(data.Data.slice(0, 10)); // 取前10条
      }
      setHasLoaded(true);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (!next && !hasLoaded) {
      loadNews();
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return `${Math.floor(diff / 86400)} 天前`;
  };

  return (
    <>
      <Card variant="glass">
        <CardContent className="p-4">
          {/* 标题行 - 可点击展开 */}
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-medium text-text-primary">热门资讯</span>
              <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">CryptoCompare</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">{collapsed ? '点击展开' : '点击收起'}</span>
              <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            </div>
          </button>

          {/* 资讯列表 - 可收起 */}
          {!collapsed && (
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="w-16 h-12 bg-bg-tertiary rounded" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-bg-tertiary rounded w-3/4" />
                        <div className="h-2 bg-bg-tertiary rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : news.length === 0 ? (
                <p className="text-center text-text-tertiary text-sm py-4">暂无资讯</p>
              ) : (
                news.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-bg-tertiary/50 transition-colors group"
                  >
                    {/* 缩略图 */}
                    <div className="w-16 h-12 flex-shrink-0 rounded overflow-hidden bg-bg-tertiary">
                      <img
                        src={item.imageurl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary line-clamp-2 group-hover:text-brand-primary transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-tertiary">{item.source}</span>
                        <span className="text-text-tertiary">·</span>
                        <span className="text-xs text-text-tertiary flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(item.published_on)}
                        </span>
                      </div>
                    </div>
                    {/* 外链图标 */}
                    <ExternalLink className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </a>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
