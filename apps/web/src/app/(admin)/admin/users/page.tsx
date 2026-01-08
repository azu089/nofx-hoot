'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  MoreVertical,
  Ban,
  Key,
  Eye,
  Mail,
  Clock,
  DollarSign,
  UserPlus,
  UserMinus,
  Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type User = {
  id: string;
  email: string;
  vipLevel: number;
  balance: string;
  status: string;
  instanceCount: number;
  totalTrades: number;
  createdAt: string;
  lastLogin: string;
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // 设置代理商对话框状态
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoteUser, setPromoteUser] = useState<User | null>(null);
  const [agentName, setAgentName] = useState('');
  const [commissionRate, setCommissionRate] = useState('0.10');

  // 撤销代理商确认对话框
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeUser, setRevokeUser] = useState<User | null>(null);

  // 用户代理商状态缓存
  const [userAgentStatus, setUserAgentStatus] = useState<Record<string, boolean>>({});

  const { data: usersRes, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, statusFilter],
    queryFn: () => adminApi.getUsers({ page, search, status: statusFilter }),
  });
  const usersData = usersRes?.data;

  const banMutation = useMutation({
    mutationFn: adminApi.banUser,
    onSuccess: () => {
      toast.success('用户状态已更新');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setSelectedUser(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: adminApi.resetPassword,
    onSuccess: (res) => {
      toast.success(`密码已重置，临时密码: ${res.data?.tempPassword}`);
      setSelectedUser(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  // 设置代理商 mutation
  const promoteMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { name: string; commissionRate?: string } }) =>
      adminApi.promoteUserToAgent(userId, data),
    onSuccess: (res) => {
      toast.success(`已成功将用户设置为代理商，邀请码: ${res.data?.agent.code}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      // 更新本地状态
      if (promoteUser) {
        setUserAgentStatus((prev) => ({ ...prev, [promoteUser.id]: true }));
      }
      handleClosePromoteDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '设置代理商失败');
    },
  });

  // 撤销代理商 mutation
  const revokeMutation = useMutation({
    mutationFn: adminApi.revokeAgentStatus,
    onSuccess: (res) => {
      toast.success(res.data?.message || '已撤销代理商身份');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      // 更新本地状态
      if (revokeUser) {
        setUserAgentStatus((prev) => ({ ...prev, [revokeUser.id]: false }));
      }
      handleCloseRevokeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '撤销代理商失败');
    },
  });

  // 检查用户是否为代理商
  const checkAgentStatus = async (userId: string): Promise<boolean> => {
    if (userAgentStatus[userId] !== undefined) {
      return userAgentStatus[userId];
    }
    try {
      const res = await adminApi.checkUserAgentStatus(userId);
      const isAgent = res.data?.isAgent || false;
      setUserAgentStatus((prev) => ({ ...prev, [userId]: isAgent }));
      return isAgent;
    } catch {
      return false;
    }
  };

  const handleOpenPromoteDialog = (user: User) => {
    setPromoteUser(user);
    setAgentName(user.email.split('@')[0]); // 默认使用邮箱前缀作为名称
    setCommissionRate('0.10');
    setShowPromoteDialog(true);
    setSelectedUser(null);
  };

  const handleClosePromoteDialog = () => {
    setShowPromoteDialog(false);
    setPromoteUser(null);
    setAgentName('');
    setCommissionRate('0.10');
  };

  const handleOpenRevokeDialog = (user: User) => {
    setRevokeUser(user);
    setShowRevokeDialog(true);
    setSelectedUser(null);
  };

  const handleCloseRevokeDialog = () => {
    setShowRevokeDialog(false);
    setRevokeUser(null);
  };

  const handlePromote = () => {
    if (!promoteUser) return;
    if (!agentName.trim()) {
      toast.error('请输入代理商名称');
      return;
    }
    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      toast.error('佣金比例必须在 0-1 之间');
      return;
    }
    promoteMutation.mutate({
      userId: promoteUser.id,
      data: { name: agentName, commissionRate },
    });
  };

  const handleRevoke = () => {
    if (!revokeUser) return;
    revokeMutation.mutate(revokeUser.id);
  };

  // 渲染操作菜单
  const renderActionMenu = (user: User) => {
    const isAgent = userAgentStatus[user.id];

    return (
      <div className="absolute right-0 top-full mt-1 w-48 bg-[#1E222D] border border-[#2B3139] rounded-lg shadow-xl z-10">
        <button
          onClick={() => {/* TODO: 查看详情 */}}
          className="w-full px-4 py-2 text-left text-white hover:bg-[#2B3139] flex items-center gap-2"
        >
          <Eye className="w-4 h-4" />
          查看详情
        </button>
        <button
          onClick={() => resetPasswordMutation.mutate(user.id)}
          className="w-full px-4 py-2 text-left text-white hover:bg-[#2B3139] flex items-center gap-2"
        >
          <Key className="w-4 h-4" />
          重置密码
        </button>

        {/* 代理商操作 */}
        {isAgent ? (
          <button
            onClick={() => handleOpenRevokeDialog(user)}
            className="w-full px-4 py-2 text-left text-[#F7931A] hover:bg-[#2B3139] flex items-center gap-2"
          >
            <UserMinus className="w-4 h-4" />
            撤销代理商
          </button>
        ) : (
          <button
            onClick={() => handleOpenPromoteDialog(user)}
            className="w-full px-4 py-2 text-left text-[#00C087] hover:bg-[#2B3139] flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            设为代理商
          </button>
        )}

        <button
          onClick={() => banMutation.mutate(user.id)}
          className="w-full px-4 py-2 text-left text-[#F23645] hover:bg-[#2B3139] flex items-center gap-2"
        >
          <Ban className="w-4 h-4" />
          {user.status === 'active' ? '封禁用户' : '解除封禁'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">用户管理</h1>
        <p className="text-[#848E9C] mt-1">管理平台用户、封号、重置密码、设置代理商</p>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#848E9C]" />
          <input
            type="text"
            placeholder="搜索邮箱或用户 ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white placeholder-[#848E9C] focus:outline-none focus:border-[#3772FF]"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white focus:outline-none focus:border-[#3772FF]"
          >
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="banned">已封禁</option>
          </select>
          <button className="px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white flex items-center gap-2 hover:bg-[#2B3139]">
            <Filter className="w-5 h-5" />
            更多筛选
          </button>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2B3139]">
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">VIP</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">余额</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">实例</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">交易数</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">最后登录</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-[#848E9C]">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#848E9C]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : (
                usersData?.data.map((user) => (
                  <tr key={user.id} className="border-b border-[#2B3139] hover:bg-[#1E222D]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#3772FF]/10 rounded-full flex items-center justify-center">
                          <Mail className="w-5 h-5 text-[#3772FF]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{user.email}</p>
                            {userAgentStatus[user.id] && (
                              <Badge variant="info" size="sm">代理商</Badge>
                            )}
                          </div>
                          <p className="text-[#848E9C] text-xs">{user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.vipLevel === 0 ? 'bg-[#848E9C]/10 text-[#848E9C]' :
                        user.vipLevel === 1 ? 'bg-[#3772FF]/10 text-[#3772FF]' :
                        'bg-[#F7931A]/10 text-[#F7931A]'
                      }`}>
                        VIP {user.vipLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-[#848E9C]" />
                        {parseFloat(user.balance).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white">{user.instanceCount}</td>
                    <td className="px-6 py-4 text-white">{user.totalTrades.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-[#00C087]/10 text-[#00C087]'
                          : 'bg-[#F23645]/10 text-[#F23645]'
                      }`}>
                        {user.status === 'active' ? '正常' : '已封禁'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[#848E9C] flex items-center gap-1 text-sm">
                        <Clock className="w-4 h-4" />
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={async () => {
                            if (selectedUser === user.id) {
                              setSelectedUser(null);
                            } else {
                              // 先检查代理商状态
                              await checkAgentStatus(user.id);
                              setSelectedUser(user.id);
                            }
                          }}
                          className="p-2 hover:bg-[#2B3139] rounded-lg"
                        >
                          <MoreVertical className="w-5 h-5 text-[#848E9C]" />
                        </button>
                        {selectedUser === user.id && renderActionMenu(user)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-6 py-4 border-t border-[#2B3139] flex items-center justify-between">
          <p className="text-[#848E9C] text-sm">
            共 {usersData?.total || 0} 条记录
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-white">
              {page} / {usersData?.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= (usersData?.totalPages || 1)}
              className="px-4 py-2 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 设置代理商对话框 */}
      <Dialog
        open={showPromoteDialog}
        onClose={handleClosePromoteDialog}
        title="设置为代理商"
      >
        <div className="space-y-4">
          {promoteUser && (
            <>
              {/* 用户信息 */}
              <Card className="p-4 bg-bg-tertiary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#3772FF]/10 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#3772FF]" />
                  </div>
                  <div>
                    <p className="text-text-primary font-medium">{promoteUser.email}</p>
                    <p className="text-text-tertiary text-xs">VIP {promoteUser.vipLevel} · 余额 {parseFloat(promoteUser.balance).toFixed(2)} USDT</p>
                  </div>
                </div>
              </Card>

              {/* 代理商名称 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">代理商名称</label>
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="输入代理商显示名称"
                />
              </div>

              {/* 佣金比例 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">佣金比例 (0-1)</label>
                <Input
                  type="number"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="例如: 0.1 表示 10%"
                  min="0"
                  max="1"
                  step="0.01"
                />
                <p className="text-xs text-text-tertiary">
                  当前设置: {(parseFloat(commissionRate || '0') * 100).toFixed(1)}% 返佣
                </p>
              </div>

              {/* 说明 */}
              <div className="p-3 bg-[#3772FF]/10 rounded-lg">
                <p className="text-sm text-[#3772FF]">
                  设置后，该用户可使用其邮箱登录访问代理商后台 (/agent)，获得专属邀请码并开始推广。
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClosePromoteDialog}>
            取消
          </Button>
          <Button
            variant="success"
            onClick={handlePromote}
            isLoading={promoteMutation.isPending}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            确认设置
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 撤销代理商确认对话框 */}
      <Dialog
        open={showRevokeDialog}
        onClose={handleCloseRevokeDialog}
        title="撤销代理商身份"
      >
        <div className="space-y-4">
          {revokeUser && (
            <>
              <div className="p-4 bg-[#F23645]/10 rounded-lg">
                <p className="text-sm text-[#F23645]">
                  确定要撤销用户 <span className="font-medium">{revokeUser.email}</span> 的代理商身份吗？
                </p>
              </div>

              <div className="text-sm text-text-secondary space-y-2">
                <p>撤销后：</p>
                <ul className="list-disc list-inside space-y-1 text-text-tertiary">
                  <li>该用户将无法访问代理商后台</li>
                  <li>其邀请码将失效</li>
                  <li>已有的下级用户关系将保留</li>
                  <li>累计佣金记录将保留</li>
                </ul>
              </div>

              <div className="p-3 bg-[#F7931A]/10 rounded-lg">
                <p className="text-sm text-[#F7931A]">
                  注意：如果该代理商名下有下级用户，则无法撤销。
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseRevokeDialog}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={handleRevoke}
            isLoading={revokeMutation.isPending}
          >
            <UserMinus className="w-4 h-4 mr-2" />
            确认撤销
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
