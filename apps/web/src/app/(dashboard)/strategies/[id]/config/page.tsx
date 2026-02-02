'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StrategyConfigPage } from '@/components/ui-v3/strategies/strategy-config-page';
import { MobileStrategyConfig } from '@/components/ui-v3/mobile/mobile-strategy-config';
import { StrategyConfigData } from '@/components/ui-v3/shared/strategy-config-types';

export default function StrategyConfigRoutePage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;

  // 获取策略详情
  const { data: strategy, isLoading } = useQuery({
    queryKey: ['strategy', strategyId],
    queryFn: async () => {
      const response = await api.get<{
        id: string;
        name: string;
        description: string;
        isActive: boolean;
        subscriberCount: number;
        isSubscribed: boolean;
        subscription?: {
          id: string;
          apiKeyId: string;
          amountPerTrade: string;
          maxPositions: number;
          isActive: boolean;
        };
      }>(`/strategies/${strategyId}`);
      return response.data;
    },
    enabled: !!strategyId,
  });

  const handleSave = (config: StrategyConfigData) => {
    console.log('保存配置:', config);
    // API 调用已在组件内部通过 useStrategySubscription hook 处理
  };

  const handleSuccess = () => {
    router.push(`/strategies/${strategyId}`);
  };

  const handleBack = () => {
    router.push(`/strategies/${strategyId}`);
  };

  const handleCancel = () => {
    router.push(`/strategies/${strategyId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0A0F]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block h-screen">
        <StrategyConfigPage
          strategyId={strategyId}
          strategyName={strategy?.name || '加载中...'}
          subscriptionId={strategy?.subscription?.id}
          onBack={handleBack}
          onSave={handleSave}
          onCancel={handleCancel}
          onSuccess={handleSuccess}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden h-screen">
        <MobileStrategyConfig
          strategyId={strategyId}
          strategyName={strategy?.name || '加载中...'}
          subscriptionId={strategy?.subscription?.id}
          onBack={handleBack}
          onSave={handleSave}
          onCancel={handleCancel}
          onSuccess={handleSuccess}
        />
      </div>
    </>
  );
}
