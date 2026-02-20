'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SubscriptionPage } from '@/components/ui-v3/subscription/subscription-page';
import { MobileSubscriptionPage } from '@/components/ui-v3/mobile/mobile-subscription-page';
import { toast } from 'sonner';

// 后端套餐类型
interface MembershipPlan {
  id: string;
  code: string;
  name: string;
  price: string;
  durationDays: number;
  originalPrice?: string;
  discountPercent?: number | null;
  monthlyPrice: string;
  maxStrategies: number;
  gasFeeRate: string;
}

// 后端会员状态类型
interface MembershipStatus {
  isMember: boolean;
  status: 'none' | 'active' | 'expired';
  tier: 'free' | 'pro';
  gasFeeRate: string;
  maxStrategies: number;
  currentPlan?: {
    code: string;
    name: string;
    expireAt: string;
    daysRemaining: number;
  };
  canSubscribeStrategies: boolean;
}

interface WalletBalance {
  usdtBalance: string;
  hootBalance: string;
  pointBalance: string;
}

export default function SubscriptionPageRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 获取套餐列表
  const { data: plans } = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: async () => {
      const response = await api.get<MembershipPlan[]>('/membership/plans');
      return response.data;
    },
  });

  // 获取会员状态
  const { data: membershipStatus } = useQuery({
    queryKey: ['membership', 'status'],
    queryFn: async () => {
      const response = await api.get<MembershipStatus>('/membership/status');
      return response.data;
    },
  });

  // 获取钱包余额
  const { data: walletBalance } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const response = await api.get<WalletBalance>('/wallet/balance');
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // 购买会员
  const purchaseMutation = useMutation({
    mutationFn: async (data: { planCode: string; paymentAsset?: string }) => {
      const response = await api.post('/membership/purchase', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('会员购买成功！');
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || '购买失败，请稍后重试';
      toast.error(msg);
    },
  });

  // 处理桌面端订阅
  const handleSubscribe = async (planCode: string) => {
    await purchaseMutation.mutateAsync({ planCode, paymentAsset: 'USDT' });
  };

  // 处理移动端订阅
  const handleMobileSubscribe = async (planCode: string) => {
    await purchaseMutation.mutateAsync({ planCode, paymentAsset: 'USDT' });
  };

  // 映射当前套餐状态
  const currentPlanCode = membershipStatus?.currentPlan?.code;
  const currentPeriodEnd = membershipStatus?.currentPlan?.expireAt
    ? new Date(membershipStatus.currentPlan.expireAt).toLocaleDateString('zh-CN')
    : undefined;

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <SubscriptionPage
          plans={plans}
          currentPlanCode={currentPlanCode}
          currentPeriodEnd={currentPeriodEnd}
          isMember={membershipStatus?.isMember || false}
          daysRemaining={membershipStatus?.currentPlan?.daysRemaining}
          usdtBalance={walletBalance?.usdtBalance}
          tier={membershipStatus?.tier || 'free'}
          gasFeeRate={membershipStatus?.gasFeeRate || '0.25'}
          maxStrategies={membershipStatus?.maxStrategies || 2}
          onSubscribe={handleSubscribe}
          isProcessing={purchaseMutation.isPending}
          isSuccess={purchaseMutation.isSuccess}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileSubscriptionPage
          plans={plans}
          currentPlanCode={currentPlanCode}
          currentPeriodEnd={currentPeriodEnd}
          isMember={membershipStatus?.isMember || false}
          daysRemaining={membershipStatus?.currentPlan?.daysRemaining}
          usdtBalance={walletBalance?.usdtBalance}
          tier={membershipStatus?.tier || 'free'}
          gasFeeRate={membershipStatus?.gasFeeRate || '0.25'}
          maxStrategies={membershipStatus?.maxStrategies || 2}
          onSubscribe={handleMobileSubscribe}
          isProcessing={purchaseMutation.isPending}
          isSuccess={purchaseMutation.isSuccess}
          onBack={() => router.back()}
        />
      </div>
    </>
  );
}
