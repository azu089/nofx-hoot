'use client';

import { AIStrategyDetailPage } from '@/components/ui-v3/mobile/ai-trading-detail';

export default function AiTradingDetailRoute() {
  return (
    <>
      <div className="hidden md:block max-w-4xl mx-auto py-6 px-4">
        <AIStrategyDetailPage />
      </div>
      <div className="block md:hidden">
        <AIStrategyDetailPage />
      </div>
    </>
  );
}
