'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { walletApi, ApiKey } from '@/lib/api';

// 交易所配置
const exchanges = [
  { id: 'binance', name: 'Binance', logo: '🟡' },
  { id: 'okx', name: 'OKX', logo: '⚫' },
  { id: 'bybit', name: 'Bybit', logo: '🟠' },
  { id: 'huobi', name: 'HTX', logo: '🔵' },
  { id: 'gate', name: 'Gate.io', logo: '🟢' },
  { id: 'kucoin', name: 'KuCoin', logo: '🟣' },
];

export default function ApiKeysPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState('');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const res = await walletApi.getApiKeys();
      setApiKeys(res.data);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedExchange || !apiKey || !apiSecret) {
      alert('请填写完整信息');
      return;
    }

    setSaving(true);
    try {
      await walletApi.addApiKey({
        exchange: selectedExchange,
        label: label || selectedExchange,
        apiKey: apiKey,
        secretKey: apiSecret,
        passphrase: passphrase || undefined,
      });
      alert('API Key 添加成功');
      setShowAddForm(false);
      setSelectedExchange('');
      setLabel('');
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      // 刷新列表
      await fetchApiKeys();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'API Key 添加失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此 API Key 吗？删除后需要重新绑定。')) {
      return;
    }

    try {
      await walletApi.deleteApiKey(id);
      alert('API Key 已删除');
      // 刷新列表
      await fetchApiKeys();
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await walletApi.verifyApiKey(id);
      if (res.data.valid) {
        alert('API Key 连接测试成功');
      } else {
        alert('API Key 验证失败，请检查配置');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '测试失败');
    }
  };

  const getExchangeInfo = (exchangeId: string) => {
    return exchanges.find((e) => e.id === exchangeId);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="w-7 h-7 text-primary" />
            API Key 管理
          </h1>
          <p className="text-muted-foreground">绑定交易所 API Key 以启用自动交易</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          添加 API Key
        </Button>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>添加新的 API Key</CardTitle>
            <CardDescription>请确保 API Key 仅开启"读取"和"交易"权限，禁止开启"提现"权限</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 交易所选择 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                选择交易所
              </label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {exchanges.map((exchange) => (
                  <button
                    key={exchange.id}
                    onClick={() => setSelectedExchange(exchange.id)}
                    className={`p-3 rounded-lg border text-center transition ${
                      selectedExchange === exchange.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="text-2xl">{exchange.logo}</span>
                    <p className="text-xs mt-1">{exchange.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 表单字段 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  备注名称
                </label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="例如：主账户"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  API Key
                </label>
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="输入 API Key"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  API Secret
                </label>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="输入 API Secret"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {(selectedExchange === 'okx' || selectedExchange === 'kucoin') && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Passphrase
                  </label>
                  <Input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="输入 Passphrase"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 已绑定的 API Key 列表 */}
      <Card>
        <CardHeader>
          <CardTitle>已绑定的 API Key</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>加载中...</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂未绑定 API Key</p>
              <p className="text-sm mt-1">绑定 API Key 后即可使用自动交易功能</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => {
                const exchange = getExchangeInfo(key.exchange);
                return (
                  <div
                    key={key.id}
                    className="p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-2xl">
                          {exchange?.logo}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{exchange?.name}</p>
                            <span className="text-xs text-muted-foreground">
                              {key.label}
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-500">
                              <CheckCircle className="w-3 h-3 inline mr-1" />
                              正常
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground font-mono">
                            {key.id.slice(0, 8)}...
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>创建: {new Date(key.created_at).toLocaleDateString('zh-CN')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(key.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          测试
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(key.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 安全提示 */}
      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-500">
            <Shield className="w-5 h-5" />
            安全提示
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• API Key 仅需开启"读取"和"交易"权限，请勿开启"提现"权限</li>
            <li>• 建议设置 IP 白名单，限制 API 只能从指定 IP 访问</li>
            <li>• API Secret 采用 AES-256-GCM 加密存储，绝不明文保存</li>
            <li>• 定期更换 API Key 以确保账户安全</li>
            <li>• 如发现异常交易，请立即撤销 API Key 并联系客服</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
