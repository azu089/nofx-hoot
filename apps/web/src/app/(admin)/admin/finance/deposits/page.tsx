'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Check, X, Image as ImageIcon, ExternalLink, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Deposit = {
  id: string;
  userId: string;
  userEmail: string;
  amount: string;
  currency: string;
  method: string;
  chain: string | null;
  fromAddress: string | null;
  txHash: string | null;
  proofImageUrl: string | null;
  status: string;
  rejectReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export default function DepositsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);

  // 获取充值列表
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-deposits', statusFilter, page],
    queryFn: async () => {
      const res = await adminApi.getDeposits({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      return res.data;
    },
  });

  // 审核通过
  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveDeposit(id),
    onSuccess: () => {
      toast.success('充值已审核通过');
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      setSelectedDeposit(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  // 拒绝
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectDeposit(id, reason),
    onSuccess: () => {
      toast.success('充值已拒绝');
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      setShowRejectDialog(false);
      setSelectedDeposit(null);
      setRejectReason('');
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const handleApprove = (deposit: Deposit) => {
    if (confirm(`确认通过用户 ${deposit.userEmail} 的充值申请？\n金额：${deposit.amount} ${deposit.currency}`)) {
      approveMutation.mutate(deposit.id);
    }
  };

  const handleReject = () => {
    if (selectedDeposit) {
      rejectMutation.mutate({
        id: selectedDeposit.id,
        reason: rejectReason || undefined,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning" outline><Clock className="w-3 h-3 mr-1" />待审核</Badge>;
      case 'approved':
        return <Badge variant="success" outline><Check className="w-3 h-3 mr-1" />已通过</Badge>;
      case 'rejected':
        return <Badge variant="danger" outline><X className="w-3 h-3 mr-1" />已拒绝</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-danger">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>加载失败: {(error as Error).message}</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">充值审核</h1>
          <p className="text-text-secondary">审核用户充值申请</p>
        </div>
        <div className="flex items-center gap-4">
          {data && (
            <Badge variant="warning" size="lg" className="px-4 py-2">
              待审核: {data.pending}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Button
            variant={statusFilter === '' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter(''); setPage(1); }}
          >
            全部
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter('pending'); setPage(1); }}
          >
            待审核
          </Button>
          <Button
            variant={statusFilter === 'approved' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter('approved'); setPage(1); }}
          >
            已通过
          </Button>
          <Button
            variant={statusFilter === 'rejected' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter('rejected'); setPage(1); }}
          >
            已拒绝
          </Button>
        </div>
      </Card>

      {/* 充值列表 */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">充值记录</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">金额</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">方式</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">链/地址</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">凭证</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">申请时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                    暂无充值记录
                  </td>
                </tr>
              ) : (
                data?.data.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-text-primary">{deposit.userEmail}</div>
                      <div className="text-xs text-text-tertiary">{deposit.userId.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-success">
                      {deposit.amount} {deposit.currency}
                    </td>
                    <td className="px-6 py-4 text-text-primary">{deposit.method}</td>
                    <td className="px-6 py-4">
                      {deposit.chain && (
                        <div className="text-sm">
                          <span className="text-text-secondary">{deposit.chain}</span>
                          {deposit.fromAddress && (
                            <div className="text-xs text-text-tertiary truncate max-w-[120px]" title={deposit.fromAddress}>
                              {deposit.fromAddress}
                            </div>
                          )}
                        </div>
                      )}
                      {deposit.txHash && (
                        <a
                          href={`https://tronscan.org/#/transaction/${deposit.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-primary hover:underline text-xs flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          查看交易
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {deposit.proofImageUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDeposit(deposit);
                            setShowImageDialog(true);
                          }}
                        >
                          <ImageIcon className="w-4 h-4 mr-1" />
                          查看
                        </Button>
                      ) : (
                        <span className="text-text-tertiary">无</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(deposit.status)}
                      {deposit.rejectReason && (
                        <div className="text-xs text-danger mt-1">
                          原因: {deposit.rejectReason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {formatDate(deposit.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      {deposit.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleApprove(deposit)}
                            disabled={approveMutation.isPending}
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setSelectedDeposit(deposit);
                              setShowRejectDialog(true);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
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
        {data && data.totalPages > 1 && (
          <div className="flex justify-center gap-2 px-6 py-4 border-t border-border-primary">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <span className="flex items-center px-4 text-sm text-text-secondary">
              {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        )}
      </Card>

      {/* 拒绝对话框 */}
      <Dialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        title="拒绝充值"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            确认拒绝用户 <span className="text-text-primary">{selectedDeposit?.userEmail}</span> 的充值申请？
          </p>
          <p className="text-sm">
            金额: <span className="font-mono text-success">{selectedDeposit?.amount} {selectedDeposit?.currency}</span>
          </p>
          <div>
            <label className="text-sm text-text-secondary">拒绝原因（可选）</label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因..."
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            isLoading={rejectMutation.isPending}
          >
            确认拒绝
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 凭证图片对话框 */}
      <Dialog
        open={showImageDialog}
        onClose={() => setShowImageDialog(false)}
        title="充值凭证"
      >
        <div className="flex justify-center">
          {selectedDeposit?.proofImageUrl && (
            <img
              src={selectedDeposit.proofImageUrl}
              alt="充值凭证"
              className="max-w-full max-h-[60vh] object-contain rounded-lg"
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}
