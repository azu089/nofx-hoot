'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: '资产钱包 | QuantFi',
//   description: '管理您的 USDT 余额、积分、查看账单明细和绑定交易所 API Key',
// };
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { userApi, depositsApi, withdrawalsApi, authApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { AssetDistributionChart } from '@/components/charts';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Key,
  Receipt,
  ChevronRight,
  Shield,
  X,
} from 'lucide-react';

interface WalletData {
  usdt_balance: string;
  points_balance: string;
  usdt_frozen: string;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: string;
  status: string;
  created_at: string;
  method?: string;
  chain?: string;
  to_address?: string;
}

export default function WalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  // 充值表单
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('usdt_trc20');
  const [depositLoading, setDepositLoading] = useState(false);

  // 提现表单
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawChain, setWithdrawChain] = useState('TRC20');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // 2FA 验证
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [verifying2FA, setVerifying2FA] = useState(false);

  const fetchData = async () => {
    try {
      const [walletRes, depositsRes, withdrawalsRes] = await Promise.all([
        userApi.getWallet(),
        depositsApi.list(),
        withdrawalsApi.list(),
      ]);

      setWallet(walletRes.data);

      // 合并交易记录
      const allTx: Transaction[] = [
        ...(depositsRes.data || []).map((d) => ({
          ...d,
          type: 'deposit' as const,
        })),
        ...(withdrawalsRes.data || []).map((w) => ({
          ...w,
          type: 'withdrawal' as const,
        })),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(allTx);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 检查 2FA 状态
    authApi.getTotpStatus().then(res => {
      setTotpEnabled(res.data?.enabled || false);
    }).catch(() => setTotpEnabled(false));
  }, []);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;

    setDepositLoading(true);
    try {
      await depositsApi.create(depositAmount, depositMethod);
      setDepositAmount('');
      fetchData();
      alert('充值申请已提交，请等待审核');
    } catch (error) {
      alert(error instanceof Error ? error.message : '充值失败');
    } finally {
      setDepositLoading(false);
    }
  };

  // 提交提现前检查 2FA
  const initiateWithdraw = () => {
    if (
      !withdrawAmount ||
      parseFloat(withdrawAmount) <= 0 ||
      !withdrawAddress
    ) {
      alert('请填写完整信息');
      return;
    }

    // 如果启用了 2FA，显示验证弹窗
    if (totpEnabled) {
      setShow2FAModal(true);
      setTotpCode('');
    } else {
      // 未启用 2FA，直接提现
      handleWithdraw();
    }
  };

  // 验证 2FA 后提现
  const verify2FAAndWithdraw = async () => {
    if (totpCode.length !== 6) {
      alert('请输入6位验证码');
      return;
    }

    setVerifying2FA(true);
    try {
      // 验证 2FA
      const verifyRes = await authApi.verifyTotp(totpCode);
      if (!verifyRes.data?.verified) {
        alert('验证码错误');
        return;
      }

      // 验证通过，执行提现
      setShow2FAModal(false);
      await handleWithdraw();
    } catch (error) {
      alert(error instanceof Error ? error.message : '验证失败');
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawLoading(true);
    try {
      await withdrawalsApi.create(withdrawAmount, withdrawChain, withdrawAddress);
      setWithdrawAmount('');
      setWithdrawAddress('');
      fetchData();
      alert('提现申请已提交，请等待审核');
    } catch (error) {
      alert(error instanceof Error ? error.message : '提现失败');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
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
      completed: '已完成',
      approved: '已通过',
      rejected: '已拒绝',
      failed: '失败',
    };
    return map[status] || status;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">钱包</h1>
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-bg-tertiary rounded-xl" />
          <div className="h-64 bg-bg-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">钱包</h1>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 余额卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">可用余额</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(wallet?.usdt_balance || '0')}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-brand-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">冻结余额</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(wallet?.usdt_frozen || '0')}
                </p>
              </div>
              <div className="w-12 h-12 bg-warning/20 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">积分余额</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {parseFloat(wallet?.points_balance || '0').toLocaleString()} 分
                </p>
              </div>
              <div className="w-12 h-12 bg-success/20 rounded-lg flex items-center justify-center">
                <span className="text-success text-xl">🎯</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快捷入口和资产分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 快捷入口 */}
        <Card>
          <CardHeader>
            <CardTitle>快捷入口</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={() => router.push('/wallet/api-keys')}
              className="w-full flex items-center justify-between p-4 bg-bg-tertiary/50 hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-brand-primary" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">API Key 管理</p>
                  <p className="text-text-tertiary text-sm">管理交易所 API 密钥</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </button>

            <button
              onClick={() => router.push('/wallet/billing')}
              className="w-full flex items-center justify-between p-4 bg-bg-tertiary/50 hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-warning" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">账单明细</p>
                  <p className="text-text-tertiary text-sm">查看收支记录</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </button>
          </CardContent>
        </Card>

        {/* 资产分布 */}
        <Card>
          <CardHeader>
            <CardTitle>资产分布</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetDistributionChart
              data={[
                {
                  name: '可用余额',
                  value: parseFloat(wallet?.usdt_balance || '0'),
                  color: '#3772FF',
                },
                {
                  name: '冻结余额',
                  value: parseFloat(wallet?.usdt_frozen || '0'),
                  color: '#F7931A',
                },
                {
                  name: '积分',
                  value: parseFloat(wallet?.points_balance || '0') / 100, // 转换为等值 USDT
                  color: '#00C087',
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* 充值/提现 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex space-x-4 border-b border-border-primary -mx-6 px-6">
              <button
                onClick={() => setActiveTab('deposit')}
                className={`pb-3 px-2 text-sm font-medium transition ${
                  activeTab === 'deposit'
                    ? 'text-brand-primary border-b-2 border-brand-primary'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                <ArrowDownToLine className="w-4 h-4 inline mr-2" />
                充值
              </button>
              <button
                onClick={() => setActiveTab('withdraw')}
                className={`pb-3 px-2 text-sm font-medium transition ${
                  activeTab === 'withdraw'
                    ? 'text-brand-primary border-b-2 border-brand-primary'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                <ArrowUpFromLine className="w-4 h-4 inline mr-2" />
                提现
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === 'deposit' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    充值方式
                  </label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value)}
                    className="w-full px-4 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-white"
                  >
                    <option value="usdt_trc20">USDT (TRC20)</option>
                    <option value="usdt_erc20">USDT (ERC20)</option>
                    <option value="usdt_bep20">USDT (BEP20)</option>
                  </select>
                </div>
                <Input
                  label="充值金额"
                  type="number"
                  placeholder="输入充值金额"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <div className="p-4 bg-bg-tertiary/50 rounded-lg">
                  <p className="text-sm text-text-secondary mb-2">充值地址</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-white break-all">
                      TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSe
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSe'
                        );
                        alert('已复制');
                      }}
                      className="p-2 hover:bg-border-secondary rounded"
                    >
                      <Copy className="w-4 h-4 text-text-secondary" />
                    </button>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleDeposit}
                  isLoading={depositLoading}
                  disabled={!depositAmount}
                >
                  提交充值申请
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    提现链
                  </label>
                  <select
                    value={withdrawChain}
                    onChange={(e) => setWithdrawChain(e.target.value)}
                    className="w-full px-4 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-white"
                  >
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                    <option value="BEP20">BEP20</option>
                  </select>
                </div>
                <Input
                  label="提现金额"
                  type="number"
                  placeholder="输入提现金额"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <Input
                  label="收款地址"
                  type="text"
                  placeholder="输入收款钱包地址"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                />
                <p className="text-sm text-text-tertiary">
                  可提现余额: {formatCurrency(wallet?.usdt_balance || '0')}
                </p>
                <Button
                  className="w-full"
                  onClick={initiateWithdraw}
                  isLoading={withdrawLoading}
                  disabled={!withdrawAmount || !withdrawAddress}
                >
                  提交提现申请
                </Button>
                {totpEnabled && (
                  <p className="text-sm text-text-tertiary text-center mt-2">
                    <Shield className="w-4 h-4 inline mr-1" />
                    提现需要 2FA 验证
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 交易记录 */}
        <Card>
          <CardHeader>
            <CardTitle>交易记录</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无交易记录</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === 'deposit'
                            ? 'bg-success/20'
                            : 'bg-danger/20'
                        }`}
                      >
                        {tx.type === 'deposit' ? (
                          <ArrowDownToLine className="w-4 h-4 text-success" />
                        ) : (
                          <ArrowUpFromLine className="w-4 h-4 text-danger" />
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {tx.type === 'deposit' ? '充值' : '提现'}
                        </p>
                        <p className="text-text-tertiary text-xs">
                          {formatDateTime(tx.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-medium ${
                          tx.type === 'deposit'
                            ? 'text-success'
                            : 'text-danger'
                        }`}
                      >
                        {tx.type === 'deposit' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {getStatusIcon(tx.status)}
                        <span className="text-xs text-text-secondary">
                          {getStatusText(tx.status)}
                        </span>
                      </div>
                    </div>
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

              <div className="bg-bg-tertiary/50 rounded-lg p-3">
                <p className="text-text-secondary text-sm">
                  提现金额: <span className="text-white font-medium">{formatCurrency(withdrawAmount)}</span>
                </p>
                <p className="text-text-secondary text-sm">
                  提现链: <span className="text-white">{withdrawChain}</span>
                </p>
                <p className="text-text-secondary text-sm truncate">
                  收款地址: <span className="text-white text-xs">{withdrawAddress}</span>
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
                  isLoading={verifying2FA}
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
