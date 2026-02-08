'use client'

import { X, Webhook, Wand2, Code } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from '@/i18n/provider'

interface CreateStrategyModalProps {
  onClose: () => void
  onSelectType: (type: 'tradingview' | 'visual' | 'code') => void
}

const strategyTypesConfig = [
  {
    id: 'tradingview' as const,
    icon: Webhook,
    nameKey: 'tradingviewIntegration',
    descKey: 'tradingviewDesc',
    tagKey: 'recommended',
    tagStyle: 'bg-gradient-to-r from-cyan-500 to-cyan-400',
  },
  {
    id: 'visual' as const,
    icon: Wand2,
    nameKey: 'visualBuilder',
    descKey: 'visualBuilderDesc',
    tagKey: 'beginner',
    tagStyle: 'bg-[#10B981]',
  },
  {
    id: 'code' as const,
    icon: Code,
    nameKey: 'codeDevelopment',
    descKey: 'codeDevelopmentDesc',
    tagKey: 'advanced',
    tagStyle: 'bg-[#F59E0B]',
  },
]

export function CreateStrategyModal({ onClose, onSelectType }: CreateStrategyModalProps) {
  const t = useTranslations('modals')

  const strategyTypes = strategyTypesConfig.map(type => ({
    ...type,
    name: t(type.nameKey),
    description: t(type.descKey),
    tag: t(type.tagKey),
  }))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="relative z-10 w-full max-w-md bg-[#12121A] border-[#1E1E2E] shadow-2xl">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#F8F8FC]">{t('createStrategy')}</h2>
            <button
              type="button"
              onClick={onClose}
              title={t('close')}
              className="text-[#9090A0] hover:text-[#F8F8FC] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-[#9090A0] text-sm mb-6">
            {t('selectStrategyType')}
          </p>

          {/* Strategy Type Options */}
          <div className="space-y-3">
            {strategyTypes.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.id}
                  onClick={() => onSelectType(type.id)}
                  className="w-full p-4 bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg hover:border-cyan-500/50 hover:bg-[#1E1E2E]/50 transition-all group text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1E1E2E] group-hover:bg-gradient-to-br group-hover:from-cyan-500/20 group-hover:to-cyan-500/20 flex items-center justify-center transition-colors">
                      <Icon className="w-5 h-5 text-[#9090A0] group-hover:text-cyan-400 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-[#F8F8FC]">{type.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs text-white ${type.tagStyle}`}>
                          {type.tag}
                        </span>
                      </div>
                      <p className="text-[#606070] text-sm">{type.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
