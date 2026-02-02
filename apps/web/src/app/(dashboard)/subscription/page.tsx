'use client';

import { useRouter } from 'next/navigation';
import { SubscriptionPage } from '@/components/ui-v3/subscription/subscription-page';
import { MobileSubscriptionPage } from '@/components/ui-v3/mobile/mobile-subscription-page';

export default function SubscriptionPageRoute() {
  const router = useRouter();

  const handleSubscribe = (tierId: string) => {
    console.log('订阅:', tierId);
    // TODO: 调用 API 处理订阅
  };

  const handleMobileSubscribe = (tier: 'basic' | 'premium' | 'pro', isYearly: boolean) => {
    console.log('订阅:', { tier, isYearly });
    // TODO: 调用 API 处理订阅
  };

  const handleCancel = () => {
    console.log('取消订阅');
    // TODO: 调用 API 取消订阅
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <SubscriptionPage
          currentTier="basic"
          onSubscribe={handleSubscribe}
          onCancel={handleCancel}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileSubscriptionPage
          currentTier="basic"
          onSubscribe={handleMobileSubscribe}
          onBack={() => router.back()}
        />
      </div>
    </>
  );
}
