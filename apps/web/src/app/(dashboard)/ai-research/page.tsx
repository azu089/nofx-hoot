'use client';

import { AIResearchPage } from '@/components/ui-v3/mobile/ai-research-entry';

export default function AiResearchRoute() {
  return (
    <>
      <div className="hidden md:block max-w-4xl mx-auto py-6 px-4">
        <AIResearchPage />
      </div>
      <div className="block md:hidden">
        <AIResearchPage />
      </div>
    </>
  );
}
