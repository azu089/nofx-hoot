"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Pause,
  Square,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  Check,
  Loader2,
  Play,
  Pencil,
  Eye,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useStrategyDetail, useStrategyLogs, useStrategyPnlChart, useStrategyControl, useHotUpdateConfig, useUpdateStrategy, usePreviewPrompt, useTriggerCycle } from "@/hooks/useAi";
import { useStrategySocket } from "@/hooks/useSocket";
import { useTranslations } from "@/i18n/provider";
import { useQueryClient } from "@tanstack/react-query";
import type { StrategyLog, CoinSourceConfig, RiskControlConfig, PromptSections } from "@/types/ai";
import {
  MODEL_DISPLAY,
  ACTION_CONFIG,
  CAMP_COLORS,
  CAMP_LABELS,
  DEBATE_STAGE_LABELS,
  DEBATE_STAGE_LABELS_V2,
} from "@/constants/debate";
import { TRADING_MODE_INFO, buildConfigSummary } from "@/constants/trading-modes";

const PROMPT_DEFAULTS = {
  role: '你是一个专业的加密货币永续合约交易员，目标是通过精准分析实现稳定盈利。',
  tradingFrequency: '严格控制交易频率。只在出现高概率机会时才开仓。宁可错过机会，也不要频繁交易。',
  entryStandards: '开仓需要至少2个独立信号共振确认。趋势方向+动量+关键价位支撑。',
  decisionProcess: '1. 判断市场结构和趋势方向 2. 寻找入场信号共振 3. 评估风险回报比 4. 确定仓位大小和止损',
};

export function AIStrategyDetailPage() {
  const t = useTranslations('ai');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const strategyId = params?.id as string | undefined;

  const tabParam = searchParams?.get('tab');
  const initialTab = tabParam === 'config' ? tabParam : 'overview';

  const [activeTab, setActiveTab] = useState<
    "overview" | "config" | "decisions"
  >(initialTab);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [pauseDuration, setPauseDuration] = useState<string>("1h");
  const [timeFilter, setTimeFilter] = useState<string>("7d");
  const [voteSheetLog, setVoteSheetLog] = useState<StrategyLog | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // 编辑表单 state
  const [editCoinMode, setEditCoinMode] = useState<CoinSourceConfig['mode']>('static');
  const [editCoins, setEditCoins] = useState<string[]>([]);
  const [editMaxCoins, setEditMaxCoins] = useState(5);
  const [editExcludedCoins, setEditExcludedCoins] = useState<string[]>([]);
  const [editMaxLeverage, setEditMaxLeverage] = useState(3);
  const [editMaxPositions, setEditMaxPositions] = useState(3);
  const [editMaxDailyDrawdown, setEditMaxDailyDrawdown] = useState(100);
  const [editMaxDailyTrades, setEditMaxDailyTrades] = useState(10);
  const [editCooldownMinutes, setEditCooldownMinutes] = useState(15);
  const [editAllocatedCapital, setEditAllocatedCapital] = useState(10000);
  const [editPromptRole, setEditPromptRole] = useState('');
  const [editPromptMode, setEditPromptMode] = useState<'aggressive' | 'conservative' | 'scalping'>('conservative');
  const [editPromptCustom, setEditPromptCustom] = useState('');
  const [editPromptTradingFrequency, setEditPromptTradingFrequency] = useState('');
  const [editPromptEntryStandards, setEditPromptEntryStandards] = useState('');
  const [editInterval, setEditInterval] = useState(60);
  const [showEditExcluded, setShowEditExcluded] = useState(false);

  // Data fetching
  const { data: detail, isLoading: detailLoading } = useStrategyDetail(strategyId);
  const { data: logsData } = useStrategyLogs(strategyId, 1, 3);

  const daysMap: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, 'all': 365 };
  const chartDays = daysMap[timeFilter] || 7;
  const { data: pnlChart } = useStrategyPnlChart(strategyId, chartDays);

  const strategyControl = useStrategyControl();
  const hotUpdateConfig = useHotUpdateConfig();
  const updateStrategy = useUpdateStrategy();
  const previewPrompt = usePreviewPrompt();
  const triggerCycle = useTriggerCycle();
  const queryClient = useQueryClient();

  // WebSocket 实时更新
  const wsCallbacks = {
    onStatusChange: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['ai-strategy', strategyId] });
    }, [queryClient, strategyId]),
    onDecision: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['ai-strategy-logs', strategyId] });
      queryClient.invalidateQueries({ queryKey: ['ai-strategy', strategyId] });
    }, [queryClient, strategyId]),
  };
  useStrategySocket(strategyId, wsCallbacks);

  // Loading state
  if (!strategyId || detailLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex items-center justify-center">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] flex items-center justify-center">
        <div className="text-[#606070]">{t('detail.strategyNotFound')}</div>
      </div>
    );
  }

  const formatTimeUntil = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return t('detail.aboutToRun');
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    return `${hours}h${mins % 60}min`;
  };

  const formatLogTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRunningTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}${t('common.day')}${hours}h`;
    return `${hours}h`;
  };

  const handlePause = async () => {
    if (!strategyId) return;
    try {
      const durationMap: Record<string, number | undefined> = {
        '30min': 30, '1h': 60, '4h': 240, '24h': 1440, 'manual': undefined,
      };
      const minutes = durationMap[pauseDuration];
      await strategyControl.mutateAsync({
        id: strategyId,
        action: 'pause',
        body: minutes ? { minutes } : {},
      });
      setShowPauseModal(false);
    } catch (error) {
      console.error('暂停失败:', error);
    }
  };

  const handleStop = async () => {
    if (!strategyId) return;
    try {
      await strategyControl.mutateAsync({ id: strategyId, action: 'stop' });
      setShowStopModal(false);
    } catch (error) {
      console.error('停止失败:', error);
    }
  };

  // 手动触发一次分析周期
  const handleTriggerCycle = async () => {
    if (!strategyId) return;
    try {
      const result = await triggerCycle.mutateAsync(strategyId);
      toast.success(`${t('detail.analyzed', { count: result.cycle.analyzed, executed: result.cycle.executed })} $${result.cycle.totalCost.toFixed(4)}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || t('common.failed'));
    }
  };

  // 进入编辑模式 — 从当前策略配置填充表单
  const enterEditMode = () => {
    const cc = (strategy?.coinSourceConfig || {}) as CoinSourceConfig;
    const rc = (strategy?.riskControlConfig || {}) as RiskControlConfig;
    const ps = (strategy?.promptSections || {}) as PromptSections;
    setEditCoinMode(cc.mode || 'static');
    setEditCoins(cc.coins || []);
    setEditMaxCoins(cc.maxCoins || 5);
    setEditExcludedCoins(cc.excludedCoins || []);
    setEditMaxLeverage(rc.maxLeverage || 3);
    setEditMaxPositions(rc.maxPositions || 3);
    setEditMaxDailyDrawdown(rc.maxDailyDrawdown || 100);
    setEditMaxDailyTrades(rc.maxDailyTrades || 10);
    setEditCooldownMinutes(rc.cooldownMinutes || 15);
    setEditAllocatedCapital(rc.allocatedCapital || 10000);
    setEditPromptRole(ps.role || '');
    setEditPromptMode(ps.mode || 'conservative');
    setEditPromptCustom(ps.custom || '');
    setEditPromptTradingFrequency(ps.tradingFrequency || '');
    setEditPromptEntryStandards(ps.entryStandards || '');
    setEditInterval(strategy?.intervalMinutes || 60);
    setShowEditExcluded(false);
    setIsEditing(true);
  };

  // 保存编辑 — 运行中用 hotUpdate, 停止用 updateStrategy
  const handleSaveEdit = async () => {
    if (!strategyId || !strategy) return;
    const body = {
      coinSourceConfig: {
        mode: editCoinMode,
        coins: editCoinMode === 'static' || editCoinMode === 'mixed' ? editCoins : undefined,
        maxCoins: editCoinMode !== 'static' ? editMaxCoins : undefined,
        excludedCoins: editExcludedCoins.length > 0 ? editExcludedCoins : undefined,
      },
      riskControlConfig: {
        maxLeverage: editMaxLeverage,
        maxPositions: editMaxPositions,
        maxDailyDrawdown: editMaxDailyDrawdown,
        maxDailyTrades: editMaxDailyTrades,
        cooldownMinutes: editCooldownMinutes,
        allocatedCapital: editAllocatedCapital,
        // 保留已有高级参数（不在 UI 暴露）
        circuitBreaker: (strategy?.riskControlConfig as any)?.circuitBreaker,
        btcEthMaxPositionValueRatio: (strategy?.riskControlConfig as any)?.btcEthMaxPositionValueRatio,
        altcoinMaxPositionValueRatio: (strategy?.riskControlConfig as any)?.altcoinMaxPositionValueRatio,
      },
      promptSections: {
        role: editPromptRole || undefined,
        mode: editPromptMode,
        custom: editPromptCustom || undefined,
        tradingFrequency: editPromptTradingFrequency || undefined,
        entryStandards: editPromptEntryStandards || undefined,
      },
      intervalMinutes: editInterval,
    };
    try {
      if (strategy.isActive) {
        await hotUpdateConfig.mutateAsync({ id: strategyId, body });
      } else {
        await updateStrategy.mutateAsync({ id: strategyId, body });
      }
      toast.success(t('detail.editSave'));
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || t('common.failed'));
    }
  };

  const isSaving = hotUpdateConfig.isPending || updateStrategy.isPending;

  // Prompt 预览
  const handlePreviewPrompt = async () => {
    try {
      await previewPrompt.mutateAsync({
        promptSections: {
          role: editPromptRole || undefined,
          mode: editPromptMode,
          custom: editPromptCustom || undefined,
          tradingFrequency: editPromptTradingFrequency || undefined,
          entryStandards: editPromptEntryStandards || undefined,
        },
        riskControlConfig: {
          maxPositions: editMaxPositions,
          maxLeverage: editMaxLeverage,
          maxDailyDrawdown: editMaxDailyDrawdown,
          allocatedCapital: editAllocatedCapital,
        },
        intervalMinutes: editInterval,
      });
      setShowPromptPreview(true);
    } catch (err: any) {
      toast.error(err.message || t('common.failed'));
    }
  };

  // 常用币种列表（编辑用）
  const POPULAR_COINS = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT', 'BNB/USDT:USDT', 'XRP/USDT:USDT', 'DOGE/USDT:USDT', 'ADA/USDT:USDT', 'AVAX/USDT:USDT', 'LINK/USDT:USDT', 'SUI/USDT:USDT', 'PEPE/USDT:USDT', 'WIF/USDT:USDT'];

  const toggleEditCoin = (coin: string) => {
    setEditCoins(prev => prev.includes(coin) ? prev.filter(c => c !== coin) : [...prev, coin]);
  };
  const toggleEditExcludedCoin = (coin: string) => {
    setEditExcludedCoins(prev => prev.includes(coin) ? prev.filter(c => c !== coin) : [...prev, coin]);
  };

  // Extract data
  const strategy = detail.strategy;
  const coinSourceConfig = strategy.coinSourceConfig as any;
  const riskControlConfig = strategy.riskControlConfig as any;
  const symbols = coinSourceConfig?.coins || [];
  const maxLeverage = riskControlConfig?.maxLeverage || '—';
  const maxPositions = riskControlConfig?.maxPositions || 3;
  const maxDrawdown = riskControlConfig?.maxDailyDrawdown
    ? (riskControlConfig.maxDailyDrawdown <= 1
        ? `${(riskControlConfig.maxDailyDrawdown * 100).toFixed(0)}%`
        : `$${riskControlConfig.maxDailyDrawdown}`)
    : '—';

  const logs = logsData?.data || [];
  const pnlHistory = pnlChart?.dataPoints || [];

  // Today stats calculation (approximate from logs)
  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.createdAt);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  });
  const todayTrades = todayLogs.filter(log => log.executed).length;
  const todayWins = todayLogs.filter(log => log.executed && log.decision.action.includes('close')).length; // Simplified
  const todayLosses = todayTrades - todayWins;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] w-full">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-30 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            title={t('common.back')}
            aria-label={t('common.back')}
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-xl active:opacity-70"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold">{strategy.name}</h1>
          <div className="w-9" />
        </div>

        {/* 状态栏 */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm">
              <span className={`w-2 h-2 rounded-full ${strategy.isActive ? 'bg-[#10B981]' : 'bg-[#606070]'}`} />
              {strategy.isActive ? t('common.running') : t('common.stopped')}
            </span>
          </div>
          {strategy.isActive ? (
            <div className="flex items-center gap-2">
              <button
                title={t('detail.trigger')}
                aria-label={t('detail.trigger')}
                onClick={handleTriggerCycle}
                disabled={triggerCycle.isPending}
                className="px-3 py-1.5 text-xs font-medium bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30 rounded-lg active:opacity-70 disabled:opacity-50 flex items-center gap-1"
              >
                {triggerCycle.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {t('detail.trigger')}
              </button>
              <button
                title={t('common.pause')}
                aria-label={t('common.pause')}
                onClick={() => setShowPauseModal(true)}
                className="px-3 py-1.5 text-xs font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
              >
                {t('common.pause')}
              </button>
              <button
                title={t('common.stop')}
                aria-label={t('common.stop')}
                onClick={() => setShowStopModal(true)}
                className="px-3 py-1.5 text-xs font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
              >
                {t('common.stop')}
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                try {
                  await strategyControl.mutateAsync({ id: strategyId, action: 'start' });
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || t('common.failed'));
                }
              }}
              disabled={strategyControl.isPending}
              className="px-4 py-1.5 text-xs font-medium bg-[#10B981] text-white rounded-lg active:opacity-70 disabled:opacity-50 flex items-center gap-1"
            >
              {strategyControl.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {t('common.start')}
            </button>
          )}
        </div>

        {/* 运行信息 */}
        <div className="px-4 pb-3">
          <p className="text-xs text-[#606070]">
            {t('detail.runDuration')} {formatRunningTime(strategy.createdAt)} · {t('detail.nextCycle')}{" "}
            {formatTimeUntil(detail.nextCycleAt)}
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="px-4 pb-4">
          <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] grid grid-cols-4">
            <div className="p-2.5 text-center">
              <p className="text-[10px] text-[#606070] mb-0.5">{t('detail.pnl')}</p>
              <p className={`text-sm font-semibold ${Number(strategy.totalPnl) >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                {Number(strategy.totalPnl) >= 0 ? '+' : ''}{Number(strategy.totalPnl).toFixed(2)}
              </p>
            </div>
            <div className="p-2.5 text-center">
              <p className="text-[10px] text-[#606070] mb-0.5">{t('detail.winLoss')}</p>
              <p className="text-sm font-semibold">
                {Number(strategy.winRate).toFixed(1)}%
              </p>
            </div>
            <div className="p-2.5 text-center">
              <p className="text-[10px] text-[#606070] mb-0.5">Sharpe</p>
              <p className="text-sm font-semibold">
                {Number(strategy.sharpe).toFixed(2)}
              </p>
            </div>
            <div className="p-2.5 text-center">
              <p className="text-[10px] text-[#606070] mb-0.5">{t('detail.trades')}</p>
              <p className="text-sm font-semibold">
                {strategy.totalTrades}
              </p>
            </div>
          </div>
        </div>

        {/* Tab 栏 */}
        <div className="flex items-center border-b border-[#1E1E2E]">
          {[
            { key: "overview", label: t('detail.overviewTab') },
            { key: "config", label: t('detail.configTab') },
            { key: "decisions", label: 'AI决策' },
          ].map((tab) => (
            <button
              key={tab.key}
              title={tab.label}
              aria-label={tab.label}
              onClick={() =>
                setActiveTab(
                  tab.key as "overview" | "config" | "decisions"
                )
              }
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "text-[#06B6D4] border-[#06B6D4]"
                  : "text-[#606070] border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab 内容 */}
      <main className="pb-6">
        {/* Tab 1: 概览 */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* 模式说明 */}
            {(() => {
              const modeInfo = TRADING_MODE_INFO[strategy.tradingMode];
              if (!modeInfo) return null;
              return (
                <div className="mx-4 mt-4 bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                      style={{ backgroundColor: modeInfo.bg }}
                    >
                      {modeInfo.icon}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: modeInfo.color }}>
                      {modeInfo.title}
                    </span>
                  </div>
                  <p className="text-xs text-[#9090A0] leading-relaxed mb-2">
                    {modeInfo.description}
                  </p>
                  <div className="pt-2 border-t border-[#1E1E2E]">
                    <p className="text-xs text-[#606070]">
                      {buildConfigSummary(strategy.tradingMode, strategy)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* 时间筛选 */}
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2">
                {[
                  { key: "24h", label: t('detail.timeFilter24h') },
                  { key: "7d", label: t('detail.timeFilter7d') },
                  { key: "30d", label: t('detail.timeFilter30d') },
                  { key: "all", label: t('detail.timeFilterAll') },
                ].map(({ key: filter, label }) => (
                  <button
                    key={filter}
                    title={label}
                    aria-label={label}
                    onClick={() => setTimeFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      timeFilter === filter
                        ? "bg-[#06B6D4] text-[#F8F8FC]"
                        : "bg-[#12121A] text-[#9090A0] border border-[#1E1E2E]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* PnL 曲线图 */}
            <div className="mx-4 bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
              <div className="mb-4">
                <p className="text-xs text-[#606070] mb-1">{t('detail.pnlChart', { filter: timeFilter })}</p>
                <p className={`text-2xl font-bold ${(pnlChart?.finalPnl ?? 0) >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                  {(pnlChart?.finalPnl ?? 0) >= 0 ? '+' : ''}${(pnlChart?.finalPnl ?? 0).toFixed(2)}
                </p>
              </div>

              {/* 简单折线图 */}
              {pnlHistory.length > 0 ? (
                <div className="relative h-32">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    {/* 零线 */}
                    <line
                      x1="0"
                      y1="50"
                      x2="100"
                      y2="50"
                      stroke="#1E1E2E"
                      strokeWidth="0.5"
                      strokeDasharray="2,2"
                    />

                    {/* PnL 曲线 */}
                    <polyline
                      points={pnlHistory
                        .map((point, i) => {
                          const x = (i / (pnlHistory.length - 1 || 1)) * 100;
                          const maxPnl = Math.max(...pnlHistory.map(p => Math.abs(p.pnl)));
                          const y = 50 - (point.pnl / (maxPnl || 100)) * 40;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="#06B6D4"
                      strokeWidth="2"
                    />

                    {/* 渐变填充 */}
                    <defs>
                      <linearGradient
                        id="pnlGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="#06B6D4"
                          stopOpacity="0.2"
                        />
                        <stop
                          offset="100%"
                          stopColor="#06B6D4"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    <polygon
                      points={`${pnlHistory
                        .map((point, i) => {
                          const x = (i / (pnlHistory.length - 1 || 1)) * 100;
                          const maxPnl = Math.max(...pnlHistory.map(p => Math.abs(p.pnl)));
                          const y = 50 - (point.pnl / (maxPnl || 100)) * 40;
                          return `${x},${y}`;
                        })
                        .join(" ")} 100,50 0,50`}
                      fill="url(#pnlGradient)"
                    />
                  </svg>

                  {/* 时间标签 */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-[#606070]">
                    {pnlHistory
                      .filter((_, i) => i % Math.max(1, Math.floor(pnlHistory.length / 4)) === 0)
                      .map((point) => (
                        <span key={point.date}>{new Date(point.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-[#606070] text-sm py-8">{t('common.noData')}</div>
              )}
            </div>

            {/* 今日统计 */}
            <div className="mx-4 bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
              <h3 className="text-sm font-semibold mb-3">{t('detail.todayStats')}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9090A0]">{t('detail.todayPnl')}</span>
                  <span className={`text-sm font-semibold ${detail.todayPnl >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                    {detail.todayPnl >= 0 ? '+' : ''}${detail.todayPnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9090A0]">{t('detail.tradeCount')}</span>
                  <span className="text-sm font-semibold">
                    {todayTrades}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9090A0]">{t('detail.winLoss')}</span>
                  <span className="text-sm font-semibold">
                    <span className="text-[#10B981]">
                      {todayWins}
                    </span>
                    <span className="text-[#606070]"> / </span>
                    <span className="text-[#F43F5E]">
                      {todayLosses}
                    </span>
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: 最近决策 */}
        {activeTab === "decisions" && (
          <div className="space-y-4">
            <div className="mx-4 mt-4 bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{t('detail.recentDecisions')}</h3>
                <button
                  onClick={() => router.push(`/ai?view=timeline&filter=${strategy.tradingMode}`)}
                  className="text-xs text-[#06B6D4] active:opacity-70"
                  title={t('detail.viewAllDecisions')} aria-label={t('detail.viewAllDecisions')}
                >
                  {t('detail.viewAll')}
                </button>
              </div>
              {logs.length === 0 ? (
                <p className="text-xs text-[#606070] text-center py-4">{t('detail.noDecisions')}</p>
              ) : (
                <div className="space-y-0">
                  {logs.map((log, idx) => (
                    <RecentDecisionRow
                      key={log.id}
                      log={log}
                      tradingMode={strategy.tradingMode}
                      onViewVotes={() => setVoteSheetLog(log)}
                      isLast={idx === logs.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: 配置 */}
        {activeTab === "config" && (
          <div className={`p-4 space-y-4 ${isEditing ? 'pb-24' : ''}`}>
            {!isEditing ? (
              /* ── 阅读模式 ── */
              <>
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold mb-3">{t('detail.currentConfig')}</h3>
                  <div className="space-y-2.5">
                    <ConfigRow label={t('detail.configStrategyType')} value={strategy.strategyType === 'grid' ? t('detail.gridTrading') : t('detail.normalStrategy')} />

                    {/* Grid 策略配置 */}
                    {strategy.strategyType === 'grid' && strategy.gridConfig ? (
                      <>
                        <ConfigRow label={t('detail.configTradingPair')} value={(strategy.gridConfig as any)?.symbol || '—'} />
                        <ConfigRow label={t('detail.configInvestment')} value={`$${(strategy.gridConfig as any)?.totalInvestment?.toLocaleString() || '—'}`} />
                        <ConfigRow label={t('detail.configLeverage')} value={`${(strategy.gridConfig as any)?.leverage || 1}x`} />
                        <ConfigRow label={t('detail.configGridCount')} value={(strategy.gridConfig as any)?.gridCount || '—'} />
                        <ConfigRow label={t('detail.configPriceBounds')} value={(strategy.gridConfig as any)?.useAtrBounds ? `ATR ${(strategy.gridConfig as any)?.atrMultiplier || 2}x` : `${(strategy.gridConfig as any)?.lowerBound} - ${(strategy.gridConfig as any)?.upperBound}`} />
                        <ConfigRow label={t('detail.configMaxDrawdown')} value={`${(strategy.gridConfig as any)?.maxDrawdownPct || 15}%`} />
                        <ConfigRow label={t('detail.configStopLoss')} value={`${(strategy.gridConfig as any)?.stopLossPct || 5}%`} />
                        {detail.gridState && (
                          <div className="mt-2 pt-2 border-t border-[#1E1E2E]">
                            <p className="text-xs text-[#06B6D4] font-medium mb-2">{t('detail.gridStatus')}</p>
                            <ConfigRow label={t('detail.activeOrders')} value={detail.gridState.activeOrders} />
                            <ConfigRow label={t('detail.filledOrders')} value={detail.gridState.filledOrders} />
                            <ConfigRow label={t('detail.gridLevels')} value={detail.gridState.gridLevels} />
                            {detail.gridState.upperPrice && detail.gridState.lowerPrice && (
                              <ConfigRow label={t('detail.configActualRange')} value={`${detail.gridState.lowerPrice} - ${detail.gridState.upperPrice}`} />
                            )}
                            {detail.gridState.gridSpacing && (
                              <ConfigRow label={t('detail.gridSpacing')} value={`$${detail.gridState.gridSpacing.toFixed(2)}`} />
                            )}
                            <ConfigRow label={t('detail.gridInitialized')} value={detail.gridState.isInitialized ? 'Yes' : 'No'} />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                    <ConfigRow label={t('detail.configTradingMode')} value={strategy.tradingMode === 'solo' ? t('detail.soloMode') : strategy.tradingMode === 'debate' ? t('detail.debateMode') : strategy.tradingMode} />
                    <div>
                      <p className="text-xs text-[#606070] mb-1">{t('detail.coinSource')}</p>
                      <p className="text-sm">{coinSourceConfig?.mode === 'static' ? t('detail.coinSourceManual') : coinSourceConfig?.mode === 'ai' ? t('detail.coinSourceAI') : coinSourceConfig?.mode === 'oi_top' ? t('detail.coinSourceOIHigh') : coinSourceConfig?.mode === 'oi_low' ? t('detail.coinSourceOILow') : coinSourceConfig?.mode === 'mixed' ? t('detail.coinSourceMixed') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#606070] mb-1">{t('detail.tradingCoins')}</p>
                      <div className="flex flex-wrap gap-2">
                        {symbols.length > 0 ? symbols.map((s: string) => (
                          <span key={s} className="px-3 py-1.5 text-xs font-medium bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30 rounded-lg">{s.split('/')[0]}</span>
                        )) : <span className="text-sm text-[#606070]">{t('common.notConfigured')}</span>}
                      </div>
                    </div>
                    {coinSourceConfig?.maxCoins && (
                      <ConfigRow label={t('detail.maxCoins')} value={coinSourceConfig.maxCoins} />
                    )}
                    {coinSourceConfig?.excludedCoins?.length > 0 && (
                      <div>
                        <p className="text-xs text-[#606070] mb-1">{t('detail.excludeCoins')}</p>
                        <div className="flex flex-wrap gap-2">
                          {coinSourceConfig.excludedCoins.map((s: string) => (
                            <span key={s} className="px-3 py-1.5 text-xs font-medium bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg">{s.split('/')[0]}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <ConfigRow label={t('detail.allocatedCapital')} value={riskControlConfig?.allocatedCapital ? `$${Number(riskControlConfig.allocatedCapital).toLocaleString()}` : '—'} />
                    <ConfigRow label={t('detail.maxLeverage')} value={`${maxLeverage}x`} />
                    <ConfigRow label={t('detail.maxPositions')} value={maxPositions} />
                    <ConfigRow label={t('detail.maxDrawdown')} value={maxDrawdown} />
                    <ConfigRow label={t('detail.maxDailyTrades')} value={riskControlConfig?.maxDailyTrades || '—'} />
                    <ConfigRow label={t('detail.cooldownTime')} value={riskControlConfig?.cooldownMinutes ? `${riskControlConfig.cooldownMinutes}min` : '—'} />
                      </>
                    )}
                    <ConfigRow label={t('detail.executionCycle')} value={`${strategy.intervalMinutes} ${t('common.min')}`} />
                  </div>
                </div>

                {/* Prompt 配置 */}
                {strategy.promptSections && (
                  <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                    <h3 className="text-sm font-semibold mb-3">{t('detail.promptConfig')}</h3>
                    <div className="space-y-2.5">
                      <ConfigRow label={t('detail.editTradingStyle')} value={strategy.promptSections.mode === 'aggressive' ? t('detail.promptAggressive') : strategy.promptSections.mode === 'scalping' ? t('detail.promptScalping') : t('detail.promptConservative')} />
                      {strategy.promptSections.role && (
                        <div>
                          <p className="text-xs text-[#606070] mb-1">{t('detail.roleDefinition')}</p>
                          <p className="text-xs text-[#9090A0] bg-[#0A0A0F] rounded-lg p-2 whitespace-pre-line">{strategy.promptSections.role}</p>
                        </div>
                      )}
                      {strategy.promptSections.tradingFrequency && (
                        <div>
                          <p className="text-xs text-[#606070] mb-1">{t('detail.tradingFrequency')}</p>
                          <p className="text-xs text-[#9090A0] bg-[#0A0A0F] rounded-lg p-2 whitespace-pre-line">{strategy.promptSections.tradingFrequency}</p>
                        </div>
                      )}
                      {strategy.promptSections.entryStandards && (
                        <div>
                          <p className="text-xs text-[#606070] mb-1">{t('detail.entryStandards')}</p>
                          <p className="text-xs text-[#9090A0] bg-[#0A0A0F] rounded-lg p-2 whitespace-pre-line">{strategy.promptSections.entryStandards}</p>
                        </div>
                      )}
                      {strategy.promptSections.custom && (
                        <div>
                          <p className="text-xs text-[#606070] mb-1">{t('detail.decisionProcess')}</p>
                          <p className="text-xs text-[#9090A0] bg-[#0A0A0F] rounded-lg p-2 whitespace-pre-line">{strategy.promptSections.custom}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  title={t('detail.editConfig')}
                  aria-label={t('detail.editConfig')}
                  onClick={enterEditMode}
                  className="w-full py-3 bg-[#06B6D4] text-[#F8F8FC] text-sm font-medium rounded-lg shadow-lg shadow-[#06B6D4]/20 active:opacity-80 flex items-center justify-center gap-2"
                >
                  <Pencil className="w-4 h-4" /> {t('detail.editConfig')}
                </button>
              </>
            ) : (
              /* ── 编辑模式 ── */
              <>
                {/* 卡片 1: 交易币种 */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold">{t('detail.editCoins')}</h3>
                  <p className="text-xs text-[#606070]">{t('detail.editCoinSource')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'static', label: t('detail.coinSourceManual') },
                      { key: 'ai', label: t('detail.coinSourceAI') },
                      { key: 'oi_top', label: t('detail.coinSourceOIHigh') },
                      { key: 'oi_low', label: t('detail.coinSourceOILow') },
                      { key: 'mixed', label: t('detail.coinSourceMixed') },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setEditCoinMode(key)}
                        className={`py-2 text-xs font-medium rounded-lg transition-all ${editCoinMode === key
                          ? 'bg-[#06B6D4]/15 border-2 border-[#06B6D4] text-[#06B6D4] shadow-[0_0_8px_rgba(6,182,212,0.12)]'
                          : 'bg-[#1E1E2E] text-[#9090A0] border border-[#1E1E2E]'}`}
                        title={label} aria-label={label}
                      >{label}</button>
                    ))}
                  </div>

                  {/* 币种选择（static / mixed） */}
                  {(editCoinMode === 'static' || editCoinMode === 'mixed') && (
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_COINS.map(coin => {
                        const short = coin.split('/')[0];
                        const selected = editCoins.includes(coin);
                        return (
                          <button
                            key={coin}
                            onClick={() => toggleEditCoin(coin)}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${selected
                              ? 'bg-[#06B6D4]/10 border-2 border-[#06B6D4] text-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                              : 'bg-[#1E1E2E] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/30'}`}
                            title={short} aria-label={short}
                          >
                            {selected && <Check className="w-3 h-3 inline mr-1" />}
                            {short}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* maxCoins 滑块 (非 static) */}
                  {editCoinMode !== 'static' && (
                    <SliderField label={t('detail.editMaxCoins')} value={editMaxCoins} min={3} max={15} onChange={setEditMaxCoins} />
                  )}

                  {/* 排除币种 */}
                  <button
                    onClick={() => setShowEditExcluded(!showEditExcluded)}
                    className="flex items-center gap-1 text-xs text-[#9090A0]"
                    title={t('detail.editExcludeCoins')} aria-label={t('detail.editExcludeCoins')}
                  >
                    {t('detail.editExcludeCoins')} ({editExcludedCoins.length})
                    {showEditExcluded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showEditExcluded && (
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_COINS.map(coin => {
                        const short = coin.split('/')[0];
                        const excluded = editExcludedCoins.includes(coin);
                        return (
                          <button
                            key={coin}
                            onClick={() => toggleEditExcludedCoin(coin)}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${excluded
                              ? 'bg-[#EF4444]/10 border-2 border-[#EF4444] text-[#EF4444] shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                              : 'bg-[#1E1E2E] text-[#9090A0] border border-[#1E1E2E] hover:border-[#EF4444]/30'}`}
                            title={short} aria-label={short}
                          >{short}</button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 卡片 2: 风控参数 */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold">{t('detail.editRiskControl')}</h3>
                  <SliderField label={t('detail.editAllocatedCapital')} value={editAllocatedCapital} min={500} max={100000} step={500} prefix="$" onChange={setEditAllocatedCapital} />
                  <SliderField label={t('detail.editMaxLeverage')} value={editMaxLeverage} min={1} max={20} suffix="x" onChange={setEditMaxLeverage} />
                  <SliderField label={t('detail.editMaxPositions')} value={editMaxPositions} min={1} max={10} onChange={setEditMaxPositions} />
                  <SliderField label={t('detail.editDailyDrawdown')} value={editMaxDailyDrawdown} min={50} max={5000} step={50} prefix="$" onChange={setEditMaxDailyDrawdown} />
                  <SliderField label={t('detail.editMaxDailyTrades')} value={editMaxDailyTrades} min={1} max={50} onChange={setEditMaxDailyTrades} />
                  <SliderField label={t('detail.editCooldown')} value={editCooldownMinutes} min={0} max={120} step={5} suffix="min" onChange={setEditCooldownMinutes} />
                </div>

                {/* 卡片 3: Prompt 配置 (4段) */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold">{t('detail.editPromptConfig')}</h3>

                  <div>
                    <p className="text-xs text-[#606070] mb-2">{t('detail.editTradingStyle')}</p>
                    <div className="flex gap-2">
                      {([
                        { key: 'conservative', label: t('detail.editConservative') },
                        { key: 'aggressive', label: t('detail.editAggressive') },
                        { key: 'scalping', label: t('detail.editScalping') },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setEditPromptMode(key)}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${editPromptMode === key
                            ? 'bg-[#06B6D4]/15 border-2 border-[#06B6D4] text-[#06B6D4] shadow-[0_0_8px_rgba(6,182,212,0.12)]'
                            : 'bg-[#1E1E2E] text-[#9090A0] border border-[#1E1E2E]'}`}
                          title={label} aria-label={label}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* 4 段可折叠 Prompt 编辑器 */}
                  {(() => {
                    const promptSections: Array<{
                      id: string; label: string;
                      value: string; setter: (v: string) => void;
                      defaultVal: string; maxLen: number; placeholder: string;
                    }> = [
                      { id: 'role', label: `${t('detail.editPromptSection', { n: '1' })}: ${t('detail.roleDefinition')}`, value: editPromptRole, setter: setEditPromptRole, defaultVal: PROMPT_DEFAULTS.role, maxLen: 300, placeholder: PROMPT_DEFAULTS.role },
                      { id: 'frequency', label: `${t('detail.editPromptSection', { n: '2' })}: ${t('detail.tradingFrequency')}`, value: editPromptTradingFrequency, setter: setEditPromptTradingFrequency, defaultVal: PROMPT_DEFAULTS.tradingFrequency, maxLen: 300, placeholder: PROMPT_DEFAULTS.tradingFrequency },
                      { id: 'entry', label: `${t('detail.editPromptSection', { n: '3' })}: ${t('detail.entryStandards')}`, value: editPromptEntryStandards, setter: setEditPromptEntryStandards, defaultVal: PROMPT_DEFAULTS.entryStandards, maxLen: 300, placeholder: PROMPT_DEFAULTS.entryStandards },
                      { id: 'decision', label: `${t('detail.editPromptSection', { n: '4' })}: ${t('detail.decisionProcess')}`, value: editPromptCustom, setter: setEditPromptCustom, defaultVal: PROMPT_DEFAULTS.decisionProcess, maxLen: 500, placeholder: PROMPT_DEFAULTS.decisionProcess },
                    ];
                    return promptSections.map((sec) => (
                      <details key={sec.id} className="group">
                        <summary className="flex items-center justify-between cursor-pointer text-xs text-[#9090A0] hover:text-[#F8F8FC] py-1">
                          <span>{sec.label}</span>
                          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          <textarea
                            value={sec.value}
                            onChange={(e) => sec.setter(e.target.value)}
                            maxLength={sec.maxLen}
                            rows={3}
                            placeholder={sec.placeholder}
                            className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg p-2 text-xs text-[#F8F8FC] placeholder-[#606070] resize-none focus:outline-none focus:border-[#06B6D4]"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-[#606070]">{sec.value.length}/{sec.maxLen}</p>
                            <button
                              onClick={() => sec.setter(sec.defaultVal)}
                              className="flex items-center gap-1 text-[10px] text-[#606070] hover:text-[#9090A0]"
                              title={t('detail.editResetDefault')} aria-label={t('detail.editResetDefault')}
                            >
                              <RotateCcw className="w-3 h-3" /> {t('detail.editResetDefault')}
                            </button>
                          </div>
                        </div>
                      </details>
                    ));
                  })()}

                  <button
                    onClick={handlePreviewPrompt}
                    disabled={previewPrompt.isPending}
                    className="w-full py-2 text-xs font-medium text-[#06B6D4] bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-lg active:opacity-70 disabled:opacity-50 flex items-center justify-center gap-1"
                    title={t('detail.editPreviewPrompt')} aria-label={t('detail.editPreviewPrompt')}
                  >
                    {previewPrompt.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                    {t('detail.editPreviewPrompt')}
                  </button>
                </div>

                {/* 卡片 4: 执行配置 */}
                <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
                  <h3 className="text-sm font-semibold">{t('detail.editExecutionConfig')}</h3>
                  <p className="text-xs text-[#606070]">{t('detail.editRunInterval')}</p>
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
                        title={label} aria-label={label}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {/* 提示 */}
                <p className="text-xs text-[#606070]">
                  {strategy.isActive ? t('detail.editRunningWarning') : t('detail.editRunningWarning')}
                </p>

                {/* 固定底部保存/取消栏 */}
                <div className="fixed bottom-16 left-0 right-0 z-40 bg-[#12121A] border-t border-[#1E1E2E] px-4 py-3 flex gap-3">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
                    title={t('detail.editCancel')} aria-label={t('detail.editCancel')}
                  >{t('detail.editCancel')}</button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-[#06B6D4] text-[#F8F8FC] text-sm font-medium rounded-lg shadow-lg shadow-[#06B6D4]/20 active:opacity-80 disabled:opacity-50"
                    title={t('detail.editSave')} aria-label={t('detail.editSave')}
                  >{isSaving ? t('common.saving') : t('detail.editSave')}</button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* 弹窗1: 暂停策略 */}
      {showPauseModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowPauseModal(false)}
          />
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl p-6 animate-slide-up">
            <h2 className="text-lg font-semibold mb-4">{t('detail.pauseStrategy')}</h2>

            <div className="mb-6">
              <p className="text-xs text-[#606070] mb-3">{t('detail.pauseDuration')}</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "30min", label: "30min" },
                  { key: "1h", label: "1h" },
                  { key: "4h", label: "4h" },
                  { key: "24h", label: "24h" },
                  { key: "manual", label: t('detail.pauseManual') },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    title={label}
                    aria-label={label}
                    onClick={() => setPauseDuration(key)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      pauseDuration === key
                        ? "bg-[#06B6D4] text-[#F8F8FC]"
                        : "bg-[#1E1E2E] text-[#9090A0] border border-[#1E1E2E]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                title={t('common.cancel')}
                aria-label={t('common.cancel')}
                onClick={() => setShowPauseModal(false)}
                className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
              >
                {t('common.cancel')}
              </button>
              <button
                title={t('detail.confirmPause')}
                aria-label={t('detail.confirmPause')}
                onClick={handlePause}
                disabled={strategyControl.isPending}
                className="flex-1 py-3 bg-[#06B6D4] text-[#F8F8FC] text-sm font-medium rounded-lg shadow-lg shadow-[#06B6D4]/20 active:opacity-80 disabled:opacity-50"
              >
                {strategyControl.isPending ? t('common.pausing') : t('detail.confirmPause')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗2: 停止策略 */}
      {showStopModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowStopModal(false)}
          />
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl p-6 animate-slide-up">
            <h2 className="text-lg font-semibold mb-2">{t('detail.stopStrategy')}</h2>
            <p className="text-sm text-[#9090A0] mb-6">
              {t('detail.stopWarning')}
            </p>

            <div className="flex items-center gap-3">
              <button
                title={t('common.cancel')}
                aria-label={t('common.cancel')}
                onClick={() => setShowStopModal(false)}
                className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
              >
                {t('common.cancel')}
              </button>
              <button
                title={t('detail.confirmStop')}
                aria-label={t('detail.confirmStop')}
                onClick={handleStop}
                disabled={strategyControl.isPending}
                className="flex-1 py-3 bg-[#F43F5E] text-[#F8F8FC] text-sm font-medium rounded-lg active:opacity-80 disabled:opacity-50"
              >
                {strategyControl.isPending ? t('common.stopping') : t('detail.confirmStop')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗3: Prompt 预览 */}
      {showPromptPreview && previewPrompt.data && (
        <PromptPreviewSheet
          systemPrompt={previewPrompt.data.systemPrompt}
          sections={previewPrompt.data.sections}
          estimatedTokens={previewPrompt.data.estimatedTokens}
          onClose={() => setShowPromptPreview(false)}
        />
      )}

      {/* 弹窗4: Debate 多模型投票详情 */}
      {voteSheetLog && (
        <VoteDetailSheet
          log={voteSheetLog}
          onClose={() => setVoteSheetLog(null)}
        />
      )}

    </div>
  );
}

// 最近决策行
function RecentDecisionRow({ log, tradingMode, onViewVotes, isLast }: {
  log: StrategyLog;
  tradingMode: string;
  onViewVotes: () => void;
  isLast: boolean;
}) {
  const t = useTranslations('ai');
  const action = log.decision.action;
  const ac = ACTION_CONFIG[action];
  const label = ac?.labelZh || action;
  const color = ac?.color || '#94A3B8';
  const bg = ac?.bg || 'rgba(148,163,184,0.15)';
  const time = new Date(log.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const executed = log.executed && !log.executionResult?.error;
  const hasVotes = tradingMode === 'debate' && log.decision.votes && log.decision.votes.length > 0;

  return (
    <div className={`flex items-center gap-3 py-2.5 ${!isLast ? 'border-b border-[#1E1E2E]' : ''}`}>
      <span className="text-xs text-[#606070] w-10 flex-shrink-0">{time}</span>
      <span className="text-xs font-medium text-[#F8F8FC] w-12 flex-shrink-0 truncate">
        {log.symbol.split('/')[0]}
      </span>
      <span
        className="px-1.5 py-0.5 text-[10px] font-medium rounded"
        style={{ color, backgroundColor: bg }}
      >
        {label}
      </span>
      {log.decision.confidence && (
        <span className="text-[10px] text-[#9090A0]">{Math.round(log.decision.confidence)}%</span>
      )}
      <div className="flex-1" />
      {hasVotes && (
        <button
          onClick={onViewVotes}
          className="px-2 py-0.5 text-[10px] font-medium text-[#8B5CF6] bg-[#8B5CF6]/10 rounded active:opacity-70"
          title={t('detail.voteDetail', { symbol: log.symbol })} aria-label={t('detail.voteModelVotes')}
        >
          {t('detail.voteModelVotes')}
        </button>
      )}
      <span className="flex-shrink-0">
        {executed ? (
          <Check className="w-3.5 h-3.5 text-[#10B981]" />
        ) : (
          <span className="w-3.5 h-3.5 rounded-full border border-[#606070] inline-block" />
        )}
      </span>
    </div>
  );
}

// 只读配置行
function ConfigRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-[#606070] mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

// 滑块字段
function SliderField({ label, value, min, max, step = 1, prefix, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  prefix?: string; suffix?: string; onChange: (v: number) => void;
}) {
  const display = `${prefix || ''}${step < 1 ? value.toFixed(1) : value}${suffix || ''}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[#9090A0]">{label}</label>
        <span className="text-xs font-semibold">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-[#1E1E2E] rounded-lg appearance-none cursor-pointer"
        aria-label={label} title={label}
      />
    </div>
  );
}

// Prompt 预览底部弹窗
function PromptPreviewSheet({ systemPrompt, sections, estimatedTokens, onClose }: {
  systemPrompt: string; sections: string[]; estimatedTokens: number; onClose: () => void;
}) {
  const t = useTranslations('ai');
  const costEstimate = (estimatedTokens / 1000 * 0.003).toFixed(4); // 粗略估算
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-h-[85vh] overflow-y-auto bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#2B3139] rounded-full" />
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('detail.promptPreview')}</h2>
            <button onClick={onClose} title={t('common.collapse')} aria-label={t('common.collapse')} className="p-2 -mr-2 active:opacity-70">
              <X className="w-5 h-5" />
            </button>
          </div>

          <pre className="text-xs text-[#9090A0] bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl p-4 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[60vh] overflow-y-auto">
            {systemPrompt.split('\n').map((line, i) => (
              <span key={i}>
                {line.startsWith('## ') ? <span className="text-[#06B6D4] font-semibold">{line}</span> : line}
                {'\n'}
              </span>
            ))}
          </pre>

          <div className="flex items-center justify-between text-xs text-[#606070]">
            <span>{t('detail.promptSections', { count: sections.length })}</span>
            <span>{t('detail.promptTokens', { tokens: estimatedTokens.toLocaleString(), cost: costEstimate })}</span>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
            title={t('common.collapse')} aria-label={t('common.collapse')}
          >{t('common.collapse')}</button>
        </div>
      </div>
    </div>
  );
}

// 多模型投票详情 BottomSheet（Debate 模式）
function VoteDetailSheet({
  log,
  onClose,
}: {
  log: StrategyLog;
  onClose: () => void;
}) {
  const t = useTranslations('ai');
  const [expandedVotes, setExpandedVotes] = useState<Set<number>>(new Set());
  const votes = log.decision.votes || [];
  const validVotes = votes.filter((v) => v.success && v.weight > 0);
  const failedVotes = votes.filter((v) => !v.success);

  // 阵营归类
  const actionToCamp = (action: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' => {
    if (action === 'open_long' || action === 'close_short') return 'BULLISH';
    if (action === 'open_short' || action === 'close_long') return 'BEARISH';
    return 'NEUTRAL';
  };

  const actionLabel: Record<string, string> = {
    open_long: t('detail.actionOpenLong'), open_short: t('detail.actionOpenShort'),
    close_long: t('detail.actionCloseLong'), close_short: t('detail.actionCloseShort'),
    hold: t('detail.actionHold'), wait: t('detail.actionWait'),
  };

  // 统计各阵营票数
  const campCounts: Record<string, number> = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
  for (const v of validVotes) {
    campCounts[actionToCamp(v.action)]++;
  }

  const toggleVoteExpand = (idx: number) => {
    const newSet = new Set(expandedVotes);
    if (newSet.has(idx)) newSet.delete(idx);
    else newSet.add(idx);
    setExpandedVotes(newSet);
  };

  // 共识结果
  const consensusAction = log.decision.action;
  const consensusCamp = actionToCamp(consensusAction);

  // 模型显示名辅助
  const getModelName = (modelId: string) => MODEL_DISPLAY[modelId]?.name || modelId;
  const getModelColor = (modelId: string) => MODEL_DISPLAY[modelId]?.color || '#94A3B8';
  const getModelProvider = (modelId: string) => MODEL_DISPLAY[modelId]?.provider || '';

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-h-[85vh] overflow-y-auto bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl animate-slide-up">
        {/* 拖动条 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#2B3139] rounded-full" />
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* 标题 */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">
                {t('detail.voteDetail', { symbol: log.symbol })}
              </h2>
              <p className="text-xs text-[#606070] mt-0.5">
                {new Date(log.createdAt).toLocaleString('zh-CN', {
                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <button onClick={onClose} title={t('common.collapse')} aria-label={t('common.collapse')} className="p-2 -mr-2 active:opacity-70">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 动态阶段进度指示 (有风控成本→4阶段, 否则→2阶段 NoFx) */}
          {(() => {
            const hasRiskDebate = (log as any).riskDebateResult?.totalCost > 0;
            const stageLabels = hasRiskDebate ? DEBATE_STAGE_LABELS : DEBATE_STAGE_LABELS_V2;
            const stageEntries = Object.entries(stageLabels);
            return (
              <div className="flex items-center gap-1">
                {stageEntries.map(([key, label], idx) => (
                  <div key={key} className="flex items-center flex-1">
                    <div className="flex items-center gap-1 flex-1">
                      <div className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-[#F8F8FC]" />
                      </div>
                      <span className="text-[10px] text-[#9090A0] truncate">{label}</span>
                    </div>
                    {idx < stageEntries.length - 1 && <div className="w-3 h-px bg-[#10B981] mx-0.5 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* 共识结果 */}
          <div className="bg-[#1E1E2E] border border-[#1E1E2E] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('detail.voteConsensus')}: <span style={{ color: CAMP_COLORS[consensusCamp] || '#94A3B8' }}>
                  {actionLabel[consensusAction] || consensusAction}
                </span>
              </span>
              {log.decision.confidence && (
                <span className="text-sm text-[#9090A0]">
                  {t('detail.voteConfidence')} {Math.round(log.decision.confidence)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span style={{ color: CAMP_COLORS.BULLISH }}>
                {CAMP_LABELS.BULLISH} {campCounts.BULLISH}{t('common.times')}
              </span>
              <span className="text-[#2B3139]">·</span>
              <span style={{ color: CAMP_COLORS.BEARISH }}>
                {CAMP_LABELS.BEARISH} {campCounts.BEARISH}{t('common.times')}
              </span>
              <span className="text-[#2B3139]">·</span>
              <span style={{ color: CAMP_COLORS.NEUTRAL }}>
                {CAMP_LABELS.NEUTRAL} {campCounts.NEUTRAL}{t('common.times')}
              </span>
            </div>
            <p className="text-xs text-[#606070]">
              {t('detail.voteModelVotes')}: {votes.length} ({validVotes.length})
            </p>
          </div>

          {/* 阵营分布条 */}
          {validVotes.length > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden bg-[#1E1E2E]">
              {campCounts.BULLISH > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(campCounts.BULLISH / validVotes.length) * 100}%`,
                    backgroundColor: CAMP_COLORS.BULLISH,
                  }}
                />
              )}
              {campCounts.NEUTRAL > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(campCounts.NEUTRAL / validVotes.length) * 100}%`,
                    backgroundColor: CAMP_COLORS.NEUTRAL,
                  }}
                />
              )}
              {campCounts.BEARISH > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(campCounts.BEARISH / validVotes.length) * 100}%`,
                    backgroundColor: CAMP_COLORS.BEARISH,
                  }}
                />
              )}
            </div>
          )}

          {/* 各模型投票 */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#9090A0]">{t('detail.voteModelVotes')}</p>

            {validVotes.map((vote, idx) => {
              const camp = actionToCamp(vote.action);
              const isExpanded = expandedVotes.has(idx);
              const modelColor = getModelColor(vote.modelId);

              return (
                <button
                  key={`${vote.modelId}-${idx}`}
                  type="button"
                  onClick={() => vote.reasoning ? toggleVoteExpand(idx) : undefined}
                  className="w-full text-left bg-[#1E1E2E] rounded-lg p-3 space-y-1.5"
                  style={{ borderLeft: `3px solid ${modelColor}`, borderRight: '1px solid #1E1E2E', borderTop: '1px solid #1E1E2E', borderBottom: '1px solid #1E1E2E' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-[#F8F8FC] truncate">
                        {getModelName(vote.modelId)}
                      </span>
                      {getModelProvider(vote.modelId) && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#1E1E2E] text-[#606070] flex-shrink-0">
                          {getModelProvider(vote.modelId)}
                        </span>
                      )}
                    </div>
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded flex-shrink-0"
                      style={{
                        color: CAMP_COLORS[camp] || '#94A3B8',
                        backgroundColor: `${CAMP_COLORS[camp] || '#94A3B8'}15`,
                      }}
                    >
                      {actionLabel[vote.action] || vote.action}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#9090A0]">
                    <span>{t('detail.voteConfidence')} {Math.round(vote.confidence)}%</span>
                    <span className="text-[#2B3139]">·</span>
                    <span>{t('detail.voteLeverage')} {vote.weight}x</span>
                    {vote.reasoning && (
                      <>
                        <span className="text-[#2B3139]">·</span>
                        <span className="text-[#06B6D4]">
                          {isExpanded ? t('detail.collapseReasoning') : t('detail.expandReasoning')}
                        </span>
                      </>
                    )}
                  </div>
                  {/* 可展开的推理 */}
                  {isExpanded && vote.reasoning && (
                    <p className="text-xs text-[#606070] leading-relaxed whitespace-pre-line pt-2 border-t border-[#1E1E2E]">
                      {vote.reasoning}
                    </p>
                  )}
                </button>
              );
            })}

            {/* 失败的模型 */}
            {failedVotes.map((vote, idx) => (
              <div
                key={`fail-${vote.modelId}-${idx}`}
                className="bg-[#1E1E2E] border border-[#F43F5E]/20 rounded-lg p-3 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#9090A0]">
                    {getModelName(vote.modelId)}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#F43F5E]/10 text-[#F43F5E]">
                    {t('common.failed')}
                  </span>
                </div>
                {vote.error && (
                  <p className="text-xs text-[#F43F5E] mt-1">{vote.error}</p>
                )}
              </div>
            ))}
          </div>

          {/* 共识推理 */}
          {log.decision.reasoning && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#9090A0]">{t('detail.voteReasoning')}</p>
              <p className="text-xs text-[#606070] leading-relaxed whitespace-pre-line bg-[#1E1E2E] border border-[#1E1E2E] rounded-lg p-3">
                {log.decision.reasoning}
              </p>
            </div>
          )}

          {/* 收起按钮 */}
          <button
            onClick={onClose}
            className="w-full py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
            title={t('common.collapse')} aria-label={t('common.collapse')}
          >
            {t('common.collapse')}
          </button>
        </div>
      </div>
    </div>
  );
}
