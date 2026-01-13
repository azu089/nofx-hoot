'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Users,
  Key,
  Loader2,
  Check,
  X,
  Search,
  UserPlus,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Role = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
};

type AdminUser = {
  id: string;
  email: string;
  roles: string[];
  lastLogin: string | null;
};

// 权限分组
const permissionGroups = {
  users: {
    label: '用户管理',
    permissions: ['users.view', 'users.edit', 'users.ban', 'users.reset_password', 'users.reset_2fa'],
  },
  finance: {
    label: '财务管理',
    permissions: ['finance.view', 'finance.approve_withdraw', 'finance.adjust_balance', 'finance.export'],
  },
  instances: {
    label: 'VPS 管理',
    permissions: ['instances.view', 'instances.manage', 'instances.kill_switch'],
  },
  strategies: {
    label: '策略管理',
    permissions: ['strategies.view', 'strategies.create', 'strategies.review', 'strategies.delete'],
  },
  cms: {
    label: '内容管理',
    permissions: ['cms.view', 'cms.edit', 'cms.publish'],
  },
  system: {
    label: '系统管理',
    permissions: ['system.config', 'system.audit_logs', 'system.rbac'],
  },
};

const permissionLabels: Record<string, string> = {
  'users.view': '查看用户',
  'users.edit': '编辑用户',
  'users.ban': '封禁用户',
  'users.reset_password': '重置密码',
  'users.reset_2fa': '重置 2FA',
  'finance.view': '查看财务',
  'finance.approve_withdraw': '审核提现',
  'finance.adjust_balance': '调整余额',
  'finance.export': '导出报表',
  'instances.view': '查看实例',
  'instances.manage': '管理实例',
  'instances.kill_switch': '紧急停机',
  'strategies.view': '查看策略',
  'strategies.create': '创建策略',
  'strategies.review': '审核策略',
  'strategies.delete': '删除策略',
  'cms.view': '查看内容',
  'cms.edit': '编辑内容',
  'cms.publish': '发布内容',
  'system.config': '系统配置',
  'system.audit_logs': '审计日志',
  'system.rbac': '权限管理',
};

export default function RbacPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignUser, setAssignUser] = useState<AdminUser | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // 角色表单
  const [roleForm, setRoleForm] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[],
  });

  const { data: rolesRes, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin', 'rbac', 'roles'],
    queryFn: () => adminApi.getRoles(),
  });

  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'rbac', 'users', userSearch],
    queryFn: () => adminApi.getAdminUsers({ search: userSearch || undefined }),
    enabled: activeTab === 'users',
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: typeof roleForm) => adminApi.createRole(data),
    onSuccess: () => {
      toast.success('角色创建成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'roles'] });
      handleCloseRoleDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '创建失败');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof roleForm> }) =>
      adminApi.updateRole(id, data),
    onSuccess: () => {
      toast.success('角色更新成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'roles'] });
      handleCloseRoleDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || '更新失败');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteRole(id),
    onSuccess: () => {
      toast.success('角色已删除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac', 'roles'] });
      setDeleteRole(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '删除失败');
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      adminApi.assignRole(userId, roleId),
    onSuccess: () => {
      toast.success('角色分配成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac'] });
      setShowAssignDialog(false);
      setAssignUser(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || '分配失败');
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      adminApi.removeRole(userId, roleId),
    onSuccess: () => {
      toast.success('角色已移除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'rbac'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '移除失败');
    },
  });

  const handleOpenCreateRole = () => {
    setEditRole(null);
    setRoleForm({
      name: '',
      displayName: '',
      description: '',
      permissions: [],
    });
    setShowRoleDialog(true);
  };

  const handleOpenEditRole = (role: Role) => {
    setEditRole(role);
    setRoleForm({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      permissions: role.permissions,
    });
    setShowRoleDialog(true);
  };

  const handleCloseRoleDialog = () => {
    setShowRoleDialog(false);
    setEditRole(null);
  };

  const handleTogglePermission = (permission: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleToggleGroup = (groupKey: string) => {
    const group = permissionGroups[groupKey as keyof typeof permissionGroups];
    const allSelected = group.permissions.every((p) => roleForm.permissions.includes(p));

    setRoleForm((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((p) => !group.permissions.includes(p))
        : Array.from(new Set([...prev.permissions, ...group.permissions])),
    }));
  };

  const handleSubmitRole = () => {
    if (!roleForm.name.trim()) {
      toast.error('请输入角色标识');
      return;
    }
    if (!roleForm.displayName.trim()) {
      toast.error('请输入角色名称');
      return;
    }

    if (editRole) {
      updateRoleMutation.mutate({ id: editRole.id, data: roleForm });
    } else {
      createRoleMutation.mutate(roleForm);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-purple-500" />
            权限管理
          </h1>
          <p className="text-text-secondary mt-1">管理管理员角色和权限分配</p>
        </div>
        {activeTab === 'roles' && (
          <Button onClick={handleOpenCreateRole}>
            <Plus className="w-4 h-4 mr-2" />
            创建角色
          </Button>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'roles'
              ? 'bg-brand-primary text-white'
              : 'bg-bg-tertiary text-text-secondary hover:text-white'
          }`}
        >
          <Key className="w-4 h-4 inline mr-2" />
          角色管理
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'users'
              ? 'bg-brand-primary text-white'
              : 'bg-bg-tertiary text-text-secondary hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          用户分配
        </button>
      </div>

      {/* 角色管理 */}
      {activeTab === 'roles' && (
        <div className="grid gap-4">
          {rolesLoading ? (
            <Card className="p-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
            </Card>
          ) : (
            rolesRes?.data?.data?.map((role: Role) => (
              <Card key={role.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{role.displayName}</h3>
                      <Badge variant="secondary">{role.name}</Badge>
                      {role.isSystem && <Badge variant="info">系统角色</Badge>}
                    </div>

                    <p className="text-text-secondary mb-4">{role.description || '无描述'}</p>

                    <div className="flex items-center gap-4 text-sm text-text-secondary mb-4">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {role.userCount} 个用户
                      </div>
                      <div className="flex items-center gap-1">
                        <Key className="w-4 h-4" />
                        {role.permissions.length} 个权限
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {role.permissions.slice(0, 6).map((perm) => (
                        <Badge key={perm} variant="secondary" size="sm">
                          {permissionLabels[perm] || perm}
                        </Badge>
                      ))}
                      {role.permissions.length > 6 && (
                        <Badge variant="secondary" size="sm">
                          +{role.permissions.length - 6} 更多
                        </Badge>
                      )}
                    </div>
                  </div>

                  {!role.isSystem && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditRole(role)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteRole(role)}
                        className="text-danger hover:text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 用户分配 */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              placeholder="搜索管理员..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-primary">
                  <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">管理员</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">角色</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">最后登录</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-text-secondary">
                      <Loader2 className="w-5 h-5 animate-spin inline" />
                    </td>
                  </tr>
                ) : (
                  usersRes?.data?.data?.map((user: AdminUser) => (
                    <tr key={user.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                      <td className="px-6 py-4">
                        <p className="text-white">{user.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((roleId) => {
                            const role = rolesRes?.data?.data?.find((r: Role) => r.id === roleId);
                            return (
                              <Badge key={roleId} variant="info">
                                {role?.displayName || roleId}
                                <button
                                  onClick={() => removeRoleMutation.mutate({ userId: user.id, roleId })}
                                  className="ml-1 hover:text-danger"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAssignUser(user);
                            setShowAssignDialog(true);
                          }}
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          分配角色
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 创建/编辑角色对话框 */}
      <Dialog
        open={showRoleDialog}
        onClose={handleCloseRoleDialog}
        title={editRole ? '编辑角色' : '创建角色'}
        className="max-w-2xl"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">角色标识 *</label>
              <Input
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder="例如: finance_manager"
                disabled={!!editRole}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">显示名称 *</label>
              <Input
                value={roleForm.displayName}
                onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })}
                placeholder="例如: 财务主管"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">描述</label>
            <Input
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              placeholder="角色描述..."
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm text-text-secondary">权限</label>
            {Object.entries(permissionGroups).map(([key, group]) => {
              const allSelected = group.permissions.every((p) => roleForm.permissions.includes(p));
              const someSelected = group.permissions.some((p) => roleForm.permissions.includes(p));

              return (
                <div key={key} className="p-4 bg-bg-tertiary rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={() => handleToggleGroup(key)}
                      className="w-4 h-4 rounded border-border-primary text-brand-primary focus:ring-[#3772FF]"
                    />
                    <span className="text-white font-medium">{group.label}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 ml-6">
                    {group.permissions.map((perm) => (
                      <label key={perm} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={roleForm.permissions.includes(perm)}
                          onChange={() => handleTogglePermission(perm)}
                          className="w-4 h-4 rounded border-border-primary text-brand-primary focus:ring-[#3772FF]"
                        />
                        <span className="text-text-secondary text-sm">{permissionLabels[perm]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCloseRoleDialog}>
            取消
          </Button>
          <Button
            onClick={handleSubmitRole}
            isLoading={createRoleMutation.isPending || updateRoleMutation.isPending}
          >
            {editRole ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 删除角色确认 */}
      <Dialog
        open={!!deleteRole}
        onClose={() => setDeleteRole(null)}
        title="确认删除"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            确定要删除角色 <span className="text-white">{deleteRole?.displayName}</span> 吗？
          </p>
          {deleteRole && deleteRole.userCount > 0 && (
            <div className="p-3 bg-warning/10 rounded-lg">
              <p className="text-sm text-warning">
                该角色下有 {deleteRole.userCount} 个用户，删除后这些用户将失去相关权限
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteRole(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteRole && deleteRoleMutation.mutate(deleteRole.id)}
            isLoading={deleteRoleMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            确认删除
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 分配角色对话框 */}
      <Dialog
        open={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        title="分配角色"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            为 <span className="text-white">{assignUser?.email}</span> 分配角色
          </p>
          <div className="space-y-2">
            {rolesRes?.data?.data?.map((role: Role) => {
              const isAssigned = assignUser?.roles.includes(role.id);
              return (
                <button
                  key={role.id}
                  onClick={() => {
                    if (!isAssigned && assignUser) {
                      assignRoleMutation.mutate({ userId: assignUser.id, roleId: role.id });
                    }
                  }}
                  disabled={isAssigned}
                  className={`w-full p-4 rounded-lg text-left transition-colors ${
                    isAssigned
                      ? 'bg-brand-primary/10 border border-brand-primary'
                      : 'bg-bg-tertiary border border-border-primary hover:border-brand-primary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{role.displayName}</p>
                      <p className="text-text-secondary text-sm">{role.description}</p>
                    </div>
                    {isAssigned && <Check className="w-5 h-5 text-brand-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
            关闭
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
