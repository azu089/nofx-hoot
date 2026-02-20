'use client';

import { Suspense } from 'react';
import { UnifiedAiCreate } from '@/components/ui-v3/ai/unified-ai-create';

function CreateContent() {
  return <UnifiedAiCreate />;
}

export default function AiCreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0F]" />}>
      <CreateContent />
    </Suspense>
  );
}
