'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  User,
  DollarSign,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminAgentWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<{
    id: string;
    action: 'approve' | 'reject';
    agentName: string;
    amount: string;
  } | null>(null);
  const [txHash, setTxHash] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // 获取代理商提现列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'agent-withdrawals', page, statusFilter],
    queryFn: async () => {
      const response = await adminApi.getAgentWithdrawals({
        page,
        limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      return response.data;
    },
  });

  // 批准提现
  const approveMutation = useMutation({
    mutationFn: ({ id, txHash }: { id: string; txHash?: string }) =>
      adminApi.approveAgentWithdrawal(id, txHash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agent-withdrawals'] });
      setSelectedWithdrawal(null);
      setTxHash('');
    },
  });

  // 拒绝提现
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectAgentWithdrawal(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agent-withdrawals'] });
      setSelectedWithdrawal(null);
      setRejectReason('');
    },
  });

  // 过滤搜索结果
  const filteredData = data?.data?.filter((item) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.agentEmail?.toLowerCase().includes(searchLower) ||
      item.agentName?.toLowerCase().includes(searchLower) ||
      item.id?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-warning/10 text-warning flex items-center gap-1">
            <Clock className="w-3 h-3" />
            待审核
          </span>
        );
      case 'approved':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-success/10 text-success flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            已批准
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-danger/10 text-danger flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            已拒绝
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-text-secondary/10 text-text-secondary">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">代理商提现审核</h1>
            <p className="text-text-secondary mt-1">审核代理商的佣金提现申请</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">待审核</p>
              <p className="text-xl font-bold text-warning">
                {data?.pending || 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-warning" />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">总申请</p>
              <p className="text-xl font-bold text-white">{data?.total || 0}</p>
            </div>
            <DollarSign className="w-8 h-8 text-brand-primary" />
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索代理商邮箱、名称或申请 ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none"
        >
          <option value="pending">待审核</option>
          <option value="approved">已批准</option>
          <option value="rejected">已拒绝</option>
          <option value="all">全部状态</option>
        </select>
      </div>

      {/* 提现列表 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">代理商</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">提现金额</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">申请时间</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-secondary">
                    加载中...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-secondary">
                    暂无提现申请
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{item.agentName || '-'}</p>
                          <p className="text-text-secondary text-xs">{item.agentEmail || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">${item.amount}</p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(item.status)}
                      {item.rejectReason && (
                        <p className="text-danger text-xs mt-1">原因: {item.rejectReason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-text-secondary text-sm">
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedWithdrawal({
                              id: item.id,
                              action: 'approve',
                              agentName: item.agentName || item.agentEmail,
                              amount: item.amount,
                            })}
                            className="px-3 py-1.5 bg-success/10 text-success rounded hover:bg-success/20 text-sm"
                          >
                            批准
                          </button>
                          <button
                            onClick={() => setSelectedWithdrawal({
                              id: item.id,
                              action: 'reject',
                              agentName: item.agentName || item.agentEmail,
                              amount: item.amount,
                            })}
                            className="px-3 py-1.5 bg-danger/10 text-danger rounded hover:bg-danger/20 text-sm"
                          >
                            拒绝
                          </button>
                        </div>
                      )}
                      {item.status === 'approved' && item.txHash && (
                        <p className="text-text-secondary text-xs">
                          TX: {item.txHash.slice(0, 10)}...
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 确认弹窗 */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md border border-border-primary">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedWithdrawal.action === 'approve' ? 'bg-success/10' : 'bg-danger/10'
              }`}>
                {selectedWithdrawal.action === 'approve' ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <XCircle className="w-5 h-5 text-danger" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedWithdrawal.action === 'approve' ? '批准' : '拒绝'}提现
                </h3>
                <p className="text-text-secondary text-sm">
                  {selectedWithdrawal.agentName} - ${selectedWithdrawal.amount}
                </p>
              </div>
            </div>

            {selectedWithdrawal.action === 'approve' && (
              <div className="mb-4">
                <label className="block text-text-secondary text-sm mb-2">
                  交易哈希（可选）
                </label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
                  placeholder="输入链上交易哈希..."
                />
              </div>
            )}

            {selectedWithdrawal.action === 'reject' && (
              <div className="mb-4">
                <label className="block text-text-secondary text-sm mb-2">
                  拒绝原因（可选）
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary min-h-[100px]"
                  placeholder="输入拒绝原因..."
                />
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setSelectedWithdrawal(null);
                  setTxHash('');
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (selectedWithdrawal.action === 'approve') {
                    approveMutation.mutate({
                      id: selectedWithdrawal.id,
                      txHash: txHash || undefined,
                    });
                  } else {
                    rejectMutation.mutate({
                      id: selectedWithdrawal.id,
                      reason: rejectReason || undefined,
                    });
                  }
                }}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={`flex-1 px-4 py-2 rounded-lg disabled:opacity-50 ${
                  selectedWithdrawal.action === 'approve'
                    ? 'bg-success text-white hover:bg-success/90'
                    : 'bg-danger text-white hover:bg-danger/90'
                }`}
              >
                {approveMutation.isPending || rejectMutation.isPending
                  ? '处理中...'
                  : `确认${selectedWithdrawal.action === 'approve' ? '批准' : '拒绝'}`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
