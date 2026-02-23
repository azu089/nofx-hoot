'use client';

import { useRouter } from 'next/navigation';
import { StrategyCreatorPage } from '@/components/ui-v3/strategies/strategy-creator-page';
import { MobileStrategyCreator } from '@/components/ui-v3/mobile/mobile-strategy-creator';

export default function StrategyCreateRoutePage() {
  const router = useRouter();

  const handleSave = (_data: unknown) => {
    // 创建成功后跳转到策略列表
    router.push('/strategies');
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const handleBack = () => {
    router.push('/strategies');
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block min-h-screen">
        <StrategyCreatorPage
          onSave={handleSave}
          onNavigate={handleNavigate}
        />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden h-screen">
        <MobileStrategyCreator
          onBack={handleBack}
          onSave={handleSave}
        />
      </div>
    </>
  );
}
