'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Lock,
  Coins,
  Sparkles,
  AlertCircle,
  Loader2,
  Info,
  ChevronRight,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { gamefiApi, userApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

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

export default function TgStakingPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();

  // ========== 状态 ==========
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [pointsBalance, setPointsBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [loading, setLoading] = useState(true);

  const [stakeType, setStakeType] = useState<'A' | 'B'>('B');
  const [stakeAmount, setStakeAmount] = useState('');
  const [lockDays, setLockDays] = useState(30);
  const [staking, setStaking] = useState(false);

  const [unstakeDialog, setUnstakeDialog] = useState<{
    open: boolean;
    stake: Stake | null;
  }>({ open: false, stake: null });
  const [unstaking, setUnstaking] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ========== 计算函数 ==========
  const getWeight = (days: number) => {
    const period = LOCK_PERIODS.find(p => p.days === days);
    return period?.weight || 1.2;
  };

  const getNormalizedWeight = (type: string, amount: string, days: number) => {
    const amountNum = parseFloat(amount) || 0;
    const weight = getWeight(days);
    const normalized = type === 'A' ? amountNum / 1000 : amountNum;
    return normalized * weight;
  };

  const isMatured = (stake: Stake) => new Date(stake.unlocks_at) <= new Date();

  const getRemainingDays = (stake: Stake) => {
    const end = new Date(stake.unlocks_at).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  };

  // ========== 操作函数 ==========
  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      haptic('notification_error');
      return;
    }

    const availableBalance = stakeType === 'A' ? pointsBalance : tokenBalance;
    if (parseFloat(stakeAmount) > parseFloat(availableBalance)) {
      haptic('notification_error');
      return;
    }

    setStaking(true);
    haptic('impact_medium');

    try {
      await gamefiApi.stake({
        type: stakeType,
        amount: stakeAmount,
        lockDays: lockDays,
      });
      setStakeAmount('');
      fetchData();
      haptic('notification_success');
    } catch (error) {
      console.error('质押失败:', error);
      haptic('notification_error');
    } finally {
      setStaking(false);
    }
  };

  const confirmUnstake = async () => {
    if (!unstakeDialog.stake) return;

    setUnstaking(true);
    haptic('impact_medium');

    try {
      await gamefiApi.unstake(unstakeDialog.stake.id);
      setUnstakeDialog({ open: false, stake: null });
      fetchData();
      haptic('notification_success');
    } catch (error) {
      console.error('解押失败:', error);
      haptic('notification_error');
    } finally {
      setUnstaking(false);
    }
  };

  // ========== 统计数据 ==========
  const activeStakes = stakes.filter((s) => s.status === 'active');
  const totalWeight = activeStakes.reduce(
    (sum, s) => sum + getNormalizedWeight(s.stake_type, s.amount, s.lock_days),
    0
  );
  const totalClaimable = activeStakes.reduce(
    (sum, s) => sum + parseFloat(s.claimable_reward || '0'),
    0
  );

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
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        <div className="h-48 bg-bg-tertiary/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <button
        onClick={() => { haptic('selection'); router.back(); }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">质押挖矿</span>
      </button>

      {/* 质押概览 */}
      <div className="bg-gradient-to-r from-brand-primary/20 to-success/20 border border-brand-primary/30 rounded-xl p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-tertiary mb-1">总权重</p>
            <p className="text-xl font-bold text-white">
              {totalWeight.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-1">待释放代币</p>
            <p className="text-xl font-bold text-warning">
              {parseFloat(totalVesting).toLocaleString()} QFI
            </p>
          </div>
        </div>
      </div>

      {/* 权重计算说明 */}
      <div className="p-3 bg-bg-secondary border border-border-primary rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-brand-primary flex-shrink-0" />
          <span className="text-sm font-medium text-white">统一权重模型</span>
        </div>
        <div className="text-xs text-text-secondary space-y-1.5">
          <p>• 1000 积分 = 1 QFI 的基础权重</p>
          <p>• 积分和代币质押使用<span className="text-brand-primary">相同锁定期倍数</span></p>
          <div className="flex gap-2 mt-2 text-[10px]">
            {LOCK_PERIODS.map(p => (
              <span key={p.days} className="bg-bg-tertiary px-2 py-1 rounded">
                {p.days}天={p.weight}x
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 质押类型选择 */}
      <div className="flex bg-bg-secondary rounded-xl p-1">
        <button
          onClick={() => { setStakeType('B'); haptic('selection'); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            stakeType === 'B'
              ? 'bg-brand-primary text-white'
              : 'text-text-secondary'
          }`}
        >
          代币质押
        </button>
        <button
          onClick={() => { setStakeType('A'); haptic('selection'); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            stakeType === 'A'
              ? 'bg-brand-primary text-white'
              : 'text-text-secondary'
          }`}
        >
          积分质押
        </button>
      </div>

      {/* 质押表单 */}
      <div className="space-y-3">
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
              className="flex-1 text-lg bg-transparent border-none p-0 h-auto font-semibold"
            />
            <button
              onClick={() => {
                setStakeAmount(stakeType === 'A' ? pointsBalance : tokenBalance);
                haptic('selection');
              }}
              className="text-brand-primary text-sm font-medium px-3 py-1.5 bg-brand-primary/10 rounded-lg"
            >
              全部
            </button>
          </div>
        </div>

        {/* 锁定期选择 */}
        <div className="bg-bg-secondary rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-text-tertiary text-sm">锁定期</span>
            {stakeType === 'A' && (
              <span className="text-success text-xs">
                到期惩罚 {LOCK_PERIODS.find(p => p.days === lockDays)?.penalty.mature}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {LOCK_PERIODS.map((period) => (
              <button
                key={period.days}
                onClick={() => { setLockDays(period.days); haptic('selection'); }}
                className={`py-2 rounded-lg text-center transition-all ${
                  lockDays === period.days
                    ? 'bg-brand-primary text-white'
                    : 'bg-bg-tertiary text-text-secondary'
                }`}
              >
                <p className="text-xs">{period.days}天</p>
                <p className="font-semibold text-sm">{period.weight}x</p>
              </button>
            ))}
          </div>
        </div>

        {/* 权重预览 */}
        {stakeAmount && parseFloat(stakeAmount) > 0 && (
          <div className="bg-bg-secondary rounded-xl p-4 flex justify-between items-center">
            <span className="text-text-secondary text-sm">获得权重</span>
            <span className="text-brand-primary font-bold text-lg">
              +{getNormalizedWeight(stakeType, stakeAmount, lockDays).toFixed(2)}
            </span>
          </div>
        )}

        {/* 风险提示 */}
        <div className={`rounded-xl p-3 ${
          stakeType === 'A' ? 'bg-warning/10' : 'bg-brand-primary/10'
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-4 h-4 flex-shrink-0 ${
              stakeType === 'A' ? 'text-warning' : 'text-brand-primary'
            }`} />
            <span className="text-text-secondary text-xs">
              {stakeType === 'A'
                ? `提前解押惩罚${LOCK_PERIODS.find(p => p.days === lockDays)?.penalty.early}%，到期惩罚${LOCK_PERIODS.find(p => p.days === lockDays)?.penalty.mature}%`
                : '解押扣除 3% 手续费'
              }
            </span>
          </div>
        </div>

        {/* 确认按钮 */}
        <Button
          className="w-full h-12"
          onClick={handleStake}
          disabled={staking || !stakeAmount || parseFloat(stakeAmount) <= 0}
        >
          {staking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          确认质押
        </Button>
      </div>

      {/* 我的质押记录 */}
      {activeStakes.length > 0 && (
        <div className="mt-4">
          <p className="text-white font-medium mb-3">我的质押</p>
          <div className="space-y-2">
            {activeStakes.map((stake) => {
              const matured = isMatured(stake);
              const remaining = getRemainingDays(stake);

              return (
                <div
                  key={stake.id}
                  className="bg-bg-secondary rounded-xl p-3 flex items-center justify-between"
                  onClick={() => {
                    setUnstakeDialog({ open: true, stake });
                    haptic('selection');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      stake.stake_type === 'A' ? 'bg-warning/20' : 'bg-brand-primary/20'
                    }`}>
                      {stake.stake_type === 'A' ? (
                        <Sparkles className="w-4 h-4 text-warning" />
                      ) : (
                        <Coins className="w-4 h-4 text-brand-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {formatCurrency(stake.amount)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                      </p>
                      <p className="text-text-tertiary text-xs">
                        {stake.lock_days}天 · {matured ? (
                          <span className="text-success">已到期</span>
                        ) : (
                          `剩余${remaining}天`
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-tertiary" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== 分红记录模块 ========== */}
      {(parseFloat(totalVesting) > 0 || parseFloat(totalReleased) > 0 || vestingOrders.length > 0) && (
        <div className="mt-4">
          <p className="text-white font-medium mb-3">分红记录</p>

          {/* 分红订单列表 - 显示每周分红明细 */}
          {vestingOrders.length > 0 ? (
            <div className="space-y-2">
              {vestingOrders.map((order) => {
                const daysRemaining = Math.ceil(
                  (new Date(order.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isCompleted = order.progress >= 100;
                const isDividend = order.orderType === 'dividend';

                // 分红订单：QFI 是 30%，反推 USDT 部分（70%）
                const qfiPrice = 0.5;
                const qfiAmount = parseFloat(order.totalAmount);
                const usdtAmount = isDividend ? (qfiAmount * qfiPrice / 0.3 * 0.7) : 0;

                return (
                  <div
                    key={order.id}
                    className="bg-bg-secondary border border-border-primary rounded-xl p-3"
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

                    {/* 分红明细：周分红显示 USDT + QFI */}
                    {isDividend ? (
                      <>
                        {/* 分红双列：USDT 已到账 + QFI 释放中 */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="bg-success/10 rounded-lg p-2">
                            <p className="text-success font-bold text-sm">
                              ${usdtAmount.toFixed(2)}
                            </p>
                            <p className="text-text-tertiary text-[10px]">USDT 已到账</p>
                          </div>
                          <div className="bg-brand-primary/10 rounded-lg p-2">
                            <p className="text-brand-primary font-bold text-sm">
                              {qfiAmount.toFixed(2)} QFI
                            </p>
                            <p className="text-text-tertiary text-[10px]">代币释放中</p>
                          </div>
                        </div>
                        {/* QFI 释放进度 */}
                        <div className="bg-bg-tertiary/50 rounded-lg p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-text-tertiary text-xs">释放进度</span>
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
                          {!isCompleted && daysRemaining > 0 && (
                            <p className="text-text-tertiary text-[10px] mt-1 text-right">
                              剩余 {daysRemaining} 天
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* 积分兑换订单 */}
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
                        <div className="w-full bg-bg-tertiary rounded-full h-1.5 mb-2">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              isCompleted ? 'bg-success' : 'bg-brand-primary'
                            }`}
                            style={{ width: `${order.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-text-tertiary">
                          <span>每日 {parseFloat(order.dailyRelease).toFixed(4)} QFI</span>
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
            <div className="py-8 text-center">
              <p className="text-text-tertiary text-sm">暂无分红记录</p>
            </div>
          )}
        </div>
      )}

      {/* 解押确认弹窗 */}
      {unstakeDialog.open && unstakeDialog.stake && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setUnstakeDialog({ open: false, stake: null })}
        >
          <div
            className="w-full bg-bg-secondary rounded-t-2xl p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-bg-tertiary rounded-full mx-auto mb-4" />

            <h3 className="text-lg font-medium text-white mb-4">确认解押</h3>

            {(() => {
              const stake = unstakeDialog.stake!;
              const matured = isMatured(stake);
              const period = LOCK_PERIODS.find(p => p.days === stake.lock_days);
              const amount = parseFloat(stake.amount);

              let penaltyRate: number;
              let penaltyAmount: number;
              let returnAmount: number;

              if (stake.stake_type === 'A') {
                penaltyRate = matured ? (period?.penalty.mature || 10) : (period?.penalty.early || 40);
                penaltyAmount = amount * penaltyRate / 100;
                returnAmount = amount - penaltyAmount;
              } else {
                penaltyRate = 3;
                penaltyAmount = amount * 0.03;
                returnAmount = amount * 0.97;
              }

              return (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-border-primary">
                      <span className="text-text-secondary text-sm">质押金额</span>
                      <span className="text-white font-medium">
                        {formatCurrency(stake.amount)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border-primary">
                      <span className="text-text-secondary text-sm">锁定状态</span>
                      <span className={matured ? 'text-success' : 'text-warning'}>
                        {matured ? '已到期' : `剩余 ${getRemainingDays(stake)} 天`}
                      </span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl ${
                    stake.stake_type === 'A' ? 'bg-warning/10' : 'bg-brand-primary/10'
                  }`}>
                    <p className={`text-sm ${
                      stake.stake_type === 'A' ? 'text-warning' : 'text-brand-primary'
                    }`}>
                      惩罚 {penaltyRate}%：{penaltyAmount.toFixed(2)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                    </p>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">预计返还</span>
                    <span className="text-white font-bold text-xl">
                      {returnAmount.toFixed(2)} {stake.stake_type === 'A' ? '积分' : 'QFI'}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        setUnstakeDialog({ open: false, stake: null });
                        haptic('selection');
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={confirmUnstake}
                      disabled={unstaking}
                    >
                      {unstaking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      确认解押
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
