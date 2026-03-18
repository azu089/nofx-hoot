'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n/provider';
import {
  Plus, Brain, FlaskConical, Play, Pause, Square, Trash2, Zap,
  AlertTriangle, MessageSquare, Loader2,
  Check, XCircle, LayoutList, Eye, ChevronDown,
} from 'lucide-react';
import {
  useResearchHistory,
  useStrategyList,
  useStrategyControl,
  useDeleteStrategy,
  useDeleteResearch,
  useStopResearchCycling,
  usePauseResearchCycling,
  useResumeResearchCycling,
  useAiConfig,
  useUpdateAiConfig,
} from '@/hooks/useAi';
import type { ResearchSession, AiStrategyWithPnl, AiStrategy } from '@/types/ai';
import { AiTimeline } from './ai-timeline';

// ========================= 类型定义 =========================

type UnifiedAiItem =
  | { type: 'research'; data: ResearchSession }
  | { type: 'strategy'; data: AiStrategyWithPnl };

type FilterTab = 'all' | 'research' | 'solo' | 'debate' | 'grid';

type StrategyStatus = 'running' | 'paused' | 'stopped';

// ========================= 工具函数 =========================

function formatTimeAgo(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hoursAgo', { count: hrs });
  return t('common.daysAgo', { count: Math.floor(hrs / 24) });
}

function getStrategyStatus(s: AiStrategy): StrategyStatus {
  return s.isActive ? 'running' : 'stopped';
}

function getStrategyCoins(s: AiStrategy): string[] {
  try {
    // 网格策略：以 gridConfig.symbol 为权威来源（coinSourceConfig.coins 可能是旧数据）
    if (s.strategyType === 'grid' && s.gridConfig) {
      const gc = s.gridConfig as { symbol?: string };
      if (gc.symbol) return [gc.symbol];
    }
    return s.coinSourceConfig?.coins || [];
  } catch {
    return [];
  }
}

// 交易所显示名映射
const EXCHANGE_DISPLAY: Record<string, string> = {
  binance: 'Binance', okx: 'OKX', bybit: 'Bybit', gate: 'Gate.io',
  bitget: 'Bitget', coinbase: 'Coinbase',
  hyperliquid: 'Hyperliquid', aster: 'Aster', lighter: 'Lighter',
};

// i18n key maps for depth labels
const depthLabelKeys: Record<string, string> = {
  quick: 'create.quick',
  standard: 'create.standard',
  deep: 'create.deep',
};

// Style-only configs (labels resolved via t() at render time)
const campaignStatusStyle: Record<string, { color: string; dot: string; tKey: string }> = {
  running:   { color: 'text-[#10B981]', dot: 'bg-[#10B981]', tKey: 'common.running' },
  paused:    { color: 'text-[#EAB308]', dot: 'bg-[#EAB308]', tKey: 'common.paused' },
  stopped:   { color: 'text-[#606070]', dot: 'bg-[#606070]', tKey: 'common.stopped' },
  completed: { color: 'text-[#06B6D4]', dot: 'bg-[#06B6D4]', tKey: 'common.completed' },
};

// ========================= 策略状态配置 =========================

const statusStyle: Record<StrategyStatus, { color: string; dot: string; tKey: string }> = {
  running: { color: 'text-[#10B981]', dot: 'bg-[#10B981]', tKey: 'common.running' },
  paused: { color: 'text-[#EAB308]', dot: 'bg-[#EAB308]', tKey: 'common.paused' },
  stopped: { color: 'text-[#606070]', dot: 'bg-[#606070]', tKey: 'common.stopped' },
};

// ========================= 研究状态配置 =========================

const researchStatusStyle: Record<string, { color: string; IconComponent: React.ElementType; tKey: string; spin?: boolean }> = {
  running: { color: 'text-[#06B6D4]', IconComponent: Loader2, tKey: 'common.analyzing', spin: true },
  completed: { color: 'text-[#10B981]', IconComponent: Check, tKey: 'common.completed' },
  failed: { color: 'text-[#F43F5E]', IconComponent: XCircle, tKey: 'common.failed' },
};

// ========================= Tab 配置 =========================

const TAB_CONFIG: { key: FilterTab; tKey: string }[] = [
  { key: 'all',      tKey: 'list.filterAll' },
  { key: 'research', tKey: 'list.filterResearch' },
  { key: 'solo',     tKey: 'list.filterSolo' },
  { key: 'debate',   tKey: 'list.filterDebate' },
  { key: 'grid',     tKey: 'list.filterGrid' },
];

// ========================= 研究卡片 =========================

interface ResearchCardProps {
  session: ResearchSession;
  onNavigate: () => void;
  onAction: (action: 'pause' | 'resume' | 'stop') => void;
  onDeleteRequest: () => void;
  isActionPending: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function ResearchCard({
  session,
  onNavigate,
  onAction,
  onDeleteRequest,
  isActionPending,
  t,
}: ResearchCardProps) {
  const campStatus = session.campaignStatus || 'stopped';
  const sc = campaignStatusStyle[campStatus] ?? campaignStatusStyle.stopped;

  const decision = session.finalDecision ?? session.decision;
  const depthKey = depthLabelKeys[session.depth];
  const depthLabel = depthKey ? t(depthKey) : session.depth;

  const rawAction = decision?.action?.toUpperCase() ?? '';
  const isLong = rawAction === 'BUY' || rawAction === 'OPEN_LONG' || rawAction === 'LONG';
  const isShort = rawAction === 'SELL' || rawAction === 'OPEN_SHORT' || rawAction === 'SHORT';
  const actionLabel = isLong ? t('research.long') : isShort ? t('research.short') : decision ? t('research.hold') : '-';

  const cumulativePnl = session.cumulativePnl ?? 0;
  const totalCycles = session.totalCycles ?? (session.cycleCount ?? 0);
  const cumulativeCost = session.cumulativeCost ?? session.totalCost ?? 0;
  const intervalMin = session.cyclingConfig?.intervalMinutes ?? 0;

  return (
    <div
      onClick={onNavigate}
      className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 cursor-pointer hover:border-[#06B6D4]/40 transition-all active:scale-[0.98]"
    >
      {/* 顶行: 徽章 + 名称 + 状态 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#06B6D4]/15 text-[#06B6D4] text-xs rounded font-medium flex-shrink-0">
            <FlaskConical className="w-3 h-3" />
            {t('modes.research')}
          </span>
          <span className="font-medium text-[#F8F8FC] text-sm truncate">{session.symbol}</span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs flex-shrink-0 ${sc.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {t(sc.tKey)}
        </div>
      </div>

      {/* 深度 + 交易对 + 决策 + 周期 + 交易所 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded">{depthLabel}</span>
        {/* 交易对 badge（对齐策略卡片的 coin badge 风格） */}
        <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#06B6D4] text-xs rounded">
          {session.symbol?.split('/')[0] ?? session.symbol}
        </span>
        {decision && (
          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
            isLong ? 'bg-[#10B981]/15 text-[#10B981]'
              : isShort ? 'bg-[#F43F5E]/15 text-[#F43F5E]'
                : 'bg-[#1E1E2E] text-[#9090A0]'
          }`}>
            {actionLabel}
          </span>
        )}
        {totalCycles > 0 && (
          <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#06B6D4] text-xs rounded font-mono">
            #{totalCycles}/{session.cyclingConfig?.maxCycles || '\u221E'}
          </span>
        )}
        {session.exchangeName && (
          <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded ml-auto">
            {EXCHANGE_DISPLAY[session.exchangeName] ?? session.exchangeName}
          </span>
        )}
      </div>

      {/* 4列统计 */}
      <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-[#1E1E2E]">
        <div>
          <div className="text-[#606070] text-[10px] mb-0.5">{t('list.cumulativePnl')}</div>
          <div className={`font-semibold text-xs font-mono ${cumulativePnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
            {cumulativePnl >= 0 ? '+' : ''}{cumulativePnl.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[#606070] text-[10px] mb-0.5">{t('list.cycles')}</div>
          <div className="text-[#F8F8FC] font-medium text-xs font-mono">{totalCycles}</div>
        </div>
        <div>
          <div className="text-[#606070] text-[10px] mb-0.5">{t('list.cost')}</div>
          <div className="text-[#F8F8FC] font-medium text-xs font-mono">${cumulativeCost.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[#606070] text-[10px] mb-0.5">{t('list.interval')}</div>
          <div className="text-[#F8F8FC] font-medium text-xs font-mono">{intervalMin}m</div>
        </div>
      </div>

      {/* 操作按钮: 详情 | 暂停/恢复 | 停止 */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          className="flex-1 bg-[#1E1E2E] text-[#F8F8FC] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#252530] transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          {t('common.details')}
        </button>
        {campStatus === 'running' ? (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction('pause'); }}
              disabled={isActionPending}
              className="flex-1 bg-[#1E1E2E] text-[#EAB308] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#252530] transition-colors disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5" />
              {t('common.pause')}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction('stop'); }}
              disabled={isActionPending}
              className="px-3 bg-[#1E1E2E] text-[#F43F5E] py-2 rounded-lg hover:bg-[#252530] transition-colors disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </>
        ) : campStatus === 'paused' ? (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction('resume'); }}
              disabled={isActionPending}
              className="flex-1 bg-[#06B6D4] text-[#F8F8FC] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#0891B2] transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {t('common.resume')}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction('stop'); }}
              disabled={isActionPending}
              className="px-3 bg-[#1E1E2E] text-[#F43F5E] py-2 rounded-lg hover:bg-[#252530] transition-colors disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          /* stopped: 重启 + 删除 */
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction('resume'); }}
              disabled={isActionPending}
              className="flex-1 bg-[#06B6D4] text-[#F8F8FC] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#0891B2] transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {t('common.restart')}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
              className="px-3 bg-[#1E1E2E] text-[#F43F5E] py-2 rounded-lg hover:bg-[#252530] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ========================= 策略卡片 =========================

interface StrategyCardProps {
  strategy: AiStrategyWithPnl;
  onNavigate: () => void;
  onAction: (action: 'start' | 'stop' | 'pause') => void;
  onDeleteRequest: () => void;
  isActionPending: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function StrategyCard({
  strategy,
  onNavigate,
  onAction,
  onDeleteRequest,
  isActionPending,
  t,
}: StrategyCardProps) {
  const status = getStrategyStatus(strategy);
  const coins = getStrategyCoins(strategy);
  const sc = statusStyle[status];
  const pnl = Number(strategy.totalPnl);
  const todayPnl = Number(strategy.todayPnl ?? 0);
  const winRate = Number(strategy.winRate);
  const sharpe = Number(strategy.sharpe);
  const isGrid = strategy.strategyType === 'grid';
  const isDebate = strategy.tradingMode === 'debate';

  // 模式 badge 配置
  const badgeCfg = isGrid
    ? { Icon: LayoutList, label: t('modes.grid'), color: '#10B981', bg: 'bg-[#10B981]/15 text-[#10B981]', iconColor: 'text-[#10B981]' }
    : isDebate
      ? { Icon: MessageSquare, label: t('modes.debate'), color: '#8B5CF6', bg: 'bg-[#8B5CF6]/15 text-[#8B5CF6]', iconColor: 'text-[#8B5CF6]' }
      : { Icon: Zap, label: t('modes.solo'), color: '#F59E0B', bg: 'bg-[#F59E0B]/15 text-[#F59E0B]', iconColor: 'text-[#F59E0B]' };

  return (
    <div
      onClick={onNavigate}
      className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 cursor-pointer hover:border-[#06B6D4]/40 transition-all active:scale-[0.98]"
    >
      {/* 顶行：徽章 + 名称 + 状态 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex items-center gap-1 px-2 py-0.5 ${badgeCfg.bg} text-xs rounded font-medium flex-shrink-0`}>
            <badgeCfg.Icon className="w-3 h-3" />
            {badgeCfg.label}
          </span>
          <span className="font-medium text-[#F8F8FC] text-sm truncate">{strategy.name}</span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs flex-shrink-0 ${sc.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {t(sc.tKey)}
        </div>
      </div>

      {/* 币种标签 + 交易所标签 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {coins.slice(0, 4).map((c) => (
          <span key={c} className="px-2 py-0.5 bg-[#1E1E2E] text-[#06B6D4] text-xs rounded">
            {c.split('/')[0]}
          </span>
        ))}
        {coins.length > 4 && (
          <span className="px-2 py-0.5 text-[#606070] text-xs">+{coins.length - 4}</span>
        )}
        {strategy.exchangeName && (
          <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded ml-auto">
            {EXCHANGE_DISPLAY[strategy.exchangeName] ?? strategy.exchangeName}
          </span>
        )}
      </div>

      {/* PnL 数据 */}
      <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-[#1E1E2E]">
        <div>
          <div className="text-[#606070] text-[10px] mb-0.5">{t('list.today')}</div>
          <div
            className={`font-semibold text-xs font-mono ${todayPnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}
          >
            {todayPnl >= 0 ? '+' : ''}
            {todayPnl.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[#606070] text-[10px] mb-0.5">{t('list.totalPnl')}</div>
          <div
            className={`font-semibold text-xs font-mono ${pnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}
          >
            {pnl >= 0 ? '+' : ''}
            {pnl.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[#606070] text-[10px] mb-0.5">{t('list.winRate')}</div>
          <div className="text-[#F8F8FC] font-medium text-xs font-mono">{winRate.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[#606070] text-[10px] mb-0.5">{t('detail.trades')}</div>
          <div className="text-[#F8F8FC] font-medium text-xs font-mono">{Number(strategy.totalTrades ?? 0)}</div>
        </div>
      </div>

      {/* 操作按钮: 详情 | 暂停/启动 | 删除 */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          className="flex-1 bg-[#1E1E2E] text-[#F8F8FC] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#252530] transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          {t('common.details')}
        </button>
        {status === 'running' ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction('pause'); }}
            disabled={isActionPending}
            className="flex-1 bg-[#1E1E2E] text-[#EAB308] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#252530] transition-colors disabled:opacity-50"
          >
            <Pause className="w-3.5 h-3.5" />
            {t('common.pause')}
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction('start'); }}
            disabled={isActionPending}
            className="flex-1 bg-[#06B6D4] text-[#F8F8FC] py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-[#0891B2] transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {t('common.start')}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
          className="px-3 bg-[#1E1E2E] text-[#F43F5E] py-2 rounded-lg hover:bg-[#252530] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ========================= 主组件 =========================

export function UnifiedAiList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('ai');

  // 支持 URL 参数初始化 (策略详情 "查看全部" 跳转: ?view=timeline&filter=solo)
  const initialView = searchParams?.get('view') === 'strategy' ? 'strategy' : 'timeline';
  const initialFilterParam = searchParams?.get('filter') || '';
  const initialFilter: FilterTab = (['all', 'research', 'solo', 'debate', 'grid'] as const).includes(initialFilterParam as FilterTab)
    ? (initialFilterParam as FilterTab)
    : 'all';

  const [filter, setFilter] = useState<FilterTab>(initialFilter);
  const [viewMode, setViewMode] = useState<'strategy' | 'timeline'>(initialView);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteResearchConfirmId, setDeleteResearchConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 数据请求
  const { data: researchData, isLoading: loadingResearch, error: researchError, refetch: refetchResearch } = useResearchHistory(1, 20);
  const { data: strategyData, isLoading: loadingStrategies, error: strategyError, refetch: refetchStrategies } = useStrategyList(1, 50);
  const strategyControl = useStrategyControl();
  const { data: aiConfig } = useAiConfig();
  const updateAiConfig = useUpdateAiConfig();
  const deleteStrategy = useDeleteStrategy();
  const deleteResearch = useDeleteResearch();
  const stopCycling = useStopResearchCycling();
  const pauseCycling = usePauseResearchCycling();
  const resumeCycling = useResumeResearchCycling();

  const isLoading = loadingResearch || loadingStrategies;

  // 合并并排序
  const unifiedItems = useMemo<UnifiedAiItem[]>(() => {
    const items: UnifiedAiItem[] = [];
    if (researchData?.data) {
      for (const s of researchData.data) {
        items.push({ type: 'research', data: s });
      }
    }
    if (strategyData?.data) {
      for (const s of strategyData.data) {
        items.push({ type: 'strategy', data: s });
      }
    }
    // 运行中的策略优先排在上方，其次按创建时间降序
    const isRunning = (item: UnifiedAiItem): boolean => {
      if (item.type === 'research') {
        const s = item.data as ResearchSession;
        return s.status === 'running' || s.campaignStatus === 'running';
      }
      return (item.data as AiStrategyWithPnl).isActive;
    };
    items.sort((a, b) => {
      const aRunning = isRunning(a) ? 1 : 0;
      const bRunning = isRunning(b) ? 1 : 0;
      if (bRunning !== aRunning) return bRunning - aRunning;
      return new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime();
    });
    if (filter === 'research') return items.filter((i) => i.type === 'research');
    if (filter === 'solo') return items.filter(
      (i) => i.type === 'strategy'
        && (i.data as AiStrategyWithPnl).tradingMode === 'solo'
        && (i.data as AiStrategyWithPnl).strategyType !== 'grid',
    );
    if (filter === 'debate') return items.filter(
      (i) => i.type === 'strategy'
        && (i.data as AiStrategyWithPnl).tradingMode !== 'solo'
        && (i.data as AiStrategyWithPnl).strategyType !== 'grid',
    );
    if (filter === 'grid') return items.filter(
      (i) => i.type === 'strategy' && (i.data as AiStrategyWithPnl).strategyType === 'grid',
    );
    return items;
  }, [researchData, strategyData, filter]);

  // 统计数据 — 基于当前筛选后的 unifiedItems，随 Tab 切换联动
  const totalCount = unifiedItems.length;

  const activeCount = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (item.type === 'research') {
        const s = item.data as ResearchSession;
        return s.status === 'running' || s.campaignStatus === 'running';
      }
      return (item.data as AiStrategyWithPnl).isActive;
    }).length;
  }, [unifiedItems]);

  const totalPnl = useMemo(() => {
    return unifiedItems.reduce((sum, item) => {
      if (item.type === 'strategy') {
        return sum + Number((item.data as AiStrategyWithPnl).totalPnl);
      }
      return sum;
    }, 0);
  }, [unifiedItems]);

  // 错误提示自动清除
  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 3000);
  };

  // 操作处理
  const handleStrategyAction = async (
    id: string,
    action: 'start' | 'stop' | 'pause',
  ) => {
    try {
      setActionError(null);
      // 启动前确保 AI 模块已开启（新用户默认 isEnabled=false）
      if (action === 'start' && !aiConfig?.isEnabled) {
        await updateAiConfig.mutateAsync({ isEnabled: true });
      }
      await strategyControl.mutateAsync({ id, action });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('wizard.actionFailed');
      showError(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStrategy.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('wizard.deleteFailed');
      showError(msg);
    }
  };

  const handleDeleteResearch = async (id: string) => {
    try {
      await deleteResearch.mutateAsync(id);
      setDeleteResearchConfirmId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('wizard.deleteFailed');
      showError(msg);
    }
  };

  const handleCyclingAction = async (sessionId: string, action: 'pause' | 'resume' | 'stop') => {
    try {
      setActionError(null);
      if (action === 'stop') await stopCycling.mutateAsync(sessionId);
      else if (action === 'pause') await pauseCycling.mutateAsync(sessionId);
      else await resumeCycling.mutateAsync(sessionId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('wizard.actionFailed');
      showError(msg);
    }
  };

  const cyclingActionPending = stopCycling.isPending || pauseCycling.isPending || resumeCycling.isPending;

  // ========================= 加载 & 错误状态 =========================

  const hasDataError = !isLoading && (researchError || strategyError) && !researchData && !strategyData;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (hasDataError) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-[#F43F5E]/50" />
        <div className="text-sm text-[#9090A0]">{t('timeline.loadFailed')}</div>
        <button
          type="button"
          onClick={() => { refetchResearch(); refetchStrategies(); }}
          className="px-6 py-2.5 bg-[#06B6D4] text-[#F8F8FC] rounded-xl text-sm font-medium hover:bg-[#0891B2] transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  // ========================= 渲染 =========================

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* 错误 Toast */}
      {actionError && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-[#F43F5E]/90 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg backdrop-blur-sm flex items-center gap-2 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-white/70 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 flex items-center bg-[#0A0A0F]/95 backdrop-blur-lg px-4 h-14 border-b border-[#1E1E2E]">
        {/* 左侧占位，与右侧按钮等宽，使标题居中 */}
        <div className="w-10" />
        <h1 className="flex-1 text-center text-base font-semibold text-[#F8F8FC]">{t('list.title')}</h1>
        <button
          type="button"
          onClick={() => router.push('/ai/create')}
          aria-label={t('list.createStrategy')}
          className="w-10 h-10 rounded-xl bg-[#06B6D4] flex items-center justify-center hover:bg-[#0891B2] transition-colors shadow-lg shadow-[#06B6D4]/20"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* 统计卡片 */}
      <div className="px-4 py-3">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden grid grid-cols-3">
          <div className="p-3 text-center">
            <div className="text-[#606070] text-[10px] mb-1">{t('list.summaryTotal')}</div>
            <div className="text-[#06B6D4] text-lg font-semibold font-mono">{totalCount}</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-[#606070] text-[10px] mb-1">{t('list.summaryRunning')}</div>
            <div className="text-[#10B981] text-lg font-semibold font-mono">{activeCount}</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-[#606070] text-[10px] mb-1">{t('list.summaryTotalPnl')}</div>
            <div className={`text-lg font-semibold font-mono ${totalPnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* 视图切换 + 筛选下拉 */}
      <div className="flex items-center justify-between px-4 pb-3">
        {/* 左侧：策略 / 日志 切换 */}
        <div className="flex rounded-full overflow-hidden border border-[#1E1E2E]">
          <button
            type="button"
            onClick={() => setViewMode('strategy')}
            className={`px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
              viewMode === 'strategy' ? 'bg-[#06B6D4] text-[#F8F8FC]' : 'bg-[#1A1A28] text-[#9090A0] hover:text-[#F8F8FC]'
            }`}
          >
            {t('list.viewStrategy')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
              viewMode === 'timeline' ? 'bg-[#06B6D4] text-[#F8F8FC]' : 'bg-[#1A1A28] text-[#9090A0] hover:text-[#F8F8FC]'
            }`}
          >
            {t('list.viewLog')}
          </button>
        </div>

        {/* 右侧：筛选下拉（与左侧 pill 视觉统一） */}
        <div className="relative">
          <div className="flex rounded-full overflow-hidden border border-[#1E1E2E]">
            <button
              type="button"
              onClick={() => setIsFilterOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                filter !== 'all'
                  ? 'bg-[#06B6D4] text-[#F8F8FC]'
                  : 'bg-[#1A1A28] text-[#9090A0] hover:text-[#F8F8FC]'
              }`}
            >
              {t(TAB_CONFIG.find((c) => c.key === filter)?.tKey ?? 'list.filterAll')}
              <ChevronDown className={`w-3 h-3 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {isFilterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-20 bg-[#12121A] border border-[#1E1E2E] rounded-xl overflow-hidden shadow-xl min-w-[96px]">
                {TAB_CONFIG.map(({ key, tKey }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setFilter(key); setIsFilterOpen(false); }}
                    className={`w-full px-4 py-2.5 text-xs text-left flex items-center justify-between gap-2 transition-colors ${
                      filter === key
                        ? 'text-[#06B6D4] font-medium'
                        : 'text-[#9090A0] hover:bg-[#1E1E2E] hover:text-[#F8F8FC]'
                    }`}
                  >
                    {t(tKey)}
                    {filter === key && <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 列表内容 */}
      <div className="px-4 pb-20 space-y-3">
        {/* 时间线视图 */}
        {viewMode === 'timeline' ? (
          <AiTimeline key={filter} filter={filter} />
        ) : unifiedItems.length === 0 ? (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center py-16 text-[#606070]">
            <Brain className="w-12 h-12 mb-4 text-[#606070]/30" />
            <div className="text-sm mb-1">{t('list.noTasks')}</div>
            <div className="text-xs text-[#606070]/60 mb-6">
              {t('list.noTasksDesc')}
            </div>
            <button
              type="button"
              onClick={() => router.push('/ai/create')}
              className="px-6 py-2.5 bg-[#06B6D4] text-[#F8F8FC] rounded-xl text-sm font-medium hover:bg-[#0891B2] transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('list.create')}
            </button>
          </div>
        ) : (
          unifiedItems.map((item) => {
            if (item.type === 'research') {
              const session = item.data;
              return (
                <ResearchCard
                  key={`research-${session.id}`}
                  session={session}
                  onNavigate={() => router.push(`/ai/research/${session.id}`)}
                  onAction={(action) => handleCyclingAction(session.id, action)}
                  onDeleteRequest={() => setDeleteResearchConfirmId(session.id)}
                  isActionPending={cyclingActionPending}
                  t={t}
                />
              );
            }
            return (
              <StrategyCard
                key={`strategy-${item.data.id}`}
                strategy={item.data}
                onNavigate={() => router.push(`/ai/strategy/${item.data.id}`)}
                onAction={(action) => handleStrategyAction(item.data.id, action)}
                onDeleteRequest={() => setDeleteConfirmId(item.data.id)}
                isActionPending={strategyControl.isPending}
                t={t}
              />
            );
          })
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          />
          {/* pb-20: 为底部导航栏（约 72px）留出空间，防止按钮被截断 */}
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] p-6 pb-20 shadow-2xl">
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
                className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E] text-[#9090A0]"
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

      {/* 研究会话删除确认弹窗 */}
      {deleteResearchConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteResearchConfirmId(null)}
          />
          {/* pb-20: 为底部导航栏（约 72px）留出空间，防止按钮被截断 */}
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] p-6 pb-20 shadow-2xl">
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
                onClick={() => setDeleteResearchConfirmId(null)}
                className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E] text-[#9090A0]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteResearch(deleteResearchConfirmId)}
                disabled={deleteResearch.isPending}
                className="flex-1 py-3 bg-[#F43F5E] text-[#F8F8FC] text-sm font-medium rounded-lg active:opacity-80 disabled:opacity-50"
              >
                {deleteResearch.isPending ? t('common.deleting') : t('list.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
