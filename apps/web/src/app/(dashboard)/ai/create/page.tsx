'use client';

import { Suspense } from 'react';
import { UnifiedAiCreate } from '@/components/ui-v3/ai/unified-ai-create';

function CreateContent() {
  return <UnifiedAiCreate />;
}

export default function AiCreatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
      </div>
    }>
      <CreateContent />
    </Suspense>
  );
}
