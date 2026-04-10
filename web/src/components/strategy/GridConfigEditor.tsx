import { useState, useRef, useEffect } from 'react'
import { Grid, DollarSign, TrendingUp, Shield, Compass, ChevronDown, Check } from 'lucide-react'
import type { GridStrategyConfig } from '../../types'
import { NumericInput } from './NumericInput'

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

// 自定义下拉 — 向上展开，避开下方 sibling 气泡的遮挡
function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const current = options.find((o) => o.value === value)
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent border border-emerald-400/30 hover:border-emerald-400/60 focus:outline-none text-nofx-text text-sm min-w-[130px] justify-between disabled:opacity-50"
      >
        <span>{current?.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-nofx-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
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
          {options.map((opt) => {
            const active = value === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
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
  )
}

interface GridConfigEditorProps {
  config: GridStrategyConfig
  onChange: (config: GridStrategyConfig) => void
  disabled?: boolean
  language: string
}

export const defaultGridConfig: GridStrategyConfig = {
  symbol: 'BTCUSDT',
  grid_count: 10,
  total_investment: 1000,
  leverage: 5,
  upper_price: 0,
  lower_price: 0,
  use_atr_bounds: true,
  atr_multiplier: 2.0,
  distribution: 'gaussian',
  max_drawdown_pct: 15,
  stop_loss_pct: 5,
  daily_loss_limit_pct: 10,
  use_maker_only: true,
  enable_direction_adjust: false,
  direction_bias_ratio: 0.7,
}

export function GridConfigEditor({
  config,
  onChange,
  disabled,
  language,
}: GridConfigEditorProps) {
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      tradingPair: { zh: '交易设置', en: 'Trading Setup' },
      gridParameters: { zh: '网格参数', en: 'Grid Parameters' },
      priceBounds: { zh: '价格边界', en: 'Price Bounds' },
      riskControl: { zh: '风险控制', en: 'Risk Control' },

      symbol: { zh: '交易对', en: 'Trading Pair' },
      symbolDesc: { zh: '选择要进行网格交易的交易对', en: 'Select trading pair for grid trading' },

      totalInvestment: { zh: '投资金额', en: 'Investment' },
      totalInvestmentDesc: { zh: '网格策略的总投资金额 (USDT)', en: 'Total investment for grid strategy' },
      leverage: { zh: '杠杆倍数', en: 'Leverage' },
      leverageDesc: { zh: '交易使用的杠杆倍数 (1-5)', en: 'Leverage for trading (1-5)' },

      gridCount: { zh: '网格数量', en: 'Grid Count' },
      gridCountDesc: { zh: '网格层级数量 (5-50)', en: 'Number of grid levels (5-50)' },
      distribution: { zh: '资金分配方式', en: 'Distribution' },
      distributionDesc: { zh: '网格层级的资金分配方式', en: 'Fund allocation across grid levels' },
      uniform: { zh: '均匀分配', en: 'Uniform' },
      gaussian: { zh: '高斯分配 (推荐)', en: 'Gaussian (Recommended)' },
      pyramid: { zh: '金字塔分配', en: 'Pyramid' },

      useAtrBounds: { zh: '自动计算边界 (ATR)', en: 'Auto-calculate Bounds (ATR)' },
      useAtrBoundsDesc: { zh: '基于 ATR 自动计算网格上下边界', en: 'Auto-calculate bounds based on ATR' },
      atrMultiplier: { zh: 'ATR 倍数', en: 'ATR Multiplier' },
      atrMultiplierDesc: { zh: '边界距离当前价格的 ATR 倍数', en: 'ATR multiplier for bounds distance' },
      upperPrice: { zh: '上边界价格', en: 'Upper Price' },
      upperPriceDesc: { zh: '网格上边界价格 (0=自动)', en: 'Grid upper bound (0=auto)' },
      lowerPrice: { zh: '下边界价格', en: 'Lower Price' },
      lowerPriceDesc: { zh: '网格下边界价格 (0=自动)', en: 'Grid lower bound (0=auto)' },

      maxDrawdown: { zh: '最大回撤 (%)', en: 'Max Drawdown (%)' },
      maxDrawdownDesc: { zh: '触发紧急退出的最大回撤百分比', en: 'Max drawdown before emergency exit' },
      stopLoss: { zh: '止损 (%)', en: 'Stop Loss (%)' },
      stopLossDesc: { zh: '单仓位止损百分比', en: 'Stop loss per position' },
      dailyLossLimit: { zh: '日损失限制 (%)', en: 'Daily Loss Limit (%)' },
      dailyLossLimitDesc: { zh: '每日最大亏损百分比', en: 'Maximum daily loss percentage' },
      useMakerOnly: { zh: '仅使用 Maker 订单', en: 'Maker Only Orders' },
      useMakerOnlyDesc: { zh: '使用限价单以降低手续费', en: 'Use limit orders for lower fees' },

      directionAdjust: { zh: '方向自动调整', en: 'Direction Auto-Adjust' },
      enableDirectionAdjust: { zh: '启用方向调整', en: 'Enable Direction Adjust' },
      enableDirectionAdjustDesc: { zh: '根据箱体突破自动调整网格方向', en: 'Auto-adjust grid direction based on box breakouts' },
      directionBiasRatio: { zh: '偏向强度 (X)', en: 'Bias Strength (X)' },
      directionBiasRatioDesc: { zh: '偏多模式: X%买 + (100-X)%卖', en: 'Long bias: X% buy + (100-X)% sell' },
    }
    return translations[key]?.[language] || key
  }

  const updateField = <K extends keyof GridStrategyConfig>(
    key: K,
    value: GridStrategyConfig[K]
  ) => {
    if (!disabled) {
      onChange({ ...config, [key]: value })
    }
  }

  const numberInputCls =
    'w-24 px-3 py-2 rounded-lg bg-transparent border border-emerald-400/30 focus:border-emerald-400/60 focus:outline-none text-nofx-text text-sm'
  const selectCls =
    'px-3 py-2 rounded-lg bg-transparent border border-emerald-400/30 focus:border-emerald-400/60 focus:outline-none text-nofx-text text-sm'

  const SectionTitle = ({
    icon: Icon,
    title,
  }: {
    icon: typeof Grid
    title: string
  }) => (
    <div className="flex items-center gap-2 mt-3 mb-1">
      <Icon className="w-4 h-4 text-emerald-400" />
      <h3 className="text-sm font-medium text-nofx-text">{title}</h3>
    </div>
  )

  const Toggle = ({ on }: { on: boolean }) => (
    <div
      className="relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0"
      style={{
        background: on ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.1)',
        boxShadow: on ? '0 0 12px rgba(16, 185, 129, 0.35)' : 'none',
      }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300"
        style={{
          left: on ? '22px' : '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )

  return (
    <div className="space-y-1">
      {/* 交易设置 */}
      <SectionTitle icon={DollarSign} title={t('tradingPair')} />

      <Row label={t('symbol')} desc={t('symbolDesc')}>
        <CustomSelect
          value={config.symbol}
          onChange={(v) => updateField('symbol', v)}
          disabled={disabled}
          options={[
            { value: 'BTCUSDT', label: 'BTC/USDT' },
            { value: 'ETHUSDT', label: 'ETH/USDT' },
            { value: 'SOLUSDT', label: 'SOL/USDT' },
            { value: 'BNBUSDT', label: 'BNB/USDT' },
            { value: 'XRPUSDT', label: 'XRP/USDT' },
            { value: 'DOGEUSDT', label: 'DOGE/USDT' },
          ]}
        />
      </Row>

      <Row label={t('totalInvestment')} desc={t('totalInvestmentDesc')}>
        <NumericInput
          value={config.total_investment}
          onCommit={(v) => updateField('total_investment', v)}
          disabled={disabled}
          min={100}
          step={100}
          className={numberInputCls}
        />
      </Row>

      <Row label={t('leverage')} desc={t('leverageDesc')} stacked>
        <div className="flex items-center gap-2">
          <input
            type="range"
            value={config.leverage}
            onChange={(e) => updateField('leverage', parseInt(e.target.value))}
            disabled={disabled}
            min={1}
            max={5}
            className="flex-1 min-w-0 md:min-w-[120px] md:max-w-[220px] accent-emerald-500"
          />
          <span className="w-10 text-right font-mono text-emerald-400 text-sm">{config.leverage}x</span>
        </div>
      </Row>

      {/* 网格参数 */}
      <SectionTitle icon={Grid} title={t('gridParameters')} />

      <Row label={t('gridCount')} desc={t('gridCountDesc')}>
        <NumericInput
          integer
          value={config.grid_count}
          onCommit={(v) => updateField('grid_count', v)}
          disabled={disabled}
          min={5}
          max={50}
          className={numberInputCls}
        />
      </Row>

      <Row label={t('distribution')} desc={t('distributionDesc')}>
        <CustomSelect<'uniform' | 'gaussian' | 'pyramid'>
          value={config.distribution}
          onChange={(v) => updateField('distribution', v)}
          disabled={disabled}
          options={[
            { value: 'uniform', label: t('uniform') },
            { value: 'gaussian', label: t('gaussian') },
            { value: 'pyramid', label: t('pyramid') },
          ]}
        />
      </Row>

      {/* 价格边界 */}
      <SectionTitle icon={TrendingUp} title={t('priceBounds')} />

      <Row label={t('useAtrBounds')} desc={t('useAtrBoundsDesc')}>
        <div
          className={`cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onClick={() => updateField('use_atr_bounds', !config.use_atr_bounds)}
        >
          <Toggle on={config.use_atr_bounds} />
        </div>
      </Row>

      {config.use_atr_bounds ? (
        <Row label={t('atrMultiplier')} desc={t('atrMultiplierDesc')}>
          <NumericInput
            value={config.atr_multiplier}
            onCommit={(v) => updateField('atr_multiplier', v)}
            disabled={disabled}
            min={1}
            max={5}
            step={0.5}
            className={numberInputCls}
          />
        </Row>
      ) : (
        <>
          <Row label={t('upperPrice')} desc={t('upperPriceDesc')}>
            <NumericInput
              value={config.upper_price}
              onCommit={(v) => updateField('upper_price', v)}
              disabled={disabled}
              min={0}
              step={0.01}
              className={numberInputCls}
            />
          </Row>
          <Row label={t('lowerPrice')} desc={t('lowerPriceDesc')}>
            <NumericInput
              value={config.lower_price}
              onCommit={(v) => updateField('lower_price', v)}
              disabled={disabled}
              min={0}
              step={0.01}
              className={numberInputCls}
            />
          </Row>
        </>
      )}

      {/* 风险控制 */}
      <SectionTitle icon={Shield} title={t('riskControl')} />

      <Row label={t('maxDrawdown')} desc={t('maxDrawdownDesc')}>
        <NumericInput
          value={config.max_drawdown_pct}
          onCommit={(v) => updateField('max_drawdown_pct', v)}
          disabled={disabled}
          min={5}
          max={50}
          className={numberInputCls}
        />
      </Row>

      <Row label={t('stopLoss')} desc={t('stopLossDesc')}>
        <NumericInput
          value={config.stop_loss_pct}
          onCommit={(v) => updateField('stop_loss_pct', v)}
          disabled={disabled}
          min={1}
          max={20}
          className={numberInputCls}
        />
      </Row>

      <Row label={t('dailyLossLimit')} desc={t('dailyLossLimitDesc')}>
        <NumericInput
          value={config.daily_loss_limit_pct}
          onCommit={(v) => updateField('daily_loss_limit_pct', v)}
          disabled={disabled}
          min={1}
          max={30}
          className={numberInputCls}
        />
      </Row>

      <Row label={t('useMakerOnly')} desc={t('useMakerOnlyDesc')}>
        <div
          className={`cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onClick={() => updateField('use_maker_only', !config.use_maker_only)}
        >
          <Toggle on={config.use_maker_only} />
        </div>
      </Row>

      {/* 方向自动调整 */}
      <SectionTitle icon={Compass} title={t('directionAdjust')} />

      <Row label={t('enableDirectionAdjust')} desc={t('enableDirectionAdjustDesc')}>
        <div
          className={`cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onClick={() => updateField('enable_direction_adjust', !(config.enable_direction_adjust ?? false))}
        >
          <Toggle on={config.enable_direction_adjust ?? false} />
        </div>
      </Row>

      {config.enable_direction_adjust && (
        <Row label={t('directionBiasRatio')} desc={t('directionBiasRatioDesc')} stacked>
          <div className="flex items-center gap-2">
            <input
              type="range"
              value={(config.direction_bias_ratio ?? 0.7) * 100}
              onChange={(e) => updateField('direction_bias_ratio', parseInt(e.target.value) / 100)}
              disabled={disabled}
              min={55}
              max={90}
              step={5}
              className="flex-1 min-w-0 md:min-w-[120px] md:max-w-[220px] accent-emerald-500"
            />
            <span className="w-12 text-right font-mono text-emerald-400 text-sm">
              {Math.round((config.direction_bias_ratio ?? 0.7) * 100)}%
            </span>
          </div>
        </Row>
      )}
    </div>
  )
}
