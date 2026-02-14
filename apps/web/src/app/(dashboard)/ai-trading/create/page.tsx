'use client';

import { CreateStrategyWizard } from '@/components/ui-v3/mobile/ai-trading-create';

export default function AiTradingCreateRoute() {
  return (
    <>
      <div className="hidden md:block max-w-4xl mx-auto py-6 px-4">
        <CreateStrategyWizard />
      </div>
      <div className="block md:hidden">
        <CreateStrategyWizard />
      </div>
    </>
  );
}
