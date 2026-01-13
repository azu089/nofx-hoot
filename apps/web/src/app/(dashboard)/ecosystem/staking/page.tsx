'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Dialog, DialogFooter, useToast } from '@/components/ui';
import { gamefiApi, userApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Lock,
  Unlock,
  AlertTriangle,
  Gift,
  Coins,
  Sparkles,
  Clock,
  Loader2,
  ChevronRight,
} from 'lucide-react';

// ========== 类型定义 ==========
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

// ========== 常量配置 ==========
const LOCK_PERIODS = [
  { days: 30, weight: 1.0 },
  { days: 90, weight: 1.5 },
  { days: 180, weight: 2.0 },
  { days: 365, weight: 3.0 },
];

export default function StakingPage() {
  const toast = useToast();

  // ========== 状态 ==========
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [pointsBalance, setPointsBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [loading, setLoading] = useState(true);

  const [stakeType, setStakeType] = useState<'A' | 'B'>('B');
  const [stakeAmount, setStakeAmount] = useState('');
  const [lockDays, setLockDays] = useState(30);
  const [staking, setStaking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [unstaking, setUnstaking] = useState<string | null>(null);

  const [unstakeDialog, setUnstakeDialog] = useState<{
    open: boolean;
    stake: Stake | null;
  }>({ open: false, stake: null });

  // ========== 数据获取 ==========
  const fetchData = async () => {
    try {
      const [stakesRes, walletRes] = await Promise.all([
        gamefiApi.getStakes(),
        userApi.getWallet(),
      ]);

      const stakesData = stakesRes.data?.stakes || [];
      setStakes(stakesData.map((s: any) => ({
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

      setPointsBalance(walletRes.data?.points_balance || '0');
      setTokenBalance(walletRes.data?.token_balance || '0');
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

  // ========== 计算函数 ==========
  const getWeight = (type: string, days: number) => {
    if (type === 'A') return 1.0;
    const period = LOCK_PERIODS.find(p => p.days === days);
    return period?.weight || 1.0;
  };

  const canUnstake = (stake: Stake) => {
    if (stake.stake_type === 'A') return true;
    return new Date(stake.unlocks_at) <= new Date();
  };

  const getUnlockProgress = (stake: Stake) => {
    if (stake.stake_type === 'A') return 100;
    const start = new Date(stake.created_at).getTime();
    const end = new Date(stake.unlocks_at).getTime();
    const now = Date.now();
    const progress = ((now - start) / (end - start)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const getRemainingDays = (stake: Stake) => {
    const end = new Date(stake.unlocks_at).getTime();
    const now = Date.now();
    const remaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(remaining, 0);
  };

  // ========== 操作函数 ==========
  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error('请输入有效金额');
      return;
    }

    const availableBalance = stakeType === 'A' ? pointsBalance : tokenBalance;
    const balanceType = stakeType === 'A' ? '积分' : '代币';

    if (parseFloat(stakeAmount) > parseFloat(availableBalance)) {
      toast.error(`${balanceType}余额不足`);
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
      fetchData();
      toast.success('质押成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '质押失败');
    } finally {
      setStaking(false);
    }
  };

  const handleUnstake = (stake: Stake) => {
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

  // ========== 统计数据 ==========
  const activeStakes = stakes.filter((s) => s.status === 'active');
  const aTypeStakes = activeStakes.filter((s) => s.stake_type === 'A');
  const bTypeStakes = activeStakes.filter((s) => s.stake_type === 'B');

  const totalPointsStaked = aTypeStakes.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const totalTokenStaked = bTypeStakes.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const totalWeight = activeStakes.reduce((sum, s) => sum + parseFloat(s.amount) * parseFloat(s.weight), 0);
  const totalClaimable = activeStakes.reduce((sum, s) => sum + parseFloat(s.claimable_reward || '0'), 0);

  // ========== 加载状态 ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <div className="animate-pulse p-4 space-y-4">
          <div className="h-24 bg-bg-secondary rounded-xl" />
          <div className="h-20 bg-bg-secondary rounded-xl" />
          <div className="h-48 bg-bg-secondary rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary pb-24">

      {/* ========== 数据总览 - 统一资产卡片 + 光球脉动 ========== */}
      <div className="mx-4 mt-2 mb-4 relative bg-bg-secondary rounded-2xl p-5 overflow-hidden">
        {/* 光球脉动效果 */}
        <div className="pointer-events-none absolute -top-20 right-0 h-40 w-40 animate-pulse rounded-full opacity-30 blur-3xl bg-brand-primary" />

        <div className="relative z-10">
          {/* 主数据 - 总权重 */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-text-tertiary text-xs mb-1">总权重</p>
              <p className="text-3xl font-bold font-mono text-white">{totalWeight.toFixed(2)}</p>
            </div>
            {totalClaimable > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleClaimRewards}
                isLoading={claiming}
              >
                <Gift className="w-4 h-4 mr-1" />
                领取 ${totalClaimable.toFixed(2)}
              </Button>
            )}
          </div>

          {/* 次要数据 - 三列布局 */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div>
              <p className="text-text-tertiary text-xs mb-1">积分质押</p>
              <p className="text-lg font-bold font-mono text-white">{totalPointsStaked.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs mb-1">代币质押</p>
              <p className="text-lg font-bold font-mono text-white">{totalTokenStaked.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs mb-1">待领分红</p>
              <p className="text-lg font-bold font-mono text-warning">${totalClaimable.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== 质押类型选择 - 紧凑横向切换 ========== */}
      <div className="px-4 mb-4">
        <div className="flex bg-bg-secondary rounded-xl p-1">
          <button
            onClick={() => setStakeType('B')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              stakeType === 'B'
                ? 'bg-brand-primary text-white'
                : 'text-text-secondary'
            }`}
          >
            代币质押 · 最高3.0x
          </button>
          <button
            onClick={() => setStakeType('A')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              stakeType === 'A'
                ? 'bg-brand-primary text-white'
                : 'text-text-secondary'
            }`}
          >
            积分质押 · 1.0x
          </button>
        </div>
      </div>

      {/* ========== 质押表单 - 融入式设计 ========== */}
      <div className="px-4 space-y-4">
        {/* 金额输入 */}
        <div className="bg-bg-secondary rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-text-tertiary text-sm">质押数量</span>
            <span className="text-text-tertiary text-xs">
              可用: {stakeType === 'A'
                ? `${parseFloat(pointsBalance).toLocaleString()} 积分`
                : `${parseFloat(tokenBalance).toLocaleString()} QFI`
              }
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              placeholder="0"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="flex-1 text-xl bg-transparent border-none p-0 h-auto font-semibold"
            />
            <button
              onClick={() => setStakeAmount(stakeType === 'A' ? pointsBalance : tokenBalance)}
              className="text-brand-primary text-sm font-medium px-3 py-1.5 bg-brand-primary/10 rounded-lg"
            >
              全部
            </button>
          </div>
        </div>

        {/* 锁定期选择（仅代币质押） */}
        {stakeType === 'B' && (
          <div className="bg-bg-secondary rounded-xl p-4">
            <p className="text-text-tertiary text-sm mb-3">锁定期</p>
            <div className="grid grid-cols-4 gap-2">
              {LOCK_PERIODS.map((period) => (
                <button
                  key={period.days}
                  onClick={() => setLockDays(period.days)}
                  className={`py-2 rounded-lg text-center transition-all ${
                    lockDays === period.days
                      ? 'bg-brand-primary text-white'
                      : 'bg-bg-tertiary text-text-secondary'
                  }`}
                >
                  <p className="text-xs">{period.days}天</p>
                  <p className="font-semibold">{period.weight}x</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 权重预览 */}
        {stakeAmount && parseFloat(stakeAmount) > 0 && (
          <div className="bg-bg-secondary rounded-xl p-4 flex justify-between items-center">
            <span className="text-text-secondary text-sm">获得权重</span>
            <span className="text-brand-primary font-bold text-lg">
              +{(parseFloat(stakeAmount) * getWeight(stakeType, lockDays)).toFixed(2)}
            </span>
          </div>
        )}

        {/* 风险提示 - 简化 */}
        <div className={`rounded-xl p-3 flex items-center gap-2 ${
          stakeType === 'A' ? 'bg-danger/10' : 'bg-warning/10'
        }`}>
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
            stakeType === 'A' ? 'text-danger' : 'text-warning'
          }`} />
          <p className="text-text-secondary text-xs">
            {stakeType === 'A'
              ? '解押将扣除 50% 积分'
              : `锁定 ${lockDays} 天，提前解押扣收益+3%手续费`
            }
          </p>
        </div>

        {/* 确认按钮 */}
        <Button
          variant="primary"
          className="w-full h-12"
          onClick={handleStake}
          isLoading={staking}
          disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
        >
          {staking ? '质押中...' : '确认质押'}
        </Button>
      </div>

      {/* ========== 质押记录 - 列表式 ========== */}
      <div className="mt-6">
        <div className="px-4 flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">我的质押</h3>
          <span className="text-text-tertiary text-sm">{activeStakes.length} 笔</span>
        </div>

        {activeStakes.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Lock className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary text-sm">暂无质押记录</p>
          </div>
        ) : (
          <div className="space-y-px">
            {activeStakes.map((stake) => {
              const isUnlocked = canUnstake(stake);
              const progress = getUnlockProgress(stake);
              const remaining = getRemainingDays(stake);

              return (
                <div
                  key={stake.id}
                  className="bg-bg-secondary px-4 py-3 flex items-center justify-between"
                  onClick={() => handleUnstake(stake)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      stake.stake_type === 'A' ? 'bg-warning/20' : 'bg-brand-primary/20'
                    }`}>
                      {stake.stake_type === 'A' ? (
                        <Sparkles className="w-5 h-5 text-warning" />
                      ) : (
                        <Coins className="w-5 h-5 text-brand-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {formatCurrency(stake.amount)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                      </p>
                      <p className="text-text-tertiary text-xs">
                        {parseFloat(stake.weight).toFixed(1)}x ·
                        {stake.stake_type === 'B' && !isUnlocked
                          ? ` 剩余 ${remaining} 天`
                          : ' 可赎回'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-success text-sm font-medium">
                        +${parseFloat(stake.accumulated_reward).toFixed(2)}
                      </p>
                      <p className="text-text-tertiary text-xs">累计分红</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== 历史记录 ========== */}
      {stakes.filter(s => s.status !== 'active').length > 0 && (
        <div className="mt-6">
          <div className="px-4 mb-3">
            <h3 className="text-text-secondary text-sm">历史记录</h3>
          </div>
          <div className="space-y-px">
            {stakes.filter(s => s.status !== 'active').map((stake) => (
              <div
                key={stake.id}
                className="bg-bg-secondary/50 px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    stake.stake_type === 'A' ? 'bg-warning/10' : 'bg-brand-primary/10'
                  }`}>
                    {stake.stake_type === 'A' ? (
                      <Sparkles className="w-5 h-5 text-warning/50" />
                    ) : (
                      <Coins className="w-5 h-5 text-brand-primary/50" />
                    )}
                  </div>
                  <div>
                    <p className="text-text-secondary">
                      {formatCurrency(stake.amount)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                    </p>
                    <p className="text-text-tertiary text-xs">已赎回</p>
                  </div>
                </div>
                <p className="text-success/70 text-sm">
                  +${parseFloat(stake.accumulated_reward).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== 解押确认弹窗 ========== */}
      <Dialog
        open={unstakeDialog.open}
        onClose={() => setUnstakeDialog({ open: false, stake: null })}
        title="确认解押"
      >
        {unstakeDialog.stake && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border-primary">
                <span className="text-text-secondary">质押金额</span>
                <span className="text-white font-medium">
                  {formatCurrency(unstakeDialog.stake.amount)} {unstakeDialog.stake.stake_type === 'A' ? '积分' : 'QFI'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-primary">
                <span className="text-text-secondary">累计分红</span>
                <span className="text-success font-medium">
                  +${parseFloat(unstakeDialog.stake.accumulated_reward).toFixed(2)}
                </span>
              </div>
            </div>

            <div className={`p-3 rounded-xl ${
              unstakeDialog.stake.stake_type === 'A' ? 'bg-danger/10' : 'bg-warning/10'
            }`}>
              <p className={`text-sm ${
                unstakeDialog.stake.stake_type === 'A' ? 'text-danger' : 'text-warning'
              }`}>
                {unstakeDialog.stake.stake_type === 'A'
                  ? `解押将扣除 50% 本金（${(parseFloat(unstakeDialog.stake.amount) * 0.5).toFixed(2)} 积分销毁）`
                  : `扣除累计收益 + 3% 手续费`
                }
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-text-secondary">预计返还</span>
              <span className="text-white font-bold text-xl">
                {unstakeDialog.stake.stake_type === 'A'
                  ? `${(parseFloat(unstakeDialog.stake.amount) * 0.5).toFixed(2)} 积分`
                  : `${(parseFloat(unstakeDialog.stake.amount) * 0.97).toFixed(2)} QFI`
                }
              </span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setUnstakeDialog({ open: false, stake: null })}
          >
            取消
          </Button>
          <Button
            variant="danger"
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
