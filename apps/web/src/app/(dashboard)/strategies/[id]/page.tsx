'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StrategyDetailPage, type StrategyApiData } from '@/components/ui-v3/strategies/strategy-detail-page';
import { MobileStrategyDetail, type MobileStrategyApiData } from '@/components/ui-v3/mobile/mobile-strategy-detail';
import { useEffect, useState } from 'react';

export default function StrategyDetailRoutePage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;
  const [debugInfo, setDebugInfo] = useState<string>('');

  // 获取策略详情
  const { data: strategy, isLoading, error, isFetching, status } = useQuery({
    queryKey: ['strategy', strategyId],
    queryFn: async () => {
      setDebugInfo(prev => prev + `\n[${new Date().toISOString()}] 开始请求 /strategies/${strategyId}`);
      try {
        const response = await api.get<StrategyApiData>(`/strategies/${strategyId}`);
        setDebugInfo(prev => prev + `\n[${new Date().toISOString()}] 响应: ${JSON.stringify(response).slice(0, 200)}`);
        return response.data;
      } catch (e) {
        setDebugInfo(prev => prev + `\n[${new Date().toISOString()}] 错误: ${e}`);
        throw e;
      }
    },
    enabled: !!strategyId,
  });

  useEffect(() => {
    setDebugInfo(`strategyId: ${strategyId}, status: ${status}, isLoading: ${isLoading}, isFetching: ${isFetching}`);
  }, [strategyId, status, isLoading, isFetching]);

  // 点击"立即使用"跳转到配置页面
  const handleUseStrategy = () => {
    router.push(`/strategies/${strategyId}/config`);
  };

  // 调试模式：显示详细信息
  if (process.env.NODE_ENV === 'development') {
    console.log('[策略详情]', { strategyId, status, isLoading, isFetching, strategy, error });
  }

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white p-8">
        <h1 className="text-xl text-red-500">加载策略失败</h1>
        <p className="mt-4 text-gray-400">错误信息: {error instanceof Error ? error.message : '未知错误'}</p>
        <p className="mt-2 text-gray-500">策略 ID: {strategyId}</p>
        <pre className="mt-4 p-4 bg-gray-900 rounded text-xs overflow-auto">{debugInfo}</pre>
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
