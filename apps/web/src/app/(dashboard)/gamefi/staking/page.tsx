'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Dialog, DialogFooter, useToast } from '@/components/ui';
import { gamefiApi, userApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  ArrowLeft,
  Lock,
  Unlock,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Gift,
} from 'lucide-react';

interface Stake {
  id: string;
  stake_type: string;
  amount: string;
  lock_days: number;
  weight: string;
  unlocks_at: string;
  status: string;
  created_at: string;
  accumulated_reward: string;
  claimable_reward: string;
  early_penalty?: string;
  return_preview?: string;
}

export default function StakingPage() {
  const router = useRouter();
  const toast = useToast();
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [pointsBalance, setPointsBalance] = useState('0'); // 积分余额（A 类质押用）
  const [tokenBalance, setTokenBalance] = useState('0'); // 代币余额（B 类质押用）
  const [tokenStakingEnabled, setTokenStakingEnabled] = useState(false); // B 类质押开关
  const [loading, setLoading] = useState(true);
  const [showStakeForm, setShowStakeForm] = useState(false);

  // 质押表单
  const [stakeType, setStakeType] = useState<'A' | 'B'>('A');
  const [stakeAmount, setStakeAmount] = useState('');
  const [lockDays, setLockDays] = useState(30);
  const [staking, setStaking] = useState(false);
  const [unstaking, setUnstaking] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  // 解押确认弹窗
  const [unstakeDialog, setUnstakeDialog] = useState<{
    open: boolean;
    stake: Stake | null;
  }>({ open: false, stake: null });

  const fetchData = async () => {
    try {
      const [stakesRes, walletRes] = await Promise.all([
        gamefiApi.getStakes(),
        userApi.getWallet(),
      ]);
      // 质押数据在 data.stakes 中
      const stakesData = stakesRes.data?.stakes || [];
      setStakes(stakesData.map(s => ({
        id: s.id,
        stake_type: s.stake_type,
        amount: s.amount,
        lock_days: s.lock_period_days,
        weight: s.weight_multiplier,
        unlocks_at: s.end_time,
        status: s.status,
        created_at: s.created_at,
        accumulated_reward: s.accumulated_reward || '0',
        claimable_reward: s.claimable_reward || '0',
        early_penalty: s.early_penalty || undefined,
        return_preview: s.return_preview || undefined,
      })));
      // 设置余额：A 类用积分，B 类用代币
      setPointsBalance(walletRes.data?.points_balance || '0');
      setTokenBalance(walletRes.data?.token_balance || '0');
      // B 类质押开关（后端通过配置控制）
      setTokenStakingEnabled(false); // 默认关闭，后续通过接口获取
    } catch (error) {
      console.error('Failed to fetch staking data:', error);
      toast.error('加载质押数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error('请输入有效金额');
      return;
    }

    // A 类用积分，B 类用代币
    const availableBalance = stakeType === 'A' ? pointsBalance : tokenBalance;
    const balanceType = stakeType === 'A' ? '积分' : '代币';

    if (parseFloat(stakeAmount) > parseFloat(availableBalance)) {
      toast.error(`${balanceType}余额不足`);
      return;
    }

    // B 类质押需要检查开关
    if (stakeType === 'B' && !tokenStakingEnabled) {
      toast.error('代币质押功能暂未开放');
      return;
    }

    setStaking(true);
    try {
      await gamefiApi.stake({
        type: stakeType,
        amount: stakeAmount,
        lockDays: stakeType === 'A' ? 0 : lockDays,
      });
      setStakeAmount('');
      setShowStakeForm(false);
      fetchData();
      toast.success('质押成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '质押失败');
    } finally {
      setStaking(false);
    }
  };

  const handleUnstake = async (id: string) => {
    const stake = stakes.find(s => s.id === id);
    if (!stake) return;

    // 显示解押确认弹窗
    setUnstakeDialog({ open: true, stake });
  };

  const confirmUnstake = async () => {
    if (!unstakeDialog.stake) return;

    const id = unstakeDialog.stake.id;
    setUnstaking(id);
    setUnstakeDialog({ open: false, stake: null });

    try {
      await gamefiApi.unstake(id);
      fetchData();
      toast.success('赎回成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '赎回失败');
    } finally {
      setUnstaking(null);
    }
  };

  const handleClaimRewards = async () => {
    setClaiming(true);
    try {
      const res = await gamefiApi.claimRewards();
      fetchData();
      toast.success(`领取成功：${formatCurrency(res.data.amount)} USDT`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '领取失败');
    } finally {
      setClaiming(false);
    }
  };

  const getWeight = (type: string, days: number) => {
    if (type === 'A') return 1.0;
    return Math.min(1 + days / 180, 3.0);
  };

  const canUnstake = (stake: Stake) => {
    if (stake.stake_type === 'A') return true;
    return new Date(stake.unlocks_at) <= new Date();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-white">质押大厅</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const activeStakes = stakes.filter((s) => s.status === 'active');
  const totalStaked = activeStakes.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const totalClaimable = activeStakes.reduce((sum, s) => sum + parseFloat(s.claimable_reward || '0'), 0);
  const totalAccumulated = activeStakes.reduce((sum, s) => sum + parseFloat(s.accumulated_reward || '0'), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">质押大厅</h1>
        <Button onClick={() => setShowStakeForm(true)}>
          <Lock className="w-4 h-4 mr-2" />
          新建质押
        </Button>
      </div>

      {/* 质押说明 */}
      <Card className="border-brand-primary/30 bg-brand-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-brand-primary mb-3">质押获得权重，权重决定分红比例</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* A 类质押 */}
                <div className="p-3 bg-bg-secondary/50 rounded-lg">
                  <p className="text-white font-medium mb-2">A 类 · 积分质押</p>
                  <ul className="space-y-1 text-text-secondary text-xs">
                    <li>• 使用积分余额质押</li>
                    <li>• 固定权重 <span className="text-brand-primary font-medium">1.0x</span></li>
                    <li>• 解押扣除 <span className="text-danger font-medium">50% 本金</span>（销毁）</li>
                  </ul>
                </div>
                {/* B 类质押 */}
                <div className="p-3 bg-bg-secondary/50 rounded-lg">
                  <p className="text-white font-medium mb-2">
                    B 类 · 代币质押
                    {!tokenStakingEnabled && <span className="text-warning text-xs ml-2">（即将开放）</span>}
                  </p>
                  <ul className="space-y-1 text-text-secondary text-xs">
                    <li>• 使用 $QFI 代币质押</li>
                    <li>• 锁定 30-180 天，权重 <span className="text-brand-primary font-medium">1.0x - 3.0x</span></li>
                    <li>• 解押扣除 <span className="text-warning font-medium">3% 手续费</span></li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border-secondary">
                <p className="text-text-tertiary text-xs">
                  <span className="text-brand-primary">分红规则：</span>
                  平台燃油费收入的 30% 用于质押分红，每周一结算 USDT，按权重比例分配
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 质押汇总 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-text-secondary text-sm">我的总质押</p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatCurrency(totalStaked.toString())}
            </p>
            <p className="text-text-tertiary text-xs mt-1">
              {activeStakes.length} 笔活跃质押
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-text-secondary text-sm">我的总权重</p>
            <p className="text-2xl font-bold text-brand-primary mt-1">
              {activeStakes.reduce((sum, s) => sum + parseFloat(s.amount) * parseFloat(s.weight), 0).toFixed(2)}
            </p>
            <p className="text-text-tertiary text-xs mt-1">
              加权金额（决定分红比例）
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-text-secondary text-sm">累计分红</p>
            <p className="text-2xl font-bold text-success mt-1">
              {formatCurrency(totalAccumulated.toString())} USDT
            </p>
            <p className="text-text-tertiary text-xs mt-1">
              每周一结算
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-text-secondary text-sm">待领取分红</p>
              {totalClaimable > 0 && (
                <Button
                  size="sm"
                  onClick={handleClaimRewards}
                  isLoading={claiming}
                  className="h-7"
                >
                  <Gift className="w-3 h-3 mr-1" />
                  领取
                </Button>
              )}
            </div>
            <p className="text-2xl font-bold text-brand-primary mt-1">
              {formatCurrency(totalClaimable.toString())} USDT
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 新建质押表单 */}
      {showStakeForm && (
        <Card>
          <CardHeader>
            <CardTitle>新建质押</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 质押类型 */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">选择质押类型</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStakeType('A')}
                  className={`p-4 rounded-lg border text-left transition ${
                    stakeType === 'A'
                      ? 'border-brand-primary bg-brand-primary/10'
                      : 'border-border-secondary hover:border-border-primary'
                  }`}
                >
                  <p className="text-white font-medium">积分质押</p>
                  <p className="text-brand-primary text-lg font-bold mt-1">1.0x 权重</p>
                  <p className="text-text-tertiary text-xs mt-2">解押扣 50% · 无锁定期</p>
                  <div className="mt-2 pt-2 border-t border-border-secondary">
                    <p className="text-text-secondary text-xs">可用积分</p>
                    <p className="text-white font-medium">{parseFloat(pointsBalance).toLocaleString()}</p>
                  </div>
                </button>
                <button
                  onClick={() => setStakeType('B')}
                  disabled={!tokenStakingEnabled}
                  className={`p-4 rounded-lg border text-left transition ${
                    stakeType === 'B'
                      ? 'border-brand-primary bg-brand-primary/10'
                      : 'border-border-secondary hover:border-border-primary'
                  } ${!tokenStakingEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <p className="text-white font-medium">代币质押</p>
                  <p className="text-brand-primary text-lg font-bold mt-1">1.0x - 3.0x 权重</p>
                  <p className="text-text-tertiary text-xs mt-2">解押扣 3% · 锁定 30-180 天</p>
                  <div className="mt-2 pt-2 border-t border-border-secondary">
                    <p className="text-text-secondary text-xs">可用 $QFI</p>
                    <p className="text-white font-medium">{parseFloat(tokenBalance).toLocaleString()}</p>
                  </div>
                  {!tokenStakingEnabled && (
                    <div className="mt-2 px-2 py-1 bg-warning/10 rounded text-center">
                      <p className="text-warning text-xs">即将开放</p>
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* 锁定期（B类）- 只允许 30/90/180/365 天 */}
            {stakeType === 'B' && (
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  选择锁定期 (权重: {getWeight('B', lockDays).toFixed(2)}x)
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[30, 90, 180, 365].map((days) => (
                    <button
                      key={days}
                      onClick={() => setLockDays(days)}
                      className={`p-3 rounded-lg border text-center transition ${
                        lockDays === days
                          ? 'border-brand-primary bg-brand-primary/10'
                          : 'border-border-secondary hover:border-border-primary'
                      }`}
                    >
                      <p className="text-white font-medium">{days} 天</p>
                      <p className="text-brand-primary text-sm font-bold mt-1">
                        {getWeight('B', days).toFixed(2)}x
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 质押金额 */}
            <Input
              label={`质押金额 (${stakeType === 'A' ? '积分' : 'QFI 代币'})`}
              type="number"
              placeholder="输入质押金额"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
            />
            <p className="text-sm text-text-tertiary">
              可用余额: {stakeType === 'A'
                ? `${parseFloat(pointsBalance).toLocaleString()} 积分`
                : `${parseFloat(tokenBalance).toLocaleString()} QFI`
              }
            </p>

            {/* 权重计算和惩罚说明 */}
            {stakeAmount && parseFloat(stakeAmount) > 0 && (
              <div className="space-y-3">
                {/* 权重显示 */}
                <div className="p-4 bg-brand-primary/10 border border-brand-primary/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-secondary text-sm">质押权重</p>
                      <p className="text-brand-primary text-2xl font-bold">
                        {getWeight(stakeType, lockDays).toFixed(2)}x
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-text-secondary text-sm">加权金额</p>
                      <p className="text-white text-xl font-bold">
                        {(parseFloat(stakeAmount) * getWeight(stakeType, lockDays)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="text-text-tertiary text-xs mt-2">
                    权重决定分红比例 · 加权金额 = 质押金额 × 权重
                  </p>
                </div>

                {/* 惩罚警告 */}
                <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-danger text-sm font-medium">
                        {stakeType === 'A' ? '解押惩罚' : '解押手续费'}
                      </p>
                      <p className="text-text-secondary text-xs mt-1">
                        {stakeType === 'A'
                          ? `解押将扣除 50% 本金（${(parseFloat(stakeAmount) * 0.5).toFixed(2)} 积分）作为惩罚销毁`
                          : `解押将扣除 3% 手续费（${(parseFloat(stakeAmount) * 0.03).toFixed(2)} QFI）`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowStakeForm(false)}
              >
                取消
              </Button>
              <Button className="flex-1" onClick={handleStake} isLoading={staking}>
                确认质押
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 质押列表 */}
      <Card>
        <CardHeader>
          <CardTitle>我的质押</CardTitle>
        </CardHeader>
        <CardContent>
          {stakes.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Lock className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>暂无质押记录</p>
              <Button className="mt-4" onClick={() => setShowStakeForm(true)}>
                立即质押
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {stakes.map((stake) => {
                const isUnlocked = canUnstake(stake);
                const isActive = stake.status === 'active';

                return (
                  <div
                    key={stake.id}
                    className="p-4 bg-bg-tertiary/30 rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            stake.stake_type === 'A'
                              ? 'bg-brand-primary/20'
                              : 'bg-warning/20'
                          }`}
                        >
                          {isUnlocked ? (
                            <Unlock
                              className={`w-6 h-6 ${
                                stake.stake_type === 'A'
                                  ? 'text-brand-primary'
                                  : 'text-warning'
                              }`}
                            />
                          ) : (
                            <Lock
                              className={`w-6 h-6 ${
                                stake.stake_type === 'A'
                                  ? 'text-brand-primary'
                                  : 'text-warning'
                              }`}
                            />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">
                              {stake.stake_type === 'A' ? 'A 类质押' : 'B 类质押'}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                isActive
                                  ? 'bg-success/20 text-success'
                                  : 'bg-bg-tertiary text-text-secondary'
                              }`}
                            >
                              {isActive ? '活跃' : '已赎回'}
                            </span>
                          </div>
                          <p className="text-text-tertiary text-sm">
                            权重: {parseFloat(stake.weight).toFixed(2)}x
                            {stake.stake_type === 'B' && (
                              <>
                                {' '}
                                · 锁定 {stake.lock_days} 天
                                {!isUnlocked && (
                                  <>
                                    {' '}
                                    · 解锁于 {formatDateTime(stake.unlocks_at)}
                                  </>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-white font-bold">
                            {formatCurrency(stake.amount)}
                          </p>
                          <p className="text-text-tertiary text-xs">
                            {formatDateTime(stake.created_at)}
                          </p>
                        </div>
                        {isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnstake(stake.id)}
                            disabled={unstaking === stake.id}
                          >
                            {unstaking === stake.id ? '赎回中...' : '赎回'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 收益信息 */}
                    {isActive && (parseFloat(stake.accumulated_reward) > 0 || parseFloat(stake.claimable_reward) > 0) && (
                      <div className="flex items-center gap-6 pt-3 border-t border-border-secondary">
                        <div>
                          <p className="text-text-tertiary text-xs">累计分红</p>
                          <p className="text-success font-medium">
                            +{formatCurrency(stake.accumulated_reward)} USDT
                          </p>
                        </div>
                        <div>
                          <p className="text-text-tertiary text-xs">可领取</p>
                          <p className="text-brand-primary font-medium">
                            {formatCurrency(stake.claimable_reward)} USDT
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 解押确认弹窗 */}
      <Dialog
        open={unstakeDialog.open}
        onClose={() => setUnstakeDialog({ open: false, stake: null })}
        title="确认解押"
      >
        {unstakeDialog.stake && (
          <div className="space-y-4">
            <div className="p-4 bg-bg-tertiary/50 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-text-secondary">质押类型</span>
                <span className="text-white font-medium">
                  {unstakeDialog.stake.stake_type === 'A' ? '积分质押' : '代币质押'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">质押金额</span>
                <span className="text-white font-medium">
                  {formatCurrency(unstakeDialog.stake.amount)} {unstakeDialog.stake.stake_type === 'A' ? '积分' : 'QFI'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">当前权重</span>
                <span className="text-brand-primary font-medium">
                  {parseFloat(unstakeDialog.stake.weight).toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">累计分红</span>
                <span className="text-success font-medium">
                  +{formatCurrency(unstakeDialog.stake.accumulated_reward)} USDT
                </span>
              </div>

              {/* 惩罚/手续费警告 - 使用 API 返回的字段 */}
              <div className="border-t border-border-secondary pt-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-danger font-medium">
                      {unstakeDialog.stake.stake_type === 'A' ? '解押惩罚' : '解押手续费'}
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                      {unstakeDialog.stake.stake_type === 'A' ? (
                        <>扣除 <span className="text-danger font-medium">50% 本金</span>（销毁）</>
                      ) : (
                        <>扣除 <span className="text-warning font-medium">3% 手续费</span></>
                      )}
                    </p>
                    <p className="text-danger font-bold mt-2">
                      -{formatCurrency(unstakeDialog.stake.early_penalty || '0')} {unstakeDialog.stake.stake_type === 'A' ? '积分' : 'QFI'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 预计返还 - 使用 API 返回的 return_preview 字段 */}
              <div className="border-t border-border-secondary pt-3">
                <div className="flex justify-between">
                  <span className="text-text-secondary">预计返还</span>
                  <span className="text-white font-bold">
                    {formatCurrency(unstakeDialog.stake.return_preview || '0')} {unstakeDialog.stake.stake_type === 'A' ? '积分' : 'QFI'}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-text-tertiary text-xs">
              解押后，资产将立即返还到您的钱包，权重将同步更新。
            </p>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setUnstakeDialog({ open: false, stake: null })}
          >
            取消
          </Button>
          <Button
            onClick={confirmUnstake}
            isLoading={unstaking !== null}
          >
            确认解押
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
