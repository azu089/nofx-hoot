'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Minus, Search, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type BalanceAdjustment = {
  id: string;
  userId: string;
  userEmail: string;
  type: 'add' | 'deduct';
  amount: string;
  reason: string;
  operatorId: string;
  createdAt: string;
};

type User = {
  id: string;
  email: string;
  vipLevel: number;
  balance: string;
  pointsBalance: string;
  cardBalance: string;
  tokenBalance: string;
  status: string;
  instanceCount: number;
  totalTrades: number;
  createdAt: string;
  lastLogin: string | null;
};

export default function BalanceAdjustmentPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // 获取调整记录
  const { data: adjustments, isLoading, refetch } = useQuery({
    queryKey: ['admin-balance-adjustments', page],
    queryFn: async () => {
      const res = await adminApi.getBalanceAdjustments({ page, limit: 20 });
      return res.data;
    },
  });

  // 搜索用户
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['admin-users-search', searchEmail],
    queryFn: async () => {
      if (!searchEmail) return null;
      const res = await adminApi.getUsers({ search: searchEmail, page: 1 });
      return res.data;
    },
    enabled: searchEmail.length >= 3,
  });

  // 调整余额
  const adjustMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { type: 'add' | 'deduct'; amount: string; reason: string } }) =>
      adminApi.adjustBalance(userId, data),
    onSuccess: () => {
      toast.success(`余额${adjustType === 'add' ? '加款' : '扣款'}成功`);
      queryClient.invalidateQueries({ queryKey: ['admin-balance-adjustments'] });
      handleCloseDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const handleCloseDialog = () => {
    setShowAdjustDialog(false);
    setSelectedUser(null);
    setSearchEmail('');
    setAdjustAmount('');
    setAdjustReason('');
    setAdjustType('add');
  };

  const handleAdjust = () => {
    if (!selectedUser) return;
    if (!adjustAmount || parseFloat(adjustAmount) <= 0) {
      toast.error('请输入有效金额');
      return;
    }
    if (!adjustReason.trim()) {
      toast.error('请输入调整原因');
      return;
    }

    adjustMutation.mutate({
      userId: selectedUser.id,
      data: {
        type: adjustType,
        amount: adjustAmount,
        reason: adjustReason,
      },
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">余额调整</h1>
          <p className="text-text-secondary">手动调整用户余额（加款/扣款）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button onClick={() => setShowAdjustDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建调整
          </Button>
        </div>
      </div>

      {/* 调整记录 */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">调整记录</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">用户</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">金额</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">原因</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {adjustments?.data.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-text-secondary">
                        暂无调整记录
                      </td>
                    </tr>
                  ) : (
                    adjustments?.data.map((adj) => (
                      <tr key={adj.id} className="hover:bg-bg-tertiary/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-text-primary">{adj.userEmail}</div>
                          <div className="text-xs text-text-tertiary">{adj.userId.slice(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4">
                          {adj.type === 'add' ? (
                            <Badge variant="success" outline>
                              <Plus className="w-3 h-3 mr-1" />加款
                            </Badge>
                          ) : (
                            <Badge variant="danger" outline>
                              <Minus className="w-3 h-3 mr-1" />扣款
                            </Badge>
                          )}
                        </td>
                        <td className={`px-6 py-4 font-mono font-bold ${adj.type === 'add' ? 'text-success' : 'text-danger'}`}>
                          {adj.type === 'add' ? '+' : '-'}{adj.amount} USDT
                        </td>
                        <td className="px-6 py-4 text-text-primary max-w-[200px] truncate" title={adj.reason}>
                          {adj.reason}
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary">
                          {formatDate(adj.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {adjustments && adjustments.totalPages > 1 && (
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
                  {page} / {adjustments.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === adjustments.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 新建调整对话框 */}
      <Dialog
        open={showAdjustDialog}
        onClose={handleCloseDialog}
        title="余额调整"
      >
        <div className="space-y-4">
          {/* 选择用户 */}
          {!selectedUser ? (
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">搜索用户</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <Input
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="输入邮箱搜索..."
                  className="pl-10"
                />
              </div>

              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
              )}

              {searchResults && searchResults.data.length > 0 && (
                <div className="border border-border-primary rounded-lg divide-y divide-border-primary max-h-48 overflow-y-auto">
                  {searchResults.data.map((user) => (
                    <button
                      key={user.id}
                      className="w-full px-4 py-2 text-left hover:bg-bg-tertiary transition-colors"
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="text-sm font-medium text-text-primary">{user.email}</div>
                      <div className="text-xs text-text-tertiary">
                        余额: {user.balance} USDT | VIP: {user.vipLevel}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchEmail.length >= 3 && searchResults?.data.length === 0 && (
                <div className="text-center py-4 text-text-secondary">
                  未找到用户
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 已选择用户 */}
              <div className="bg-bg-tertiary rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{selectedUser.email}</div>
                    <div className="text-xs text-text-tertiary">
                      当前余额: <span className="text-success">{selectedUser.balance} USDT</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                  >
                    更换
                  </Button>
                </div>
              </div>

              {/* 操作类型 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">操作类型</label>
                <div className="flex gap-2">
                  <Button
                    variant={adjustType === 'add' ? 'success' : 'outline'}
                    onClick={() => setAdjustType('add')}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    加款
                  </Button>
                  <Button
                    variant={adjustType === 'deduct' ? 'danger' : 'outline'}
                    onClick={() => setAdjustType('deduct')}
                  >
                    <Minus className="w-4 h-4 mr-1" />
                    扣款
                  </Button>
                </div>
              </div>

              {/* 金额 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">金额 (USDT)</label>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="输入金额"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* 原因 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">调整原因</label>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="请输入调整原因..."
                />
              </div>

              {/* 预览 */}
              {adjustAmount && parseFloat(adjustAmount) > 0 && (
                <div className="bg-bg-tertiary rounded-lg p-3 border border-border-primary">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <span className="text-text-secondary">操作预览:</span>
                  </div>
                  <div className="mt-2 text-sm">
                    {adjustType === 'add' ? (
                      <span className="text-success">+{adjustAmount} USDT</span>
                    ) : (
                      <span className="text-danger">-{adjustAmount} USDT</span>
                    )}
                    <span className="text-text-tertiary">
                      {' '}→ 新余额: {(parseFloat(selectedUser.balance) + (adjustType === 'add' ? parseFloat(adjustAmount) : -parseFloat(adjustAmount))).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog}>
            取消
          </Button>
          <Button
            variant={adjustType === 'add' ? 'success' : 'danger'}
            onClick={handleAdjust}
            disabled={!selectedUser || !adjustAmount || !adjustReason}
            isLoading={adjustMutation.isPending}
          >
            确认{adjustType === 'add' ? '加款' : '扣款'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
