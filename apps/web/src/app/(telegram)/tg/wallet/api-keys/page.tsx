'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { apiKeysApi } from '@/lib/api';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Shield,
} from 'lucide-react';

interface ApiKey {
  id: string;
  exchange: string;
  label: string;
  api_key_masked: string;
  is_valid: boolean;
  created_at: string;
  last_verified_at: string | null;
}

export default function TgApiKeysPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    exchange: 'binance',
    label: '',
    apiKey: '',
    apiSecret: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await apiKeysApi.list();
      setApiKeys(response.data || []);
    } catch (error) {
      console.error('获取 API Key 列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.apiKey || !formData.apiSecret) {
      haptic('notification_error');
      return;
    }

    setSubmitting(true);
    haptic('impact_medium');

    try {
      await apiKeysApi.create({
        exchange: formData.exchange,
        label: formData.label || `${formData.exchange} API Key`,
        apiKey: formData.apiKey,
        secretKey: formData.apiSecret,
      });
      haptic('notification_success');
      setShowAddForm(false);
      setFormData({ exchange: 'binance', label: '', apiKey: '', apiSecret: '' });
      fetchApiKeys();
    } catch (error) {
      console.error('添加 API Key 失败:', error);
      haptic('notification_error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    haptic('impact_heavy');
    try {
      await apiKeysApi.delete(id);
      haptic('notification_success');
      fetchApiKeys();
    } catch (error) {
      console.error('删除 API Key 失败:', error);
      haptic('notification_error');
    }
  };

  const getStatusStyle = (isValid: boolean) => {
    if (isValid) {
      return { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: '正常' };
    } else {
      return { icon: XCircle, color: 'text-danger', bg: 'bg-danger/10', label: '失效' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">API Key 管理</span>
        </button>
        <button
          onClick={() => { setShowAddForm(true); haptic('selection'); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-white text-sm rounded-lg"
        >
          <Plus size={16} />
          添加
        </button>
      </div>

      {/* 安全提示 */}
      <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-xl">
        <Shield className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-warning font-medium">安全提示</p>
          <p className="text-xs text-text-secondary mt-1">
            请确保 API Key 只开启交易权限，禁止开启提现权限。所有密钥均加密存储。
          </p>
        </div>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 space-y-4">
          <h3 className="font-medium text-white">添加 API Key</h3>

          <div>
            <label className="block text-xs text-text-tertiary mb-2">交易所</label>
            <select
              value={formData.exchange}
              onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
              className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-white"
            >
              <option value="binance">Binance</option>
              <option value="okx">OKX</option>
              <option value="bybit">Bybit</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-tertiary mb-2">备注名称</label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="如：主账户"
              className="text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-text-tertiary mb-2">API Key</label>
            <Input
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="输入 API Key"
              className="text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-text-tertiary mb-2">API Secret</label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={formData.apiSecret}
                onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                placeholder="输入 API Secret"
                className="text-sm font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => { setShowAddForm(false); haptic('selection'); }}
            >
              取消
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || !formData.apiKey || !formData.apiSecret}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              确认添加
            </Button>
          </div>
        </div>
      )}

      {/* API Key 列表 */}
      {apiKeys.length === 0 && !showAddForm ? (
        <div className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-base font-medium text-white mb-2">暂无 API Key</h3>
          <p className="text-text-secondary text-sm mb-4">添加交易所 API Key 开始自动交易</p>
          <button
            onClick={() => { setShowAddForm(true); haptic('selection'); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white text-sm rounded-lg"
          >
            <Plus size={16} />
            添加 API Key
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((apiKey) => {
            const statusStyle = getStatusStyle(apiKey.is_valid);
            const StatusIcon = statusStyle.icon;

            return (
              <div
                key={apiKey.id}
                className="bg-bg-secondary border border-border-primary rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center">
                      <Key className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{apiKey.label}</p>
                      <p className="text-xs text-text-tertiary capitalize">{apiKey.exchange}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusStyle.bg} ${statusStyle.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusStyle.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>添加于 {new Date(apiKey.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleDelete(apiKey.id)}
                    className="flex items-center gap-1 text-danger"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
