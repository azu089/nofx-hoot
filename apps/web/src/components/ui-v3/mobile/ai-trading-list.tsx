"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Brain, TrendingUp, Play, Pause, Edit, Trash2 } from 'lucide-react'
import { useStrategyList, useCompetition, useStrategyControl, useDeleteStrategy } from '@/hooks/useAi'
import type { AiStrategy, CompetitionEntry } from '@/types/ai'

type StrategyStatus = 'running' | 'paused' | 'stopped'

export function Page() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'my' | 'ranking'>('my')
  const [rankingPeriod, setRankingPeriod] = useState<'day' | 'week' | 'month'>('week')

  // API hooks
  const { data: strategyData, isLoading: loadingStrategies } = useStrategyList(1, 50)
  const periodMap = { day: 'daily', week: 'weekly', month: 'monthly' } as const
  const { data: competitionData, isLoading: loadingCompetition } = useCompetition(
    periodMap[rankingPeriod],
    1,
    50
  )
  const strategyControl = useStrategyControl()
  const deleteStrategy = useDeleteStrategy()

  // Extract strategies and compute stats
  const strategies = strategyData?.data ?? []
  const totalPnl = strategies.reduce((sum, s) => sum + Number(s.totalPnl), 0)
  const avgWinRate =
    strategies.length > 0
      ? strategies.reduce((sum, s) => sum + Number(s.winRate), 0) / strategies.length
      : 0

  // Convert backend strategy to frontend format
  const getStrategyStatus = (strategy: AiStrategy): StrategyStatus => {
    return strategy.isActive ? 'running' : 'stopped'
  }

  const extractCoins = (strategy: AiStrategy): string[] => {
    try {
      const config = strategy.coinSourceConfig as any
      return config?.coins || []
    } catch {
      return []
    }
  }

  const handleStrategyAction = async (id: string, action: 'start' | 'stop' | 'pause') => {
    try {
      await strategyControl.mutateAsync({ id, action })
    } catch (error) {
      console.error('Strategy action failed:', error)
    }
  }

  const handleDeleteStrategy = async (id: string) => {
    if (!confirm('确定要删除这个策略吗？')) return
    try {
      await deleteStrategy.mutateAsync(id)
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleStrategyClick = (id: string) => {
    router.push(`/ai-trading/${id}`)
  }

  const handleCreateClick = () => {
    router.push('/ai-trading/create')
  }

  const getStatusColor = (status: StrategyStatus) => {
    switch (status) {
      case 'running':
        return 'text-[#22C55E]'
      case 'paused':
        return 'text-[#EAB308]'
      case 'stopped':
        return 'text-[#64748B]'
    }
  }

  const getStatusText = (status: StrategyStatus) => {
    switch (status) {
      case 'running':
        return '🟢 运行中'
      case 'paused':
        return '🟡 暂停中'
      case 'stopped':
        return '⚫ 已停止'
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#0A0A0F] px-4 py-4 border-b border-[#1E1E2E]">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="返回"
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[#12121A] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">AI 自动交易</h1>
      </header>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <div className="bg-[#12121A] rounded-xl p-4 border border-[#1E1E2E]">
          <div className="text-[#94A3B8] text-sm mb-1">总 PnL</div>
          <div className={`text-2xl font-semibold ${totalPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {totalPnl >= 0 ? '+' : ''}
            {totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="bg-[#12121A] rounded-xl p-4 border border-[#1E1E2E]">
          <div className="text-[#94A3B8] text-sm mb-1">胜率</div>
          <div className="text-white text-2xl font-semibold">{avgWinRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* 创建新策略按钮 */}
      <div className="px-4 pb-4">
        <button
          type="button"
          aria-label="创建新策略"
          onClick={handleCreateClick}
          className="w-full bg-[#06B6D4] text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[#0891B2] transition-colors"
        >
          <Plus className="w-5 h-5" />
          创建新策略
        </button>
      </div>

      {/* Tab 切换栏 */}
      <div className="flex gap-1 px-4 pb-4 border-b border-[#1E1E2E]">
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
            activeTab === 'my'
              ? 'bg-[#06B6D4] text-white'
              : 'bg-[#12121A] text-[#94A3B8] hover:text-white'
          }`}
        >
          我的策略
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ranking')}
          className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
            activeTab === 'ranking'
              ? 'bg-[#06B6D4] text-white'
              : 'bg-[#12121A] text-[#94A3B8] hover:text-white'
          }`}
        >
          排行榜
        </button>
      </div>

      {/* Tab 内容 */}
      <div className="px-4 py-4">
        {activeTab === 'my' ? (
          <div className="space-y-3">
            {loadingStrategies ? (
              <div className="text-center text-[#94A3B8] py-8">加载中...</div>
            ) : strategies.length === 0 ? (
              <div className="text-center text-[#94A3B8] py-8">暂无策略</div>
            ) : (
              strategies.map((backendStrategy) => {
                const status = getStrategyStatus(backendStrategy)
                const coins = extractCoins(backendStrategy)
                const totalPnl = Number(backendStrategy.totalPnl)
                const winRate = Number(backendStrategy.winRate)
                const sharpe = Number(backendStrategy.sharpe)
                const mode = backendStrategy.tradingMode === 'solo' ? 'Solo' : 'Debate'

                return (
                  <div
                    key={backendStrategy.id}
                    onClick={() => handleStrategyClick(backendStrategy.id)}
                    className="bg-[#12121A] rounded-xl p-4 border border-[#1E1E2E] cursor-pointer hover:border-[#06B6D4] transition-colors"
                  >
                    {/* 策略名称和状态 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#1A1A24] rounded-lg flex items-center justify-center">
                          <Brain className="w-4 h-4 text-[#06B6D4]" />
                        </div>
                        <div>
                          <div className="font-medium text-white">{backendStrategy.name}</div>
                          <div className={`text-xs ${getStatusColor(status)}`}>
                            {getStatusText(status)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 交易模式和币种 */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 bg-[#1A1A24] text-[#94A3B8] text-xs rounded">
                        {mode}
                      </span>
                      {coins.map((coin) => (
                        <span
                          key={coin}
                          className="px-2 py-0.5 bg-[#1A1A24] text-[#06B6D4] text-xs rounded"
                        >
                          {coin}
                        </span>
                      ))}
                    </div>

                    {/* PnL 数据 */}
                    <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-[#1E1E2E]">
                      <div>
                        <div className="text-[#64748B] text-xs mb-1">今日 PnL</div>
                        <div className="text-[#64748B] font-semibold text-sm">
                          N/A
                        </div>
                      </div>
                      <div>
                        <div className="text-[#64748B] text-xs mb-1">总 PnL</div>
                        <div
                          className={`font-semibold ${
                            totalPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                          }`}
                        >
                          {totalPnl >= 0 ? '+' : ''}
                          {totalPnl.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* 统计数据 */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <div className="text-[#64748B] text-xs mb-1">交易笔数</div>
                        <div className="text-white font-medium">{backendStrategy.totalTrades}</div>
                      </div>
                      <div>
                        <div className="text-[#64748B] text-xs mb-1">胜率</div>
                        <div className="text-white font-medium">{winRate.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-[#64748B] text-xs mb-1">Sharpe</div>
                        <div className="text-white font-medium">{sharpe.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {status === 'running' && (
                        <button
                          type="button"
                          aria-label="暂停策略"
                          onClick={() => handleStrategyAction(backendStrategy.id, 'pause')}
                          disabled={strategyControl.isPending}
                          className="flex-1 bg-[#1A1A24] text-[#EAB308] py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[#252530] transition-colors disabled:opacity-50"
                        >
                          <Pause className="w-4 h-4" />
                          暂停
                        </button>
                      )}
                      {status === 'paused' && (
                        <button
                          type="button"
                          aria-label="恢复策略"
                          onClick={() => handleStrategyAction(backendStrategy.id, 'start')}
                          disabled={strategyControl.isPending}
                          className="flex-1 bg-[#1A1A24] text-[#22C55E] py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[#252530] transition-colors disabled:opacity-50"
                        >
                          <Play className="w-4 h-4" />
                          恢复
                        </button>
                      )}
                      {status === 'stopped' && (
                        <>
                          <button
                            type="button"
                            aria-label="启动策略"
                            onClick={() => handleStrategyAction(backendStrategy.id, 'start')}
                            disabled={strategyControl.isPending}
                            className="flex-1 bg-[#06B6D4] text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[#0891B2] transition-colors disabled:opacity-50"
                          >
                            <Play className="w-4 h-4" />
                            启动
                          </button>
                          <button
                            type="button"
                            aria-label="编辑策略"
                            onClick={() => router.push(`/ai-trading/${backendStrategy.id}/edit`)}
                            className="px-4 bg-[#1A1A24] text-[#94A3B8] py-2 rounded-lg hover:bg-[#252530] transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="删除策略"
                            onClick={() => handleDeleteStrategy(backendStrategy.id)}
                            disabled={deleteStrategy.isPending}
                            className="px-4 bg-[#1A1A24] text-[#EF4444] py-2 rounded-lg hover:bg-[#252530] transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div>
            {/* 时间筛选 */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setRankingPeriod('day')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  rankingPeriod === 'day'
                    ? 'bg-[#06B6D4] text-white'
                    : 'bg-[#12121A] text-[#94A3B8] hover:text-white'
                }`}
              >
                日榜
              </button>
              <button
                type="button"
                onClick={() => setRankingPeriod('week')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  rankingPeriod === 'week'
                    ? 'bg-[#06B6D4] text-white'
                    : 'bg-[#12121A] text-[#94A3B8] hover:text-white'
                }`}
              >
                周榜
              </button>
              <button
                type="button"
                onClick={() => setRankingPeriod('month')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  rankingPeriod === 'month'
                    ? 'bg-[#06B6D4] text-white'
                    : 'bg-[#12121A] text-[#94A3B8] hover:text-white'
                }`}
              >
                月榜
              </button>
            </div>

            {/* 排名列表 */}
            <div className="space-y-2">
              {loadingCompetition ? (
                <div className="text-center text-[#94A3B8] py-8">加载中...</div>
              ) : !competitionData?.data || competitionData.data.length === 0 ? (
                <div className="text-center text-[#94A3B8] py-8">暂无排行数据</div>
              ) : (
                competitionData.data.map((item) => {
                  const roi = item.roi ?? 0
                  const sharpe = Number(item.sharpe)
                  const isMe = false // TODO: 需要从后端获取当前用户的 strategyId 来判断

                  return (
                    <div
                      key={item.rank}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                        isMe
                          ? 'bg-[#06B6D4]/10 border-[#06B6D4]'
                          : 'bg-[#12121A] border-[#1E1E2E]'
                      }`}
                    >
                      {/* 排名 */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold ${
                          item.rank === 1
                            ? 'bg-gradient-to-br from-[#FCD34D] to-[#F59E0B] text-[#0A0A0F]'
                            : item.rank === 2
                            ? 'bg-gradient-to-br from-[#D1D5DB] to-[#9CA3AF] text-[#0A0A0F]'
                            : item.rank === 3
                            ? 'bg-gradient-to-br from-[#FDBA74] to-[#F97316] text-[#0A0A0F]'
                            : 'bg-[#1A1A24] text-[#94A3B8]'
                        }`}
                      >
                        {item.rank}
                      </div>

                      {/* 用户名 */}
                      <div className="flex-1">
                        <div className={`font-medium ${isMe ? 'text-[#06B6D4]' : 'text-white'}`}>
                          {item.username}
                          {isMe && (
                            <span className="ml-2 px-2 py-0.5 bg-[#06B6D4] text-white text-xs rounded">
                              我
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ROI */}
                      <div className="text-right">
                        <div className={`font-semibold flex items-center gap-1 ${roi >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                          <TrendingUp className="w-4 h-4" />
                          {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                        </div>
                        <div className="text-[#64748B] text-xs mt-0.5">
                          Sharpe {sharpe.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
