'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StrategyDetailPage, type StrategyApiData } from '@/components/ui-v3/strategies/strategy-detail-page';
import { MobileStrategyDetail, type MobileStrategyApiData } from '@/components/ui-v3/mobile/mobile-strategy-detail';

export default function StrategyDetailRoutePage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;
  // 获取策略详情
  const { data: strategy, isLoading, error } = useQuery({
    queryKey: ['strategy', strategyId],
    queryFn: async () => {
      const response = await api.get<StrategyApiData>(`/strategies/${strategyId}`);
      return response.data;
    },
    enabled: !!strategyId,
  });

  // 点击"立即使用"跳转到配置页面
  const handleUseStrategy = () => {
    router.push(`/strategies/${strategyId}/config`);
  };

  // 调试信息已通过 debugInfo state 存储，无需 console.log

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white p-8">
        <h1 className="text-xl text-red-500">加载策略失败</h1>
        <p className="mt-4 text-gray-400">错误信息: {error instanceof Error ? error.message : '未知错误'}</p>
        <p className="mt-2 text-gray-500">策略 ID: {strategyId}</p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-4 p-4 bg-gray-900 rounded text-xs overflow-auto">策略 ID: {strategyId}</pre>
        )}
        <button
          type="button"
          onClick={() => router.push('/strategies')}
          className="mt-4 px-4 py-2 bg-cyan-500 rounded"
        >
          返回策略列表
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <StrategyDetailPage
          strategy={strategy}
          isLoading={isLoading}
          onBack={() => router.push('/strategies')}
          onUseStrategy={handleUseStrategy}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileStrategyDetail
          strategy={strategy as MobileStrategyApiData | undefined}
          isLoading={isLoading}
          onBack={() => router.push('/strategies')}
          onUseStrategy={handleUseStrategy}
        />
      </div>
    </>
  );
}
