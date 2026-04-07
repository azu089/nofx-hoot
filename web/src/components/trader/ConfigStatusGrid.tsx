import {
  Brain,
  Landmark,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react'
import type { AIModel, Exchange, ExchangeAccountState } from '../../types'
import type { Language } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { getModelIcon } from '../common/ModelIcons'
import { getExchangeIcon } from '../common/ExchangeIcons'
import {
  getShortName,
  AI_PROVIDER_CONFIG,
  truncateAddress,
} from './model-constants'

interface UsageInfo {
  runningCount: number
  totalCount: number
}

interface ConfigStatusGridProps {
  configuredModels: AIModel[]
  configuredExchanges: Exchange[]
  exchangeAccountStates?: Record<string, ExchangeAccountState>
  isExchangeAccountStatesLoading?: boolean
  visibleExchangeAddresses: Set<string>
  copiedId: string | null
  language: Language
  isModelInUse: (modelId: string) => boolean | undefined
  getModelUsageInfo: (modelId: string) => UsageInfo
  isExchangeInUse: (exchangeId: string) => boolean | undefined
  getExchangeUsageInfo: (exchangeId: string) => UsageInfo
  onModelClick: (modelId: string) => void
  onExchangeClick: (exchangeId: string) => void
  onToggleExchangeAddress: (exchangeId: string) => void
  onCopyAddress: (id: string, address: string) => void
}

export function ConfigStatusGrid({
  configuredModels,
  configuredExchanges,
  exchangeAccountStates,
  isExchangeAccountStatesLoading,
  visibleExchangeAddresses,
  copiedId,
  language,
  isModelInUse,
  getModelUsageInfo,
  isExchangeInUse,
  getExchangeUsageInfo,
  onModelClick,
  onExchangeClick,
  onToggleExchangeAddress,
  onCopyAddress,
}: ConfigStatusGridProps) {
  const getExchangeStateMeta = (state: ExchangeAccountState | undefined) => {
    if (!state) {
      return {
        label: language === 'zh' ? '未检查' : 'NOT CHECKED',
        className: 'text-zinc-400 border-zinc-700/80 bg-zinc-900/40',
      }
    }

    switch (state.status) {
      case 'ok':
        return {
          label: state.display_balance || '0',
          className: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10',
        }
      case 'disabled':
        return {
          label: language === 'zh' ? '已禁用' : 'DISABLED',
          className: 'text-zinc-400 border-zinc-700/80 bg-zinc-900/40',
        }
      case 'missing_credentials':
        return {
          label: language === 'zh' ? '配置不完整' : 'INCOMPLETE',
          className: 'text-amber-300 border-amber-500/20 bg-amber-500/10',
        }
      case 'invalid_credentials':
        return {
          label: language === 'zh' ? '密钥无效' : 'INVALID KEYS',
          className: 'text-rose-300 border-rose-500/20 bg-rose-500/10',
        }
      case 'permission_denied':
        return {
          label: language === 'zh' ? '无余额权限' : 'NO PERMISSION',
          className: 'text-orange-300 border-orange-500/20 bg-orange-500/10',
        }
      default:
        return {
          label: language === 'zh' ? '暂时无法获取' : 'UNAVAILABLE',
          className: 'text-zinc-300 border-zinc-600/60 bg-zinc-800/50',
        }
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {/* AI Models 气泡 */}
      <section className="bubble-card p-3">
        <div>
          {configuredModels.map((model) => {
            const inUse = isModelInUse(model.id)
            const usageInfo = getModelUsageInfo(model.id)
            return (
              <div
                key={model.id}
                className={`row-divider group flex items-center justify-between gap-3 px-2 py-2.5 rounded-lg transition-all ${inUse ? 'opacity-80' : 'hover:bg-white/5 cursor-pointer'
                  }`}
                onClick={() => onModelClick(model.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center bg-black border border-white/10 flex-shrink-0">
                    {getModelIcon(model.provider || model.id, { width: 18, height: 18 }) || (
                      <span className="text-xs font-bold text-indigo-400">{getShortName(model.name)[0]}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-100 truncate">
                      {getShortName(model.name)}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {model.customModelName || AI_PROVIDER_CONFIG[model.provider]?.defaultModel || ''}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {usageInfo.totalCount > 0 ? (
                    <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${usageInfo.runningCount > 0
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                      {usageInfo.runningCount}/{usageInfo.totalCount} {language === 'zh' ? '运行' : 'ACTIVE'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500">
                      {language === 'zh' ? '未使用' : 'IDLE'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {configuredModels.length === 0 && (
            <div className="text-center py-6 rounded-lg">
              <Brain className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
              <div className="text-xs text-zinc-500">{t('noModelsConfigured', language)}</div>
            </div>
          )}
        </div>
      </section>

      {/* Exchanges 气泡 */}
      <section className="bubble-card p-3">
        <div>
          {configuredExchanges.map((exchange) => {
            const inUse = isExchangeInUse(exchange.id)
            const usageInfo = getExchangeUsageInfo(exchange.id)
            const state = exchangeAccountStates?.[exchange.id]
            const stateMeta = getExchangeStateMeta(state)
            return (
              <div
                key={exchange.id}
                className={`row-divider group flex items-center justify-between gap-3 px-2 py-2.5 rounded-lg transition-all ${inUse ? 'opacity-80' : 'hover:bg-white/5 cursor-pointer'
                  }`}
                onClick={() => onExchangeClick(exchange.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center bg-black border border-white/10 flex-shrink-0">
                    {getExchangeIcon(exchange.exchange_type || exchange.id, { width: 18, height: 18 })}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-100 truncate flex items-center gap-1.5">
                      <span>{exchange.exchange_type?.toUpperCase() || getShortName(exchange.name)}</span>
                      <span className="text-[9px] text-zinc-500 px-1 py-0.5 rounded bg-white/5 font-normal">
                        {exchange.account_name || (exchange.type?.toUpperCase() || 'CEX')}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] truncate">
                      <span className={`px-1.5 py-0.5 rounded ${stateMeta.className}`}>
                        {isExchangeAccountStatesLoading && !state
                          ? (language === 'zh' ? '检查中…' : 'Checking…')
                          : stateMeta.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {/* DEX 钱包地址 */}
                  {(() => {
                    const walletAddr = exchange.hyperliquidWalletAddr || exchange.asterUser || exchange.lighterWalletAddr
                    if (exchange.type !== 'dex' || !walletAddr) return null
                    const isVisible = visibleExchangeAddresses.has(exchange.id)
                    const isCopied = copiedId === `exchange-${exchange.id}`

                    return (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded">
                          {isVisible ? walletAddr : truncateAddress(walletAddr)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleExchangeAddress(exchange.id) }}
                          className="text-zinc-600 hover:text-zinc-300"
                        >
                          {isVisible ? <EyeOff size={10} /> : <Eye size={10} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopyAddress(`exchange-${exchange.id}`, walletAddr) }}
                          className="text-zinc-600 hover:text-nofx-gold"
                        >
                          {isCopied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                        </button>
                      </div>
                    )
                  })()}

                  {usageInfo.totalCount > 0 ? (
                    <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${usageInfo.runningCount > 0
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                      {usageInfo.runningCount}/{usageInfo.totalCount} {language === 'zh' ? '运行' : 'ACTIVE'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500">
                      {language === 'zh' ? '未使用' : 'IDLE'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {configuredExchanges.length === 0 && (
            <div className="text-center py-6 rounded-lg">
              <Landmark className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
              <div className="text-xs text-zinc-500">{t('noExchangesConfigured', language)}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
