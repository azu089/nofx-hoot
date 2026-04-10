import { useState, useRef, useEffect } from 'react'
import { Shield, AlertTriangle, ChevronDown, Check } from 'lucide-react'
import type { RiskControlConfig } from '../../types'
import { NumericInput } from './NumericInput'

interface RiskControlEditorProps {
  config: RiskControlConfig
  onChange: (config: RiskControlConfig) => void
  disabled?: boolean
  language: string
}

// 定义在组件外，避免每次渲染都创建新组件类型导致子输入框 unmount/remount 丢失焦点
const Row = ({
  label,
  desc,
  children,
  stacked,
}: {
  label: string
  desc?: string
  children: React.ReactNode
  stacked?: boolean
}) => (
  <div
    className={`flex ${stacked ? 'flex-col md:flex-row md:items-center' : 'items-center'} justify-between gap-2 md:gap-4 py-3 fade-divider-b`}
  >
    <div className="flex-1 min-w-0">
      <div className="text-sm text-nofx-text">{label}</div>
      {desc && <div className="text-xs text-nofx-text-muted mt-0.5">{desc}</div>}
    </div>
    <div className={stacked ? 'w-full md:w-auto md:flex-shrink-0' : 'flex-shrink-0'}>
      {children}
    </div>
  </div>
)

export function RiskControlEditor({
  config,
  onChange,
  disabled,
  language,
}: RiskControlEditorProps) {
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      positionLimits: { zh: '仓位限制', en: 'Position Limits' },
      maxPositions: { zh: '最大持仓数量', en: 'Max Positions' },
      maxPositionsDesc: { zh: '同时持有的最大币种数量', en: 'Maximum coins held simultaneously' },
      tradingLeverage: { zh: '交易杠杆（交易所杠杆）', en: 'Trading Leverage (Exchange)' },
      btcEthLeverage: { zh: 'BTC/ETH 交易杠杆', en: 'BTC/ETH Trading Leverage' },
      btcEthLeverageDesc: { zh: '交易所开仓使用的杠杆倍数', en: 'Exchange leverage for opening positions' },
      altcoinLeverage: { zh: '山寨币交易杠杆', en: 'Altcoin Trading Leverage' },
      altcoinLeverageDesc: { zh: '交易所开仓使用的杠杆倍数', en: 'Exchange leverage for opening positions' },
      positionValueRatio: { zh: '仓位价值比例（代码强制）', en: 'Position Value Ratio (CODE ENFORCED)' },
      positionValueRatioDesc: { zh: '单仓位名义价值 / 账户净值，由代码强制执行', en: 'Position notional value / equity, enforced by code' },
      btcEthPositionValueRatio: { zh: 'BTC/ETH 仓位价值比例', en: 'BTC/ETH Position Value Ratio' },
      btcEthPositionValueRatioDesc: { zh: '单仓最大名义价值 = 净值 × 此值', en: 'Max = equity × this ratio' },
      altcoinPositionValueRatio: { zh: '山寨币仓位价值比例', en: 'Altcoin Position Value Ratio' },
      altcoinPositionValueRatioDesc: { zh: '单仓最大名义价值 = 净值 × 此值', en: 'Max = equity × this ratio' },
      riskParameters: { zh: '风险参数', en: 'Risk Parameters' },
      minRiskReward: { zh: '最小风险回报比', en: 'Min Risk/Reward Ratio' },
      minRiskRewardDesc: { zh: '开仓要求的最低盈亏比', en: 'Minimum profit ratio for opening' },
      maxMarginUsage: { zh: '最大保证金使用率', en: 'Max Margin Usage' },
      maxMarginUsageDesc: { zh: '保证金使用率上限，由代码强制执行', en: 'Maximum margin utilization, enforced by code' },
      entryRequirements: { zh: '开仓要求', en: 'Entry Requirements' },
      minPositionSize: { zh: '最小开仓金额', en: 'Min Position Size' },
      minPositionSizeDesc: { zh: 'USDT 最小名义价值', en: 'Minimum notional value in USDT' },
      minConfidence: { zh: '最小信心度', en: 'Min Confidence' },
      minConfidenceDesc: { zh: 'AI 开仓信心度阈值', en: 'AI confidence threshold for entry' },
      minHoldSeconds: { zh: '持仓保护期', en: 'Hold Protection Period' },
      minHoldSecondsDesc: { zh: '开仓后需等待的最短时间，期间系统禁止平仓（防止噪音触发过早退出）', en: 'Minimum time after opening before the system allows closing (prevents noise-triggered early exits)' },
      strategyMode: { zh: 'AI 交易模式', en: 'AI Trading Mode' },
      strategyModeDesc: { zh: '控制 AI 开仓的谨慎程度', en: 'Controls how cautiously the AI opens positions' },
      modeHighWinRate: { zh: '只做确定', en: 'High Conviction' },
      modeInstitutional: { zh: '多重验证', en: 'Multi Verification' },
      modeAggressive: { zh: '信任 AI', en: 'Trust AI' },
      modeBalanced: { zh: '平衡收益', en: 'Balanced' },
    }
    return translations[key]?.[language] || key
  }

  const updateField = <K extends keyof RiskControlConfig>(
    key: K,
    value: RiskControlConfig[K]
  ) => {
    if (!disabled) {
      onChange({ ...config, [key]: value })
    }
  }

  // 自定义下拉（修复 backdrop-filter 下 native select 位置漂移）
  const [modeOpen, setModeOpen] = useState(false)
  const modeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const modeOptions: { value: RiskControlConfig['mode']; label: string }[] = [
    { value: 'high_win_rate', label: t('modeHighWinRate') },
    { value: 'institutional', label: t('modeInstitutional') },
    { value: 'aggressive', label: t('modeAggressive') },
    { value: 'balanced', label: t('modeBalanced') },
  ]
  const currentMode = modeOptions.find((m) => m.value === (config.mode || 'balanced'))

  const numberInputCls =
    'w-24 px-3 py-2 rounded-lg bg-transparent border border-emerald-400/30 focus:border-emerald-400/60 focus:outline-none text-nofx-text'

  const SectionTitle = ({
    icon: Icon,
    title,
    color,
  }: {
    icon: typeof Shield
    title: string
    color: string
  }) => (
    <div className="flex items-center gap-2 mt-2 mb-1">
      <Icon className="w-4 h-4" style={{ color }} />
      <h3 className="text-sm font-medium text-nofx-text">{title}</h3>
    </div>
  )

  const SubLabel = ({ label }: { label: string }) => (
    <div className="text-xs text-nofx-text-muted mt-2 mb-1 uppercase tracking-wider">{label}</div>
  )

  return (
    <div className="space-y-2">
      {/* 仓位限制 */}
      <SectionTitle icon={Shield} title={t('positionLimits')} color="#10B981" />

      <Row label={t('maxPositions')} desc={t('maxPositionsDesc')}>
        <NumericInput
          integer
          value={config.max_positions ?? 3}
          onCommit={(v) => updateField('max_positions', v)}
          disabled={disabled}
          min={1}
          max={10}
          className={numberInputCls}
        />
      </Row>

      {/* 交易杠杆 */}
      <SubLabel label={t('tradingLeverage')} />

      <Row label={t('btcEthLeverage')} desc={t('btcEthLeverageDesc')} stacked>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={config.btc_eth_max_leverage ?? 5}
            onChange={(e) => updateField('btc_eth_max_leverage', parseInt(e.target.value))}
            disabled={disabled}
            min={1}
            max={20}
            className="flex-1 min-w-0 md:min-w-[120px] md:max-w-[220px] accent-emerald-500"
          />
          <span className="w-10 text-right font-mono text-emerald-400 text-sm">
            {config.btc_eth_max_leverage ?? 5}x
          </span>
        </div>
      </Row>

      <Row label={t('altcoinLeverage')} desc={t('altcoinLeverageDesc')} stacked>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={config.altcoin_max_leverage ?? 5}
            onChange={(e) => updateField('altcoin_max_leverage', parseInt(e.target.value))}
            disabled={disabled}
            min={1}
            max={20}
            className="flex-1 min-w-0 md:min-w-[120px] md:max-w-[220px] accent-emerald-500"
          />
          <span className="w-10 text-right font-mono text-emerald-400 text-sm">
            {config.altcoin_max_leverage ?? 5}x
          </span>
        </div>
      </Row>

      {/* 仓位价值比例 */}
      <SubLabel label={t('positionValueRatio')} />
      <div className="text-xs text-nofx-text-muted mb-1">{t('positionValueRatioDesc')}</div>

      <Row label={t('btcEthPositionValueRatio')} desc={t('btcEthPositionValueRatioDesc')} stacked>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={config.btc_eth_max_position_value_ratio ?? 5}
            onChange={(e) =>
              updateField('btc_eth_max_position_value_ratio', parseFloat(e.target.value))
            }
            disabled={disabled}
            min={0.5}
            max={10}
            step={0.5}
            className="flex-1 min-w-0 md:min-w-[120px] md:max-w-[220px] accent-emerald-500"
          />
          <span className="w-10 text-right font-mono text-emerald-400 text-sm">
            {config.btc_eth_max_position_value_ratio ?? 5}x
          </span>
        </div>
      </Row>

      <Row label={t('altcoinPositionValueRatio')} desc={t('altcoinPositionValueRatioDesc')} stacked>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={config.altcoin_max_position_value_ratio ?? 1}
            onChange={(e) =>
              updateField('altcoin_max_position_value_ratio', parseFloat(e.target.value))
            }
            disabled={disabled}
            min={0.5}
            max={10}
            step={0.5}
            className="flex-1 min-w-0 md:min-w-[120px] md:max-w-[220px] accent-emerald-500"
          />
          <span className="w-10 text-right font-mono text-emerald-400 text-sm">
            {config.altcoin_max_position_value_ratio ?? 1}x
          </span>
        </div>
      </Row>

      {/* 风险参数 */}
      <SectionTitle icon={AlertTriangle} title={t('riskParameters')} color="#F6465D" />

      <Row label={t('minRiskReward')} desc={t('minRiskRewardDesc')}>
        <div className="flex items-center gap-2">
          <span className="text-nofx-text-muted text-sm">1 :</span>
          <NumericInput
            value={config.min_risk_reward_ratio ?? 3}
            onCommit={(v) => updateField('min_risk_reward_ratio', v)}
            disabled={disabled}
            min={1}
            max={10}
            step={0.5}
            className={numberInputCls}
          />
        </div>
      </Row>

      <Row label={t('maxMarginUsage')} desc={t('maxMarginUsageDesc')} stacked>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={(config.max_margin_usage ?? 0.9) * 100}
            onChange={(e) =>
              updateField('max_margin_usage', parseInt(e.target.value) / 100)
            }
            disabled={disabled}
            min={10}
            max={100}
            className="flex-1 min-w-0 md:min-w-[120px] md:max-w-[220px] accent-emerald-500"
          />
          <span className="w-10 text-right font-mono text-emerald-400 text-sm">
            {Math.round((config.max_margin_usage ?? 0.9) * 100)}%
          </span>
        </div>
      </Row>

      {/* 开仓要求 */}
      <SectionTitle icon={Shield} title={t('entryRequirements')} color="#10B981" />

      <Row label={t('minPositionSize')} desc={t('minPositionSizeDesc')}>
        <div className="flex items-center gap-2">
          <NumericInput
            value={config.min_position_size ?? 12}
            onCommit={(v) => updateField('min_position_size', v)}
            disabled={disabled}
            min={10}
            max={1000}
            className={numberInputCls}
          />
          <span className="text-nofx-text-muted text-sm">USDT</span>
        </div>
      </Row>

      <Row label={t('minConfidence')} desc={t('minConfidenceDesc')} stacked>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={config.min_confidence ?? 75}
            onChange={(e) => updateField('min_confidence', parseInt(e.target.value))}
            disabled={disabled}
            min={50}
            max={100}
            className="flex-1 min-w-0 md:min-w-[120px] md:max-w-[220px] accent-emerald-500"
          />
          <span className="w-10 text-right font-mono text-emerald-400 text-sm">
            {config.min_confidence ?? 75}
          </span>
        </div>
      </Row>

      <Row label={t('minHoldSeconds')} desc={t('minHoldSecondsDesc')}>
        <div className="flex items-center gap-2">
          <NumericInput
            integer
            value={config.min_hold_seconds ?? 720}
            onCommit={(v) => updateField('min_hold_seconds', v)}
            disabled={disabled}
            min={720}
            step={60}
            className={numberInputCls}
          />
          <span className="text-nofx-text-muted text-sm whitespace-nowrap">
            秒（{Math.floor((config.min_hold_seconds ?? 720) / 60)} 分钟）
          </span>
        </div>
      </Row>

      {/* 策略模式 */}
      <SectionTitle icon={AlertTriangle} title={t('strategyMode')} color="#F0B90B" />

      <Row label={t('strategyModeDesc')} desc="">
        <div className="relative" ref={modeRef}>
          <button
            type="button"
            onClick={() => !disabled && setModeOpen(!modeOpen)}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent border border-emerald-400/30 hover:border-emerald-400/60 focus:outline-none text-nofx-text text-sm min-w-[130px] justify-between"
          >
            <span>{currentMode?.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-nofx-text-muted transition-transform ${modeOpen ? 'rotate-180' : ''}`} />
          </button>
          {modeOpen && (
            <div
              className="rounded-lg overflow-hidden py-1"
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 4px)',
                right: 0,
                minWidth: '150px',
                zIndex: 50,
                backgroundColor: 'rgba(20, 28, 38, 0.98)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {modeOptions.map((opt) => {
                const active = (config.mode || 'balanced') === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      updateField('mode', opt.value)
                      setModeOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors ${active ? 'text-emerald-400' : 'text-nofx-text'}`}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="w-3.5 h-3.5" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Row>
    </div>
  )
}
