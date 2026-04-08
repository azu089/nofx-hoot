import { useState, useEffect } from 'react'
import type { AIModel, Exchange, CreateTraderRequest, Strategy } from '../../types'
import { useLanguage } from '../../contexts/LanguageContext'
import { t } from '../../i18n/translations'
import { toast } from 'sonner'
import { Pencil, Plus, X as IconX, Sparkles, ExternalLink, UserPlus } from 'lucide-react'
import { httpClient } from '../../lib/httpClient'
import { NexoraSelect } from '../common/NexoraSelect'

// 提取下划线后面的名称部分
function getShortName(fullName: string): string {
  const parts = fullName.split('_')
  return parts.length > 1 ? parts[parts.length - 1] : fullName
}

// 交易所注册链接配置
const EXCHANGE_REGISTRATION_LINKS: Record<string, { url: string; hasReferral?: boolean }> = {
  binance: { url: 'https://www.binance.com/join?ref=NOFXENG', hasReferral: true },
  okx: { url: 'https://www.okx.com/join/1865360', hasReferral: true },
  bybit: { url: 'https://partner.bybit.com/b/83856', hasReferral: true },
  hyperliquid: { url: 'https://app.hyperliquid.xyz/join/AITRADING', hasReferral: true },
  aster: { url: 'https://www.asterdex.com/en/referral/fdfc0e', hasReferral: true },
  lighter: { url: 'https://app.lighter.xyz/?referral=68151432', hasReferral: true },
}

import type { TraderConfigData } from '../../types'

// 表单内部状态类型
interface FormState {
  trader_id?: string
  trader_name: string
  ai_model: string
  exchange_id: string
  strategy_id: string
  is_cross_margin: boolean
  show_in_competition: boolean
  scan_interval_minutes: number
  initial_balance?: number
}

interface TraderConfigModalProps {
  isOpen: boolean
  onClose: () => void
  traderData?: TraderConfigData | null
  isEditMode?: boolean
  availableModels?: AIModel[]
  availableExchanges?: Exchange[]
  onSave?: (data: CreateTraderRequest) => Promise<void>
}

export function TraderConfigModal({
  isOpen,
  onClose,
  traderData,
  isEditMode = false,
  availableModels = [],
  availableExchanges = [],
  onSave,
}: TraderConfigModalProps) {
  const { language } = useLanguage()
  const [formData, setFormData] = useState<FormState>({
    trader_name: '',
    ai_model: '',
    exchange_id: '',
    strategy_id: '',
    is_cross_margin: true,
    show_in_competition: true,
    scan_interval_minutes: 3,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [isFetchingBalance, setIsFetchingBalance] = useState(false)
  const [balanceFetchError, setBalanceFetchError] = useState<string>('')

  // 获取用户的策略列表
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const result = await httpClient.get<{ strategies: Strategy[] }>('/api/strategies')
        if (result.success && result.data?.strategies) {
          const strategyList = result.data.strategies
          setStrategies(strategyList)
          // 如果没有选择策略，默认选中激活的策略
          if (!formData.strategy_id && !isEditMode) {
            const activeStrategy = strategyList.find(s => s.is_active)
            if (activeStrategy) {
              setFormData(prev => ({ ...prev, strategy_id: activeStrategy.id }))
            } else if (strategyList.length > 0) {
              setFormData(prev => ({ ...prev, strategy_id: strategyList[0].id }))
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch strategies:', error)
      }
    }
    if (isOpen) {
      fetchStrategies()
    }
  }, [isOpen])

  useEffect(() => {
    if (traderData) {
      setFormData({
        ...traderData,
        strategy_id: traderData.strategy_id || '',
      })
    } else if (!isEditMode) {
      setFormData({
        trader_name: '',
        ai_model: availableModels[0]?.id || '',
        exchange_id: availableExchanges[0]?.id || '',
        strategy_id: '',
        is_cross_margin: true,
        show_in_competition: true,
        scan_interval_minutes: 3,
      })
    }
  }, [traderData, isEditMode, availableModels, availableExchanges])

  if (!isOpen) return null

  const handleInputChange = (field: keyof FormState, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFetchCurrentBalance = async () => {
    if (!isEditMode || !traderData?.trader_id) {
       setBalanceFetchError(t('fetchBalanceEditModeOnly', language))
      return
    }

    setIsFetchingBalance(true)
    setBalanceFetchError('')

    try {
      const result = await httpClient.get<{
        total_equity?: number
        balance?: number
      }>(`/api/account?trader_id=${traderData.trader_id}`)

      if (result.success && result.data) {
        const currentBalance =
          result.data.total_equity || result.data.balance || 0
        setFormData((prev) => ({ ...prev, initial_balance: currentBalance }))
        toast.success(t('balanceFetched', language))
      } else {
        throw new Error(result.message || t('balanceFetchFailed', language))
      }
    } catch (error) {
      console.error(t('balanceFetchFailed', language) + ':', error)
       setBalanceFetchError(t('balanceFetchNetworkError', language))
    } finally {
      setIsFetchingBalance(false)
    }
  }

  const handleSave = async () => {
    if (!onSave) return

    setIsSaving(true)
    try {
      const saveData: CreateTraderRequest = {
        name: formData.trader_name,
        ai_model_id: formData.ai_model,
        exchange_id: formData.exchange_id,
        strategy_id: formData.strategy_id,
        is_cross_margin: formData.is_cross_margin,
        show_in_competition: formData.show_in_competition,
        scan_interval_minutes: formData.scan_interval_minutes,
      }

      // 只在编辑模式时包含initial_balance
      if (isEditMode && formData.initial_balance !== undefined) {
        saveData.initial_balance = formData.initial_balance
      }

      await toast.promise(onSave(saveData), {
        loading: t('saving', language),
        success: t('saveSuccess', language),
        error: t('saveFailed', language),
      })
      onClose()
    } catch (error) {
       console.error(t('saveFailed', language) + ':', error)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedStrategy = strategies.find(s => s.id === formData.strategy_id)

  return (
    <div className="nexora-modal-backdrop">
      <div
        className="bubble-card max-w-2xl w-full my-8 overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-[0_0_16px_rgba(43,232,158,0.2)]">
              {isEditMode ? (
                <Pencil className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">
                {isEditMode ? t('editTrader', language) : t('createTrader', language)}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {isEditMode ? t('editTraderConfig', language) : t('selectStrategyAndConfigParams', language)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div
          className="p-6 space-y-6 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 16rem)' }}
        >
          {/* Basic Info */}
          <div className="bubble-card p-5">
            <h3 className="text-base font-medium text-white mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-xs font-medium flex items-center justify-center">1</span> {t('basicConfig', language)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white block mb-2">
                  {t('traderNameRequired', language)}
                </label>
                <input
                  type="text"
                  value={formData.trader_name}
                  onChange={(e) =>
                    handleInputChange('trader_name', e.target.value)
                  }
                  className="nexora-input"
                   placeholder={t('enterTraderNamePlaceholder', language)}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white block mb-2">
                  {t('aiModelRequired', language)}
                  </label>
                  <NexoraSelect
                    value={formData.ai_model}
                    onChange={(v) => handleInputChange('ai_model', v)}
                    options={availableModels.map((model) => ({
                      value: model.id,
                      label: getShortName(model.name || model.id),
                    }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-white block mb-2">
                  {t('exchangeRequired', language)}
                  </label>
                  <NexoraSelect
                    value={formData.exchange_id}
                    onChange={(v) => handleInputChange('exchange_id', v)}
                    options={availableExchanges.map((exchange) => ({
                      value: exchange.id,
                      label:
                        getShortName(exchange.name || exchange.exchange_type || exchange.id) +
                        (exchange.account_name ? ` - ${exchange.account_name}` : ''),
                    }))}
                  />
                  {/* Exchange Registration Link */}
                  {formData.exchange_id && (() => {
                    // Find the selected exchange to get its type
                    const selectedExchange = availableExchanges.find(e => e.id === formData.exchange_id)
                    const exchangeType = selectedExchange?.exchange_type?.toLowerCase() || ''
                    const regLink = EXCHANGE_REGISTRATION_LINKS[exchangeType]
                    if (!regLink) return null
                    return (
                      <a
                        href={regLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-300 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{t('noExchangeAccount', language)}</span>
                        {regLink.hasReferral && (
                          <span className="px-1.5 py-0.5 bg-emerald-400/10 text-emerald-300 rounded text-[10px]">
                            {t('discount', language)}
                          </span>
                        )}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Selection */}
          <div className="bubble-card p-5">
            <h3 className="text-base font-medium text-white mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-xs font-medium flex items-center justify-center">2</span> {t('selectTradingStrategy', language)}
              <Sparkles className="w-4 h-4 text-zinc-500" />
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white block mb-2">
                  {t('useStrategy', language)}
                </label>
                <NexoraSelect
                  value={formData.strategy_id}
                  onChange={(v) => handleInputChange('strategy_id', v)}
                  placeholder={t('noStrategyManual', language)}
                  options={[
                    { value: '', label: t('noStrategyManual', language) },
                    ...strategies.map((strategy) => ({
                      value: strategy.id,
                      label:
                        strategy.name +
                        (strategy.is_active ? t('strategyActive', language) : '') +
                        (strategy.is_default ? t('strategyDefault', language) : ''),
                    })),
                  ]}
                />
                {strategies.length === 0 && (
                    <p className="text-[10px] text-zinc-500 mt-2">
                      {t('noStrategyHint', language)}
                  </p>
                )}
              </div>

              {/* Strategy Preview — 悬空，无嵌套方框 */}
              {selectedStrategy && (
                <div className="mt-3 px-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-zinc-300 text-xs font-medium">
                      {t('strategyDetails', language)}
                    </span>
                    {selectedStrategy.is_active && (
                      <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 text-[10px] rounded-full border border-emerald-500/30">
                        {t('activating', language)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mb-2">
                    {selectedStrategy.description || (language === 'zh' ? '无描述' : 'No description')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
                    <div>
                      {t('coinSource', language)}: {selectedStrategy.config.coin_source.source_type === 'static' ? '固定币种' :
                        selectedStrategy.config.coin_source.source_type === 'ai500' ? 'AI500' :
                        selectedStrategy.config.coin_source.source_type === 'oi_top' ? 'OI Top' : '混合'}
                    </div>
                    <div>
                      {t('marginLimit', language)}: {((selectedStrategy.config.risk_control?.max_margin_usage || 0.9) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trading Parameters */}
          <div className="bubble-card p-5">
            <h3 className="text-base font-medium text-white mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-xs font-medium flex items-center justify-center">3</span> {t('tradingParams', language)}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-start">
                <div>
                  <label className="text-xs text-white block mb-2 h-4 whitespace-nowrap overflow-hidden text-ellipsis">
                    {t('marginMode', language)}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleInputChange('is_cross_margin', true)}
                      className={`flex-1 px-3 py-2.5 rounded-full text-xs ${
                        formData.is_cross_margin
                          ? 'bg-emerald-400 text-black shadow-[0_0_16px_rgba(43,232,158,0.3)]'
                          : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {t('crossMargin', language)}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleInputChange('is_cross_margin', false)
                      }
                      className={`flex-1 px-3 py-2.5 rounded-full text-xs ${
                        !formData.is_cross_margin
                          ? 'bg-emerald-400 text-black shadow-[0_0_16px_rgba(43,232,158,0.3)]'
                          : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {t('isolatedMargin', language)}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white block mb-2 h-4 whitespace-nowrap overflow-hidden text-ellipsis" title={t('aiScanInterval', language)}>
                    {t('aiScanInterval', language)}
                  </label>
                  <input
                    type="number"
                    value={formData.scan_interval_minutes}
                    onChange={(e) => {
                      const parsedValue = Number(e.target.value)
                      const safeValue = Number.isFinite(parsedValue)
                        ? Math.max(3, parsedValue)
                        : 3
                      handleInputChange('scan_interval_minutes', safeValue)
                    }}
                    className="nexora-input"
                    min="3"
                    max="60"
                    step="1"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1.5">
                    {t('scanIntervalRecommend', language)}
                  </p>
                </div>
              </div>

              {/* Competition visibility */}
              <div>
                <label className="text-xs text-white block mb-2">
                  {t('competitionDisplay', language)}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleInputChange('show_in_competition', true)}
                    className={`flex-1 px-3 py-2.5 rounded-full text-xs ${
                      formData.show_in_competition
                        ? 'bg-emerald-400 text-black shadow-[0_0_16px_rgba(43,232,158,0.3)]'
                        : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {t('show', language)}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('show_in_competition', false)}
                    className={`flex-1 px-3 py-2.5 rounded-full text-xs ${
                      !formData.show_in_competition
                        ? 'bg-emerald-400 text-black shadow-[0_0_16px_rgba(43,232,158,0.3)]'
                        : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {t('hide', language)}
                  </button>
                </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {t('hiddenInCompetition', language)}
                </p>
              </div>

              {/* Initial Balance (Edit mode only) */}
              {isEditMode && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-white">
                      {t('initialBalanceLabel', language)}
                    </label>
                    <button
                      type="button"
                      onClick={handleFetchCurrentBalance}
                      disabled={isFetchingBalance}
                      className="px-3 py-1 text-xs bg-emerald-400/15 text-emerald-300 rounded-full border border-emerald-400/30 hover:bg-emerald-400/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isFetchingBalance ? t('fetching', language) : t('fetchCurrentBalance', language)}
                    </button>
                  </div>
                  <input
                    type="number"
                    value={formData.initial_balance || 0}
                    onChange={(e) =>
                      handleInputChange(
                        'initial_balance',
                        Number(e.target.value)
                      )
                    }
                    className="nexora-input"
                    min="100"
                    step="0.01"
                  />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {t('balanceUpdateHint', language)}
                  </p>
                  {balanceFetchError && (
                    <p className="text-xs text-red-500 mt-1">
                      {balanceFetchError}
                    </p>
                  )}
                </div>
              )}

              {/* Create mode info — 悬空无方框 */}
              {!isEditMode && (
                <div className="flex items-center gap-2 px-1 pt-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="8" y2="12" />
                    <line x1="12" x2="12.01" y1="16" y2="16" />
                  </svg>
                  <span className="text-[11px] text-zinc-500">
                    {t('autoFetchBalanceInfo', language)}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-full text-sm font-medium bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 transition-all"
          >
            {t('cancel', language)}
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={
                isSaving ||
                !formData.trader_name ||
                !formData.ai_model ||
                !formData.exchange_id
              }
              className="btn-emerald px-8 py-3 rounded-full text-sm"
            >
              {isSaving ? t('saving', language) : isEditMode ? t('editTrader', language) : t('createTraderButton', language)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

