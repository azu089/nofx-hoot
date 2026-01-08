'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, Button, Input, Dialog, DialogFooter, useToast, MobileHeader } from '@/components/ui';
import { gamefiApi, userApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  Lock,
  Unlock,
  TrendingUp,
  AlertTriangle,
  Gift,
  RefreshCw,
  Coins,
  Sparkles,
  Clock,
  ChevronRight,
  Loader2,
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
// 根据项目需求 3.3：B类权重 1.0x - 3.0x (随时间递增)
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

  // 质押表单状态
  const [stakeType, setStakeType] = useState<'A' | 'B'>('A');
  const [stakeAmount, setStakeAmount] = useState('');
  const [lockDays, setLockDays] = useState(30);
  const [staking, setStaking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [unstaking, setUnstaking] = useState<string | null>(null);

  // 解押弹窗
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

  // 计算获得的 veToken 权重 = 质押金额 × 权重乘数
  const calculateVeToken = (amount: number, weight: number) => {
    return (amount * weight).toFixed(2);
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
  const totalStaked = activeStakes.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const totalWeight = activeStakes.reduce((sum, s) => sum + parseFloat(s.amount) * parseFloat(s.weight), 0);
  const totalClaimable = activeStakes.reduce((sum, s) => sum + parseFloat(s.claimable_reward || '0'), 0);
  const avgWeight = totalStaked > 0 ? (totalWeight / totalStaked).toFixed(2) : '0.00';

  // ========== 加载状态 ==========
  if (loading) {
    return (
      <div className="space-y-6">
        <MobileHeader title="质押中心" />
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-bg-tertiary rounded-xl" />
          <div className="h-12 bg-bg-tertiary rounded-xl" />
          <div className="h-64 bg-bg-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <MobileHeader
        title="质押中心"
        rightAction={
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        }
      />

      {/* ========== 总览卡片（渐变背景） ========== */}
      <div className="bg-gradient-to-br from-brand-primary/20 via-brand-secondary/10 to-bg-secondary rounded-2xl p-5 border border-brand-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-text-secondary text-sm mb-1">我的总质押</p>
            <p className="text-3xl font-bold text-white">
              {formatCurrency(totalStaked.toString())}
            </p>
          </div>
          <div className="w-14 h-14 bg-brand-primary/20 rounded-xl flex items-center justify-center">
            <Lock className="w-7 h-7 text-brand-primary" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-bg-primary/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-success" />
              <span className="text-text-tertiary text-xs">平均权重</span>
            </div>
            <p className="text-white font-bold text-lg">{avgWeight}x</p>
          </div>
          <div className="bg-bg-primary/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Gift className="w-3.5 h-3.5 text-warning" />
              <span className="text-text-tertiary text-xs">待领取分红</span>
            </div>
            <p className="text-warning font-bold text-lg">${totalClaimable.toFixed(2)}</p>
          </div>
        </div>

        {totalClaimable > 0 && (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleClaimRewards}
            isLoading={claiming}
          >
            <Gift className="w-4 h-4 mr-2" />
            领取分红 (${totalClaimable.toFixed(2)} USDT)
          </Button>
        )}
      </div>

      {/* ========== 质押类型 Tab ========== */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setStakeType('A')}
          className={`p-4 rounded-xl border-2 transition-all ${
            stakeType === 'A'
              ? 'border-brand-primary bg-brand-primary/10'
              : 'border-border-primary bg-bg-secondary hover:border-brand-primary/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-warning" />
            <span className="text-white font-semibold">积分质押</span>
          </div>
          <p className="text-brand-primary text-2xl font-bold">1.0x</p>
          <p className="text-text-tertiary text-xs mt-1">固定权重 · 随时赎回</p>
        </button>
        <button
          onClick={() => setStakeType('B')}
          className={`p-4 rounded-xl border-2 transition-all ${
            stakeType === 'B'
              ? 'border-brand-primary bg-brand-primary/10'
              : 'border-border-primary bg-bg-secondary hover:border-brand-primary/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-brand-primary" />
            <span className="text-white font-semibold">代币质押</span>
          </div>
          <p className="text-brand-primary text-2xl font-bold">最高 3.0x</p>
          <p className="text-text-tertiary text-xs mt-1">锁定期 · 高收益</p>
        </button>
      </div>

      {/* ========== 质押表单 ========== */}
      <Card>
        <CardContent className="p-4 lg:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">新建质押</h3>
            <span className="text-text-tertiary text-sm">
              可用: {stakeType === 'A'
                ? `${parseFloat(pointsBalance).toLocaleString()} 积分`
                : `${parseFloat(tokenBalance).toLocaleString()} QFI`
              }
            </span>
          </div>

          {/* 金额输入 */}
          <div className="relative">
            <Input
              type="number"
              placeholder="输入质押金额"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="pr-16"
            />
            <button
              onClick={() => setStakeAmount(stakeType === 'A' ? pointsBalance : tokenBalance)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary text-sm font-medium hover:text-brand-secondary"
            >
              全部
            </button>
          </div>

          {/* 锁定期选择（仅代币质押） */}
          {stakeType === 'B' && (
            <div>
              <p className="text-text-secondary text-sm mb-3">选择锁定期</p>
              <div className="grid grid-cols-4 gap-2">
                {LOCK_PERIODS.map((period) => (
                  <button
                    key={period.days}
                    onClick={() => setLockDays(period.days)}
                    className={`p-3 rounded-xl border transition-all text-center ${
                      lockDays === period.days
                        ? 'border-brand-primary bg-brand-primary/10'
                        : 'border-border-primary bg-bg-tertiary hover:border-brand-primary/50'
                    }`}
                  >
                    <p className="text-white font-semibold text-sm">{period.days}天</p>
                    <p className="text-brand-primary font-bold">{period.weight}x</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 权重预览 - veToken 模型，不展示预计收益（分红取决于平台收入） */}
          {stakeAmount && parseFloat(stakeAmount) > 0 && (
            <div className="bg-bg-tertiary/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-primary" />
                <span className="text-white font-medium">获得权重</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-text-tertiary text-xs mb-1">权重乘数</p>
                  <p className="text-brand-primary text-xl font-bold">
                    {getWeight(stakeType, lockDays).toFixed(1)}x
                  </p>
                </div>
                <div>
                  <p className="text-text-tertiary text-xs mb-1">获得 veQFI</p>
                  <p className="text-success text-xl font-bold">
                    {calculateVeToken(parseFloat(stakeAmount), getWeight(stakeType, lockDays))}
                  </p>
                </div>
              </div>
              <p className="text-text-tertiary text-xs pt-2 border-t border-border-secondary">
                veQFI 权重决定你的分红比例，分红来自平台收入的回购奖励池
              </p>
            </div>
          )}

          {/* 风险提示 - 根据项目需求 3.3 */}
          <div className={`p-3 rounded-xl flex items-start gap-2 ${
            stakeType === 'A' ? 'bg-danger/10 border border-danger/30' : 'bg-warning/10 border border-warning/30'
          }`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
              stakeType === 'A' ? 'text-danger' : 'text-warning'
            }`} />
            <div>
              <p className={`text-sm font-medium ${stakeType === 'A' ? 'text-danger' : 'text-warning'}`}>
                {stakeType === 'A' ? '解押惩罚提示' : '提前解押提示'}
              </p>
              <p className="text-text-secondary text-xs mt-1">
                {stakeType === 'A'
                  ? '积分质押解押将扣除 50% 本金作为惩罚（销毁）'
                  : `代币质押需锁定 ${lockDays} 天。提前解押：不扣本金，仅扣除累计收益 + 3% 手续费`
                }
              </p>
            </div>
          </div>

          {/* 确认按钮 */}
          <Button
            variant="primary"
            className="w-full h-12 text-base"
            onClick={handleStake}
            isLoading={staking}
            disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
          >
            {staking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                质押中...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                确认质押
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ========== 质押中订单 ========== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">
            质押中 ({activeStakes.length}笔)
          </h3>
        </div>

        {activeStakes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-bg-tertiary rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-text-tertiary" />
              </div>
              <h4 className="text-white font-medium mb-2">暂无质押中订单</h4>
              <p className="text-text-secondary text-sm">
                开始质押，获得分红权重
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeStakes.map((stake) => {
              const isUnlocked = canUnstake(stake);
              const progress = getUnlockProgress(stake);
              const remaining = getRemainingDays(stake);

              return (
                <Card key={stake.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* 头部 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
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
                            {stake.stake_type === 'A' ? '积分质押' : '代币质押'}
                          </p>
                          <p className="text-text-tertiary text-xs">
                            权重 {parseFloat(stake.weight).toFixed(1)}x · veQFI {(parseFloat(stake.amount) * parseFloat(stake.weight)).toFixed(0)}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isUnlocked
                          ? 'bg-success/20 text-success'
                          : 'bg-warning/20 text-warning'
                      }`}>
                        {isUnlocked ? '可赎回' : '锁定中'}
                      </span>
                    </div>

                    {/* 数据行 */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-text-tertiary text-xs">质押金额</p>
                        <p className="text-white font-semibold">
                          {formatCurrency(stake.amount)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-tertiary text-xs">累计分红</p>
                        <p className="text-success font-semibold">
                          +${parseFloat(stake.accumulated_reward).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* 进度条（B类锁定中） */}
                    {stake.stake_type === 'B' && !isUnlocked && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-text-tertiary">
                            <Clock className="w-3 h-3 inline mr-1" />
                            剩余 {remaining} 天
                          </span>
                          <span className="text-text-secondary">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleUnstake(stake)}
                      disabled={unstaking === stake.id}
                    >
                      {unstaking === stake.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          赎回中...
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4 mr-2" />
                          申请赎回
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== 历史记录 ========== */}
      {stakes.filter(s => s.status !== 'active').length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">
              历史记录 ({stakes.filter(s => s.status !== 'active').length}笔)
            </h3>
          </div>

          <div className="space-y-3">
            {stakes.filter(s => s.status !== 'active').map((stake) => (
              <Card key={stake.id} className="overflow-hidden opacity-70">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        stake.stake_type === 'A' ? 'bg-warning/10' : 'bg-brand-primary/10'
                      }`}>
                        {stake.stake_type === 'A' ? (
                          <Sparkles className="w-5 h-5 text-warning/60" />
                        ) : (
                          <Coins className="w-5 h-5 text-brand-primary/60" />
                        )}
                      </div>
                      <div>
                        <p className="text-text-secondary font-medium">
                          {stake.stake_type === 'A' ? '积分质押' : '代币质押'}
                        </p>
                        <p className="text-text-tertiary text-xs">
                          {formatCurrency(stake.amount)} · 权重 {parseFloat(stake.weight).toFixed(1)}x
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2 py-1 rounded-full bg-bg-tertiary text-text-secondary">
                        已赎回
                      </span>
                      <p className="text-success text-xs mt-1">
                        累计分红 +${parseFloat(stake.accumulated_reward).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
            <div className="bg-bg-tertiary/50 rounded-xl p-4 space-y-3">
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
                <span className="text-text-secondary">累计分红</span>
                <span className="text-success font-medium">
                  +${parseFloat(unstakeDialog.stake.accumulated_reward).toFixed(2)}
                </span>
              </div>
            </div>

            {/* 惩罚/手续费说明 - 根据项目需求 3.3 */}
            <div className={`p-4 rounded-xl ${
              unstakeDialog.stake.stake_type === 'A'
                ? 'bg-danger/10 border border-danger/30'
                : 'bg-warning/10 border border-warning/30'
            }`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                  unstakeDialog.stake.stake_type === 'A' ? 'text-danger' : 'text-warning'
                }`} />
                <div>
                  <p className={`font-medium ${
                    unstakeDialog.stake.stake_type === 'A' ? 'text-danger' : 'text-warning'
                  }`}>
                    {unstakeDialog.stake.stake_type === 'A' ? '解押惩罚' : '提前解押扣除'}
                  </p>
                  <p className="text-text-secondary text-sm mt-1">
                    {unstakeDialog.stake.stake_type === 'A'
                      ? `扣除 50% 本金（${(parseFloat(unstakeDialog.stake.amount) * 0.5).toFixed(2)} 积分将被销毁）`
                      : `不扣本金，扣除累计收益 $${parseFloat(unstakeDialog.stake.accumulated_reward).toFixed(2)} + 3% 手续费 ${(parseFloat(unstakeDialog.stake.amount) * 0.03).toFixed(2)} QFI`
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-bg-tertiary/50 rounded-xl p-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">预计返还本金</span>
                <span className="text-white font-bold text-lg">
                  {unstakeDialog.stake.stake_type === 'A'
                    ? `${(parseFloat(unstakeDialog.stake.amount) * 0.5).toFixed(2)} 积分`
                    : `${(parseFloat(unstakeDialog.stake.amount) - parseFloat(unstakeDialog.stake.amount) * 0.03).toFixed(2)} QFI`
                  }
                </span>
              </div>
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
