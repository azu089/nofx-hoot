'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { walletApi, depositsApi, withdrawalsApi, Deposit, Withdrawal } from '@/lib/api';

interface WalletData {
  usdt_balance: string;
  point_balance: string;
  frozen_balance: string;
}

type Transaction = (Deposit & { type: 'deposit' }) | (Withdrawal & { type: 'withdrawal' });

// Utility functions
function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  // Form states
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('usdt_trc20');
  const [depositLoading, setDepositLoading] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawChain, setWithdrawChain] = useState('TRC20');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const fetchData = async () => {
    try {
      // 获取钱包余额
      const walletRes = await walletApi.getBalance();
      setWallet(walletRes.data);

      // 获取充值和提现记录
      const [depositsRes, withdrawalsRes] = await Promise.all([
        depositsApi.list({ limit: 5 }),
        withdrawalsApi.list({ limit: 5 }),
      ]);

      // 合并交易记录
      const allTransactions: Transaction[] = [
        ...depositsRes.data.deposits.map((d) => ({ ...d, type: 'deposit' as const })),
        ...withdrawalsRes.data.withdrawals.map((w) => ({ ...w, type: 'withdrawal' as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
      alert('加载钱包数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert('请输入有效的充值金额');
      return;
    }
    setDepositLoading(true);
    try {
      await depositsApi.create({
        amount: depositAmount,
        method: depositMethod,
      });
      alert('充值申请已提交，请等待审核');
      setDepositAmount('');
      // 刷新数据
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '充值失败');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || !withdrawAddress) {
      alert('请填写完整信息');
      return;
    }

    // 前端余额校验
    const amount = parseFloat(withdrawAmount);
    const available = parseFloat(wallet?.usdt_balance || '0');
    if (amount > available) {
      alert('可用余额不足');
      return;
    }

    setWithdrawLoading(true);
    try {
      await withdrawalsApi.create({
        amount: withdrawAmount,
        chain: withdrawChain,
        to_address: withdrawAddress,
      });
      alert('提现申请已提交，请等待审核');
      setWithdrawAmount('');
      setWithdrawAddress('');
      // 刷新数据
      await fetchData();
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
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'rejected':
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
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
        <h1 className="text-2xl font-bold">钱包</h1>
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">钱包</h1>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">可用余额</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(wallet?.usdt_balance || '0')}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">冻结余额</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(wallet?.frozen_balance || '0')}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">积分余额</p>
                <p className="text-2xl font-bold mt-1">
                  {parseFloat(wallet?.point_balance || '0').toLocaleString()} 分
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <span className="text-green-500 text-xl">🎯</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deposit/Withdraw */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex space-x-4 border-b -mx-6 px-6">
              <button
                onClick={() => setActiveTab('deposit')}
                className={`pb-3 px-2 text-sm font-medium transition ${
                  activeTab === 'deposit'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowDownToLine className="w-4 h-4 inline mr-2" />
                充值
              </button>
              <button
                onClick={() => setActiveTab('withdraw')}
                className={`pb-3 px-2 text-sm font-medium transition ${
                  activeTab === 'withdraw'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
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
                  <label className="block text-sm text-muted-foreground mb-2">
                    充值方式
                  </label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value)}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                  >
                    <option value="usdt_trc20">USDT (TRC20)</option>
                    <option value="usdt_erc20">USDT (ERC20)</option>
                    <option value="usdt_bep20">USDT (BEP20)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    充值金额
                  </label>
                  <Input
                    type="number"
                    placeholder="输入充值金额"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">充值地址</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm break-all">
                      TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSe
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSe');
                        alert('已复制');
                      }}
                      className="p-2 hover:bg-muted rounded"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleDeposit}
                  disabled={!depositAmount || depositLoading}
                >
                  {depositLoading ? '提交中...' : '提交充值申请'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    提现链
                  </label>
                  <select
                    value={withdrawChain}
                    onChange={(e) => setWithdrawChain(e.target.value)}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                  >
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                    <option value="BEP20">BEP20</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    提现金额
                  </label>
                  <Input
                    type="number"
                    placeholder="输入提现金额"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    收款地址
                  </label>
                  <Input
                    type="text"
                    placeholder="输入收款钱包地址"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  可提现余额: {formatCurrency(wallet?.usdt_balance || '0')}
                </p>
                <Button
                  className="w-full"
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || !withdrawAddress || withdrawLoading}
                >
                  {withdrawLoading ? '提交中...' : '提交提现申请'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>交易记录</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无交易记录</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === 'deposit'
                            ? 'bg-green-500/20'
                            : 'bg-red-500/20'
                        }`}
                      >
                        {tx.type === 'deposit' ? (
                          <ArrowDownToLine className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowUpFromLine className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {tx.type === 'deposit' ? '充值' : '提现'}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDateTime(tx.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-medium ${
                          tx.type === 'deposit'
                            ? 'text-green-500'
                            : 'text-red-500'
                        }`}
                      >
                        {tx.type === 'deposit' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {getStatusIcon(tx.status)}
                        <span className="text-xs text-muted-foreground">
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
    </div>
  );
}
