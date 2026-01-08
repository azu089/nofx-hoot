'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, Button, StrategiesSkeleton, NetworkError } from '@/components/ui';
import { strategiesApi, Strategy } from '@/lib/api';
import {
  Zap,
  Search,
  SlidersHorizontal,
  FolderOpen,
  Upload,
} from 'lucide-react';

// 排序选项：热门、最新
type SortOption = 'popular' | 'newest';
type SourceFilter = 'all' | 'official' | 'community';
// 策略类型：网格、趋势、定投、套利、剥头皮、波段
type StrategyType = 'all' | 'grid' | 'trend' | 'dca' | 'arbitrage' | 'scalping' | 'swing';
// 交易类型：现货/合约
type TradeTypeFilter = 'all' | 'spot' | 'futures';

// 策略类型配置
const STRATEGY_TYPES: Record<StrategyType, { label: string; icon: string; color: string }> = {
  all: { label: '全部类型', icon: '', color: '' },
  grid: { label: '网格策略', icon: '📊', color: 'text-brand-primary' },
  trend: { label: '趋势策略', icon: '📈', color: 'text-success' },
  dca: { label: '定投策略', icon: '💰', color: 'text-warning' },
  arbitrage: { label: '套利策略', icon: '⚖️', color: 'text-cyan-400' },
  scalping: { label: '剥头皮', icon: '⚡', color: 'text-purple-400' },
  swing: { label: '波段策略', icon: '🌊', color: 'text-blue-400' },
};


export default function StrategiesPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<StrategyType>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [tradeTypeFilter, setTradeTypeFilter] = useState<TradeTypeFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('popular');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = async () => {
    try {
      setError(null);
      setLoading(true);
      // 使用服务器端筛选和排序
      const res = await strategiesApi.list({
        type: typeFilter === 'all' ? undefined : typeFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        sort: sortOption,
      });
      setStrategies(res.data || []);
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
      setError('无法加载策略列表，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, [typeFilter, sourceFilter, tradeTypeFilter, sortOption]);

  // 前端只处理搜索过滤和交易类型（策略类型、来源、排序由服务器处理）
  const filteredStrategies = useMemo(() => {
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

    // 交易类型过滤（现货/合约）
    if (tradeTypeFilter !== 'all') {
      result = result.filter((s) => {
        const strategyTradeType = (s as any).trade_type || 'spot'; // 默认现货
        return strategyTradeType === tradeTypeFilter;
      });
    }

    return result;
  }, [strategies, searchQuery, tradeTypeFilter]);


  if (loading) {
    return <StrategiesSkeleton />;
  }

  // P2优化：显示网络错误状态
  if (error && strategies.length === 0) {
    return <NetworkError onRetry={fetchStrategies} />;
  }

  return (
    <div className="space-y-3 lg:space-y-6 pb-20 lg:pb-0">
      {/* ===== 移动端布局 ===== */}
      <div className="lg:hidden">
        {/* 顶部搜索栏 - 搜索框 + 右侧筛选按钮 */}
        <div className="flex items-center gap-2 mb-3">
          {/* 搜索框 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索策略..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand-primary"
            />
          </div>
          {/* 筛选按钮 - 右侧外部 */}
          <button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className={`p-2.5 rounded-lg transition-colors ${
              filterPanelOpen ? 'bg-brand-primary text-white' : 'bg-bg-secondary border border-border-primary text-text-secondary'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* 移动端筛选面板（搜索栏下方展开）*/}
        {filterPanelOpen && (
          <div className="bg-bg-secondary rounded-xl p-4 mb-3 border border-border-primary">
            <div className="space-y-4">
              {/* 策略类型 */}
              <div>
                <label className="text-sm text-text-secondary mb-2 block">策略类型</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STRATEGY_TYPES).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setTypeFilter(key as StrategyType)}
                      className={`px-3 py-1.5 rounded-lg text-xs ${
                        typeFilter === key
                          ? 'bg-brand-primary text-white'
                          : 'bg-bg-tertiary text-text-secondary'
                      }`}
                    >
                      {config.icon} {config.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 来源 */}
              <div>
                <label className="text-sm text-text-secondary mb-2 block">来源</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSourceFilter('all')}
                    className={`px-4 py-1.5 rounded-lg text-xs ${sourceFilter === 'all' ? 'bg-brand-primary text-white' : 'bg-bg-tertiary text-text-secondary'}`}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setSourceFilter('official')}
                    className={`px-4 py-1.5 rounded-lg text-xs ${sourceFilter === 'official' ? 'bg-brand-primary text-white' : 'bg-bg-tertiary text-text-secondary'}`}
                  >
                    ✅ 官方
                  </button>
                  <button
                    onClick={() => setSourceFilter('community')}
                    className={`px-4 py-1.5 rounded-lg text-xs ${sourceFilter === 'community' ? 'bg-brand-primary text-white' : 'bg-bg-tertiary text-text-secondary'}`}
                  >
                    👤 社区
                  </button>
                </div>
              </div>

              {/* 交易类型 */}
              <div>
                <label className="text-sm text-text-secondary mb-2 block">交易类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTradeTypeFilter('all')}
                    className={`px-4 py-1.5 rounded-lg text-xs ${tradeTypeFilter === 'all' ? 'bg-brand-primary text-white' : 'bg-bg-tertiary text-text-secondary'}`}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setTradeTypeFilter('spot')}
                    className={`px-4 py-1.5 rounded-lg text-xs ${tradeTypeFilter === 'spot' ? 'bg-brand-primary text-white' : 'bg-bg-tertiary text-text-secondary'}`}
                  >
                    📊 现货
                  </button>
                  <button
                    onClick={() => setTradeTypeFilter('futures')}
                    className={`px-4 py-1.5 rounded-lg text-xs ${tradeTypeFilter === 'futures' ? 'bg-warning text-white' : 'bg-bg-tertiary text-text-secondary'}`}
                  >
                    ⚡ 合约
                  </button>
                </div>
              </div>

              {/* 排序 */}
              <div>
                <label className="text-sm text-text-secondary mb-2 block">排序方式</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'popular', label: '🔥 热门' },
                    { key: 'newest', label: '🆕 最新' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setSortOption(opt.key as SortOption)}
                      className={`px-3 py-1.5 rounded-lg text-xs ${
                        sortOption === opt.key
                          ? 'bg-brand-primary text-white'
                          : 'bg-bg-tertiary text-text-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                    setSourceFilter('all');
                    setTradeTypeFilter('all');
                    setSortOption('popular');
                  }}
                >
                  重置
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setFilterPanelOpen(false)}
                >
                  确认
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 功能入口按钮 - 两个并排 */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/strategies/my')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary/10 border border-brand-primary/30 rounded-lg text-brand-primary text-sm font-medium"
          >
            <FolderOpen className="w-4 h-4" />
            我的策略
          </button>
          <button
            onClick={() => router.push('/strategies/manage')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-secondary border border-border-primary rounded-lg text-text-secondary text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            策略管理
          </button>
        </div>
      </div>

      {/* ===== 桌面端布局 ===== */}
      <div className="hidden lg:block">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">策略市场</h1>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => router.push('/strategies/my')}>
              <FolderOpen className="w-4 h-4 mr-2" />
              我的策略
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/strategies/manage')}>
              <Upload className="w-4 h-4 mr-2" />
              策略管理
            </Button>
          </div>
        </div>

        {/* 筛选栏 */}
        <Card variant="glass" className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* 搜索框 */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="搜索策略名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* 类型筛选 */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as StrategyType)}
                className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm appearance-none cursor-pointer pr-8"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23848E9C'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
              >
                <option value="all">全部类型</option>
                <option value="grid">📊 网格</option>
                <option value="trend">📈 趋势</option>
                <option value="dca">💰 定投</option>
                <option value="arbitrage">⚖️ 套利</option>
                <option value="scalping">⚡ 剥头皮</option>
                <option value="swing">🌊 波段</option>
              </select>

              {/* 来源筛选 */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm appearance-none cursor-pointer pr-8"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23848E9C'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
              >
                <option value="all">全部来源</option>
                <option value="official">✅ 官方</option>
                <option value="community">👤 社区</option>
              </select>

              {/* 交易类型筛选 */}
              <select
                value={tradeTypeFilter}
                onChange={(e) => setTradeTypeFilter(e.target.value as TradeTypeFilter)}
                className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm appearance-none cursor-pointer pr-8"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23848E9C'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
              >
                <option value="all">全部类型</option>
                <option value="spot">📊 现货</option>
                <option value="futures">⚡ 合约</option>
              </select>

              {/* 排序 */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary text-sm appearance-none cursor-pointer pr-8"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23848E9C'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
              >
                <option value="popular">🔥 热门</option>
                <option value="newest">🆕 最新</option>
              </select>
            </div>

            {/* 结果统计 */}
            <div className="mt-3 pt-3 border-t border-border-primary/30 flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                共找到 <span className="text-brand-primary font-medium">{filteredStrategies.length}</span> 个策略
              </span>
              {(searchQuery || typeFilter !== 'all' || sourceFilter !== 'all' || tradeTypeFilter !== 'all' || sortOption !== 'popular') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                    setSourceFilter('all');
                    setTradeTypeFilter('all');
                    setSortOption('popular');
                  }}
                  className="text-text-tertiary hover:text-white text-sm"
                >
                  清空筛选
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 策略列表 */}
      {filteredStrategies.length === 0 ? (
        <Card variant="glass">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
              <Zap className="w-8 h-8 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {strategies.length === 0 ? '暂无可用策略' : '没有符合条件的策略'}
            </h3>
            <p className="text-text-secondary text-sm">
              {strategies.length === 0 ? '策略正在准备中' : '尝试调整筛选条件'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {filteredStrategies.map((strategy) => {
            // 获取交易类型
            const tradeType = (strategy as any).trade_type || 'spot';

            // 获取回测数据
            const backtestWinRate = Number((strategy as any).backtest_win_rate ?? strategy.performance_stats?.backtest?.win_rate ?? 0);
            const backtestMaxDrawdown = Number((strategy as any).backtest_max_drawdown ?? strategy.performance_stats?.backtest?.max_drawdown ?? 0);
            const backtestTotalReturn = Number((strategy as any).backtest_total_return ?? 0);
            const sharpeRatio = (backtestTotalReturn / (backtestMaxDrawdown || 1) * 0.5).toFixed(2);

            return (
              <Card
                key={strategy.id}
                variant="glass"
                hover
                className="overflow-hidden"
              >
                <CardContent className="p-3">
                  {/* 第一行：策略名称 + 标签 */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-medium text-sm truncate flex-1 min-w-0">{strategy.name}</h3>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        tradeType === 'futures'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-brand-primary/15 text-brand-primary'
                      }`}>
                        {tradeType === 'futures' ? '合约' : '现货'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        strategy.owner_type === 'system'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-success/15 text-success'
                      }`}>
                        {strategy.owner_type === 'system' ? '官方' : '社区'}
                      </span>
                    </div>
                  </div>

                  {/* 第二行：三指标横排 */}
                  <div className="grid grid-cols-3 gap-2 py-2 bg-bg-tertiary/50 rounded-md px-2 mb-2">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">{backtestWinRate.toFixed(0)}%</p>
                      <p className="text-[10px] text-text-tertiary">胜率</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-danger">-{backtestMaxDrawdown.toFixed(0)}%</p>
                      <p className="text-[10px] text-text-tertiary">回撤</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">{sharpeRatio}</p>
                      <p className="text-[10px] text-text-tertiary">夏普</p>
                    </div>
                  </div>

                  {/* 第三行：双按钮 */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => router.push(`/strategies/${strategy.id}`)}
                    >
                      详情
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => router.push(`/trading/backtest?strategyId=${strategy.id}`)}
                    >
                      回测
                    </Button>
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
