'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  User,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

// 提现记录类型
type Withdrawal = {
  id: string;
  userId: string;
  userEmail: string;
  amount: string;
  address: string;
  chain: string;
  status: string;
  createdAt: string;
};

export default function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // 获取提现列表
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'withdrawals', page, statusFilter],
    queryFn: () => adminApi.getWithdrawals({ page, limit: 20, status: statusFilter }),
  });

  // 统计数据单独查询（需要 all 状态获取总数）
  const { data: statsData } = useQuery({
    queryKey: ['admin', 'withdrawals', 'stats'],
    queryFn: async () => {
      const [pending, approved, rejected] = await Promise.all([
        adminApi.getWithdrawals({ status: 'pending', limit: 1 }),
        adminApi.getWithdrawals({ status: 'approved', limit: 1 }),
        adminApi.getWithdrawals({ status: 'rejected', limit: 1 }),
      ]);
      return {
        pending: pending?.data?.total || 0,
        approved: approved?.data?.total || 0,
        rejected: rejected?.data?.total || 0,
        total: (pending?.data?.total || 0) + (approved?.data?.total || 0) + (rejected?.data?.total || 0),
      };
    },
  });

  // 批准提现
  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveWithdrawal(id),
    onSuccess: () => {
      toast.success('提现已批准');
      queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '批准失败');
    },
  });

  // 拒绝提现
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectWithdrawal(id, reason),
    onSuccess: () => {
      toast.success('提现已拒绝，余额已退还');
      queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedWithdrawal(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '拒绝失败');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            待审核
          </span>
        );
      case 'approved':
        return (
          <span className="px-2 py-1 bg-success/10 text-success rounded text-xs flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            已通过
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 bg-danger/10 text-danger rounded text-xs flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            已拒绝
          </span>
        );
      default:
        return null;
    }
  };

  const withdrawals = data?.data?.data || [];
  const totalPages = data?.data?.totalPages || 1;

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-12 h-12 text-danger mb-4" />
        <p className="text-text-secondary mb-4">加载失败</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">提现审核</h1>
          <p className="text-text-secondary mt-1">审核用户提现申请</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-bg-tertiary text-white rounded-lg flex items-center gap-2 hover:bg-bg-tertiary/80"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">待审核</p>
              <p className="text-xl font-bold text-warning">{statsData?.pending || 0}</p>
            </div>
            <Clock className="w-8 h-8 text-warning" />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">已通过</p>
              <p className="text-xl font-bold text-success">{statsData?.approved || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">已拒绝</p>
              <p className="text-xl font-bold text-danger">{statsData?.rejected || 0}</p>
            </div>
            <XCircle className="w-8 h-8 text-danger" />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">总申请</p>
              <p className="text-xl font-bold text-white">{statsData?.total || 0}</p>
            </div>
            <DollarSign className="w-8 h-8 text-brand-primary" />
          </div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white"
        >
          <option value="all">全部</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>

      {/* 提现列表 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">提现金额</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">链/地址</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">申请时间</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                    暂无提现申请
                  </td>
                </tr>
              ) : (
                withdrawals.map((wd: Withdrawal) => (
                  <tr key={wd.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                          <p className="text-white text-sm">{wd.userEmail}</p>
                          <p className="text-text-tertiary text-xs">ID: {wd.userId.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium text-lg">${wd.amount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded text-xs">
                          {wd.chain}
                        </span>
                        <p className="text-text-secondary text-xs mt-1 font-mono truncate max-w-[200px]" title={wd.address}>
                          {wd.address}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(wd.status)}
                    </td>
                    <td className="px-6 py-4 text-text-secondary text-sm">
                      {wd.createdAt}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {wd.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              if (confirm('确定通过此提现申请吗？')) {
                                approveMutation.mutate(wd.id);
                              }
                            }}
                            disabled={approveMutation.isPending}
                            className="px-3 py-1.5 bg-success text-white rounded-lg text-sm hover:bg-success/90 flex items-center gap-1 disabled:opacity-50"
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            通过
                          </button>
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(wd.id);
                              setShowRejectModal(true);
                            }}
                            className="px-3 py-1.5 bg-danger text-white rounded-lg text-sm hover:bg-danger/90 flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            拒绝
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border-primary flex items-center justify-between">
            <p className="text-text-secondary text-sm">
              第 {page} / {totalPages} 页
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 拒绝弹窗 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md border border-border-primary">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger" />
              拒绝提现
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              拒绝后，提现金额将自动退还到用户余额。
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因（可选）..."
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary min-h-[100px]"
            />
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedWithdrawal(null);
                }}
                className="flex-1 px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary/80"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (selectedWithdrawal) {
                    rejectMutation.mutate({ id: selectedWithdrawal, reason: rejectReason });
                  }
                }}
                disabled={rejectMutation.isPending}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
