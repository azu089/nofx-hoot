'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: '提现 | QuantFi',
//   description: '将 USDT 提现到您的钱包地址，支持 TRC20/ERC20/BEP20',
// };
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { withdrawalsApi, userApi, authApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Shield,
  X,
} from 'lucide-react';

type Chain = 'TRC20' | 'ERC20' | 'BEP20';

interface Withdrawal {
  id: string;
  amount: string;
  chain: string;
  to_address: string;
  status: string;
  created_at: string;
}

const CHAIN_FEES: Record<Chain, { fee: number; name: string }> = {
  TRC20: { fee: 1, name: 'TRC20 (波场)' },
  ERC20: { fee: 5, name: 'ERC20 (以太坊)' },
  BEP20: { fee: 0.5, name: 'BEP20 (币安链)' },
};

export default function WithdrawPage() {
  const router = useRouter();

  // 钱包余额
  const [balance, setBalance] = useState('0');

  // 提现表单
  const [amount, setAmount] = useState('');
  const [chain, setChain] = useState<Chain>('TRC20');
  const [address, setAddress] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 2FA 验证
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fetchData = async () => {
    try {
      const [walletRes, withdrawalsRes, totpRes] = await Promise.all([
        userApi.getWallet(),
        withdrawalsApi.list(),
        authApi.getTotpStatus().catch(() => ({ data: { enabled: false } })),
      ]);

      setBalance(walletRes.data.usdt_balance);
      setWithdrawals(withdrawalsRes.data || []);
      setTotpEnabled(totpRes.data?.enabled || false);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 计算手续费和实际到账
  const fee = CHAIN_FEES[chain].fee;
  const amountNum = parseFloat(amount) || 0;
  const netAmount = Math.max(0, amountNum - fee);

  // 设置最大金额
  const handleMaxAmount = () => {
    setAmount(balance);
  };

  // 提交提现（检查 2FA）
  const handleSubmit = () => {
    // 验证
    if (!amount || amountNum <= 0) {
      alert('请输入提现金额');
      return;
    }
    if (amountNum > parseFloat(balance)) {
      alert('余额不足');
      return;
    }
    if (amountNum < fee + 5) {
      alert(`提现金额需大于 ${fee + 5} USDT（含手续费）`);
      return;
    }
    if (!address) {
      alert('请输入收款地址');
      return;
    }

    // 地址格式简单验证
    if (chain === 'TRC20' && !address.startsWith('T')) {
      alert('TRC20 地址应以 T 开头');
      return;
    }
    if (chain === 'ERC20' && !address.startsWith('0x')) {
      alert('ERC20 地址应以 0x 开头');
      return;
    }
    if (chain === 'BEP20' && !address.startsWith('bnb') && !address.startsWith('0x')) {
      alert('BEP20 地址格式不正确');
      return;
    }

    // 检查是否需要 2FA
    if (totpEnabled) {
      setShow2FAModal(true);
      setTotpCode('');
    } else {
      // 未启用 2FA，直接提现
      submitWithdraw();
    }
  };

  // 验证 2FA 并提现
  const verify2FAAndWithdraw = async () => {
    if (totpCode.length !== 6) {
      alert('请输入6位验证码');
      return;
    }

    setVerifying(true);
    try {
      const verifyRes = await authApi.verifyTotp(totpCode);
      if (!verifyRes.data?.verified) {
        alert('验证码错误');
        setVerifying(false);
        return;
      }

      setShow2FAModal(false);
      await submitWithdraw();
    } catch (error) {
      alert(error instanceof Error ? error.message : '验证失败');
    } finally {
      setVerifying(false);
    }
  };

  // 提交提现请求
  const submitWithdraw = async () => {
    setSubmitting(true);
    try {
      await withdrawalsApi.create(amount, chain, address);
      setAmount('');
      setAddress('');
      fetchData();
      alert('提现申请已提交，请等待审核');
    } catch (error) {
      alert(error instanceof Error ? error.message : '提现失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'rejected':
      case 'failed':
        return <XCircle className="w-4 h-4 text-danger" />;
      default:
        return <Clock className="w-4 h-4 text-text-secondary" />;
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待审核',
      processing: '处理中',
      approved: '已通过',
      completed: '已完成',
      rejected: '已拒绝',
      failed: '失败',
    };
    return map[status] || status;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-white">提现</h1>
        </div>
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-bg-tertiary rounded-xl" />
          <div className="h-64 bg-bg-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-white">提现</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 提现表单 */}
        <Card>
          <CardHeader>
            <CardTitle>提现信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 可提现余额 */}
            <div className="p-4 bg-bg-tertiary rounded-lg">
              <p className="text-sm text-text-secondary mb-1">可提现余额</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(balance)}
              </p>
            </div>

            {/* 提现链选择 */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                提现网络
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value as Chain)}
                className="w-full px-4 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {(Object.keys(CHAIN_FEES) as Chain[]).map((c) => (
                  <option key={c} value={c}>
                    {CHAIN_FEES[c].name} (手续费: {CHAIN_FEES[c].fee} USDT)
                  </option>
                ))}
              </select>
            </div>

            {/* 提现金额 */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                提现金额
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="输入提现金额"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-20"
                  step="0.01"
                  min="0"
                />
                <button
                  onClick={handleMaxAmount}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-brand-primary hover:bg-brand-secondary text-white rounded transition"
                >
                  最大
                </button>
              </div>
            </div>

            {/* 收款地址 */}
            <Input
              label="收款地址"
              type="text"
              placeholder={`输入 ${chain} 地址`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            {/* 费用明细 */}
            {amountNum > 0 && (
              <div className="space-y-2 p-4 bg-bg-tertiary/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">提现金额</span>
                  <span className="text-white">{formatCurrency(amountNum)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">手续费 ({chain})</span>
                  <span className="text-danger">-{formatCurrency(fee)}</span>
                </div>
                <div className="h-px bg-border-secondary my-2"></div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-text-secondary">实际到账</span>
                  <span className="text-success">{formatCurrency(netAmount)}</span>
                </div>
              </div>
            )}

            {/* 提交按钮 */}
            <Button
              className="w-full"
              onClick={handleSubmit}
              isLoading={submitting}
              disabled={!amount || !address || amountNum <= 0}
            >
              提交提现申请
            </Button>

            {/* 2FA 提示 */}
            {totpEnabled && (
              <div className="flex items-center gap-2 text-sm text-text-secondary justify-center">
                <Shield className="w-4 h-4" />
                <span>提现需要 2FA 验证</span>
              </div>
            )}

            {/* 安全提示 */}
            <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-xs text-text-secondary space-y-1">
                  <p className="font-medium text-warning">安全提示</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>请仔细核对收款地址，转账后无法撤销</li>
                    <li>请确保选择的网络与收款地址匹配</li>
                    <li>提现需要人工审核，通常 1-24 小时到账</li>
                    <li>单笔最低提现 {fee + 5} USDT</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 提现记录 */}
        <Card>
          <CardHeader>
            <CardTitle>提现记录</CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 opacity-50" />
                </div>
                <p>暂无提现记录</p>
                <p className="text-sm mt-2">提现后记录会显示在这里</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {withdrawals.map((withdrawal) => (
                  <div
                    key={withdrawal.id}
                    className="p-4 bg-bg-tertiary/50 rounded-lg hover:bg-bg-tertiary transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          -{formatCurrency(withdrawal.amount)}
                        </span>
                        <span className="px-2 py-0.5 bg-border-secondary rounded text-xs text-text-secondary">
                          {withdrawal.chain}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(withdrawal.status)}
                        <span className="text-sm text-text-secondary">
                          {getStatusText(withdrawal.status)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-text-tertiary truncate">
                      地址: {withdrawal.to_address}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {formatDateTime(withdrawal.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2FA 验证弹窗 */}
      {show2FAModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-sm mx-4 border border-border-secondary">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-primary" />
                2FA 验证
              </h2>
              <button
                onClick={() => setShow2FAModal(false)}
                className="text-text-secondary hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-text-secondary text-sm">
                请输入 Google Authenticator 中显示的 6 位验证码
              </p>

              <Input
                label="验证码"
                type="text"
                placeholder="输入6位验证码"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />

              <div className="bg-bg-tertiary/50 rounded-lg p-3 space-y-1">
                <p className="text-text-secondary text-sm">
                  提现金额: <span className="text-white font-medium">{formatCurrency(amountNum)}</span>
                </p>
                <p className="text-text-secondary text-sm">
                  提现网络: <span className="text-white">{chain}</span>
                </p>
                <p className="text-text-secondary text-sm">
                  手续费: <span className="text-danger">{formatCurrency(fee)}</span>
                </p>
                <p className="text-text-secondary text-sm">
                  实际到账: <span className="text-success font-medium">{formatCurrency(netAmount)}</span>
                </p>
                <p className="text-text-secondary text-sm truncate">
                  收款地址: <span className="text-white text-xs">{address}</span>
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShow2FAModal(false)}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={verify2FAAndWithdraw}
                  isLoading={verifying}
                  disabled={totpCode.length !== 6}
                >
                  确认提现
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
