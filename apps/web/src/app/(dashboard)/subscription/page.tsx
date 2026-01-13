'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader, Dialog, DialogFooter } from '@/components/ui';
import { userApi, instancesApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
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
  Bot,
} from 'lucide-react';

// 会员订阅套餐配置（按时长，基准价 $20/月）
const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    name: '月度会员',
    duration: 1,
    price: 20,
    originalPrice: 20,
    discount: 0,
    description: '适合短期体验',
    features: ['启动 VPS 运行策略', '策略市场全部策略', '实盘交易功能', '基础技术支持'],
  },
  {
    id: 'quarterly',
    name: '季度会员',
    duration: 3,
    price: 54,
    originalPrice: 60,
    discount: 6,
    popular: true,
    description: '最受欢迎的选择',
    features: ['启动 VPS 运行策略', '策略市场全部策略', '实盘交易功能', '优先技术支持', '≈$18/月'],
  },
  {
    id: 'biannual',
    name: '半年会员',
    duration: 6,
    price: 96,
    originalPrice: 120,
    discount: 24,
    description: '高性价比之选',
    features: ['启动 VPS 运行策略', '策略市场全部策略', '实盘交易功能', '优先技术支持', '≈$16/月'],
  },
  {
    id: 'annual',
    name: '年度会员',
    duration: 12,
    price: 180,
    originalPrice: 240,
    discount: 60,
    best: true,
    description: '超值年度计划',
    features: ['启动 VPS 运行策略', '策略市场全部策略', '实盘交易功能', 'VIP 专属客服', '≈$15/月'],
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
      const [walletRes, profileRes] = await Promise.all([
        userApi.getWallet(),
        userApi.getProfile(),
      ]);
      setBalance(walletRes.data?.usdt_balance || '0');

      // 从用户 profile 获取 VIP 订阅状态
      const profile = profileRes.data;
      const vipExpiresAt = profile?.vip_expires_at;
      const isSubscribed = vipExpiresAt && new Date(vipExpiresAt) > new Date();

      setSubscription({
        is_subscribed: !!isSubscribed,
        expires_at: vipExpiresAt || undefined,
        plan_type: profile?.vip_level ? `VIP ${profile.vip_level}` : undefined,
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
      // 调用订阅 API（后端会自动创建 VPS）
      const result = await instancesApi.subscribe('sgp1', true);

      if (result.code !== 0) {
        throw new Error(result.message || '订阅失败');
      }

      setShowConfirmModal(false);

      // 显示成功信息
      const expiresAt = result.data?.subscription?.expiresAt;
      const formattedDate = expiresAt ? new Date(expiresAt).toLocaleDateString('zh-CN') : '';
      alert(`会员订阅成功！到期时间: ${formattedDate}，VPS 已自动创建，现在可以运行策略了`);

      router.push('/instances');
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || '订阅失败，请稍后重试';
      alert(message);
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 lg:space-y-6">
        <MobileHeader title="会员订阅" />
        <div className="animate-pulse space-y-4 px-4 lg:px-0">
          <div className="h-24 bg-bg-tertiary rounded-xl" />
          <div className="h-16 bg-bg-tertiary rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-bg-tertiary rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isSubscribed = subscription?.is_subscribed;

  return (
    <div className="space-y-4 lg:space-y-6 pb-20 lg:pb-6">
      <MobileHeader title="会员订阅" />

      {/* 当前订阅状态 - 移动端极简风格 */}
      <div className="lg:hidden px-4">
        {isSubscribed ? (
          <div className="p-4 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-warning">会员生效中</p>
                <p className="text-xs text-text-tertiary">
                  到期: {formatDateTime(subscription?.expires_at)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => router.push('/instances')}>
                启动 VPS
              </Button>
              <Button size="sm" variant="ghost" onClick={() => router.push('/strategies')}>
                浏览策略
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">尚未订阅</p>
                <p className="text-xs text-text-tertiary">订阅后可启动 VPS、运行策略</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 桌面端订阅状态 */}
      <div className="hidden lg:block">
        {isSubscribed ? (
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-warning" />
                    <span className="text-warning font-medium">会员生效中</span>
                  </div>
                  <p className="text-white font-bold text-xl mb-1">尊享会员权益</p>
                  <p className="text-text-secondary text-sm">
                    到期时间: {formatDateTime(subscription?.expires_at)}
                  </p>
                </div>
                <div className="w-16 h-16 bg-warning/20 rounded-2xl flex items-center justify-center">
                  <Crown className="w-8 h-8 text-warning" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-success/20 flex gap-3">
                <Button variant="outline" size="sm" onClick={() => router.push('/instances')}>
                  启动 VPS
                </Button>
                <Button variant="ghost" size="sm" onClick={() => router.push('/strategies')}>
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
                  <p className="text-white font-bold text-xl mb-1">开始您的量化交易之旅</p>
                  <p className="text-text-secondary text-sm">订阅会员后可启动 VPS、运行策略</p>
                </div>
                <div className="w-16 h-16 bg-brand-primary/20 rounded-2xl flex items-center justify-center">
                  <Crown className="w-8 h-8 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 可用余额 - 移动端极简 */}
      <div className="lg:hidden px-4">
        <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-sm">可用余额:</span>
            <span className="text-white font-medium">{formatCurrency(balance)}</span>
          </div>
          <button
            onClick={() => router.push('/wallet/deposit')}
            className="px-3 py-1.5 text-xs bg-bg-primary rounded-lg text-brand-primary"
          >
            去充值
          </button>
        </div>
      </div>

      {/* 桌面端余额提示 */}
      <div className="hidden lg:flex items-center justify-between p-4 bg-bg-secondary border border-border-primary rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">可用余额:</span>
          <span className="text-white font-medium">{formatCurrency(balance)} USDT</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/wallet/deposit')}>
          去充值
        </Button>
      </div>

      {/* 订阅套餐 - 移动端极简风格 */}
      <div className="lg:hidden px-4 space-y-3">
        <h2 className="text-sm font-medium text-text-secondary">选择订阅时长</h2>
        {SUBSCRIPTION_PLANS.map((plan, index) => (
          <div
            key={plan.id}
            onClick={() => handleSelectPlan(plan)}
            className={cn(
              'p-4 rounded-xl cursor-pointer transition-all relative',
              plan.popular
                ? 'bg-brand-primary/10 ring-1 ring-brand-primary'
                : plan.best
                  ? 'bg-success/10 ring-1 ring-success'
                  : 'bg-bg-secondary'
            )}
          >
            {/* 标签 */}
            {plan.popular && (
              <span className="absolute -top-2 right-4 px-2 py-0.5 bg-brand-primary text-white text-xs rounded-full">
                最受欢迎
              </span>
            )}
            {plan.best && (
              <span className="absolute -top-2 right-4 px-2 py-0.5 bg-success text-white text-xs rounded-full">
                超值推荐
              </span>
            )}

            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-white font-medium">{plan.name}</h3>
                <p className="text-xs text-text-tertiary">{plan.description}</p>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">${plan.price}</span>
                  {plan.discount > 0 && (
                    <span className="text-text-tertiary line-through text-sm">${plan.originalPrice}</span>
                  )}
                </div>
                {plan.discount > 0 && (
                  <span className="text-xs text-success">省 ${plan.discount}</span>
                )}
              </div>
            </div>

            {/* 简化的功能列表 - 只显示 2 个 */}
            <div className="flex items-center gap-4 text-xs text-text-tertiary">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-success" />
                VPS + 策略
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-success" />
                实盘交易
              </span>
              {plan.duration >= 6 && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-success" />
                  优先支持
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 桌面端订阅套餐 */}
      <div className="hidden lg:block space-y-4">
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
                      <span className="text-text-tertiary line-through text-lg">${plan.originalPrice}</span>
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

      {/* 会员权益说明 - 移动端极简 */}
      <div className="lg:hidden px-4 space-y-3">
        <h3 className="text-sm font-medium text-text-secondary">会员权益</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-bg-secondary rounded-xl">
            <Server className="w-5 h-5 text-brand-primary mb-2" />
            <p className="text-sm text-white">VPS 云服务器</p>
            <p className="text-xs text-text-tertiary">7x24 运行策略</p>
          </div>
          <div className="p-3 bg-bg-secondary rounded-xl">
            <Bot className="w-5 h-5 text-success mb-2" />
            <p className="text-sm text-white">策略市场</p>
            <p className="text-xs text-text-tertiary">全部策略解锁</p>
          </div>
          <div className="p-3 bg-bg-secondary rounded-xl">
            <Zap className="w-5 h-5 text-warning mb-2" />
            <p className="text-sm text-white">实盘交易</p>
            <p className="text-xs text-text-tertiary">自动执行交易</p>
          </div>
          <div className="p-3 bg-bg-secondary rounded-xl">
            <Shield className="w-5 h-5 text-danger mb-2" />
            <p className="text-sm text-white">安全保障</p>
            <p className="text-xs text-text-tertiary">数据加密备份</p>
          </div>
        </div>

        <div className="p-3 bg-warning/10 rounded-xl">
          <p className="text-xs text-text-secondary">
            <span className="text-warning font-medium">费用说明：</span>
            会员费为平台使用费，另需支付盈利部分 20% 燃油费（可用点卡抵扣）
          </p>
        </div>
      </div>

      {/* 桌面端会员权益说明 */}
      <Card className="hidden lg:block">
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
              <p className="text-sm text-text-secondary">独享 VPS 实例，7x24 小时运行策略</p>
            </div>

            <div className="p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4 text-success" />
                </div>
                <h4 className="text-white font-medium">策略市场</h4>
              </div>
              <p className="text-sm text-text-secondary">解锁全部量化策略，一键订阅使用</p>
            </div>

            <div className="p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-warning" />
                </div>
                <h4 className="text-white font-medium">实盘交易</h4>
              </div>
              <p className="text-sm text-text-secondary">接入交易所 API，自动执行交易</p>
            </div>

            <div className="p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-danger/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-danger" />
                </div>
                <h4 className="text-white font-medium">安全保障</h4>
              </div>
              <p className="text-sm text-text-secondary">API Key 加密存储，数据自动备份</p>
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

            <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg">
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
            {subscribing ? '处理中...' : '确认订阅'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
