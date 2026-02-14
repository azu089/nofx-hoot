'use client';

import { ResearchDetailPage } from '@/components/ui-v3/mobile/ai-research-detail';

export default function AiResearchDetailRoute() {
  return (
    <>
      <div className="hidden md:block max-w-4xl mx-auto py-6 px-4">
        <ResearchDetailPage />
      </div>
      <div className="block md:hidden">
        <ResearchDetailPage />
      </div>
    </>
  );
}
