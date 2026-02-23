'use client';

import { useState, useCallback } from 'react';
import {
  Users,
  UserCheck,
  DollarSign,
  Clock,
  Coins,
  BarChart2,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  Gift,
  Layers,
  Edit2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminPagination,
  AdminStatCard,
  AdminSearchBar,
  AdminConfirmDialog,
  AdminTabs,
  AdminStatusBadge,
  type AdminColumn,
} from '@/components/admin/shared';
import {
  useAdminApi,
  useAdminMutation,
  useAdminList,
} from '@/hooks/useAdminApi';
import { adminApi } from '@/lib/admin-auth';

// ─── 类型定义 ───────────────────────────────────────────────────

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalCommission: string;
  pendingCommission: string;
}

interface TokenStats {
  totalQuota: number;
  usedQuota: number;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  level: number;
  commissionRate: number;
  subordinateCount: number;
  status: string;
  createdAt: string;
}

interface TokenQuota {
  id: string;
  agentId: string;
  agentName: string;
  quota: number;
  used: number;
  status: string;
  createdAt: string;
}

interface DividendPool {
  id: string;
  name: string;
  totalAmount: string;
  participantCount: number;
  status: string;
  createdAt: string;
}

// ─── 表单弹窗 ───────────────────────────────────────────────────

function AgentFormDialog({
  open,
  onClose,
  editAgent,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  editAgent?: Agent;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: editAgent?.name ?? '',
    email: editAgent?.email ?? '',
    level: String(editAgent?.level ?? 1),
    commissionRate: String(editAgent?.commissionRate ?? 5),
  });
  const { mutate, loading } = useAdminMutation({ onSuccess });

  const handleSubmit = async () => {
    if (!form.name || !form.email) {
      toast.error('请填写姓名和邮箱');
      return;
    }
    const payload = {
      name: form.name,
      email: form.email,
      level: Number(form.level),
      commissionRate: Number(form.commissionRate),
    };
    if (editAgent) {
      await mutate(`/admin/agents/${editAgent.id}`, 'put', payload);
    } else {
      await mutate('/admin/agents', 'post', payload);
    }
    onClose();
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white mb-4">
          {editAgent ? '编辑代理商' : '新增代理商'}
        </h3>
        <div className="space-y-3">
          {[
            { label: '姓名', key: 'name', type: 'text', placeholder: '请输入姓名' },
            { label: '邮箱', key: 'email', type: 'email', placeholder: '请输入邮箱' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-[#9090A0] mb-1 block">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#9090A0] mb-1 block">等级</label>
              <select
                value={form.level}
                onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
              >
                {[1, 2, 3].map((l) => (
                  <option key={l} value={l}>等级 {l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#9090A0] mb-1 block">佣金率 (%)</label>
              <input
                type="number"
                min={0}
                max={50}
                value={form.commissionRate}
                onChange={(e) => setForm((p) => ({ ...p, commissionRate: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-[#9090A0] hover:text-white bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {editAgent ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuotaFormDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ agentId: '', quota: '1000' });
  const { mutate, loading } = useAdminMutation({ onSuccess });

  const handleSubmit = async () => {
    if (!form.agentId) { toast.error('请填写代理商 ID'); return; }
    await mutate('/admin/agents/token/quotas', 'post', {
      agentId: form.agentId,
      quota: Number(form.quota),
    });
    onClose();
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white mb-4">新增代币配额</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#9090A0] mb-1 block">代理商 ID</label>
            <input
              value={form.agentId}
              onChange={(e) => setForm((p) => ({ ...p, agentId: e.target.value }))}
              placeholder="请输入代理商 ID"
              className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-[#9090A0] mb-1 block">配额量</label>
            <input
              type="number"
              min={1}
              value={form.quota}
              onChange={(e) => setForm((p) => ({ ...p, quota: e.target.value }))}
              className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50">
            {loading && <Loader2 size={14} className="animate-spin" />}
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

function PoolFormDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ name: '', totalAmount: '' });
  const { mutate, loading } = useAdminMutation({ onSuccess });

  const handleSubmit = async () => {
    if (!form.name || !form.totalAmount) { toast.error('请填写完整信息'); return; }
    await mutate('/admin/agents/token/dividend-pools', 'post', form);
    onClose();
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white mb-4">创建分红池</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#9090A0] mb-1 block">池名称</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="请输入分红池名称" className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div>
            <label className="text-xs text-[#9090A0] mb-1 block">总金额 (USDT)</label>
            <input type="number" min={0} value={form.totalAmount} onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50">
            {loading && <Loader2 size={14} className="animate-spin" />}
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: 代理商统计 ─────────────────────────────────────────────

function StatsTab() {
  const { data: stats, loading, error, refetch } = useAdminApi<AgentStats>('/admin/agents/stats');
  const { data: tokenStats } = useAdminApi<TokenStats>('/admin/agents/token/stats');

  if (loading) return <AdminSkeleton mode="grid" count={6} cols={3} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <AdminStatCard title="总代理商数" value={stats?.totalAgents ?? 0} icon={Users} color="bg-cyan-500/10 text-cyan-400" />
      <AdminStatCard title="活跃代理商" value={stats?.activeAgents ?? 0} icon={UserCheck} color="bg-green-500/10 text-green-400" />
      <AdminStatCard title="总佣金" value={`$${Number(stats?.totalCommission ?? 0).toFixed(2)}`} icon={DollarSign} color="bg-purple-500/10 text-purple-400" />
      <AdminStatCard title="待结算佣金" value={`$${Number(stats?.pendingCommission ?? 0).toFixed(2)}`} icon={Clock} color="bg-yellow-500/10 text-yellow-400" />
      <AdminStatCard title="代币配额总量" value={tokenStats?.totalQuota ?? 0} icon={Coins} color="bg-orange-500/10 text-orange-400" />
      <AdminStatCard title="已使用配额" value={tokenStats?.usedQuota ?? 0} sub={tokenStats ? `使用率 ${Math.round((tokenStats.usedQuota / (tokenStats.totalQuota || 1)) * 100)}%` : undefined} icon={BarChart2} color="bg-blue-500/10 text-blue-400" />
    </div>
  );
}

// ─── Tab: 代理商列表 ─────────────────────────────────────────────

function AgentsListTab() {
  const { items, total, page, totalPages, loading, error, search, setPage, setSearch, setFilter, refetch } =
    useAdminList<Agent>('/admin/agents');

  const { mutate: doMutate, loading: actionLoading } = useAdminMutation({ onSuccess: refetch });

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Agent | undefined>(undefined);
  const [settleTarget, setSettleTarget] = useState<Agent | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ agent: Agent; action: 'approve' | 'reject' } | null>(null);

  const handleReview = useCallback(async () => {
    if (!reviewTarget) return;
    await doMutate(`/admin/agents/${reviewTarget.agent.id}/review`, 'post', { action: reviewTarget.action });
    setReviewTarget(null);
  }, [reviewTarget, doMutate]);

  const handleSettle = useCallback(async () => {
    if (!settleTarget) return;
    await doMutate(`/admin/agents/${settleTarget.id}/settle`, 'post', {});
    setSettleTarget(null);
  }, [settleTarget, doMutate]);

  const columns: AdminColumn<Agent>[] = [
    { key: 'name', title: '名称', render: (r) => <span className="font-medium text-white">{r.name}</span> },
    { key: 'email', title: '邮箱', render: (r) => <span className="text-[#9090A0] text-xs">{r.email}</span> },
    { key: 'level', title: '等级', align: 'center', render: (r) => <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs rounded-full">Lv.{r.level}</span> },
    { key: 'commissionRate', title: '佣金率', align: 'center', render: (r) => <span className="text-white">{r.commissionRate}%</span> },
    { key: 'subordinateCount', title: '下级数', align: 'center', render: (r) => <span className="text-white">{r.subordinateCount}</span> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} map={{ pending: { label: '待审核', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' } }} /> },
    {
      key: 'actions', title: '操作', align: 'center', width: '200px',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => { setEditTarget(r); setShowForm(true); }} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-cyan-400 transition-colors" title="编辑"><Edit2 size={13} /></button>
          {r.status === 'pending' && (
            <>
              <button onClick={() => setReviewTarget({ agent: r, action: 'approve' })} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-green-400 transition-colors" title="批准"><CheckCircle size={13} /></button>
              <button onClick={() => setReviewTarget({ agent: r, action: 'reject' })} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-red-400 transition-colors" title="拒绝"><XCircle size={13} /></button>
            </>
          )}
          {r.status === 'active' && (
            <button onClick={() => setSettleTarget(r)} className="px-2 py-1 text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded transition-colors">结算</button>
          )}
        </div>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <AdminSearchBar
          value={search}
          onChange={setSearch}
          onSearch={refetch}
          placeholder="搜索姓名、邮箱..."
          filters={
            <div className="flex gap-2">
              <select onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none">
                <option value="">全部状态</option>
                <option value="active">活跃</option>
                <option value="pending">待审核</option>
                <option value="suspended">停用</option>
              </select>
              <select onChange={(e) => setFilter('level', e.target.value)} className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none">
                <option value="">全部等级</option>
                <option value="1">Lv.1</option>
                <option value="2">Lv.2</option>
                <option value="3">Lv.3</option>
              </select>
            </div>
          }
        />
        <button
          onClick={() => { setEditTarget(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={14} />
          新增代理商
        </button>
      </div>

      <AdminTable<Agent> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <AgentFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        editAgent={editTarget}
        onSuccess={refetch}
      />

      <AdminConfirmDialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onConfirm={handleReview}
        title={reviewTarget?.action === 'approve' ? '批准代理商申请' : '拒绝代理商申请'}
        description={`确认${reviewTarget?.action === 'approve' ? '批准' : '拒绝'} ${reviewTarget?.agent.name} 的代理商申请？`}
        confirmText={reviewTarget?.action === 'approve' ? '确认批准' : '确认拒绝'}
        variant={reviewTarget?.action === 'reject' ? 'danger' : 'default'}
        loading={actionLoading}
      />

      <AdminConfirmDialog
        open={!!settleTarget}
        onClose={() => setSettleTarget(null)}
        onConfirm={handleSettle}
        title="结算佣金"
        description={`确认结算 ${settleTarget?.name} 的全部待结算佣金？`}
        confirmText="确认结算"
        loading={actionLoading}
      />
    </div>
  );
}

// ─── Tab: 代币配额 ───────────────────────────────────────────────

function TokenQuotasTab() {
  const { items, total, page, totalPages, loading, error, setPage, setFilter, refetch } =
    useAdminList<TokenQuota>('/admin/agents/token/quotas');
  const { mutate: doMutate, loading: actionLoading } = useAdminMutation({ onSuccess: refetch });

  const [showForm, setShowForm] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ quota: TokenQuota; action: 'approve' | 'reject' } | null>(null);

  const handleReview = useCallback(async () => {
    if (!reviewTarget) return;
    await doMutate(`/admin/agents/token/quotas/${reviewTarget.quota.id}/review`, 'post', { action: reviewTarget.action });
    setReviewTarget(null);
  }, [reviewTarget, doMutate]);

  const columns: AdminColumn<TokenQuota>[] = [
    { key: 'agentName', title: '代理商', render: (r) => <span className="text-white font-medium">{r.agentName}</span> },
    { key: 'quota', title: '配额量', align: 'right', render: (r) => <span className="font-mono text-white">{r.quota.toLocaleString()}</span> },
    { key: 'used', title: '已使用', align: 'right', render: (r) => <span className="font-mono text-cyan-400">{r.used.toLocaleString()}</span> },
    {
      key: 'progress', title: '使用率', align: 'center',
      render: (r) => {
        const pct = Math.round((r.used / (r.quota || 1)) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-[#9090A0]">{pct}%</span>
          </div>
        );
      },
    },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} map={{ pending: { label: '待审核', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' } }} /> },
    { key: 'createdAt', title: '申请时间', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span> },
    {
      key: 'actions', title: '操作', align: 'center',
      render: (r) => r.status === 'pending' ? (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => setReviewTarget({ quota: r, action: 'approve' })} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-green-400 transition-colors" title="批准"><CheckCircle size={13} /></button>
          <button onClick={() => setReviewTarget({ quota: r, action: 'reject' })} className="p-1.5 hover:bg-[#1E1E2E] rounded text-[#9090A0] hover:text-red-400 transition-colors" title="拒绝"><XCircle size={13} /></button>
        </div>
      ) : <span className="text-[#9090A0] text-xs">-</span>,
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <select onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none">
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="active">已激活</option>
          <option value="rejected">已拒绝</option>
        </select>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors">
          <Plus size={14} />
          新增配额
        </button>
      </div>

      <AdminTable<TokenQuota> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <QuotaFormDialog open={showForm} onClose={() => setShowForm(false)} onSuccess={refetch} />

      <AdminConfirmDialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onConfirm={handleReview}
        title={reviewTarget?.action === 'approve' ? '批准配额申请' : '拒绝配额申请'}
        description={`确认${reviewTarget?.action === 'approve' ? '批准' : '拒绝'} ${reviewTarget?.quota.agentName} 的配额申请？`}
        confirmText={reviewTarget?.action === 'approve' ? '确认批准' : '确认拒绝'}
        variant={reviewTarget?.action === 'reject' ? 'danger' : 'default'}
        loading={actionLoading}
      />
    </div>
  );
}

// ─── Tab: 分红池 ─────────────────────────────────────────────────

function DividendPoolsTab() {
  const { items, total, page, totalPages, loading, error, setPage, refetch } =
    useAdminList<DividendPool>('/admin/agents/token/dividend-pools');
  const { mutate: doMutate, loading: actionLoading } = useAdminMutation({ onSuccess: refetch });

  const [showForm, setShowForm] = useState(false);
  const [distributeTarget, setDistributeTarget] = useState<DividendPool | null>(null);

  const handleDistribute = useCallback(async () => {
    if (!distributeTarget) return;
    await doMutate(`/admin/agents/token/dividend-pools/${distributeTarget.id}/distribute`, 'post', {});
    setDistributeTarget(null);
  }, [distributeTarget, doMutate]);

  const columns: AdminColumn<DividendPool>[] = [
    { key: 'name', title: '池名称', render: (r) => <span className="text-white font-medium">{r.name}</span> },
    { key: 'totalAmount', title: '总金额', align: 'right', render: (r) => <span className="font-mono text-white">${Number(r.totalAmount).toFixed(2)}</span> },
    { key: 'participantCount', title: '参与人数', align: 'center', render: (r) => <span className="text-white">{r.participantCount}</span> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} map={{ distributed: { label: '已分发', color: 'bg-green-500/10 text-green-400 border-green-500/20' }, pending: { label: '待分发', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' } }} /> },
    { key: 'createdAt', title: '创建时间', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span> },
    {
      key: 'actions', title: '操作', align: 'center',
      render: (r) => r.status === 'pending' ? (
        <button onClick={() => setDistributeTarget(r)} className="px-2 py-1 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded transition-colors">分发</button>
      ) : <span className="text-[#9090A0] text-xs">已分发</span>,
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors">
          <Plus size={14} />
          创建分红池
        </button>
      </div>

      <AdminTable<DividendPool> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <PoolFormDialog open={showForm} onClose={() => setShowForm(false)} onSuccess={refetch} />

      <AdminConfirmDialog
        open={!!distributeTarget}
        onClose={() => setDistributeTarget(null)}
        onConfirm={handleDistribute}
        title="确认分发分红"
        description={`确认向 ${distributeTarget?.participantCount} 位参与者分发「${distributeTarget?.name}」共 $${Number(distributeTarget?.totalAmount ?? 0).toFixed(2)}？此操作不可撤销。`}
        confirmText="确认分发"
        loading={actionLoading}
      />
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────

const TABS = [
  { key: 'stats', label: '代理商统计', icon: BarChart2 },
  { key: 'list', label: '代理商列表', icon: Users },
  { key: 'quotas', label: '代币配额', icon: Coins },
  { key: 'pools', label: '分红池', icon: Gift },
];

export default function AdminAgentsPage() {
  const [activeTab, setActiveTab] = useState('stats');

  return (
    <div className="p-6 space-y-5">
      <AdminPageHeader
        title="代理商管理"
        icon={Layers}
        subtitle="管理代理商账户、代币配额与分红池"
      />

      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div>
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'list' && <AgentsListTab />}
        {activeTab === 'quotas' && <TokenQuotasTab />}
        {activeTab === 'pools' && <DividendPoolsTab />}
      </div>
    </div>
  );
}
