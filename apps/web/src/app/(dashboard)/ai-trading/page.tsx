'use client';

import { Page as AiTradingListPage } from '@/components/ui-v3/mobile/ai-trading-list';

export default function AiTradingRoute() {
  return (
    <>
      <div className="hidden md:block max-w-4xl mx-auto py-6 px-4">
        <AiTradingListPage />
      </div>
      <div className="block md:hidden">
        <AiTradingListPage />
      </div>
    </>
  );
}
