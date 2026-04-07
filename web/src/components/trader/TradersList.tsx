import { useState, useRef, useEffect } from 'react'
import {
  Bot,
  BarChart3,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Copy,
  Check,
  MoreVertical,
  Power,
} from 'lucide-react'
import type { TraderInfo, Exchange } from '../../types'
import type { Language } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { PunkAvatar, getTraderAvatar } from '../common/PunkAvatar'
import {
  getModelDisplayName,
  getExchangeDisplayName,
  isPerpDexExchange,
  getWalletAddress,
  truncateAddress,
} from './model-constants'

interface TradersListProps {
  traders: TraderInfo[] | undefined
  isLoading: boolean
  allExchanges: Exchange[]
  configuredModelsCount: number
  configuredExchangesCount: number
  visibleTraderAddresses: Set<string>
  copiedId: string | null
  language: Language
  onTraderSelect?: (traderId: string) => void
  onNavigate: (path: string) => void
  onEditTrader: (traderId: string) => void
  onToggleTrader: (traderId: string, running: boolean) => void
  onToggleCompetition: (traderId: string, currentShowInCompetition: boolean) => void
  onDeleteTrader: (traderId: string) => void
  onToggleTraderAddress: (traderId: string) => void
  onCopyAddress: (id: string, address: string) => void
}

export function TradersList({
  traders,
  isLoading,
  allExchanges,
  configuredModelsCount,
  configuredExchangesCount,
  visibleTraderAddresses,
  copiedId,
  language,
  onTraderSelect,
  onNavigate,
  onEditTrader,
  onToggleTrader,
  onToggleCompetition,
  onDeleteTrader,
  onToggleTraderAddress,
  onCopyAddress,
}: TradersListProps) {
  return (
    <section className="bubble-card p-3">
      {isLoading ? (
        <TradersLoadingSkeleton />
      ) : traders && traders.length > 0 ? (
        <div>
          {traders.map((trader) => (
            <TraderRow
              key={trader.trader_id}
              trader={trader}
              allExchanges={allExchanges}
              visibleTraderAddresses={visibleTraderAddresses}
              copiedId={copiedId}
              language={language}
              onTraderSelect={onTraderSelect}
              onNavigate={onNavigate}
              onEditTrader={onEditTrader}
              onToggleTrader={onToggleTrader}
              onToggleCompetition={onToggleCompetition}
              onDeleteTrader={onDeleteTrader}
              onToggleTraderAddress={onToggleTraderAddress}
              onCopyAddress={onCopyAddress}
            />
          ))}
        </div>
      ) : (
        <TradersEmptyState
          configuredModelsCount={configuredModelsCount}
          configuredExchangesCount={configuredExchangesCount}
          language={language}
        />
      )}
    </section>
  )
}

function TradersLoadingSkeleton() {
  return (
    <div className="space-y-3 md:space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 rounded gap-3 md:gap-4 animate-pulse"
          style={{ background: '#0B0E11', border: '1px solid #2B3139' }}
        >
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full skeleton"></div>
            <div className="min-w-0 space-y-2">
              <div className="skeleton h-5 w-32"></div>
              <div className="skeleton h-3 w-24"></div>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="skeleton h-6 w-16"></div>
            <div className="skeleton h-6 w-16"></div>
            <div className="skeleton h-8 w-20"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TradersEmptyState({
  configuredModelsCount,
  configuredExchangesCount,
  language,
}: {
  configuredModelsCount: number
  configuredExchangesCount: number
  language: Language
}) {
  return (
    <div
      className="text-center py-12 md:py-16"
      style={{ color: '#848E9C' }}
    >
      <Bot className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-3 md:mb-4 opacity-50" />
      <div className="text-base md:text-lg font-semibold mb-2">
        {t('noTraders', language)}
      </div>
      <div className="text-xs md:text-sm mb-3 md:mb-4">
        {t('createFirstTrader', language)}
      </div>
      {(configuredModelsCount === 0 ||
        configuredExchangesCount === 0) && (
          <div className="text-xs md:text-sm text-yellow-500">
            {configuredModelsCount === 0 &&
              configuredExchangesCount === 0
              ? t('configureModelsAndExchangesFirst', language)
              : configuredModelsCount === 0
                ? t('configureModelsFirst', language)
                : t('configureExchangesFirst', language)}
          </div>
        )}
    </div>
  )
}

function TraderRow({
  trader,
  allExchanges,
  visibleTraderAddresses,
  copiedId,
  language,
  onTraderSelect,
  onNavigate,
  onEditTrader,
  onToggleTrader,
  onToggleCompetition,
  onDeleteTrader,
  onToggleTraderAddress,
  onCopyAddress,
}: {
  trader: TraderInfo
  allExchanges: Exchange[]
  visibleTraderAddresses: Set<string>
  copiedId: string | null
  language: Language
  onTraderSelect?: (traderId: string) => void
  onNavigate: (path: string) => void
  onEditTrader: (traderId: string) => void
  onToggleTrader: (traderId: string, running: boolean) => void
  onToggleCompetition: (traderId: string, currentShowInCompetition: boolean) => void
  onDeleteTrader: (traderId: string) => void
  onToggleTraderAddress: (traderId: string) => void
  onCopyAddress: (id: string, address: string) => void
}) {
  const exchange = allExchanges.find(e => e.id === trader.exchange_id)
  const walletAddr = getWalletAddress(exchange)
  const isPerpDex = isPerpDexExchange(exchange?.exchange_type)
  const isVisible = visibleTraderAddresses.has(trader.trader_id)
  const isCopied = copiedId === trader.trader_id

  // ⋯ 菜单状态
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleViewClick = () => {
    if (onTraderSelect) {
      onTraderSelect(trader.trader_id)
    } else {
      const slug = `${trader.trader_name}-${trader.trader_id.slice(0, 4)}`
      onNavigate(`/dashboard?trader=${encodeURIComponent(slug)}`)
    }
  }

  return (
    <div className="row-divider">
      {/* 顶部信息行：头像 + 名称 + 状态 + ⋯ */}
      <div className="flex items-center gap-3 px-2 py-2">
        <PunkAvatar
          seed={getTraderAvatar(trader.trader_id, trader.trader_name)}
          size={40}
          className="rounded-lg flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-zinc-100 truncate">
              {trader.trader_name}
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={
                trader.is_running
                  ? { background: 'rgba(14, 203, 129, 0.15)', color: '#0ECB81' }
                  : { background: 'rgba(132, 142, 156, 0.15)', color: '#848E9C' }
              }
            >
              ● {trader.is_running ? t('running', language) : t('stopped', language)}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 truncate">
            <span style={{ color: trader.ai_model.includes('deepseek') ? '#60a5fa' : '#c084fc' }}>
              {getModelDisplayName(trader.ai_model.split('_').pop() || trader.ai_model)}
            </span>
            <span className="mx-1.5 text-zinc-700">·</span>
            <span>{getExchangeDisplayName(trader.exchange_id, allExchanges)}</span>
          </div>
        </div>

        {/* ⋯ 菜单按钮 */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300"
            aria-label="More"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-lg border border-white/10 bg-zinc-900 shadow-xl overflow-hidden">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onToggleCompetition(trader.trader_id, trader.show_in_competition ?? true)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
              >
                {trader.show_in_competition !== false ? (
                  <><EyeOff className="w-3.5 h-3.5" /> {language === 'zh' ? '隐藏排行' : 'Hide rank'}</>
                ) : (
                  <><Eye className="w-3.5 h-3.5" /> {language === 'zh' ? '显示排行' : 'Show rank'}</>
                )}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onDeleteTrader(trader.trader_id)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 border-t border-white/5"
              >
                <Trash2 className="w-3.5 h-3.5" /> {language === 'zh' ? '删除' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DEX 钱包地址（如有） */}
      {isPerpDex && walletAddr && (
        <div className="px-2 pb-1 -mt-1">
          <div
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono"
            style={{ background: 'rgba(240, 185, 11, 0.08)', border: '1px solid rgba(240, 185, 11, 0.2)', color: '#F0B90B' }}
          >
            <span>{isVisible ? walletAddr : truncateAddress(walletAddr)}</span>
            <button
              type="button"
              onClick={() => onToggleTraderAddress(trader.trader_id)}
              className="p-0.5 rounded hover:bg-black/30"
              title={isVisible ? (language === 'zh' ? '隐藏' : 'Hide') : (language === 'zh' ? '显示' : 'Show')}
            >
              {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => onCopyAddress(trader.trader_id, walletAddr)}
              className="p-0.5 rounded hover:bg-black/30"
              title={language === 'zh' ? '复制' : 'Copy'}
            >
              {isCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      )}

      {/* 底部 3 主按钮 */}
      <div className="grid grid-cols-3">
        <button
          onClick={() =>
            onToggleTrader(trader.trader_id, trader.is_running || false)
          }
          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors"
          style={
            trader.is_running
              ? { color: '#F6465D' }
              : { color: '#0ECB81' }
          }
        >
          <Power className="w-3.5 h-3.5" />
          {trader.is_running ? t('stop', language) : t('start', language)}
        </button>

        <button
          onClick={() => onEditTrader(trader.trader_id)}
          disabled={trader.is_running}
          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: trader.is_running ? '#848E9C' : '#FFC107' }}
        >
          <Pencil className="w-3.5 h-3.5" />
          {t('edit', language)}
        </button>

        <button
          onClick={handleViewClick}
          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors"
          style={{ color: '#6366F1' }}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {t('view', language)}
        </button>
      </div>
    </div>
  )
}
