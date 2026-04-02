"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Brain, Play, Pause, Edit, Trash2,
  AlertTriangle, MessageSquare, Loader2,
} from 'lucide-react'

// 交易所显示名映射
const EXCHANGE_DISPLAY: Record<string, string> = {
  binance: 'Binance', okx: 'OKX', bybit: 'Bybit', gate: 'Gate.io',
  bitget: 'Bitget', coinbase: 'Coinbase',
  hyperliquid: 'Hyperliquid', aster: 'Aster', lighter: 'Lighter',
};
import {
  useStrategyList, useStrategyControl,
  useDeleteStrategy,
} from '@/hooks/useAi'
import type { AiStrategy, AiStrategyWithPnl } from '@/types/ai'
import { useTranslations } from '@/i18n/provider'

type StrategyStatus = 'running' | 'paused' | 'stopped'

interface PageProps {
  embedded?: boolean;
}

// ===================== 主页面 =====================

export function Page({ embedded }: PageProps = {}) {
  const router = useRouter()
  const t = useTranslations('ai')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // API hooks
  const { data: strategyData, isLoading: loadingStrategies } = useStrategyList(1, 50)
  const strategyControl = useStrategyControl()
  const deleteStrategy = useDeleteStrategy()

  // 策略数据 — 运行中优先
  const strategies = [...(strategyData?.data ?? [])].sort((a, b) => {
    const aActive = a.isActive ? 1 : 0;
    const bActive = b.isActive ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })
  const totalPnl = strategies.reduce((sum, s) => sum + Number(s.totalPnl), 0)
  const avgWinRate = strategies.length > 0
    ? strategies.reduce((sum, s) => sum + Number(s.winRate), 0) / strategies.length
    : 0

  // 工具函数
  const getStatus = (s: AiStrategy): StrategyStatus => s.isActive ? 'running' : 'stopped'
  const getCoins = (s: AiStrategy): string[] => {
    try { return s.coinSourceConfig?.coins || [] } catch { return [] }
  }

  const statusConfig: Record<StrategyStatus, { color: string; dot: string; label: string }> = {
    running: { color: 'text-[#10B981]', dot: 'bg-[#10B981]', label: t('common.running') },
    paused: { color: 'text-[#EAB308]', dot: 'bg-[#EAB308]', label: t('common.paused') },
    stopped: { color: 'text-[#606070]', dot: 'bg-[#606070]', label: t('common.stopped') },
  }

  const handleAction = async (id: string, action: 'start' | 'stop' | 'pause') => {
    try { await strategyControl.mutateAsync({ id, action }) } catch (e) { if (process.env.NODE_ENV === 'development') { console.error(e) } }
  }

  const handleDelete = async (id: string) => {
    try { await deleteStrategy.mutateAsync(id); setDeleteConfirmId(null) } catch (e) { if (process.env.NODE_ENV === 'development') { console.error(e) } }
  }

  // ===================== 渲染 =====================

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-[#0A0A0F] text-[#F8F8FC]`}>
      {/* 顶部导航 */}
      {!embedded && (
        <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0A0A0F] pt-[env(safe-area-inset-top)] [transform:translateZ(0)] px-4 h-14 border-b border-[#1E1E2E]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label={t('common.back')}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-[#1E1E2E] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base font-semibold">{t('list.title')}</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push('/ai/create')}
            aria-label={t('list.createStrategy')}
            className="w-10 h-10 rounded-xl bg-[#06B6D4] flex items-center justify-center hover:bg-[#0891B2] transition-colors shadow-lg shadow-[#06B6D4]/20"
          >
            <Plus className="w-5 h-5" />
          </button>
        </header>
      )}

      {/* 统计卡片 */}
      <div className="px-4 py-3">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden grid grid-cols-3">
          <div className="p-3 text-center">
            <div className="text-[#606070] text-[10px] mb-1">{t('list.strategyCount')}</div>
            <div className="text-[#06B6D4] text-lg font-semibold font-mono">{strategies.length}</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-[#606070] text-[10px] mb-1">{t('list.totalPnlSummary')}</div>
            <div className={`text-lg font-semibold font-mono ${totalPnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </div>
          </div>
          <div className="p-3 text-center">
            <div className="text-[#606070] text-[10px] mb-1">{t('list.avgWinRate')}</div>
            <div className="text-[#F8F8FC] text-lg font-semibold font-mono">{avgWinRate.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* 嵌入模式下的创建按钮 */}
      {embedded && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => router.push('/ai/create')}
            className="w-full bg-[#06B6D4] text-[#F8F8FC] py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#0891B2] transition-colors shadow-lg shadow-[#06B6D4]/20"
          >
            <Plus className="w-5 h-5" />
            {t('list.createNew')}
          </button>
        </div>
      )}

      {/* 策略列表 */}
      <div className="px-4 py-4">
        {/* =================== 我的策略 =================== */}
        {(
          <div className="space-y-3">
            {loadingStrategies ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : strategies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#606070]">
                <Brain className="w-12 h-12 mb-4 text-[#606070]/30" />
                <div className="text-sm mb-1">{t('list.noStrategies')}</div>
                <div className="text-xs text-[#606070]/60 mb-6">{t('list.noStrategiesDesc')}</div>
                <button
                  type="button"
                  onClick={() => router.push('/ai/create')}
                  className="px-6 py-2.5 bg-[#06B6D4] text-[#F8F8FC] rounded-xl text-sm font-medium hover:bg-[#0891B2] transition-colors"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  {t('list.createStrategy')}
                </button>
              </div>
            ) : (
              strategies.map((s) => {
                const status = getStatus(s)
                const coins = getCoins(s)
                const pnl = Number(s.totalPnl)
                const todayPnl = Number((s as AiStrategyWithPnl).todayPnl || 0)
                const winRate = Number(s.winRate)
                const sharpe = Number(s.sharpe)
                const mode = s.tradingMode === 'solo' ? t('modes.solo') : t('modes.debate')
                const sc = statusConfig[status]

                return (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/ai/strategy/${s.id}`)}
                    className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 cursor-pointer hover:border-[#06B6D4]/40 transition-all active:scale-[0.98]"
                  >
                    {/* 策略名+状态 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-[#1E1E2E] rounded-xl flex items-center justify-center">
                          <Brain className="w-4 h-4 text-[#06B6D4]" />
                        </div>
                        <div>
                          <div className="font-medium text-[#F8F8FC]">{s.name}</div>
                          <div className={`text-xs flex items-center gap-1.5 ${sc.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 模式+币种+交易所 */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {s.tradingMode !== 'solo' ? (
                        <span className="px-2 py-0.5 bg-[#8B5CF6]/15 text-[#8B5CF6] text-xs rounded flex items-center gap-1 font-medium">
                          <MessageSquare className="w-3 h-3" /> {t('modes.debate')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded">{t('modes.solo')}</span>
                      )}
                      {coins.slice(0, 4).map((c) => (
                        <span key={c} className="px-2 py-0.5 bg-[#1E1E2E] text-[#06B6D4] text-xs rounded">{c}</span>
                      ))}
                      {coins.length > 4 && (
                        <span className="px-2 py-0.5 text-[#606070] text-xs">+{coins.length - 4}</span>
                      )}
                      {(s as AiStrategyWithPnl).exchangeName && (
                        <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded ml-auto">
                          {EXCHANGE_DISPLAY[(s as AiStrategyWithPnl).exchangeName!] ?? (s as AiStrategyWithPnl).exchangeName}
                        </span>
                      )}
                    </div>

                    {/* PnL 数据 */}
                    <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-[#1E1E2E]">
                      <div>
                        <div className="text-[#606070] text-[10px] mb-0.5">{t('list.today')}</div>
                        <div className={`font-semibold text-xs font-mono ${todayPnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                          {todayPnl >= 0 ? '+' : ''}{todayPnl.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#606070] text-[10px] mb-0.5">{t('list.totalPnl')}</div>
                        <div className={`font-semibold text-xs font-mono ${pnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#606070] text-[10px] mb-0.5">{t('list.winRate')}</div>
                        <div className="text-[#F8F8FC] font-medium text-xs font-mono">{winRate.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-[#606070] text-[10px] mb-0.5">{t('detail.trades')}</div>
                        <div className="text-[#F8F8FC] font-medium text-xs font-mono">{Number(s.totalTrades ?? 0)}</div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {status === 'running' && (
                        <button
                          type="button"
                          onClick={() => handleAction(s.id, 'pause')}
                          disabled={strategyControl.isPending}
                          className="flex-1 bg-[#1E1E2E] text-[#EAB308] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#252530] transition-colors disabled:opacity-50"
                        >
                          <Pause className="w-3.5 h-3.5" /> {t('common.pause')}
                        </button>
                      )}
                      {status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => handleAction(s.id, 'start')}
                          disabled={strategyControl.isPending}
                          className="flex-1 bg-[#06B6D4] text-[#F8F8FC] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#0891B2] transition-colors disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5" /> {t('common.start')}
                        </button>
                      )}
                      {status === 'stopped' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction(s.id, 'start')}
                            disabled={strategyControl.isPending}
                            className="flex-1 bg-[#06B6D4] text-[#F8F8FC] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#0891B2] transition-colors disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5" /> {t('common.start')}
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/ai/strategy/${s.id}?tab=config`)}
                            className="px-3 bg-[#1E1E2E] text-[#9090A0] py-2 rounded-lg hover:bg-[#252530] transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(s.id)}
                            className="px-3 bg-[#1E1E2E] text-[#F43F5E] py-2 rounded-lg hover:bg-[#252530] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] p-6 pb-24 shadow-2xl animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#F43F5E]/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#F43F5E]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('list.deleteStrategy')}</h2>
                <p className="text-sm text-[#9090A0]">{t('list.deleteConfirm')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteStrategy.isPending}
                className="flex-1 py-3 bg-[#F43F5E] text-[#F8F8FC] text-sm font-medium rounded-lg active:opacity-80 disabled:opacity-50"
              >
                {deleteStrategy.isPending ? t('common.deleting') : t('list.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
