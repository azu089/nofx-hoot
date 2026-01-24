'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { UserCheck, Search, Eye, Edit2, Ban, CheckCircle, Users, DollarSign, TrendingUp, X } from 'lucide-react';

interface Agent {
  id: string;
  email: string;
  name: string;
  level: number;
  commissionRate: string;
  totalCommission: string;
  pendingCommission: string;
  totalReferrals: number;
  activeReferrals: number;
  status: 'active' | 'inactive' | 'banned';
  created_at: string;
}

interface AgentDetail extends Agent {
  referrals: {
    id: string;
    email: string;
    vip_level: number;
    totalSpent: string;
    commissionGenerated: string;
    created_at: string;
  }[];
}

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 获取代理商列表
  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await api.get(`/admin/agents?${params.toString()}`);
      return res.data as Agent[];
    },
  });

  // 获取代理商详情
  const fetchAgentDetail = async (agentId: string) => {
    const res = await api.get(`/admin/agents/${agentId}`);
    setSelectedAgent(res.data);
    setShowModal(true);
  };

  // 更新代理商状态
  const updateStatusMutation = useMutation({
    mutationFn: async ({ agentId, status }: { agentId: string; status: string }) => {
      return api.patch(`/admin/agents/${agentId}`, { status });
    },
    onSuccess: () => {
      toast.success('状态已更新');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '更新失败');
    },
  });

  // 统计数据
  const totalAgents = agents?.length || 0;
  const activeAgents = agents?.filter((a) => a.status === 'active').length || 0;
  const totalCommission = agents?.reduce((sum, a) => sum + Number(a.totalCommission), 0) || 0;
  const totalReferrals = agents?.reduce((sum, a) => sum + a.totalReferrals, 0) || 0;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
          <UserCheck className="w-5 h-5 text-brand-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">代理商管理</h1>
          <p className="text-sm text-text-secondary">管理代理商、查看返佣数据</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-brand-primary/10 rounded-lg flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-brand-primary" />
            </div>
            <span className="text-text-secondary text-sm">代理商总数</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalAgents}</p>
        </div>

        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-success" />
            </div>
            <span className="text-text-secondary text-sm">活跃代理</span>
          </div>
          <p className="text-2xl font-bold text-white">{activeAgents}</p>
        </div>

        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-warning" />
            </div>
            <span className="text-text-secondary text-sm">累计返佣</span>
          </div>
          <p className="text-2xl font-bold text-white">
            ${totalCommission.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-bg-secondary rounded-xl p-5 border border-border-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-info" />
            </div>
            <span className="text-text-secondary text-sm">总推荐人数</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalReferrals}</p>
        </div>
      </div>

      {/* 搜索 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索代理商邮箱或名称..."
            className="flex-1 bg-bg-secondary text-white rounded-lg px-4 py-2 border border-border-primary focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      {/* 代理商列表 */}
      <div className="bg-bg-secondary rounded-xl border border-border-primary">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-text-secondary text-sm border-b border-border-primary">
                  <th className="text-left p-4">代理商</th>
                  <th className="text-left p-4">等级</th>
                  <th className="text-right p-4">佣金比例</th>
                  <th className="text-right p-4">累计返佣</th>
                  <th className="text-right p-4">待结算</th>
                  <th className="text-right p-4">推荐人数</th>
                  <th className="text-left p-4">状态</th>
                  <th className="text-left p-4">注册时间</th>
                  <th className="text-center p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {agents?.map((agent) => (
                  <tr key={agent.id} className="border-b border-border-primary hover:bg-bg-tertiary">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{agent.name || '未设置'}</p>
                        <p className="text-text-tertiary text-sm">{agent.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary rounded text-xs font-medium">
                        Lv.{agent.level}
                      </span>
                    </td>
                    <td className="p-4 text-right text-white">
                      {(Number(agent.commissionRate) * 100).toFixed(0)}%
                    </td>
                    <td className="p-4 text-right text-success font-medium">
                      ${Number(agent.totalCommission).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right text-warning">
                      ${Number(agent.pendingCommission).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-white">{agent.totalReferrals}</span>
                      <span className="text-text-secondary text-sm"> / {agent.activeReferrals} 活跃</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          agent.status === 'active'
                            ? 'bg-success/10 text-success'
                            : agent.status === 'banned'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-text-secondary/10 text-text-secondary'
                        }`}
                      >
                        {agent.status === 'active' ? '正常' : agent.status === 'banned' ? '封禁' : '停用'}
                      </span>
                    </td>
                    <td className="p-4 text-text-secondary text-sm">
                      {new Date(agent.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => fetchAgentDetail(agent.id)}
                          className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4 text-text-secondary hover:text-white" />
                        </button>
                        {agent.status === 'active' ? (
                          <button
                            onClick={() => updateStatusMutation.mutate({ agentId: agent.id, status: 'banned' })}
                            className="p-2 hover:bg-danger/10 rounded-lg transition-colors"
                            title="封禁"
                          >
                            <Ban className="w-4 h-4 text-text-secondary hover:text-danger" />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatusMutation.mutate({ agentId: agent.id, status: 'active' })}
                            className="p-2 hover:bg-success/10 rounded-lg transition-colors"
                            title="启用"
                          >
                            <CheckCircle className="w-4 h-4 text-text-secondary hover:text-success" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!agents || agents.length === 0) && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-text-secondary">
                      暂无代理商数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 代理商详情弹窗 */}
      {showModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border-primary">
              <h3 className="text-white font-medium">代理商详情 - {selectedAgent.name || selectedAgent.email}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              {/* 代理商信息 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">累计返佣</p>
                  <p className="text-xl font-bold text-success">
                    ${Number(selectedAgent.totalCommission).toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">待结算</p>
                  <p className="text-xl font-bold text-warning">
                    ${Number(selectedAgent.pendingCommission).toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">推荐人数</p>
                  <p className="text-xl font-bold text-white">{selectedAgent.totalReferrals}</p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <p className="text-text-secondary text-sm mb-1">佣金比例</p>
                  <p className="text-xl font-bold text-brand-primary">
                    {(Number(selectedAgent.commissionRate) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* 下级用户列表 */}
              <h4 className="text-white font-medium mb-4">伞下用户（{selectedAgent.referrals?.length || 0} 人）</h4>
              <div className="bg-bg-tertiary rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-text-secondary text-sm border-b border-border-primary">
                      <th className="text-left p-3">用户</th>
                      <th className="text-left p-3">VIP 等级</th>
                      <th className="text-right p-3">累计消费</th>
                      <th className="text-right p-3">贡献返佣</th>
                      <th className="text-left p-3">注册时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAgent.referrals?.map((ref) => (
                      <tr key={ref.id} className="border-b border-border-primary">
                        <td className="p-3">
                          <p className="text-white text-sm">{ref.email}</p>
                          <p className="text-text-tertiary text-xs">{ref.id.slice(0, 8)}...</p>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs">
                            VIP {ref.vip_level}
                          </span>
                        </td>
                        <td className="p-3 text-right text-white">
                          ${Number(ref.totalSpent).toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-success">
                          ${Number(ref.commissionGenerated).toLocaleString()}
                        </td>
                        <td className="p-3 text-text-secondary text-sm">
                          {new Date(ref.created_at).toLocaleDateString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                    {(!selectedAgent.referrals || selectedAgent.referrals.length === 0) && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-text-secondary">
                          暂无下级用户
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
