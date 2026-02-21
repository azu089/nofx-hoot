'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Clock, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Check, Wifi, WifiOff, Play, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useResearchStatus, useResearchReport, useExecuteResearch, useCampaignStats, useStopResearchCycling, usePauseResearchCycling, useResumeResearchCycling, useUpdateResearchConfig } from '@/hooks/useAi';
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
  const [campaignTab, setCampaignTab] = useState<'overview' | 'config' | 'cycles'>('overview');
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('all');

  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [editInterval, setEditInterval] = useState(60);
  const [editMaxCycles, setEditMaxCycles] = useState(0);
  const [editProfitTarget, setEditProfitTarget] = useState(0);
  const [editMaxLoss, setEditMaxLoss] = useState(0);
  const [editAllocatedCapital, setEditAllocatedCapital] = useState(5000);
  const [editMaxLeverage, setEditMaxLeverage] = useState(5);
  const [editMaxPositions, setEditMaxPositions] = useState(3);
  const [editMaxDailyDrawdown, setEditMaxDailyDrawdown] = useState(500);
  const [editMaxDailyTrades, setEditMaxDailyTrades] = useState(10);
  const [editCooldownMinutes, setEditCooldownMinutes] = useState(30);

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

  // rootId 始终有值 — 使用 sessionId 作为最终 fallback
  const rootId = (statusData as any)?.rootSessionId || reportData?.rootSessionId || sessionId;
  const campaignStats = useCampaignStats(rootId);
  const stopCycling = useStopResearchCycling();
  const pauseCycling = usePauseResearchCycling();
  const resumeCycling = useResumeResearchCycling();
  const updateConfig = useUpdateResearchConfig();

  // cs 简写：campaignStats.data（null 时用 fallback）
  const cs = campaignStats.data;

  // campaignStatus 合并：优先 cs.status，回退到 statusData.status
  const campaignStatus = cs?.status || status;

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

  // 从 cyclingConfig 中提取配置
  const cycConfig = (statusData as any)?.cyclingConfig || (cs as any)?.cyclingConfig || {};
  const riskConfig = cycConfig?.riskControlConfig || {};

  const enterResearchEditMode = () => {
    setEditInterval(cycConfig?.intervalMinutes || 60);
    setEditMaxCycles(cycConfig?.maxCycles || 0);
    setEditProfitTarget(cycConfig?.profitTargetPercent || 0);
    setEditMaxLoss(cycConfig?.maxLossPercent || 0);
    setEditAllocatedCapital(riskConfig?.allocatedCapital || 5000);
    setEditMaxLeverage(riskConfig?.maxLeverage || 5);
    setEditMaxPositions(riskConfig?.maxPositions || 3);
    setEditMaxDailyDrawdown(riskConfig?.maxDailyDrawdown || 500);
    setEditMaxDailyTrades(riskConfig?.maxDailyTrades || 10);
    setEditCooldownMinutes(riskConfig?.cooldownMinutes || 30);
    setIsEditingConfig(true);
  };

  const handleSaveConfig = async () => {
    try {
      await updateConfig.mutateAsync({
        id: rootId,
        body: {
          intervalMinutes: editInterval,
          maxCycles: editMaxCycles,
          profitTargetPercent: editProfitTarget,
          maxLossPercent: editMaxLoss,
          riskControlConfig: {
            allocatedCapital: editAllocatedCapital,
            maxLeverage: editMaxLeverage,
            maxPositions: editMaxPositions,
            maxDailyDrawdown: editMaxDailyDrawdown,
            maxDailyTrades: editMaxDailyTrades,
            cooldownMinutes: editCooldownMinutes,
          },
        },
      });
      toast.success('配置已更新');
      setIsEditingConfig(false);
    } catch (err: any) {
      toast.error(err.message || '更新失败');
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

  // ── 状态点颜色 ──
  const statusDotColor =
    campaignStatus === 'running' ? 'bg-[#10B981]' :
    campaignStatus === 'paused' ? 'bg-[#EAB308]' : 'bg-[#606070]';

  const statusText =
    campaignStatus === 'running' ? t('common.running') :
    campaignStatus === 'paused' ? t('common.paused') :
    campaignStatus === 'completed' ? t('common.completed') : t('common.stopped');

  // ── 5-stage tab 内容渲染（复用于当前周期 Tab）──
  const renderStageTabContent = () => {
    const tabIndex = tabs.findIndex((tb) => tb.id === activeTab);
    const stageResult = reportData?.stages?.[tabIndex]?.result;

    // ── 分析师 Tab ──
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
        <div key={label} className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
          <div className="text-xs text-[#06B6D4] font-medium mb-2">{label}</div>
          <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line line-clamp-6">
            {typeof text === 'string' ? text : JSON.stringify(text, null, 2)}
          </div>
        </div>
      ));
    }

    if (!stageResult) return <div className="text-sm text-[#606070] p-4">{t('research.statusWaiting')}</div>;

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

      return (
        <>
          {entries.length === 0 && entriesCount > 0 && (
            <div className="bg-[#12121A] rounded-xl p-4 border border-[#1E1E2E]">
              <div className="text-sm text-[#9090A0]">{t('research.debateRoundsTotal', { count: entriesCount })}</div>
            </div>
          )}
          {debateRounds.map(([round, msgs]) => (
            <div key={round} className="bg-[#1E1E2E]/30 rounded-2xl p-3 space-y-2">
              <div className="text-xs text-[#06B6D4] font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#06B6D4] rounded-full" />
                {t('research.round', { n: round })}
              </div>
              {msgs.map(renderMsg)}
            </div>
          ))}
          {debateRounds.length === 0 && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map(renderMsg)}
            </div>
          )}
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
                    {conf > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-[#606070]">{t('research.confidence')}</span>
                        <div className="flex-1 h-1.5 bg-[#1E1E2E] rounded-full">
                          <div className="h-full rounded-full transition-all" style={{ width: `${conf}%`, backgroundColor: confColor }} />
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: confColor }}>{conf}%</span>
                      </div>
                    )}
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
          {consensus && (
            <div className="bg-[#12121A] rounded-xl p-4 border-2 border-[#06B6D4]/30">
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
    }

    // ── 交易员 Tab ──
    if (activeTab === 'trader') {
      let proposal = stageResult?.proposal;
      if (typeof proposal === 'string') {
        try {
          const jsonMatch = proposal.match(/```json\s*([\s\S]*?)```/);
          const jsonStr = jsonMatch ? jsonMatch[1].trim() : proposal.trim();
          proposal = JSON.parse(jsonStr);
        } catch {
          return (
            <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
              <div className="text-xs text-[#06B6D4] font-medium mb-2">{t('research.traderAnalysis')}</div>
              <div className="text-sm text-[#9090A0] leading-relaxed whitespace-pre-line">{proposal}</div>
            </div>
          );
        }
      }
      if (!proposal) return <div className="text-sm text-[#606070] p-4">{t('common.analyzing')}</div>;
      return (
        <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-5">
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
      const riskResult = stageResult?.riskResult || (stageResult?.approved !== undefined ? stageResult : null);
      const debateHistory = stageResult?.debateHistory || riskResult?.debateHistory || [];
      const isSkipped = stageResult?.skipped;
      if (!riskResult && debateHistory.length === 0) {
        return <div className="text-sm text-[#606070] p-4">{isSkipped ? t('research.quickModeSkipRisk') : t('common.analyzing')}</div>;
      }
      return (
        <>
          {riskResult && (
            <div className={`bg-[#12121A] rounded-xl p-4 border-2 ${
              riskResult.approved ? 'border-[#10B981]/30' : 'border-[#F43F5E]/30'
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
            <div key={i} className="bg-[#12121A] rounded-xl p-4 border border-[#1E1E2E]">
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
        <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-5 space-y-4">
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
          {(() => {
            const debateStage = reportData?.stages?.find((st: any) => st.name?.includes('debate'));
            const debateEntries = Array.isArray(debateStage?.result?.entries) ? debateStage.result.entries : [];
            const cotTexts = debateEntries
              .filter((e: any) => e.chainOfThought)
              .map((e: any) => `[${e.role || 'unknown'}] ${typeof e.chainOfThought === 'string' ? e.chainOfThought : JSON.stringify(e.chainOfThought)}`);
            const aggregatedCot = cotTexts.join('\n\n---\n\n');
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
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* ========= Header — 始终展示，不再有 isCyclingMode 条件分支 ========= */}
      <header className="sticky top-0 z-30 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        {/* Nav bar */}
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => window.history.back()}
            className="p-2 -ml-2 rounded-xl active:opacity-70"
            aria-label={t('common.back')}
            title={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold">
            {symbol} {t('research.autoResearch')}
          </h1>
          <div className="w-9 flex items-center justify-center">
            {wsConnected
              ? <Wifi className="w-4 h-4 text-[#10B981]" />
              : <WifiOff className="w-4 h-4 text-[#606070]" />}
          </div>
        </div>

        {/* 状态栏 + 控制按钮 */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm">
            <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
            {statusText}
          </span>
          <div className="flex items-center gap-2">
            {campaignStatus === 'running' && (
              <>
                <button
                  onClick={() => pauseCycling.mutate(rootId)}
                  disabled={pauseCycling.isPending}
                  className="px-3 py-1.5 text-xs font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E] disabled:opacity-50"
                >
                  {t('common.pause')}
                </button>
                <button
                  onClick={() => stopCycling.mutate(rootId)}
                  disabled={stopCycling.isPending}
                  className="px-3 py-1.5 text-xs font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E] disabled:opacity-50"
                >
                  {t('common.stop')}
                </button>
              </>
            )}
            {campaignStatus === 'paused' && (
              <>
                <button
                  onClick={() => resumeCycling.mutate(rootId)}
                  disabled={resumeCycling.isPending}
                  className="px-4 py-1.5 text-xs font-medium bg-[#10B981] text-white rounded-lg active:opacity-70 disabled:opacity-50 flex items-center gap-1"
                >
                  <Play className="w-3 h-3" /> {t('common.resume')}
                </button>
                <button
                  onClick={() => stopCycling.mutate(rootId)}
                  disabled={stopCycling.isPending}
                  className="px-3 py-1.5 text-xs font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E] disabled:opacity-50"
                >
                  {t('common.stop')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 运行信息 */}
        <div className="px-4 pb-3">
          <p className="text-xs text-[#606070]">
            {t('research.runDuration')} {cs?.startedAt ? formatCampaignTime(cs.startedAt) : '—'} · {t('research.cycles')} {cs?.currentCycle ?? 0}/{cs?.totalCycles || '∞'}
          </p>
        </div>

        {/* 统计网格 — cs 未加载时用 fallback 值，不隐藏整个 header */}
        <div className="px-4 pb-4">
          <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] grid grid-cols-4">
            <div className="p-2.5 text-center">
              <p className="text-[10px] text-[#606070] mb-0.5">{t('research.cumulativePnl')}</p>
              <p className={`text-sm font-semibold ${(cs?.cumulativePnl ?? 0) >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                {cs != null
                  ? `${cs.cumulativePnl >= 0 ? '+' : ''}${cs.cumulativePnl.toFixed(2)}`
                  : '—'}
              </p>
            </div>
            <div className="p-2.5 text-center">
              <p className="text-[10px] text-[#606070] mb-0.5">{t('research.winRate')}</p>
              <p className="text-sm font-semibold">
                {cs ? `${calcCampaignWinRate(cs.childSessions)}%` : '—'}
              </p>
            </div>
            <div className="p-2.5 text-center">
              <p className="text-[10px] text-[#606070] mb-0.5">{t('research.cost')}</p>
              <p className="text-sm font-semibold">
                {cs != null ? `$${cs.cumulativeCost.toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="p-2.5 text-center">
              <p className="text-[10px] text-[#606070] mb-0.5">{t('detail.trades')}</p>
              <p className="text-sm font-semibold">
                {cs ? cs.childSessions.length : 0}
              </p>
            </div>
          </div>
        </div>

        {/* Tab 栏 — 下划线样式，flex-1 */}
        <div className="flex items-center border-b border-[#1E1E2E] overflow-x-auto scrollbar-none">
          {([
            { key: 'overview' as const, label: t('detail.overviewTab') },
            { key: 'config' as const, label: t('detail.configTab') },
            { key: 'cycles' as const, label: 'AI决策' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCampaignTab(tab.key)}
              className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap px-2 ${
                campaignTab === tab.key
                  ? 'text-[#06B6D4] border-[#06B6D4]'
                  : 'text-[#606070] border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ========= Main — Tab 内容 ========= */}
      <main className="pb-6">
        {/* ===== 概览 Tab ===== */}
        {campaignTab === 'overview' && (
          <div className="space-y-4">
            {/* 深度研究模式说明卡 */}
            <div className="mx-4 mt-4 bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-[#8B5CF6]/20">🔬</span>
                <span className="text-sm font-semibold text-[#8B5CF6]">{'深度研究模式'}</span>
              </div>
              <p className="text-xs text-[#9090A0] leading-relaxed mb-2">
                {'5位AI分析师独立研究 → 多轮辩论 → 交易员决策 → 风控审批。每个周期完成完整的深度分析流程。'}
              </p>
              <div className="pt-2 border-t border-[#1E1E2E]">
                <p className="text-xs text-[#606070]">
                  {symbol} · {t('research.interval')} {(statusData as any)?.cyclingConfig?.intervalMinutes || (reportData as any)?.cyclingConfig?.intervalMinutes || '?'}{t('research.minutes')} · {t('research.cycles')} {cs?.currentCycle ?? 0}/{cs?.totalCycles || '∞'}
                </p>
              </div>
            </div>

            {/* 时间筛选 */}
            <div className="px-4 pt-2">
              <div className="flex items-center gap-2">
                {[
                  { key: '24h', label: t('detail.timeFilter24h') },
                  { key: '7d', label: t('detail.timeFilter7d') },
                  { key: '30d', label: t('detail.timeFilter30d') },
                  { key: 'all', label: t('detail.timeFilterAll') },
                ].map(({ key: filter, label }) => (
                  <button
                    key={filter}
                    title={label}
                    aria-label={label}
                    onClick={() => setTimeFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      timeFilter === filter
                        ? 'bg-[#06B6D4] text-[#F8F8FC]'
                        : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* PnL 曲线图 (基于 childSessions 累计 PnL) */}
            {(() => {
              const pnlHistory = (() => {
                if (!cs?.childSessions) return [];
                const sorted = [...cs.childSessions]
                  .filter(c => c.status === 'completed' && c.finalDecision)
                  .sort((a, b) => a.cycleNumber - b.cycleNumber);
                let cumPnl = 0;
                return sorted.map(c => {
                  cumPnl += (c.pnl ?? 0);
                  return { date: c.createdAt, pnl: cumPnl, cycle: c.cycleNumber };
                });
              })();
              const filteredPnl = (() => {
                if (timeFilter === 'all' || pnlHistory.length === 0) return pnlHistory;
                const daysMap: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };
                const days = daysMap[timeFilter] || 365;
                const cutoff = Date.now() - days * 86400000;
                return pnlHistory.filter(p => new Date(p.date).getTime() >= cutoff);
              })();
              const finalPnl = filteredPnl.length > 0 ? filteredPnl[filteredPnl.length - 1].pnl : 0;
              return (
                <div className="mx-4 bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
                  <div className="mb-4">
                    <p className="text-xs text-[#606070] mb-1">{t('detail.pnlChart', { filter: timeFilter })}</p>
                    <p className={`text-2xl font-bold ${finalPnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                      {finalPnl >= 0 ? '+' : ''}${finalPnl.toFixed(2)}
                    </p>
                  </div>
                  {filteredPnl.length > 1 ? (
                    <div className="relative h-32">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#1E1E2E" strokeWidth="0.5" strokeDasharray="2,2" />
                        <polyline
                          points={filteredPnl.map((point, i) => {
                            const x = (i / (filteredPnl.length - 1 || 1)) * 100;
                            const maxPnl = Math.max(...filteredPnl.map(p => Math.abs(p.pnl)));
                            const y = 50 - (point.pnl / (maxPnl || 100)) * 40;
                            return `${x},${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#06B6D4"
                          strokeWidth="2"
                        />
                        <defs>
                          <linearGradient id="researchPnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <polygon
                          points={`${filteredPnl.map((point, i) => {
                            const x = (i / (filteredPnl.length - 1 || 1)) * 100;
                            const maxPnl = Math.max(...filteredPnl.map(p => Math.abs(p.pnl)));
                            const y = 50 - (point.pnl / (maxPnl || 100)) * 40;
                            return `${x},${y}`;
                          }).join(' ')} 100,50 0,50`}
                          fill="url(#researchPnlGradient)"
                        />
                      </svg>
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-[#606070]">
                        {filteredPnl.filter((_, i) => i % Math.max(1, Math.floor(filteredPnl.length / 4)) === 0).map((point, i) => (
                          <span key={i}>{t('research.cycles').split(' ')[0]}#{point.cycle}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-[#606070] text-sm py-8">{t('common.noData')}</div>
                  )}
                </div>
              );
            })()}

            {/* 今日统计卡 */}
            {(() => {
              const todayCycles = cs?.childSessions.filter(c => {
                return new Date(c.createdAt).toDateString() === new Date().toDateString();
              }) || [];
              const todayCompletedCycles = todayCycles.filter(c => c.status === 'completed');
              const todayPnl = todayCompletedCycles.reduce((sum, c) => sum + (c.pnl ?? 0), 0);
              const todayWins = todayCompletedCycles.filter(c => (c.pnl ?? 0) > 0).length;
              const todayLosses = todayCompletedCycles.filter(c => (c.pnl ?? 0) <= 0 && c.finalDecision).length;
              return (
                <div className="mx-4 bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
                  <h3 className="text-sm font-semibold mb-3">{t('detail.todayStats')}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#9090A0]">{t('detail.todayPnl')}</span>
                      <span className={`text-sm font-semibold ${todayPnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                        {todayPnl >= 0 ? '+' : ''}${todayPnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#9090A0]">{'今日周期'}</span>
                      <span className="text-sm font-semibold">{todayCycles.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#9090A0]">{t('detail.winLoss')}</span>
                      <span className="text-sm font-semibold">
                        <span className="text-[#10B981]">{todayWins}</span>
                        <span className="text-[#606070]"> / </span>
                        <span className="text-[#F43F5E]">{todayLosses}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 失败提示卡（status === 'failed' 时显示）*/}
            {status === 'failed' && (
              <div className="mx-4 bg-[#12121A] rounded-xl p-5 border border-[#F43F5E]/30">
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
            )}

            {/* 最近决策列表 */}
            {(() => {
              const recentDecisions = cs?.childSessions
                ? [...cs.childSessions]
                    .filter(c => c.finalDecision)
                    .sort((a, b) => b.cycleNumber - a.cycleNumber)
                    .slice(0, 3)
                : [];
              if (recentDecisions.length === 0) return null;
              return (
                <div className="mx-4 bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
                  <h3 className="text-sm font-semibold mb-3">{t('detail.recentDecisions')}</h3>
                  <div className="space-y-0">
                    {recentDecisions.map((child, idx) => {
                      const fd = child.finalDecision;
                      const action = fd?.action || '';
                      const isLong = action === 'open_long' || action === 'close_short' || action.includes('long');
                      const isShort = action === 'open_short' || action === 'close_long' || action.includes('short');
                      const isLast = idx === recentDecisions.length - 1;
                      return (
                        <div key={child.id} className={`flex items-center gap-3 py-2.5 ${!isLast ? 'border-b border-[#1E1E2E]' : ''}`}>
                          <span className="text-xs text-[#606070] w-8 flex-shrink-0 font-mono">#{child.cycleNumber}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            isLong ? 'bg-[#10B981]/20 text-[#10B981]' :
                            isShort ? 'bg-[#F43F5E]/20 text-[#F43F5E]' :
                            'bg-[#606070]/20 text-[#606070]'
                          }`}>
                            {isLong ? t('research.buy') : isShort ? t('research.sell') : t('research.hold')}
                          </span>
                          {fd?.confidence != null && (
                            <span className="text-[10px] text-[#9090A0]">{Math.round(fd.confidence)}%</span>
                          )}
                          <div className="flex-1" />
                          {child.pnl != null && (
                            <span className={`text-xs font-mono ${child.pnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                              {child.pnl >= 0 ? '+' : ''}{child.pnl.toFixed(2)}
                            </span>
                          )}
                          <span className="text-[10px] text-[#606070]">
                            {new Date(child.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ===== 配置 Tab ===== */}
        {campaignTab === 'config' && (
          <div className={`p-4 space-y-4 ${isEditingConfig ? 'pb-24' : ''}`}>
            {!isEditingConfig ? (
              /* ── 阅读模式 ── */
              <>
                {/* 基本信息 */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold mb-3">{t('detail.currentConfig')}</h3>
                  <div className="space-y-2.5">
                    <ResearchConfigRow label={t('research.pair')} value={symbol} />
                    <ResearchConfigRow label={'分析模型'} value={(statusData as any)?.model || (reportData as any)?.model || 'DeepSeek V3'} />
                    <ResearchConfigRow label={t('research.status')} value={statusText} />
                    <ResearchConfigRow
                      label={t('research.runDuration')}
                      value={cs?.startedAt ? formatCampaignTime(cs.startedAt) : '—'}
                    />
                    <ResearchConfigRow label={t('research.cost')} value={`$${(cs?.cumulativeCost ?? 0).toFixed(2)}`} />
                  </div>
                </div>

                {/* 循环参数 */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold mb-3">循环参数</h3>
                  <div className="space-y-2.5">
                    <ResearchConfigRow
                      label={t('research.interval')}
                      value={`${cycConfig?.intervalMinutes || '?'} ${t('research.minutes')}`}
                    />
                    <ResearchConfigRow
                      label={t('research.maxCyclesLabel')}
                      value={cycConfig?.maxCycles ? `${cycConfig.maxCycles} 次` : t('research.infinite')}
                    />
                    <ResearchConfigRow
                      label={'止盈目标'}
                      value={cycConfig?.profitTargetPercent ? `${cycConfig.profitTargetPercent}%` : '不限'}
                    />
                    <ResearchConfigRow
                      label={'最大亏损'}
                      value={cycConfig?.maxLossPercent ? `${cycConfig.maxLossPercent}%` : '不限'}
                    />
                    <ResearchConfigRow
                      label={'自动执行'}
                      value={cycConfig?.autoExecute !== false ? '已开启' : '未开启'}
                    />
                  </div>
                </div>

                {/* 风控参数 */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold mb-3">风控配置</h3>
                  <div className="space-y-2.5">
                    <ResearchConfigRow
                      label={'配置资金'}
                      value={riskConfig?.allocatedCapital ? `$${Number(riskConfig.allocatedCapital).toLocaleString()}` : '—'}
                    />
                    <ResearchConfigRow
                      label={'最大杠杆'}
                      value={riskConfig?.maxLeverage ? `${riskConfig.maxLeverage}x` : '—'}
                    />
                    <ResearchConfigRow
                      label={'最大持仓数'}
                      value={riskConfig?.maxPositions || '—'}
                    />
                    <ResearchConfigRow
                      label={'日最大回撤'}
                      value={riskConfig?.maxDailyDrawdown ? `$${Number(riskConfig.maxDailyDrawdown).toLocaleString()}` : '—'}
                    />
                    <ResearchConfigRow
                      label={'日最大交易'}
                      value={riskConfig?.maxDailyTrades || '—'}
                    />
                    <ResearchConfigRow
                      label={'冷却时间'}
                      value={riskConfig?.cooldownMinutes ? `${riskConfig.cooldownMinutes} min` : '—'}
                    />
                  </div>
                </div>

                {/* 编辑按钮 — 只在运行/暂停时显示 */}
                {(campaignStatus === 'running' || campaignStatus === 'paused' || campaignStatus === 'cycling') && (
                  <button
                    onClick={enterResearchEditMode}
                    className="w-full py-3 bg-[#06B6D4] text-[#F8F8FC] text-sm font-medium rounded-lg shadow-lg shadow-[#06B6D4]/20 active:opacity-80 flex items-center justify-center gap-2"
                  >
                    <Pencil className="w-4 h-4" /> 编辑配置
                  </button>
                )}
              </>
            ) : (
              /* ── 编辑模式 ── */
              <>
                {/* 卡片 1: 循环参数 */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold">循环参数</h3>
                  <p className="text-xs text-[#606070]">执行周期</p>
                  <div className="flex gap-2">
                    {[
                      { m: 15, label: '15m' },
                      { m: 30, label: '30m' },
                      { m: 60, label: '1h' },
                      { m: 240, label: '4h' },
                      { m: 1440, label: '24h' },
                    ].map(({ m, label }) => (
                      <button
                        key={m}
                        onClick={() => setEditInterval(m)}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${editInterval === m
                          ? 'bg-[#06B6D4]/15 border-2 border-[#06B6D4] text-[#06B6D4] shadow-[0_0_8px_rgba(6,182,212,0.12)]'
                          : 'bg-[#1E1E2E] text-[#9090A0] border border-[#1E1E2E]'}`}
                      >{label}</button>
                    ))}
                  </div>
                  <ResearchSliderField label={'最大周期数 (0=无限)'} value={editMaxCycles} min={0} max={200} suffix=" 次" onChange={setEditMaxCycles} />
                  <ResearchSliderField label={'止盈目标'} value={editProfitTarget} min={0} max={100} suffix="%" onChange={setEditProfitTarget} />
                  <ResearchSliderField label={'最大亏损'} value={editMaxLoss} min={0} max={100} suffix="%" onChange={setEditMaxLoss} />
                </div>

                {/* 卡片 2: 风控参数 */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold">风控配置</h3>
                  <ResearchSliderField label={'配置资金'} value={editAllocatedCapital} min={500} max={100000} step={500} prefix="$" onChange={setEditAllocatedCapital} />
                  <ResearchSliderField label={'最大杠杆'} value={editMaxLeverage} min={1} max={20} suffix="x" onChange={setEditMaxLeverage} />
                  <ResearchSliderField label={'最大持仓数'} value={editMaxPositions} min={1} max={10} onChange={setEditMaxPositions} />
                  <ResearchSliderField label={'日最大回撤'} value={editMaxDailyDrawdown} min={50} max={5000} step={50} prefix="$" onChange={setEditMaxDailyDrawdown} />
                  <ResearchSliderField label={'日最大交易'} value={editMaxDailyTrades} min={1} max={50} onChange={setEditMaxDailyTrades} />
                  <ResearchSliderField label={'冷却时间'} value={editCooldownMinutes} min={0} max={120} step={5} suffix=" min" onChange={setEditCooldownMinutes} />
                </div>

                <p className="text-xs text-[#606070]">
                  配置修改将从下一个周期开始生效
                </p>

                {/* 固定底部保存/取消栏 */}
                <div className="fixed bottom-16 left-0 right-0 z-40 bg-[#12121A] border-t border-[#1E1E2E] px-4 py-3 flex gap-3">
                  <button
                    onClick={() => setIsEditingConfig(false)}
                    className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
                  >取消</button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={updateConfig.isPending}
                    className="flex-1 py-3 bg-[#06B6D4] text-[#F8F8FC] text-sm font-medium rounded-lg shadow-lg shadow-[#06B6D4]/20 active:opacity-80 disabled:opacity-50"
                  >{updateConfig.isPending ? '保存中...' : '保存'}</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== AI决策 Tab ===== */}
        {campaignTab === 'cycles' && (
          <div className="px-4 mt-4 space-y-4">

            {/* ── 5角色分析 sub-tabs ── */}
            {(status === 'completed' || status === 'running') && reportData?.stages && (
              <>
                <div className="flex items-center overflow-x-auto scrollbar-none bg-[#1E1E2E] rounded-lg p-0.5">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors ${
                        activeTab === tab.id
                          ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                          : 'text-[#606070]'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {renderStageTabContent()}
                </div>
              </>
            )}

            {/* ── 当前周期区域 ── */}

            {/* running: 阶段进度条 */}
            {status === 'running' && stages.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#06B6D4]">{t('research.currentCycle')}</p>
                {stages.map((stage) => (
                  <div key={stage.id} className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
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
                <div className="flex items-center justify-center gap-4 text-xs text-[#606070] py-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{t('common.analyzing')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span>${(statusData?.totalCost || 0).toFixed(4)}</span>
                  </div>
                  {wsConnected && <Wifi className="w-3 h-3 text-[#10B981]" />}
                </div>
              </div>
            )}

            {/* completed: 最新决策摘要卡 */}
            {status === 'completed' && decisionData &&
             reportData?.finalDecision?.action !== 'hold' &&
             reportData?.finalDecision?.action !== 'wait' && (
              <div className={`p-4 rounded-xl border ${
                decisionData.direction === 'long'
                  ? 'bg-[#10B981]/10 border-[#10B981]/30'
                  : 'bg-[#F43F5E]/10 border-[#F43F5E]/30'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {decisionData.direction === 'long'
                      ? <TrendingUp className="w-5 h-5 text-[#10B981]" />
                      : <TrendingDown className="w-5 h-5 text-[#F43F5E]" />}
                    <span className={`text-sm font-bold ${decisionData.direction === 'long' ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                      {decisionData.direction === 'long' ? t('research.long') : t('research.short')}
                    </span>
                    <span className="text-xs text-[#9090A0] font-mono">{decisionData.confidence}%</span>
                  </div>
                  <span className="text-xs text-[#9090A0]">{decisionData.duration}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-[#606070]">{t('research.leverage')}</div>
                    <div className="text-[#F8F8FC] font-mono">{decisionData.leverage}x</div>
                  </div>
                  <div>
                    <div className="text-[#606070]">{t('research.position')}</div>
                    <div className="text-[#F8F8FC] font-mono">{decisionData.positionPercent}%</div>
                  </div>
                  <div>
                    <div className="text-[#606070]">SL</div>
                    <div className="text-[#F43F5E] font-mono">${decisionData.stopLoss}</div>
                  </div>
                  <div>
                    <div className="text-[#606070]">TP</div>
                    <div className="text-[#10B981] font-mono">${decisionData.takeProfit}</div>
                  </div>
                </div>
              </div>
            )}

            {/* completed: hold/wait 提示 */}
            {status === 'completed' && (() => {
              const action = reportData?.finalDecision?.action || '';
              if (action === 'hold' || action === 'wait') {
                return (
                  <div className="bg-[#12121A] rounded-xl p-4 border border-[#606070]/30 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-[#9090A0] shrink-0" />
                    <span className="text-sm text-[#9090A0]">{t('research.aiSuggestWait')}</span>
                  </div>
                );
              }
              return null;
            })()}

            {/* 持仓反馈卡片 */}
            {reportData?.positionSummary && (
              <div className="bg-[#12121A] rounded-xl p-4 border border-[#1E1E2E]">
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
            )}

            {/* ── 分隔线 ── */}
            {(cs?.childSessions?.length ?? 0) > 0 && (
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-[#1E1E2E]" />
                <span className="text-[10px] text-[#606070]">{t('research.cycleLog')}</span>
                <div className="flex-1 h-px bg-[#1E1E2E]" />
              </div>
            )}

            {/* ── 历史周期列表 ── */}
            {!cs || cs.childSessions.length === 0 ? (
              <div className="text-sm text-[#606070] text-center py-8">{t('research.noCycleLogs')}</div>
            ) : (
              <div className="space-y-3">
                {[...cs.childSessions]
                  .sort((a, b) => b.cycleNumber - a.cycleNumber)
                  .map((child) => {
                    const fd = child.finalDecision;
                    const action = fd?.action || '';
                    const isLong = action === 'open_long' || action === 'close_short' || action.includes('long');
                    const isShort = action === 'open_short' || action === 'close_long' || action.includes('short');
                    const isExpanded = expandedCycleId === child.id;

                    return (
                      <div key={child.id} className="bg-[#12121A] rounded-xl border border-[#1E1E2E] overflow-hidden">
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
                  })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========= 执行确认弹窗 ========= */}
      {showExecuteModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowExecuteModal(false)}
          />
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl animate-slide-up">
            <div className="px-6 py-6">
              <h2 className="text-xl font-bold mb-6">{t('research.confirmExecute')}</h2>
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
              <div className="flex items-start gap-3 mb-6 p-4 bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-[#F43F5E] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#F43F5E]">{t('research.executeWarning')}</p>
              </div>
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

// 只读配置行（深度研究详情页专用）
function ResearchConfigRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-[#606070] mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function ResearchSliderField({ label, value, min, max, step = 1, prefix, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  prefix?: string; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#606070]">{label}</span>
        <span className="text-xs font-mono text-[#F8F8FC]">{prefix}{value.toLocaleString()}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-[#1E1E2E] rounded-full appearance-none cursor-pointer accent-[#06B6D4]"
      />
    </div>
  );
}
