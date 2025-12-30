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
  Shield,
  Clock,
  DollarSign,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data: usersRes, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, statusFilter],
    queryFn: () => adminApi.getUsers({ page, search, status: statusFilter }),
  });
  const usersData = usersRes?.data;

  const banMutation = useMutation({
    mutationFn: adminApi.banUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setSelectedUser(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: adminApi.resetPassword,
    onSuccess: (res) => {
      alert(`临时密码: ${res.data?.tempPassword}`);
      setSelectedUser(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">用户管理</h1>
        <p className="text-[#848E9C] mt-1">管理平台用户、封号、重置密码</p>
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
                    加载中...
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
                          <p className="text-white font-medium">{user.email}</p>
                          <p className="text-[#848E9C] text-xs">{user.id}</p>
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
                        {user.balance}
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
                        {user.lastLogin}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                          className="p-2 hover:bg-[#2B3139] rounded-lg"
                        >
                          <MoreVertical className="w-5 h-5 text-[#848E9C]" />
                        </button>
                        {selectedUser === user.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-[#1E222D] border border-[#2B3139] rounded-lg shadow-xl z-10">
                            <button
                              onClick={() => {
                                setSelectedUser(null);
                                window.location.href = `/users/${user.id}`;
                              }}
                              className="w-full px-4 py-2 text-left text-white hover:bg-[#2B3139] flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              查看详情
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('确定要重置该用户的密码吗？')) {
                                  resetPasswordMutation.mutate(user.id);
                                }
                              }}
                              disabled={resetPasswordMutation.isPending}
                              className="w-full px-4 py-2 text-left text-white hover:bg-[#2B3139] flex items-center gap-2 disabled:opacity-50"
                            >
                              <Key className="w-4 h-4" />
                              重置密码
                            </button>
                            <button
                              onClick={() => {
                                const action = user.status === 'active' ? '封禁' : '解除封禁';
                                if (confirm(`确定要${action}该用户吗？此操作将立即生效。`)) {
                                  banMutation.mutate(user.id);
                                }
                              }}
                              disabled={banMutation.isPending}
                              className="w-full px-4 py-2 text-left text-[#F23645] hover:bg-[#2B3139] flex items-center gap-2 disabled:opacity-50"
                            >
                              <Ban className="w-4 h-4" />
                              {user.status === 'active' ? '封禁用户' : '解除封禁'}
                            </button>
                          </div>
                        )}
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
    </div>
  );
}
