'use client';

import { useState, useCallback } from 'react';
import {
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Check,
  X,
  Hash,
  ExternalLink,
} from 'lucide-react';
import {
  AdminPageHeader,
  AdminSkeleton,
  AdminErrorState,
  AdminTable,
  AdminPagination,
  AdminStatCard,
  AdminStatusBadge,
  AdminSearchBar,
  AdminConfirmDialog,
  type AdminColumn,
} from '@/components/admin/shared';
import {
  useAdminApi,
  useAdminList,
  useAdminMutation,
} from '@/hooks/useAdminApi';

// ─── 类型定义 ───────────────────────────────────────────────

interface WithdrawStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  todayTotal: string;
}

interface WithdrawItem {
  id: string;
  userId: string;
  userEmail?: string;        // 后端兼容字段 (user.email)
  userNickname?: string;
  amount: string;
  asset: string;             // 实际字段名
  currency: string;          // 兼容别名 (= asset)
  chain: string;             // 实际字段名
  network: string;           // 兼容别名 (= chain)
  address: string;
  status: string;
  txHash?: string | null;
  remark?: string | null;    // 实际字段名
  reason?: string | null;    // 兼容别名 (= remark)
  createdAt: string;
}

// ─── 主页面 ─────────────────────────────────────────────────

export default function AdminWithdrawsPage() {
  const { data: stats, loading: statsLoading, refetch: statsRefetch } =
    useAdminApi<WithdrawStats>('/admin/withdraws/stats');

  const {
    items,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    filters,
    setPage,
    setSearch,
    setFilter,
    refetch,
  } = useAdminList<WithdrawItem>('/admin/withdraws', {
    defaultLimit: 20,
    defaultFilters: { status: '' },
  });

  const { mutate, loading: processing } = useAdminMutation({
    onSuccess: () => { refetch(); statsRefetch(); },
  });

  // 通过弹窗状态（含 txHash 输入）
  const [approveTarget, setApproveTarget] = useState<WithdrawItem | null>(null);
  const [txHash, setTxHash] = useState('');

  // 拒绝弹窗状态
  const [rejectTarget, setRejectTarget] = useState<WithdrawItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = useCallback(async () => {
    if (!approveTarget) return;
    await mutate(`/admin/withdraws/${approveTarget.id}/process`, 'post', {
      action: 'approve',
      ...(txHash.trim() ? { txHash: txHash.trim() } : {}),
    });
    setApproveTarget(null);
    setTxHash('');
  }, [mutate, approveTarget, txHash]);

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    await mutate(`/admin/withdraws/${rejectTarget.id}/process`, 'post', {
      action: 'reject',
      reason: rejectReason.trim() || '管理员拒绝',
    });
    setRejectTarget(null);
    setRejectReason('');
  }, [mutate, rejectTarget, rejectReason]);

  const fmtAmt = (v: string) =>
    parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const columns: AdminColumn<WithdrawItem>[] = [
    {
      key: 'user', title: '用户',
      render: (row) => (
        <div>
          <div className="text-sm text-white">{row.userEmail ?? '—'}</div>
          <div className="text-xs text-[#9090A0] font-mono">{row.userId.slice(0, 12)}...</div>
        </div>
      ),
    },
    {
      key: 'amount', title: '金额', align: 'right', width: '130px',
      render: (row) => (
        <div className="text-right">
          <div className="text-sm font-bold text-white font-mono">{fmtAmt(row.amount)}</div>
          <div className="text-xs text-[#9090A0]">{row.asset ?? row.currency}</div>
        </div>
      ),
    },
    {
      key: 'network', title: '网络', align: 'center', width: '90px',
      render: (row) => <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded-full font-mono">{row.chain ?? row.network}</span>,
    },
    {
      key: 'address', title: '提现地址',
      render: (row) => (
        <span className="text-xs text-[#9090A0] font-mono" title={row.address}>
          {row.address.slice(0, 10)}...{row.address.slice(-8)}
        </span>
      ),
    },
    {
      key: 'txHash', title: '链上Hash',
      render: (row) => row.txHash ? (
        <span className="text-xs text-cyan-400 font-mono" title={row.txHash}>
          {row.txHash.slice(0, 12)}...
        </span>
      ) : <span className="text-xs text-[#4A4A5A]">—</span>,
    },
    {
      key: 'status', title: '状态', align: 'center', width: '90px',
      render: (row) => <AdminStatusBadge status={row.status} />,
    },
    {
      key: 'createdAt', title: '申请时间', width: '140px',
      render: (row) => (
        <span className="text-xs text-[#9090A0]">
          {new Date(row.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'actions', title: '操作', align: 'center', width: '130px',
      render: (row) => {
        if (row.status === 'pending') {
          return (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => { setApproveTarget(row); setTxHash(''); }}
                className="flex items-center gap-1 px-2.5 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/20 transition-colors"
              >
                <Check size={11} />通过
              </button>
              <button
                onClick={() => { setRejectTarget(row); setRejectReason(''); }}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg border border-red-500/20 transition-colors"
              >
                <X size={11} />拒绝
              </button>
            </div>
          );
        }
        if (row.status === 'rejected' && (row.remark || row.reason)) {
          const msg = row.remark ?? row.reason ?? '';
          return <span className="text-xs text-[#9090A0] line-clamp-1" title={msg}>{msg}</span>;
        }
        return <span className="text-xs text-[#9090A0]">—</span>;
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="提现审核"
        icon={Wallet}
        subtitle="用户提现申请管理与审核"
        onRefresh={() => { refetch(); statsRefetch(); }}
      />

      {/* 统计卡片 */}
      {statsLoading && !stats ? (
        <AdminSkeleton mode="grid" count={4} cols={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard title="待审核"   value={stats?.pendingCount ?? 0}  icon={Clock}        color="bg-yellow-500/20 text-yellow-400" />
          <AdminStatCard title="已通过"   value={stats?.approvedCount ?? 0} icon={CheckCircle}  color="bg-green-500/20 text-green-400" />
          <AdminStatCard title="已拒绝"   value={stats?.rejectedCount ?? 0} icon={XCircle}      color="bg-red-500/20 text-red-400" />
          <AdminStatCard title="今日总额" value={`$${parseFloat(stats?.todayTotal ?? '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="bg-cyan-500/20 text-cyan-400" />
        </div>
      )}

      {/* 搜索与筛选 */}
      <AdminSearchBar
        value={search}
        onChange={setSearch}
        onSearch={() => setPage(1)}
        placeholder="搜索用户邮箱或地址..."
        filters={
          <select
            value={filters.status ?? ''}
            onChange={(e) => setFilter('status', e.target.value)}
            className="px-3 py-2 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
          >
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
            <option value="processing">处理中</option>
          </select>
        }
      />

      {/* 列表 */}
      {error ? (
        <AdminErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="space-y-4">
          <AdminTable<WithdrawItem> columns={columns} data={items} rowKey="id" loading={loading || processing} />
          <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* 通过弹窗（含 txHash 输入） */}
      {approveTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setApproveTarget(null)}
        >
          <div
            className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle size={20} className="text-green-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-white">确认通过提现申请</h3>
                <p className="text-sm text-[#9090A0] mt-1">
                  用户：<span className="text-white">{approveTarget.userEmail ?? approveTarget.userNickname ?? approveTarget.userId.slice(0, 12)}</span>
                  {' · '}金额：<span className="text-white font-mono">{fmtAmt(approveTarget.amount)} {approveTarget.asset ?? approveTarget.currency}</span>
                </p>
                <p className="text-xs text-[#9090A0] mt-1 font-mono">地址: {approveTarget.address}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-[#9090A0] mb-1.5 flex items-center gap-1">
                <Hash size={11} />链上交易Hash
                <span className="text-[#9090A0] ml-1">（可选，手动填写链上TxHash）</span>
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] font-mono focus:outline-none focus:border-green-500/50 transition-colors"
              />
              <p className="text-xs text-[#9090A0] mt-1">* 若系统自动执行链上转账，TxHash 将自动填充</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApproveTarget(null)}
                disabled={processing}
                className="px-4 py-2 text-sm text-[#9090A0] hover:text-white bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 text-sm text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {processing && <span className="w-3.5 h-3.5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />}
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 拒绝对话框 */}
      {rejectTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <XCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-white">拒绝提现申请</h3>
                <p className="text-sm text-[#9090A0] mt-1">
                  用户：<span className="text-white">{rejectTarget.userEmail ?? rejectTarget.userNickname ?? rejectTarget.userId.slice(0, 12)}</span>
                  {' · '}金额：<span className="text-white font-mono">{fmtAmt(rejectTarget.amount)} {rejectTarget.asset ?? rejectTarget.currency}</span>
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-[#9090A0] mb-1.5">
                拒绝原因<span className="text-[#9090A0] ml-1">（可选，将展示给用户）</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="例：地址格式错误、超过日限额..."
                rows={3}
                className="w-full px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg text-sm text-white placeholder-[#9090A0] focus:outline-none focus:border-red-500/50 transition-colors resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={processing}
                className="px-4 py-2 text-sm text-[#9090A0] hover:text-white bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {processing && <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />}
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
