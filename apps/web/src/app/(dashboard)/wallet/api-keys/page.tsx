'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
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

interface VerifyResult {
  valid: boolean;
  permissions?: string[];
  balances?: Array<{
    currency: string;
    free: string;
    used: string;
    total: string;
  }>;
  totalBalanceUsdt?: string;
  error?: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSecurityTips, setShowSecurityTips] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [showVerifyResult, setShowVerifyResult] = useState(false);

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

    // OKX 和 Bitget 需要密钥密码
    if ((formData.exchange === 'okx' || formData.exchange === 'bitget') && !formData.passphrase) {
      alert(`${formData.exchange === 'okx' ? 'OKX' : 'Bitget'} 需要填写密钥密码 (Passphrase)`);
      return;
    }

    setSubmitting(true);
    try {
      // 1. 创建 API Key
      const createRes = await apiKeysApi.create({
        exchange: formData.exchange,
        label: formData.label,
        apiKey: formData.apiKey,
        secretKey: formData.apiSecret,
        passphrase: (formData.exchange === 'okx' || formData.exchange === 'bitget') ? formData.passphrase : undefined,
      });

      setFormData({ exchange: 'binance', label: '', apiKey: '', apiSecret: '', passphrase: '' });
      setShowAddForm(false);

      // 2. 自动验证并获取余额
      if (createRes.data?.id) {
        setVerifying(createRes.data.id);
        try {
          const verifyRes = await apiKeysApi.verify(createRes.data.id);
          setVerifyResult(verifyRes.data);
          setShowVerifyResult(true);
        } catch {
          // 验证失败不影响添加成功
        } finally {
          setVerifying(null);
        }
      }

      fetchApiKeys();
    } catch (error) {
      alert(error instanceof Error ? error.message : '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      const res = await apiKeysApi.verify(id);
      fetchApiKeys();
      // 显示验证结果弹窗（包含余额信息）
      setVerifyResult(res.data);
      setShowVerifyResult(true);
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

  const getExchangeLogo = (exchange: string, size: number = 24, invert: boolean = false) => {
    const validExchanges = ['binance', 'okx', 'bybit', 'gate', 'bitget', 'coinbase'];
    if (!validExchanges.includes(exchange)) {
      return <span className="text-lg">🔑</span>;
    }
    return (
      <Image
        src={`/icons/exchanges/${exchange}.svg`}
        alt={exchange}
        width={size}
        height={size}
        className={cn('object-contain', invert && 'brightness-0 invert')}
      />
    );
  };

  const getExchangeName = (exchange: string) => {
    const map: Record<string, string> = {
      binance: '币安',
      okx: 'OKX',
      bybit: 'Bybit',
      gate: 'Gate.io',
      bitget: 'Bitget',
      coinbase: 'Coinbase',
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
                    <div className="w-10 h-10 bg-bg-tertiary rounded-full flex items-center justify-center">
                      {getExchangeLogo(key.exchange, 24)}
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerify(key.id)}
                      disabled={verifying === key.id}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-lg transition-colors",
                        verifying === key.id
                          ? "bg-bg-tertiary text-text-tertiary"
                          : "bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30"
                      )}
                    >
                      {verifying === key.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        '验证'
                      )}
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

      {/* ========== 验证结果弹窗 ========== */}
      {showVerifyResult && verifyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-bg-secondary rounded-2xl animate-in zoom-in-95 duration-200">
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border-primary">
              <h3 className="text-lg font-medium text-white">
                {verifyResult.valid ? '验证成功' : '验证失败'}
              </h3>
              <button
                onClick={() => setShowVerifyResult(false)}
                className="p-1 text-text-tertiary hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容 */}
            <div className="px-4 py-4">
              {verifyResult.valid ? (
                <>
                  {/* 成功图标 */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-success" />
                    </div>
                  </div>

                  {/* 总资产 */}
                  {verifyResult.totalBalanceUsdt && (
                    <div className="text-center mb-4">
                      <p className="text-text-secondary text-sm mb-1">交易所余额 (USDT)</p>
                      <p className="text-2xl font-bold text-white">
                        ${Number(verifyResult.totalBalanceUsdt).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* 余额明细 */}
                  {verifyResult.balances && verifyResult.balances.length > 0 && (
                    <div className="bg-bg-tertiary rounded-xl p-3 space-y-2">
                      <p className="text-text-tertiary text-xs mb-2">资产明细</p>
                      {verifyResult.balances.map((b) => (
                        <div key={b.currency} className="flex items-center justify-between">
                          <span className="text-text-secondary text-sm">{b.currency}</span>
                          <span className="text-white text-sm font-mono">
                            {Number(b.total).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 权限 */}
                  {verifyResult.permissions && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-text-tertiary text-xs">权限:</span>
                      {verifyResult.permissions.map((p) => (
                        <span key={p} className="px-2 py-0.5 bg-brand-primary/20 text-brand-primary text-xs rounded">
                          {p === 'spot' ? '现货' : p === 'futures' ? '合约' : p}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* 失败图标 */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-danger/20 rounded-full flex items-center justify-center">
                      <XCircle className="w-8 h-8 text-danger" />
                    </div>
                  </div>
                  <p className="text-center text-text-secondary">
                    {verifyResult.error || 'API Key 验证失败，请检查配置'}
                  </p>
                </>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="px-4 py-4 border-t border-border-primary">
              <button
                onClick={() => setShowVerifyResult(false)}
                className="w-full py-3 bg-brand-primary text-white rounded-xl"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

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
              {/* 交易所选择 - App 图标样式 */}
              <div>
                <label className="block text-sm text-text-secondary mb-3">选择交易所</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'binance', label: '币安', bg: '#181A20' },
                    { value: 'okx', label: 'OKX', bg: '#000000' },
                    { value: 'bybit', label: 'Bybit', bg: '#131722' },
                    { value: 'gate', label: 'Gate', bg: '#FFFFFF' },
                    { value: 'bitget', label: 'Bitget', bg: '#00F0FF' },
                    { value: 'coinbase', label: 'Coinbase', bg: '#0052FF' },
                  ].map((ex) => (
                    <button
                      key={ex.value}
                      onClick={() => setFormData({ ...formData, exchange: ex.value })}
                      className="flex flex-col items-center gap-2"
                    >
                      {/* 图标方框 - 独立的圆角方框，模仿 App 图标 */}
                      <div
                        className={cn(
                          'w-14 h-14 rounded-2xl flex items-center justify-center transition-all overflow-hidden',
                          formData.exchange === ex.value
                            ? 'ring-2 ring-brand-primary ring-offset-2 ring-offset-bg-secondary'
                            : 'ring-1 ring-white/10'
                        )}
                        style={{ backgroundColor: ex.bg }}
                      >
                        {getExchangeLogo(ex.value, 32)}
                      </div>
                      {/* 名称在方框外下方 */}
                      <span className={cn(
                        'text-xs font-medium',
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

              {/* OKX/Bitget 专用：密钥密码 */}
              {(formData.exchange === 'okx' || formData.exchange === 'bitget') && (
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
                    {formData.exchange === 'okx' ? 'OKX' : 'Bitget'} 创建 API Key 时需要设置的密码，与登录密码不同
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
