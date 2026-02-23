'use client';

import { useState, useCallback } from 'react';
import {
  Globe,
  Layers,
  Gift,
  Coins,
  Sliders,
  TrendingUp,
  Users,
  Lock,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  Plus,
  Play,
  Trophy,
  Calendar,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminPagination,
  AdminStatCard,
  AdminStatusBadge,
  AdminTabs,
  AdminConfirmDialog,
  type AdminColumn,
} from '@/components/admin/shared';
import {
  useAdminApi,
  useAdminList,
  useAdminMutation,
} from '@/hooks/useAdminApi';
import { adminApi } from '@/lib/admin-auth';

// ─── 类型定义 ───────────────────────────────────────────────

interface EcoStats {
  totalStaked: string;
  activeStakes: number;
  totalDividend: string;
  hootCirculation: string;
}

interface StakingOverview {
  totalStaked: string;
  activeCount: number;
  avgAPR: string;
  totalRewards: string;
}

interface StakingConfig {
  aprTypeA: string;
  aprTypeB: string;
  lockPeriodA: number;
  lockPeriodB: number;
  minAmount: string;
  maxAmount: string;
}

interface StakingRecord {
  id: string;
  userId: string;
  userEmail?: string;
  amount: string;
  type: string;
  status: string;
  startAt: string;
}

interface DividendOverview {
  totalDistributed: string;
  pendingAmount: string;
  lastDistributedAt: string;
  totalPools: number;
}

interface DividendPool {
  id: string;
  name: string;
  totalAmount: string;
  distributed: string;
  status: string;
  createdAt: string;
}

interface TokenOverview {
  totalSupply: string;
  circulation: string;
  locked: string;
  burned: string;
}

interface TokenCirculation {
  id: string;
  type: string;
  direction: string;
  amount: string;
  address?: string;
  createdAt: string;
}

interface TokenHolder {
  rank: number;
  userId: string;
  userEmail?: string;
  balance: string;
  percentage: string;
}

interface WeightConfig {
  stakingWeight: number;
  tradingWeight: number;
  referralWeight: number;
  holdingWeight: number;
}

// ─── Tab 1: 生态统计 ─────────────────────────────────────────

function EcoStatsTab() {
  const { data, loading, error, refetch } = useAdminApi<EcoStats>('/admin/ecosystem/stats');

  if (loading && !data) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <AdminStatCard
        title="总质押量"
        value={`${parseFloat(data?.totalStaked ?? '0').toLocaleString()} HOOT`}
        icon={Layers}
        color="bg-cyan-500/20 text-cyan-400"
      />
      <AdminStatCard
        title="活跃质押数"
        value={data?.activeStakes ?? 0}
        icon={TrendingUp}
        color="bg-green-500/20 text-green-400"
      />
      <AdminStatCard
        title="总分红"
        value={`$${parseFloat(data?.totalDividend ?? '0').toLocaleString()}`}
        icon={Gift}
        color="bg-purple-500/20 text-purple-400"
      />
      <AdminStatCard
        title="HOOT 流通量"
        value={`${parseFloat(data?.hootCirculation ?? '0').toLocaleString()}`}
        icon={Coins}
        color="bg-orange-500/20 text-orange-400"
      />
    </div>
  );
}

// ─── Tab 2: 质押管理 ─────────────────────────────────────────

function StakingTab() {
  const { data: overview, loading: ovLoading, error: ovError, refetch: ovRefetch } =
    useAdminApi<StakingOverview>('/admin/ecosystem/staking/overview');
  const { data: config, loading: cfgLoading, refetch: cfgRefetch } =
    useAdminApi<StakingConfig>('/admin/ecosystem/staking/config');

  const {
    items: leaderboard,
    loading: lbLoading,
    error: lbError,
    refetch: lbRefetch,
  } = useAdminList<StakingRecord>('/admin/ecosystem/staking/leaderboard', { defaultLimit: 10 });

  const {
    items: records,
    total,
    page,
    totalPages,
    loading: recLoading,
    setPage,
    setFilter,
    filters,
  } = useAdminList<StakingRecord>('/admin/ecosystem/staking/records', { defaultLimit: 15 });

  const { mutate, loading: saving } = useAdminMutation({
    onSuccess: () => { cfgRefetch(); setEditConfig(false); },
  });

  const [editConfig, setEditConfig] = useState(false);
  const [configForm, setConfigForm] = useState<Partial<StakingConfig>>({});

  const openEditConfig = useCallback(() => {
    setConfigForm(config ?? {});
    setEditConfig(true);
  }, [config]);

  const handleSaveConfig = useCallback(async () => {
    await mutate('/admin/ecosystem/staking/config', 'put', configForm);
  }, [mutate, configForm]);

  const leaderboardColumns: AdminColumn<StakingRecord>[] = [
    {
      key: 'rank',
      title: '排名',
      align: 'center',
      width: '60px',
      render: (row) => {
        const idx = leaderboard.indexOf(row);
        return (
          <span className={`font-bold text-sm ${idx < 3 ? 'text-yellow-400' : 'text-[#9090A0]'}`}>
            {idx + 1}
          </span>
        );
      },
    },
    {
      key: 'user',
      title: '用户',
      render: (row) => (
        <span className="text-sm text-white">{row.userEmail ?? row.userId.slice(0, 12) + '...'}</span>
      ),
    },
    {
      key: 'amount',
      title: '质押量',
      align: 'right',
      render: (row) => (
        <span className="text-sm text-cyan-400 font-mono">
          {parseFloat(row.amount).toLocaleString()} HOOT
        </span>
      ),
    },
    {
      key: 'type',
      title: '质押类型',
      align: 'center',
      width: '80px',
      render: (row) => (
        <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full">
          {row.type}
        </span>
      ),
    },
    {
      key: 'startAt',
      title: '开始时间',
      width: '140px',
      render: (row) => (
        <span className="text-xs text-[#9090A0]">
          {new Date(row.startAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
  ];

  const recordColumns: AdminColumn<StakingRecord>[] = [
    {
      key: 'user',
      title: '用户',
      render: (row) => (
        <span className="text-sm text-white">{row.userEmail ?? row.userId.slice(0, 12) + '...'}</span>
      ),
    },
    {
      key: 'amount',
      title: '质押量',
      align: 'right',
      render: (row) => (
        <span className="text-sm font-mono text-white">
          {parseFloat(row.amount).toLocaleString()} HOOT
        </span>
      ),
    },
    {
      key: 'type',
      title: '类型',
      align: 'center',
      width: '80px',
      render: (row) => <span className="text-sm text-[#9090A0]">{row.type}</span>,
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: '90px',
      render: (row) => <AdminStatusBadge status={row.status} />,
    },
    {
      key: 'startAt',
      title: '开始时间',
      width: '140px',
      render: (row) => (
        <span className="text-xs text-[#9090A0]">
          {new Date(row.startAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
  ];

  if (ovLoading && !overview) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (ovError) return <AdminErrorState message={ovError} onRetry={ovRefetch} />;

  return (
    <div className="space-y-6">
      {/* 总览卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="总质押量"
          value={`${parseFloat(overview?.totalStaked ?? '0').toLocaleString()}`}
          sub="HOOT"
          icon={Layers}
          color="bg-cyan-500/20 text-cyan-400"
        />
        <AdminStatCard
          title="活跃质押数"
          value={overview?.activeCount ?? 0}
          icon={Users}
          color="bg-green-500/20 text-green-400"
        />
        <AdminStatCard
          title="平均 APR"
          value={`${overview?.avgAPR ?? '0'}%`}
          icon={TrendingUp}
          color="bg-blue-500/20 text-blue-400"
        />
        <AdminStatCard
          title="总奖励发放"
          value={`${parseFloat(overview?.totalRewards ?? '0').toLocaleString()}`}
          sub="HOOT"
          icon={Gift}
          color="bg-purple-500/20 text-purple-400"
        />
      </div>

      {/* 质押配置 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-[#9090A0]" />
            <h2 className="text-sm font-medium text-white">质押配置</h2>
          </div>
          <button
            onClick={openEditConfig}
            disabled={cfgLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors disabled:opacity-50"
          >
            <Settings size={12} />
            编辑配置
          </button>
        </div>
        {cfgLoading ? (
          <AdminSkeleton mode="detail" count={4} />
        ) : config ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'A 类 APR', value: `${config.aprTypeA}%` },
              { label: 'B 类 APR', value: `${config.aprTypeB}%` },
              { label: 'A 类锁定期', value: `${config.lockPeriodA} 天` },
              { label: 'B 类锁定期', value: `${config.lockPeriodB} 天` },
              { label: '最小质押量', value: `${config.minAmount} HOOT` },
              { label: '最大质押量', value: `${config.maxAmount} HOOT` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0A0A0F] rounded-lg p-3 border border-[#1E1E2E]">
                <div className="text-xs text-[#9090A0] mb-1">{label}</div>
                <div className="text-sm font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9090A0]">暂无配置数据</p>
        )}
      </div>

      {/* 排行榜 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-yellow-400" />
          <h2 className="text-sm font-medium text-white">质押排行榜</h2>
        </div>
        {lbError ? (
          <AdminErrorState message={lbError} onRetry={lbRefetch} />
        ) : (
          <AdminTable<StakingRecord>
            columns={leaderboardColumns}
            data={leaderboard}
            rowKey="id"
            loading={lbLoading}
          />
        )}
      </div>

      {/* 质押记录 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">质押记录</h2>
          <select
            value={filters.status ?? ''}
            onChange={(e) => setFilter('status', e.target.value)}
            className="px-3 py-1.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">全部状态</option>
            <option value="active">进行中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <AdminTable<StakingRecord>
          columns={recordColumns}
          data={records}
          rowKey="id"
          loading={recLoading}
        />
        <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </div>

      {/* 编辑配置对话框 */}
      {editConfig && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditConfig(false)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-4">编辑质押配置</h3>
            <div className="space-y-3">
              {[
                { label: 'A 类 APR (%)', key: 'aprTypeA' },
                { label: 'B 类 APR (%)', key: 'aprTypeB' },
                { label: 'A 类锁定期（天）', key: 'lockPeriodA' },
                { label: 'B 类锁定期（天）', key: 'lockPeriodB' },
                { label: '最小质押量 (HOOT)', key: 'minAmount' },
                { label: '最大质押量 (HOOT)', key: 'maxAmount' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs text-[#9090A0] mb-1">{label}</label>
                  <input
                    type="text"
                    value={String(configForm[key as keyof StakingConfig] ?? '')}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditConfig(false)} className="px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] rounded-lg hover:bg-[#2A2A3A] transition-colors">取消</button>
              <button onClick={handleSaveConfig} disabled={saving} className="px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: 分红管理 ─────────────────────────────────────────

function DividendTab() {
  const { data: overview, loading: ovLoading, error: ovError, refetch: ovRefetch } =
    useAdminApi<DividendOverview>('/admin/ecosystem/dividend/overview');

  const { items: pools, loading: poolsLoading, error: poolsError, refetch: poolsRefetch } =
    useAdminList<DividendPool>('/admin/ecosystem/dividend-pools', { defaultLimit: 20 });

  const { mutate, loading: acting } = useAdminMutation({ onSuccess: () => poolsRefetch() });

  const [distributeId, setDistributeId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPool, setNewPool] = useState({ name: '', totalAmount: '' });

  const handleDistribute = useCallback(async () => {
    if (!distributeId) return;
    await mutate(`/admin/ecosystem/dividend-pools/${distributeId}/distribute`, 'post', {});
    setDistributeId(null);
  }, [mutate, distributeId]);

  const handleCreate = useCallback(async () => {
    if (!newPool.name || !newPool.totalAmount) { toast.error('请填写完整信息'); return; }
    await mutate('/admin/ecosystem/dividend-pools', 'post', newPool);
    setCreateOpen(false);
    setNewPool({ name: '', totalAmount: '' });
  }, [mutate, newPool]);

  const poolColumns: AdminColumn<DividendPool>[] = [
    {
      key: 'name',
      title: '池名称',
      render: (row) => <span className="text-sm text-white font-medium">{row.name}</span>,
    },
    {
      key: 'totalAmount',
      title: '总金额',
      align: 'right',
      render: (row) => (
        <span className="text-sm font-mono text-white">
          ${parseFloat(row.totalAmount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'distributed',
      title: '已分配',
      align: 'right',
      render: (row) => (
        <span className="text-sm font-mono text-green-400">
          ${parseFloat(row.distributed).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: '90px',
      render: (row) => <AdminStatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      width: '140px',
      render: (row) => (
        <span className="text-xs text-[#9090A0]">
          {new Date(row.createdAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'center',
      width: '100px',
      render: (row) =>
        row.status === 'pending' ? (
          <button
            onClick={() => setDistributeId(row.id)}
            className="flex items-center gap-1 px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/20 transition-colors"
          >
            <Play size={10} />
            分发
          </button>
        ) : (
          <span className="text-xs text-[#9090A0]">—</span>
        ),
    },
  ];

  if (ovLoading && !overview) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (ovError) return <AdminErrorState message={ovError} onRetry={ovRefetch} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="已分配总额" value={`$${parseFloat(overview?.totalDistributed ?? '0').toLocaleString()}`} icon={Gift} color="bg-purple-500/20 text-purple-400" />
        <AdminStatCard title="待分配金额" value={`$${parseFloat(overview?.pendingAmount ?? '0').toLocaleString()}`} icon={Clock} color="bg-yellow-500/20 text-yellow-400" />
        <AdminStatCard title="分红池总数" value={overview?.totalPools ?? 0} icon={Layers} color="bg-cyan-500/20 text-cyan-400" />
        <AdminStatCard
          title="最近分红"
          value={overview?.lastDistributedAt ? new Date(overview.lastDistributedAt).toLocaleDateString('zh-CN') : '—'}
          icon={Calendar}
          color="bg-green-500/20 text-green-400"
        />
      </div>

      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">分红池列表</h2>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors"
          >
            <Plus size={12} />
            新建分红池
          </button>
        </div>
        {poolsError ? (
          <AdminErrorState message={poolsError} onRetry={poolsRefetch} />
        ) : (
          <AdminTable<DividendPool>
            columns={poolColumns}
            data={pools}
            rowKey="id"
            loading={poolsLoading}
          />
        )}
      </div>

      <AdminConfirmDialog
        open={!!distributeId}
        onClose={() => setDistributeId(null)}
        onConfirm={handleDistribute}
        title="确认分发分红？"
        description="执行后将把该分红池金额按权重分发给所有符合条件的用户，操作不可撤销。"
        confirmText="确认分发"
        loading={acting}
      />

      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setCreateOpen(false)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-4">新建分红池</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">池名称</label>
                <input type="text" value={newPool.name} onChange={(e) => setNewPool((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50" placeholder="例：Q1 分红池" />
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">总金额 (USD)</label>
                <input type="text" value={newPool.totalAmount} onChange={(e) => setNewPool((p) => ({ ...p, totalAmount: e.target.value }))} className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50" placeholder="10000" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] rounded-lg hover:bg-[#2A2A3A] transition-colors">取消</button>
              <button onClick={handleCreate} disabled={acting} className="px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors disabled:opacity-50">{acting ? '创建中...' : '创建'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: 代币管理 ─────────────────────────────────────────

function TokenTab() {
  const { data: overview, loading: ovLoading, error: ovError, refetch: ovRefetch } =
    useAdminApi<TokenOverview>('/admin/ecosystem/token/overview');

  const { data: trendData, loading: trendLoading } =
    useAdminApi<{ date: string; amount: string }[]>('/admin/ecosystem/token/trend?days=30');

  const {
    items: circulation,
    total: circTotal,
    page: circPage,
    totalPages: circTotalPages,
    loading: circLoading,
    setPage: setCircPage,
    setFilter: setCircFilter,
    filters: circFilters,
  } = useAdminList<TokenCirculation>('/admin/ecosystem/token/circulation', { defaultLimit: 15 });

  const { items: holders, loading: holdersLoading } =
    useAdminList<TokenHolder>('/admin/ecosystem/token/holders', { defaultLimit: 10 });

  const trend = Array.isArray(trendData) ? trendData : [];
  const maxTrend = trend.length > 0 ? Math.max(...trend.map((t) => parseFloat(t.amount || '0')), 1) : 1;

  const circColumns: AdminColumn<TokenCirculation>[] = [
    {
      key: 'type',
      title: '类型',
      width: '100px',
      render: (row) => <span className="text-sm text-white">{row.type}</span>,
    },
    {
      key: 'direction',
      title: '方向',
      align: 'center',
      width: '70px',
      render: (row) =>
        row.direction === 'in' ? (
          <span className="flex items-center justify-center gap-1 text-green-400 text-xs">
            <ArrowDownRight size={12} /> 流入
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1 text-red-400 text-xs">
            <ArrowUpRight size={12} /> 流出
          </span>
        ),
    },
    {
      key: 'amount',
      title: '数量',
      align: 'right',
      render: (row) => (
        <span className={`text-sm font-mono ${row.direction === 'in' ? 'text-green-400' : 'text-red-400'}`}>
          {row.direction === 'in' ? '+' : '-'}{parseFloat(row.amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'createdAt',
      title: '时间',
      width: '140px',
      render: (row) => (
        <span className="text-xs text-[#9090A0]">
          {new Date(row.createdAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
  ];

  const holderColumns: AdminColumn<TokenHolder>[] = [
    { key: 'rank', title: '排名', align: 'center', width: '60px', render: (row) => <span className={`font-bold text-sm ${row.rank <= 3 ? 'text-yellow-400' : 'text-[#9090A0]'}`}>{row.rank}</span> },
    { key: 'user', title: '用户', render: (row) => <span className="text-sm text-white">{row.userEmail ?? row.userId?.slice(0, 12) + '...'}</span> },
    { key: 'balance', title: '持有量', align: 'right', render: (row) => <span className="text-sm font-mono text-white">{parseFloat(row.balance).toLocaleString()}</span> },
    { key: 'percentage', title: '占比', align: 'right', width: '80px', render: (row) => <span className="text-sm text-cyan-400">{row.percentage}%</span> },
  ];

  if (ovLoading && !overview) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (ovError) return <AdminErrorState message={ovError} onRetry={ovRefetch} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="总发行量" value={parseFloat(overview?.totalSupply ?? '0').toLocaleString()} icon={Coins} color="bg-cyan-500/20 text-cyan-400" />
        <AdminStatCard title="流通量" value={parseFloat(overview?.circulation ?? '0').toLocaleString()} icon={TrendingUp} color="bg-green-500/20 text-green-400" />
        <AdminStatCard title="锁仓量" value={parseFloat(overview?.locked ?? '0').toLocaleString()} icon={Lock} color="bg-yellow-500/20 text-yellow-400" />
        <AdminStatCard title="销毁量" value={parseFloat(overview?.burned ?? '0').toLocaleString()} icon={Flame} color="bg-red-500/20 text-red-400" />
      </div>

      {/* 流通趋势 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-[#9090A0]" />
          <h2 className="text-sm font-medium text-white">流通趋势（近30天）</h2>
        </div>
        {trendLoading ? (
          <div className="h-32 bg-[#0A0A0F] rounded-lg animate-pulse" />
        ) : (
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {trend.map((item, idx) => {
              const height = (parseFloat(item.amount || '0') / maxTrend) * 100;
              return (
                <div key={idx} className="flex-1 min-w-[8px] flex flex-col items-center justify-end group">
                  <div className="relative w-full">
                    <div
                      className="w-full bg-cyan-500/30 hover:bg-cyan-500/50 rounded-t transition-colors min-h-[2px]"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#2A2A3A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {item.date}: {parseFloat(item.amount || '0').toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
            {trend.length === 0 && <div className="w-full text-center text-sm text-[#9090A0] py-8">暂无趋势数据</div>}
          </div>
        )}
      </div>

      {/* 流通记录 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">流通记录</h2>
          <div className="flex gap-2">
            <select value={circFilters.type ?? ''} onChange={(e) => setCircFilter('type', e.target.value)} className="px-3 py-1.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50">
              <option value="">全部类型</option>
              <option value="mint">铸造</option>
              <option value="burn">销毁</option>
              <option value="transfer">转账</option>
              <option value="airdrop">空投</option>
            </select>
            <select value={circFilters.direction ?? ''} onChange={(e) => setCircFilter('direction', e.target.value)} className="px-3 py-1.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50">
              <option value="">全部方向</option>
              <option value="in">流入</option>
              <option value="out">流出</option>
            </select>
          </div>
        </div>
        <AdminTable<TokenCirculation> columns={circColumns} data={circulation} rowKey="id" loading={circLoading} />
        <AdminPagination page={circPage} totalPages={circTotalPages} total={circTotal} onPageChange={setCircPage} />
      </div>

      {/* 持仓排行 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-yellow-400" />
          <h2 className="text-sm font-medium text-white">持仓排行榜</h2>
        </div>
        <AdminTable<TokenHolder> columns={holderColumns} data={holders} rowKey="rank" loading={holdersLoading} />
      </div>
    </div>
  );
}

// ─── Tab 5: 权重配置 ─────────────────────────────────────────

function WeightsTab() {
  const { data: weights, loading, error, refetch } = useAdminApi<WeightConfig>('/admin/ecosystem/weights');
  const { mutate, loading: saving } = useAdminMutation({ onSuccess: () => { refetch(); setEditing(false); } });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<WeightConfig>>({});

  const openEdit = useCallback(() => { setForm(weights ?? {}); setEditing(true); }, [weights]);
  const handleSave = useCallback(async () => { await mutate('/admin/ecosystem/weights', 'put', form); }, [mutate, form]);

  if (loading && !weights) return <AdminSkeleton mode="detail" count={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const weightItems = [
    { key: 'stakingWeight' as const, label: '质押权重', icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { key: 'tradingWeight' as const, label: '交易权重', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/20' },
    { key: 'referralWeight' as const, label: '推荐权重', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { key: 'holdingWeight' as const, label: '持仓权重', icon: Coins, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={14} className="text-[#9090A0]" />
            <h2 className="text-sm font-medium text-white">权重配置</h2>
          </div>
          <button onClick={openEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors">
            <Settings size={12} />
            编辑权重
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {weightItems.map(({ key, label, icon: Icon, color, bg }) => (
            <div key={key} className="bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#9090A0]">{label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg} ${color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{weights?.[key] ?? 0}</div>
              <div className="mt-2 h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${bg.replace('/20', '/60')}`}
                  style={{ width: `${Math.min((weights?.[key] ?? 0), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#9090A0]">
          权重总和应为 100，当前合计：
          <span className={`font-medium ml-1 ${
            (weights ? Object.values(weights).reduce((a, b) => a + b, 0) : 0) === 100
              ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {weights ? Object.values(weights).reduce((a, b) => a + b, 0) : 0}
          </span>
        </p>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(false)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-4">编辑权重配置</h3>
            <div className="space-y-3">
              {weightItems.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-[#9090A0] mb-1">{label}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form[key] ?? 0}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              ))}
              <p className={`text-xs ${Object.values(form).reduce((a, b) => a + b, 0) === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                当前合计：{Object.values(form as Record<string, number>).reduce((a, b) => a + b, 0)}（应为 100）
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] rounded-lg hover:bg-[#2A2A3A] transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ─────────────────────────────────────────────────

const TABS = [
  { key: 'stats',    label: '生态统计', icon: Globe },
  { key: 'staking',  label: '质押管理', icon: Layers },
  { key: 'dividend', label: '分红管理', icon: Gift },
  { key: 'token',    label: '代币管理', icon: Coins },
  { key: 'weights',  label: '权重配置', icon: Sliders },
];

export default function AdminEcosystemPage() {
  const [activeTab, setActiveTab] = useState('stats');

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="生态管理"
        icon={Globe}
        subtitle="质押 · 分红 · 代币 · 权重配置"
      />

      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'stats'    && <EcoStatsTab />}
      {activeTab === 'staking'  && <StakingTab />}
      {activeTab === 'dividend' && <DividendTab />}
      {activeTab === 'token'    && <TokenTab />}
      {activeTab === 'weights'  && <WeightsTab />}
    </div>
  );
}
