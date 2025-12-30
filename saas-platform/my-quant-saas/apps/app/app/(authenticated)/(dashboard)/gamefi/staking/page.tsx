'use client';

import { useState } from 'react';
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
  TrendingUp,
  Lock,
  Unlock,
  Clock,
  Coins,
  Info,
  CheckCircle,
} from 'lucide-react';

// 质押池配置
const stakingPools = {
  typeA: {
    name: 'A 类质押',
    description: '灵活质押，随时可取',
    minAmount: 100,
    apr: { min: 5, max: 8 },
    lockDays: 0,
    weight: 1.0,
    features: ['随时提取', '日结利息', '无锁定期'],
  },
  typeB: [
    { days: 30, apr: 15, weight: 1.5, bonus: 500 },
    { days: 90, apr: 20, weight: 2.0, bonus: 2000 },
    { days: 180, apr: 25, weight: 2.5, bonus: 5000 },
    { days: 365, apr: 30, weight: 3.0, bonus: 15000 },
  ],
};

// 模拟用户质押数据
const mockStakingData = {
  availableBalance: 10000,
  typeA: {
    staked: 2000,
    earned: 45.67,
  },
  typeB: [
    { id: '1', amount: 1000, days: 90, startDate: '2024-01-01', earnedPoints: 1500 },
    { id: '2', amount: 2000, days: 180, startDate: '2024-01-10', earnedPoints: 2800 },
  ],
};

export default function StakingPage() {
  const [activeTab, setActiveTab] = useState<'typeA' | 'typeB'>('typeA');
  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedDays, setSelectedDays] = useState(30);
  const [staking, setStaking] = useState(false);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      alert('请输入有效金额');
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (amount > mockStakingData.availableBalance) {
      alert('余额不足');
      return;
    }

    if (activeTab === 'typeA' && amount < stakingPools.typeA.minAmount) {
      alert(`最低质押金额为 $${stakingPools.typeA.minAmount}`);
      return;
    }

    setStaking(true);
    // TODO: Implement API call
    setTimeout(() => {
      setStaking(false);
      setStakeAmount('');
      alert('质押成功！');
    }, 1000);
  };

  const handleUnstake = async (id?: string) => {
    if (activeTab === 'typeB' && id) {
      const stake = mockStakingData.typeB.find((s) => s.id === id);
      if (stake) {
        const endDate = new Date(stake.startDate);
        endDate.setDate(endDate.getDate() + stake.days);
        if (new Date() < endDate) {
          alert('锁定期未到，暂无法解除质押');
          return;
        }
      }
    }
    alert('解除质押成功！');
  };

  const selectedPool = stakingPools.typeB.find((p) => p.days === selectedDays);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">质押大厅</h1>
        <p className="text-muted-foreground">质押 USDT 赚取积分和收益</p>
      </div>

      {/* 余额卡片 */}
      <Card className="bg-gradient-to-r from-primary/20 to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">可用余额</p>
              <p className="text-3xl font-bold">${mockStakingData.availableBalance.toLocaleString()}</p>
            </div>
            <Button variant="outline">充值</Button>
          </div>
        </CardContent>
      </Card>

      {/* 质押类型选择 */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('typeA')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'typeA'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Unlock className="w-4 h-4 inline mr-2" />
          A 类灵活质押
        </button>
        <button
          onClick={() => setActiveTab('typeB')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'typeB'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lock className="w-4 h-4 inline mr-2" />
          B 类锁仓质押
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 质押表单 */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === 'typeA' ? 'A 类灵活质押' : 'B 类锁仓质押'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'typeA'
                ? '随时可取，灵活方便'
                : '锁定期越长，收益越高'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTab === 'typeB' && (
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  选择锁定期
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {stakingPools.typeB.map((pool) => (
                    <button
                      key={pool.days}
                      onClick={() => setSelectedDays(pool.days)}
                      className={`p-3 rounded-lg border text-center transition ${
                        selectedDays === pool.days
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium">{pool.days}天</p>
                      <p className="text-sm text-green-500">{pool.apr}% APR</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                质押金额
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="输入质押金额"
                  className="pr-16"
                />
                <button
                  onClick={() => setStakeAmount(mockStakingData.availableBalance.toString())}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-primary"
                >
                  全部
                </button>
              </div>
            </div>

            {/* 预估收益 */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">年化收益率</span>
                <span className="text-green-500 font-medium">
                  {activeTab === 'typeA'
                    ? `${stakingPools.typeA.apr.min}-${stakingPools.typeA.apr.max}%`
                    : `${selectedPool?.apr}%`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">权重倍数</span>
                <span className="font-medium">
                  {activeTab === 'typeA' ? '1.0x' : `${selectedPool?.weight}x`}
                </span>
              </div>
              {activeTab === 'typeB' && selectedPool && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">额外积分奖励</span>
                  <span className="text-yellow-500 font-medium">
                    +{selectedPool.bonus.toLocaleString()} 分
                  </span>
                </div>
              )}
            </div>

            <Button className="w-full" onClick={handleStake} disabled={staking}>
              <TrendingUp className="w-4 h-4 mr-2" />
              {staking ? '质押中...' : '立即质押'}
            </Button>

            {activeTab === 'typeA' && (
              <div className="flex flex-wrap gap-2">
                {stakingPools.typeA.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-2 py-1 bg-primary/10 text-primary text-xs rounded"
                  >
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 我的质押 */}
        <Card>
          <CardHeader>
            <CardTitle>我的质押</CardTitle>
          </CardHeader>
          <CardContent>
            {activeTab === 'typeA' ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">A 类质押中</span>
                    <span className="font-bold text-lg">
                      ${mockStakingData.typeA.staked.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">累计收益</span>
                    <span className="text-green-500 font-medium">
                      +${mockStakingData.typeA.earned}
                    </span>
                  </div>
                </div>
                {mockStakingData.typeA.staked > 0 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleUnstake()}
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    解除质押
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {mockStakingData.typeB.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无锁仓质押</p>
                  </div>
                ) : (
                  mockStakingData.typeB.map((stake) => {
                    const endDate = new Date(stake.startDate);
                    endDate.setDate(endDate.getDate() + stake.days);
                    const isUnlocked = new Date() >= endDate;

                    return (
                      <div
                        key={stake.id}
                        className="p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">
                              ${stake.amount.toLocaleString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {stake.days} 天锁仓
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              isUnlocked
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-yellow-500/20 text-yellow-500'
                            }`}
                          >
                            {isUnlocked ? '可解锁' : '锁定中'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {isUnlocked
                              ? '已到期'
                              : `到期: ${endDate.toLocaleDateString()}`}
                          </span>
                          <span className="text-yellow-500">
                            <Coins className="w-3 h-3 inline mr-1" />
                            +{stake.earnedPoints.toLocaleString()} 分
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={!isUnlocked}
                          onClick={() => handleUnstake(stake.id)}
                        >
                          {isUnlocked ? '解除质押' : '锁定期未到'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            质押说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">A 类灵活质押</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 最低质押金额：$100</li>
                <li>• 年化收益：5-8%</li>
                <li>• 随时可提取，无锁定期</li>
                <li>• 权重倍数：1.0x</li>
                <li>• 每日结算利息</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">B 类锁仓质押</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 最低质押金额：$500</li>
                <li>• 年化收益：15-30%（根据锁定期）</li>
                <li>• 锁定期结束后可提取</li>
                <li>• 权重倍数：1.5x - 3.0x</li>
                <li>• 额外积分奖励</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
