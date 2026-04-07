import { useState, KeyboardEvent } from 'react'
import { Trophy, Users, MessageSquare, Shield, Workflow, ArrowRight } from 'lucide-react'

export interface ArenaStrategyConfig {
  symbols: string[]
  selected_analysts: string[]
  max_debate_rounds: number
  max_risk_rounds: number
  risk_preference: 'aggressive' | 'balanced' | 'conservative'
}

interface ArenaConfigEditorProps {
  config: ArenaStrategyConfig
  onChange: (config: ArenaStrategyConfig) => void
  disabled?: boolean
  language: string
}

export const defaultArenaConfig: ArenaStrategyConfig = {
  symbols: ['BTCUSDT'],
  selected_analysts: ['market', 'social', 'news', 'fundamentals'],
  max_debate_rounds: 1,
  max_risk_rounds: 1,
  risk_preference: 'balanced',
}

const translations: Record<string, Record<string, string>> = {
  symbolsTitle:    { zh: '交易币种', en: 'Trading Symbols' },
  symbolsDesc:     { zh: '输入交易对后按 Enter 添加', en: 'Type a symbol and press Enter to add' },
  symbolsPlaceholder: { zh: '例如 ETHUSDT', en: 'e.g. ETHUSDT' },

  flowTitle:       { zh: '决策流程', en: 'Decision Flow' },
  flowStep1:       { zh: '分析师采集数据', en: 'Analysts collect data' },
  flowStep2:       { zh: '牛/熊研究员辩论', en: 'Bull/Bear debate' },
  flowStep3:       { zh: '研究权威裁决', en: 'Research manager judges' },
  flowStep4:       { zh: '交易员方案', en: 'Trader plans' },
  flowStep5:       { zh: '激进/保守/中立三方风控辩论', en: 'Risk debate (3 sides)' },
  flowStep6:       { zh: '组合经理最终决策', en: 'Portfolio manager decides' },
  flowStep7:       { zh: '信号提取', en: 'Signal extraction' },
  flowTotal:       { zh: '共', en: 'Total' },
  flowRoles:       { zh: '角色', en: 'roles' },

  analystsTitle:   { zh: '分析师团队', en: 'Analyst Team' },
  analystsDesc:    { zh: '选择参与分析的 AI 角色（至少 1 个）', en: 'Select AI roles to participate (at least 1)' },
  analystMarket:   { zh: '技术分析师', en: 'Market Analyst' },
  analystMarketDesc:{ zh: '价格数据 + 技术指标 (RSI/MACD/BB/ATR)', en: 'Price data + technical indicators' },
  analystNews:     { zh: '新闻分析师', en: 'News Analyst' },
  analystNewsDesc: { zh: '宏观新闻 + 公司/项目新闻', en: 'Macro news + project news' },
  analystSocial:   { zh: '情绪分析师', en: 'Sentiment Analyst' },
  analystSocialDesc:{ zh: '社交媒体情绪 + 公众讨论', en: 'Social sentiment + public discussion' },
  analystFundamentals: { zh: '基本面分析师', en: 'Fundamentals Analyst' },
  analystFundamentalsDesc: { zh: 'OI / 资金费率 / 链上数据', en: 'OI / funding rate / on-chain' },

  debateTitle:     { zh: '辩论设置', en: 'Debate Settings' },
  researchRounds:  { zh: '投研辩论轮数 (Bull vs Bear)', en: 'Research Debate Rounds (Bull vs Bear)' },
  researchRoundsDesc: { zh: '多头与空头辩手各发言几轮', en: 'How many rounds bull and bear debate' },
  riskRounds:      { zh: '风控辩论轮数', en: 'Risk Debate Rounds' },
  riskRoundsDesc:  { zh: '激进/保守/中性三方各发言几轮', en: 'How many rounds the 3 risk sides debate' },
  rounds:          { zh: '轮', en: 'rounds' },

  riskTitle:       { zh: '风险偏好', en: 'Risk Preference' },
  riskAggressive:  { zh: '激进', en: 'Aggressive' },
  riskBalanced:    { zh: '平衡', en: 'Balanced' },
  riskConservative:{ zh: '保守', en: 'Conservative' },
  riskAggressiveDesc:   { zh: '高收益高风险', en: 'High return, high risk' },
  riskBalancedDesc:     { zh: '收益与风险平衡', en: 'Balanced' },
  riskConservativeDesc: { zh: '优先保护本金', en: 'Capital preservation' },

  costTitle:       { zh: '决策周期', en: 'Decision Cycle' },
  costCalls:       { zh: '次 LLM 调用', en: 'LLM calls' },
  costAnalysts:    { zh: '分析师', en: 'analysts' },
  costDebate:      { zh: '辩论', en: 'debate' },
  costJudge:       { zh: '裁判', en: 'judge' },
  costTrader:      { zh: '交易员', en: 'trader' },
  costRisk:        { zh: '风控', en: 'risk' },
  costSignal:      { zh: '信号', en: 'signal' },
}

const t = (key: string, language: string): string =>
  translations[key]?.[language] ?? translations[key]?.['en'] ?? key

const ANALYST_OPTIONS = [
  { key: 'market',       labelKey: 'analystMarket',       descKey: 'analystMarketDesc' },
  { key: 'news',         labelKey: 'analystNews',         descKey: 'analystNewsDesc' },
  { key: 'social',       labelKey: 'analystSocial',       descKey: 'analystSocialDesc' },
  { key: 'fundamentals', labelKey: 'analystFundamentals', descKey: 'analystFundamentalsDesc' },
]

const RISK_OPTIONS: Array<{ value: ArenaStrategyConfig['risk_preference']; labelKey: string; descKey: string; color: string }> = [
  { value: 'aggressive',   labelKey: 'riskAggressive',   descKey: 'riskAggressiveDesc',   color: '#EF4444' },
  { value: 'balanced',     labelKey: 'riskBalanced',     descKey: 'riskBalancedDesc',     color: '#A855F7' },
  { value: 'conservative', labelKey: 'riskConservative', descKey: 'riskConservativeDesc', color: '#22C55E' },
]

// Arena 主题色：紫色
const ARENA_COLOR = '#A855F7'
const ARENA_BG = 'rgba(168, 85, 247, 0.08)'
const ARENA_BORDER = 'rgba(168, 85, 247, 0.35)'

export function ArenaConfigEditor({ config, onChange, disabled, language }: ArenaConfigEditorProps) {
  const [symbolInput, setSymbolInput] = useState('')

  const update = <K extends keyof ArenaStrategyConfig>(key: K, value: ArenaStrategyConfig[K]) => {
    if (!disabled) onChange({ ...config, [key]: value })
  }

  const addSymbol = () => {
    const val = symbolInput.trim().toUpperCase()
    if (val && !config.symbols.includes(val)) {
      update('symbols', [...config.symbols, val])
    }
    setSymbolInput('')
  }

  const removeSymbol = (sym: string) => update('symbols', config.symbols.filter((s) => s !== sym))
  const handleSymbolKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addSymbol() }
  }

  const toggleAnalyst = (key: string) => {
    const current = config.selected_analysts
    const next = current.includes(key) ? current.filter((a) => a !== key) : [...current, key]
    if (next.length === 0) return // 至少保留 1 个
    update('selected_analysts', next)
  }

  // 实时计算 LLM 调用次数
  const analystCount = config.selected_analysts.length
  const totalCalls =
    analystCount +                      // 分析师
    config.max_debate_rounds * 2 +      // bull + bear
    1 +                                  // 研究管理裁判
    1 +                                  // 交易员
    config.max_risk_rounds * 3 +         // 激进 + 保守 + 中立
    1 +                                  // 投资组合管理
    1                                    // 信号提取

  const inputStyle = { background: '#0A0A1A', border: '1px solid #2B3139', color: '#EAECEF' } as const
  const sectionStyle = { background: '#0A0A1A', border: '1px solid #2B3139' } as const

  return (
    <div className="space-y-5">

      {/* 1. Symbols */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4" style={{ color: ARENA_COLOR }} />
          <h3 className="text-sm font-medium" style={{ color: '#EAECEF' }}>{t('symbolsTitle', language)}</h3>
        </div>
        <div className="p-3 rounded-lg" style={sectionStyle}>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('symbolsDesc', language)}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {config.symbols.map((sym) => (
              <span key={sym} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono"
                style={{ background: ARENA_BG, border: `1px solid ${ARENA_BORDER}`, color: ARENA_COLOR }}>
                {sym}
                {!disabled && (
                  <button onClick={() => removeSymbol(sym)} className="ml-1 hover:opacity-70" style={{ color: '#848E9C' }}>×</button>
                )}
              </span>
            ))}
          </div>
          {!disabled && (
            <div className="flex gap-2">
              <input type="text" value={symbolInput} onChange={(e) => setSymbolInput(e.target.value)} onKeyDown={handleSymbolKeyDown}
                placeholder={t('symbolsPlaceholder', language)}
                className="flex-1 px-3 py-2 rounded text-sm" style={inputStyle} />
              <button onClick={addSymbol} className="px-4 py-2 rounded text-sm font-medium hover:opacity-80"
                style={{ background: ARENA_COLOR, color: '#fff' }}>+</button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Decision Flow Visualization */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Workflow className="w-4 h-4" style={{ color: ARENA_COLOR }} />
          <h3 className="text-sm font-medium" style={{ color: '#EAECEF' }}>{t('flowTitle', language)}</h3>
        </div>
        <div className="p-4 rounded-lg" style={{ background: ARENA_BG, border: `1px solid ${ARENA_BORDER}` }}>
          {/* 流程文字描述 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-xs" style={{ color: '#C4B5FD' }}>
            <span>{t('flowStep1', language)}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{t('flowStep2', language)}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{t('flowStep3', language)}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{t('flowStep4', language)}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{t('flowStep5', language)}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{t('flowStep6', language)}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{t('flowStep7', language)}</span>
          </div>
          {/* 角色徽章流水线 */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {config.selected_analysts.map((a, i) => (
              <span key={a}>
                <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#60A5FA' }}>
                  {t(`analyst${a.charAt(0).toUpperCase() + a.slice(1)}`, language)}
                </span>
                {i < config.selected_analysts.length - 1 && <span className="mx-1" style={{ color: '#848E9C' }}>+</span>}
              </span>
            ))}
            <ArrowRight className="w-3 h-3 mx-1" style={{ color: '#848E9C' }} />
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E' }}>{language === 'zh' ? '公牛研究员' : 'Bull'}</span>
            <span className="mx-1" style={{ color: '#848E9C' }}>⇄</span>
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#F87171' }}>{language === 'zh' ? '熊研究员' : 'Bear'}</span>
            <span className="mx-1" style={{ color: '#848E9C' }}>× {config.max_debate_rounds}</span>
            <ArrowRight className="w-3 h-3 mx-1" style={{ color: '#848E9C' }} />
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', color: '#C084FC' }}>{language === 'zh' ? '研究主管' : 'Research Mgr'}</span>
            <ArrowRight className="w-3 h-3 mx-1" style={{ color: '#848E9C' }} />
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B' }}>{language === 'zh' ? '交易员' : 'Trader'}</span>
            <ArrowRight className="w-3 h-3 mx-1" style={{ color: '#848E9C' }} />
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444' }}>{language === 'zh' ? '激进' : 'Aggressive'}</span>
            <span className="mx-0.5" style={{ color: '#848E9C' }}>⇄</span>
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E' }}>{language === 'zh' ? '保守' : 'Conservative'}</span>
            <span className="mx-0.5" style={{ color: '#848E9C' }}>⇄</span>
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#FBBF24' }}>{language === 'zh' ? '中立' : 'Neutral'}</span>
            <span className="mx-1" style={{ color: '#848E9C' }}>× {config.max_risk_rounds}</span>
            <ArrowRight className="w-3 h-3 mx-1" style={{ color: '#848E9C' }} />
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', color: '#C084FC' }}>{language === 'zh' ? '组合经理' : 'Portfolio Mgr'}</span>
            <ArrowRight className="w-3 h-3 mx-1" style={{ color: '#848E9C' }} />
            <span className="px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(156,163,175,0.15)', border: '1px solid rgba(156,163,175,0.4)', color: '#9CA3AF' }}>{language === 'zh' ? '信号提取器' : 'Signal Extractor'}</span>
          </div>
        </div>
      </div>

      {/* 3. Analyst Team */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4" style={{ color: ARENA_COLOR }} />
          <h3 className="text-sm font-medium" style={{ color: '#EAECEF' }}>{t('analystsTitle', language)}</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('analystsDesc', language)}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ANALYST_OPTIONS.map(({ key, labelKey, descKey }) => {
            const checked = config.selected_analysts.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleAnalyst(key)}
                disabled={disabled}
                className="text-left p-3 rounded-lg transition-all"
                style={{
                  background: checked ? ARENA_BG : '#0A0A1A',
                  border: `1px solid ${checked ? ARENA_BORDER : '#2B3139'}`,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <div className="text-sm font-medium mb-1" style={{ color: checked ? ARENA_COLOR : '#EAECEF' }}>
                  {t(labelKey, language)}
                </div>
                <div className="text-xs" style={{ color: '#848E9C' }}>{t(descKey, language)}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 4. Debate Settings (Sliders) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4" style={{ color: ARENA_COLOR }} />
          <h3 className="text-sm font-medium" style={{ color: '#EAECEF' }}>{t('debateTitle', language)}</h3>
        </div>
        <div className="p-4 rounded-lg space-y-4" style={sectionStyle}>
          {/* Research debate */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium" style={{ color: '#EAECEF' }}>{t('researchRounds', language)}</label>
              <span className="text-xs font-mono" style={{ color: ARENA_COLOR }}>{config.max_debate_rounds} {t('rounds', language)}</span>
            </div>
            <p className="text-[11px] mb-2" style={{ color: '#848E9C' }}>{t('researchRoundsDesc', language)}</p>
            <input
              type="range" min={1} max={3} step={1}
              value={config.max_debate_rounds}
              onChange={(e) => update('max_debate_rounds', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full"
              style={{ accentColor: ARENA_COLOR }}
            />
          </div>
          {/* Risk debate */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium" style={{ color: '#EAECEF' }}>{t('riskRounds', language)}</label>
              <span className="text-xs font-mono" style={{ color: ARENA_COLOR }}>{config.max_risk_rounds} {t('rounds', language)}</span>
            </div>
            <p className="text-[11px] mb-2" style={{ color: '#848E9C' }}>{t('riskRoundsDesc', language)}</p>
            <input
              type="range" min={1} max={3} step={1}
              value={config.max_risk_rounds}
              onChange={(e) => update('max_risk_rounds', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full"
              style={{ accentColor: ARENA_COLOR }}
            />
          </div>
        </div>
      </div>

      {/* 5. Risk Preference */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4" style={{ color: ARENA_COLOR }} />
          <h3 className="text-sm font-medium" style={{ color: '#EAECEF' }}>{t('riskTitle', language)}</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {RISK_OPTIONS.map(({ value, labelKey, descKey, color }) => {
            const selected = config.risk_preference === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => update('risk_preference', value)}
                disabled={disabled}
                className="text-left p-3 rounded-lg transition-all"
                style={{
                  background: selected ? `${color}15` : '#0A0A1A',
                  border: `1px solid ${selected ? `${color}66` : '#2B3139'}`,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <div className="text-sm font-medium mb-1" style={{ color: selected ? color : '#EAECEF' }}>
                  {t(labelKey, language)}
                </div>
                <div className="text-xs" style={{ color: '#848E9C' }}>{t(descKey, language)}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 6. Cost Estimation Footer */}
      <div className="p-3 rounded-lg flex items-center gap-2 text-xs flex-wrap"
        style={{ background: ARENA_BG, border: `1px solid ${ARENA_BORDER}`, color: '#C4B5FD' }}>
        <span style={{ color: '#848E9C' }}>{t('costTitle', language)}:</span>
        <span className="font-bold text-base" style={{ color: ARENA_COLOR }}>{totalCalls}</span>
        <span>{t('costCalls', language)}</span>
        <span className="ml-2" style={{ color: '#848E9C' }}>
          ({analystCount}{t('costAnalysts', language)} + {config.max_debate_rounds * 2}{t('costDebate', language)} + 1{t('costJudge', language)} + 1{t('costTrader', language)} + {config.max_risk_rounds * 3}{t('costRisk', language)} + 1PM + 1{t('costSignal', language)})
        </span>
      </div>

    </div>
  )
}
