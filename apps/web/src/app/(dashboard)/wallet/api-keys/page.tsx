'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, MobileHeader } from '@/components/ui';
import { apiKeysApi } from '@/lib/api';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
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

export default function ApiKeysPage() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 添加表单
  const [formData, setFormData] = useState({
    exchange: 'binance',
    label: '',
    apiKey: '',
    apiSecret: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchApiKeys = async () => {
    try {
      const res = await apiKeysApi.list();
      setApiKeys(res.data || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleAdd = async () => {
    if (!formData.label || !formData.apiKey || !formData.apiSecret) {
      alert('请填写完整信息');
      return;
    }

    setSubmitting(true);
    try {
      await apiKeysApi.create({
        exchange: formData.exchange,
        label: formData.label,
        apiKey: formData.apiKey,
        secretKey: formData.apiSecret,
      });
      setFormData({ exchange: 'binance', label: '', apiKey: '', apiSecret: '' });
      setShowAddForm(false);
      fetchApiKeys();
      alert('API Key 添加成功');
    } catch (error) {
      alert(error instanceof Error ? error.message : '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      await apiKeysApi.verify(id);
      fetchApiKeys();
      alert('验证成功');
    } catch (error) {
      alert(error instanceof Error ? error.message : '验证失败');
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个 API Key 吗？')) return;

    setDeleting(id);
    try {
      await apiKeysApi.delete(id);
      fetchApiKeys();
      alert('删除成功');
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleting(null);
    }
  };

  const getExchangeName = (exchange: string) => {
    const map: Record<string, string> = {
      binance: '币安 Binance',
      okx: 'OKX',
      bybit: 'Bybit',
      gate: 'Gate.io',
    };
    return map[exchange] || exchange;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <MobileHeader title="API Key 管理" />
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MobileHeader
        title="API Key 管理"
        rightAction={
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            添加
          </Button>
        }
      />

      {/* 安全提示 */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-warning mb-1">安全提示</p>
              <ul className="list-disc list-inside space-y-1 text-text-secondary">
                <li>请确保 API Key 只开启交易权限，禁止开启提现权限</li>
                <li>建议设置 IP 白名单限制</li>
                <li>您的 API Secret 将使用 AES-256 加密存储</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 添加表单 */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>添加新的 API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">交易所</label>
              <select
                value={formData.exchange}
                onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                className="w-full px-4 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-white"
              >
                <option value="binance">币安 Binance</option>
                <option value="okx">OKX</option>
                <option value="bybit">Bybit</option>
                <option value="gate">Gate.io</option>
              </select>
            </div>

            <Input
              label="标签名称"
              placeholder="例如: 主账户"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            />

            <Input
              label="API Key"
              placeholder="输入 API Key"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            />

            <div className="relative">
              <Input
                label="API Secret"
                type={showSecret ? 'text' : 'password'}
                placeholder="输入 API Secret"
                value={formData.apiSecret}
                onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-9 text-text-secondary hover:text-white"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAddForm(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleAdd}
                isLoading={submitting}
              >
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Key 列表 */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Key className="w-16 h-16 mx-auto mb-4 text-text-disabled" />
              <h3 className="text-lg font-medium text-white mb-2">暂无 API Key</h3>
              <p className="text-text-secondary mb-4">添加您的交易所 API Key 以开始交易</p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                添加 API Key
              </Button>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map((key) => (
            <Card key={key.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                      <Key className="w-6 h-6 text-brand-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{key.label}</h3>
                        <span className="px-2 py-0.5 bg-bg-tertiary text-text-secondary text-xs rounded">
                          {getExchangeName(key.exchange)}
                        </span>
                        {key.is_valid ? (
                          <span className="flex items-center gap-1 text-success text-xs">
                            <CheckCircle className="w-3 h-3" />
                            已验证
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-danger text-xs">
                            <XCircle className="w-3 h-3" />
                            未验证
                          </span>
                        )}
                      </div>
                      <p className="text-text-tertiary text-sm mt-1">
                        {key.api_key_masked}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVerify(key.id)}
                      disabled={verifying === key.id}
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${verifying === key.id ? 'animate-spin' : ''}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(key.id)}
                      disabled={deleting === key.id}
                    >
                      <Trash2 className="w-4 h-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
