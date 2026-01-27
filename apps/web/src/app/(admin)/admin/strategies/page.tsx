'use client';

import { useState, useRef } from 'react';
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
  Upload,
  FileText,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminStrategiesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<any>(null);
  const [uploadMode, setUploadMode] = useState<'text' | 'file'>('file'); // 默认文件上传
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'grid',
    code: '',
    riskLevel: 'medium',
    // 性能指标字段
    monthlyReturn: '',
    winRate: '',
    maxDrawdown: '',
    sharpeRatio: '',
  });

  const { data: strategiesRes, isLoading } = useQuery({
    queryKey: ['admin', 'strategies'],
    queryFn: () => adminApi.getAdminStrategies(),
  });
  const strategies = strategiesRes?.data;

  // 文本方式创建
  const createMutation = useMutation({
    mutationFn: adminApi.createStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
      resetForm();
      toast.success('策略创建成功');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '策略创建失败');
    },
  });

  // 文件上传方式创建
  const uploadMutation = useMutation({
    mutationFn: async (data: {
      file: File;
      name: string;
      description?: string;
      config?: string;
      type?: string;
      riskLevel?: string;
      monthlyReturn?: string;
      winRate?: string;
      maxDrawdown?: string;
      sharpeRatio?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('name', data.name);
      if (data.description) formData.append('description', data.description);
      if (data.config) formData.append('config', data.config);
      if (data.type) formData.append('type', data.type);
      if (data.riskLevel) formData.append('riskLevel', data.riskLevel);
      if (data.monthlyReturn) formData.append('monthlyReturn', data.monthlyReturn);
      if (data.winRate) formData.append('winRate', data.winRate);
      if (data.maxDrawdown) formData.append('maxDrawdown', data.maxDrawdown);
      if (data.sharpeRatio) formData.append('sharpeRatio', data.sharpeRatio);
      return adminApi.uploadStrategy(formData);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
      resetForm();
      toast.success(`策略上传成功 (${(response.data?.fileSize / 1024).toFixed(1)} KB)`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || '策略上传失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        type?: string;
        code?: string;
        status?: string;
        riskLevel?: string;
        monthlyReturn?: number;
        winRate?: number;
        maxDrawdown?: number;
        sharpeRatio?: number;
      }
    }) => adminApi.updateStrategy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] });
      resetForm();
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

  const resetForm = () => {
    setShowEditor(false);
    setFormData({
      name: '',
      description: '',
      type: 'grid',
      code: '',
      riskLevel: 'medium',
      monthlyReturn: '',
      winRate: '',
      maxDrawdown: '',
      sharpeRatio: '',
    });
    setEditingStrategy(null);
    setSelectedFile(null);
    setUploadMode('file');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.py')) {
        toast.error('只支持上传 .py 文件');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('文件大小不能超过 5MB');
        return;
      }
      setSelectedFile(file);
      // 自动填充策略名称（去掉 .py 后缀）
      if (!formData.name) {
        setFormData({ ...formData, name: file.name.replace('.py', '') });
      }
    }
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('请填写策略名称');
      return;
    }

    if (editingStrategy) {
      updateMutation.mutate({
        id: editingStrategy.id,
        data: {
          name: formData.name,
          description: formData.description,
          type: formData.type,
          code: formData.code,
          riskLevel: formData.riskLevel,
          monthlyReturn: formData.monthlyReturn ? parseFloat(formData.monthlyReturn) : undefined,
          winRate: formData.winRate ? parseFloat(formData.winRate) : undefined,
          maxDrawdown: formData.maxDrawdown ? parseFloat(formData.maxDrawdown) : undefined,
          sharpeRatio: formData.sharpeRatio ? parseFloat(formData.sharpeRatio) : undefined,
        },
      });
    } else if (uploadMode === 'file') {
      if (!selectedFile) {
        toast.error('请选择策略文件');
        return;
      }
      uploadMutation.mutate({
        file: selectedFile,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        riskLevel: formData.riskLevel,
        monthlyReturn: formData.monthlyReturn,
        winRate: formData.winRate,
        maxDrawdown: formData.maxDrawdown,
        sharpeRatio: formData.sharpeRatio,
      });
    } else {
      if (!formData.code) {
        toast.error('请输入策略代码');
        return;
      }
      createMutation.mutate({
        name: formData.name,
        description: formData.description,
        type: formData.type,
        code: formData.code,
        riskLevel: formData.riskLevel,
        monthlyReturn: formData.monthlyReturn ? parseFloat(formData.monthlyReturn) : undefined,
        winRate: formData.winRate ? parseFloat(formData.winRate) : undefined,
        maxDrawdown: formData.maxDrawdown ? parseFloat(formData.maxDrawdown) : undefined,
        sharpeRatio: formData.sharpeRatio ? parseFloat(formData.sharpeRatio) : undefined,
      });
    }
  };

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

  const isPending = createMutation.isPending || uploadMutation.isPending || updateMutation.isPending;

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
            setFormData({
              name: '',
              description: '',
              type: 'grid',
              code: '',
              riskLevel: 'medium',
              monthlyReturn: '',
              winRate: '',
              maxDrawdown: '',
              sharpeRatio: '',
            });
            setSelectedFile(null);
            setUploadMode('file');
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
          strategies.data
            .filter((s: any) => !search || s.name?.toLowerCase().includes(search.toLowerCase()))
            .map((strategy: any) => (
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
                          className="w-full px-4 py-2 text-left text-white hover:bg-bg-secondary flex items-center gap-2"
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
                              description: strategy.description || '',
                              type: strategy.type || 'grid',
                              code: strategy.content || '',
                              riskLevel: strategy.riskLevel || 'medium',
                              monthlyReturn: strategy.monthlyReturn?.toString() || '',
                              winRate: strategy.winRate?.toString() || '',
                              maxDrawdown: strategy.maxDrawdown?.toString() || '',
                              sharpeRatio: strategy.sharpeRatio?.toString() || '',
                            });
                            setUploadMode('text');
                            setShowEditor(true);
                            setSelectedStrategy(null);
                          }}
                          className="w-full px-4 py-2 text-left text-white hover:bg-bg-secondary flex items-center gap-2"
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
                          className="w-full px-4 py-2 text-left text-danger hover:bg-bg-secondary flex items-center gap-2"
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
                <p className="text-text-secondary text-sm line-clamp-2">{strategy.description || '暂无描述'}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-text-secondary text-xs">月收益</p>
                    <p className={`font-medium ${
                      strategy.monthlyReturn && strategy.monthlyReturn > 0 ? 'text-success' : 'text-white'
                    }`}>
                      {strategy.monthlyReturn != null ? `${strategy.monthlyReturn > 0 ? '+' : ''}${strategy.monthlyReturn}%` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs">订阅者</p>
                    <p className="text-white font-medium flex items-center gap-1">
                      <Users className="w-4 h-4 text-text-secondary" />
                      {strategy.subscriberCount ?? strategy.subscribers ?? 0}
                    </p>
                  </div>
                </div>

                {/* 额外性能指标 */}
                {(strategy.winRate || strategy.maxDrawdown || strategy.sharpeRatio) && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-primary/50">
                    {strategy.winRate != null && (
                      <div className="text-center">
                        <p className="text-text-tertiary text-xs">胜率</p>
                        <p className="text-white text-sm font-medium">{strategy.winRate}%</p>
                      </div>
                    )}
                    {strategy.maxDrawdown != null && (
                      <div className="text-center">
                        <p className="text-text-tertiary text-xs">回撤</p>
                        <p className="text-danger text-sm font-medium">{strategy.maxDrawdown}%</p>
                      </div>
                    )}
                    {strategy.sharpeRatio != null && (
                      <div className="text-center">
                        <p className="text-text-tertiary text-xs">夏普</p>
                        <p className="text-white text-sm font-medium">{strategy.sharpeRatio}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border-primary">
                  {getRiskBadge(strategy.riskLevel || 'medium')}
                  <span className="text-text-secondary text-xs">
                    创建于 {strategy.createdAt ? new Date(strategy.createdAt).toLocaleDateString('zh-CN') : '-'}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingStrategy ? '编辑策略' : '添加策略'}
              </h3>
              <button onClick={resetForm} className="text-text-secondary hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 上传模式切换（仅新建时显示） */}
              {!editingStrategy && (
                <div className="flex gap-2 p-1 bg-bg-tertiary rounded-lg w-fit">
                  <button
                    onClick={() => setUploadMode('file')}
                    className={`px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                      uploadMode === 'file'
                        ? 'bg-brand-primary text-white'
                        : 'text-text-secondary hover:text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    文件上传
                  </button>
                  <button
                    onClick={() => setUploadMode('text')}
                    className={`px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                      uploadMode === 'text'
                        ? 'bg-brand-primary text-white'
                        : 'text-text-secondary hover:text-white'
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    代码粘贴
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary text-sm mb-2">策略名称 *</label>
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

              {/* 性能指标 - 用于策略市场卡片展示 */}
              <div className="border border-border-primary rounded-lg p-4 bg-bg-tertiary/50">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-primary" />
                  性能指标（用于策略市场展示）
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-text-secondary text-xs mb-1.5">月收益率 (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monthlyReturn}
                      onChange={(e) => setFormData({ ...formData, monthlyReturn: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-tertiary text-sm focus:outline-none focus:border-brand-primary"
                      placeholder="如: 15.5"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs mb-1.5">胜率 (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.winRate}
                      onChange={(e) => setFormData({ ...formData, winRate: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-tertiary text-sm focus:outline-none focus:border-brand-primary"
                      placeholder="如: 68.5"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs mb-1.5">最大回撤 (%)</label>
                    <input
                      type="number"
                      min="-100"
                      max="0"
                      step="0.1"
                      value={formData.maxDrawdown}
                      onChange={(e) => setFormData({ ...formData, maxDrawdown: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-tertiary text-sm focus:outline-none focus:border-brand-primary"
                      placeholder="如: -12.3"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs mb-1.5">夏普比率</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sharpeRatio}
                      onChange={(e) => setFormData({ ...formData, sharpeRatio: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-tertiary text-sm focus:outline-none focus:border-brand-primary"
                      placeholder="如: 1.85"
                    />
                  </div>
                </div>
                <p className="text-text-tertiary text-xs mt-2">
                  这些数据将显示在策略市场卡片上，帮助用户了解策略表现
                </p>
              </div>

              {/* 文件上传区域 */}
              {uploadMode === 'file' && !editingStrategy && (
                <div>
                  <label className="block text-text-secondary text-sm mb-2 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    策略文件 (.py) *
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".py"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-3 p-4 bg-bg-tertiary border border-brand-primary/50 rounded-lg">
                      <FileText className="w-8 h-8 text-brand-primary" />
                      <div className="flex-1">
                        <p className="text-white font-medium">{selectedFile.name}</p>
                        <p className="text-text-secondary text-sm">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="p-2 hover:bg-bg-secondary rounded-lg text-text-secondary hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-8 border-2 border-dashed border-border-primary hover:border-brand-primary rounded-lg text-center transition-colors"
                    >
                      <Upload className="w-10 h-10 mx-auto mb-3 text-text-tertiary" />
                      <p className="text-text-secondary">点击或拖拽上传 Python 策略文件</p>
                      <p className="text-text-tertiary text-sm mt-1">支持 .py 文件，最大 5MB</p>
                    </button>
                  )}
                </div>
              )}

              {/* 代码输入区域 */}
              {(uploadMode === 'text' || editingStrategy) && (
                <div>
                  <label className="block text-text-secondary text-sm mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    策略代码 (Python) {!editingStrategy && '*'}
                  </label>
                  <textarea
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary min-h-[300px] font-mono text-sm"
                    placeholder="# 输入 Python 策略代码&#10;from freqtrade.strategy import IStrategy&#10;&#10;class MyStrategy(IStrategy):&#10;    pass"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary/80"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    处理中...
                  </>
                ) : editingStrategy ? (
                  '保存'
                ) : uploadMode === 'file' ? (
                  <>
                    <Upload className="w-4 h-4" />
                    上传策略
                  </>
                ) : (
                  '创建策略'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
