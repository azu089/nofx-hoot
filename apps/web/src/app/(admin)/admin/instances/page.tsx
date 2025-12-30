'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server,
  Activity,
  AlertTriangle,
  Power,
  RefreshCw,
  Trash2,
  Search,
  Filter,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
} from 'lucide-react';

// 模拟 VPS 管理 API
const instancesApi = {
  getInstances: async (params: { page: number; status?: string }) => {
    // TODO: 对接真实 API
    return {
      data: [
        {
          id: 'vps-001',
          userId: 'user-1',
          userEmail: 'user1@example.com',
          ip: '128.199.123.45',
          region: 'sgp1',
          status: 'running',
          cpu: 45,
          memory: 62,
          disk: 30,
          uptime: '15 天 3 小时',
          lastHeartbeat: '30 秒前',
          strategy: 'Grid Trading',
          createdAt: '2024-12-10',
        },
        {
          id: 'vps-002',
          userId: 'user-2',
          userEmail: 'user2@example.com',
          ip: '128.199.123.46',
          region: 'nyc3',
          status: 'running',
          cpu: 78,
          memory: 85,
          disk: 55,
          uptime: '7 天 12 小时',
          lastHeartbeat: '45 秒前',
          strategy: 'DCA Bot',
          createdAt: '2024-12-18',
        },
        {
          id: 'vps-003',
          userId: 'user-3',
          userEmail: 'user3@example.com',
          ip: '128.199.123.47',
          region: 'ams3',
          status: 'zombie',
          cpu: 0,
          memory: 0,
          disk: 45,
          uptime: '-',
          lastHeartbeat: '20 分钟前',
          strategy: 'Arbitrage',
          createdAt: '2024-12-01',
        },
      ],
      total: 456,
      running: 423,
      stopped: 20,
      zombie: 13,
    };
  },
  restartInstance: async (instanceId: string) => {
    return { success: true };
  },
  destroyInstance: async (instanceId: string) => {
    return { success: true };
  },
};

export default function AdminInstancesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'instances', page, statusFilter],
    queryFn: () => instancesApi.getInstances({ page, status: statusFilter }),
    refetchInterval: 30000, // 每 30 秒刷新
  });

  const restartMutation = useMutation({
    mutationFn: instancesApi.restartInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'instances'] });
    },
  });

  const destroyMutation = useMutation({
    mutationFn: instancesApi.destroyInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'instances'] });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-[#00C087]/10 text-[#00C087]';
      case 'stopped': return 'bg-[#848E9C]/10 text-[#848E9C]';
      case 'zombie': return 'bg-[#F23645]/10 text-[#F23645]';
      default: return 'bg-[#F7931A]/10 text-[#F7931A]';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '运行中';
      case 'stopped': return '已停止';
      case 'zombie': return '僵尸节点';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">VPS 监控</h1>
        <p className="text-[#848E9C] mt-1">监控全网 VPS 实例状态</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">总实例</p>
              <p className="text-xl font-bold text-white">{data?.total || 0}</p>
            </div>
            <Server className="w-8 h-8 text-[#3772FF]" />
          </div>
        </div>
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">运行中</p>
              <p className="text-xl font-bold text-[#00C087]">{data?.running || 0}</p>
            </div>
            <Activity className="w-8 h-8 text-[#00C087]" />
          </div>
        </div>
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">已停止</p>
              <p className="text-xl font-bold text-[#848E9C]">{data?.stopped || 0}</p>
            </div>
            <Power className="w-8 h-8 text-[#848E9C]" />
          </div>
        </div>
        <div className="bg-[#131722] rounded-xl p-4 border border-[#2B3139]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#848E9C] text-sm">僵尸节点</p>
              <p className="text-xl font-bold text-[#F23645]">{data?.zombie || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-[#F23645]" />
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#848E9C]" />
          <input
            type="text"
            placeholder="搜索 IP、用户邮箱或实例 ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white placeholder-[#848E9C] focus:outline-none focus:border-[#3772FF]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-[#1E222D] border border-[#2B3139] rounded-lg text-white focus:outline-none"
        >
          <option value="all">全部状态</option>
          <option value="running">运行中</option>
          <option value="stopped">已停止</option>
          <option value="zombie">僵尸节点</option>
        </select>
      </div>

      {/* 实例列表 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2B3139]">
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">实例</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">用户</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">策略</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">资源</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-[#848E9C]">心跳</th>
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
              ) : (
                data?.data.map((instance) => (
                  <tr key={instance.id} className="border-b border-[#2B3139] hover:bg-[#1E222D]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#3772FF]/10 rounded-lg flex items-center justify-center">
                          <Server className="w-5 h-5 text-[#3772FF]" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{instance.ip}</p>
                          <p className="text-[#848E9C] text-xs">{instance.id} · {instance.region}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-sm">{instance.userEmail}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-sm">{instance.strategy}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <Cpu className="w-3 h-3 text-[#848E9C]" />
                          <div className="w-16 h-1.5 bg-[#2B3139] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                instance.cpu > 80 ? 'bg-[#F23645]' : 'bg-[#00C087]'
                              }`}
                              style={{ width: `${instance.cpu}%` }}
                            />
                          </div>
                          <span className="text-[#848E9C]">{instance.cpu}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <HardDrive className="w-3 h-3 text-[#848E9C]" />
                          <div className="w-16 h-1.5 bg-[#2B3139] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                instance.memory > 80 ? 'bg-[#F23645]' : 'bg-[#3772FF]'
                              }`}
                              style={{ width: `${instance.memory}%` }}
                            />
                          </div>
                          <span className="text-[#848E9C]">{instance.memory}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(instance.status)}`}>
                        {getStatusText(instance.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm flex items-center gap-1 ${
                        instance.status === 'zombie' ? 'text-[#F23645]' : 'text-[#848E9C]'
                      }`}>
                        <Wifi className="w-4 h-4" />
                        {instance.lastHeartbeat}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => restartMutation.mutate(instance.id)}
                          disabled={instance.status === 'zombie'}
                          className="p-2 hover:bg-[#2B3139] rounded-lg disabled:opacity-50"
                          title="重启"
                        >
                          <RefreshCw className="w-5 h-5 text-[#3772FF]" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('确定要销毁此实例吗？此操作不可撤销。')) {
                              destroyMutation.mutate(instance.id);
                            }
                          }}
                          className="p-2 hover:bg-[#2B3139] rounded-lg"
                          title="销毁"
                        >
                          <Trash2 className="w-5 h-5 text-[#F23645]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
