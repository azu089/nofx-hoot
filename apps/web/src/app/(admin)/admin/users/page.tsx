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
  Coins,
  CreditCard,
  Star,
  Edit3,
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
  pointsBalance: string;
  cardBalance: string;
  tokenBalance: string;
  status: string;
  instanceCount: number;
  totalTrades: number;
  createdAt: string;
  lastLogin: string | null;
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

  // 资产修改对话框状态
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustUser, setAdjustUser] = useState<User | null>(null);
  const [adjustType, setAdjustType] = useState<'usdt' | 'points' | 'card' | 'token'>('usdt');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

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

  // 资产调整 mutation
  const adjustMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { type: string; amount: string; reason: string } }) =>
      adminApi.adjustUserBalance(userId, data),
    onSuccess: () => {
      toast.success('资产调整成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      handleCloseAdjustDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '资产调整失败');
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

  // 资产调整对话框处理函数
  const handleOpenAdjustDialog = (user: User) => {
    setAdjustUser(user);
    setAdjustType('usdt');
    setAdjustAmount('');
    setAdjustReason('');
    setShowAdjustDialog(true);
    setSelectedUser(null);
  };

  const handleCloseAdjustDialog = () => {
    setShowAdjustDialog(false);
    setAdjustUser(null);
    setAdjustAmount('');
    setAdjustReason('');
  };

  const handleAdjust = () => {
    if (!adjustUser) return;
    if (!adjustAmount || parseFloat(adjustAmount) === 0) {
      toast.error('请输入调整金额');
      return;
    }
    if (!adjustReason.trim()) {
      toast.error('请输入调整原因');
      return;
    }
    adjustMutation.mutate({
      userId: adjustUser.id,
      data: {
        type: adjustType,
        amount: adjustAmount,
        reason: adjustReason,
      },
    });
  };

  // 渲染操作菜单
  const renderActionMenu = (user: User) => {
    const isAgent = userAgentStatus[user.id];

    return (
      <div className="absolute right-0 top-full mt-1 w-48 bg-bg-tertiary border border-border-primary rounded-lg shadow-xl z-10">
        <button
          onClick={() => {/* TODO: 查看详情 */}}
          className="w-full px-4 py-2 text-left text-white hover:bg-bg-tertiary flex items-center gap-2"
        >
          <Eye className="w-4 h-4" />
          查看详情
        </button>
        <button
          onClick={() => resetPasswordMutation.mutate(user.id)}
          className="w-full px-4 py-2 text-left text-white hover:bg-bg-tertiary flex items-center gap-2"
        >
          <Key className="w-4 h-4" />
          重置密码
        </button>
        <button
          onClick={() => handleOpenAdjustDialog(user)}
          className="w-full px-4 py-2 text-left text-brand-primary hover:bg-bg-tertiary flex items-center gap-2"
        >
          <Edit3 className="w-4 h-4" />
          调整资产
        </button>

        {/* 代理商操作 */}
        {isAgent ? (
          <button
            onClick={() => handleOpenRevokeDialog(user)}
            className="w-full px-4 py-2 text-left text-warning hover:bg-bg-tertiary flex items-center gap-2"
          >
            <UserMinus className="w-4 h-4" />
            撤销代理商
          </button>
        ) : (
          <button
            onClick={() => handleOpenPromoteDialog(user)}
            className="w-full px-4 py-2 text-left text-success hover:bg-bg-tertiary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            设为代理商
          </button>
        )}

        <button
          onClick={() => banMutation.mutate(user.id)}
          className="w-full px-4 py-2 text-left text-danger hover:bg-bg-tertiary flex items-center gap-2"
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
        <p className="text-text-secondary mt-1">管理平台用户、封号、重置密码、设置代理商</p>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索邮箱或用户 ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="banned">已封禁</option>
          </select>
          <button className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white flex items-center gap-2 hover:bg-bg-tertiary">
            <Filter className="w-5 h-5" />
            更多筛选
          </button>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-text-secondary">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              加载中...
            </div>
          </div>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <div className="space-y-3 p-4 md:hidden">
              {usersData?.data.map((user) => (
                <div
                  key={user.id}
                  className="bg-bg-tertiary border border-border-primary rounded-lg p-4 space-y-3"
                >
                  {/* 第一行：用户信息 + VIP 等级 */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-medium truncate">{user.email}</p>
                          {userAgentStatus[user.id] && (
                            <Badge variant="info" size="sm">代理商</Badge>
                          )}
                        </div>
                        <p className="text-text-secondary text-xs truncate">{user.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ml-2 ${
                      user.vipLevel === 0 ? 'bg-text-secondary/10 text-text-secondary' :
                      user.vipLevel === 1 ? 'bg-brand-primary/10 text-brand-primary' :
                      'bg-warning/10 text-warning'
                    }`}>
                      VIP {user.vipLevel}
                    </span>
                  </div>

                  {/* 第二行：资产概览 */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-text-tertiary text-xs mb-0.5">USDT 余额</p>
                      <p className="text-white flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-success" />
                        {parseFloat(user.balance).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs mb-0.5">积分</p>
                      <p className="text-white flex items-center gap-1">
                        <Star className="w-3 h-3 text-warning" />
                        {parseFloat(user.pointsBalance).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs mb-0.5">点卡</p>
                      <p className="text-white flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-brand-primary" />
                        {parseFloat(user.cardBalance).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs mb-0.5">代币</p>
                      <p className="text-white flex items-center gap-1">
                        <Coins className="w-3 h-3 text-purple-400" />
                        {parseFloat(user.tokenBalance).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* 第三行：实例 + 交易数 */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-text-tertiary text-xs mb-0.5">实例</p>
                      <p className="text-white">{user.instanceCount}</p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs mb-0.5">交易数</p>
                      <p className="text-white">{user.totalTrades.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* 第三行：状态 + 最后登录 + 操作 */}
                  <div className="flex items-center justify-between pt-2 border-t border-border-primary/30">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger'
                      }`}>
                        {user.status === 'active' ? '正常' : '已封禁'}
                      </span>
                      <span className="text-text-tertiary text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('zh-CN') : '-'}
                      </span>
                    </div>
                    <div className="relative inline-block">
                      <button
                        onClick={async () => {
                          if (selectedUser === user.id) {
                            setSelectedUser(null);
                          } else {
                            await checkAgentStatus(user.id);
                            setSelectedUser(user.id);
                          }
                        }}
                        className="p-2 hover:bg-bg-secondary rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4 text-text-secondary" />
                      </button>
                      {selectedUser === user.id && renderActionMenu(user)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 桌面端表格布局 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-primary">
                    <th className="px-4 py-4 text-left text-sm font-medium text-text-secondary">用户</th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">VIP</th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />USDT</span>
                    </th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3" />积分</span>
                    </th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">
                      <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />点卡</span>
                    </th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">
                      <span className="flex items-center gap-1"><Coins className="w-3 h-3" />代币</span>
                    </th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">实例</th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">交易</th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">状态</th>
                    <th className="px-3 py-4 text-left text-sm font-medium text-text-secondary">最后登录</th>
                    <th className="px-3 py-4 text-right text-sm font-medium text-text-secondary">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData?.data.map((user) => (
                    <tr key={user.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-brand-primary/10 rounded-full flex items-center justify-center">
                            <Mail className="w-4 h-4 text-brand-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium text-sm">{user.email}</p>
                              {userAgentStatus[user.id] && (
                                <Badge variant="info" size="sm">代理商</Badge>
                              )}
                            </div>
                            <p className="text-text-tertiary text-xs">{user.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.vipLevel === 0 ? 'bg-text-secondary/10 text-text-secondary' :
                          user.vipLevel === 1 ? 'bg-brand-primary/10 text-brand-primary' :
                          'bg-warning/10 text-warning'
                        }`}>
                          VIP {user.vipLevel}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-success text-sm font-medium">
                          {parseFloat(user.balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-warning text-sm">
                          {parseFloat(user.pointsBalance).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-brand-primary text-sm">
                          {parseFloat(user.cardBalance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-purple-400 text-sm">
                          {parseFloat(user.tokenBalance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white text-sm">{user.instanceCount}</td>
                      <td className="px-3 py-3 text-white text-sm">{user.totalTrades.toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.status === 'active'
                            ? 'bg-success/10 text-success'
                            : 'bg-danger/10 text-danger'
                        }`}>
                          {user.status === 'active' ? '正常' : '封禁'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-text-secondary text-xs">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('zh-CN') : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={async () => {
                              if (selectedUser === user.id) {
                                setSelectedUser(null);
                              } else {
                                await checkAgentStatus(user.id);
                                setSelectedUser(user.id);
                              }
                            }}
                            className="p-2 hover:bg-bg-tertiary rounded-lg"
                          >
                            <MoreVertical className="w-5 h-5 text-text-secondary" />
                          </button>
                          {selectedUser === user.id && renderActionMenu(user)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 分页 */}
        <div className="px-6 py-4 border-t border-border-primary flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            共 {usersData?.total || 0} 条记录
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-white">
              {page} / {usersData?.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= (usersData?.totalPages || 1)}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white disabled:opacity-50"
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
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-brand-primary" />
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
              <div className="p-3 bg-brand-primary/10 rounded-lg">
                <p className="text-sm text-brand-primary">
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
              <div className="p-4 bg-danger/10 rounded-lg">
                <p className="text-sm text-danger">
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

              <div className="p-3 bg-warning/10 rounded-lg">
                <p className="text-sm text-warning">
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

      {/* 资产调整对话框 */}
      <Dialog
        open={showAdjustDialog}
        onClose={handleCloseAdjustDialog}
        title="调整用户资产"
      >
        <div className="space-y-4">
          {adjustUser && (
            <>
              {/* 用户信息 */}
              <Card className="p-4 bg-bg-tertiary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <p className="text-text-primary font-medium">{adjustUser.email}</p>
                    <p className="text-text-tertiary text-xs">
                      VIP {adjustUser.vipLevel} · ID: {adjustUser.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              </Card>

              {/* 当前资产概览 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-bg-tertiary rounded-lg">
                  <p className="text-text-tertiary text-xs mb-1">USDT 余额</p>
                  <p className="text-success font-medium">{parseFloat(adjustUser.balance).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg">
                  <p className="text-text-tertiary text-xs mb-1">积分</p>
                  <p className="text-warning font-medium">{parseFloat(adjustUser.pointsBalance).toFixed(0)}</p>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg">
                  <p className="text-text-tertiary text-xs mb-1">点卡余额</p>
                  <p className="text-brand-primary font-medium">{parseFloat(adjustUser.cardBalance).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg">
                  <p className="text-text-tertiary text-xs mb-1">代币</p>
                  <p className="text-purple-400 font-medium">{parseFloat(adjustUser.tokenBalance).toFixed(2)}</p>
                </div>
              </div>

              {/* 调整类型 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">调整类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { type: 'usdt' as const, label: 'USDT', icon: DollarSign, color: 'text-success' },
                    { type: 'points' as const, label: '积分', icon: Star, color: 'text-warning' },
                    { type: 'card' as const, label: '点卡', icon: CreditCard, color: 'text-brand-primary' },
                    { type: 'token' as const, label: '代币', icon: Coins, color: 'text-purple-400' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setAdjustType(item.type)}
                      className={`p-3 rounded-lg border transition-colors flex flex-col items-center gap-1 ${
                        adjustType === item.type
                          ? 'border-brand-primary bg-brand-primary/10'
                          : 'border-border-primary bg-bg-tertiary hover:border-border-secondary'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                      <span className="text-xs text-text-primary">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 调整金额 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">
                  调整金额 <span className="text-text-tertiary">(正数增加, 负数扣除)</span>
                </label>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="例如: 100 或 -50"
                  step="0.01"
                />
              </div>

              {/* 调整原因 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">调整原因 <span className="text-danger">*</span></label>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="请输入调整原因，将记录到审计日志"
                />
              </div>

              {/* 预览 */}
              {adjustAmount && parseFloat(adjustAmount) !== 0 && (
                <div className="p-3 bg-brand-primary/10 rounded-lg">
                  <p className="text-sm text-brand-primary">
                    调整后{adjustType === 'usdt' ? ' USDT 余额' : adjustType === 'points' ? '积分' : adjustType === 'card' ? '点卡余额' : '代币'}将变为:{' '}
                    <span className="font-medium">
                      {(
                        parseFloat(
                          adjustType === 'usdt' ? adjustUser.balance :
                          adjustType === 'points' ? adjustUser.pointsBalance :
                          adjustType === 'card' ? adjustUser.cardBalance : adjustUser.tokenBalance
                        ) + parseFloat(adjustAmount || '0')
                      ).toFixed(adjustType === 'points' ? 0 : 2)}
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseAdjustDialog}>
            取消
          </Button>
          <Button
            onClick={handleAdjust}
            isLoading={adjustMutation.isPending}
          >
            <Edit3 className="w-4 h-4 mr-2" />
            确认调整
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
