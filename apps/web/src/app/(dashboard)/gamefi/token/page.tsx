'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { tokenApi, gamefiApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Coins,
  Flame,
  TrendingUp,
  ExternalLink,
  ArrowUpRight,
  History,
  AlertCircle,
  Check,
  Clock,
} from 'lucide-react';

interface TokenStats {
  totalSupply: string;
  circulatingSupply: string;
  totalBurned: string;
  monthlyBuybackUsdt: string;
  monthlyBurnedQfi: string;
  currentPrice: string;
}

interface BuybackRecord {
  id: string;
  usdtSpent: string;
  qfiBought: string;
  price: string;
  txHash: string;
  boughtAt: string;
}

interface WithdrawalRecord {
  id: string;
  amount: string;
  fee: string;
  toAddress: string;
  txHash: string | null;
  status: string;
  createdAt: string;
}

export default function TokenPage() {
  // 代币统计
  const [stats, setStats] = useState<TokenStats | null>(null);
  // 用户余额
  const [balance, setBalance] = useState<{
    available: string;
    locked: string;
    vesting: string;
    total: string;
  } | null>(null);
  // 回购历史
  const [buybacks, setBuybacks] = useState<BuybackRecord[]>([]);
  // 提现记录
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);

  // 提现表单
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // 加载状态
  const [loading, setLoading] = useState(true);

  // 加载数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, balanceRes, buybacksRes, withdrawalsRes] = await Promise.all([
          tokenApi.getStats(),
          gamefiApi.getTokenBalance(),
          tokenApi.getBuybackHistory(10),
          tokenApi.getWithdrawals(10),
        ]);

        setStats(statsRes.data);
        setBalance(balanceRes.data);
        setBuybacks(buybacksRes.data || []);
        setWithdrawals(withdrawalsRes.data || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 处理提现
  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAddress) {
      setWithdrawError('请填写提现金额和钱包地址');
      return;
    }

    // 验证地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(withdrawAddress)) {
      setWithdrawError('无效的 BSC 钱包地址');
      return;
    }

    setWithdrawLoading(true);
    setWithdrawError(null);

    try {
      await tokenApi.withdrawOnchain(withdrawAmount, withdrawAddress);
      setWithdrawSuccess(true);
      setWithdrawAmount('');
      setWithdrawAddress('');

      // 刷新数据
      const [balanceRes, withdrawalsRes] = await Promise.all([
        gamefiApi.getTokenBalance(),
        tokenApi.getWithdrawals(10),
      ]);
      setBalance(balanceRes.data);
      setWithdrawals(withdrawalsRes.data || []);

      setTimeout(() => setWithdrawSuccess(false), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '提现失败';
      setWithdrawError(errorMessage);
    } finally {
      setWithdrawLoading(false);
    }
  };

  // 格式化数字
  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-success';
      case 'pending':
        return 'text-warning';
      case 'failed':
        return 'text-danger';
      default:
        return 'text-text-tertiary';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-pulse text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Coins className="w-6 h-6 text-warning" />
          $QFI 代币
        </h1>
        <p className="text-text-secondary mt-1">
          QuantFi 平台代币，支持链上提现到 BSC 网络
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-text-secondary">当前价格</div>
            <div className="text-2xl font-bold text-white mt-1">
              ${stats?.currentPrice || '0.20'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-text-secondary">流通量</div>
            <div className="text-2xl font-bold text-white mt-1">
              {formatNumber(stats?.circulatingSupply || '0')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-text-secondary flex items-center gap-1">
              <Flame className="w-4 h-4 text-warning" />
              总销毁量
            </div>
            <div className="text-2xl font-bold text-warning mt-1">
              {formatNumber(stats?.totalBurned || '0')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-text-secondary">本月回购</div>
            <div className="text-2xl font-bold text-success mt-1">
              ${formatNumber(stats?.monthlyBuybackUsdt || '0')}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：我的余额 + 提现 */}
        <div className="space-y-4">
          {/* 我的余额 */}
          <Card>
            <CardHeader>
              <CardTitle>我的 $QFI 余额</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-bg-tertiary/50 rounded-lg">
                  <div className="text-sm text-text-secondary">可用</div>
                  <div className="text-xl font-bold text-white">
                    {parseFloat(balance?.available || '0').toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-bg-tertiary/50 rounded-lg">
                  <div className="text-sm text-text-secondary">待释放</div>
                  <div className="text-xl font-bold text-warning">
                    {parseFloat(balance?.vesting || '0').toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="p-3 bg-bg-tertiary/50 rounded-lg">
                <div className="text-sm text-text-secondary">总计</div>
                <div className="text-2xl font-bold text-brand-primary">
                  {parseFloat(balance?.total || '0').toFixed(2)} QFI
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 链上提现 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-brand-primary" />
                链上提现
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg text-sm text-brand-primary">
                提现将发送到 BSC (BNB Chain) 网络，手续费 5 QFI
              </div>

              <Input
                label="提现数量"
                type="number"
                placeholder="最少 10 QFI"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />

              <Input
                label="BSC 钱包地址"
                placeholder="0x..."
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
              />

              {withdrawError && (
                <div className="flex items-center gap-2 text-danger text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {withdrawError}
                </div>
              )}

              {withdrawSuccess && (
                <div className="flex items-center gap-2 text-success text-sm">
                  <Check className="w-4 h-4" />
                  提现申请已提交，预计 24 小时内处理
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleWithdraw}
                disabled={withdrawLoading || !withdrawAmount || !withdrawAddress}
              >
                {withdrawLoading ? '处理中...' : '提交提现'}
              </Button>
            </CardContent>
          </Card>

          {/* 提现记录 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-text-secondary" />
                提现记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <p className="text-text-tertiary text-center py-4">暂无提现记录</p>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg">
                      <div>
                        <div className="text-white font-medium">{parseFloat(w.amount).toFixed(2)} QFI</div>
                        <div className="text-xs text-text-tertiary mt-1">
                          {w.toAddress.slice(0, 10)}...{w.toAddress.slice(-8)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center gap-1 ${getStatusColor(w.status)}`}>
                          {getStatusIcon(w.status)}
                          {w.status === 'completed' ? '已完成' : w.status === 'pending' ? '处理中' : w.status}
                        </div>
                        <div className="text-xs text-text-tertiary mt-1">
                          {formatDateTime(w.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：回购销毁历史 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-warning" />
              回购销毁记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {buybacks.length === 0 ? (
              <p className="text-text-tertiary text-center py-8">暂无回购记录</p>
            ) : (
              <div className="space-y-3">
                {buybacks.map((b) => (
                  <div key={b.id} className="p-4 bg-bg-tertiary/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-warning font-bold">
                          {parseFloat(b.qfiBought).toFixed(2)} QFI
                        </div>
                        <div className="text-sm text-text-secondary mt-1">
                          花费 ${parseFloat(b.usdtSpent).toFixed(2)} USDT
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-text-secondary">
                          均价 ${parseFloat(b.price).toFixed(4)}
                        </div>
                        <div className="text-xs text-text-tertiary mt-1">
                          {formatDateTime(b.boughtAt)}
                        </div>
                      </div>
                    </div>
                    {b.txHash && (
                      <a
                        href={`https://bscscan.com/tx/${b.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-brand-primary hover:underline mt-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        查看交易
                      </a>
                    )}
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
