import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, FileText } from 'lucide-react'
import type { PromptSectionsConfig } from '../../types'

interface PromptSectionsEditorProps {
  config: PromptSectionsConfig | undefined
  onChange: (config: PromptSectionsConfig) => void
  disabled?: boolean
  language: string
}

// Default prompt sections (same as backend defaults)
const defaultSections: PromptSectionsConfig = {
  role_definition: `# 你是专业的加密货币交易AI

你专注于技术分析和风险管理，基于市场数据做出理性的交易决策。
你的目标是在控制风险的前提下，捕捉高概率的交易机会。`,

  trading_frequency: `# ⏱️ 交易频率认知

- 优秀交易员：每天2-4笔 ≈ 每小时0.1-0.2笔
- 每小时>2笔 = 过度交易
- 单笔持仓时间≥30-60分钟
如果你发现自己每个周期都在交易 → 标准过低；若持仓<30分钟就平仓 → 过于急躁。`,

  entry_standards: `# 🎯 开仓标准（严格）

只在多重信号共振时开仓：
- 趋势方向明确（EMA排列、价格位置）
- 动量确认（MACD、RSI协同）
- 波动率适中（ATR合理范围）
- 量价配合（成交量支持方向）

避免：单一指标、信号矛盾、横盘震荡、刚平仓即重启。`,

  decision_process: `# 📋 决策流程

1. 检查持仓 → 是否该止盈/止损
2. 扫描候选币 + 多时间框 → 是否存在强信号
3. 评估风险回报比 → 是否满足最小要求
4. 先写思维链，再输出结构化JSON`,
}

export function PromptSectionsEditor({
  config,
  onChange,
  disabled,
  language,
}: PromptSectionsEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    role_definition: false,
    trading_frequency: false,
    entry_standards: false,
    decision_process: false,
  })

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      promptSections: { zh: 'System Prompt 自定义', en: 'System Prompt Customization' },
      promptSectionsDesc: { zh: '自定义 AI 行为和决策逻辑（输出格式和风控规则不可修改）', en: 'Customize AI behavior and decision logic (output format and risk rules are fixed)' },
      roleDefinition: { zh: '角色定义', en: 'Role Definition' },
      roleDefinitionDesc: { zh: '定义 AI 的身份和核心目标', en: 'Define AI identity and core objectives' },
      tradingFrequency: { zh: '交易频率', en: 'Trading Frequency' },
      tradingFrequencyDesc: { zh: '设定交易频率预期和过度交易警告', en: 'Set trading frequency expectations and overtrading warnings' },
      entryStandards: { zh: '开仓标准', en: 'Entry Standards' },
      entryStandardsDesc: { zh: '定义开仓信号条件和避免事项', en: 'Define entry signal conditions and avoidances' },
      decisionProcess: { zh: '决策流程', en: 'Decision Process' },
      decisionProcessDesc: { zh: '设定决策步骤和思考流程', en: 'Set decision steps and thinking process' },
      resetToDefault: { zh: '重置为默认', en: 'Reset to Default' },
      chars: { zh: '字符', en: 'chars' },
    }
    return translations[key]?.[language] || key
  }

  const sections = [
    { key: 'role_definition', label: t('roleDefinition'), desc: t('roleDefinitionDesc') },
    { key: 'trading_frequency', label: t('tradingFrequency'), desc: t('tradingFrequencyDesc') },
    { key: 'entry_standards', label: t('entryStandards'), desc: t('entryStandardsDesc') },
    { key: 'decision_process', label: t('decisionProcess'), desc: t('decisionProcessDesc') },
  ]

  const currentConfig = config || {}

  const updateSection = (key: keyof PromptSectionsConfig, value: string) => {
    if (!disabled) {
      onChange({ ...currentConfig, [key]: value })
    }
  }

  const resetSection = (key: keyof PromptSectionsConfig) => {
    if (!disabled) {
      onChange({ ...currentConfig, [key]: defaultSections[key] })
    }
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const getValue = (key: keyof PromptSectionsConfig): string => {
    return currentConfig[key] || defaultSections[key] || ''
  }

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2 mb-3">
        <FileText className="w-4 h-4 mt-0.5 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-nofx-text">{t('promptSections')}</h3>
          <p className="text-xs mt-0.5 text-nofx-text-muted">{t('promptSectionsDesc')}</p>
        </div>
      </div>

      <div>
        {sections.map(({ key, label, desc }) => {
          const sectionKey = key as keyof PromptSectionsConfig
          const isExpanded = expandedSections[key]
          const value = getValue(sectionKey)
          const isModified =
            currentConfig[sectionKey] !== undefined &&
            currentConfig[sectionKey] !== defaultSections[sectionKey]

          return (
            <div key={key} className="fade-divider-b">
              <button
                onClick={() => toggleSection(key)}
                className="w-full flex items-center justify-between py-3 bg-transparent focus:outline-none text-left"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-nofx-text-muted flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-nofx-text-muted flex-shrink-0" />
                  )}
                  <span className="text-sm text-nofx-text truncate">{label}</span>
                  {isModified && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-400/15 text-emerald-400 flex-shrink-0">
                      {language === 'zh' ? '已修改' : 'Modified'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-nofx-text-muted flex-shrink-0 ml-2">
                  {value.length} {t('chars')}
                </span>
              </button>

              {isExpanded && (
                <div className="pb-3">
                  <p className="text-xs mb-2 text-nofx-text-muted">{desc}</p>
                  <textarea
                    value={value}
                    onChange={(e) => updateSection(sectionKey, e.target.value)}
                    disabled={disabled}
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg resize-y font-mono text-xs bg-transparent border border-emerald-400/30 focus:border-emerald-400/60 focus:outline-none text-nofx-text"
                    style={{ minHeight: '120px' }}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => resetSection(sectionKey)}
                      disabled={disabled || !isModified}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-nofx-text-muted hover:bg-white/5 disabled:opacity-30 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {t('resetToDefault')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

