'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AIResearchPage } from '@/components/ui-v3/mobile/ai-research-entry';
import { Page as AiTradingListPage } from '@/components/ui-v3/mobile/ai-trading-list';

type AiTab = 'research' | 'trading';

export function AiHubPage() {
  const [activeTab, setActiveTab] = useState<AiTab>('research');
  const t = useTranslations('aiHub');

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-24 md:pb-6">
      {/* Mobile Header — 与资产页对齐 */}
      <div className="md:hidden sticky top-0 z-30 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-center px-4 h-14">
          <h1 className="text-base font-semibold text-[#F8F8FC]">{t('title')}</h1>
        </div>
      </div>

      {/* Mobile Tab Bar — 资产页 pill 风格 */}
      <div className="md:hidden px-4 pt-4">
        <div className="flex gap-2 p-1 bg-[#12121A] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('research')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'research'
                ? 'bg-[#06B6D4] text-[#F8F8FC] shadow-lg shadow-[#06B6D4]/20'
                : 'text-[#9090A0] hover:text-[#F8F8FC]'
            }`}
          >
            {t('researchTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('trading')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'trading'
                ? 'bg-[#06B6D4] text-[#F8F8FC] shadow-lg shadow-[#06B6D4]/20'
                : 'text-[#9090A0] hover:text-[#F8F8FC]'
            }`}
          >
            {t('tradingTab')}
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block">
        <div className="p-6 pb-2">
          <h1 className="text-2xl font-bold text-[#F8F8FC]">{t('title')}</h1>
        </div>
        {/* Desktop Tab Bar — pill 风格 */}
        <div className="px-6 pt-2 pb-4">
          <div className="inline-flex gap-2 p-1 bg-[#12121A] rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('research')}
              className={`px-8 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'research'
                  ? 'bg-[#06B6D4] text-[#F8F8FC] shadow-lg shadow-[#06B6D4]/20'
                  : 'text-[#9090A0] hover:text-[#F8F8FC]'
              }`}
            >
              {t('researchTab')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trading')}
              className={`px-8 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'trading'
                  ? 'bg-[#06B6D4] text-[#F8F8FC] shadow-lg shadow-[#06B6D4]/20'
                  : 'text-[#9090A0] hover:text-[#F8F8FC]'
              }`}
            >
              {t('tradingTab')}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl md:mx-auto">
        {activeTab === 'research' ? (
          <AIResearchPage embedded />
        ) : (
          <AiTradingListPage embedded />
        )}
      </div>
    </div>
  );
}
