'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button } from '@/components/ui';
import { strategiesApi } from '@/lib/api';
import {
  Play,
  Activity,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileCode,
  Eye,
  ArrowDownCircle,
  Clock,
  Bell,
} from 'lucide-react';

// ============ 类型定义 ============

// 我上传的策略
interface MyStrategy {
  id: string;
  name: string;
  description: string | null;
  reviewStatus: string;
  createdAt: string;
  totalUsers: number;
  totalProfit: string;
  avgWinRate: string | null;
  revenueShareRate: string | null;
  revenueShareEnabled: boolean;
  // 交易类型
  tradeType?: 'spot' | 'futures';
  // 试运行相关
  trialStartDate?: string;
  trialTradesCount?: number;
  trialMode?: 'live' | 'paper';
  // 回测数据
  backtestTotalReturn?: string;
  backtestWinRate?: string;
  backtestMaxDrawdown?: string;
  // 上架/下架日期
  approvedAt?: string;
  rejectedAt?: string;
  // 拒绝理由
  rejectReason?: string;
}

// 收益相关
interface RevenueStats {
  totalRevenue: string;
  pendingRevenue: string;
  settledRevenue: string;
  revenueByStrategy: Array<{
    strategyId: string;
    strategyName: string;
    revenue: string;
    users: number;
    tier: string;
  }>;
}

// 上架记录类型
interface ListingLog {
  id: string;
  strategyId: string;
  strategyName: string;
  action: 'apply' | 'approve' | 'reject' | 'unlist';
  reason?: string;
  createdAt: string;
}

// 筛选器配置（包含记录 Tab）
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'approved', label: '已上架' },
  { key: 'rejected', label: '已下架' },
  { key: 'pending_review', label: '审核中' },
  { key: 'logs', label: '记录' },
];

// ============ 主组件 ============
export default function StrategyManagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myStrategies, setMyStrategies] = useState<MyStrategy[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [listingLogs, setListingLogs] = useState<ListingLog[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [strategiesRes, revenueRes] = await Promise.all([
        strategiesApi.getMyUploads().catch(() => ({ data: [] })),
        strategiesApi.getRevenueStats().catch(() => ({ data: null })),
      ]);
      setMyStrategies(strategiesRes.data || []);
      setRevenueStats(revenueRes.data);

      // 从策略数据生成上架记录（后续可替换为独立 API）
      generateListingLogs(strategiesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 从策略数据生成上架记录
  const generateListingLogs = (strategies: MyStrategy[]) => {
    const logs: ListingLog[] = [];

    strategies.forEach(s => {
      // 申请记录
      if (s.reviewStatus === 'pending_review' || s.reviewStatus === 'approved' || s.reviewStatus === 'rejected') {
        logs.push({
          id: `${s.id}-apply`,
          strategyId: s.id,
          strategyName: s.name,
          action: 'apply',
          createdAt: s.createdAt,
        });
      }

      // 通过记录
      if (s.reviewStatus === 'approved' && s.approvedAt) {
        logs.push({
          id: `${s.id}-approve`,
          strategyId: s.id,
          strategyName: s.name,
          action: 'approve',
          createdAt: s.approvedAt,
        });
      }

      // 拒绝记录
      if (s.reviewStatus === 'rejected') {
        logs.push({
          id: `${s.id}-reject`,
          strategyId: s.id,
          strategyName: s.name,
          action: 'reject',
          reason: s.rejectReason || '未通过审核',
          createdAt: s.rejectedAt || s.createdAt,
        });
      }
    });

    // 按时间倒序排列
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setListingLogs(logs);
  };

  // 获取记录操作的样式
  const getLogStyle = (action: string) => {
    switch (action) {
      case 'apply':
        return { icon: Clock, color: 'text-brand-primary', bg: 'bg-brand-primary/10', label: '申请上架' };
      case 'approve':
        return { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: '审核通过' };
      case 'reject':
        return { icon: XCircle, color: 'text-danger', bg: 'bg-danger/10', label: '审核拒绝' };
      case 'unlist':
        return { icon: ArrowDownCircle, color: 'text-warning', bg: 'bg-warning/10', label: '已下架' };
      default:
        return { icon: Bell, color: 'text-text-secondary', bg: 'bg-bg-tertiary', label: '未知' };
    }
  };

  // 筛选后的策略
  const filteredStrategies = useMemo(() => {
    if (filter === 'all') return myStrategies;
    return myStrategies.filter(s => s.reviewStatus === filter);
  }, [myStrategies, filter]);

  // 状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: 'bg-success/20', border: 'border-success/30', text: 'text-success', icon: CheckCircle, label: '已上架' };
      case 'pending_review':
        return { bg: 'bg-warning/20', border: 'border-warning/30', text: 'text-warning', icon: AlertCircle, label: '待审核' };
      case 'trial':
        return { bg: 'bg-brand-primary/20', border: 'border-brand-primary/30', text: 'text-brand-primary', icon: Activity, label: '试运行' };
      case 'backtest_running':
        return { bg: 'bg-brand-primary/20', border: 'border-brand-primary/30', text: 'text-brand-primary', icon: Loader2, label: '回测中' };
      case 'backtest_passed':
        return { bg: 'bg-success/20', border: 'border-success/30', text: 'text-success', icon: CheckCircle, label: '回测通过' };
      case 'backtest_failed':
        return { bg: 'bg-danger/20', border: 'border-danger/30', text: 'text-danger', icon: XCircle, label: '回测失败' };
      case 'rejected':
        return { bg: 'bg-danger/20', border: 'border-danger/30', text: 'text-danger', icon: XCircle, label: '已拒绝' };
      default:
        return { bg: 'bg-bg-tertiary', border: 'border-border-primary', text: 'text-text-secondary', icon: FileCode, label: '草稿' };
    }
  };

  // ============ 加载状态 ============
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-bg-tertiary rounded-lg" />
          <div className="h-12 bg-bg-tertiary rounded-lg" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-bg-tertiary rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* 收益概览卡片（含标题和返回按钮）*/}
      <Card className="bg-gradient-to-r from-success/10 to-brand-primary/10 border-success/30">
        <CardContent className="p-4">
          {/* 标题行：返回按钮 + 标题 + 收益明细 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.back()}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h4 className="text-white font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success" />
                我的收益
              </h4>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-text-tertiary text-xs">总收益</p>
              <p className="text-lg font-bold text-success">
                ${parseFloat(revenueStats?.totalRevenue || '0').toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">今日收益</p>
              <p className="text-lg font-bold text-brand-primary">
                ${parseFloat(revenueStats?.pendingRevenue || '0').toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">本月收益</p>
              <p className="text-lg font-bold text-white">
                ${parseFloat(revenueStats?.settledRevenue || '0').toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 筛选器（全部/已上架/已下架/审核中/记录） */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-brand-primary text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
            }`}
          >
            {f.label}
            {f.key === 'all' && ` (${myStrategies.length})`}
            {f.key === 'logs' && listingLogs.length > 0 && ` (${listingLogs.length})`}
          </button>
        ))}
      </div>

      {/* 策略列表内容 */}
      {filter !== 'logs' && (
        <>

      {/* 策略列表 */}
      {filteredStrategies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileCode className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
            <h3 className="text-base font-medium text-text-primary mb-2">
              {filter === 'all' ? '还没有上传策略' : `没有${FILTERS.find(f => f.key === filter)?.label}的策略`}
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              在「我的策略」中点击上架按钮，即可将策略提交审核
            </p>
            <Button size="sm" onClick={() => router.push('/strategies/my')}>
              <FileCode className="w-4 h-4 mr-1.5" />
              去我的策略
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredStrategies.map(strategy => {
            const statusStyle = getStatusStyle(strategy.reviewStatus);
            const StatusIcon = statusStyle.icon;

            // 获取回测数据
            const backtestReturn = parseFloat(strategy.backtestTotalReturn || '0');
            const backtestWinRate = parseFloat(strategy.backtestWinRate || '0');
            const backtestDrawdown = parseFloat(strategy.backtestMaxDrawdown || '0');
            const sharpeRatio = (backtestReturn / (backtestDrawdown || 1) * 0.5).toFixed(2);

            // 交易类型
            const tradeType = strategy.tradeType || 'spot';

            // 格式化日期
            const formatDate = (dateStr?: string) => {
              if (!dateStr) return '-';
              const date = new Date(dateStr);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            };

            // 根据状态显示不同日期
            const getDateInfo = () => {
              if (strategy.reviewStatus === 'approved' && strategy.approvedAt) {
                return { label: '上架', date: formatDate(strategy.approvedAt) };
              }
              if (strategy.reviewStatus === 'rejected' && strategy.rejectedAt) {
                return { label: '下架', date: formatDate(strategy.rejectedAt) };
              }
              return { label: '创建', date: formatDate(strategy.createdAt) };
            };
            const dateInfo = getDateInfo();

            return (
              <Card
                key={strategy.id}
                className="hover:border-brand-primary/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/strategies/${strategy.id}`)}
              >
                <CardContent className="p-3">
                  {/* 第一行：策略名称 + 状态 + 日期 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <h3 className="text-white font-medium text-sm truncate">{strategy.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        tradeType === 'futures'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-brand-primary/15 text-brand-primary'
                      }`}>
                        {tradeType === 'futures' ? '合约' : '现货'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}>
                        <StatusIcon className={`w-3 h-3 ${strategy.reviewStatus === 'backtest_running' ? 'animate-spin' : ''}`} />
                        {statusStyle.label}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        {dateInfo.label} {dateInfo.date}
                      </span>
                    </div>
                  </div>

                  {/* 第二行：四指标横排 */}
                  <div className="grid grid-cols-4 gap-2 py-2 bg-bg-tertiary/50 rounded-md px-2">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">{backtestWinRate.toFixed(0)}%</p>
                      <p className="text-[10px] text-text-tertiary">胜率</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-danger">-{backtestDrawdown.toFixed(0)}%</p>
                      <p className="text-[10px] text-text-tertiary">回撤</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">{sharpeRatio}</p>
                      <p className="text-[10px] text-text-tertiary">夏普</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-brand-primary">{strategy.totalUsers}</p>
                      <p className="text-[10px] text-text-tertiary">订阅</p>
                    </div>
                  </div>

                  {/* 第三行：操作按钮 */}
                  <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-xs h-7"
                      onClick={() => router.push(`/strategies/${strategy.id}`)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      详情
                    </Button>
                    {strategy.reviewStatus === 'draft' && (
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7">
                        <Play className="w-3 h-3 mr-1" />
                        提交回测
                      </Button>
                    )}
                    {strategy.reviewStatus === 'backtest_passed' && (
                      <Button size="sm" className="flex-1 text-xs h-7">
                        <Activity className="w-3 h-3 mr-1" />
                        开始试运行
                      </Button>
                    )}
                    {strategy.reviewStatus === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-7 text-danger border-danger/30 hover:bg-danger/10"
                      >
                        <ArrowDownCircle className="w-3 h-3 mr-1" />
                        下架
                      </Button>
                    )}
                    {strategy.reviewStatus === 'rejected' && (
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7">
                        <Play className="w-3 h-3 mr-1" />
                        重新提交
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* 记录内容 */}
      {filter === 'logs' && (
        <div className="space-y-3">
          {listingLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
                <h3 className="text-base font-medium text-text-primary mb-2">暂无上架记录</h3>
                <p className="text-text-secondary text-sm">
                  提交策略审核后，相关通知将在这里显示
                </p>
              </CardContent>
            </Card>
          ) : (
            listingLogs.map(log => {
              const style = getLogStyle(log.action);
              const LogIcon = style.icon;

              // 格式化时间
              const formatDateTime = (dateStr: string) => {
                const date = new Date(dateStr);
                return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
              };

              return (
                <Card key={log.id} className="hover:border-brand-primary/30 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* 图标 */}
                      <div className={`p-2 rounded-lg ${style.bg}`}>
                        <LogIcon className={`w-4 h-4 ${style.color}`} />
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-medium ${style.color}`}>
                            {style.label}
                          </span>
                          <span className="text-xs text-text-tertiary">
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-white truncate">
                          {log.strategyName}
                        </p>
                        {/* 拒绝理由 */}
                        {log.action === 'reject' && log.reason && (
                          <div className="mt-2 p-2 bg-danger/10 rounded-md">
                            <p className="text-xs text-danger font-medium mb-1">拒绝理由：</p>
                            <p className="text-xs text-text-secondary">{log.reason}</p>
                          </div>
                        )}
                        {/* 通过提示 */}
                        {log.action === 'approve' && (
                          <p className="text-xs text-success mt-1">
                            策略已成功上架到策略市场
                          </p>
                        )}
                        {/* 申请中提示 */}
                        {log.action === 'apply' && (
                          <p className="text-xs text-text-tertiary mt-1">
                            审核中，预计 1-3 个工作日
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
