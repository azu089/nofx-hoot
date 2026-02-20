'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Clock, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Check, Wifi, WifiOff, RefreshCw, Pause, Square, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useResearchStatus, useResearchReport, useExecuteResearch, useCampaignStats, useStopResearchCycling, usePauseResearchCycling, useResumeResearchCycling } from '@/hooks/useAi';
import { useResearchProgress, type ResearchProgressEvent } from '@/hooks/useSocket';
import { PERSONALITY_COLORS, PERSONALITY_LABELS, PERSONALITY_EMOJIS, ACTION_CONFIG, MODEL_DISPLAY } from '@/constants/debate';
import { AIAvatar } from '@/components/ui-v3/ai/ai-avatar';
import { useTranslations } from '@/i18n/provider';

type Status = 'running' | 'completed' | 'failed';
type StageStatus = 'completed' | 'running' | 'pending';
type AnalystType = 'market' | 'technical' | 'fundamental' | 'news' | 'sentiment';
type Direction = 'long' | 'short';
type RiskLevel = 'low' | 'medium' | 'high';

interface Analyst {
  id: AnalystType;
  name: string;
  status: StageStatus;
}

interface Stage {
  id: string;
  name: string;
  status: StageStatus;
  description?: string;
  analysts?: Analyst[];
}

interface DecisionData {
  direction: Direction;
  confidence: number;
  leverage: number;
  positionPercent: number;
  riskRewardRatio: string;
  stopLoss: string;
  takeProfit: string;
  riskLevel: RiskLevel;
  duration: string;
}

function formatCampaignTime(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function calcCampaignWinRate(children: any[]): number {
  const finished = children.filter((c) => c.status === 'completed' && c.finalDecision);
  if (finished.length === 0) return 0;
  const profitable = finished.filter((c) => (c.pnl ?? 0) > 0).length;
  return Math.round((profitable / finished.length) * 100);
}

export function ResearchDetailPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  const t = useTranslations('ai');

  const [expandedStage, setExpandedStage] = useState<string | null>('analysts');
  const [activeTab, setActiveTab] = useState<string>('analysts');
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [campaignTab, setCampaignTab] = useState<'overview' | 'cycles' | 'current'>('overview');
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useResearchStatus(sessionId);
  const { data: reportData, refetch: refetchReport } = useResearchReport(
    sessionId,
    statusData?.status === 'completed' || statusData?.status === 'failed'
  );
  const executeResearch = useExecuteResearch();

  // WebSocket 实时进度
  const handleWsProgress = useCallback((event: ResearchProgressEvent) => {
    if (event.stage === 'completed' || event.stage === 'failed') {
      refetchStatus();
      refetchReport();
    }
  }, [refetchStatus, refetchReport]);
  const { connected: wsConnected } = useResearchProgress(sessionId, handleWsProgress);

  const status = (statusData?.status || 'running') as Status;
  const symbol = statusData?.symbol || 'BTC/USDT';

  // 循环模式判断 — 从 statusData 或 reportData 获取
  const rootId = (statusData as any)?.rootSessionId || reportData?.rootSessionId ||
                ((statusData as any)?.campaignStatus || reportData?.campaignStatus ? sessionId : undefined);
  const isCyclingMode = !!rootId;
  const campaignStats = useCampaignStats(rootId);
  const stopCycling = useStopResearchCycling();
  const pauseCycling = usePauseResearchCycling();
  const resumeCycling = useResumeResearchCycling();

  // 从 reportData 构建 stages
  const stages: Stage[] = (reportData?.stages || []).map((s: any, idx: number) => ({
    id: `stage-${idx + 1}`,
    name: s.name || t('research.stage', { n: idx + 1 }),
    status: s.status as StageStatus || 'pending',
    description: s.status === 'running' ? t('research.aiProcessing') : undefined,
    ...(idx === 0 && s.status === 'completed' ? {
      analysts: [
        { id: 'market', name: t('research.analystMarket'), status: 'completed' as StageStatus },
        { id: 'technical', name: t('research.analystTechnical'), status: 'completed' as StageStatus },
        { id: 'fundamental', name: t('research.analystFundamental'), status: 'completed' as StageStatus },
        { id: 'news', name: t('research.analystNews'), status: 'completed' as StageStatus },
        { id: 'sentiment', name: t('research.analystSentiment'), status: 'completed' as StageStatus },
      ]
    } : {})
  }));

  // 如果没有 stages，提供默认 5 阶段
  if (stages.length === 0 && status === 'running') {
    stages.push(
      { id: 'analysts', name: t('research.stageAnalysts'), status: 'pending' },
      { id: 'debate', name: t('research.stageDebate'), status: 'pending' },
      { id: 'trader', name: t('research.stageTrader'), status: 'pending' },
      { id: 'risk', name: t('research.stageRisk'), status: 'pending' },
      { id: 'decision', name: t('research.stageDecision'), status: 'pending' }
    );
  }

  const decisionData: DecisionData | null = reportData?.finalDecision ? {
    direction: reportData.finalDecision.action?.includes('long') ? 'long' : 'short',
    confidence: reportData.finalDecision.confidence || 0,
    leverage: reportData.finalDecision.leverage || 1,
    positionPercent: reportData.finalDecision.positionSizePercent || 0,
    riskRewardRatio: (() => {
      const sl = reportData.finalDecision.stopLoss;
      const tp = reportData.finalDecision.takeProfit;
      if (sl && tp && sl !== 0) {
        const ratio = Math.abs(Number(tp)) / Math.abs(Number(sl));
        return `1:${ratio.toFixed(1)}`;
      }
      return 'N/A';
    })(),
    stopLoss: reportData.finalDecision.stopLoss?.toString() || '0',
    takeProfit: reportData.finalDecision.takeProfit?.toString() || '0',
    riskLevel: reportData.finalDecision.confidence > 80 ? 'low' : reportData.finalDecision.confidence > 60 ? 'medium' : 'high',
    duration: (() => {
      if (reportData.createdAt && reportData.updatedAt) {
        const diffMs = new Date(reportData.updatedAt).getTime() - new Date(reportData.createdAt).getTime();
        const sec = Math.floor(diffMs / 1000);
        if (sec < 60) return `${sec}s`;
        const min = Math.floor(sec / 60);
        return `${min}m ${sec % 60}s`;
      }
      return t('common.loading');
    })(),
  } : null;

  const handleExecute = async () => {
    if (!sessionId) return;
    try {
      await executeResearch.mutateAsync(sessionId);
      toast.success(t('research.tradeExecuted'));
      setShowExecuteModal(false);
    } catch (err: any) {
      toast.error(err.message || t('common.failed'));
    }
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'analysts', name: t('research.tabAnalysts') },
    { id: 'debate', name: t('research.tabDebate') },
    { id: 'trader', name: t('research.tabTrader') },
    { id: 'risk', name: t('research.tabRisk') },
    { id: 'decision', name: t('research.tabDecision') },
  ];

  const getStageIcon = (stageStatus: StageStatus) => {
    switch (stageStatus) {
      case 'completed':
        return <div className="w-4 h-4 rounded-full bg-[#10B981]" />;
      case 'running':
        return <div className="w-4 h-4 rounded-full bg-[#06B6D4] animate-pulse" />;
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-[#606070]" />;
    }
  };

  const getStatusText = (stageStatus: StageStatus) => {
    switch (stageStatus) {
      case 'completed':
        return <span className="text-[#10B981]">{t('research.statusComplete')}</span>;
      case 'running':
        return <span className="text-[#06B6D4]">{t('research.statusInProgress')}</span>;
      case 'pending':
        return <span className="text-[#606070]">{t('research.statusWaiting')}</span>;
    }
  };

  const getRiskLevelConfig = (level: RiskLevel) => {
    switch (level) {
      case 'low':
        return { text: t('research.riskLevel') + ' Low', color: 'text-[#10B981]', dotColor: 'bg-[#10B981]' };
      case 'medium':
        return { text: t('research.riskLevel') + ' Medium', color: 'text-[#F59E0B]', dotColor: 'bg-[#F59E0B]' };
      case 'high':
        return { text: t('research.riskLevel') + ' High', color: 'text-[#F43F5E]', dotColor: 'bg-[#F43F5E]' };
    }
  };

  // 分析师标签映射
  const analystMap: { keys: string[]; label: string }[] = [
    { keys: ['marketReport', 'market'], label: t('research.analystMarket') },
    { keys: ['technicalReport', 'technical'], label: t('research.analystTechnical') },
    { keys: ['fundamentalsReport', 'fundamentals'], label: t('research.analystFundamental') },
    { keys: ['newsReport', 'news'], label: t('research.analystNews') },
    { keys: ['sentimentReport', 'sentiment'], label: t('research.analystSentiment') },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-30 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 flex items-center justify-center hover:bg-[#1E1E2E] rounded-xl transition-colors"
            aria-label={t('common.back')}
            title={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-[#F8F8FC] flex items-center gap-2">
            {isCyclingMode ? `${symbol} ${t('research.autoResearch')}` : status === 'running' ? `${symbol} ${t('research.researching')}` : `${symbol} ${t('research.researchReport')}`}
            {status === 'running' && !isCyclingMode && (
              wsConnected
                ? <Wifi className="w-4 h-4 text-[#10B981]" />
                : <WifiOff className="w-4 h-4 text-[#606070]" />
            )}
          </h1>
        </div>
      </header>

      {/* ================ 循环模式 — Tab 布局 ================ */}
      {isCyclingMode && campaignStats.data && (
        <div className="pb-6">
          {/* 4列统计 */}
          <div className="grid grid-cols-4 gap-2 px-4 py-3">
            <div className="glass-card-hd p-3">
              <div className="text-[#606070] text-[10px] mb-0.5">{t('research.cumulativePnl')}</div>
              <div className={`text-sm font-semibold font-mono ${campaignStats.data.cumulativePnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                {campaignStats.data.cumulativePnl >= 0 ? '+' : ''}{campaignStats.data.cumulativePnl.toFixed(2)}
              </div>
            </div>
            <div className="glass-card-hd p-3">
              <div className="text-[#606070] text-[10px] mb-0.5">{t('research.cycles')}</div>
              <div className="text-sm font-semibold font-mono text-[#F8F8FC]">
                {campaignStats.data.currentCycle}/{campaignStats.data.totalCycles || '∞'}
              </div>
            </div>
            <div className="glass-card-hd p-3">
              <div className="text-[#606070] text-[10px] mb-0.5">{t('research.cost')}</div>
              <div className="text-sm font-semibold font-mono text-[#F8F8FC]">
                ${campaignStats.data.cumulativeCost.toFixed(2)}
              </div>
            </div>
            <div className="glass-card-hd p-3">
              <div className="text-[#606070] text-[10px] mb-0.5">{t('research.winRate')}</div>
              <div className="text-sm font-semibold font-mono text-[#F8F8FC]">
                {calcCampaignWinRate(campaignStats.data.childSessions)}%
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          {(campaignStats.data.status === 'running' || campaignStats.data.status === 'paused') && (
            <div className="flex gap-2 px-4 pb-3">
              {campaignStats.data.status === 'running' ? (
                <>
                  <button
                    onClick={() => pauseCycling.mutate(rootId!)}
                    disabled={pauseCycling.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1E1E2E] rounded-lg text-sm text-yellow-400 hover:bg-[#2E2E3E] transition-colors disabled:opacity-50"
                  >
                    <Pause className="w-4 h-4" /> {t('common.pause')}
                  </button>
                  <button
                    onClick={() => stopCycling.mutate(rootId!)}
                    disabled={stopCycling.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1E1E2E] rounded-lg text-sm text-[#F43F5E] hover:bg-[#2E2E3E] transition-colors disabled:opacity-50"
                  >
                    <Square className="w-4 h-4" /> {t('common.stop')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => resumeCycling.mutate(rootId!)}
                    disabled={resumeCycling.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-cyan-500/20 rounded-lg text-sm text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" /> {t('common.resume')}
                  </button>
                  <button
                    onClick={() => stopCycling.mutate(rootId!)}
                    disabled={stopCycling.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1E1E2E] rounded-lg text-sm text-[#F43F5E] hover:bg-[#2E2E3E] transition-colors disabled:opacity-50"
                  >
                    <Square className="w-4 h-4" /> {t('common.stop')}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tab 栏 */}
          <div className="flex gap-2 px-4 pb-3 border-b border-[#1E1E2E]">
            {([
              { id: 'overview' as const, name: t('detail.overviewTab') },
              { id: 'cycles' as const, name: t('research.cycleLog') },
              { id: 'current' as const, name: t('research.currentCycle') },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCampaignTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-lg ${
                  campaignTab === tab.id
                    ? 'bg-[#06B6D4] text-[#F8F8FC]'
                    : 'bg-[#1E1E2E] text-[#9090A0] hover:text-[#F8F8FC]'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* ===== 概览 Tab ===== */}
          {campaignTab === 'overview' && (
            <div className="px-4 mt-4 space-y-4">
              {/* 运行信息卡 */}
              <div className="glass-card-hd p-4 space-y-3">
                <div className="text-xs text-[#06B6D4] font-medium">{t('research.runInfo')}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[#606070]">{t('research.status')}</div>
                    <div className={`text-sm font-medium ${
                      campaignStats.data.status === 'running' ? 'text-[#10B981]' :
                      campaignStats.data.status === 'paused' ? 'text-[#EAB308]' :
                      campaignStats.data.status === 'completed' ? 'text-[#06B6D4]' : 'text-[#606070]'
                    }`}>
                      {campaignStats.data.status === 'running' ? t('common.running') :
                       campaignStats.data.status === 'paused' ? t('common.paused') :
                       campaignStats.data.status === 'completed' ? t('common.completed') : t('common.stopped')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#606070]">{t('research.runDuration')}</div>
                    <div className="text-sm font-mono text-[#F8F8FC]">
                      {formatCampaignTime(campaignStats.data.startedAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#606070]">{t('research.interval')}</div>
                    <div className="text-sm font-mono text-[#F8F8FC]">
                      {(statusData as any)?.cyclingConfig?.intervalMinutes || (reportData as any)?.cyclingConfig?.intervalMinutes || '?'} {t('research.minutes')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#606070]">{t('research.maxCyclesLabel')}</div>
                    <div className="text-sm font-mono text-[#F8F8FC]">
                      {campaignStats.data.totalCycles || t('research.infinite')}
                    </div>
                  </div>
                </div>
              </div>

              {/* 最新决策摘要 */}
              {(() => {
                const lastChild = campaignStats.data.childSessions[campaignStats.data.childSessions.length - 1];
                if (!lastChild?.finalDecision) return null;
                const fd = lastChild.finalDecision;
                const action = fd.action || '';
                const isLong = action === 'open_long' || action === 'close_short' || action.includes('long');
                const isShort = action === 'open_short' || action === 'close_long' || action.includes('short');
                return (
                  <div className="glass-card-hd p-4 space-y-2">
                    <div className="text-xs text-[#06B6D4] font-medium">{t('research.latestDecision', { cycle: lastChild.cycleNumber })}</div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        isLong ? 'bg-[#10B981]/20 text-[#10B981]' :
                        isShort ? 'bg-[#F43F5E]/20 text-[#F43F5E]' :
                        'bg-[#606070]/20 text-[#606070]'
                      }`}>
                        {isLong ? t('research.buy') : isShort ? t('research.sell') : t('research.hold')}
                      </span>
                      <span className="text-sm text-[#9090A0]">
                        {t('research.confidence')} {Math.round(fd.confidence || 0)}%
                      </span>
                      {lastChild.pnl != null && (
                        <span className={`text-sm font-mono ml-auto ${lastChild.pnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                          {lastChild.pnl >= 0 ? '+' : ''}{lastChild.pnl.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===== 周期日志 Tab ===== */}
          {campaignTab === 'cycles' && (
            <div className="px-4 mt-4 space-y-3">
              {campaignStats.data.childSessions.length === 0 ? (
                <div className="text-sm text-[#606070] text-center py-12">{t('research.noCycleLogs')}</div>
              ) : (
                [...campaignStats.data.childSessions]
                  .sort((a, b) => b.cycleNumber - a.cycleNumber)
                  .map((child) => {
                    const fd = child.finalDecision;
                    const action = fd?.action || '';
                    const isLong = action === 'open_long' || action === 'close_short' || action.includes('long');
                    const isShort = action === 'open_short' || action === 'close_long' || action.includes('short');
                    const isExpanded = expandedCycleId === child.id;

                    return (
                      <div key={child.id} className="glass-card-hd overflow-hidden">
                        <button
                          onClick={() => setExpandedCycleId(isExpanded ? null : child.id)}
                          className="w-full p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[#606070] font-mono w-8">#{child.cycleNumber}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isLong ? 'bg-[#10B981]/20 text-[#10B981]' :
                              isShort ? 'bg-[#F43F5E]/20 text-[#F43F5E]' :
                              'bg-[#606070]/20 text-[#606070]'
                            }`}>
                              {isLong ? t('research.buy') : isShort ? t('research.sell') : fd ? t('research.hold') : '-'}
                            </span>
                            {fd?.confidence != null && (
                              <span className="text-xs text-[#9090A0] font-mono">{Math.round(fd.confidence)}%</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {child.pnl != null && (
                              <span className={`text-xs font-mono ${child.pnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                                {child.pnl >= 0 ? '+' : ''}{child.pnl.toFixed(2)}
                              </span>
                            )}
                            <span className={`text-xs ${
                              child.status === 'completed' ? 'text-[#10B981]' :
                              child.status === 'failed' ? 'text-[#F43F5E]' :
                              child.status === 'running' ? 'text-[#06B6D4]' : 'text-[#9090A0]'
                            }`}>
                              {child.status === 'completed' ? t('research.statusComplete') :
                               child.status === 'failed' ? t('common.failed') :
                               child.status === 'running' ? t('common.running') : child.status}
                            </span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-[#606070]" /> : <ChevronDown className="w-4 h-4 text-[#606070]" />}
                          </div>
                        </button>
                        {isExpanded && fd && (
                          <div className="px-4 pb-4 border-t border-[#1E1E2E] pt-3 space-y-2">
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              {fd.leverage != null && (
                                <div>
                                  <div className="text-[#606070]">{t('research.leverage')}</div>
                                  <div className="text-[#F8F8FC] font-mono">{fd.leverage}x</div>
                                </div>
                              )}
                              {fd.positionSizePercent != null && (
                                <div>
                                  <div className="text-[#606070]">{t('research.position')}</div>
                                  <div className="text-[#F8F8FC] font-mono">{fd.positionSizePercent}%</div>
                                </div>
                              )}
                              {fd.stopLoss != null && (
                                <div>
                                  <div className="text-[#606070]">SL</div>
                                  <div className="text-[#F43F5E] font-mono">${fd.stopLoss}</div>
                                </div>
                              )}
                              {fd.takeProfit != null && (
                                <div>
                                  <div className="text-[#606070]">TP</div>
                                  <div className="text-[#10B981] font-mono">${fd.takeProfit}</div>
                                </div>
                              )}
                            </div>
                            {fd.reasoning && (
                              <div className="text-xs text-[#9090A0] leading-relaxed line-clamp-3 pt-1">
                                {fd.reasoning}
                              </div>
                            )}
                            <div className="text-[10px] text-[#606070] pt-1">
                              {new Date(child.createdAt).toLocaleString('zh-CN')}
                              {child.totalCost > 0 && ` · $${child.totalCost.toFixed(4)}`}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* ===== 当前周期 Tab ===== */}
          {campaignTab === 'current' && (
            <div className="px-4 mt-4">
              {/* 复用现有 5 阶段 Tab 系统 */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none border-b border-[#1E1E2E] mb-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'text-[#06B6D4] border-b-2 border-[#06B6D4]'
                        : 'text-[#606070] hover:text-[#9090A0]'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* 当前周期进度 */}
              {status === 'running' && (
                <div className="space-y-3 mb-4">
                  {stages.map((stage) => (
                    <div key={stage.id} className="flex items-center gap-3 px-2">
                      {getStageIcon(stage.status)}
                      <span className={`text-sm ${stage.status === 'completed' ? 'text-[#F8F8FC]' : 'text-[#606070]'}`}>
                        {stage.name}
                      </span>
                      <span className="ml-auto">{getStatusText(stage.status)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 阶段详情 — 复用 completed 的 tab 内容 */}
              {reportData?.stages && reportData.stages.length > 0 && (
                <div className="space-y-4">
                  {(() => {
                    const tabIndex = tabs.findIndex((t) => t.id === activeTab);
                    const stageResult = reportData?.stages?.[tabIndex]?.result;
                    if (!stageResult) return <div className="text-sm text-[#606070] p-4">{t('research.statusWaiting')}</div>;

                    if (activeTab === 'analysts') {
                      const reports = stageResult?.reports || {};
                      const reportEntries = analystMap
                        .map(({ keys: ks, label }) => {
                          const text = ks.reduce<string | null>((acc, k) => acc || reports[k] || null, null);
                          return text ? { label, text } : null;
                        })
                        .filter(Boolean) as { label: string; text: string }[];
                      if (reportEntries.length === 0) return <div className="text-sm text-[#606070] p-4">{t('common.analyzing')}</div>;
                      return reportEntries.map(({ label, text }) => (
                        <div key={label} className="glass-card glass-border-glow rounded-2xl p-4">
                          <div className="text-xs text-[#06B6D4] font-medium mb-2">{label}</div>
                          <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line line-clamp-6">
                            {typeof text === 'string' ? text : JSON.stringify(text, null, 2)}
                          </div>
                        </div>
                      ));
                    }
                    return <div className="text-sm text-[#606070] p-4">{t('research.statusWaiting')}</div>;
                  })()}
                </div>
              )}

              {/* 运行信息 */}
              <div className="mt-4 flex items-center justify-center gap-6 text-sm text-[#606070]">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{status === 'running' ? t('common.analyzing') : t('research.statusComplete')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span>{t('research.costLabel')} ${(statusData?.totalCost || reportData?.totalCost || 0).toFixed(4)}</span>
                </div>
                {wsConnected && (
                  <Wifi className="w-4 h-4 text-[#10B981]" />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Running 状态 - 进度视图（非循环模式） */}
      {!isCyclingMode && status === 'running' && (
        <div className="px-4 py-6">
          <div className="space-y-3">
            {stages.map((stage) => (
              <div key={stage.id} className="glass-card glass-border-glow rounded-2xl p-4">
                <button
                  onClick={() =>
                    stage.analysts &&
                    setExpandedStage(expandedStage === stage.id ? null : stage.id)
                  }
                  className="w-full flex items-center justify-between"
                  disabled={!stage.analysts}
                  aria-label={stage.name}
                >
                  <div className="flex items-center gap-3">
                    {getStageIcon(stage.status)}
                    <span className="font-medium">{stage.name}</span>
                    {getStatusText(stage.status)}
                  </div>
                  {stage.analysts &&
                    (expandedStage === stage.id ? (
                      <ChevronUp className="w-5 h-5 text-[#9090A0]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#9090A0]" />
                    ))}
                </button>

                {stage.status === 'running' && stage.description && (
                  <p className="mt-2 text-sm text-[#9090A0]">{stage.description}</p>
                )}

                {/* 分析师子项 */}
                {stage.analysts && expandedStage === stage.id && (
                  <div className="mt-4 pt-4 border-t border-[#1E1E2E] space-y-2">
                    {stage.analysts.map((analyst) => (
                      <div key={analyst.id} className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                        <span className="text-[#9090A0]">{analyst.name}</span>
                        <Check className="ml-auto w-4 h-4 text-[#10B981]" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 底部信息 */}
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[#606070]">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{t('research.researching')}</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              <span>{t('research.costLabel')} ${(statusData?.totalCost || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Failed 状态 - 错误提示 + 已完成阶段数据 */}
      {status === 'failed' && (
        <div className="px-4 py-6 space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-[#F43F5E]/30 bg-[#F43F5E]/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#F43F5E]/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-[#F43F5E]" />
              </div>
              <span className="font-semibold text-[#F43F5E]">{t('research.researchFailed')}</span>
            </div>
            <p className="text-sm text-[#9090A0] leading-relaxed">
              {statusData?.errorMessage || t('research.researchError')}
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs text-[#606070]">
              <span>{t('research.completedStages')} {statusData?.stagesCompleted || 0}/{statusData?.totalStages || 5}</span>
              <span>{t('research.costLabel')} ${(statusData?.totalCost || 0).toFixed(4)}</span>
            </div>
          </div>

          {/* 已完成阶段的 Tab 渲染 */}
          {reportData?.stages && reportData.stages.length > 0 && (
            <>
              <div className="flex gap-2 overflow-x-auto scrollbar-none border-b border-[#1E1E2E]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'text-[#06B6D4] border-b-2 border-[#06B6D4]'
                        : 'text-[#606070] hover:text-[#9090A0]'
                    }`}
                    aria-label={tab.name}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                {(() => {
                  const tabIndex = tabs.findIndex((t) => t.id === activeTab);
                  const stageResult = reportData?.stages?.[tabIndex]?.result;
                  if (!stageResult) return <div className="text-sm text-[#606070] p-4">{t('research.statusWaiting')}</div>;

                  if (activeTab === 'analysts') {
                    const reports = stageResult?.reports || {};
                    const reportEntries = analystMap
                      .map(({ keys: ks, label }) => {
                        const text = ks.reduce<string | null>((acc, k) => acc || reports[k] || null, null);
                        return text ? { label, text } : null;
                      })
                      .filter(Boolean) as { label: string; text: string }[];
                    if (reportEntries.length === 0) return <div className="text-sm text-[#606070] p-4">{t('research.statusWaiting')}</div>;
                    return reportEntries.map(({ label, text }) => (
                      <div key={label} className="glass-card glass-border-glow rounded-2xl p-4">
                        <div className="text-xs text-[#06B6D4] font-medium mb-2">{label}</div>
                        <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line line-clamp-6">
                          {typeof text === 'string' ? text : JSON.stringify(text, null, 2)}
                        </div>
                      </div>
                    ));
                  }
                  return <div className="text-sm text-[#606070] p-4">{t('research.statusWaiting')}</div>;
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* Completed 状态 - 报告视图（非循环模式） */}
      {!isCyclingMode && status === 'completed' && (
        <div className="pb-6">
          {/* 决策大卡片 — hold/wait 时不渲染 */}
          {decisionData && reportData?.finalDecision?.action !== 'hold' &&
           reportData?.finalDecision?.action !== 'wait' && (
          <div
            className={`mx-4 mt-6 p-6 rounded-2xl border-2 ${
              decisionData.direction === 'long'
                ? 'bg-[#10B981]/10 border-[#10B981]/30'
                : 'bg-[#F43F5E]/10 border-[#F43F5E]/30'
            }`}
          >
            {/* 方向和行动 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {decisionData.direction === 'long' ? (
                  <>
                    <TrendingUp className="w-8 h-8 text-[#10B981]" />
                    <div>
                      <div className="text-2xl font-bold text-[#10B981]">{t('research.long')}</div>
                      <div className="text-sm text-[#9090A0]">{t('research.buy')}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-8 h-8 text-[#F43F5E]" />
                    <div>
                      <div className="text-2xl font-bold text-[#F43F5E]">{t('research.short')}</div>
                      <div className="text-sm text-[#9090A0]">{t('research.sell')}</div>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-[#9090A0]">{t('research.confidence')}</div>
                <div className="text-2xl font-bold font-mono">{decisionData.confidence}%</div>
              </div>
            </div>

            {/* 4个数据网格 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#0A0A0F]/50 rounded-xl p-4">
                <div className="text-xs text-[#9090A0] mb-1">{t('research.leverage')}</div>
                <div className="text-xl font-bold font-mono">{decisionData.leverage}x</div>
              </div>
              <div className="bg-[#0A0A0F]/50 rounded-xl p-4">
                <div className="text-xs text-[#9090A0] mb-1">{t('research.position')}</div>
                <div className="text-xl font-bold font-mono">{decisionData.positionPercent}%</div>
              </div>
              <div className="bg-[#0A0A0F]/50 rounded-xl p-4">
                <div className="text-xs text-[#9090A0] mb-1">{t('research.rrRatio')}</div>
                <div className="text-xl font-bold font-mono">{decisionData.riskRewardRatio}</div>
              </div>
              <div className="bg-[#0A0A0F]/50 rounded-xl p-4">
                <div className="text-xs text-[#9090A0] mb-1">{t('research.riskRating')}</div>
                <div className={`text-lg font-bold flex items-center gap-1.5 ${getRiskLevelConfig(decisionData.riskLevel).color}`}>
                  <span className={`w-2 h-2 rounded-full ${getRiskLevelConfig(decisionData.riskLevel).dotColor}`} />
                  {getRiskLevelConfig(decisionData.riskLevel).text}
                </div>
              </div>
            </div>

            {/* 止损止盈 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9090A0]">{t('research.stopLoss')}</span>
                <span className="font-mono font-semibold text-[#F43F5E]">
                  ${decisionData.stopLoss}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9090A0]">{t('research.takeProfit')}</span>
                <span className="font-mono font-semibold text-[#10B981]">
                  ${decisionData.takeProfit}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#1E1E2E]">
                <span className="text-sm text-[#9090A0]">{t('research.researchDuration')}</span>
                <span className="text-sm font-medium">{decisionData.duration}</span>
              </div>
            </div>
          </div>
          )}

          {/* 三态执行结果展示 */}
          {(() => {
            const action = reportData?.finalDecision?.action || '';
            const isHoldWait = action === 'hold' || action === 'wait';
            const isAutoExecuted = !!reportData?.executedTradeId;

            if (isHoldWait) {
              // 状态1: AI 建议观望
              return (
                <div className="px-4 mt-6">
                  <div className="glass-card glass-border-glow rounded-2xl p-5 border border-[#606070]/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[#606070]/20 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-[#9090A0]" />
                      </div>
                      <span className="font-semibold text-[#9090A0]">{t('research.aiSuggestWait')}</span>
                    </div>
                    <p className="text-sm text-[#606070]">
                      {t('research.aiSuggestWaitDesc')}
                    </p>
                  </div>
                </div>
              );
            }

            if (isAutoExecuted) {
              // 状态2: 交易已自动执行
              return (
                <div className="px-4 mt-6">
                  <div className="glass-card glass-border-glow rounded-2xl p-5 border border-[#10B981]/30 bg-[#10B981]/5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-[#10B981]" />
                      </div>
                      <span className="font-semibold text-[#10B981]">{t('research.tradeExecuted')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[#606070]">{t('research.direction')}</span>
                        <div className={`font-semibold ${decisionData?.direction === 'long' ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                          {decisionData?.direction === 'long' ? t('research.long') : t('research.short')} {decisionData?.leverage}x
                        </div>
                      </div>
                      <div>
                        <span className="text-[#606070]">{t('research.position')}</span>
                        <div className="font-semibold">{decisionData?.positionPercent}%</div>
                      </div>
                      <div>
                        <span className="text-[#606070]">{t('research.stopLoss')}</span>
                        <div className="font-mono text-[#F43F5E]">${decisionData?.stopLoss}</div>
                      </div>
                      <div>
                        <span className="text-[#606070]">{t('research.takeProfit')}</span>
                        <div className="font-mono text-[#10B981]">${decisionData?.takeProfit}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // 状态3: 手动执行（兜底）
            return (
              <div className="px-4 mt-6">
                <button
                  onClick={() => setShowExecuteModal(true)}
                  className="w-full py-4 bg-[#06B6D4] text-[#F8F8FC] rounded-xl font-semibold text-lg hover:bg-[#0891B2] transition-colors shadow-lg shadow-[#06B6D4]/20 flex items-center justify-center gap-2"
                  aria-label={t('research.executeTrade')}
                  title={t('research.executeTrade')}
                >
                  {t('research.executeTrade')}
                </button>
              </div>
            );
          })()}

          {/* 持仓反馈卡片 */}
          {reportData?.positionSummary && (
            <div className="px-4 mt-4">
              <div className="glass-card glass-border-glow rounded-2xl p-4 border border-[#1E1E2E]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      reportData.positionSummary.status === 'open' ? 'bg-[#06B6D4] animate-pulse' :
                      reportData.positionSummary.status === 'closed' ? 'bg-[#10B981]' : 'bg-[#F43F5E]'
                    }`} />
                    <span className="text-sm font-medium">
                      {reportData.positionSummary.status === 'open' ? t('research.positionStatus', { status: t('research.positionOpen') }) :
                       reportData.positionSummary.status === 'closed' ? t('research.positionStatus', { status: t('research.positionClosed') }) :
                       t('research.positionStatus', { status: t('research.positionError') })}
                    </span>
                  </div>
                  {reportData.positionSummary.closeReason && (
                    <span className="text-xs text-[#9090A0] bg-[#1E1E2E] px-2 py-0.5 rounded">
                      {reportData.positionSummary.closeReason === 'stop_loss' ? t('research.closedBySL') :
                       reportData.positionSummary.closeReason === 'take_profit' ? t('research.closedByTP') :
                       reportData.positionSummary.closeReason === 'trailing_stop' ? t('research.closedByTrailing') :
                       reportData.positionSummary.closeReason}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-[#606070]">{t('research.entryPrice')}</div>
                    <div className="text-sm font-mono">${reportData.positionSummary.entryPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#606070]">{reportData.positionSummary.status === 'open' ? t('research.markPrice') : t('research.exitPrice')}</div>
                    <div className="text-sm font-mono">${reportData.positionSummary.markPrice?.toFixed(2) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#606070]">
                      {reportData.positionSummary.status === 'open' ? t('research.unrealizedPnl') : t('research.realizedPnl')}
                    </div>
                    {(() => {
                      const pnl = reportData.positionSummary!.status === 'open'
                        ? reportData.positionSummary!.unrealizedPnl
                        : reportData.positionSummary!.realizedPnl;
                      return (
                        <div className={`text-sm font-mono font-semibold ${
                          (pnl || 0) >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
                        }`}>
                          {pnl != null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '-'}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 栏 */}
          <div className="mt-6 px-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-none border-b border-[#1E1E2E]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-[#06B6D4] border-b-2 border-[#06B6D4]'
                      : 'text-[#606070] hover:text-[#9090A0]'
                  }`}
                  aria-label={tab.name}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tab 内容区 — 结构化渲染 */}
          <div className="px-4 mt-4 space-y-4">
            {(() => {
              const tabIndex = tabs.findIndex((t) => t.id === activeTab);
              const stageResult = reportData?.stages?.[tabIndex]?.result;

              // ── 分析师 Tab ──
              if (activeTab === 'analysts') {
                const reports = stageResult?.reports || {};
                // 支持两种 key 格式：xxxReport（实际）和 xxx（兼容）
                const reportEntries = analystMap
                  .map(({ keys: ks, label }) => {
                    const text = ks.reduce<string | null>((acc, k) => acc || reports[k] || null, null);
                    return text ? { label, text } : null;
                  })
                  .filter(Boolean) as { label: string; text: string }[];

                if (reportEntries.length === 0) {
                  return <div className="text-sm text-[#606070] p-4">{t('common.analyzing')}</div>;
                }
                return reportEntries.map(({ label, text }) => (
                  <div key={label} className="glass-card glass-border-glow rounded-2xl p-4">
                    <div className="text-xs text-[#06B6D4] font-medium mb-2">{label}</div>
                    <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line line-clamp-6">
                      {typeof text === 'string' ? text : JSON.stringify(text, null, 2)}
                    </div>
                  </div>
                ));
              }

              // ── 辩论 Tab ──
              if (activeTab === 'debate') {
                const rawEntries = stageResult?.entries;
                const entries = Array.isArray(rawEntries) ? rawEntries : [];
                const entriesCount = typeof rawEntries === 'number' ? rawEntries : entries.length;
                const consensus = stageResult?.consensus;
                const isSkipped = stageResult?.skipped;

                if (!consensus && entries.length === 0 && !entriesCount) {
                  return <div className="text-sm text-[#606070] p-4">{isSkipped ? t('research.quickModeSkipDebate') : t('common.analyzing')}</div>;
                }
                return (
                  <>
                    {/* 旧数据：entries 是数字（只有计数） */}
                    {entries.length === 0 && entriesCount > 0 && (
                      <div className="glass-card rounded-2xl p-4 border border-[#1E1E2E]">
                        <div className="text-sm text-[#9090A0]">{t('research.debateRoundsTotal', { count: entriesCount })}</div>
                      </div>
                    )}
                    {/* T3+T4: 按 round 分组 + 增强消息卡片 */}
                    {(() => {
                      const grouped: Record<number, any[]> = {};
                      entries.forEach((e: any) => {
                        const r = e.round ?? 1;
                        if (!grouped[r]) grouped[r] = [];
                        grouped[r].push(e);
                      });
                      const debateRounds = Object.entries(grouped)
                        .filter(([r]) => Number(r) > 0)
                        .sort(([a], [b]) => Number(a) - Number(b));
                      const votingEntries = grouped[-1] || [];

                      const renderMsg = (e: any, i: number) => {
                        const roleKey = (e.role || '').toLowerCase().replace(/\s+/g, '_');
                        const roleColor = PERSONALITY_COLORS[roleKey] || '#606070';
                        const roleEmoji = PERSONALITY_EMOJIS[roleKey] || '';
                        const roleLabel = PERSONALITY_LABELS[roleKey] || e.role || `#${i + 1}`;
                        const modelName = e.model ? (MODEL_DISPLAY[e.model]?.name || e.model) : '';
                        const content = e.arguments?.reasoning || e.arguments?.argument || e.content || '';
                        const dir = (e.direction || '').toLowerCase();
                        const actKey = dir === 'long' ? 'open_long' : dir === 'short' ? 'open_short' : dir;
                        const actCfg = ACTION_CONFIG[actKey] || null;

                        return (
                          <div key={i} className="rounded-xl p-3 bg-[#12121A]/60" style={{ borderLeft: `3px solid ${roleColor}` }}>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              {e.model && <AIAvatar modelId={e.model} size={20} />}
                              <span className="text-xs font-medium" style={{ color: roleColor }}>
                                {roleEmoji} {roleLabel}
                              </span>
                              {modelName && <span className="text-[10px] text-[#606070]">{modelName}</span>}
                              {actCfg && (
                                <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ color: actCfg.color, backgroundColor: actCfg.bg }}>
                                  {actCfg.icon} {actCfg.label}
                                </span>
                              )}
                              {e.confidence > 0 && (
                                <span className="text-[10px] text-[#9090A0] font-mono">{e.confidence}%</span>
                              )}
                            </div>
                            <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line line-clamp-4">
                              {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          {/* 辩论轮次 */}
                          {debateRounds.map(([round, msgs]) => (
                            <div key={round} className="bg-[#1E1E2E]/30 rounded-2xl p-3 space-y-2">
                              <div className="text-xs text-[#06B6D4] font-bold flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#06B6D4] rounded-full" />
                                {t('research.round', { n: round })}
                              </div>
                              {msgs.map(renderMsg)}
                            </div>
                          ))}
                          {/* 无 round 字段的旧数据 fallback（全部归为单组） */}
                          {debateRounds.length === 0 && entries.length > 0 && (
                            <div className="space-y-2">
                              {entries.map(renderMsg)}
                            </div>
                          )}

                          {/* T5: 投票阶段独立展示 */}
                          {votingEntries.length > 0 && (
                            <div className="rounded-2xl p-3 space-y-2" style={{ border: '1px solid rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.03)' }}>
                              <div className="text-xs font-bold flex items-center gap-2" style={{ color: '#EAB308' }}>
                                {'\u{1F5F3}\uFE0F'} {t('research.finalVote')}
                              </div>
                              {votingEntries.map((e: any, i: number) => {
                                const roleKey = (e.role || '').toLowerCase().replace(/\s+/g, '_');
                                const roleColor = PERSONALITY_COLORS[roleKey] || '#606070';
                                const roleEmoji = PERSONALITY_EMOJIS[roleKey] || '';
                                const roleLabel = PERSONALITY_LABELS[roleKey] || e.role || `Vote #${i + 1}`;
                                const dir = (e.direction || '').toLowerCase();
                                const actKey = dir === 'long' ? 'open_long' : dir === 'short' ? 'open_short' : dir;
                                const actCfg = ACTION_CONFIG[actKey] || null;
                                const conf = e.confidence || 0;
                                const confColor = conf >= 70 ? '#10B981' : conf >= 50 ? '#EAB308' : '#606070';
                                const args = e.arguments || {};

                                return (
                                  <div key={i} className="rounded-xl p-3 bg-[#12121A]/60" style={{ borderLeft: `3px solid ${roleColor}` }}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                      {e.model && <AIAvatar modelId={e.model} size={20} />}
                                      <span className="text-xs font-medium" style={{ color: roleColor }}>
                                        {roleEmoji} {roleLabel}
                                      </span>
                                      {actCfg && (
                                        <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ color: actCfg.color, backgroundColor: actCfg.bg }}>
                                          {actCfg.icon} {actCfg.label}
                                        </span>
                                      )}
                                    </div>
                                    {/* 置信度进度条 */}
                                    {conf > 0 && (
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] text-[#606070]">{t('research.confidence')}</span>
                                        <div className="flex-1 h-1.5 bg-[#1E1E2E] rounded-full">
                                          <div className="h-full rounded-full transition-all" style={{ width: `${conf}%`, backgroundColor: confColor }} />
                                        </div>
                                        <span className="text-[10px] font-mono" style={{ color: confColor }}>{conf}%</span>
                                      </div>
                                    )}
                                    {/* 参数网格 */}
                                    <div className="grid grid-cols-4 gap-2 text-[10px]">
                                      {args.leverage != null && (
                                        <div><div className="text-[#606070]">{t('research.leverage')}</div><div className="text-[#F8F8FC] font-mono">{args.leverage}x</div></div>
                                      )}
                                      {(args.position_pct != null || args.positionSizePercent != null) && (
                                        <div><div className="text-[#606070]">{t('research.position')}</div><div className="text-[#F8F8FC] font-mono">{args.position_pct ?? args.positionSizePercent}%</div></div>
                                      )}
                                      {(args.stop_loss != null || args.stopLoss != null) && (
                                        <div><div className="text-[#606070]">SL</div><div className="text-[#F43F5E] font-mono">${args.stop_loss ?? args.stopLoss}</div></div>
                                      )}
                                      {(args.take_profit != null || args.takeProfit != null) && (
                                        <div><div className="text-[#606070]">TP</div><div className="text-[#10B981] font-mono">${args.take_profit ?? args.takeProfit}</div></div>
                                      )}
                                    </div>
                                    {/* 推理 */}
                                    {(args.reasoning || args.argument) && (
                                      <div className="text-[11px] text-[#9090A0] mt-2 line-clamp-2">
                                        {args.reasoning || args.argument}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 辩论共识 */}
                          {consensus && (
                            <div className="glass-card glass-border-glow rounded-2xl p-4 border-2 border-[#06B6D4]/30">
                              <div className="text-xs text-[#06B6D4] font-medium mb-2">{t('research.debateConsensus')}</div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  consensus.action?.includes('long') ? 'bg-[#10B981]/20 text-[#10B981]' :
                                  consensus.action?.includes('short') ? 'bg-[#F43F5E]/20 text-[#F43F5E]' :
                                  'bg-[#606070]/20 text-[#606070]'
                                }`}>{consensus.action?.toUpperCase()}</span>
                                <span className="text-sm text-[#9090A0]">{t('research.confidence')} {consensus.confidence}%</span>
                              </div>
                              <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line line-clamp-4">
                                {consensus.reasoning}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                );
              }

              // ── 交易员 Tab ──
              if (activeTab === 'trader') {
                let proposal = stageResult?.proposal;
                // proposal 可能是原始 LLM 字符串（含 ```json 包裹），需要解析
                if (typeof proposal === 'string') {
                  try {
                    const jsonMatch = proposal.match(/```json\s*([\s\S]*?)```/);
                    const jsonStr = jsonMatch ? jsonMatch[1].trim() : proposal.trim();
                    proposal = JSON.parse(jsonStr);
                  } catch {
                    // 解析失败，显示原始文本
                    return (
                      <div className="glass-card glass-border-glow rounded-2xl p-4">
                        <div className="text-xs text-[#06B6D4] font-medium mb-2">{t('research.traderAnalysis')}</div>
                        <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line">{proposal}</div>
                      </div>
                    );
                  }
                }
                if (!proposal) {
                  return <div className="text-sm text-[#606070] p-4">{t('common.analyzing')}</div>;
                }
                return (
                  <div className="glass-card glass-border-glow rounded-2xl p-5">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-[#606070] mb-1">{t('research.action')}</div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          proposal.action?.includes('long') ? 'bg-[#10B981]/20 text-[#10B981]' :
                          proposal.action?.includes('short') ? 'bg-[#F43F5E]/20 text-[#F43F5E]' :
                          'bg-[#606070]/20 text-[#606070]'
                        }`}>{proposal.action?.toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="text-xs text-[#606070] mb-1">{t('research.confidence')}</div>
                        <div className="text-lg font-bold font-mono">{proposal.confidence}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#606070] mb-1">{t('research.leverage')}</div>
                        <div className="text-lg font-bold font-mono">{proposal.leverage}x</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#606070] mb-1">{t('research.position')}</div>
                        <div className="text-lg font-bold font-mono">{proposal.positionSizePercent}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#606070] mb-1">{t('research.stopLoss')}</div>
                        <div className="text-sm font-mono text-[#F43F5E]">{proposal.stopLoss || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#606070] mb-1">{t('research.takeProfit')}</div>
                        <div className="text-sm font-mono text-[#10B981]">{proposal.takeProfit || '-'}</div>
                      </div>
                    </div>
                    {proposal.reasoning && (
                      <div className="pt-3 border-t border-[#1E1E2E]">
                        <div className="text-xs text-[#606070] mb-1">{t('research.reasoning')}</div>
                        <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line">
                          {proposal.reasoning}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // ── 风控 Tab ──
              if (activeTab === 'risk') {
                // 数据可能在 stageResult.riskResult（旧格式）或 stageResult 根层（实际格式）
                const riskResult = stageResult?.riskResult || (stageResult?.approved !== undefined ? stageResult : null);
                const debateHistory = stageResult?.debateHistory || riskResult?.debateHistory || [];
                const isSkipped = stageResult?.skipped;
                if (!riskResult && debateHistory.length === 0) {
                  return <div className="text-sm text-[#606070] p-4">{isSkipped ? t('research.quickModeSkipRisk') : t('common.analyzing')}</div>;
                }
                return (
                  <>
                    {riskResult && (
                      <div className={`glass-card rounded-2xl p-4 border-2 ${
                        riskResult.approved ? 'border-[#10B981]/30 bg-[#10B981]/5' : 'border-[#F43F5E]/30 bg-[#F43F5E]/5'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-semibold ${riskResult.approved ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                            {riskResult.approved ? t('research.riskApproved') : t('research.riskRejected')}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            riskResult.riskRating === 'low' ? 'bg-[#10B981]/20 text-[#10B981]' :
                            riskResult.riskRating === 'medium' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                            'bg-[#F43F5E]/20 text-[#F43F5E]'
                          }`}>{t('research.riskLevel')} {riskResult.riskRating}</span>
                        </div>
                        {(riskResult.adjustedLeverage || riskResult.adjustedSL || riskResult.adjustedTP) && (
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {riskResult.adjustedLeverage && (
                              <div>
                                <div className="text-xs text-[#606070]">{t('research.adjustLeverage')}</div>
                                <div className="text-sm font-mono">{riskResult.adjustedLeverage}x</div>
                              </div>
                            )}
                            {riskResult.adjustedSL && (
                              <div>
                                <div className="text-xs text-[#606070]">{t('research.adjustSL')}</div>
                                <div className="text-sm font-mono text-[#F43F5E]">{riskResult.adjustedSL}</div>
                              </div>
                            )}
                            {riskResult.adjustedTP && (
                              <div>
                                <div className="text-xs text-[#606070]">{t('research.adjustTP')}</div>
                                <div className="text-sm font-mono text-[#10B981]">{riskResult.adjustedTP}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {riskResult.reasoning && (
                          <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line">
                            {riskResult.reasoning}
                          </div>
                        )}
                      </div>
                    )}
                    {debateHistory.map((entry: any, i: number) => (
                      <div key={i} className="glass-card rounded-2xl p-4 border border-[#1E1E2E]">
                        <div className="text-xs text-[#F59E0B] font-medium mb-2">{entry.role || t('research.riskExpert', { n: i + 1 })}</div>
                        <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line line-clamp-4">
                          {entry.content}
                        </div>
                      </div>
                    ))}
                  </>
                );
              }

              // ── 决策 Tab ──
              if (activeTab === 'decision') {
                const fd = reportData?.finalDecision;
                const s5 = stageResult;
                if (!fd) return <div className="text-sm text-[#606070] p-4">{t('common.analyzing')}</div>;
                return (
                  <div className="glass-card glass-border-glow rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded text-sm font-bold ${
                        fd.action?.includes('long') ? 'bg-[#10B981]/20 text-[#10B981]' :
                        fd.action?.includes('short') ? 'bg-[#F43F5E]/20 text-[#F43F5E]' :
                        'bg-[#606070]/20 text-[#606070]'
                      }`}>{fd.action?.toUpperCase()}</span>
                      <span className="text-sm text-[#9090A0]">{t('research.confidence')} {fd.confidence}%</span>
                    </div>
                    {s5 && (
                      <div className="flex gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          s5.safetyPassed ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#F43F5E]/20 text-[#F43F5E]'
                        }`}>{s5.safetyPassed ? t('research.safetyPassed') : t('research.safetyFailed')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          s5.riskApproved ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#F43F5E]/20 text-[#F43F5E]'
                        }`}>{s5.riskApproved ? t('research.riskApproved') : t('research.riskRejected')}</span>
                      </div>
                    )}
                    <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line">
                      {fd.reasoning || t('common.noData')}
                    </div>

                    {/* T7: CoT / Prompt 折叠区域 */}
                    {(() => {
                      // 从辩论阶段 entries 收集 CoT
                      const debateStage = reportData?.stages?.find((st: any) => st.name?.includes('debate'));
                      const debateEntries = Array.isArray(debateStage?.result?.entries) ? debateStage.result.entries : [];
                      const cotTexts = debateEntries
                        .filter((e: any) => e.chainOfThought)
                        .map((e: any) => `[${e.role || 'unknown'}] ${typeof e.chainOfThought === 'string' ? e.chainOfThought : JSON.stringify(e.chainOfThought)}`);
                      const aggregatedCot = cotTexts.join('\n\n---\n\n');
                      // 从 stage result 查找 systemPrompt / userPrompt
                      const sysPrompt = s5?.systemPrompt || debateStage?.result?.systemPrompt;
                      const usrPrompt = s5?.userPrompt || debateStage?.result?.userPrompt;
                      if (!aggregatedCot && !sysPrompt && !usrPrompt) return null;

                      return (
                        <div className="space-y-2 pt-3 border-t border-[#1E1E2E]">
                          {aggregatedCot && (
                            <details className="group">
                              <summary className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-[#1E1E2E]/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{'\u{1F4AD}'}</span>
                                  <span className="text-xs font-semibold" style={{ color: '#EAB308' }}>AI Chain of Thought (CoT)</span>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308' }}>
                                  {t('common.expand')}
                                </span>
                              </summary>
                              <div className="mt-2 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto" style={{ background: '#0A0A0F', border: '1px solid #1E1E2E', color: '#9090A0' }}>
                                {aggregatedCot}
                              </div>
                            </details>
                          )}
                          {sysPrompt && (
                            <details className="group">
                              <summary className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-[#1E1E2E]/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{'\u2699\uFE0F'}</span>
                                  <span className="text-xs font-semibold" style={{ color: '#8B5CF6' }}>{t('research.systemPrompt')}</span>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                                  {t('common.expand')}
                                </span>
                              </summary>
                              <div className="mt-2 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto" style={{ background: '#0A0A0F', border: '1px solid #1E1E2E', color: '#9090A0' }}>
                                {typeof sysPrompt === 'string' ? sysPrompt : JSON.stringify(sysPrompt, null, 2)}
                              </div>
                            </details>
                          )}
                          {usrPrompt && (
                            <details className="group">
                              <summary className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-[#1E1E2E]/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{'\u{1F4DD}'}</span>
                                  <span className="text-xs font-semibold" style={{ color: '#3B82F6' }}>{t('research.userPrompt')}</span>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                                  {t('common.expand')}
                                </span>
                              </summary>
                              <div className="mt-2 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto" style={{ background: '#0A0A0F', border: '1px solid #1E1E2E', color: '#9090A0' }}>
                                {typeof usrPrompt === 'string' ? usrPrompt : JSON.stringify(usrPrompt, null, 2)}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              }

              return <div className="text-sm text-[#606070] p-4">{t('common.noData')}</div>;
            })()}
          </div>
        </div>
      )}

      {/* 执行确认弹窗 */}
      {showExecuteModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowExecuteModal(false)}
          />

          {/* 弹窗内容 */}
          <div className="relative w-full glass-card-primary rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl animate-slide-up">
            <div className="px-6 py-6">
              {/* 标题 */}
              <h2 className="text-xl font-bold mb-6">{t('research.confirmExecute')}</h2>

              {/* 交易摘要卡片 */}
              <div className="bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl p-5 mb-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#9090A0]">{t('research.pair')}</span>
                  <span className="font-semibold">{symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9090A0]">{t('research.direction')}</span>
                  <span className={`font-semibold ${decisionData?.direction === 'long' ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                    {decisionData?.direction === 'long' ? `${t('research.long')} (BUY)` : `${t('research.short')} (SELL)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9090A0]">{t('research.leverage')}</span>
                  <span className="font-semibold">{decisionData?.leverage}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9090A0]">{t('research.positionSize')}</span>
                  <span className="font-semibold">{decisionData?.positionPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9090A0]">{t('research.stopLoss')}</span>
                  <span className="font-mono text-[#F43F5E]">${decisionData?.stopLoss}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9090A0]">{t('research.takeProfit')}</span>
                  <span className="font-mono text-[#10B981]">${decisionData?.takeProfit}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-[#1E1E2E]">
                  <span className="text-[#9090A0]">{t('research.apiKey')}</span>
                  <span className="font-mono text-sm">{t('research.boundApiKey')}</span>
                </div>
              </div>

              {/* 警告 */}
              <div className="flex items-start gap-3 mb-6 p-4 bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-[#F43F5E] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#F43F5E]">
                  {t('research.executeWarning')}
                </p>
              </div>

              {/* 按钮组 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExecuteModal(false)}
                  className="flex-1 py-4 bg-[#1E1E2E] border border-[#1E1E2E] text-[#F8F8FC] rounded-xl font-semibold hover:bg-[#0A0A0F] transition-colors"
                  aria-label={t('common.cancel')}
                  title={t('common.cancel')}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleExecute}
                  disabled={executeResearch.isPending}
                  className="flex-1 py-4 bg-[#06B6D4] text-[#F8F8FC] rounded-xl font-semibold hover:bg-[#0891B2] transition-colors shadow-lg shadow-[#06B6D4]/20 disabled:opacity-50"
                  aria-label={t('research.confirmExecuteBtn')}
                  title={t('research.confirmExecuteBtn')}
                >
                  {executeResearch.isPending ? t('research.executing') : t('research.confirmExecuteBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
