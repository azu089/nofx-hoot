'use client';

import { useState, useCallback } from 'react';
import {
  Share2,
  Users,
  DollarSign,
  TrendingUp,
  Settings,
  GitBranch,
  Award,
  Trophy,
  Loader2,
  RefreshCw,
  ChevronRight,
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

interface ReferralOverview {
  totalInvitees: number;
  totalRewardAmount: string;
  monthlyInvitees: number;
  monthlyRewardAmount: string;
}

interface ReferralConfig {
  level1Rate: number;
  level2Rate: number;
  level3Rate: number;
}

interface ReferralRelation {
  id: string;
  inviterId: string;
  inviterEmail: string;
  inviteeId: string;
  inviteeEmail: string;
  level: number;
  createdAt: string;
}

interface ReferralReward {
  id: string;
  userId: string;
  userEmail: string;
  sourceUserId: string;
  sourceUserEmail: string;
  amount: string;
  level: number;
  status: string;
  createdAt: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userEmail: string;
  inviteeCount: number;
  totalReward: string;
}

// ─── Tab: 返佣总览 ───────────────────────────────────────────────

function OverviewTab() {
  const { data, loading, error, refetch } = useAdminApi<ReferralOverview>('/admin/referral/overview');

  if (loading) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <AdminStatCard title="总邀请人数" value={data?.totalInvitees ?? 0} icon={Users} color="bg-cyan-500/10 text-cyan-400" />
      <AdminStatCard title="总返佣金额" value={`$${Number(data?.totalRewardAmount ?? 0).toFixed(2)}`} icon={DollarSign} color="bg-green-500/10 text-green-400" />
      <AdminStatCard title="本月邀请" value={data?.monthlyInvitees ?? 0} icon={TrendingUp} color="bg-purple-500/10 text-purple-400" />
      <AdminStatCard title="本月返佣" value={`$${Number(data?.monthlyRewardAmount ?? 0).toFixed(2)}`} icon={Award} color="bg-yellow-500/10 text-yellow-400" />
    </div>
  );
}

// ─── Tab: 返佣配置 ───────────────────────────────────────────────

function ConfigTab() {
  const { data, loading, error, refetch } = useAdminApi<ReferralConfig>('/admin/referral/config');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ level1Rate: '', level2Rate: '', level3Rate: '' });
  const { mutate, loading: saving } = useAdminMutation({ onSuccess: () => { refetch(); setEditing(false); } });

  const openEdit = () => {
    if (!data) return;
    setForm({
      level1Rate: String(data.level1Rate),
      level2Rate: String(data.level2Rate),
      level3Rate: String(data.level3Rate),
    });
    setEditing(true);
  };

  const handleSave = async () => {
    await mutate('/admin/referral/config', 'put', {
      level1Rate: Number(form.level1Rate),
      level2Rate: Number(form.level2Rate),
      level3Rate: Number(form.level3Rate),
    });
  };

  if (loading) return <AdminSkeleton mode="grid" count={3} cols={3} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const LEVEL_COLORS = [
    'border-yellow-500/30 bg-yellow-500/5',
    'border-cyan-500/30 bg-cyan-500/5',
    'border-purple-500/30 bg-purple-500/5',
  ];
  const LEVEL_TEXT = ['text-yellow-400', 'text-cyan-400', 'text-purple-400'];
  const levels = [
    { label: '一级返佣', key: 'level1Rate' as const, value: data?.level1Rate ?? 0 },
    { label: '二级返佣', key: 'level2Rate' as const, value: data?.level2Rate ?? 0 },
    { label: '三级返佣', key: 'level3Rate' as const, value: data?.level3Rate ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!editing ? (
          <button onClick={openEdit} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm border border-cyan-500/20 rounded-lg transition-colors">
            <Settings size={14} />
            编辑配置
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} disabled={saving} className="px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors">取消</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />}
              保存
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {levels.map((level, idx) => (
          <div key={level.key} className={`border rounded-xl p-5 ${LEVEL_COLORS[idx]}`}>
            <p className="text-sm text-[#9090A0] mb-3">{level.label}</p>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form[level.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [level.key]: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-2xl font-bold text-white focus:outline-none focus:border-cyan-500/50"
                />
                <span className={`text-2xl font-bold ${LEVEL_TEXT[idx]}`}>%</span>
              </div>
            ) : (
              <p className={`text-4xl font-bold ${LEVEL_TEXT[idx]}`}>{level.value}%</p>
            )}
            <p className="text-xs text-[#9090A0] mt-2">
              {idx === 0 ? '直接邀请奖励' : idx === 1 ? '间接邀请（2级）奖励' : '间接邀请（3级）奖励'}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
        <p className="text-sm text-[#9090A0]">
          返佣计算：当被邀请用户产生收益时，按照各级比例自动结算返佣到邀请人钱包，每日自动结算。
        </p>
      </div>
    </div>
  );
}

// ─── Tab: 邀请关系 ───────────────────────────────────────────────

function RelationsTab() {
  const { items, total, page, totalPages, loading, error, search, setPage, setSearch, refetch } =
    useAdminList<ReferralRelation>('/admin/referral/relations');

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [invitees, setInvitees] = useState<ReferralRelation[]>([]);
  const [inviteesLoading, setInviteesLoading] = useState(false);

  const loadInvitees = useCallback(async (userId: string) => {
    setSelectedUserId(userId);
    setInviteesLoading(true);
    try {
      const res = await adminApi.get<{ items: ReferralRelation[] }>(`/admin/referral/users/${userId}/invitees`);
      setInvitees(res.data.items ?? []);
    } catch {
      toast.error('加载下级列表失败');
    } finally {
      setInviteesLoading(false);
    }
  }, []);

  const columns: AdminColumn<ReferralRelation>[] = [
    { key: 'inviter', title: '邀请人', render: (r) => <span className="text-white text-sm">{r.inviterEmail}</span> },
    { key: 'invitee', title: '被邀请人', render: (r) => <span className="text-white text-sm">{r.inviteeEmail}</span> },
    { key: 'level', title: '层级', align: 'center', render: (r) => <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full">L{r.level}</span> },
    { key: 'createdAt', title: '邀请时间', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span> },
    {
      key: 'actions', title: '查看下级', align: 'center',
      render: (r) => (
        <button onClick={() => loadInvitees(r.inviterId)} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
          查看下级 <ChevronRight size={12} />
        </button>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <AdminSearchBar value={search} onChange={setSearch} onSearch={refetch} placeholder="搜索用户邮箱..." />

      <AdminTable<ReferralRelation> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {/* 下级列表弹窗 */}
      {selectedUserId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUserId(null)}>
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">下级邀请列表</h3>
              <button onClick={() => setSelectedUserId(null)} className="text-[#9090A0] hover:text-white transition-colors">✕</button>
            </div>
            {inviteesLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-cyan-400" /></div>
            ) : invitees.length === 0 ? (
              <p className="text-center text-[#9090A0] py-8">暂无下级</p>
            ) : (
              <div className="space-y-2">
                {invitees.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-[#0A0A0F] rounded-lg">
                    <span className="text-sm text-white">{inv.inviteeEmail}</span>
                    <span className="text-xs text-[#9090A0]">{new Date(inv.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: 奖励记录 ───────────────────────────────────────────────

function RewardsTab() {
  const { items, total, page, totalPages, loading, error, setPage, setFilter, refetch } =
    useAdminList<ReferralReward>('/admin/referral/rewards');
  const { mutate: doMutate, loading: batchLoading } = useAdminMutation({ onSuccess: refetch });
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  const handleBatchProcess = useCallback(async () => {
    await doMutate('/admin/referral/process-pending', 'post', {});
    setShowBatchConfirm(false);
  }, [doMutate]);

  const columns: AdminColumn<ReferralReward>[] = [
    { key: 'userEmail', title: '用户', render: (r) => <span className="text-white text-sm">{r.userEmail}</span> },
    { key: 'sourceEmail', title: '来源用户', render: (r) => <span className="text-[#9090A0] text-sm">{r.sourceUserEmail}</span> },
    { key: 'amount', title: '奖励金额', align: 'right', render: (r) => <span className="font-mono text-green-400">${Number(r.amount).toFixed(4)}</span> },
    { key: 'level', title: '层级', align: 'center', render: (r) => <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full">L{r.level}</span> },
    { key: 'status', title: '状态', align: 'center', render: (r) => <AdminStatusBadge status={r.status} map={{ settled: { label: '已结算', color: 'bg-green-500/10 text-green-400 border-green-500/20' }, cancelled: { label: '已取消', color: 'bg-red-500/10 text-red-400 border-red-500/20' } }} /> },
    { key: 'createdAt', title: '时间', align: 'center', render: (r) => <span className="text-[#9090A0] text-xs">{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span> },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <select onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none">
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="settled">已结算</option>
          <option value="cancelled">已取消</option>
        </select>
        <button
          onClick={() => setShowBatchConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-sm border border-green-500/20 rounded-lg transition-colors"
        >
          <RefreshCw size={14} />
          批量处理待结算
        </button>
      </div>

      <AdminTable<ReferralReward> columns={columns} data={items} rowKey="id" loading={loading} />
      <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <AdminConfirmDialog
        open={showBatchConfirm}
        onClose={() => setShowBatchConfirm(false)}
        onConfirm={handleBatchProcess}
        title="批量处理待结算奖励"
        description="将所有状态为「待处理」的返佣奖励一次性结算到用户钱包。此操作不可撤销。"
        confirmText="确认批量结算"
        loading={batchLoading}
      />
    </div>
  );
}

// ─── Tab: 排行榜 ─────────────────────────────────────────────────

function LeaderboardTab() {
  const { data, loading, error, refetch } = useAdminApi<{ items: LeaderboardEntry[] }>('/admin/referral/leaderboard');

  if (loading) return <AdminSkeleton mode="table" count={10} />;
  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  const RANK_STYLES: Record<number, string> = {
    1: 'text-yellow-400 font-bold',
    2: 'text-[#C0C0C0] font-bold',
    3: 'text-amber-600 font-bold',
  };

  const columns: AdminColumn<LeaderboardEntry>[] = [
    {
      key: 'rank', title: '排名', align: 'center', width: '80px',
      render: (r) => (
        <span className={RANK_STYLES[r.rank] ?? 'text-[#9090A0]'}>
          {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}
        </span>
      ),
    },
    { key: 'userEmail', title: '用户', render: (r) => <span className="text-white font-medium">{r.userEmail}</span> },
    { key: 'inviteeCount', title: '邀请人数', align: 'center', render: (r) => <span className="text-cyan-400 font-mono">{r.inviteeCount}</span> },
    { key: 'totalReward', title: '总返佣金额', align: 'right', render: (r) => <span className="text-green-400 font-mono font-semibold">${Number(r.totalReward).toFixed(2)}</span> },
  ];

  return (
    <AdminTable<LeaderboardEntry>
      columns={columns}
      data={data?.items ?? []}
      rowKey="userId"
    />
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: '返佣总览', icon: TrendingUp },
  { key: 'config', label: '返佣配置', icon: Settings },
  { key: 'relations', label: '邀请关系', icon: GitBranch },
  { key: 'rewards', label: '奖励记录', icon: DollarSign },
  { key: 'leaderboard', label: '排行榜', icon: Trophy },
];

export default function AdminReferralPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 space-y-5">
      <AdminPageHeader
        title="返佣管理"
        icon={Share2}
        subtitle="管理邀请返佣配置、邀请关系与奖励记录"
      />

      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'relations' && <RelationsTab />}
        {activeTab === 'rewards' && <RewardsTab />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
      </div>
    </div>
  );
}
