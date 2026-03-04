'use client';

import { useState } from 'react';
import {
  Brain,
  Layers,
  FileSearch,
  DollarSign,
  SlidersHorizontal,
  ScrollText,
  Square,
  Eye,
  RotateCcw,
  Ban,
  TrendingUp,
  Users,
  Zap,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminColumn,
  AdminPagination,
  AdminStatCard,
  AdminSearchBar,
  AdminConfirmDialog,
  AdminTabs,
  AdminStatusBadge,
} from '@/components/admin/shared';
import {
  useAdminApi,
  useAdminMutation,
  useAdminList,
} from '@/hooks/useAdminApi';

// ─── 类型定义 ───────────────────────────────────────────────

interface AiOverview {
  activeStrategies: number;
  totalResearch: number;
  monthlyCost: number;
  avgAccuracy: number;
}

interface AiStrategy {
  id: string;
  userId: string;
  userEmail: string;
  symbol: string;
  tradingMode: 'solo' | 'debate' | 'research';
  status: 'running' | 'stopped' | 'paused';
  createdAt: string;
}

interface AiStrategyDetail {
  id: string;
  userId: string;
  symbol: string;
  tradingMode: string;
  status: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface AiResearch {
  id: string;
  userId: string;
  userEmail: string;
  symbol: string;
  status: string;
  decision: 'buy' | 'sell' | 'hold';
  confidence: number;
  createdAt: string;
}

interface AiCostData {
  totalTokens: number;
  totalCost: number;
  byUser: {
    userId: string;
    email: string;
    tokens: number;
    cost: number;
  }[];
}

interface AiConfig {
  userId: string;
  userEmail: string;
  isEnabled: boolean;
  defaultModel: string;
  budgetLimit: number;
  monthlyUsage: number;
}

interface AiLog {
  id: string;
  userId: string;
  userEmail: string;
  strategyId: string;
  symbol: string;
  decision: 'buy' | 'sell' | 'hold';
  confidence: number;
  executed: boolean;
  createdAt: string;
}

// ─── 辅助组件 ───────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ActionBtn({
  onClick,
  children,
  variant = 'default',
  loading,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  loading?: boolean;
}) {
  const styles = {
    default: 'bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#9090A0] hover:text-white',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400',
    success: 'bg-green-500/10 hover:bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400',
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      {loading && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}

const TRADING_MODE_MAP = {
  solo: { label: '极速(Solo)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  debate: { label: '共识(Debate)', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  research: { label: '深研(Research)', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  grid: { label: '网格(Grid)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const DECISION_MAP = {
  buy: { label: '买入', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  sell: { label: '卖出', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  hold: { label: '持有', color: 'bg-[#9090A0]/10 text-[#9090A0] border-[#9090A0]/20' },
};

// ─── Tab 1: AI 总览 ──────────────────────────────────────────

function AiOverviewTab() {
  const { data: overview, loading, error, refetch } = useAdminApi<AiOverview>('/admin/ai/overview');

  if (loading) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard
          title="活跃策略数"
          value={overview?.activeStrategies ?? 0}
          icon={Zap}
          color="bg-cyan-500/10 text-cyan-400"
          sub="当前运行中"
        />
        <AdminStatCard
          title="总研究数"
          value={overview?.totalResearch ?? 0}
          icon={FileSearch}
          color="bg-blue-500/10 text-blue-400"
          sub="累计分析"
        />
        <AdminStatCard
          title="本月成本"
          value={`$${overview?.monthlyCost?.toFixed(2) ?? '0.00'}`}
          icon={DollarSign}
          color="bg-yellow-500/10 text-yellow-400"
          sub="LLM 调用费用"
        />
        <AdminStatCard
          title="平均决策准确率"
          value={`${overview?.avgAccuracy?.toFixed(1) ?? '0'}%`}
          icon={TrendingUp}
          color="bg-green-500/10 text-green-400"
          sub="盈利信号占比"
        />
      </div>

      {/* 快速导航 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '查看所有策略', desc: '管理用户 AI 策略运行状态', tab: 'strategies', icon: Layers, color: 'border-cyan-500/20 hover:border-cyan-500/40' },
          { label: '研究记录', desc: '查看 AI 市场分析报告', tab: 'research', icon: FileSearch, color: 'border-blue-500/20 hover:border-blue-500/40' },
          { label: '成本统计', desc: '监控 LLM 调用费用', tab: 'cost', icon: DollarSign, color: 'border-yellow-500/20 hover:border-yellow-500/40' },
        ].map((item) => (
          <div
            key={item.tab}
            className={`bg-[#12121A] border rounded-xl p-4 transition-colors cursor-pointer ${item.color}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon size={16} className="text-[#9090A0]" />
              <span className="text-sm font-medium text-white">{item.label}</span>
            </div>
            <p className="text-xs text-[#9090A0]">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 2: 策略管理 ─────────────────────────────────────────

function AiStrategyTab() {
  const { items, total, page, totalPages, loading, error, search, setSearch, setPage, setFilter, filters, refetch } =
    useAdminList<AiStrategy>('/admin/ai/strategies');
  const { mutate, loading: mutLoading } = useAdminMutation({ onSuccess: () => refetch() });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const { data: detail, loading: detailLoading } = useAdminApi<AiStrategyDetail>(
    `/admin/ai/strategies/${detailId}`,
    { enabled: !!detailId }
  );

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const handleForceStop = async () => {
    if (!stopId) return;
    await mutate(`/admin/ai/strategies/${stopId}/force-stop`, 'post', {});
    setStopId(null);
  };

  const columns: AdminColumn<AiStrategy>[] = [
    { key: 'user', title: '用户', render: (r) => <span className="text-xs text-[#9090A0]">{r.userEmail}</span> },
    { key: 'symbol', title: '交易对', render: (r) => <span className="font-mono text-cyan-400 text-xs">{r.symbol}</span> },
    { key: 'tradingMode', title: '模式', align: 'center', render: (r) => <AdminStatusBadge status={r.tradingMode} map={TRADING_MODE_MAP} /> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    { key: 'createdAt', title: '创建时间', render: (r) => new Date(r.createdAt).toLocaleDateString('zh-CN') },
    {
      key: 'actions', title: '操作', align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <ActionBtn onClick={() => setDetailId(r.id)}><Eye size={12} /> 详情</ActionBtn>
          {r.status === 'running' && (
            <ActionBtn onClick={() => setStopId(r.id)} variant="danger" loading={mutLoading}>
              <Square size={12} /> 强制停止
            </ActionBtn>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearchBar value={search} onChange={setSearch} onSearch={() => {}} placeholder="搜索用户/交易对..." />
        <FilterSelect
          value={filters.status ?? ''}
          onChange={(v) => setFilter('status', v)}
          options={[
            { value: '', label: '全部状态' },
            { value: 'running', label: '运行中' },
            { value: 'paused', label: '已暂停' },
            { value: 'stopped', label: '已停止' },
          ]}
        />
        <FilterSelect
          value={filters.tradingMode ?? ''}
          onChange={(v) => setFilter('tradingMode', v)}
          options={[
            { value: '', label: '全部模式' },
            { value: 'solo', label: '极速(Solo)' },
            { value: 'debate', label: '共识(Debate)' },
            { value: 'research', label: '深研(Research)' },
          ]}
        />
      </div>
      <AdminTable<AiStrategy> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {/* 详情弹窗 */}
      {detailId && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">策略详情</h3>
              <ActionBtn onClick={() => setDetailId(null)}>关闭</ActionBtn>
            </div>
            {detailLoading ? (
              <AdminSkeleton mode="detail" count={5} />
            ) : detail ? (
              <div className="space-y-3">
                {[
                  ['ID', detail.id],
                  ['用户', detail.userId],
                  ['交易对', detail.symbol],
                  ['模式', detail.tradingMode],
                  ['状态', detail.status],
                  ['创建时间', new Date(detail.createdAt).toLocaleString('zh-CN')],
                  ['更新时间', new Date(detail.updatedAt).toLocaleString('zh-CN')],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-4 py-1.5 border-b border-[#1E1E2E] last:border-0">
                    <span className="text-xs text-[#9090A0] w-20 shrink-0">{label}</span>
                    <span className="text-sm text-white break-all">{value}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="text-xs text-[#9090A0] mb-2">策略配置</p>
                  <pre className="text-xs text-[#9090A0] bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-3 overflow-auto max-h-48">
                    {JSON.stringify(detail.config, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#9090A0]">无法加载详情</p>
            )}
          </div>
        </div>
      )}

      <AdminConfirmDialog
        open={!!stopId}
        onClose={() => setStopId(null)}
        onConfirm={handleForceStop}
        title="强制停止策略"
        description="此操作将立即终止策略运行，当前周期的决策将被中断。"
        confirmText="强制停止"
        variant="danger"
        loading={mutLoading}
      />
    </div>
  );
}

// ─── Tab 3: 研究管理 ─────────────────────────────────────────

function AiResearchTab() {
  const { items, total, page, totalPages, loading, error, search, setSearch, setPage, setFilter, filters, refetch } =
    useAdminList<AiResearch>('/admin/ai/research');

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const columns: AdminColumn<AiResearch>[] = [
    { key: 'user', title: '用户', render: (r) => <span className="text-xs text-[#9090A0]">{r.userEmail}</span> },
    { key: 'symbol', title: '交易对', render: (r) => <span className="font-mono text-cyan-400 text-xs">{r.symbol}</span> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} /> },
    { key: 'decision', title: '决策', align: 'center', render: (r) => <AdminStatusBadge status={r.decision} map={DECISION_MAP} /> },
    {
      key: 'confidence', title: '置信度', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400"
              style={{ width: `${Math.min(r.confidence * 100, 100)}%` }}
            />
          </div>
          <span className="text-sm text-white">{(r.confidence * 100).toFixed(0)}%</span>
        </div>
      ),
    },
    { key: 'createdAt', title: '创建时间', render: (r) => new Date(r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearchBar value={search} onChange={setSearch} onSearch={() => {}} placeholder="搜索用户/交易对..." />
        <FilterSelect
          value={filters.status ?? ''}
          onChange={(v) => setFilter('status', v)}
          options={[{ value: '', label: '全部状态' }, { value: 'completed', label: '已完成' }, { value: 'running', label: '进行中' }, { value: 'failed', label: '失败' }]}
        />
        <FilterSelect
          value={filters.symbol ?? ''}
          onChange={(v) => setFilter('symbol', v)}
          options={[{ value: '', label: '全部交易对' }, { value: 'BTC/USDT', label: 'BTC/USDT' }, { value: 'ETH/USDT', label: 'ETH/USDT' }, { value: 'SOL/USDT', label: 'SOL/USDT' }]}
        />
      </div>
      <AdminTable<AiResearch> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}

// ─── Tab 4: 成本统计 ─────────────────────────────────────────

function AiCostTab() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { data: cost, loading, error, refetch } = useAdminApi<AiCostData>(
    `/admin/ai/cost?period=${period}`,
    { deps: [period] }
  );

  if (loading) return <AdminSkeleton mode="grid" count={2} cols={2} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* 周期选择器 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#9090A0]">统计周期</span>
        {(['7d', '30d', '90d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              period === p
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20'
                : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:text-white'
            }`}
          >
            {p === '7d' ? '近 7 天' : p === '30d' ? '近 30 天' : '近 90 天'}
          </button>
        ))}
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <AdminStatCard
          title="总 Token 消耗"
          value={cost?.totalTokens?.toLocaleString() ?? '0'}
          icon={Zap}
          color="bg-cyan-500/10 text-cyan-400"
          sub="Tokens"
        />
        <AdminStatCard
          title="总成本"
          value={`$${cost?.totalCost?.toFixed(4) ?? '0.0000'}`}
          icon={DollarSign}
          color="bg-yellow-500/10 text-yellow-400"
          sub="美元"
        />
      </div>

      {/* 用户排行 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4">用户成本排行</h3>
        {(cost?.byUser ?? []).length === 0 ? (
          <p className="text-sm text-[#9090A0] text-center py-6">暂无数据</p>
        ) : (
          <div className="space-y-3">
            {(cost?.byUser ?? []).map((u, idx) => {
              const maxCost = Math.max(...(cost?.byUser ?? []).map((x) => x.cost), 1);
              return (
                <div key={u.userId} className="flex items-center gap-3">
                  <span className="text-xs text-[#9090A0] w-5 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white truncate">{u.email}</span>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-xs text-[#9090A0]">{u.tokens.toLocaleString()} tokens</span>
                        <span className="text-sm font-medium text-yellow-400">${u.cost.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-[#1E1E2E] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-400/60"
                        style={{ width: `${(u.cost / maxCost) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 5: 用户配置 ─────────────────────────────────────────

function AiConfigTab() {
  const { items, total, page, totalPages, loading, error, search, setSearch, setPage, setFilter, filters, refetch } =
    useAdminList<AiConfig>('/admin/ai/configs');
  const { mutate, loading: mutLoading } = useAdminMutation({ onSuccess: () => refetch() });

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [disableUserId, setDisableUserId] = useState<string | null>(null);

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const handleResetKeys = async () => {
    if (!resetUserId) return;
    await mutate(`/admin/ai/configs/${resetUserId}/reset-keys`, 'post', {});
    setResetUserId(null);
  };

  const handleDisable = async () => {
    if (!disableUserId) return;
    await mutate(`/admin/ai/configs/${disableUserId}/disable`, 'post', {});
    setDisableUserId(null);
  };

  const columns: AdminColumn<AiConfig>[] = [
    { key: 'user', title: '用户', render: (r) => <span className="text-sm text-white">{r.userEmail}</span> },
    {
      key: 'isEnabled', title: '启用状态', align: 'center',
      render: (r) => (
        <AdminStatusBadge
          status={r.isEnabled ? 'active' : 'suspended'}
          map={{
            active: { label: '已启用', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
            suspended: { label: '已禁用', color: 'bg-[#9090A0]/10 text-[#9090A0] border-[#9090A0]/20' },
          }}
        />
      ),
    },
    { key: 'defaultModel', title: '默认模型', render: (r) => <span className="text-xs font-mono text-[#9090A0]">{r.defaultModel}</span> },
    {
      key: 'budgetLimit', title: '预算上限', align: 'right',
      render: (r) => <span className="text-sm">${r.budgetLimit?.toFixed(2)}/月</span>,
    },
    {
      key: 'monthlyUsage', title: '本月用量', align: 'right',
      render: (r) => {
        const pct = r.budgetLimit > 0 ? (r.monthlyUsage / r.budgetLimit) * 100 : 0;
        return (
          <div className="flex items-center justify-end gap-2">
            <span className={`text-sm ${pct >= 80 ? 'text-red-400' : 'text-white'}`}>
              ${r.monthlyUsage?.toFixed(2)}
            </span>
            <span className="text-xs text-[#9090A0]">({pct.toFixed(0)}%)</span>
          </div>
        );
      },
    },
    {
      key: 'actions', title: '操作', align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <ActionBtn onClick={() => setResetUserId(r.userId)} loading={mutLoading}>
            <RotateCcw size={12} /> 重置Key
          </ActionBtn>
          {r.isEnabled && (
            <ActionBtn onClick={() => setDisableUserId(r.userId)} loading={mutLoading} variant="danger">
              <Ban size={12} /> 禁用AI
            </ActionBtn>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearchBar value={search} onChange={setSearch} onSearch={() => {}} placeholder="搜索用户..." />
        <FilterSelect
          value={filters.isEnabled ?? ''}
          onChange={(v) => setFilter('isEnabled', v)}
          options={[{ value: '', label: '全部状态' }, { value: 'true', label: '已启用' }, { value: 'false', label: '已禁用' }]}
        />
      </div>
      <AdminTable<AiConfig> columns={columns} data={items} rowKey="userId" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <AdminConfirmDialog
        open={!!resetUserId}
        onClose={() => setResetUserId(null)}
        onConfirm={handleResetKeys}
        title="重置用户 AI Key"
        description="将清除该用户配置的自定义 LLM API Key，恢复使用平台默认 Key。"
        confirmText="确认重置"
        loading={mutLoading}
      />
      <AdminConfirmDialog
        open={!!disableUserId}
        onClose={() => setDisableUserId(null)}
        onConfirm={handleDisable}
        title="禁用用户 AI 功能"
        description="禁用后该用户将无法创建或运行任何 AI 策略。"
        confirmText="确认禁用"
        variant="danger"
        loading={mutLoading}
      />
    </div>
  );
}

// ─── Tab 6: 决策日志 ─────────────────────────────────────────

function AiLogTab() {
  const { items, total, page, totalPages, loading, error, search, setSearch, setPage, setFilter, filters, refetch } =
    useAdminList<AiLog>('/admin/ai/logs');

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const columns: AdminColumn<AiLog>[] = [
    { key: 'user', title: '用户', render: (r) => <span className="text-xs text-[#9090A0]">{r.userEmail}</span> },
    {
      key: 'strategyId', title: '策略 ID', width: '140px',
      render: (r) => (
        <span
          className="text-xs font-mono text-[#9090A0] cursor-default"
          title={r.strategyId}
        >
          {r.strategyId ? r.strategyId.slice(0, 8) + '…' : '-'}
        </span>
      ),
    },
    { key: 'symbol', title: '交易对', render: (r) => <span className="font-mono text-cyan-400 text-xs">{r.symbol}</span> },
    { key: 'decision', title: '决策', align: 'center', render: (r) => <AdminStatusBadge status={r.decision} map={DECISION_MAP} /> },
    {
      key: 'confidence', title: '置信度', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <div className="w-12 h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400"
              style={{ width: `${Math.min(r.confidence * 100, 100)}%` }}
            />
          </div>
          <span className="text-sm text-white">{(r.confidence * 100).toFixed(0)}%</span>
        </div>
      ),
    },
    {
      key: 'executed', title: '已执行', align: 'center',
      render: (r) => r.executed
        ? <CheckCircle size={14} className="text-green-400 mx-auto" />
        : <span className="text-xs text-[#9090A0]">未执行</span>,
    },
    { key: 'createdAt', title: '时间', render: (r) => new Date(r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearchBar value={search} onChange={setSearch} onSearch={() => {}} placeholder="搜索用户/策略..." />
        <FilterSelect
          value={filters.action ?? ''}
          onChange={(v) => setFilter('action', v)}
          options={[{ value: '', label: '全部决策' }, { value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }, { value: 'hold', label: '持有' }]}
        />
        <FilterSelect
          value={filters.executed ?? ''}
          onChange={(v) => setFilter('executed', v)}
          options={[{ value: '', label: '全部' }, { value: 'true', label: '已执行' }, { value: 'false', label: '未执行' }]}
        />
      </div>
      <AdminTable<AiLog> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'AI 总览', icon: Brain },
  { key: 'strategies', label: '策略管理', icon: Layers },
  { key: 'research', label: '研究管理', icon: FileSearch },
  { key: 'cost', label: '成本统计', icon: DollarSign },
  { key: 'configs', label: '用户配置', icon: SlidersHorizontal },
  { key: 'logs', label: '决策日志', icon: ScrollText },
];

export default function AdminAiPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="AI 管理"
        icon={Brain}
        subtitle="监控 AI 策略运行、成本分析与决策日志"
      />
      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <div>
        {activeTab === 'overview' && <AiOverviewTab />}
        {activeTab === 'strategies' && <AiStrategyTab />}
        {activeTab === 'research' && <AiResearchTab />}
        {activeTab === 'cost' && <AiCostTab />}
        {activeTab === 'configs' && <AiConfigTab />}
        {activeTab === 'logs' && <AiLogTab />}
      </div>
    </div>
  );
}
