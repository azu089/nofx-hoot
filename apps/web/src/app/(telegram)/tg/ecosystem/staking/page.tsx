'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Lock,
  Unlock,
  TrendingUp,
  Clock,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';

interface StakingPool {
  id: string;
  name: string;
  type: 'A' | 'B';
  apy: string;
  minAmount: string;
  lockDays: number;
  totalStaked: string;
  userStaked: string;
  rewards: string;
}

export default function TgStakingPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [loading, setLoading] = useState(true);
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPools();
  }, []);

  const fetchPools = async () => {
    try {
      // 模拟数据
      const mockPools: StakingPool[] = [
        {
          id: '1',
          name: '灵活质押',
          type: 'A',
          apy: '8.5',
          minAmount: '100',
          lockDays: 0,
          totalStaked: '1250000',
          userStaked: '0',
          rewards: '0',
        },
        {
          id: '2',
          name: '30天定期',
          type: 'B',
          apy: '12.0',
          minAmount: '500',
          lockDays: 30,
          totalStaked: '850000',
          userStaked: '1000',
          rewards: '25.50',
        },
        {
          id: '3',
          name: '90天定期',
          type: 'B',
          apy: '18.0',
          minAmount: '1000',
          lockDays: 90,
          totalStaked: '620000',
          userStaked: '0',
          rewards: '0',
        },
        {
          id: '4',
          name: '180天定期',
          type: 'B',
          apy: '25.0',
          minAmount: '2000',
          lockDays: 180,
          totalStaked: '380000',
          userStaked: '0',
          rewards: '0',
        },
      ];
      setPools(mockPools);
    } catch (error) {
      console.error('获取质押池失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!selectedPool || !stakeAmount) return;

    setSubmitting(true);
    haptic('impact_medium');

    try {
      // 模拟质押
      await new Promise(resolve => setTimeout(resolve, 1500));
      haptic('notification_success');
      setSelectedPool(null);
      setStakeAmount('');
      fetchPools();
    } catch (error) {
      console.error('质押失败:', error);
      haptic('notification_error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  const totalStaked = pools.reduce((sum, p) => sum + parseFloat(p.userStaked), 0);
  const totalRewards = pools.reduce((sum, p) => sum + parseFloat(p.rewards), 0);

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
            <p className="text-xs text-text-tertiary mb-1">我的质押</p>
            <p className="text-xl font-bold text-white">
              {totalStaked.toFixed(2)} <span className="text-sm font-normal">QFI</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-1">累计收益</p>
            <p className="text-xl font-bold text-success">
              +{totalRewards.toFixed(2)} <span className="text-sm font-normal">QFI</span>
            </p>
          </div>
        </div>
      </div>

      {/* 质押类型说明 */}
      <div className="flex items-start gap-2 p-3 bg-bg-secondary border border-border-primary rounded-xl">
        <Info className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
        <div className="text-xs text-text-secondary">
          <p><span className="text-brand-primary">A类质押</span>：灵活存取，随时赎回</p>
          <p><span className="text-success">B类质押</span>：定期锁定，收益更高</p>
        </div>
      </div>

      {/* 质押池列表 */}
      <div className="space-y-3">
        {pools.map((pool) => {
          const hasStaked = parseFloat(pool.userStaked) > 0;

          return (
            <div
              key={pool.id}
              className="bg-bg-secondary border border-border-primary rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    pool.type === 'A' ? 'bg-brand-primary/10' : 'bg-success/10'
                  }`}>
                    {pool.lockDays > 0 ? (
                      <Lock size={16} className="text-success" />
                    ) : (
                      <Unlock size={16} className="text-brand-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">{pool.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {pool.lockDays > 0 ? `锁定 ${pool.lockDays} 天` : '随时赎回'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-success">{pool.apy}%</p>
                  <p className="text-xs text-text-tertiary">APY</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 bg-bg-tertiary rounded-lg px-2 mb-3">
                <div className="text-center">
                  <p className="text-sm font-medium text-white">
                    {(parseFloat(pool.totalStaked) / 1000).toFixed(0)}K
                  </p>
                  <p className="text-[10px] text-text-tertiary">总质押</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">{pool.minAmount}</p>
                  <p className="text-[10px] text-text-tertiary">最低</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-brand-primary">
                    {parseFloat(pool.userStaked).toFixed(0)}
                  </p>
                  <p className="text-[10px] text-text-tertiary">我的</p>
                </div>
              </div>

              {hasStaked && (
                <div className="flex items-center justify-between p-2 bg-success/10 rounded-lg mb-3">
                  <span className="text-xs text-text-secondary">待领取收益</span>
                  <span className="text-sm font-medium text-success">+{pool.rewards} QFI</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => { setSelectedPool(pool); haptic('selection'); }}
                >
                  质押
                </Button>
                {hasStaked && (
                  <Button size="sm" variant="outline" className="flex-1">
                    赎回
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 质押弹窗 */}
      {selectedPool && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setSelectedPool(null)}
        >
          <div
            className="w-full bg-bg-secondary rounded-t-2xl p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-bg-tertiary rounded-full mx-auto mb-4" />

            <h3 className="text-lg font-medium text-white mb-4">
              质押到 {selectedPool.name}
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-text-tertiary mb-2">
                  <span>质押数量</span>
                  <span>最低 {selectedPool.minAmount} QFI</span>
                </div>
                <Input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="输入质押数量"
                  className="text-lg"
                />
              </div>

              <div className="p-3 bg-bg-tertiary rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">预计年化收益</span>
                  <span className="text-success">{selectedPool.apy}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">锁定期</span>
                  <span className="text-white">
                    {selectedPool.lockDays > 0 ? `${selectedPool.lockDays} 天` : '无锁定'}
                  </span>
                </div>
                {stakeAmount && (
                  <div className="flex justify-between text-sm pt-2 border-t border-border-primary">
                    <span className="text-text-tertiary">预计日收益</span>
                    <span className="text-success">
                      +{(parseFloat(stakeAmount) * parseFloat(selectedPool.apy) / 100 / 365).toFixed(4)} QFI
                    </span>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleStake}
                disabled={submitting || !stakeAmount || parseFloat(stakeAmount) < parseFloat(selectedPool.minAmount)}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                确认质押
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
