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
  ArrowUpFromLine,
  Wallet,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { walletApi, withdrawalsApi, Withdrawal } from '@/lib/api';

// 提现链配置
const chains = [
  { id: 'trc20', name: 'TRC20', network: 'TRON', fee: 1, minAmount: 20, time: '~5分钟' },
  { id: 'erc20', name: 'ERC20', network: 'Ethereum', fee: 10, minAmount: 50, time: '~10分钟' },
  { id: 'bep20', name: 'BEP20', network: 'BSC', fee: 0.5, minAmount: 20, time: '~5分钟' },
];

export default function WithdrawPage() {
  const [selectedChain, setSelectedChain] = useState('trc20');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableBalance, setAvailableBalance] = useState('0');
  const [frozenBalance, setFrozenBalance] = useState('0');
  const [withdrawHistory, setWithdrawHistory] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedChainInfo = chains.find((c) => c.id === selectedChain);
  const withdrawAmount = parseFloat(amount) || 0;
  const fee = selectedChainInfo?.fee || 0;
  const netAmount = Math.max(0, withdrawAmount - fee);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [walletRes, withdrawalsRes] = await Promise.all([
        walletApi.getBalance(),
        withdrawalsApi.list({ limit: 10 }),
      ]);
      setAvailableBalance(walletRes.data.usdt_balance);
      setFrozenBalance(walletRes.data.frozen_balance);
      setWithdrawHistory(withdrawalsRes.data.withdrawals);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!amount || withdrawAmount <= 0) {
      alert('请输入提现金额');
      return;
    }

    if (!address) {
      alert('请输入提现地址');
      return;
    }

    if (withdrawAmount < (selectedChainInfo?.minAmount || 0)) {
      alert(`最低提现金额为 ${selectedChainInfo?.minAmount} USDT`);
      return;
    }

    if (withdrawAmount > parseFloat(availableBalance)) {
      alert('可用余额不足');
      return;
    }

    setSubmitting(true);
    try {
      await withdrawalsApi.create({
        amount: amount,
        chain: selectedChain.toUpperCase(),
        to_address: address,
      });
      alert('提现申请已提交，请等待审核');
      setAmount('');
      setAddress('');
      // 刷新数据
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '提现失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            已完成
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            审核中
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-500 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            已拒绝
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpFromLine className="w-7 h-7 text-red-500" />
          提现
        </h1>
        <p className="text-muted-foreground">将 USDT 提现到您的钱包</p>
      </div>

      {/* 余额卡片 */}
      <Card className="bg-gradient-to-r from-primary/20 to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">可用余额</p>
              <p className="text-3xl font-bold">${parseFloat(availableBalance).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">冻结余额</p>
              <p className="text-xl font-medium text-yellow-500">${parseFloat(frozenBalance).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 提现表单 */}
        <Card>
          <CardHeader>
            <CardTitle>提现申请</CardTitle>
            <CardDescription>选择网络并填写提现信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 网络选择 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                选择网络
              </label>
              <div className="grid grid-cols-3 gap-2">
                {chains.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => setSelectedChain(chain.id)}
                    className={`p-3 rounded-lg border text-center transition ${
                      selectedChain === chain.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium text-sm">{chain.name}</p>
                    <p className="text-xs text-muted-foreground">费用: ${chain.fee}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 提现地址 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                提现地址
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={`输入 ${selectedChainInfo?.network} 地址`}
              />
            </div>

            {/* 提现金额 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                提现金额
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`最低 ${selectedChainInfo?.minAmount} USDT`}
                  className="pr-16"
                />
                <button
                  onClick={() => setAmount(availableBalance)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-primary"
                >
                  全部
                </button>
              </div>
            </div>

            {/* 费用明细 */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">提现金额</span>
                <span className="font-medium">${withdrawAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">网络手续费</span>
                <span className="text-red-500">-${fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">实际到账</span>
                <span className="font-bold text-green-500">${netAmount.toFixed(2)}</span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !amount || !address}
            >
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              {submitting ? '提交中...' : '提交提现申请'}
            </Button>
          </CardContent>
        </Card>

        {/* 提现记录 */}
        <Card>
          <CardHeader>
            <CardTitle>提现记录</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>加载中...</p>
              </div>
            ) : withdrawHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowUpFromLine className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无提现记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawHistory.map((record) => (
                  <div
                    key={record.id}
                    className="p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-red-500">
                        -${record.amount}
                      </span>
                      {getStatusBadge(record.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {record.chain} • {record.to_address.slice(0, 10)}...{record.to_address.slice(-6)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(record.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 注意事项 */}
      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="w-5 h-5" />
            注意事项
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• 请确保提现地址正确，发送到错误地址的资产无法找回</li>
            <li>• 提现需要人工审核，通常在 24 小时内处理</li>
            <li>• 大额提现可能需要额外审核时间</li>
            <li>• 每日提现限额：$50,000</li>
            <li>• 首次提现需要完成身份验证</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
