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
  TrendingUp,
  Calendar,
  CheckCircle,
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

interface VestingOrder {
  id: string;
  totalAmount: string;
  releasedAmount: string;
  remainingAmount: string;
  startDate: string;
  endDate: string;
  dailyRelease: string;
  progress: number;
  orderType: 'exchange' | 'dividend';
  sourceType?: string;
}

// ========== 常量配置 ==========
// 锁定期权重倍数表（积分和代币质押通用）
const LOCK_PERIODS = [
  { days: 30, weight: 1.2, penalty: { early: 40, mature: 10 } },
  { days: 90, weight: 1.5, penalty: { early: 30, mature: 5 } },
  { days: 180, weight: 2.0, penalty: { early: 20, mature: 2 } },
  { days: 365, weight: 3.0, penalty: { early: 10, mature: 0 } },
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

  // 释放进度相关状态
  const [vestingOrders, setVestingOrders] = useState<VestingOrder[]>([]);
  const [totalVesting, setTotalVesting] = useState('0');
  const [totalReleased, setTotalReleased] = useState('0');

  // ========== 数据获取 ==========
  const fetchData = async () => {
    try {
      const [stakesRes, walletRes, vestingRes] = await Promise.all([
        gamefiApi.getStakes(),
        userApi.getWallet(),
        gamefiApi.getVestingProgress(),
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

      // 设置释放进度数据
      setTotalVesting(vestingRes.data?.pending || '0');
      setTotalReleased(vestingRes.data?.released || '0');
      const orders = (vestingRes.data?.vestingOrders || []).map((order: any) => ({
        id: order.orderId,
        totalAmount: order.tokensTotal,
        releasedAmount: order.tokensReleased,
        remainingAmount: order.tokensPending,
        startDate: order.vestingStartAt,
        endDate: order.vestingEndAt,
        dailyRelease: (parseFloat(order.tokensTotal) / 90).toFixed(8),
        progress: order.progress,
        orderType: order.orderType || 'exchange',
        sourceType: order.sourceType,
      }));
      setVestingOrders(orders);
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
  // 统一权重计算：积分和代币质押使用相同的锁定期倍数
  const getWeight = (type: string, days: number) => {
    const period = LOCK_PERIODS.find(p => p.days === days);
    return period?.weight || 1.2;
  };

  // 计算归一化权重（1000 积分 = 1 QFI）
  const getNormalizedWeight = (type: string, amount: string, days: number) => {
    const amountNum = parseFloat(amount) || 0;
    const weight = getWeight(type, days);
    // A 类：积分 / 1000；B 类：直接使用代币数量
    const normalized = type === 'A' ? amountNum / 1000 : amountNum;
    return normalized * weight;
  };

  // 获取当前惩罚率预览
  const getPenaltyInfo = (stake: Stake) => {
    if (stake.stake_type === 'B') {
      return { rate: 3, text: '3% 手续费' };
    }
    // 积分质押：使用后端返回的惩罚预览或计算默认值
    if (stake.early_penalty) {
      const penalty = parseFloat(stake.early_penalty);
      const rate = (penalty / parseFloat(stake.amount)) * 100;
      return { rate, text: `${rate.toFixed(1)}%` };
    }
    // 默认按锁定期查表
    const period = LOCK_PERIODS.find(p => p.days === stake.lock_days);
    return { rate: period?.penalty.early || 40, text: `${period?.penalty.early || 40}%` };
  };

  // 判断是否可解押（现在积分质押也有锁定期）
  const canUnstake = (stake: Stake) => {
    // 所有类型都可以解押，只是惩罚不同
    return true;
  };

  // 判断是否已到期
  const isMatured = (stake: Stake) => {
    return new Date(stake.unlocks_at) <= new Date();
  };

  const getUnlockProgress = (stake: Stake) => {
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
        lockDays: lockDays, // 积分和代币质押都需要锁定期
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

  // 释放进度统计
  const vestingProgress = () => {
    const vesting = parseFloat(totalVesting);
    const released = parseFloat(totalReleased);
    if (vesting === 0 && released === 0) return 0;
    return Math.round((released / (vesting + released)) * 100);
  };
  const dailyReleaseTotal = vestingOrders.reduce((sum, order) => sum + parseFloat(order.dailyRelease), 0);

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
              <p className="text-text-tertiary text-xs mb-1">待释放代币</p>
              <p className="text-lg font-bold font-mono text-warning">{parseFloat(totalVesting).toLocaleString()} QFI</p>
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
            代币质押 · QFI
          </button>
          <button
            onClick={() => setStakeType('A')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              stakeType === 'A'
                ? 'bg-brand-primary text-white'
                : 'text-text-secondary'
            }`}
          >
            积分质押 · 1000:1
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

        {/* 锁定期选择（积分和代币质押通用） */}
        <div className="bg-bg-secondary rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-text-tertiary text-sm">锁定期</span>
            {stakeType === 'A' && (
              <span className="text-text-tertiary text-xs">
                到期惩罚 {LOCK_PERIODS.find(p => p.days === lockDays)?.penalty.mature || 10}%
              </span>
            )}
          </div>
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
                {stakeType === 'A' && (
                  <p className="text-[10px] text-success/80 mt-0.5">
                    到期{period.penalty.mature}%
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 权重预览 */}
        {stakeAmount && parseFloat(stakeAmount) > 0 && (
          <div className="bg-bg-secondary rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary text-sm">获得权重</span>
              <span className="text-brand-primary font-bold text-lg">
                +{getNormalizedWeight(stakeType, stakeAmount, lockDays).toFixed(2)}
              </span>
            </div>
            {stakeType === 'A' && (
              <p className="text-text-tertiary text-xs mt-2">
                {parseFloat(stakeAmount).toLocaleString()} 积分 ÷ 1000 × {getWeight(stakeType, lockDays)}x = {getNormalizedWeight(stakeType, stakeAmount, lockDays).toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* 风险提示 */}
        <div className={`rounded-xl p-3 ${
          stakeType === 'A' ? 'bg-warning/10' : 'bg-brand-primary/10'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
              stakeType === 'A' ? 'text-warning' : 'text-brand-primary'
            }`} />
            <span className="text-text-secondary text-xs font-medium">解押规则</span>
          </div>
          {stakeType === 'A' ? (
            <div className="text-text-tertiary text-xs space-y-1 ml-6">
              <p>• 提前解押：惩罚 {LOCK_PERIODS.find(p => p.days === lockDays)?.penalty.early || 40}%</p>
              <p>• 到期解押：惩罚 {LOCK_PERIODS.find(p => p.days === lockDays)?.penalty.mature || 10}%</p>
              <p className="text-success">• 365 天锁定到期免惩罚</p>
            </div>
          ) : (
            <p className="text-text-tertiary text-xs ml-6">
              锁定 {lockDays} 天，解押扣除 3% 手续费
            </p>
          )}
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
              const matured = isMatured(stake);
              const remaining = getRemainingDays(stake);

              return (
                <div
                  key={stake.id}
                  className="bg-bg-secondary px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
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
                        {parseFloat(stake.weight).toFixed(1)}x · {stake.lock_days}天 ·
                        {matured
                          ? <span className="text-success"> 已到期</span>
                          : ` 剩余 ${remaining} 天`
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

      {/* ========== 分红记录模块 ========== */}
      <div className="mt-6">
        <div className="px-4 flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">分红记录</h3>
          <span className="text-text-tertiary text-sm">{vestingOrders.length} 笔</span>
        </div>

        {/* 分红订单列表 - 显示每周分红明细 */}
        {vestingOrders.length > 0 ? (
            <div className="space-y-px">
              {vestingOrders.map((order) => {
                const daysRemaining = Math.ceil(
                  (new Date(order.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isCompleted = order.progress >= 100;
                const isDividend = order.orderType === 'dividend';

                // 分红订单：QFI 是 30%，反推 USDT 部分（70%）
                // USDT = QFI数量 × QFI价格 / 0.3 × 0.7
                // 假设 QFI 价格 $0.50
                const qfiPrice = 0.5;
                const qfiAmount = parseFloat(order.totalAmount);
                const usdtAmount = isDividend ? (qfiAmount * qfiPrice / 0.3 * 0.7) : 0;

                return (
                  <div
                    key={order.id}
                    className="bg-bg-secondary px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">
                          #{order.id.slice(0, 8)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isDividend
                              ? 'bg-brand-primary/20 text-brand-primary'
                              : 'bg-bg-tertiary text-text-secondary'
                          }`}
                        >
                          {isDividend ? '周分红' : '积分兑换'}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isCompleted
                            ? 'bg-success/20 text-success'
                            : 'bg-brand-primary/20 text-brand-primary'
                        }`}
                      >
                        {isCompleted ? '已完成' : '释放中'}
                      </span>
                    </div>

                    {/* 分红明细：周分红显示 USDT(已到账) + QFI(释放中) */}
                    {isDividend ? (
                      <>
                        {/* 分红双列：USDT 已到账 + QFI 释放中 */}
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div className="bg-success/10 rounded-lg p-2">
                            <p className="text-success font-bold text-base">
                              ${usdtAmount.toFixed(2)}
                            </p>
                            <p className="text-text-tertiary text-[10px]">USDT 已到账 (70%)</p>
                          </div>
                          <div className="bg-brand-primary/10 rounded-lg p-2">
                            <p className="text-brand-primary font-bold text-base">
                              {qfiAmount.toFixed(2)} QFI
                            </p>
                            <p className="text-text-tertiary text-[10px]">代币释放中 (30%)</p>
                          </div>
                        </div>
                        {/* QFI 释放进度 */}
                        <div className="bg-bg-tertiary/50 rounded-lg p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-text-tertiary text-xs">代币释放进度</span>
                            <span className="text-brand-primary text-xs font-medium">{order.progress}%</span>
                          </div>
                          <div className="w-full bg-bg-tertiary rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                isCompleted ? 'bg-success' : 'bg-brand-primary'
                              }`}
                              style={{ width: `${order.progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
                            <span>已释放 {parseFloat(order.releasedAmount).toFixed(2)} | 待释放 {parseFloat(order.remainingAmount).toFixed(2)}</span>
                            {!isCompleted && daysRemaining > 0 && (
                              <span>剩余 {daysRemaining} 天</span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* 积分兑换订单：只显示代币释放 */}
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div>
                            <p className="text-white font-semibold text-sm">
                              {parseFloat(order.totalAmount).toFixed(2)}
                            </p>
                            <p className="text-text-tertiary text-[10px]">代币总量</p>
                          </div>
                          <div>
                            <p className="text-success font-semibold text-sm">
                              {parseFloat(order.releasedAmount).toFixed(2)}
                            </p>
                            <p className="text-text-tertiary text-[10px]">已释放</p>
                          </div>
                          <div>
                            <p className="text-warning font-semibold text-sm">
                              {parseFloat(order.remainingAmount).toFixed(2)}
                            </p>
                            <p className="text-text-tertiary text-[10px]">待释放</p>
                          </div>
                        </div>
                        {/* 代币释放进度条 */}
                        <div className="w-full bg-bg-tertiary rounded-full h-1.5 mb-2">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              isCompleted ? 'bg-success' : 'bg-brand-primary'
                            }`}
                            style={{ width: `${order.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-text-tertiary">
                          <span>每日释放 {parseFloat(order.dailyRelease).toFixed(4)} QFI</span>
                          {!isCompleted && daysRemaining > 0 && (
                            <span>剩余 {daysRemaining} 天</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mx-4 py-8 text-center">
              <p className="text-text-tertiary text-sm">暂无分红记录</p>
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
        {unstakeDialog.stake && (() => {
          const stake = unstakeDialog.stake;
          const penaltyInfo = getPenaltyInfo(stake);
          const amount = parseFloat(stake.amount);
          const isMatured = new Date(stake.unlocks_at) <= new Date();
          const period = LOCK_PERIODS.find(p => p.days === stake.lock_days);

          // 计算惩罚和返还金额
          let penaltyAmount: number;
          let returnAmount: number;

          if (stake.stake_type === 'A') {
            // 积分质押：使用后端返回的预览或计算
            if (stake.early_penalty && stake.return_preview) {
              penaltyAmount = parseFloat(stake.early_penalty);
              returnAmount = parseFloat(stake.return_preview);
            } else {
              const rate = isMatured ? (period?.penalty.mature || 10) : (period?.penalty.early || 40);
              penaltyAmount = amount * rate / 100;
              returnAmount = amount - penaltyAmount;
            }
          } else {
            // 代币质押：固定 3%
            penaltyAmount = amount * 0.03;
            returnAmount = amount * 0.97;
          }

          return (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border-primary">
                  <span className="text-text-secondary">质押金额</span>
                  <span className="text-white font-medium">
                    {formatCurrency(stake.amount)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border-primary">
                  <span className="text-text-secondary">锁定期</span>
                  <span className="text-white font-medium">
                    {stake.lock_days} 天 {isMatured ? '(已到期)' : `(剩余 ${getRemainingDays(stake)} 天)`}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border-primary">
                  <span className="text-text-secondary">累计分红</span>
                  <span className="text-success font-medium">
                    +${parseFloat(stake.accumulated_reward).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className={`p-3 rounded-xl ${
                stake.stake_type === 'A' ? 'bg-warning/10' : 'bg-brand-primary/10'
              }`}>
                {stake.stake_type === 'A' ? (
                  <div className="space-y-2">
                    <p className="text-warning text-sm font-medium">
                      {isMatured ? '到期解押' : '提前解押'}惩罚：{penaltyInfo.text}
                    </p>
                    <p className="text-text-tertiary text-xs">
                      惩罚金额：{penaltyAmount.toFixed(2)} 积分（销毁）
                    </p>
                  </div>
                ) : (
                  <p className="text-brand-primary text-sm">
                    扣除 3% 手续费：{penaltyAmount.toFixed(2)} QFI
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-text-secondary">预计返还</span>
                <span className="text-white font-bold text-xl">
                  {returnAmount.toFixed(2)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                </span>
              </div>
            </div>
          );
        })()}
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
