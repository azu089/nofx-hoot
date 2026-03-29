'use client';

import { useState } from 'react';
import {
  Users,
  BarChart3,
  UserCheck,
  UserPlus,
  Ban,
  CheckCircle,
  Wallet,
  KeyRound,
  MessageSquare,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminEmptyState,
  AdminTable,
  AdminPagination,
  AdminStatCard,
  AdminSearchBar,
  AdminConfirmDialog,
  AdminTabs,
  AdminStatusBadge,
  AdminColumn,
} from '@/components/admin/shared';
import { useAdminApi, useAdminList, useAdminMutation } from '@/hooks/useAdminApi';
import { adminApi } from '@/lib/admin-auth';

// ─────────────────────────── 类型 ───────────────────────────

interface UserItem {
  id: string;
  uid?: number;
  email: string;
  nickname: string;
  status: string;
  usdtBalance: string;
  hootBalance: string;
  pointBalance: string;
  telegramUsername?: string;
  walletAddress?: string;
  createdAt: string;
}

interface UserStats {
  totalUsers: number;
  activeToday: number;
  newToday: number;
  newThisWeek: number;
}

interface TrendItem {
  date: string;
  count: number;
}

interface AssetItem {
  range: string;
  count: number;
}

interface SourceItem {
  source: string;
  count: number;
}

// ─────────────────────────── 用户详情对话框 ───────────────────────────

function UserDetailDialog({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: user, loading, error, refetch } = useAdminApi<UserItem>(
    `/admin/users/${userId}`,
    { enabled: !!userId }
  );
  const { mutate, loading: mutLoading } = useAdminMutation({ onSuccess: () => { refetch(); onChanged(); } });

  // 余额调整 state
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceType, setBalanceType] = useState<'usdt' | 'hoot'>('usdt');
  const [balanceAction, setBalanceAction] = useState<'adjust' | 'deduct'>('adjust');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);

  // 各确认对话框
  const [confirmDialog, setConfirmDialog] = useState<
    null | 'reset-password' | 'unbind-tg' | 'unbind-wallet'
  >(null);

  const handleBalanceSubmit = async () => {
    if (!balanceAmount || isNaN(parseFloat(balanceAmount))) {
      toast.error('请输入有效金额');
      return;
    }
    setBalanceLoading(true);
    try {
      await adminApi.post(`/admin/users/${userId}/adjust-balance`, {
        asset: balanceType,
        action: balanceAction === 'adjust' ? 'add' : 'subtract',
        amount: balanceAmount,
        reason: '管理员手动调整',
      });
      toast.success('余额调整成功');
      setBalanceOpen(false);
      setBalanceAmount('');
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    const pathMap = {
      'reset-password': [`/admin/users/${userId}/reset-password`, 'post'] as const,
      'unbind-tg': [`/admin/users/${userId}/unbind-telegram`, 'delete'] as const,
      'unbind-wallet': [`/admin/users/${userId}/unbind-wallet`, 'delete'] as const,
    };
    const [path, method] = pathMap[confirmDialog];
    await mutate(path, method);
    setConfirmDialog(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12121A] border border-[#1E1E2E] rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E2E]">
          <h3 className="text-base font-semibold text-white">用户详情</h3>
          <button onClick={onClose} className="text-[#9090A0] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading && <div className="py-8 text-center text-[#9090A0] text-sm">加载中...</div>}
          {error && <div className="py-4 text-center text-red-400 text-sm">{error}</div>}
          {user && (
            <>
              {/* 基本信息 */}
              <div className="space-y-2 text-sm">
                {[
                  ['短 ID', user.uid ? `USR${user.uid}` : '-'],
                  ['邮箱', user.email],
                  ['昵称', user.nickname || '-'],
                  ['状态', <AdminStatusBadge key="s" status={user.status} />],
                  ['USDT 余额', `${parseFloat(user.usdtBalance).toFixed(2)} USDT`],
                  ['HOOT 余额', `${parseFloat(user.hootBalance).toFixed(4)} HOOT`],
                  ['GAS 余额', `${parseFloat(user.pointBalance || '0').toFixed(2)}`],
                  ['TG 用户名', user.telegramUsername || '未绑定'],
                  ['钱包地址', user.walletAddress ? `${user.walletAddress.slice(0, 10)}...` : '未绑定'],
                  ['注册时间', new Date(user.createdAt).toLocaleString('zh-CN')],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex items-center gap-3">
                    <span className="w-24 text-[#9090A0] shrink-0">{label}</span>
                    <span className="text-white">{val}</span>
                  </div>
                ))}
                {/* 完整 UUID（仅详情显示） */}
                <div className="flex items-start gap-3 pt-1 border-t border-[#1E1E2E]">
                  <span className="w-24 text-[#9090A0] shrink-0 text-xs pt-0.5">用户 UUID</span>
                  <span
                    className="text-[#64748B] text-xs font-mono break-all cursor-pointer hover:text-[#9090A0] transition-colors"
                    title="点击复制"
                    onClick={() => { navigator.clipboard.writeText(user.id); }}
                  >
                    {user.id}
                  </span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setBalanceOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/20 transition-colors"
                >
                  <Wallet size={14} />
                  余额调整
                </button>
                <button
                  onClick={() => setConfirmDialog('reset-password')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-sm rounded-lg border border-yellow-500/20 transition-colors"
                >
                  <KeyRound size={14} />
                  密码重置
                </button>
                <button
                  onClick={() => setConfirmDialog('unbind-tg')}
                  disabled={!user.telegramUsername}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm rounded-lg border border-blue-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={14} />
                  解绑 TG
                </button>
                <button
                  onClick={() => setConfirmDialog('unbind-wallet')}
                  disabled={!user.walletAddress}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm rounded-lg border border-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Wallet size={14} />
                  解绑钱包
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 余额调整弹窗 */}
      {balanceOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
          onClick={() => setBalanceOpen(false)}
        >
          <div
            className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold text-white mb-4">余额调整</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">资产类型</label>
                <select
                  value={balanceType}
                  onChange={(e) => setBalanceType(e.target.value as 'usdt' | 'hoot')}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="usdt">USDT</option>
                  <option value="hoot">HOOT</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">操作</label>
                <select
                  value={balanceAction}
                  onChange={(e) => setBalanceAction(e.target.value as 'adjust' | 'deduct')}
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="adjust">增加</option>
                  <option value="deduct">扣减</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#9090A0] mb-1">金额</label>
                <input
                  type="number"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setBalanceOpen(false)}
                className="flex-1 px-4 py-2 text-sm text-[#9090A0] bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBalanceSubmit}
                disabled={balanceLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {balanceLoading && <Loader2 size={14} className="animate-spin" />}
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认弹窗 */}
      <AdminConfirmDialog
        open={confirmDialog === 'reset-password'}
        onClose={() => setConfirmDialog(null)}
        onConfirm={handleConfirm}
        title="重置密码"
        description="将为该用户生成随机新密码并通过邮件发送，确认操作？"
        confirmText="重置"
        loading={mutLoading}
      />
      <AdminConfirmDialog
        open={confirmDialog === 'unbind-tg'}
        onClose={() => setConfirmDialog(null)}
        onConfirm={handleConfirm}
        title="解绑 Telegram"
        description="解绑后用户无法通过 TG 登录，确认操作？"
        confirmText="解绑"
        variant="danger"
        loading={mutLoading}
      />
      <AdminConfirmDialog
        open={confirmDialog === 'unbind-wallet'}
        onClose={() => setConfirmDialog(null)}
        onConfirm={handleConfirm}
        title="解绑钱包"
        description="解绑后用户钱包地址将被清除，确认操作？"
        confirmText="解绑"
        variant="danger"
        loading={mutLoading}
      />
    </div>
  );
}

// ─────────────────────────── 用户列表 Tab ───────────────────────────

function UserListTab() {
  const {
    items,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    setPage,
    setSearch,
    refetch,
  } = useAdminList<UserItem>('/admin/users');

  const { mutate: statusMutate, loading: statusLoading } = useAdminMutation({
    onSuccess: refetch,
  });
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const handleStatusToggle = async (user: UserItem) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    setStatusLoadingId(user.id);
    await statusMutate(`/admin/users/${user.id}/status`, 'put', { status: newStatus });
    setStatusLoadingId(null);
  };

  const columns: AdminColumn<UserItem>[] = [
    {
      key: 'uid',
      title: 'ID',
      width: '110px',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-cyan-400 text-xs font-semibold">
            {row.uid ? `USR${row.uid}` : '—'}
          </span>
          <span
            className="font-mono text-[#4A4A5A] text-[10px] cursor-pointer hover:text-[#9090A0] transition-colors truncate max-w-[100px]"
            title={row.id}
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(row.id); }}
          >
            {row.id.slice(0, 8)}…
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      title: '邮箱',
      render: (row) => <span className="text-white">{row.email}</span>,
    },
    {
      key: 'nickname',
      title: '昵称',
      render: (row) => <span className="text-[#9090A0]">{row.nickname || '-'}</span>,
    },
    {
      key: 'usdtBalance',
      title: 'USDT 余额',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-white">
          {parseFloat(row.usdtBalance).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'hootBalance',
      title: 'HOOT 余额',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-cyan-400">
          {parseFloat(row.hootBalance).toFixed(4)}
        </span>
      ),
    },
    {
      key: 'pointBalance',
      title: 'GAS 余额',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-yellow-400">
          {parseFloat(row.pointBalance || '0').toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      render: (row) => <AdminStatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      title: '注册时间',
      align: 'center',
      render: (row) => (
        <span className="text-[#9090A0] text-xs">
          {new Date(row.createdAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'center',
      width: '140px',
      render: (row) => (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleStatusToggle(row)}
            disabled={statusLoadingId === row.id}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors disabled:opacity-50 ${
              row.status === 'active'
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
            }`}
          >
            {statusLoadingId === row.id ? (
              <Loader2 size={12} className="animate-spin" />
            ) : row.status === 'active' ? (
              <Ban size={12} />
            ) : (
              <CheckCircle size={12} />
            )}
            {row.status === 'active' ? '封禁' : '解封'}
          </button>
          <button
            onClick={() => setDetailUserId(row.id)}
            className="px-2 py-1 bg-[#1E1E2E] hover:bg-[#2A2A3A] text-[#9090A0] hover:text-white rounded text-xs transition-colors"
          >
            详情
          </button>
        </div>
      ),
    },
  ];

  if (error) return <AdminErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <AdminSearchBar
        value={search}
        onChange={setSearch}
        onSearch={refetch}
        placeholder="搜索 UID、邮箱、昵称..."
      />

      {loading && !items.length ? (
        <AdminSkeleton mode="table" count={8} />
      ) : (
        <>
          <AdminTable<UserItem>
            columns={columns}
            data={items}
            rowKey="id"
            loading={loading}
          />
          {!items.length && !loading && (
            <AdminEmptyState icon={Users} title="暂无用户数据" />
          )}
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      {detailUserId && (
        <UserDetailDialog
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

// ─────────────────────────── 用户统计 Tab ───────────────────────────

function UserStatsTab() {
  const { data: stats, loading: statsLoading, error: statsError, refetch: statsRefetch } =
    useAdminApi<UserStats>('/admin/stats/users');

  const { data: trend, loading: trendLoading } =
    useAdminApi<TrendItem[]>('/admin/stats/users/trend?days=30');

  const { data: assets } = useAdminApi<AssetItem[]>('/admin/stats/users/assets');
  const { data: sources } = useAdminApi<SourceItem[]>('/admin/stats/users/source');

  if (statsLoading) return <AdminSkeleton mode="grid" count={4} cols={4} />;
  if (statsError) return <AdminErrorState message={statsError} onRetry={statsRefetch} />;

  const trendData = Array.isArray(trend) ? trend : [];
  const maxCount = trendData.length > 0 ? Math.max(...trendData.map((t) => t.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="总用户"
          value={stats?.totalUsers ?? '-'}
          icon={Users}
          color="bg-blue-500/20 text-blue-400"
        />
        <AdminStatCard
          title="今日活跃"
          value={stats?.activeToday ?? '-'}
          icon={UserCheck}
          color="bg-green-500/20 text-green-400"
        />
        <AdminStatCard
          title="今日新增"
          value={stats?.newToday ?? '-'}
          icon={UserPlus}
          color="bg-cyan-500/20 text-cyan-400"
        />
        <AdminStatCard
          title="本周新增"
          value={stats?.newThisWeek ?? '-'}
          icon={BarChart3}
          color="bg-purple-500/20 text-purple-400"
        />
      </div>

      {/* 增长趋势 */}
      <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
        <p className="text-sm font-medium text-white mb-4">30 天用户增长</p>
        {trendLoading ? (
          <div className="h-32 flex items-center justify-center text-[#9090A0] text-sm">加载中...</div>
        ) : trendData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-[#9090A0] text-sm">暂无数据</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {trendData.map((item, idx) => {
              const heightPct = (item.count / maxCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end group">
                  <div className="relative w-full">
                    <div
                      className="w-full bg-cyan-500/30 rounded-t hover:bg-cyan-500/60 transition-colors min-h-[2px]"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#2A2A3A] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {item.date}: {item.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 资产分布 + 来源统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">资产分布</p>
          {Array.isArray(assets) && assets.length > 0 ? (
            <div className="space-y-2">
              {assets.map((item) => (
                <div key={item.range} className="flex items-center justify-between text-sm">
                  <span className="text-[#9090A0]">{item.range}</span>
                  <span className="text-white font-mono">{item.count} 人</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#9090A0] text-sm">暂无数据</p>
          )}
        </div>

        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">注册来源</p>
          {Array.isArray(sources) && sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map((item) => (
                <div key={item.source} className="flex items-center justify-between text-sm">
                  <span className="text-[#9090A0]">{item.source || '直接注册'}</span>
                  <span className="text-white font-mono">{item.count} 人</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#9090A0] text-sm">暂无数据</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── 主页面 ───────────────────────────

const TABS = [
  { key: 'list', label: '用户列表', icon: Users },
  { key: 'stats', label: '用户统计', icon: BarChart3 },
];

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <div className="p-6 space-y-4">
      <AdminPageHeader title="用户管理" icon={Users} subtitle={`共两个视图：列表与统计`} />

      <AdminTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'list' && <UserListTab />}
      {activeTab === 'stats' && <UserStatsTab />}
    </div>
  );
}
