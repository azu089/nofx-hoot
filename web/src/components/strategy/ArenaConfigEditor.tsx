import { useState, KeyboardEvent } from 'react'
import { Trophy, Users, MessageSquare, Shield, X, Plus, Workflow, ArrowRight } from 'lucide-react'

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
  symbolsTitle: { zh: '交易币种', en: 'Trading Symbols' },
  symbolsDesc: { zh: '输入交易对后按 Enter 添加', en: 'Type a symbol and press Enter to add' },
  symbolsPlaceholder: { zh: '例如 ETHUSDT', en: 'e.g. ETHUSDT' },

  flowTitle: { zh: '决策流程（13 角色流水线）', en: 'Decision Flow (13-Role Pipeline)' },
  bull: { zh: '公牛研究员', en: 'Bull' },
  bear: { zh: '熊研究员', en: 'Bear' },
  researchMgr: { zh: '研究主管', en: 'Research Mgr' },
  trader: { zh: '交易员', en: 'Trader' },
  riskAggressiveBadge: { zh: '激进', en: 'Aggressive' },
  riskConservativeBadge: { zh: '保守', en: 'Conservative' },
  riskNeutralBadge: { zh: '中立', en: 'Neutral' },
  portfolioMgr: { zh: '组合经理', en: 'Portfolio Mgr' },
  signalExtractor: { zh: '信号提取器', en: 'Signal Extractor' },

  analystsTitle: { zh: '分析师团队', en: 'Analyst Team' },
  analystsDesc: { zh: '选择参与分析的 AI 角色（至少 1 个）', en: 'Select AI roles to participate (at least 1)' },
  analystMarket: { zh: '技术分析师', en: 'Market Analyst' },
  analystMarketDesc: { zh: '价格数据 + 技术指标 (RSI/MACD/BB/ATR)', en: 'Price data + technical indicators' },
  analystNews: { zh: '新闻分析师', en: 'News Analyst' },
  analystNewsDesc: { zh: '宏观新闻 + 公司/项目新闻', en: 'Macro news + project news' },
  analystSocial: { zh: '情绪分析师', en: 'Sentiment Analyst' },
  analystSocialDesc: { zh: '社交媒体情绪 + 公众讨论', en: 'Social sentiment + public discussion' },
  analystFundamentals: { zh: '基本面分析师', en: 'Fundamentals Analyst' },
  analystFundamentalsDesc: { zh: 'OI / 资金费率 / 链上数据', en: 'OI / funding rate / on-chain' },

  debateTitle: { zh: '辩论设置', en: 'Debate Settings' },
  researchRounds: { zh: '投研辩论轮数', en: 'Research Debate Rounds' },
  researchRoundsDesc: { zh: '多头与空头辩手各发言几轮', en: 'Bull vs Bear rounds' },
  riskRounds: { zh: '风控辩论轮数', en: 'Risk Debate Rounds' },
  riskRoundsDesc: { zh: '激进/保守/中性三方各发言几轮', en: '3 risk sides rounds' },
  rounds: { zh: '轮', en: 'rounds' },

  riskTitle: { zh: '风险偏好', en: 'Risk Preference' },
  riskAggressive: { zh: '激进', en: 'Aggressive' },
  riskBalanced: { zh: '平衡', en: 'Balanced' },
  riskConservative: { zh: '保守', en: 'Conservative' },
  riskAggressiveDesc: { zh: '高收益高风险', en: 'High return, high risk' },
  riskBalancedDesc: { zh: '收益与风险平衡', en: 'Balanced' },
  riskConservativeDesc: { zh: '优先保护本金', en: 'Capital preservation' },

  costTitle: { zh: '决策周期', en: 'Decision Cycle' },
  costCalls: { zh: '次 LLM 调用', en: 'LLM calls' },
}

const t = (key: string, language: string): string =>
  translations[key]?.[language] ?? translations[key]?.['en'] ?? key

const ANALYST_OPTIONS = [
  { key: 'market', labelKey: 'analystMarket', descKey: 'analystMarketDesc' },
  { key: 'news', labelKey: 'analystNews', descKey: 'analystNewsDesc' },
  { key: 'social', labelKey: 'analystSocial', descKey: 'analystSocialDesc' },
  { key: 'fundamentals', labelKey: 'analystFundamentals', descKey: 'analystFundamentalsDesc' },
]

const RISK_OPTIONS: Array<{ value: ArenaStrategyConfig['risk_preference']; labelKey: string; descKey: string }> = [
  { value: 'aggressive', labelKey: 'riskAggressive', descKey: 'riskAggressiveDesc' },
  { value: 'balanced', labelKey: 'riskBalanced', descKey: 'riskBalancedDesc' },
  { value: 'conservative', labelKey: 'riskConservative', descKey: 'riskConservativeDesc' },
]

const glassSelected: React.CSSProperties = {
  background:
    'radial-gradient(ellipse 70% 65% at 50% 105%, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0.12) 35%, rgba(16,185,129,0.04) 65%, transparent 100%), transparent',
  boxShadow:
    'inset 1px 0 0 0 rgba(255,255,255,0.28), inset -1px 0 0 0 rgba(255,255,255,0.28)',
}

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
    if (e.key === 'Enter') {
      e.preventDefault()
      addSymbol()
    }
  }

  const toggleAnalyst = (key: string) => {
    const current = config.selected_analysts
    const next = current.includes(key) ? current.filter((a) => a !== key) : [...current, key]
    if (next.length === 0) return
    update('selected_analysts', next)
  }

  const analystCount = config.selected_analysts.length
  const totalCalls =
    analystCount +
    config.max_debate_rounds * 2 +
    1 +
    1 +
    config.max_risk_rounds * 3 +
    1 +
    1

  const SectionTitle = ({
    icon: Icon,
    title,
  }: {
    icon: typeof Trophy
    title: string
  }) => (
    <div className="flex items-center gap-2 mt-3 mb-2">
      <Icon className="w-4 h-4 text-emerald-400" />
      <h3 className="text-sm font-medium text-nofx-text">{title}</h3>
    </div>
  )

  return (
    <div className="space-y-1">
      {/* 1. 交易币种 */}
      <SectionTitle icon={Trophy} title={t('symbolsTitle', language)} />
      <p className="text-xs text-nofx-text-muted mb-2">{t('symbolsDesc', language)}</p>

      <div className="flex flex-wrap gap-2 mb-2">
        {config.symbols.map((sym) => (
          <span
            key={sym}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
          >
            {sym}
            {!disabled && (
              <button
                onClick={() => removeSymbol(sym)}
                className="ml-0.5 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2 pb-3 fade-divider-b">
          <input
            type="text"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            onKeyDown={handleSymbolKeyDown}
            placeholder={t('symbolsPlaceholder', language)}
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent border border-emerald-400/30 focus:border-emerald-400/60 focus:outline-none text-nofx-text"
          />
          <button onClick={addSymbol} className="btn-emerald px-4 py-2 rounded-lg text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. 决策流程可视化 */}
      <SectionTitle icon={Workflow} title={t('flowTitle', language)} />
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] py-2 pb-3 fade-divider-b">
        {config.selected_analysts.map((a, i) => (
          <span key={a} className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded font-medium bg-emerald-400/10 border border-emerald-400/30 text-emerald-400">
              {t(`analyst${a.charAt(0).toUpperCase() + a.slice(1)}`, language)}
            </span>
            {i < config.selected_analysts.length - 1 && <span className="text-nofx-text-muted">+</span>}
          </span>
        ))}
        <ArrowRight className="w-3 h-3 mx-0.5 text-nofx-text-muted" />
        <span className="px-2 py-0.5 rounded font-medium bg-emerald-400/10 border border-emerald-400/30 text-emerald-400">
          {t('bull', language)}
        </span>
        <span className="text-nofx-text-muted">⇄</span>
        <span className="px-2 py-0.5 rounded font-medium bg-red-400/10 border border-red-400/30 text-red-400">
          {t('bear', language)}
        </span>
        <span className="text-nofx-text-muted">× {config.max_debate_rounds}</span>
        <ArrowRight className="w-3 h-3 mx-0.5 text-nofx-text-muted" />
        <span className="px-2 py-0.5 rounded font-medium bg-white/5 border border-white/15 text-nofx-text">
          {t('researchMgr', language)}
        </span>
        <ArrowRight className="w-3 h-3 mx-0.5 text-nofx-text-muted" />
        <span className="px-2 py-0.5 rounded font-medium bg-white/5 border border-white/15 text-nofx-text">
          {t('trader', language)}
        </span>
        <ArrowRight className="w-3 h-3 mx-0.5 text-nofx-text-muted" />
        <span className="px-2 py-0.5 rounded font-medium bg-red-400/10 border border-red-400/30 text-red-400">
          {t('riskAggressiveBadge', language)}
        </span>
        <span className="text-nofx-text-muted">⇄</span>
        <span className="px-2 py-0.5 rounded font-medium bg-emerald-400/10 border border-emerald-400/30 text-emerald-400">
          {t('riskConservativeBadge', language)}
        </span>
        <span className="text-nofx-text-muted">⇄</span>
        <span className="px-2 py-0.5 rounded font-medium bg-amber-400/10 border border-amber-400/30 text-amber-400">
          {t('riskNeutralBadge', language)}
        </span>
        <span className="text-nofx-text-muted">× {config.max_risk_rounds}</span>
        <ArrowRight className="w-3 h-3 mx-0.5 text-nofx-text-muted" />
        <span className="px-2 py-0.5 rounded font-medium bg-white/5 border border-white/15 text-nofx-text">
          {t('portfolioMgr', language)}
        </span>
        <ArrowRight className="w-3 h-3 mx-0.5 text-nofx-text-muted" />
        <span className="px-2 py-0.5 rounded font-medium bg-white/5 border border-white/15 text-nofx-text">
          {t('signalExtractor', language)}
        </span>
      </div>

      {/* 3. 分析师团队 */}
      <SectionTitle icon={Users} title={t('analystsTitle', language)} />
      <p className="text-xs text-nofx-text-muted mb-2">{t('analystsDesc', language)}</p>

      <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 pb-3 fade-divider-b">
        {ANALYST_OPTIONS.map(({ key, labelKey, descKey }) => {
          const checked = config.selected_analysts.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleAnalyst(key)}
              disabled={disabled}
              className="relative overflow-hidden text-left p-3 rounded-xl transition-all disabled:opacity-50"
              style={checked ? glassSelected : undefined}
            >
              <div className="text-sm font-medium text-nofx-text">{t(labelKey, language)}</div>
              <div className="text-xs text-nofx-text-muted mt-0.5">{t(descKey, language)}</div>
            </button>
          )
        })}
      </div>

      {/* 3. 辩论设置 */}
      <SectionTitle icon={MessageSquare} title={t('debateTitle', language)} />

      <div className="flex items-center justify-between gap-4 py-3 fade-divider-b">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-nofx-text">{t('researchRounds', language)}</div>
          <div className="text-xs text-nofx-text-muted mt-0.5">{t('researchRoundsDesc', language)}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={config.max_debate_rounds}
            onChange={(e) => update('max_debate_rounds', parseInt(e.target.value))}
            disabled={disabled}
            className="flex-1 min-w-[120px] max-w-[220px] accent-emerald-500"
          />
          <span className="w-14 text-right font-mono text-emerald-400 text-sm">
            {config.max_debate_rounds} {t('rounds', language)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 py-3 fade-divider-b">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-nofx-text">{t('riskRounds', language)}</div>
          <div className="text-xs text-nofx-text-muted mt-0.5">{t('riskRoundsDesc', language)}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={config.max_risk_rounds}
            onChange={(e) => update('max_risk_rounds', parseInt(e.target.value))}
            disabled={disabled}
            className="flex-1 min-w-[120px] max-w-[220px] accent-emerald-500"
          />
          <span className="w-14 text-right font-mono text-emerald-400 text-sm">
            {config.max_risk_rounds} {t('rounds', language)}
          </span>
        </div>
      </div>

      {/* 4. 风险偏好 */}
      <SectionTitle icon={Shield} title={t('riskTitle', language)} />

      <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:gap-3 pb-3 fade-divider-b">
        {RISK_OPTIONS.map(({ value, labelKey, descKey }) => {
          const selected = config.risk_preference === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => update('risk_preference', value)}
              disabled={disabled}
              className="relative overflow-hidden text-left p-3 rounded-xl transition-all disabled:opacity-50"
              style={selected ? glassSelected : undefined}
            >
              <div className="text-sm font-medium text-nofx-text">{t(labelKey, language)}</div>
              <div className="text-xs text-nofx-text-muted mt-0.5">{t(descKey, language)}</div>
            </button>
          )
        })}
      </div>

      {/* 5. 决策周期（底部统计） */}
      <div className="flex items-center gap-2 py-3 text-xs text-nofx-text-muted">
        <span>{t('costTitle', language)}:</span>
        <span className="font-mono text-base text-emerald-400 font-semibold">{totalCalls}</span>
        <span>{t('costCalls', language)}</span>
      </div>
    </div>
  )
}
