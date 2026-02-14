'use client';

import { AiSettingsPage } from '@/components/ui-v3/mobile/ai-settings';

export default function AiSettingsRoute() {
  return (
    <>
      <div className="hidden md:block max-w-4xl mx-auto py-6 px-4">
        <AiSettingsPage />
      </div>
      <div className="block md:hidden">
        <AiSettingsPage />
      </div>
    </>
  );
}
