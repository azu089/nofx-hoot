'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palette,
  Save,
  RefreshCw,
  Image,
  Type,
  Loader2,
  Check,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type BrandConfig = {
  key: string;
  value: string;
  category: string;
  description: string;
};

const configCategories = {
  branding: '品牌标识',
  colors: '主题颜色',
  texts: '文案内容',
  social: '社交链接',
};

export default function BrandPage() {
  const queryClient = useQueryClient();
  const [editedConfigs, setEditedConfigs] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: configsRes, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'brand-configs'],
    queryFn: () => adminApi.getBrandConfigs(),
  });
  const configsData = configsRes?.data;

  const saveMutation = useMutation({
    mutationFn: (configs: { key: string; value: string }[]) =>
      adminApi.updateBrandConfigs(configs),
    onSuccess: () => {
      toast.success('配置已保存');
      queryClient.invalidateQueries({ queryKey: ['admin', 'brand-configs'] });
      setEditedConfigs({});
      setHasChanges(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || '保存失败');
    },
  });

  const handleChange = (key: string, value: string) => {
    setEditedConfigs((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const configs = Object.entries(editedConfigs).map(([key, value]) => ({
      key,
      value,
    }));
    saveMutation.mutate(configs);
  };

  const handleReset = () => {
    setEditedConfigs({});
    setHasChanges(false);
  };

  const getValue = (key: string, original: string) => {
    return editedConfigs[key] !== undefined ? editedConfigs[key] : original;
  };

  const groupedConfigs = configsData?.data?.reduce((acc: Record<string, BrandConfig[]>, config: BrandConfig) => {
    const category = config.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(config);
    return acc;
  }, {} as Record<string, BrandConfig[]>) || {};

  const renderInput = (config: BrandConfig) => {
    const value = getValue(config.key, config.value);

    // 颜色输入
    if (config.key.includes('color') || config.key.includes('Color')) {
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value || '#000000'}
            onChange={(e) => handleChange(config.key, e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-border-primary"
          />
          <Input
            value={value}
            onChange={(e) => handleChange(config.key, e.target.value)}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
      );
    }

    // URL 输入
    if (config.key.includes('url') || config.key.includes('Url') || config.key.includes('link')) {
      return (
        <Input
          value={value}
          onChange={(e) => handleChange(config.key, e.target.value)}
          placeholder="https://..."
          type="url"
        />
      );
    }

    // 图片 URL
    if (config.key.includes('logo') || config.key.includes('image') || config.key.includes('Icon')) {
      return (
        <div className="space-y-2">
          <Input
            value={value}
            onChange={(e) => handleChange(config.key, e.target.value)}
            placeholder="https://example.com/image.png"
          />
          {value && (
            <div className="w-20 h-20 bg-bg-tertiary rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src={value}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      );
    }

    // 多行文本
    if (config.key.includes('description') || config.key.includes('text') || config.key.includes('slogan')) {
      return (
        <textarea
          value={value}
          onChange={(e) => handleChange(config.key, e.target.value)}
          placeholder={config.description}
          rows={3}
          className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-text-secondary focus:outline-none focus:border-brand-primary resize-none"
        />
      );
    }

    // 默认文本输入
    return (
      <Input
        value={value}
        onChange={(e) => handleChange(config.key, e.target.value)}
        placeholder={config.description}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Palette className="w-7 h-7 text-purple-500" />
            品牌配置
          </h1>
          <p className="text-text-secondary mt-1">自定义平台品牌标识、主题颜色和文案</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重置
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            isLoading={saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            保存更改
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedConfigs).map(([category, configs]) => (
            <Card key={category} className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                {category === 'branding' && <Image className="w-5 h-5" />}
                {category === 'colors' && <Palette className="w-5 h-5" />}
                {category === 'texts' && <Type className="w-5 h-5" />}
                {configCategories[category as keyof typeof configCategories] || category}
              </h2>

              <div className="grid gap-6">
                {configs.map((config: BrandConfig) => (
                  <div key={config.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-text-secondary">
                        {config.description}
                      </label>
                      <span className="text-xs text-text-tertiary font-mono">
                        {config.key}
                      </span>
                    </div>
                    {renderInput(config)}
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {/* 预设模板 */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">预设模板</h2>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => {
                  setEditedConfigs({
                    primaryColor: '#3772FF',
                    secondaryColor: '#2962FF',
                    successColor: '#00C087',
                    dangerColor: '#F23645',
                  });
                  setHasChanges(true);
                }}
                className="p-4 bg-bg-tertiary border border-border-primary rounded-lg hover:border-brand-primary transition-colors"
              >
                <div className="flex gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-brand-primary" />
                  <div className="w-6 h-6 rounded bg-brand-secondary" />
                  <div className="w-6 h-6 rounded bg-success" />
                  <div className="w-6 h-6 rounded bg-danger" />
                </div>
                <p className="text-white text-sm">默认主题</p>
                <p className="text-text-secondary text-xs">科技蓝风格</p>
              </button>

              <button
                onClick={() => {
                  setEditedConfigs({
                    primaryColor: '#F7931A',
                    secondaryColor: '#E67E00',
                    successColor: '#00C087',
                    dangerColor: '#F23645',
                  });
                  setHasChanges(true);
                }}
                className="p-4 bg-bg-tertiary border border-border-primary rounded-lg hover:border-warning transition-colors"
              >
                <div className="flex gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-warning" />
                  <div className="w-6 h-6 rounded bg-orange-600" />
                  <div className="w-6 h-6 rounded bg-success" />
                  <div className="w-6 h-6 rounded bg-danger" />
                </div>
                <p className="text-white text-sm">加密主题</p>
                <p className="text-text-secondary text-xs">比特币橙风格</p>
              </button>

              <button
                onClick={() => {
                  setEditedConfigs({
                    primaryColor: '#9B59B6',
                    secondaryColor: '#8E44AD',
                    successColor: '#00C087',
                    dangerColor: '#F23645',
                  });
                  setHasChanges(true);
                }}
                className="p-4 bg-bg-tertiary border border-border-primary rounded-lg hover:border-purple-500 transition-colors"
              >
                <div className="flex gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-purple-500" />
                  <div className="w-6 h-6 rounded bg-purple-600" />
                  <div className="w-6 h-6 rounded bg-success" />
                  <div className="w-6 h-6 rounded bg-danger" />
                </div>
                <p className="text-white text-sm">紫色主题</p>
                <p className="text-text-secondary text-xs">优雅紫风格</p>
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
