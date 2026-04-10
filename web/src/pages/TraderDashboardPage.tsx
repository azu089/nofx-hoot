import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { mutate } from 'swr'
import { api } from '../lib/api'
import { ChartTabs } from '../components/charts/ChartTabs'
import { DecisionCard } from '../components/trader/DecisionCard'
import { ArenaDecisionCard } from '../components/trader/ArenaDecisionCard'
import { PositionHistory } from '../components/trader/PositionHistory'
import { PunkAvatar, getTraderAvatar } from '../components/common/PunkAvatar'
import { confirmToast, notify } from '../lib/notify'
import { t, type Language } from '../i18n/translations'
import { LogOut, Loader2, Eye, EyeOff, Copy, Check, ChevronDown } from 'lucide-react'
import { DeepVoidBackground } from '../components/common/DeepVoidBackground'
import { GridRiskPanel } from '../components/strategy/GridRiskPanel'
import type {
    SystemStatus,
    AccountInfo,
    Position,
    DecisionRecord,
    Statistics,
    TraderInfo,
    Exchange,
} from '../types'
import type { ArenaDecisionRecord } from '../types/strategy'

// --- Helper Functions ---

// 获取友好的AI模型名称
function getModelDisplayName(modelId: string): string {
    switch (modelId.toLowerCase()) {
        case 'deepseek':
            return 'DeepSeek'
        case 'qwen':
            return 'Qwen'
        case 'claude':
            return 'Claude'
        default:
            return modelId.toUpperCase()
    }
}

// Helper function to get exchange display name from exchange ID (UUID)
function getExchangeDisplayNameFromList(
    exchangeId: string | undefined,
    exchanges: Exchange[] | undefined
): string {
    if (!exchangeId) return 'Unknown'
    const exchange = exchanges?.find((e) => e.id === exchangeId)
    if (!exchange) return exchangeId.substring(0, 8).toUpperCase() + '...'
    const typeName = exchange.exchange_type?.toUpperCase() || exchange.name
    return exchange.account_name
        ? `${typeName} - ${exchange.account_name}`
        : typeName
}

// Helper function to get exchange type from exchange ID (UUID) - for kline charts
function getExchangeTypeFromList(
    exchangeId: string | undefined,
    exchanges: Exchange[] | undefined
): string {
    if (!exchangeId) return 'binance'
    const exchange = exchanges?.find((e) => e.id === exchangeId)
    if (!exchange) return 'binance' // Default to binance for charts
    return exchange.exchange_type?.toLowerCase() || 'binance'
}

// Helper function to check if exchange is a perp-dex type (wallet-based)
function isPerpDexExchange(exchangeType: string | undefined): boolean {
    if (!exchangeType) return false
    const perpDexTypes = ['hyperliquid', 'lighter', 'aster']
    return perpDexTypes.includes(exchangeType.toLowerCase())
}

// Helper function to get wallet address for perp-dex exchanges
function getWalletAddress(exchange: Exchange | undefined): string | undefined {
    if (!exchange) return undefined
    const type = exchange.exchange_type?.toLowerCase()
    switch (type) {
        case 'hyperliquid':
            return exchange.hyperliquidWalletAddr
        case 'lighter':
            return exchange.lighterWalletAddr
        case 'aster':
            return exchange.asterSigner
        default:
            return undefined
    }
}

// Helper function to truncate wallet address for display
function truncateAddress(address: string, startLen = 6, endLen = 4): string {
    if (address.length <= startLen + endLen + 3) return address
    return `${address.slice(0, startLen)}...${address.slice(-endLen)}`
}

// --- Components ---

interface TraderDashboardPageProps {
    selectedTrader?: TraderInfo
    traders?: TraderInfo[]
    tradersError?: Error
    selectedTraderId?: string
    onTraderSelect: (traderId: string) => void
    onNavigateToTraders: () => void
    status?: SystemStatus
    account?: AccountInfo
    positions?: Position[]
    decisions?: DecisionRecord[]
    arenaRecords?: ArenaDecisionRecord[]
    decisionsLimit: number
    onDecisionsLimitChange: (limit: number) => void
    stats?: Statistics
    lastUpdate: string
    language: Language
    exchanges?: Exchange[]
    accountFailed?: boolean
    positionsFailed?: boolean
    decisionsFailed?: boolean
}

export function TraderDashboardPage({
    selectedTrader,
    status,
    account,
    positions,
    decisions,
    arenaRecords,
    decisionsLimit,
    onDecisionsLimitChange,
    lastUpdate,
    language,
    traders,
    tradersError,
    selectedTraderId,
    onTraderSelect,
    onNavigateToTraders,
    exchanges,
}: TraderDashboardPageProps) {
    const [closingPosition, setClosingPosition] = useState<string | null>(null)
    const [selectedChartSymbol, setSelectedChartSymbol] = useState<string | undefined>(undefined)
    const [chartUpdateKey, setChartUpdateKey] = useState<number>(0)
    const chartSectionRef = useRef<HTMLDivElement>(null)
    const [showWalletAddress, setShowWalletAddress] = useState<boolean>(false)
    const [copiedAddress, setCopiedAddress] = useState<boolean>(false)

    // Current positions pagination
    const [positionsPageSize, setPositionsPageSize] = useState<number>(20)
    const [positionsCurrentPage, setPositionsCurrentPage] = useState<number>(1)
    // 移动端 Tab 状态：行情（持仓+K线）/ 决策 / 历史
    const [mobileTab, setMobileTab] = useState<'main' | 'decisions' | 'history'>('main')
    // Trader 切换下拉开关
    const [traderDropdownOpen, setTraderDropdownOpen] = useState(false)
    const traderTriggerRef = useRef<HTMLButtonElement>(null)
    const traderPopoverRef = useRef<HTMLDivElement>(null)
    const [traderPopoverPos, setTraderPopoverPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 })
    // 计算 popover 位置（基于 button rect）
    useLayoutEffect(() => {
        if (!traderDropdownOpen || !traderTriggerRef.current) return
        const rect = traderTriggerRef.current.getBoundingClientRect()
        setTraderPopoverPos({
            left: rect.left,
            top: rect.bottom + 8,
            width: Math.max(rect.width, 220),
        })
    }, [traderDropdownOpen])
    // 点击外部关闭
    useEffect(() => {
        if (!traderDropdownOpen) return
        const handleClick = (e: MouseEvent) => {
            const t = e.target as Node
            if (
                traderTriggerRef.current?.contains(t) ||
                traderPopoverRef.current?.contains(t)
            ) return
            setTraderDropdownOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [traderDropdownOpen])

    // Calculate paginated positions
    const totalPositions = positions?.length || 0
    const totalPositionPages = Math.ceil(totalPositions / positionsPageSize)
    const paginatedPositions = positions?.slice(
        (positionsCurrentPage - 1) * positionsPageSize,
        positionsCurrentPage * positionsPageSize
    ) || []

    // Reset page when positions change
    useEffect(() => {
        setPositionsCurrentPage(1)
    }, [selectedTraderId, positionsPageSize])

    // Auto-set chart symbol for grid trading
    useEffect(() => {
        if (status?.strategy_type === 'grid_trading' && status?.grid_symbol) {
            setSelectedChartSymbol(status.grid_symbol)
        }
    }, [status?.strategy_type, status?.grid_symbol])

    // Get current exchange info for perp-dex wallet display
    const currentExchange = exchanges?.find(
        (e) => e.id === selectedTrader?.exchange_id
    )
    const walletAddress = getWalletAddress(currentExchange)
    const isPerpDex = isPerpDexExchange(currentExchange?.exchange_type)

    // Copy wallet address to clipboard
    const handleCopyAddress = async () => {
        if (!walletAddress) return
        try {
            await navigator.clipboard.writeText(walletAddress)
            setCopiedAddress(true)
            setTimeout(() => setCopiedAddress(false), 2000)
        } catch (err) {
            console.error('Failed to copy address:', err)
        }
    }

    // Handle symbol click from Decision Card
    const handleSymbolClick = (symbol: string) => {
        // Set the selected symbol
        setSelectedChartSymbol(symbol)
        // Scroll to chart section
        setTimeout(() => {
            chartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
    }

    // 平仓操作
    const handleClosePosition = async (symbol: string, side: string) => {
        if (!selectedTraderId) return

        const confirmMsg =
            language === 'zh'
                ? `确定要平仓 ${symbol} ${side === 'LONG' ? '多仓' : '空仓'} 吗？`
                : `Are you sure you want to close ${symbol} ${side === 'LONG' ? 'LONG' : 'SHORT'} position?`

        const confirmed = await confirmToast(confirmMsg, {
            title: language === 'zh' ? '确认平仓' : 'Confirm Close',
            okText: language === 'zh' ? '确认' : 'Confirm',
            cancelText: language === 'zh' ? '取消' : 'Cancel',
        })

        if (!confirmed) return

        setClosingPosition(symbol)
        try {
            await api.closePosition(selectedTraderId, symbol, side)
            notify.success(
                language === 'zh' ? '平仓成功' : 'Position closed successfully'
            )
            // 使用 SWR mutate 刷新数据而非重新加载页面
            await Promise.all([
                mutate(`positions-${selectedTraderId}`),
                mutate(`account-${selectedTraderId}`),
            ])
        } catch (err: unknown) {
            const errorMsg =
                err instanceof Error
                    ? err.message
                    : language === 'zh'
                        ? '平仓失败'
                        : 'Failed to close position'
            notify.error(errorMsg)
        } finally {
            setClosingPosition(null)
        }
    }

    // If API failed with error, show empty state (likely backend not running)
    if (tradersError) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] relative z-10">
                <div className="text-center max-w-md mx-auto px-6">
                    <div
                        className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bubble-card"
                    >
                        <svg
                            className="w-12 h-12 text-emerald-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-medium mb-3 text-nofx-text-main">
                        {language === 'zh' ? '无法连接到服务器' : 'Connection Failed'}
                    </h2>
                    <p className="text-base mb-6 text-nofx-text-muted">
                        {language === 'zh'
                            ? '请确认后端服务已启动。'
                            : 'Please check if the backend service is running.'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-emerald px-6 py-3 rounded-full"
                    >
                        {language === 'zh' ? '重试' : 'Retry'}
                    </button>
                </div>
            </div>
        )
    }

    // If traders is loaded and empty, show empty state
    if (traders && traders.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] relative z-10">
                <div className="text-center max-w-md mx-auto px-6">
                    <div
                        className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center nofx-glass"
                        style={{
                            background: 'rgba(240, 185, 11, 0.1)',
                            borderColor: 'rgba(240, 185, 11, 0.3)',
                        }}
                    >
                        <svg
                            className="w-12 h-12 text-nofx-gold"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-medium mb-3 text-nofx-text-main">
                        {t('dashboardEmptyTitle', language)}
                    </h2>
                    <p className="text-base mb-6 text-nofx-text-muted">
                        {t('dashboardEmptyDescription', language)}
                    </p>
                    <button
                        onClick={onNavigateToTraders}
                        className="px-6 py-3 rounded-lg font-medium transition-all hover:scale-105 active:scale-95 nofx-glass border border-nofx-gold/30 text-nofx-gold hover:bg-nofx-gold/10"
                    >
                        {t('goToTradersPage', language)}
                    </button>
                </div>
            </div>
        )
    }

    if (selectedTrader && !selectedTrader.is_running) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] relative z-10 px-4">
                <div className="nofx-glass p-8 md:p-10 text-center max-w-sm w-full">
                    {/* Icon — emerald tinted circle */}
                    <div
                        className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
                        style={{
                            background: 'rgba(43, 232, 158, 0.12)',
                            boxShadow: '0 0 24px rgba(43, 232, 158, 0.15)',
                        }}
                    >
                        <svg
                            className="w-7 h-7 text-emerald-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                        </svg>
                    </div>

                    <h2 className="text-xl font-medium mb-2 text-white">
                        {t('traderNotRunningTitle', language)}
                    </h2>
                    <p className="mb-1 text-sm text-zinc-400">
                        {t('traderNotRunningDescription', language)}
                    </p>
                    <p className="mb-6 text-sm text-zinc-500 font-mono">
                        {selectedTrader.trader_name}
                    </p>

                    <button
                        type="button"
                        onClick={onNavigateToTraders}
                        className="btn-emerald w-full py-2.5 rounded-full text-sm"
                    >
                        {t('goStartTrader', language)}
                    </button>
                </div>
            </div>
        )
    }

    // If traders is still loading or selectedTrader is not ready, show skeleton
    if (!selectedTrader) {
        return (
            <div className="space-y-6 relative z-10">
                <div className="nofx-glass p-6 animate-pulse">
                    <div className="h-8 w-48 mb-3 bg-nofx-bg/50 rounded"></div>
                    <div className="flex gap-4">
                        <div className="h-4 w-32 bg-nofx-bg/50 rounded"></div>
                        <div className="h-4 w-24 bg-nofx-bg/50 rounded"></div>
                        <div className="h-4 w-28 bg-nofx-bg/50 rounded"></div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="nofx-glass p-5 animate-pulse">
                            <div className="h-4 w-24 mb-3 bg-nofx-bg/50 rounded"></div>
                            <div className="h-8 w-32 bg-nofx-bg/50 rounded"></div>
                        </div>
                    ))}
                </div>
                <div className="nofx-glass p-6 animate-pulse">
                    <div className="h-6 w-40 mb-4 bg-nofx-bg/50 rounded"></div>
                    <div className="h-64 w-full bg-nofx-bg/50 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <DeepVoidBackground className="min-h-screen pb-12" disableAnimation>
            <div className="w-full px-3 md:px-8 relative z-10 py-4">
                {/* Trader Header */}
                <div className="mb-6 rounded-lg p-6 animate-scale-in nofx-glass group">
                    {/* Row 1: Avatar + 可点击名字（内嵌 select 触发原生 picker）+ Wallet */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-shrink-0">
                            <PunkAvatar
                                seed={getTraderAvatar(
                                    selectedTrader.trader_id,
                                    selectedTrader.trader_name
                                )}
                                size={56}
                                className="rounded-xl border-2 border-nofx-gold/30 shadow-[0_0_15px_rgba(240,185,11,0.2)]"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-nofx-green rounded-full border-2 border-[#0B0E11] shadow-[0_0_8px_rgba(14,203,129,0.8)] animate-pulse" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <button
                                ref={traderTriggerRef}
                                type="button"
                                onClick={() => traders && traders.length > 0 && setTraderDropdownOpen(v => !v)}
                                className="flex items-center gap-1.5 text-left min-w-0"
                                aria-label={language === 'zh' ? '切换交易员' : 'Switch trader'}
                            >
                                <span className="text-2xl md:text-3xl font-medium tracking-tight text-nofx-text-main whitespace-nowrap overflow-hidden text-ellipsis">
                                    {selectedTrader.trader_name}
                                </span>
                                {traders && traders.length > 0 && (
                                    <ChevronDown className={`w-5 h-5 text-nofx-text-muted flex-shrink-0 transition-transform ${traderDropdownOpen ? 'rotate-180' : ''}`} />
                                )}
                            </button>
                            <span className="text-xs font-mono text-nofx-text-muted opacity-60 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-nofx-gold rounded-full" />
                                ID: {selectedTrader.trader_id.slice(0, 8)}...
                            </span>
                        </div>

                        <div className="flex items-center gap-4 ml-auto">
                            {/* Wallet Address Display for Perp-DEX */}
                            {exchanges && isPerpDex && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg nofx-glass border border-nofx-gold/20">
                                    {walletAddress ? (
                                        <>
                                            <span className="text-xs font-mono text-nofx-gold">
                                                {showWalletAddress
                                                    ? walletAddress
                                                    : truncateAddress(walletAddress)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowWalletAddress(!showWalletAddress)}
                                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                                title={
                                                    showWalletAddress
                                                        ? language === 'zh'
                                                            ? '隐藏地址'
                                                            : 'Hide address'
                                                        : language === 'zh'
                                                            ? '显示完整地址'
                                                            : 'Show full address'
                                                }
                                            >
                                                {showWalletAddress ? (
                                                    <EyeOff className="w-3.5 h-3.5 text-nofx-text-muted" />
                                                ) : (
                                                    <Eye className="w-3.5 h-3.5 text-nofx-text-muted" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCopyAddress}
                                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                                title={language === 'zh' ? '复制地址' : 'Copy address'}
                                            >
                                                {copiedAddress ? (
                                                    <Check className="w-3.5 h-3.5 text-nofx-green" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 text-nofx-text-muted" />
                                                )}
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-nofx-text-muted">
                                            {language === 'zh' ? '未配置地址' : 'No address configured'}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Metadata — 顶层只用 gap 分隔，Strategy+Cycles+Runtime 分组始终同一行 */}
                    <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-sm text-nofx-text-muted font-mono">
                        <span className="flex items-center gap-2">
                            <span className="opacity-60">AI Model:</span>
                            <span
                                className="font-medium px-2 py-0.5 rounded text-xs tracking-wide"
                                style={{
                                    background: selectedTrader.ai_model.includes('qwen') ? 'rgba(192, 132, 252, 0.15)' : 'rgba(96, 165, 250, 0.15)',
                                    color: selectedTrader.ai_model.includes('qwen') ? '#c084fc' : '#60a5fa',
                                    border: `1px solid ${selectedTrader.ai_model.includes('qwen') ? '#c084fc' : '#60a5fa'}40`
                                }}
                            >
                                {getModelDisplayName(
                                    selectedTrader.ai_model.split('_').pop() ||
                                    selectedTrader.ai_model
                                )}
                            </span>
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="opacity-60">Exchange:</span>
                            <span className="text-nofx-text-main font-medium">
                                {getExchangeDisplayNameFromList(
                                    selectedTrader.exchange_id,
                                    exchanges
                                )}
                            </span>
                        </span>
                        {/* Strategy 单独一行 */}
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="opacity-60">Strategy:</span>
                            <span className="text-nofx-gold font-medium tracking-wide">
                                {selectedTrader.strategy_name || 'No Strategy'}
                            </span>
                        </span>
                        {/* Cycles + Runtime 独占一行 */}
                        {status && (
                            <div className="flex items-center gap-x-4 flex-wrap">
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-60">Cycles:</span>
                                    <span className="text-nofx-text-main font-medium">{status.call_count}</span>
                                </span>
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="opacity-60">Runtime:</span>
                                    <span className="text-nofx-text-main font-medium">{status.runtime_minutes} min</span>
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Debug Info */}
                {account && (
                    <div className="mb-4 px-3 py-1.5 rounded bg-black/40 border border-white/5 text-[10px] font-mono text-nofx-text-muted flex flex-wrap justify-between items-center gap-x-4 gap-y-1 opacity-60 hover:opacity-100 transition-opacity">
                        <span>SYSTEM_STATUS::ONLINE</span>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span>LAST_UPDATE::{lastUpdate}</span>
                            <span>EQ::{account?.total_equity?.toFixed(2)}</span>
                            <span>PNL::{account?.total_pnl?.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Account Overview — 4 项合并为 1 个气泡 */}
                <div className="nofx-glass p-2 mb-8 grid grid-cols-2 md:grid-cols-4">
                    <StatCard
                        title={t('totalEquity', language)}
                        value={`${account?.total_equity?.toFixed(2) || '0.00'}`}
                        unit="USDT"
                        change={account?.total_pnl_pct || 0}
                        positive={(account?.total_pnl ?? 0) > 0}
                        icon="💰"
                    />
                    <StatCard
                        title={t('availableBalance', language)}
                        value={`${account?.available_balance?.toFixed(2) || '0.00'}`}
                        unit="USDT"
                        subtitle={`${account?.available_balance && account?.total_equity ? ((account.available_balance / account.total_equity) * 100).toFixed(1) : '0.0'}% ${t('free', language)}`}
                        icon="💳"
                    />
                    <StatCard
                        title={t('totalPnL', language)}
                        value={`${account?.total_pnl !== undefined && account.total_pnl >= 0 ? '+' : ''}${account?.total_pnl?.toFixed(2) || '0.00'}`}
                        unit="USDT"
                        change={account?.total_pnl_pct || 0}
                        positive={(account?.total_pnl ?? 0) >= 0}
                        icon="📈"
                    />
                    <StatCard
                        title={t('positions', language)}
                        value={`${account?.position_count || 0}`}
                        unit="ACTIVE"
                        subtitle={`${t('margin', language)}: ${account?.margin_used_pct?.toFixed(1) || '0.0'}%`}
                        icon="📊"
                    />
                </div>

                {/* Grid Risk Panel - Only show for grid trading strategy */}
                {status?.strategy_type === 'grid_trading' && selectedTraderId && (
                    <div className="mb-8 animate-slide-in" style={{ animationDelay: '0.05s' }}>
                        <GridRiskPanel
                            traderId={selectedTraderId}
                            language={language}
                            refreshInterval={5000}
                        />
                    </div>
                )}

                {/* Mobile Tab Bar — 配置页同款 segmented control 风格 */}
                <div className="md:hidden sticky top-16 z-30 mb-4">
                    <div className="bubble-card grid grid-cols-3 p-1 !rounded-full">
                        {([
                            { key: 'main', label: language === 'zh' ? '持仓' : 'Positions' },
                            { key: 'decisions', label: language === 'zh' ? '决策' : 'Decisions' },
                            { key: 'history', label: language === 'zh' ? '历史' : 'History' },
                        ] as const).map((tab, idx, arr) => {
                            const isActive = mobileTab === tab.key
                            const isFirst = idx === 0
                            const isLast = idx === arr.length - 1
                            const insetShadows: string[] = []
                            if (isActive && !isFirst) insetShadows.push('inset 1px 0 0 0 rgba(255,255,255,0.28)')
                            if (isActive && !isLast) insetShadows.push('inset -1px 0 0 0 rgba(255,255,255,0.28)')
                            return (
                            <button
                                key={tab.key}
                                onClick={() => setMobileTab(tab.key)}
                                className={
                                    isActive
                                        ? 'relative flex items-center justify-center py-2 rounded-full text-xs font-medium text-white transition-all overflow-hidden'
                                        : 'flex items-center justify-center py-2 rounded-full text-xs font-medium text-zinc-300 hover:text-white hover:bg-emerald-400/10 transition-all'
                                }
                                style={
                                    isActive
                                        ? {
                                              background:
                                                  'radial-gradient(ellipse 70% 65% at 50% 105%, rgba(16,185,129,0.32) 0%, rgba(16,185,129,0.16) 35%, rgba(16,185,129,0.05) 65%, transparent 100%)',
                                              boxShadow: insetShadows.join(', '),
                                          }
                                        : undefined
                                }
                            >
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                            )
                        })}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Left Column: Positions + Charts — 移动端仅 main tab 显示（持仓在上，K线在下）*/}
                    <div className={`flex flex-col gap-6 ${mobileTab === 'main' ? '' : 'hidden md:flex'}`}>
                        {/* Chart Tabs (Equity / K-line) — order-2 放在持仓下方 */}
                        <div
                            ref={chartSectionRef}
                            className="order-2 animate-slide-in scroll-mt-32"
                            style={{ animationDelay: '0.1s' }}
                        >
                            <ChartTabs
                                traderId={selectedTrader.trader_id}
                                selectedSymbol={selectedChartSymbol}
                                updateKey={chartUpdateKey}
                                exchangeId={getExchangeTypeFromList(
                                    selectedTrader.exchange_id,
                                    exchanges
                                )}
                            />
                        </div>

                        {/* Current Positions — order-1 放在 K线上方 */}
                        <div
                            className="order-1 nofx-glass p-6 animate-slide-in relative overflow-hidden group"
                            style={{ animationDelay: '0.15s' }}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <div className="w-24 h-24 rounded-full bg-blue-500 blur-3xl" />
                            </div>
                            <div className="flex items-center justify-between mb-5 relative z-10">
                                <h2 className="text-lg font-medium flex items-center gap-2 text-nofx-text-main uppercase tracking-wide">
                                    <span className="text-blue-500">◈</span> {t('currentPositions', language)}
                                </h2>
                                {positions && positions.length > 0 && (
                                    <div className="text-xs px-2 py-1 rounded bg-nofx-gold/10 text-nofx-gold border border-nofx-gold/20 font-mono shadow-[0_0_10px_rgba(240,185,11,0.1)]">
                                        {positions.length} {t('active', language)}
                                    </div>
                                )}
                            </div>
                            {positions && positions.length > 0 ? (
                                <div>
                                    {/* 移动端：卡片列表（气泡内，无独立气泡） */}
                                    <div className="md:hidden divide-y divide-white/5">
                                        {paginatedPositions.map((pos, i) => (
                                            <div
                                                key={i}
                                                className="py-4 first:pt-0 last:pb-0 cursor-pointer"
                                                onClick={() => {
                                                    setSelectedChartSymbol(pos.symbol)
                                                    setChartUpdateKey(Date.now())
                                                    if (chartSectionRef.current) {
                                                        chartSectionRef.current.scrollIntoView({
                                                            behavior: 'smooth',
                                                            block: 'start',
                                                        })
                                                    }
                                                }}
                                            >
                                                {/* 顶部行：币种 + 方向 + 平仓按钮 */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-medium text-base text-nofx-text-main">{pos.symbol}</span>
                                                        <span
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${pos.side === 'long' ? 'bg-nofx-green/10 text-nofx-green' : 'bg-nofx-red/10 text-nofx-red'}`}
                                                        >
                                                            {t(pos.side === 'long' ? 'long' : 'short', language)}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleClosePosition(pos.symbol, pos.side.toUpperCase())
                                                        }}
                                                        disabled={closingPosition === pos.symbol}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-nofx-red/10 text-nofx-red border border-nofx-red/30 hover:bg-nofx-red/20"
                                                    >
                                                        {closingPosition === pos.symbol ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <LogOut className="w-3 h-3" />
                                                        )}
                                                        {language === 'zh' ? '平仓' : 'Close'}
                                                    </button>
                                                </div>

                                                {/* 字段网格：2 列 × 4 行 */}
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
                                                    <div className="flex justify-between">
                                                        <span className="text-nofx-text-muted">{language === 'zh' ? '入场价' : 'Entry'}</span>
                                                        <span className="text-nofx-text-main">{pos.entry_price.toFixed(4)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-nofx-text-muted">{language === 'zh' ? '标记价' : 'Mark'}</span>
                                                        <span className="text-nofx-text-main">{pos.mark_price.toFixed(4)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-nofx-text-muted">{language === 'zh' ? '数量' : 'Qty'}</span>
                                                        <span className="text-nofx-text-main">{pos.quantity.toFixed(4)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-nofx-text-muted">{language === 'zh' ? '价值' : 'Value'}</span>
                                                        <span className="text-nofx-text-main">{(pos.quantity * pos.mark_price).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-nofx-text-muted">{language === 'zh' ? '杠杆' : 'Lev.'}</span>
                                                        <span className="text-nofx-gold">{pos.leverage}x</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-nofx-text-muted">{language === 'zh' ? '强平价' : 'Liq.'}</span>
                                                        <span className="text-nofx-text-muted">{pos.liquidation_price.toFixed(4)}</span>
                                                    </div>
                                                </div>

                                                {/* 未实现盈亏单独一行 */}
                                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                                                    <span className="text-xs text-nofx-text-muted">{language === 'zh' ? '未实现盈亏' : 'uPnL'}</span>
                                                    <span
                                                        className={`font-mono font-medium text-base ${pos.unrealized_pnl >= 0 ? 'text-nofx-green' : 'text-nofx-red'}`}
                                                        style={{ textShadow: pos.unrealized_pnl >= 0 ? '0 0 10px rgba(14,203,129,0.3)' : '0 0 10px rgba(246,70,93,0.3)' }}
                                                    >
                                                        {pos.unrealized_pnl >= 0 ? '+' : ''}{pos.unrealized_pnl.toFixed(2)} USDT
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 桌面端：表格 */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="text-left border-b border-white/5">
                                                <tr>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-left">{t('symbol', language)}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-center">{t('side', language)}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-center">{language === 'zh' ? '操作' : 'Action'}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-right hidden md:table-cell" title={t('entryPrice', language)}>{language === 'zh' ? '入场价' : 'Entry'}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-right hidden md:table-cell" title={t('markPrice', language)}>{language === 'zh' ? '标记价' : 'Mark'}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-right" title={t('quantity', language)}>{language === 'zh' ? '数量' : 'Qty'}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-right hidden md:table-cell" title={t('positionValue', language)}>{language === 'zh' ? '价值' : 'Value'}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-center hidden md:table-cell" title={t('leverage', language)}>{language === 'zh' ? '杠杆' : 'Lev.'}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-right" title={t('unrealizedPnL', language)}>{language === 'zh' ? '未实现盈亏' : 'uPnL'}</th>
                                                    <th className="px-1 pb-3 font-medium text-nofx-text-muted whitespace-nowrap text-right hidden md:table-cell" title={t('liqPrice', language)}>{language === 'zh' ? '强平价' : 'Liq.'}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedPositions.map((pos, i) => (
                                                    <tr
                                                        key={i}
                                                        className="border-b border-white/5 last:border-0 transition-all hover:bg-white/5 cursor-pointer group/row"
                                                        onClick={() => {
                                                            setSelectedChartSymbol(pos.symbol)
                                                            setChartUpdateKey(Date.now())
                                                            if (chartSectionRef.current) {
                                                                chartSectionRef.current.scrollIntoView({
                                                                    behavior: 'smooth',
                                                                    block: 'start',
                                                                })
                                                            }
                                                        }}
                                                    >
                                                        <td className="px-1 py-3 font-mono font-medium whitespace-nowrap text-left text-nofx-text-main group-hover/row:text-white transition-colors">
                                                            {pos.symbol}
                                                        </td>
                                                        <td className="px-1 py-3 whitespace-nowrap text-center">
                                                            <span
                                                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${pos.side === 'long' ? 'bg-nofx-green/10 text-nofx-green shadow-[0_0_8px_rgba(14,203,129,0.2)]' : 'bg-nofx-red/10 text-nofx-red shadow-[0_0_8px_rgba(246,70,93,0.2)]'}`}
                                                            >
                                                                {t(pos.side === 'long' ? 'long' : 'short', language)}
                                                            </span>
                                                        </td>
                                                        <td className="px-1 py-3 whitespace-nowrap text-center">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleClosePosition(pos.symbol, pos.side.toUpperCase())
                                                                }}
                                                                disabled={closingPosition === pos.symbol}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed mx-auto bg-nofx-red/10 text-nofx-red border border-nofx-red/30 hover:bg-nofx-red/20"
                                                                title={language === 'zh' ? '平仓' : 'Close Position'}
                                                            >
                                                                {closingPosition === pos.symbol ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <LogOut className="w-3 h-3" />
                                                                )}
                                                                {language === 'zh' ? '平仓' : 'Close'}
                                                            </button>
                                                        </td>
                                                        <td className="px-1 py-3 font-mono whitespace-nowrap text-right text-nofx-text-main hidden md:table-cell">{pos.entry_price.toFixed(4)}</td>
                                                        <td className="px-1 py-3 font-mono whitespace-nowrap text-right text-nofx-text-main hidden md:table-cell">{pos.mark_price.toFixed(4)}</td>
                                                        <td className="px-1 py-3 font-mono whitespace-nowrap text-right text-nofx-text-main">{pos.quantity.toFixed(4)}</td>
                                                        <td className="px-1 py-3 font-mono font-medium whitespace-nowrap text-right text-nofx-text-main hidden md:table-cell">{(pos.quantity * pos.mark_price).toFixed(2)}</td>
                                                        <td className="px-1 py-3 font-mono whitespace-nowrap text-center text-nofx-gold hidden md:table-cell">{pos.leverage}x</td>
                                                        <td className="px-1 py-3 font-mono whitespace-nowrap text-right">
                                                            <span
                                                                className={`font-medium ${pos.unrealized_pnl >= 0 ? 'text-nofx-green shadow-nofx-green' : 'text-nofx-red shadow-nofx-red'}`}
                                                                style={{ textShadow: pos.unrealized_pnl >= 0 ? '0 0 10px rgba(14,203,129,0.3)' : '0 0 10px rgba(246,70,93,0.3)' }}
                                                            >
                                                                {pos.unrealized_pnl >= 0 ? '+' : ''}
                                                                {pos.unrealized_pnl.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-1 py-3 font-mono whitespace-nowrap text-right text-nofx-text-muted hidden md:table-cell">{pos.liquidation_price.toFixed(4)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination footer */}
                                    {totalPositions > 10 && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 text-xs border-t border-white/5 text-nofx-text-muted">
                                            <span>
                                                {language === 'zh'
                                                    ? `显示 ${paginatedPositions.length} / ${totalPositions} 个持仓`
                                                    : `Showing ${paginatedPositions.length} of ${totalPositions} positions`}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span>{language === 'zh' ? '每页' : 'Per page'}:</span>
                                                    <select
                                                        value={positionsPageSize}
                                                        onChange={(e) => setPositionsPageSize(Number(e.target.value))}
                                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-nofx-text-main focus:outline-none focus:border-nofx-gold/50 transition-colors"
                                                    >
                                                        <option value={20}>20</option>
                                                        <option value={50}>50</option>
                                                        <option value={100}>100</option>
                                                    </select>
                                                </div>
                                                {totalPositionPages > 1 && (
                                                    <div className="flex items-center gap-1">
                                                        {['«', '‹', `${positionsCurrentPage} / ${totalPositionPages}`, '›', '»'].map((label, idx) => {
                                                            const isText = idx === 2;
                                                            const isFirst = idx === 0;
                                                            const isPrev = idx === 1;
                                                            const isNext = idx === 3;
                                                            const isLast = idx === 4;
                                                            if (isText) return <span key={idx} className="px-3 text-nofx-text-main">{label}</span>;

                                                            let onClick = () => { };
                                                            let disabled = false;

                                                            if (isFirst) { onClick = () => setPositionsCurrentPage(1); disabled = positionsCurrentPage === 1; }
                                                            if (isPrev) { onClick = () => setPositionsCurrentPage(p => Math.max(1, p - 1)); disabled = positionsCurrentPage === 1; }
                                                            if (isNext) { onClick = () => setPositionsCurrentPage(p => Math.min(totalPositionPages, p + 1)); disabled = positionsCurrentPage === totalPositionPages; }
                                                            if (isLast) { onClick = () => setPositionsCurrentPage(totalPositionPages); disabled = positionsCurrentPage === totalPositionPages; }

                                                            return (
                                                                <button
                                                                    key={idx}
                                                                    onClick={onClick}
                                                                    disabled={disabled}
                                                                    className={`px-2 py-1 rounded transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 text-nofx-text-main bg-white/5'}`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-16 text-nofx-text-muted opacity-60">
                                    <div className="text-6xl mb-4 opacity-50 grayscale">📊</div>
                                    <div className="text-lg font-medium mb-2">{t('noPositions', language)}</div>
                                    <div className="text-sm">{t('noActivePositions', language)}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Recent Decisions — 移动端仅 decisions tab 显示 */}
                    <div
                        className={`nofx-glass p-6 animate-slide-in h-fit lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] flex-col ${
                            mobileTab === 'decisions' ? 'flex' : 'hidden md:flex'
                        }`}
                        style={{ animationDelay: '0.2s' }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5 shrink-0">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-[0_4px_14px_rgba(99,102,241,0.4)]"
                                style={{
                                    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                                }}
                            >
                                🧠
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-medium text-nofx-text-main">
                                    {t('recentDecisions', language)}
                                </h2>
                                {status?.strategy_type === 'arena' ? (
                                    arenaRecords && arenaRecords.length > 0 && (
                                        <div className="text-xs text-nofx-text-muted">
                                            {t('lastCycles', language, { count: arenaRecords.length })}
                                        </div>
                                    )
                                ) : (
                                    decisions && decisions.length > 0 && (
                                        <div className="text-xs text-nofx-text-muted">
                                            {t('lastCycles', language, { count: decisions.length })}
                                        </div>
                                    )
                                )}
                            </div>
                            {/* Limit Selector */}
                            <select
                                value={decisionsLimit}
                                onChange={(e) => onDecisionsLimitChange(Number(e.target.value))}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all bg-black/40 text-nofx-text-main border border-white/10 hover:border-nofx-accent focus:outline-none"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>

                        {/* Decisions List - Scrollable */}
                        <div
                            className="overflow-y-auto pr-2 custom-scrollbar"
                            style={{ maxHeight: 'calc(100vh - 280px)' }}
                        >
                            {status?.strategy_type === 'arena' ? (
                                arenaRecords && arenaRecords.length > 0 ? (
                                    arenaRecords.map((record) => (
                                        <ArenaDecisionCard key={record.id} record={record} language={language} />
                                    ))
                                ) : (
                                    <div className="py-16 text-center text-nofx-text-muted opacity-60">
                                        <div className="text-6xl mb-4 opacity-30 grayscale">🧠</div>
                                        <div className="text-lg font-medium mb-2 text-nofx-text-main">
                                            {t('noDecisionsYet', language)}
                                        </div>
                                        <div className="text-sm">
                                            {t('aiDecisionsWillAppear', language)}
                                        </div>
                                    </div>
                                )
                            ) : (
                                decisions && decisions.length > 0 ? (
                                    decisions.map((decision, i) => (
                                        <DecisionCard key={i} decision={decision} language={language} onSymbolClick={handleSymbolClick} />
                                    ))
                                ) : (
                                    <div className="py-16 text-center text-nofx-text-muted opacity-60">
                                        <div className="text-6xl mb-4 opacity-30 grayscale">🧠</div>
                                        <div className="text-lg font-medium mb-2 text-nofx-text-main">
                                            {t('noDecisionsYet', language)}
                                        </div>
                                        <div className="text-sm">
                                            {t('aiDecisionsWillAppear', language)}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Position History Section — 移动端仅 history tab 显示
                 * 不再包外层 nofx-glass，PositionHistory 组件内部已有 3 个气泡
                 */}
                {selectedTraderId && (
                    <div
                        className={`animate-slide-in ${
                            mobileTab === 'history' ? '' : 'hidden md:block'
                        }`}
                        style={{ animationDelay: '0.25s' }}
                    >
                        <PositionHistory traderId={selectedTraderId} />
                    </div>
                )}
            </div>

            {/* Trader 切换下拉 — 用 portal 悬浮在所有内容之上，不影响布局 */}
            {traderDropdownOpen && traders && traders.length > 0 && createPortal(
                <div
                    ref={traderPopoverRef}
                    className="bubble-card p-1 max-h-64 overflow-y-auto"
                    style={{
                        position: 'fixed',
                        left: traderPopoverPos.left,
                        top: traderPopoverPos.top,
                        width: traderPopoverPos.width,
                        zIndex: 100,
                    }}
                >
                    {traders.map((trader) => {
                        const isActive = trader.trader_id === selectedTraderId
                        return (
                            <button
                                key={trader.trader_id}
                                type="button"
                                onClick={() => {
                                    onTraderSelect(trader.trader_id)
                                    setTraderDropdownOpen(false)
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-emerald-400/15 text-emerald-300' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}
                            >
                                {trader.trader_name}
                                {isActive && <Check className="inline w-3.5 h-3.5 ml-2" />}
                            </button>
                        )
                    })}
                </div>,
                document.body
            )}
        </DeepVoidBackground>
    )
}

// Stat Card Component - Deep Void Style
function StatCard({
    title,
    value,
    unit,
    change,
    positive,
    subtitle,
    icon,
}: {
    title: string
    value: string
    unit?: string
    change?: number
    positive?: boolean
    subtitle?: string
    icon?: string
}) {
    return (
        <div className="group p-5 rounded-lg transition-all duration-300 hover:bg-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-4xl grayscale group-hover:grayscale-0">
                {icon}
            </div>
            <div className="text-xs mb-2 font-mono uppercase tracking-wider text-nofx-text-muted flex items-center gap-2">
                {title}
            </div>
            <div className="flex items-baseline gap-1 mb-1">
                <div className="text-2xl font-medium font-mono text-nofx-text-main tracking-tight group-hover:text-white transition-colors">
                    {value}
                </div>
                {unit && <span className="text-xs font-mono text-nofx-text-muted opacity-60">{unit}</span>}
            </div>

            {change !== undefined && (
                <div className="flex items-center gap-1">
                    <div
                        className={`text-sm mono font-medium flex items-center gap-1 ${positive ? 'text-nofx-green' : 'text-nofx-red'}`}
                    >
                        <span>{positive ? '▲' : '▼'}</span>
                        <span>{positive ? '+' : ''}{change.toFixed(2)}%</span>
                    </div>
                </div>
            )}
            {subtitle && (
                <div className="text-xs mt-2 mono text-nofx-text-muted opacity-80">
                    {subtitle}
                </div>
            )}
        </div>
    )
}
