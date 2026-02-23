'use client';

import { useRouter } from 'next/navigation';
import { Brain, ArrowRight } from 'lucide-react';
import { useTranslations } from '@/i18n/provider';

export function AiDashboardCards() {
  const router = useRouter();
  const t = useTranslations('ai');

  return (
    <div className="space-y-3">
      {/* Section Title */}
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-[#9090A0]" />
        <h2 className="text-[#9090A0] text-xs uppercase tracking-wider font-medium">
          {t('dashboard.title')}
        </h2>
      </div>

      {/* Single Card */}
      <button
        onClick={() => router.push('/ai')}
        className="group glass-border-glow glass-card p-4 w-full
                   hover:border-cyan-400/30 hover:scale-[1.02]
                   transition-all duration-200 text-left flex items-center gap-4"
      >
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <Brain className="w-6 h-6 text-cyan-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[#F8F8FC] font-semibold text-sm">{t('dashboard.subtitle')}</h3>
          <p className="text-[#9090A0] text-xs leading-relaxed mt-0.5">
            {t('dashboard.features')}
          </p>
        </div>

        {/* Arrow */}
        <ArrowRight className="w-4 h-4 text-cyan-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}
