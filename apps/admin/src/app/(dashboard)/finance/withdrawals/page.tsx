'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  DollarSign,
  Wallet,
  User,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAdminAuthStore } from '@/stores/auth.store';

interface Withdrawal {
  id: string;
  userId: string;
  userEmail: string;
  amount: string;
  address: string;
  chain: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface WithdrawalsData {
  data: Withdrawal[];
  total: number;
}

export default function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAdminAuthStore();
  const isAgent = currentUser?.isAgent || false; // 代理商只有查看权限
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'withdrawals', page, statusFilter],
    queryFn: () => adminApi.getWithdrawals({ page, status: statusFilter }),
  });

  // 从 API 响应中提取数据
  // API 返回 { code, data: { data: Withdrawal[], total: number } }
  const withdrawalsData = data?.data as WithdrawalsData | undefined;
  const withdrawals = withdrawalsData?.data || [];
  const totalWithdrawals = withdrawalsData?.total || 0;

  const stats = {
    pending: withdrawals.filter((w) => w.status === 'pending').length,
    approved: withdrawals.filter((w) => w.status === 'approved').length,
    rejected: withdrawals.filter((w) => w.status === 'rejected').length,
    total: totalWithdrawals,
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveWithdrawal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectWithdrawal(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedWithdrawal(null);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 bg-[#F7931A]/10 text-[#F7931A] rounded text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            待审核
          </span>
        );
      case 'approved':
        return (
          <span className="px-2 py-1 bg-[#00C087]/10 text-[#00C087] rounded text-xs flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            已通过
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 bg-[#F23645]/10 text-[#F23645] rounded text-xs flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            已拒绝
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">提现审核</h1>
        <p className="text-[#848E9C] mt-1">审核用户提现申请</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">待审核</p>
              <p className="text-xl font-bold text-[#F7931A]">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-[#F7931A]" />
          </div>
        </div>
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">已通过</p>
              <p className="text-xl font-bold text-[#00C087]">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-[#00C087]" />
          </div>
        </div>
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">已拒绝</p>
              <p className="text-xl font-bold text-[#F23645]">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-[#F23645]" />
          </div>
        </div>
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">总申请</p>
              <p className="text-xl font-bold text-white">{stats.total}</p>
            </div>
            <DollarSign className="w-8 h-8 text-[#3772FF]" />
          </div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white"
        >
          <option value="all">全部</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>

      {/* 提现列表 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2B3139]">
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">提现金额</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">链/地址</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">申请时间</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-[#848E9C]">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#848E9C]">
                    加载中...
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#848E9C]">
                    暂无提现申请
                  </td>
                </tr>
              ) : (
                withdrawals.map((wd) => (
                  <tr key={wd.id} className="border-b border-[#2B3139] hover:bg-[#1E222D]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#3772FF]/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-[#3772FF]" />
                        </div>
                        <div>
                          <p className="text-white text-sm">{wd.userEmail}</p>
                          <p className="text-[#848E9C] text-xs">用户ID: {wd.userId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium text-lg">${wd.amount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="px-2 py-0.5 bg-[#3772FF]/10 text-[#3772FF] rounded text-xs">
                          {wd.chain}
                        </span>
                        <p className="text-[#848E9C] text-xs mt-1 font-mono">{wd.address}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(wd.status)}
                    </td>
                    <td className="px-6 py-4 text-[#848E9C] text-sm">
                      {wd.createdAt}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* 代理商只有查看权限，隐藏审核操作 */}
                      {!isAgent && wd.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              if (confirm('确定通过此提现申请吗？')) {
                                approveMutation.mutate(wd.id);
                              }
                            }}
                            className="px-3 py-1.5 bg-[#00C087] text-white rounded-lg text-sm hover:bg-[#00A070] flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            通过
                          </button>
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(wd.id);
                              setShowRejectModal(true);
                            }}
                            className="px-3 py-1.5 bg-[#F23645] text-white rounded-lg text-sm hover:bg-[#D02030] flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            拒绝
                          </button>
                        </div>
                      )}
                      {isAgent && wd.status === 'pending' && (
                        <span className="text-[#848E9C] text-sm">仅查看</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 拒绝弹窗 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#131722] rounded-xl p-6 w-full max-w-md border border-[#2B3139]">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#F23645]" />
              拒绝提现
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因..."
              className="w-full px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white placeholder-[#848E9C] focus:outline-none focus:border-[#3772FF] min-h-[100px]"
            />
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedWithdrawal(null);
                }}
                className="flex-1 px-4 py-2 bg-[#1E222D] text-white rounded-lg hover:bg-[#2B3139]"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (selectedWithdrawal && rejectReason.trim()) {
                    rejectMutation.mutate({ id: selectedWithdrawal, reason: rejectReason });
                  }
                }}
                disabled={!rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-[#F23645] text-white rounded-lg hover:bg-[#D02030] disabled:opacity-50"
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
