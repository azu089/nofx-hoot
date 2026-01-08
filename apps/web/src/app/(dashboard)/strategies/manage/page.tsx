'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button, MobileHeader } from '@/components/ui';
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

// 筛选器配置
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'approved', label: '已上架' },
  { key: 'rejected', label: '已下架' },
  { key: 'pending_review', label: '审核中' },
];

// ============ 主组件 ============
export default function StrategyManagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myStrategies, setMyStrategies] = useState<MyStrategy[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [filter, setFilter] = useState<string>('all');

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
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
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
      <div className="space-y-6">
        <MobileHeader title="策略管理" />
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-bg-tertiary rounded-lg" />
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
      {/* 页面标题 */}
      <MobileHeader title="策略管理" />

      {/* 页面描述 */}
      <p className="text-text-secondary text-sm -mt-2">
        管理您上传的策略，查看收益分成
      </p>

      {/* 收益概览卡片 */}
      <Card className="bg-gradient-to-r from-success/10 to-brand-primary/10 border-success/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-success" />
              我的收益
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/strategies/revenue')}
              className="text-xs"
            >
              <Eye className="w-3 h-3 mr-1" />
              收益明细
            </Button>
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

      {/* 筛选器 */}
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
          </button>
        ))}
      </div>

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

            // 交易类型
            const tradeType = strategy.tradeType || 'spot';

            return (
              <Card
                key={strategy.id}
                className="hover:border-brand-primary/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/strategies/${strategy.id}`)}
              >
                <CardContent className="p-3">
                  {/* 头部：名称 + 类型标签 + 状态标签 */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-white font-medium text-sm truncate flex-1">{strategy.name}</h3>
                    {/* 交易类型标签 */}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                      tradeType === 'futures'
                        ? 'bg-warning/20 text-warning'
                        : 'bg-brand-primary/20 text-brand-primary'
                    }`}>
                      {tradeType === 'futures' ? '合约' : '现货'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
                      <StatusIcon className={`w-2.5 h-2.5 ${strategy.reviewStatus === 'backtest_running' ? 'animate-spin' : ''}`} />
                      {statusStyle.label}
                    </span>
                  </div>

                  {/* 核心数据：回测收益/胜率/回撤/使用人数(已上架) */}
                  <div className="flex items-center gap-4 text-xs mb-2">
                    <div>
                      <span className="text-text-tertiary">收益 </span>
                      <span className={backtestReturn >= 0 ? 'text-success font-medium' : 'text-danger font-medium'}>
                        {backtestReturn >= 0 ? '+' : ''}{backtestReturn.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">胜率 </span>
                      <span className="text-white font-medium">{backtestWinRate.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">回撤 </span>
                      <span className="text-danger font-medium">{backtestDrawdown.toFixed(0)}%</span>
                    </div>
                    {strategy.reviewStatus === 'approved' && (
                      <div>
                        <span className="text-text-tertiary">使用 </span>
                        <span className="text-brand-primary font-medium">{strategy.totalUsers}人</span>
                      </div>
                    )}
                  </div>

                  {/* 辅助信息行 */}
                  <div className="flex items-center gap-3 text-xs text-text-tertiary mb-3">
                    {strategy.reviewStatus === 'trial' && (
                      <span className="text-brand-primary">
                        试运行 {strategy.trialTradesCount || 0}/10笔
                      </span>
                    )}
                    <span>{new Date(strategy.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>

                  {/* 操作按钮行 */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border-primary" onClick={e => e.stopPropagation()}>
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
    </div>
  );
}
