'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, Users, Edit2, Check, X, RefreshCw, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

type Agent = {
  id: string;
  code: string;
  name: string;
  email: string;
  level: number;
  commissionRate: string;
  totalUsers: number;
  actualUsers: number;
  totalCommission: string;
  status: string;
  parentAgentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCommissionRate, setEditCommissionRate] = useState('');
  const [editStatus, setEditStatus] = useState('');

  // 获取代理商列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-agents', page, search, statusFilter],
    queryFn: async () => {
      const res = await adminApi.getAgents({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      return res.data;
    },
  });

  // 更新代理商
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { commissionRate?: string; status?: string; name?: string } }) =>
      adminApi.updateAgent(id, data),
    onSuccess: () => {
      toast.success('代理商配置更新成功');
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      handleCloseDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '操作失败');
    },
  });

  const handleOpenEdit = (agent: Agent) => {
    setSelectedAgent(agent);
    setEditName(agent.name);
    setEditCommissionRate(agent.commissionRate);
    setEditStatus(agent.status);
    setShowEditDialog(true);
  };

  const handleCloseDialog = () => {
    setShowEditDialog(false);
    setSelectedAgent(null);
    setEditName('');
    setEditCommissionRate('');
    setEditStatus('');
  };

  const handleUpdate = () => {
    if (!selectedAgent) return;

    const updates: { commissionRate?: string; status?: string; name?: string } = {};

    if (editName !== selectedAgent.name) {
      updates.name = editName;
    }
    if (editCommissionRate !== selectedAgent.commissionRate) {
      updates.commissionRate = editCommissionRate;
    }
    if (editStatus !== selectedAgent.status) {
      updates.status = editStatus;
    }

    if (Object.keys(updates).length === 0) {
      toast.info('没有修改内容');
      return;
    }

    updateMutation.mutate({ id: selectedAgent.id, data: updates });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" outline><Check className="w-3 h-3 mr-1" />正常</Badge>;
      case 'suspended':
        return <Badge variant="danger" outline><X className="w-3 h-3 mr-1" />已暂停</Badge>;
      case 'pending':
        return <Badge variant="warning" outline>待审核</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">代理商管理</h1>
          <p className="text-text-secondary">管理平台代理商账号和配置</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/10">
                <Users className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <div className="text-sm text-text-secondary">代理商总数</div>
                <div className="text-xl font-bold text-text-primary">{data.total}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div>
                <div className="text-sm text-text-secondary">活跃代理商</div>
                <div className="text-xl font-bold text-success">
                  {data.data.filter(a => a.status === 'active').length}
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <DollarSign className="w-5 h-5 text-warning" />
              </div>
              <div>
                <div className="text-sm text-text-secondary">总佣金发放</div>
                <div className="text-xl font-bold text-warning">
                  {data.data.reduce((sum, a) => sum + parseFloat(a.totalCommission), 0).toFixed(2)} USDT
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 搜索和筛选 */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜索代理商名称/邮箱/邀请码..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === '' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(''); setPage(1); }}
            >
              全部
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('active'); setPage(1); }}
            >
              正常
            </Button>
            <Button
              variant={statusFilter === 'suspended' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('suspended'); setPage(1); }}
            >
              已暂停
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter('pending'); setPage(1); }}
            >
              待审核
            </Button>
          </div>
        </div>
      </Card>

      {/* 代理商列表 */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">代理商列表</h2>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">代理商</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">邀请码</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">佣金比例</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">下级用户</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">累计佣金</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">注册时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {data?.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                        暂无代理商数据
                      </td>
                    </tr>
                  ) : (
                    data?.data.map((agent) => (
                      <tr key={agent.id} className="hover:bg-bg-tertiary/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-text-primary">{agent.name}</div>
                          <div className="text-xs text-text-tertiary">{agent.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <code className="px-2 py-1 bg-bg-tertiary rounded text-sm text-brand-primary">
                            {agent.code}
                          </code>
                        </td>
                        <td className="px-6 py-4 font-mono text-text-primary">
                          {(parseFloat(agent.commissionRate) * 100).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-text-primary">{agent.actualUsers}</span>
                          <span className="text-text-tertiary"> / {agent.totalUsers}</span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-success">
                          {parseFloat(agent.totalCommission).toFixed(2)} USDT
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(agent.status)}
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary">
                          {formatDate(agent.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(agent)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
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
          </>
        )}
      </Card>

      {/* 编辑对话框 */}
      <Dialog
        open={showEditDialog}
        onClose={handleCloseDialog}
        title="编辑代理商配置"
      >
        <div className="space-y-4">
          {selectedAgent && (
            <>
              {/* 基本信息（只读） */}
              <div className="bg-bg-tertiary rounded-lg p-3">
                <div className="text-sm font-medium text-text-primary">{selectedAgent.email}</div>
                <div className="text-xs text-text-tertiary">邀请码: {selectedAgent.code}</div>
              </div>

              {/* 名称 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">代理商名称</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="输入代理商名称"
                />
              </div>

              {/* 佣金比例 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">佣金比例 (0-1)</label>
                <Input
                  type="number"
                  value={editCommissionRate}
                  onChange={(e) => setEditCommissionRate(e.target.value)}
                  placeholder="例如: 0.1 表示 10%"
                  min="0"
                  max="1"
                  step="0.01"
                />
                <p className="text-xs text-text-tertiary">
                  当前: {(parseFloat(editCommissionRate || '0') * 100).toFixed(1)}%
                </p>
              </div>

              {/* 状态 */}
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">状态</label>
                <div className="flex gap-2">
                  <Button
                    variant={editStatus === 'active' ? 'success' : 'outline'}
                    size="sm"
                    onClick={() => setEditStatus('active')}
                  >
                    正常
                  </Button>
                  <Button
                    variant={editStatus === 'suspended' ? 'danger' : 'outline'}
                    size="sm"
                    onClick={() => setEditStatus('suspended')}
                  >
                    暂停
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdate}
            isLoading={updateMutation.isPending}
          >
            保存修改
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
