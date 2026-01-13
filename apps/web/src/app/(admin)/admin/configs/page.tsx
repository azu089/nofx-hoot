'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  DollarSign,
  Crown,
  Zap,
  Users,
  Save,
  RefreshCw,
  Check,
  AlertCircle,
  Gift,
  ArrowRightLeft,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { toast } from 'sonner';

type ConfigValue = string | number | boolean;

interface ConfigItem {
  configKey: string;
  configValue: ConfigValue;
  configType: string;
  category: string;
  label: string;
  description?: string;
  isPublic: boolean;
  updatedAt: string;
}

type IconComponent = typeof DollarSign;

const categoryIcons: Record<string, IconComponent> = {
  billing: DollarSign,
  vip: Crown,
  feature: Zap,
  agent: Users,
  referral: Gift,
  exchange: ArrowRightLeft,
};

const categoryLabels: Record<string, string> = {
  billing: '计费配置',
  vip: 'VIP 配置',
  feature: '功能开关',
  agent: '代理商配置',
  referral: '邀请返佣',
  exchange: '积分兑换',
};

export default function ConfigsPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<ConfigValue | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('billing');

  // 获取配置列表
  const { data: configsRes, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'configs', activeCategory],
    queryFn: () => adminApi.getConfigs(activeCategory),
  });
  const configs = configsRes?.data || [];

  // 更新配置
  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: ConfigValue }) =>
      adminApi.updateConfig(key, { value }),
    onSuccess: () => {
      toast.success('配置已更新');
      queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
      setEditingKey(null);
      setEditValue(null);
    },
    onError: () => {
      toast.error('更新失败');
    },
  });

  // 初始化默认配置
  const initMutation = useMutation({
    mutationFn: adminApi.initConfigs,
    onSuccess: (res) => {
      toast.success(`初始化完成: 创建 ${res.data.created} 条, 跳过 ${res.data.skipped} 条`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
    },
    onError: () => {
      toast.error('初始化失败');
    },
  });

  const handleEdit = (config: ConfigItem) => {
    setEditingKey(config.configKey);
    setEditValue(config.configValue);
  };

  const handleSave = (key: string) => {
    if (editValue !== null) {
      updateMutation.mutate({ key, value: editValue });
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue(null);
  };

  const renderValue = (config: ConfigItem) => {
    if (editingKey === config.configKey) {
      if (config.configType === 'boolean') {
        return (
          <select
            value={editValue ? 'true' : 'false'}
            onChange={(e) => setEditValue(e.target.value === 'true')}
            className="bg-bg-tertiary border border-border-primary rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-primary"
          >
            <option value="true">启用</option>
            <option value="false">禁用</option>
          </select>
        );
      }
      if (config.configType === 'number') {
        return (
          <input
            type="number"
            value={typeof editValue === 'number' ? editValue : ''}
            onChange={(e) => setEditValue(parseFloat(e.target.value))}
            className="bg-bg-tertiary border border-border-primary rounded px-3 py-1.5 text-white text-sm w-32 focus:outline-none focus:border-brand-primary"
          />
        );
      }
      return (
        <input
          type="text"
          value={typeof editValue === 'string' ? editValue : ''}
          onChange={(e) => setEditValue(e.target.value)}
          className="bg-bg-tertiary border border-border-primary rounded px-3 py-1.5 text-white text-sm w-48 focus:outline-none focus:border-brand-primary"
        />
      );
    }

    // 显示模式
    if (config.configType === 'boolean') {
      return (
        <span className={`px-2 py-1 rounded text-xs ${
          config.configValue
            ? 'bg-success/10 text-success'
            : 'bg-danger/10 text-danger'
        }`}>
          {config.configValue ? '启用' : '禁用'}
        </span>
      );
    }
    if (config.configType === 'number') {
      return <span className="text-white font-mono">{config.configValue}</span>;
    }
    return <span className="text-white">{String(config.configValue)}</span>;
  };

  // 按分类分组
  const categories = ['billing', 'vip', 'feature', 'agent', 'referral', 'exchange'];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6" />
            配置中心
          </h1>
          <p className="text-text-secondary mt-1">管理系统配置参数</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={() => initMutation.mutate()}
            disabled={initMutation.isPending}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {initMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            初始化默认配置
          </button>
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex gap-2 border-b border-border-primary pb-4">
        {categories.map((cat) => {
          const Icon = categoryIcons[cat] || Settings;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                activeCategory === cat
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:text-white hover:bg-bg-tertiary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {categoryLabels[cat]}
            </button>
          );
        })}
      </div>

      {/* 配置列表 */}
      <div className="glass-card">
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-brand-primary animate-spin mx-auto" />
            <p className="text-text-secondary mt-2">加载中...</p>
          </div>
        ) : configs.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-text-secondary mx-auto" />
            <p className="text-text-secondary mt-2">暂无配置项</p>
            <p className="text-text-tertiary text-sm mt-1">
              点击上方"初始化默认配置"按钮创建
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="text-left py-4 px-6 text-text-secondary font-medium">配置项</th>
                <th className="text-left py-4 px-6 text-text-secondary font-medium">当前值</th>
                <th className="text-left py-4 px-6 text-text-secondary font-medium">公开</th>
                <th className="text-right py-4 px-6 text-text-secondary font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config: ConfigItem) => (
                <tr
                  key={config.configKey}
                  className="border-b border-border-primary last:border-0 hover:bg-bg-tertiary/50"
                >
                  <td className="py-4 px-6">
                    <div>
                      <p className="text-white font-medium">{config.label}</p>
                      <p className="text-text-tertiary text-xs font-mono mt-0.5">
                        {config.configKey}
                      </p>
                      {config.description && (
                        <p className="text-text-secondary text-sm mt-1">
                          {config.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {renderValue(config)}
                  </td>
                  <td className="py-4 px-6">
                    {config.isPublic ? (
                      <span className="px-2 py-1 bg-success/10 text-success text-xs rounded">
                        公开
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-text-secondary/10 text-text-secondary text-xs rounded">
                        私有
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {editingKey === config.configKey ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSave(config.configKey)}
                          disabled={updateMutation.isPending}
                          className="p-2 bg-success text-white rounded-lg hover:bg-success/80 transition-colors disabled:opacity-50"
                        >
                          {updateMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="p-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(config)}
                        className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-lg hover:bg-brand-primary/20 transition-colors text-sm"
                      >
                        编辑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
