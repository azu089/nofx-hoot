'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: '策略市场 | QuantFi',
//   description: '浏览和订阅专业量化策略，查看策略表现、风险等级和历史收益',
// };
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui';
import { strategiesApi, Strategy } from '@/lib/api';
import {
  Zap,
  TrendingUp,
  Star,
  Users,
  RefreshCw,
  Search,
  Filter,
  Shield,
  AlertTriangle,
  Flame,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

type SortOption = 'default' | 'pnl-high' | 'pnl-low' | 'winrate-high' | 'winrate-low';

export default function StrategiesPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');

  const fetchStrategies = async () => {
    try {
      const res = await strategiesApi.list();
      setStrategies(res.data || []);
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  // 筛选和排序逻辑
  const filteredAndSortedStrategies = useMemo(() => {
    let result = [...strategies];

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query)
      );
    }

    // 风险等级过滤
    if (riskFilter !== 'all') {
      result = result.filter((s) => s.config?.riskLevel === riskFilter);
    }

    // 排序
    switch (sortOption) {
      case 'pnl-high':
        result.sort((a, b) => (b.performance_stats?.live?.total_pnl || 0) - (a.performance_stats?.live?.total_pnl || 0));
        break;
      case 'pnl-low':
        result.sort((a, b) => (a.performance_stats?.live?.total_pnl || 0) - (b.performance_stats?.live?.total_pnl || 0));
        break;
      case 'winrate-high':
        result.sort((a, b) => (b.performance_stats?.live?.win_rate || 0) - (a.performance_stats?.live?.win_rate || 0));
        break;
      case 'winrate-low':
        result.sort((a, b) => (a.performance_stats?.live?.win_rate || 0) - (b.performance_stats?.live?.win_rate || 0));
        break;
      default:
        // 保持默认顺序
        break;
    }

    return result;
  }, [strategies, searchQuery, riskFilter, sortOption]);

  const getRiskLevelStyle = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'low':
        return { text: '低风险', color: 'text-success', bg: 'bg-success/10' };
      case 'medium':
        return { text: '中风险', color: 'text-warning', bg: 'bg-warning/10' };
      case 'high':
        return { text: '高风险', color: 'text-danger', bg: 'bg-danger/10' };
      default:
        return { text: '未知', color: 'text-text-secondary', bg: 'bg-bg-tertiary' };
    }
  };

  const formatPnl = (pnl: number) => {
    if (pnl >= 10000) {
      return `$${(pnl / 1000).toFixed(1)}K`;
    }
    return `$${pnl.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">策略市场</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-bg-tertiary rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">策略市场</h1>
        <Button variant="ghost" size="sm" onClick={fetchStrategies}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <Input
                placeholder="搜索策略名称或描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* 风险等级筛选 */}
            <Select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)}
            >
              <option value="all">全部风险等级</option>
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
            </Select>

            {/* 排序 */}
            <Select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
            >
              <option value="default">默认排序</option>
              <option value="pnl-high">收益从高到低</option>
              <option value="pnl-low">收益从低到高</option>
              <option value="winrate-high">胜率从高到低</option>
              <option value="winrate-low">胜率从低到高</option>
            </Select>
          </div>

          {/* 筛选结果统计 */}
          <div className="mt-3 text-sm text-text-secondary flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>
              共找到 <span className="text-white font-medium">{filteredAndSortedStrategies.length}</span> 个策略
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 策略列表 */}
      {filteredAndSortedStrategies.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-text-secondary" />
            <p className="text-text-secondary">
              {strategies.length === 0 ? '暂无可用策略' : '没有符合条件的策略'}
            </p>
            {strategies.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setRiskFilter('all');
                  setSortOption('default');
                }}
              >
                清空筛选条件
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedStrategies.map((strategy) => {
            const risk = getRiskLevelStyle(strategy.config?.riskLevel);
            const stats = strategy.performance_stats;
            const tags = strategy.config?.tags || [];

            return (
              <Card
                key={strategy.id}
                className="hover:border-brand-primary/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/strategies/${strategy.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{strategy.name}</CardTitle>
                        <span className={`text-xs px-2 py-0.5 rounded ${risk.color} ${risk.bg}`}>
                          {risk.text}
                        </span>
                      </div>
                    </div>
                    <Star className="w-5 h-5 text-text-tertiary hover:text-warning cursor-pointer" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                    {strategy.description}
                  </p>

                  {/* 标签 */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 bg-bg-tertiary text-text-secondary rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-bg-tertiary/50 p-3 rounded-lg">
                      <p className="text-text-tertiary text-xs">实盘胜率</p>
                      <p className="text-white font-medium">
                        {stats?.live?.win_rate ?? 0}%
                      </p>
                    </div>
                    <div className="bg-bg-tertiary/50 p-3 rounded-lg">
                      <p className="text-text-tertiary text-xs">最大回撤</p>
                      <p className="text-danger font-medium">
                        {stats?.backtest?.max_drawdown ?? 0}%
                      </p>
                    </div>
                    <div className="bg-bg-tertiary/50 p-3 rounded-lg">
                      <p className="text-text-tertiary text-xs">累计盈利</p>
                      <p className="text-success font-medium">
                        {formatPnl(stats?.live?.total_pnl ?? 0)}
                      </p>
                    </div>
                    <div className="bg-bg-tertiary/50 p-3 rounded-lg">
                      <p className="text-text-tertiary text-xs">最低资本</p>
                      <p className="text-white font-medium">
                        ${strategy.config?.minInvestment?.toLocaleString() || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-text-tertiary mb-4">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      夏普比率: {stats?.backtest?.sharpe_ratio ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {stats?.live?.total_trades ?? 0} 笔交易
                    </span>
                  </div>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/strategies/${strategy.id}`);
                    }}
                  >
                    查看详情
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
