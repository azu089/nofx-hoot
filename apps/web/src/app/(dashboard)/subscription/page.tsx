'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader, Dialog, DialogFooter } from '@/components/ui';
import { userApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  Crown,
  CheckCircle,
  Clock,
  Zap,
  Gift,
  TrendingUp,
  Info,
  Loader2,
  Calendar,
  Shield,
  Server,
  Sparkles,
  Star,
  Bot,
} from 'lucide-react';

// 会员订阅套餐配置（按时长）
const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    name: '月度会员',
    duration: 1,
    price: 25,
    originalPrice: 25,
    discount: 0,
    description: '适合短期体验',
    features: ['启动 VPS 运行策略', '策略市场全部策略', '实盘交易功能', '基础技术支持'],
  },
  {
    id: 'quarterly',
    name: '季度会员',
    duration: 3,
    price: 65,
    originalPrice: 75,
    discount: 10,
    popular: true,
    description: '最受欢迎的选择',
    features: ['启动 VPS 运行策略', '策略市场全部策略', '实盘交易功能', '优先技术支持', '省 $10'],
  },
  {
    id: 'biannual',
    name: '半年会员',
    duration: 6,
    price: 120,
    originalPrice: 150,
    discount: 30,
    description: '高性价比之选',
    features: ['启动 VPS 运行策略', '策略市场全部策略', '实盘交易功能', '优先技术支持', '省 $30'],
  },
  {
    id: 'annual',
    name: '年度会员',
    duration: 12,
    price: 200,
    originalPrice: 300,
    discount: 100,
    best: true,
    description: '超值年度计划',
    features: ['启动 VPS 运行策略', '策略市场全部策略', '实盘交易功能', 'VIP 专属客服', '省 $100'],
  },
];

// 用户订阅信息接口
interface UserSubscription {
  is_subscribed: boolean;
  expires_at?: string;
  plan_type?: string;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<typeof SUBSCRIPTION_PLANS[0] | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const fetchData = async () => {
    try {
      const walletRes = await userApi.getWallet();
      setBalance(walletRes.data?.usdt_balance || '0');

      // TODO: 获取用户订阅状态
      // const subRes = await userApi.getSubscription();
      // setSubscription(subRes.data);

      // 模拟数据：未订阅状态
      setSubscription({
        is_subscribed: false,
        expires_at: undefined,
        plan_type: undefined,
      });
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectPlan = (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    if (parseFloat(balance) < plan.price) {
      alert('余额不足，请先充值');
      return;
    }
    setSelectedPlan(plan);
    setShowConfirmModal(true);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    setSubscribing(true);
    try {
      // TODO: 调用订阅 API
      // await userApi.subscribe({ plan_id: selectedPlan.id, duration: selectedPlan.duration });
      await new Promise(resolve => setTimeout(resolve, 1500));

      setShowConfirmModal(false);
      alert(`会员订阅成功！有效期 ${selectedPlan.duration} 个月，现在可以启动 VPS 运行策略了`);
      router.push('/dashboard');
    } catch (error) {
      alert(error instanceof Error ? error.message : '订阅失败');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <MobileHeader title="会员订阅" />
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-bg-tertiary rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-bg-tertiary rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isSubscribed = subscription?.is_subscribed;

  return (
    <div className="space-y-6">
      <MobileHeader title="会员订阅" subtitle="解锁全部功能，开启量化交易" />

      {/* 当前订阅状态 */}
      {isSubscribed ? (
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-warning" />
                  <span className="text-warning font-medium">会员生效中</span>
                </div>
                <p className="text-white font-bold text-xl mb-1">
                  尊享会员权益
                </p>
                <p className="text-text-secondary text-sm">
                  到期时间: {formatDateTime(subscription?.expires_at)}
                </p>
              </div>
              <div className="w-16 h-16 bg-warning/20 rounded-2xl flex items-center justify-center">
                <Crown className="w-8 h-8 text-warning" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-success/20 flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/instances')}
              >
                启动 VPS
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/strategies')}
              >
                浏览策略
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 border-brand-primary/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-warning" />
                  <span className="text-warning font-medium">尚未订阅</span>
                </div>
                <p className="text-white font-bold text-xl mb-1">
                  开始您的量化交易之旅
                </p>
                <p className="text-text-secondary text-sm">
                  订阅会员后可启动 VPS、运行策略
                </p>
              </div>
              <div className="w-16 h-16 bg-brand-primary/20 rounded-2xl flex items-center justify-center">
                <Crown className="w-8 h-8 text-brand-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 可用余额提示 */}
      <div className="flex items-center justify-between p-4 bg-bg-secondary border border-border-primary rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">可用余额:</span>
          <span className="text-white font-medium">{formatCurrency(balance)} USDT</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/wallet/deposit')}>
          去充值
        </Button>
      </div>

      {/* 订阅套餐 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">选择订阅时长</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`cursor-pointer transition-all hover:border-brand-primary/50 relative ${
                plan.popular ? 'border-brand-primary ring-1 ring-brand-primary/30' : ''
              } ${plan.best ? 'border-success ring-1 ring-success/30' : ''}`}
              onClick={() => handleSelectPlan(plan)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-brand-primary text-white text-xs font-medium rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    最受欢迎
                  </span>
                </div>
              )}
              {plan.best && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-success text-white text-xs font-medium rounded-full flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    超值推荐
                  </span>
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{plan.name}</h3>
                    <p className="text-text-tertiary text-sm">{plan.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-text-secondary" />
                    <span className="text-text-secondary text-sm">{plan.duration} 个月</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">${plan.price}</span>
                    {plan.discount > 0 && (
                      <span className="text-text-tertiary line-through text-lg">
                        ${plan.originalPrice}
                      </span>
                    )}
                  </div>

                  {plan.discount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        省 ${plan.discount}
                      </span>
                      <span className="text-text-tertiary text-sm">
                        ≈ ${(plan.price / plan.duration).toFixed(0)}/月
                      </span>
                    </div>
                  )}

                  <div className="space-y-2 pt-3 border-t border-border-primary">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-text-secondary">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full mt-4"
                  variant={plan.popular || plan.best ? 'primary' : 'outline'}
                  disabled={parseFloat(balance) < plan.price}
                >
                  {parseFloat(balance) < plan.price ? '余额不足' : isSubscribed ? '续期会员' : '立即订阅'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 会员权益说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-brand-primary" />
            会员权益说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-brand-primary/20 rounded-lg flex items-center justify-center">
                  <Server className="w-4 h-4 text-brand-primary" />
                </div>
                <h4 className="text-white font-medium">VPS 云服务器</h4>
              </div>
              <p className="text-sm text-text-secondary">
                独享 VPS 实例，7x24 小时运行策略
              </p>
            </div>

            <div className="p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4 text-success" />
                </div>
                <h4 className="text-white font-medium">策略市场</h4>
              </div>
              <p className="text-sm text-text-secondary">
                解锁全部量化策略，一键订阅使用
              </p>
            </div>

            <div className="p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-warning" />
                </div>
                <h4 className="text-white font-medium">实盘交易</h4>
              </div>
              <p className="text-sm text-text-secondary">
                接入交易所 API，自动执行交易
              </p>
            </div>

            <div className="p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-danger/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-danger" />
                </div>
                <h4 className="text-white font-medium">安全保障</h4>
              </div>
              <p className="text-sm text-text-secondary">
                API Key 加密存储，数据自动备份
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-sm text-text-secondary">
              <span className="text-warning font-medium">费用说明：</span>
              会员费为平台使用费，另需支付策略运行盈利部分的 20% 燃油费（可用点卡抵扣）。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 确认订阅弹窗 */}
      <Dialog
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="确认订阅"
        description="请确认订阅信息"
      >
        {selectedPlan && (
          <div className="space-y-4">
            <div className="p-4 bg-bg-tertiary rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">订阅套餐</span>
                <span className="text-white font-medium">{selectedPlan.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">订阅时长</span>
                <span className="text-white font-medium">{selectedPlan.duration} 个月</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">支付金额</span>
                <span className="text-white font-medium">${selectedPlan.price} USDT</span>
              </div>
              {selectedPlan.discount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">已省</span>
                  <span className="text-success font-medium">${selectedPlan.discount}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 p-3 bg-bg-tertiary/50 rounded-lg border border-border-primary">
              <p className="text-sm text-text-secondary">订阅成功后可以：</p>
              <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
                <li>启动 VPS 实例运行策略</li>
                <li>解锁策略市场全部策略</li>
                <li>使用实盘交易功能</li>
              </ul>
            </div>

            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <Info className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-sm text-text-secondary">
                订阅后不可退款，到期前可续期延长时间
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowConfirmModal(false)} disabled={subscribing}>
            取消
          </Button>
          <Button onClick={handleSubscribe} isLoading={subscribing}>
            {subscribing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                处理中...
              </>
            ) : (
              '确认订阅'
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
