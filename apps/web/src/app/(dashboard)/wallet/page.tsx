'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Dialog, DialogFooter, WalletSkeleton } from '@/components/ui';
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
  ChevronRight,
  Shield,
  Eye,
  EyeOff,
  Coins,
  Sparkles,
  Receipt,
  CreditCard,
  ArrowLeftRight,
} from 'lucide-react';

// ========== 类型定义 ==========
interface WalletData {
  usdt_balance: string;
  points_balance: string;
  usdt_frozen: string;
  card_balance: string;
  token_balance: string;
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

// ========== 主组件 ==========
export default function WalletPage() {
  const router = useRouter();

  // ========== 所有 useState 必须在最顶层 ==========
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [hideBalance, setHideBalance] = useState(false);

  // 充值表单
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('usdt_trc20');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositAddress, setDepositAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');

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

  // ========== 数据获取函数 ==========
  const fetchData = async () => {
    try {
      const [walletRes, depositsRes, withdrawalsRes] = await Promise.all([
        userApi.getWallet(),
        depositsApi.list(),
        withdrawalsApi.list(),
      ]);

      setWallet({
        usdt_balance: walletRes.data.usdt_balance,
        points_balance: walletRes.data.points_balance,
        usdt_frozen: walletRes.data.usdt_frozen,
        card_balance: walletRes.data.card_balance || '0',
        token_balance: walletRes.data.token_balance || '0',
      });

      const allTx: Transaction[] = [
        ...(depositsRes.data || []).map((d: any) => ({ ...d, type: 'deposit' as const })),
        ...(withdrawalsRes.data || []).map((w: any) => ({ ...w, type: 'withdrawal' as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(allTx);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepositAddress = async () => {
    const chainMap: Record<string, 'TRC20' | 'ERC20' | 'BEP20'> = {
      'usdt_trc20': 'TRC20',
      'usdt_erc20': 'ERC20',
      'usdt_bep20': 'BEP20',
    };
    const chain = chainMap[depositMethod] || 'TRC20';

    setAddressLoading(true);
    setAddressError('');

    try {
      const res = await depositsApi.getDepositAddress(chain);
      setDepositAddress(res.data?.address || '');
    } catch (error) {
      console.error('Failed to fetch deposit address:', error);
      setAddressError('获取充值地址失败，请稍后重试');
    } finally {
      setAddressLoading(false);
    }
  };

  // ========== useEffect ==========
  useEffect(() => {
    fetchData();
    authApi.getTotpStatus().then(res => {
      setTotpEnabled(res.data?.enabled || false);
    }).catch(() => setTotpEnabled(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'deposit') {
      fetchDepositAddress();
    }
  }, [depositMethod, activeTab]);

  // ========== 处理函数 ==========
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

  const initiateWithdraw = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || !withdrawAddress) {
      alert('请填写完整信息');
      return;
    }
    if (totpEnabled) {
      setShow2FAModal(true);
      setTotpCode('');
    } else {
      handleWithdraw();
    }
  };

  const verify2FAAndWithdraw = async () => {
    if (totpCode.length !== 6) {
      alert('请输入6位验证码');
      return;
    }
    setVerifying2FA(true);
    try {
      const verifyRes = await authApi.verifyTotp(totpCode);
      if (!verifyRes.data?.verified) {
        alert('验证码错误');
        return;
      }
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

  // ========== 加载状态 ==========
  if (loading) {
    return <WalletSkeleton />;
  }

  // ========== 主渲染 ==========
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* 头部 - 桌面端 */}
      <div className="hidden lg:flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">资产钱包</h1>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 移动端 */}
      <div className="lg:hidden">
        {/* 移动端总资产卡片 */}
        <div className="bg-gradient-to-br from-brand-primary to-brand-secondary rounded-2xl p-5 mb-4 shadow-lg shadow-brand-primary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/80 text-sm">总资产 (USDT)</span>
            {/* 眼睛按钮 - 显示/隐藏余额 */}
            <button
              onClick={() => setHideBalance(!hideBalance)}
              className="p-1.5 rounded-lg bg-white/10 active:bg-white/20 transition-colors"
            >
              {hideBalance ? (
                <EyeOff className="w-4 h-4 text-white/80" />
              ) : (
                <Eye className="w-4 h-4 text-white/80" />
              )}
            </button>
          </div>
          <p className="text-3xl font-bold text-white mb-4">
            {hideBalance ? '****' : formatCurrency(wallet?.usdt_balance || '0')}
          </p>

          {/* 移动端快捷操作按钮 - 充值、提现、闪兑、账单 */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => router.push('/wallet/deposit')}
              className="flex flex-col items-center justify-center gap-1 p-3 bg-white/10 rounded-xl active:bg-white/20 transition-all"
            >
              <ArrowDownToLine className="w-5 h-5 text-white" />
              <span className="text-white text-xs font-medium">充值</span>
            </button>
            <button
              onClick={() => router.push('/wallet/withdraw')}
              className="flex flex-col items-center justify-center gap-1 p-3 bg-white/10 rounded-xl active:bg-white/20 transition-all"
            >
              <ArrowUpFromLine className="w-5 h-5 text-white" />
              <span className="text-white text-xs font-medium">提现</span>
            </button>
            <button
              onClick={() => router.push('/wallet/exchange')}
              className="flex flex-col items-center justify-center gap-1 p-3 bg-white/10 rounded-xl active:bg-white/20 transition-all"
            >
              <ArrowLeftRight className="w-5 h-5 text-white" />
              <span className="text-white text-xs font-medium">闪兑</span>
            </button>
            <button
              onClick={() => router.push('/wallet/billing')}
              className="flex flex-col items-center justify-center gap-1 p-3 bg-white/10 rounded-xl active:bg-white/20 transition-all"
            >
              <Receipt className="w-5 h-5 text-white" />
              <span className="text-white text-xs font-medium">账单</span>
            </button>
          </div>
        </div>

        {/* 移动端资产明细 - USDT、积分、代币、点卡 */}
        <Card className="lg:hidden">
          <CardHeader>
            <CardTitle className="text-base">资产明细</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* USDT */}
            <div className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <p className="text-white font-medium">USDT</p>
                  <p className="text-text-tertiary text-sm">可用资产</p>
                </div>
              </div>
              <p className="text-white font-bold">
                {hideBalance ? '****' : formatCurrency(wallet?.usdt_balance || '0')}
              </p>
            </div>

            {/* 积分 */}
            <div className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-white font-medium">积分</p>
                  <p className="text-text-tertiary text-sm">可兑换 QFI 代币</p>
                </div>
              </div>
              <p className="text-white font-bold">
                {hideBalance ? '****' : parseFloat(wallet?.points_balance || '0').toLocaleString()}
              </p>
            </div>

            {/* QFI 代币 */}
            <div className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Coins className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium">QFI 代币</p>
                  <p className="text-text-tertiary text-sm">平台治理代币</p>
                </div>
              </div>
              <p className="text-white font-bold">
                {hideBalance ? '****' : parseFloat(wallet?.token_balance || '0').toFixed(4)}
              </p>
            </div>

            {/* 点卡 */}
            <div className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-white font-medium">点卡</p>
                  <p className="text-text-tertiary text-sm">抵扣交易手续费</p>
                </div>
              </div>
              <p className="text-white font-bold">
                {hideBalance ? '****' : parseFloat(wallet?.card_balance || '0').toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 资产卡片 - 桌面端 */}
      <div className="hidden lg:grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl p-6 shadow-lg shadow-brand-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">USDT</p>
              <p className="text-2xl font-bold text-white mt-1">
                {formatCurrency(wallet?.usdt_balance || '0')}
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">积分</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {parseFloat(wallet?.points_balance || '0').toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-success/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QFI 代币卡片 - 桌面端 */}
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-text-secondary text-sm">QFI 代币</p>
                </div>
                <p className="text-2xl font-bold text-white mt-1">
                  {parseFloat(wallet?.token_balance || '0').toFixed(4)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Coins className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 点卡卡片 - 桌面端 */}
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">点卡</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {parseFloat(wallet?.card_balance || '0').toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-warning/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快捷入口 - 桌面端 */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>快捷入口</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            onClick={() => router.push('/wallet/exchange')}
            className="w-full flex items-center justify-between p-4 bg-bg-tertiary/50 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">闪兑</p>
                <p className="text-text-tertiary text-sm">资产快速兑换</p>
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
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">账单明细</p>
                <p className="text-text-tertiary text-sm">查看收支记录</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-tertiary" />
          </button>

          <button
            onClick={() => router.push('/wallet/api-keys')}
            className="w-full flex items-center justify-between p-4 bg-bg-tertiary/50 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">API Key 管理</p>
                <p className="text-text-tertiary text-sm">绑定交易所 API</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-tertiary" />
          </button>
        </CardContent>
      </Card>

      {/* 资产分布 - 桌面端 */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>资产分布</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetDistributionChart
            data={[
              { name: '可用余额', value: parseFloat(wallet?.usdt_balance || '0'), color: '#3772FF' },
              { name: '积分', value: parseFloat(wallet?.points_balance || '0') / 100, color: '#00C087' },
            ]}
          />
        </CardContent>
      </Card>

      {/* 充值/提现快捷操作 - 桌面端 */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:border-brand-primary/50 transition-colors cursor-pointer" onClick={() => router.push('/wallet/deposit')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-success/20 rounded-xl flex items-center justify-center">
                <ArrowDownToLine className="w-7 h-7 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium text-lg">充值</h3>
                <p className="text-text-tertiary text-sm">支持 TRC20 / ERC20 / BEP20</p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-warning/50 transition-colors cursor-pointer" onClick={() => router.push('/wallet/withdraw')}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-warning/20 rounded-xl flex items-center justify-center">
                <ArrowUpFromLine className="w-7 h-7 text-warning" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium text-lg">提现</h3>
                <p className="text-text-tertiary text-sm">可提现: {formatCurrency(wallet?.usdt_balance || '0')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 交易记录 - 桌面端 */}
      <Card className="hidden lg:block">
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
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.type === 'deposit' ? 'bg-success/20' : 'bg-danger/20'
                      }`}>
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
                        <p className="text-text-tertiary text-xs">{formatDateTime(tx.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${tx.type === 'deposit' ? 'text-success' : 'text-danger'}`}>
                        {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {getStatusIcon(tx.status)}
                        <span className="text-xs text-text-secondary">{getStatusText(tx.status)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      {/* 2FA 验证弹窗 */}
      <Dialog open={show2FAModal} onClose={() => setShow2FAModal(false)} title="安全验证" description="请输入验证码">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-brand-primary" />
            </div>
          </div>
          <Input
            label="验证码"
            type="text"
            placeholder="000000"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="text-center text-2xl tracking-[0.5em] font-mono"
          />
          <div className="bg-bg-tertiary/50 rounded-lg p-4 space-y-2 border border-border-primary">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">提现金额</span>
              <span className="text-sm text-white font-medium">{formatCurrency(withdrawAmount)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">提现链</span>
              <span className="text-sm text-white">{withdrawChain}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShow2FAModal(false)} disabled={verifying2FA}>取消</Button>
          <Button onClick={verify2FAAndWithdraw} isLoading={verifying2FA} disabled={totpCode.length !== 6}>确认提现</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
