'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  User,
  Image as ImageIcon,
  ExternalLink,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAdminAuthStore } from '@/stores/auth.store';

interface Deposit {
  id: string;
  userId: string;
  userEmail: string;
  amount: string;
  chain: string;
  txHash?: string;
  proofImage?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectedReason?: string;
  createdAt: string;
}

interface DepositsData {
  data: Deposit[];
  total: number;
}

export default function AdminDepositsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAdminAuthStore();
  const isAgent = currentUser?.isAgent || false; // 代理商只有查看权限
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'deposits', page, statusFilter],
    queryFn: () => adminApi.getDeposits({ page, status: statusFilter }),
  });

  // 从 API 响应中提取数据
  const depositsData = data?.data as DepositsData | undefined;
  const deposits = depositsData?.data || [];
  const totalDeposits = depositsData?.total || 0;

  const stats = {
    pending: deposits.filter((d) => d.status === 'pending').length,
    approved: deposits.filter((d) => d.status === 'approved').length,
    rejected: deposits.filter((d) => d.status === 'rejected').length,
    total: totalDeposits,
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveDeposit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deposits'] });
      alert('充值已通过');
    },
    onError: (error: Error) => {
      alert(`操作失败: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectDeposit(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deposits'] });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedDeposit(null);
      alert('充值已拒绝');
    },
    onError: (error: Error) => {
      alert(`操作失败: ${error.message}`);
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

  const handleViewImage = (url: string) => {
    setImageUrl(url);
    setShowImageModal(true);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">充值审核</h1>
        <p className="text-[#848E9C] mt-1">审核用户充值申请，查看转账凭证</p>
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

      {/* 充值列表 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2B3139]">
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">充值金额</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">链/TxHash</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">凭证</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">申请时间</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-[#848E9C]">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#848E9C]">
                    加载中...
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#848E9C]">
                    暂无充值申请
                  </td>
                </tr>
              ) : (
                deposits.map((deposit) => (
                  <tr key={deposit.id} className="border-b border-[#2B3139] hover:bg-[#1E222D]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#3772FF]/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-[#3772FF]" />
                        </div>
                        <div>
                          <p className="text-white text-sm">{deposit.userEmail}</p>
                          <p className="text-[#848E9C] text-xs">ID: {deposit.userId.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium text-lg">${deposit.amount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="px-2 py-0.5 bg-[#3772FF]/10 text-[#3772FF] rounded text-xs">
                          {deposit.chain}
                        </span>
                        {deposit.txHash && (
                          <p className="text-[#848E9C] text-xs mt-1 font-mono">
                            {deposit.txHash.slice(0, 16)}...
                            <a
                              href={`https://tronscan.org/#/transaction/${deposit.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 text-[#3772FF] hover:underline inline-flex items-center"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {deposit.proofImage ? (
                        <button
                          onClick={() => handleViewImage(deposit.proofImage!)}
                          className="px-3 py-1.5 bg-[#1E222D] text-[#3772FF] rounded-lg text-sm hover:bg-[#2B3139] flex items-center gap-1"
                        >
                          <ImageIcon className="w-4 h-4" />
                          查看凭证
                        </button>
                      ) : (
                        <span className="text-[#5E6673] text-sm">无凭证</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(deposit.status)}
                      {deposit.status === 'rejected' && deposit.rejectedReason && (
                        <p className="text-[#F23645] text-xs mt-1">{deposit.rejectedReason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[#848E9C] text-sm">
                      {deposit.createdAt}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* 代理商只有查看权限，隐藏审核操作 */}
                      {!isAgent && deposit.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              if (confirm('确定通过此充值申请吗？用户余额将增加对应金额。')) {
                                approveMutation.mutate(deposit.id);
                              }
                            }}
                            disabled={approveMutation.isPending}
                            className="px-3 py-1.5 bg-[#00C087] text-white rounded-lg text-sm hover:bg-[#00A070] flex items-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            通过
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDeposit(deposit);
                              setShowRejectModal(true);
                            }}
                            className="px-3 py-1.5 bg-[#F23645] text-white rounded-lg text-sm hover:bg-[#D02030] flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            拒绝
                          </button>
                        </div>
                      )}
                      {isAgent && deposit.status === 'pending' && (
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
      {showRejectModal && selectedDeposit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#131722] rounded-xl p-6 w-full max-w-md border border-[#2B3139]">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#F23645]" />
              拒绝充值
            </h3>
            <div className="mb-4 p-3 bg-[#1E222D] rounded-lg">
              <p className="text-[#848E9C] text-sm">用户: {selectedDeposit.userEmail}</p>
              <p className="text-white">金额: ${selectedDeposit.amount}</p>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因（如：凭证与金额不符、转账未到账等）..."
              className="w-full px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white placeholder-[#848E9C] focus:outline-none focus:border-[#3772FF] min-h-[100px]"
            />
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedDeposit(null);
                }}
                className="flex-1 px-4 py-2 bg-[#1E222D] text-white rounded-lg hover:bg-[#2B3139]"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (selectedDeposit && rejectReason.trim()) {
                    rejectMutation.mutate({ id: selectedDeposit.id, reason: rejectReason });
                  }
                }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 px-4 py-2 bg-[#F23645] text-white rounded-lg hover:bg-[#D02030] disabled:opacity-50"
              >
                {rejectMutation.isPending ? '处理中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片预览弹窗 */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-2 -right-2 w-10 h-10 bg-[#131722] rounded-full flex items-center justify-center text-white hover:bg-[#2B3139]"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imageUrl}
              alt="充值凭证"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
