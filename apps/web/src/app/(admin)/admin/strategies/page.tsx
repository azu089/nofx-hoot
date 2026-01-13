'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  MoreVertical,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  TrendingUp,
  Users,
  BarChart3,
  Shield,
  Zap,
  Code,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminStrategiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'grid',
    code: '',
    riskLevel: 'medium',
  });

  const { data: strategiesRes, isLoading } = useQuery({
    queryKey: ['admin', 'strategies'],
    queryFn: () => adminApi.getAdminStrategies(),
  });
  const strategies = strategiesRes?.data;

  const createMutation = useMutation({
    mutationFn: adminApi.createStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
      setShowEditor(false);
      setFormData({ name: '', description: '', type: 'grid', code: '', riskLevel: 'medium' });
      toast.success('策略创建成功');
    },
    onError: () => {
      toast.error('策略创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; type?: string; code?: string; status?: string; riskLevel?: string } }) =>
      adminApi.updateStrategy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
      setShowEditor(false);
      setEditingStrategy(null);
      toast.success('策略更新成功');
    },
    onError: () => {
      toast.error('策略更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
      toast.success('策略删除成功');
    },
    onError: () => {
      toast.error('策略删除失败');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: adminApi.toggleStrategyStatus,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
      toast.success('策略状态已更新');
    },
    onError: () => {
      toast.error('操作失败');
    },
  });

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <span className="px-2 py-1 bg-success/10 text-success rounded text-xs">低风险</span>;
      case 'medium':
        return <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs">中风险</span>;
      case 'high':
        return <span className="px-2 py-1 bg-danger/10 text-danger rounded text-xs">高风险</span>;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'grid':
        return <BarChart3 className="w-5 h-5 text-brand-primary" />;
      case 'dca':
        return <TrendingUp className="w-5 h-5 text-success" />;
      case 'arbitrage':
        return <Zap className="w-5 h-5 text-warning" />;
      default:
        return <Shield className="w-5 h-5 text-text-secondary" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">策略管理</h1>
          <p className="text-text-secondary mt-1">管理平台交易策略</p>
        </div>
        <button
          onClick={() => {
            setEditingStrategy(null);
            setFormData({ name: '', description: '', type: 'grid', code: '', riskLevel: 'medium' });
            setShowEditor(true);
          }}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg flex items-center gap-2 hover:bg-brand-secondary"
        >
          <Plus className="w-5 h-5" />
          添加策略
        </button>
      </div>

      {/* 搜索 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="text"
          placeholder="搜索策略名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
        />
      </div>

      {/* 策略列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-text-secondary">加载中...</div>
        ) : !strategies?.data || strategies.data.length === 0 ? (
          <div className="col-span-full text-center py-12 text-text-secondary">暂无策略</div>
        ) : (
          strategies.data.map((strategy) => (
            <div
              key={strategy.id}
              className="glass-card overflow-hidden"
            >
              {/* 头部 */}
              <div className="p-4 border-b border-border-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-bg-tertiary rounded-lg flex items-center justify-center">
                      {getTypeIcon(strategy.type)}
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{strategy.name}</h3>
                      <span className={`text-xs ${
                        strategy.status === 'active' ? 'text-success' : 'text-warning'
                      }`}>
                        {strategy.status === 'active' ? '已上线' : '待审核'}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setSelectedStrategy(
                        selectedStrategy === strategy.id ? null : strategy.id
                      )}
                      className="p-2 hover:bg-bg-tertiary rounded-lg"
                    >
                      <MoreVertical className="w-5 h-5 text-text-secondary" />
                    </button>
                    {selectedStrategy === strategy.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-bg-tertiary border border-border-primary rounded-lg shadow-xl z-10">
                        <button
                          onClick={() => toggleMutation.mutate(strategy.id)}
                          className="w-full px-4 py-2 text-left text-white hover:bg-bg-tertiary flex items-center gap-2"
                        >
                          {strategy.status === 'active' ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              下架
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              上架
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingStrategy(strategy);
                            setFormData({
                              name: strategy.name,
                              description: strategy.description,
                              type: strategy.type,
                              code: '',
                              riskLevel: strategy.riskLevel,
                            });
                            setShowEditor(true);
                            setSelectedStrategy(null);
                          }}
                          className="w-full px-4 py-2 text-left text-white hover:bg-bg-tertiary flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('确定删除此策略吗？此操作不可恢复！')) {
                              deleteMutation.mutate(strategy.id);
                              setSelectedStrategy(null);
                            }
                          }}
                          className="w-full px-4 py-2 text-left text-danger hover:bg-bg-tertiary flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 内容 */}
              <div className="p-4 space-y-4">
                <p className="text-text-secondary text-sm">{strategy.description}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-text-secondary text-xs">月收益</p>
                    <p className={`font-medium ${
                      strategy.monthlyReturn?.startsWith?.('+') ? 'text-success' : 'text-white'
                    }`}>
                      {strategy.monthlyReturn || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs">订阅者</p>
                    <p className="text-white font-medium flex items-center gap-1">
                      <Users className="w-4 h-4 text-text-secondary" />
                      {strategy.subscribers ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-primary">
                  {getRiskBadge(strategy.riskLevel || 'medium')}
                  <span className="text-text-secondary text-xs">
                    创建于 {strategy.createdAt || '-'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 策略编辑弹窗 */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-4xl border border-border-primary my-8">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingStrategy ? '编辑策略' : '添加策略'}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary text-sm mb-2">策略名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary"
                    placeholder="输入策略名称"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-sm mb-2">策略类型</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                  >
                    <option value="grid">网格交易</option>
                    <option value="dca">定投策略</option>
                    <option value="arbitrage">套利策略</option>
                    <option value="trend">趋势跟踪</option>
                    <option value="ai">AI 策略</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-2">风险等级</label>
                <select
                  value={formData.riskLevel}
                  onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                >
                  <option value="low">低风险</option>
                  <option value="medium">中风险</option>
                  <option value="high">高风险</option>
                </select>
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-2">策略描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary min-h-[100px]"
                  placeholder="输入策略描述"
                />
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-2 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  策略代码 (Python)
                </label>
                <textarea
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary min-h-[300px] font-mono text-sm"
                  placeholder="# 输入 Python 策略代码&#10;def strategy():&#10;    pass"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowEditor(false);
                  setFormData({ name: '', description: '', type: 'grid', code: '', riskLevel: 'medium' });
                  setEditingStrategy(null);
                }}
                className="flex-1 px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!formData.name || !formData.description) {
                    toast.error('请填写完整信息');
                    return;
                  }
                  if (editingStrategy) {
                    updateMutation.mutate({ id: editingStrategy.id, data: formData });
                  } else {
                    createMutation.mutate(formData);
                  }
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? '处理中...'
                  : editingStrategy
                  ? '保存'
                  : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
