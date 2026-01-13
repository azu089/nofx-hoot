'use client';

import { useEffect, useState } from 'react';
import { MobileHeader } from '@/components/ui';
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
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSecurityTips, setShowSecurityTips] = useState(false);

  // 添加表单
  const [formData, setFormData] = useState({
    exchange: 'binance',
    label: '',
    apiKey: '',
    apiSecret: '',
    passphrase: '', // OKX 专用
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
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

    // OKX 需要密钥密码
    if (formData.exchange === 'okx' && !formData.passphrase) {
      alert('OKX 需要填写密钥密码 (Passphrase)');
      return;
    }

    setSubmitting(true);
    try {
      await apiKeysApi.create({
        exchange: formData.exchange,
        label: formData.label,
        apiKey: formData.apiKey,
        secretKey: formData.apiSecret,
        passphrase: formData.exchange === 'okx' ? formData.passphrase : undefined,
      });
      setFormData({ exchange: 'binance', label: '', apiKey: '', apiSecret: '', passphrase: '' });
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
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || '删除失败';
      if (message.includes('停止') || message.includes('running')) {
        alert('请先到交易控制台停止正在运行的策略，然后再删除 API Key');
      } else {
        alert(message);
      }
    } finally {
      setDeleting(null);
    }
  };

  const getExchangeLogo = (exchange: string) => {
    const logos: Record<string, string> = {
      binance: '🟡',
      okx: '⚫',
      bybit: '🟠',
      gate: '🔵',
    };
    return logos[exchange] || '🔑';
  };

  const getExchangeName = (exchange: string) => {
    const map: Record<string, string> = {
      binance: '币安',
      okx: 'OKX',
      bybit: 'Bybit',
      gate: 'Gate.io',
    };
    return map[exchange] || exchange;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <MobileHeader title="API Key" />
        <div className="px-4 pt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-bg-secondary rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <MobileHeader
        title="API Key"
        rightAction={
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-primary text-white text-sm rounded-lg"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        }
      />

      {/* ========== API Key 列表 ========== */}
      {apiKeys.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-bg-secondary rounded-full flex items-center justify-center">
            <Key className="w-10 h-10 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">暂无 API Key</h3>
          <p className="text-text-secondary text-sm mb-6">添加您的交易所 API Key 以开始交易</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl"
          >
            <Plus className="w-5 h-5" />
            添加 API Key
          </button>
        </div>
      ) : (
        <div className="pt-2">
          <div className="px-4 mb-2">
            <p className="text-text-tertiary text-xs">已绑定 {apiKeys.length} 个交易所</p>
          </div>
          <div className="space-y-px">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="bg-bg-secondary px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-bg-tertiary rounded-full flex items-center justify-center text-xl">
                      {getExchangeLogo(key.exchange)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{key.label}</span>
                        <span className="text-text-tertiary text-xs">
                          {getExchangeName(key.exchange)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-text-tertiary text-xs font-mono">
                          {key.api_key_masked}
                        </span>
                        {key.is_valid ? (
                          <span className="flex items-center gap-0.5 text-success text-[10px]">
                            <CheckCircle className="w-3 h-3" />
                            已验证
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-danger text-[10px]">
                            <XCircle className="w-3 h-3" />
                            未验证
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleVerify(key.id)}
                      disabled={verifying === key.id}
                      className="p-2 text-text-secondary hover:text-white active:bg-bg-tertiary rounded-lg transition-colors"
                    >
                      <RefreshCw
                        className={cn('w-4 h-4', verifying === key.id && 'animate-spin')}
                      />
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      disabled={deleting === key.id}
                      className="p-2 text-text-secondary hover:text-danger active:bg-bg-tertiary rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== 安全提示 - 可收起展开 ========== */}
      <div className="px-4 mt-6">
        <button
          onClick={() => setShowSecurityTips(!showSecurityTips)}
          className="flex items-center justify-between w-full py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm text-text-secondary">安全提示</span>
          </div>
          {showSecurityTips ? (
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          )}
        </button>

        {showSecurityTips && (
          <div className="pb-4 space-y-2 text-xs text-text-tertiary">
            <p>• 请确保 API Key 只开启交易权限，禁止开启提现权限</p>
            <p>• 建议设置 IP 白名单限制</p>
            <p>• 您的 API Secret 将使用 AES-256 加密存储</p>
            <p>• OKX 用户需要额外提供密钥密码 (Passphrase)</p>
          </div>
        )}
      </div>

      {/* ========== 添加表单弹窗 ========== */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="w-full max-w-lg bg-bg-secondary rounded-t-2xl animate-in slide-in-from-bottom duration-300">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border-primary">
              <h3 className="text-lg font-medium text-white">添加 API Key</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1 text-text-tertiary hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 表单内容 */}
            <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* 交易所选择 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">选择交易所</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'binance', label: '币安', icon: '🟡' },
                    { value: 'okx', label: 'OKX', icon: '⚫' },
                    { value: 'bybit', label: 'Bybit', icon: '🟠' },
                    { value: 'gate', label: 'Gate', icon: '🔵' },
                  ].map((ex) => (
                    <button
                      key={ex.value}
                      onClick={() => setFormData({ ...formData, exchange: ex.value })}
                      className={cn(
                        'flex flex-col items-center gap-1 py-3 rounded-xl transition-colors',
                        formData.exchange === ex.value
                          ? 'bg-brand-primary/20 border border-brand-primary'
                          : 'bg-bg-tertiary border border-transparent'
                      )}
                    >
                      <span className="text-xl">{ex.icon}</span>
                      <span className={cn(
                        'text-xs',
                        formData.exchange === ex.value ? 'text-brand-primary' : 'text-text-secondary'
                      )}>
                        {ex.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 标签名称 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">标签名称</label>
                <input
                  type="text"
                  placeholder="例如: 主账户"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-tertiary rounded-xl text-white placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">API Key</label>
                <input
                  type="text"
                  placeholder="输入 API Key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-tertiary rounded-xl text-white placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono text-sm"
                />
              </div>

              {/* API Secret */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">API Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="输入 API Secret"
                    value={formData.apiSecret}
                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                    className="w-full px-4 py-3 pr-12 bg-bg-tertiary rounded-xl text-white placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary"
                  >
                    {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* OKX 专用：密钥密码 */}
              {formData.exchange === 'okx' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    密钥密码 (Passphrase)
                    <span className="text-danger ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      placeholder="输入创建 API 时设置的密码"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                      className="w-full px-4 py-3 pr-12 bg-bg-tertiary rounded-xl text-white placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary"
                    >
                      {showPassphrase ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-text-tertiary">
                    OKX 创建 API Key 时需要设置的密码，与登录密码不同
                  </p>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="px-4 py-4 pb-8 border-t border-border-primary">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 bg-bg-tertiary text-white rounded-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleAdd}
                  disabled={submitting}
                  className="flex-1 py-3 bg-brand-primary text-white rounded-xl disabled:opacity-50"
                >
                  {submitting ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
