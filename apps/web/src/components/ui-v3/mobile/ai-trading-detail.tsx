"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Pause,
  Square,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  Check,
  Loader2,
  Play,
  Pencil,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useStrategyDetail, useStrategyLogs, useStrategyPnlChart, useStrategyControl, useHotUpdateConfig, useUpdateStrategy, useTriggerCycle } from "@/hooks/useAi";
import { useStrategySocket, useDecisionStream, type StrategyDecisionEvent } from "@/hooks/useSocket";
import { useTranslations } from "@/i18n/provider";
import { useQueryClient } from "@tanstack/react-query";
import type { StrategyLog, CoinSourceConfig, RiskControlConfig, PromptSections, GridConfig } from "@/types/ai";
import {
  MODEL_DISPLAY,
  ACTION_CONFIG,
  DEFAULT_DEBATE_MODELS,
} from "@/constants/debate";
import { getTradingModeInfo, buildConfigSummary } from "@/constants/trading-modes";
import { TruncatedText } from "@/components/ui-v3/ai/timeline-cards/truncated-text";
import { PillGroup } from "@/components/ui-v3/ai/pill-group";
import { NumberStepper } from "@/components/ui-v3/ai/number-stepper";
import { ExchangeKeySelector } from "@/components/ui-v3/ai/exchange-key-selector";
import { translateErrorForDisplay } from "@/lib/error-translator";

const GRID_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'];
const ALL_COIN_NAMES = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK',
  'MATIC', 'UNI', 'ATOM', 'LTC', 'FIL', 'APT', 'ARB', 'OP', 'SUI', 'INJ',
  'TIA', 'SEI', 'JUP', 'WIF', 'PEPE', 'NEAR', 'FTM', 'AAVE', 'MKR', 'RENDER',
];

export function AIStrategyDetailPage() {
  const t = useTranslations('ai');
  const te = useTranslations('errors');
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
  const [showResumeGridModal, setShowResumeGridModal] = useState(false);
  const [pauseDuration, setPauseDuration] = useState<string>("1h");
  const [timeFilter, setTimeFilter] = useState<string>("7d");
  const [voteSheetLog, setVoteSheetLog] = useState<StrategyLog | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // 策略名称编辑
  const [editName, setEditName] = useState('');

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

  // 日志分页
  const [logsPage, setLogsPage] = useState(1);
  const [allLogs, setAllLogs] = useState<StrategyLog[]>([]);

  // Grid 编辑 state
  const [editGridInvestment, setEditGridInvestment] = useState(1000);
  const [editGridLeverage, setEditGridLeverage] = useState(1);
  const [editGridCount, setEditGridCount] = useState(10);
  const [editGridMaxDrawdown, setEditGridMaxDrawdown] = useState(15);
  const [editGridStopLoss, setEditGridStopLoss] = useState(5);
  const [editGridDailyLossLimit, setEditGridDailyLossLimit] = useState(0);
  const [editGridAutoAdjustThreshold, setEditGridAutoAdjustThreshold] = useState(20);
  const [editGridEnableDirectionAdjust, setEditGridEnableDirectionAdjust] = useState(false);
  const [editGridDirectionBiasRatio, setEditGridDirectionBiasRatio] = useState(70);
  const [editGridInterval, setEditGridInterval] = useState(60);
  const [editGridUpperPct, setEditGridUpperPct] = useState(0);   // 0 = 公式自动计算
  const [editGridLowerPct, setEditGridLowerPct] = useState(0);   // 0 = 公式自动计算
  const [editGridModel, setEditGridModel] = useState('deepseek-chat');
  const [editGridCurrentPrice, setEditGridCurrentPrice] = useState(0);

  // 创建表单对齐：高级风控 + 止停条件
  const [editMinConfidence, setEditMinConfidence] = useState(0);
  const [editMinRR, setEditMinRR] = useState(0);
  const [editMinPositionSize, setEditMinPositionSize] = useState(0);
  const [editMaxCycles, setEditMaxCycles] = useState(0);
  const [editProfitTarget, setEditProfitTarget] = useState(0);
  const [editMaxLoss, setEditMaxLoss] = useState(0);

  // Debate 编辑 state
  const [editDebateModels, setEditDebateModels] = useState<string[]>([]);
  const [editDebateMaxRounds, setEditDebateMaxRounds] = useState(3);
  const [editDebateTemperature, setEditDebateTemperature] = useState(0.7);

  // Solo 模型编辑 state
  const [editSoloModel, setEditSoloModel] = useState('deepseek-chat');
  const [showEditSoloModelDropdown, setShowEditSoloModelDropdown] = useState(false);
  const [showEditDebateModelDropdown, setShowEditDebateModelDropdown] = useState(false);

  // 交易所 + Grid 交易对 + Grid LLM 下拉
  const [editExchangeApiKeyId, setEditExchangeApiKeyId] = useState<string | null>(null);
  const [editGridSymbol, setEditGridSymbol] = useState('BTC');
  const [showEditGridModelDropdown, setShowEditGridModelDropdown] = useState(false);
  // 币种搜索
  const [editGridCoinSearch, setEditGridCoinSearch] = useState('');
  const [editCoinSearch, setEditCoinSearch] = useState('');
  const [showEditStopConditions, setShowEditStopConditions] = useState(false);

  // Research 编辑 state
  const [editResearchSymbol, setEditResearchSymbol] = useState('');
  const [editResearchSymbolSearch, setEditResearchSymbolSearch] = useState('');
  const [editResearchDepth, setEditResearchDepth] = useState<'quick' | 'standard' | 'deep'>('standard');

  // 搜索过滤
  const filteredEditGridCoins = useMemo(() => {
    if (!editGridCoinSearch) return GRID_COINS;
    const q = editGridCoinSearch.toUpperCase();
    return ALL_COIN_NAMES.filter((c) => c.includes(q));
  }, [editGridCoinSearch]);
  const filteredEditCoins = useMemo(() => {
    if (!editCoinSearch) return ALL_COIN_NAMES.slice(0, 8);
    const q = editCoinSearch.toUpperCase();
    return ALL_COIN_NAMES.filter((c) => c.includes(q));
  }, [editCoinSearch]);
  const filteredEditResearchSymbols = useMemo(() => {
    if (!editResearchSymbolSearch) return ALL_COIN_NAMES.slice(0, 10);
    const q = editResearchSymbolSearch.toUpperCase();
    return ALL_COIN_NAMES.filter((c) => c.includes(q));
  }, [editResearchSymbolSearch]);

  // strategyId 变化时重置日志分页
  useEffect(() => {
    setLogsPage(1);
    setAllLogs([]);
  }, [strategyId]);

  // Data fetching
  const { data: detail, isLoading: detailLoading } = useStrategyDetail(strategyId);
  const { data: logsData, isLoading: logsLoading } = useStrategyLogs(strategyId, logsPage, 20);
  const { decisions: liveDecisions, connected: wsConnected } = useDecisionStream(strategyId);

  const daysMap: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, 'all': 365 };
  const chartDays = daysMap[timeFilter] || 7;
  const { data: pnlChart } = useStrategyPnlChart(strategyId, chartDays);

  const strategyControl = useStrategyControl();
  const hotUpdateConfig = useHotUpdateConfig();
  const updateStrategy = useUpdateStrategy();
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

  // 日志计算（必须在 early return 之前，避免 hooks 顺序变化）
  const logs = (() => {
    if (!logsData) return allLogs;
    if (logsPage === 1) return logsData.data;
    const existingIds = new Set(allLogs.map((l) => l.id));
    const newLogs = logsData.data.filter((l) => !existingIds.has(l.id));
    return [...allLogs, ...newLogs];
  })();
  const canLoadMoreLogs = logsData && logsData.pagination.page < logsData.pagination.totalPages;
  const logsTotal = logsData?.pagination.total ?? logs.length;

  const handleLoadMoreLogs = useCallback(() => {
    setAllLogs(logs);
    setLogsPage((p) => p + 1);
  }, [logs]);

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
      if (process.env.NODE_ENV === 'development') {
        console.error('暂停失败:', error);
      }
    }
  };

  const handleStop = async () => {
    if (!strategyId) return;
    try {
      await strategyControl.mutateAsync({ id: strategyId, action: 'stop' });
      setShowStopModal(false);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('停止失败:', error);
      }
    }
  };

  // 手动触发一次分析周期
  const handleTriggerCycle = async () => {
    if (!strategyId) return;
    try {
      const result = await triggerCycle.mutateAsync(strategyId);
      toast.success(`${t('detail.analyzed', { count: result.cycle.analyzed, executed: result.cycle.executed })} $${result.cycle.totalCost.toFixed(4)}`);
    } catch (err: unknown) {
      const rawMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err instanceof Error ? err.message : '');
      toast.error(translateErrorForDisplay(rawMsg, te));
    }
  };

  // 进入编辑模式 — 从当前策略配置填充表单
  const enterEditMode = () => {
    setEditName(strategy?.name || '');
    if (strategy?.strategyType === 'grid' && strategy.gridConfig) {
      // Grid 策略加载 gridConfig
      const gc = strategy.gridConfig as GridConfig;
      setEditGridInvestment(gc.totalInvestment || 1000);
      setEditGridLeverage(gc.leverage || 1);
      setEditGridCount(gc.gridCount || 10);
      setEditGridMaxDrawdown(gc.maxDrawdownPct || 15);
      setEditGridStopLoss(gc.stopLossPct || 5);
      setEditGridDailyLossLimit(gc.dailyLossLimitPct || 0);
      setEditGridAutoAdjustThreshold(gc.autoAdjustThreshold != null ? Math.round(gc.autoAdjustThreshold * 100) : 20);
      setEditGridEnableDirectionAdjust(gc.enableDirectionAdjust ?? false);
      setEditGridDirectionBiasRatio(gc.directionBiasRatio != null ? Math.round(gc.directionBiasRatio * 100) : 70);
      setEditGridInterval(strategy?.intervalMinutes || 60);
      // 优先用用户手动配置的边界（gc.upperBound/lowerBound），不读 AI 运行时范围
      // 避免：用户设 0（公式自动）→ 跑完写入 gridState → 重新打开显示 10%
      if (gc.upperBound && gc.lowerBound) {
        const midPrice = (Number(gc.upperBound) + Number(gc.lowerBound)) / 2;
        setEditGridUpperPct(Math.round((Number(gc.upperBound) / midPrice - 1) * 100));
        setEditGridLowerPct(Math.round((1 - Number(gc.lowerBound) / midPrice) * 100));
        setEditGridCurrentPrice(midPrice);
      } else {
        // 用户未配置上下界 → 公式自动计算，显示 0
        setEditGridUpperPct(0);
        setEditGridLowerPct(0);
      }
      // 获取实时价格
      const rawSymbol = gc.symbol?.split('/')[0] || 'BTC';
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';
      fetch(`${apiBase}/market/price?symbol=${rawSymbol}USDT`)
        .then(r => r.json())
        .then(d => { const p = parseFloat(d.data?.price); if (p > 0) setEditGridCurrentPrice(p); })
        .catch(() => {});
      setEditGridModel((strategy.models && strategy.models[0]) || strategy.quickModel || 'deepseek-chat');
      setEditGridCoinSearch('');
      setShowEditGridModelDropdown(false);
      setEditExchangeApiKeyId(strategy.exchangeApiKeyId || null);
      const rawGridSymbol = (strategy.gridConfig as GridConfig)?.symbol || '';
      setEditGridSymbol(rawGridSymbol.split('/')[0] || 'BTC');
      // Grid 止停条件
      setEditMaxCycles(strategy.stopConditions?.maxCycles ?? 0);
      setEditProfitTarget(strategy.stopConditions?.profitTargetPercent ?? 0);
      setEditMaxLoss(strategy.stopConditions?.maxLossPercent ?? 0);
    } else {
      // 非 Grid 策略加载通用配置
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
      // 高级风控 + 止停条件
      setEditMinConfidence(rc.minConfidence ?? 0);
      setEditMinRR(rc.minRiskRewardRatio ?? 0);
      setEditMinPositionSize(rc.minPositionSize ?? 0);
      setEditMaxCycles(strategy.stopConditions?.maxCycles ?? 0);
      setEditProfitTarget(strategy.stopConditions?.profitTargetPercent ?? 0);
      setEditMaxLoss(strategy.stopConditions?.maxLossPercent ?? 0);
      // Debate 模型 + 配置
      setEditDebateModels(strategy.models && strategy.models.length > 0 ? strategy.models : [...DEFAULT_DEBATE_MODELS]);
      setEditDebateMaxRounds(strategy.debateConfig?.maxRounds ?? 3);
      setEditDebateTemperature(strategy.debateConfig?.temperature ?? 0.7);
      // Solo 模型
      setEditSoloModel(strategy.quickModel || (strategy.models && strategy.models[0]) || 'deepseek-chat');
      setShowEditSoloModelDropdown(false);
      setShowEditDebateModelDropdown(false);
      setShowEditExcluded(false);
      // 交易所
      setEditExchangeApiKeyId(strategy.exchangeApiKeyId || null);
      setEditCoinSearch('');
      // Research 字段
      setEditResearchSymbolSearch('');
      if (strategy.tradingMode === 'research') {
        const researchSymbol = cc.coins?.[0] || '';
        setEditResearchSymbol(researchSymbol);
        setEditResearchDepth(((strategy as unknown as Record<string, unknown>).depth as 'quick' | 'standard' | 'deep') || 'standard');
      }
    }
    setIsEditing(true);
  };

  // 保存编辑 — 运行中用 hotUpdate, 停止用 updateStrategy
  const handleSaveEdit = async () => {
    if (!strategyId || !strategy) return;
    let body: Record<string, unknown>;
    if (strategy.strategyType === 'grid') {
      // Grid 策略：提交 gridConfig + intervalMinutes
      body = {
        ...(editName.trim() && editName.trim() !== strategy.name ? { name: editName.trim() } : {}),
        gridConfig: {
          ...(strategy.gridConfig as GridConfig),
          symbol: editGridSymbol ? `${editGridSymbol}/USDT:USDT` : (strategy.gridConfig as GridConfig)?.symbol,
          totalInvestment: editGridInvestment,
          leverage: editGridLeverage,
          gridCount: editGridCount,
          maxDrawdownPct: editGridMaxDrawdown,
          stopLossPct: editGridStopLoss,
          dailyLossLimitPct: editGridDailyLossLimit || 0,
          autoAdjustThreshold: (editGridAutoAdjustThreshold || 20) / 100,
          enableDirectionAdjust: editGridEnableDirectionAdjust,
          directionBiasRatio: (editGridDirectionBiasRatio || 70) / 100,
          // 百分比 → 绝对价格；留空(0) → undefined → 后端保持原配置或 AI 决策
          upperBound: (editGridCurrentPrice > 0 && editGridUpperPct > 0)
            ? +(editGridCurrentPrice * (1 + editGridUpperPct / 100)).toFixed(6) : undefined,
          lowerBound: (editGridCurrentPrice > 0 && editGridLowerPct > 0)
            ? +(editGridCurrentPrice * (1 - editGridLowerPct / 100)).toFixed(6) : undefined,
        },
        models: [editGridModel],
        intervalMinutes: editGridInterval,
        ...(editExchangeApiKeyId && { exchangeApiKeyId: editExchangeApiKeyId }),
        stopConditions: {
          maxCycles: editMaxCycles || undefined,
          profitTargetPercent: editProfitTarget || undefined,
          maxLossPercent: editMaxLoss || undefined,
        },
        riskControlConfig: {
          ...(strategy.riskControlConfig as unknown as Record<string, unknown> || {}),
        },
      };
    } else {
      // 非 Grid：提交通用 coinSourceConfig + riskControlConfig + promptSections
      body = {
        ...(editName.trim() && editName.trim() !== strategy.name ? { name: editName.trim() } : {}),
        coinSourceConfig: {
          mode: editCoinMode,
          coins: strategy.tradingMode === 'research'
            ? (editResearchSymbol ? [editResearchSymbol] : undefined)
            : (editCoinMode === 'static' || editCoinMode === 'mixed' ? editCoins : undefined),
          maxCoins: editCoinMode !== 'static' ? editMaxCoins : undefined,
          excludedCoins: strategy.tradingMode !== 'research' && editExcludedCoins.length > 0 ? editExcludedCoins : undefined,
        },
        riskControlConfig: {
          maxLeverage: editMaxLeverage,
          maxPositions: strategy?.riskControlConfig?.maxPositions,
          maxDailyDrawdown: editMaxDailyDrawdown,
          maxDailyTrades: editMaxDailyTrades,
          cooldownMinutes: editCooldownMinutes,
          allocatedCapital: editAllocatedCapital,
          circuitBreaker: strategy?.riskControlConfig?.circuitBreaker,
          btcEthMaxPositionValueRatio: strategy?.riskControlConfig?.btcEthMaxPositionValueRatio,
          altcoinMaxPositionValueRatio: strategy?.riskControlConfig?.altcoinMaxPositionValueRatio,
          btcEthMaxLeverage: strategy?.riskControlConfig?.btcEthMaxLeverage,
          altcoinMaxLeverage: strategy?.riskControlConfig?.altcoinMaxLeverage,
          minRiskRewardRatio: editMinRR || undefined,
          minConfidence: editMinConfidence || undefined,
          minPositionSize: editMinPositionSize || undefined,
          maxMarginUsage: strategy?.riskControlConfig?.maxMarginUsage,
        },
        promptSections: {
          role: editPromptRole || undefined,
          mode: editPromptMode,
          custom: editPromptCustom || undefined,
          tradingFrequency: editPromptTradingFrequency || undefined,
          entryStandards: editPromptEntryStandards || undefined,
        },
        intervalMinutes: editInterval,
        stopConditions: {
          maxCycles: editMaxCycles || undefined,
          profitTargetPercent: editProfitTarget || undefined,
          maxLossPercent: editMaxLoss || undefined,
        },
        ...(strategy.tradingMode === 'debate' ? {
          models: editDebateModels,
          debateConfig: {
            maxRounds: editDebateMaxRounds,
            riskRounds: editDebateMaxRounds,
            temperature: editDebateTemperature,
          },
        } : strategy.tradingMode === 'solo' ? {
          models: [editSoloModel],
        } : strategy.tradingMode === 'research' ? {
          models: [editSoloModel],
        } : {}),
        ...(editExchangeApiKeyId && { exchangeApiKeyId: editExchangeApiKeyId }),
      };
    }
    try {
      if (strategy.isActive) {
        await hotUpdateConfig.mutateAsync({ id: strategyId, body });
      } else {
        await updateStrategy.mutateAsync({ id: strategyId, body });
      }
      toast.success(t('detail.editSave'));
      setIsEditing(false);
    } catch (err: unknown) {
      const rawMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err instanceof Error ? err.message : '');
      toast.error(translateErrorForDisplay(rawMsg, te));
    }
  };

  const isSaving = hotUpdateConfig.isPending || updateStrategy.isPending;

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
  // 统一风控暂停检测
  const gridRuntimeState = (strategy as unknown as Record<string, unknown>).gridRuntimeState as { isPaused?: boolean; pauseSource?: string; pauseReason?: string } | null;
  const riskConfigRaw = (strategy as unknown as Record<string, unknown>).riskControlConfig as { _riskPause?: { source?: string; reason?: string; pausedAt?: string } } | null;
  // Grid: gridRuntimeState.isPaused + pauseSource === 'risk_control'
  const isGridRiskPaused = !!(gridRuntimeState?.isPaused && gridRuntimeState?.pauseSource === 'risk_control');
  // Solo/Debate: riskControlConfig._riskPause
  const isSoloDebateRiskPaused = !!riskConfigRaw?._riskPause;
  const isRiskControlPaused = isGridRiskPaused || isSoloDebateRiskPaused;
  const riskPauseReason = isGridRiskPaused ? gridRuntimeState?.pauseReason : riskConfigRaw?._riskPause?.reason;
  const coinSourceConfig = strategy.coinSourceConfig;
  const riskControlConfig = strategy.riskControlConfig;
  const symbols = coinSourceConfig?.coins || [];
  const maxLeverage = riskControlConfig?.maxLeverage || '—';
  const maxPositions = riskControlConfig?.maxPositions || 3;
  const maxDrawdown = riskControlConfig?.maxDailyDrawdown
    ? `$${Number(riskControlConfig.maxDailyDrawdown).toLocaleString()}`
    : '—';

  const pnlHistory = pnlChart?.dataPoints || [];

  // Today stats calculation (approximate from logs)
  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.createdAt);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  });
  const todayTrades = todayLogs.filter(log => log.executed).length;
  const todayWins = todayLogs.filter(log => log.executed && log.decision?.action?.includes('close')).length;
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
                if (isRiskControlPaused) {
                  setShowResumeGridModal(true);
                  return;
                }
                try {
                  await strategyControl.mutateAsync({ id: strategyId, action: 'start' });
                } catch (err: unknown) {
                  toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('common.failed'));
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


        {/* Tab 栏 */}
        <div className="flex items-center border-b border-[#1E1E2E]">
          {[
            { key: "overview", label: t('detail.overviewTab') },
            { key: "config", label: t('detail.configTab') },
            { key: "decisions", label: t('wizard.decisionsTab') },
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

      {/* 风控暂停提示卡 */}
      {isRiskControlPaused && (
        <div className="mx-4 mt-3 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl">
          <div className="flex items-start gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-[#EF4444] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#EF4444] font-medium">{t('detail.gridRiskPaused')}</p>
              {riskPauseReason?.split('\n').map((line, i) => (
                <p key={i} className={`text-[11px] mt-0.5 ${i === 0 ? 'text-[#EF4444]/80 font-medium' : 'text-[#9090A0]'}`}>{line}</p>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowResumeGridModal(true)}
            className="w-full py-2 text-xs font-medium bg-[#EF4444]/15 text-[#EF4444] rounded-lg hover:bg-[#EF4444]/25 active:opacity-70 transition-colors"
          >
            {t('detail.gridResumeTrading')}
          </button>
        </div>
      )}

      {/* Tab 内容 */}
      <main className="pb-6">
        {/* Tab 1: 概览 */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* 模式说明 */}
            {(() => {
              const effectiveMode = strategy.strategyType === 'grid' ? 'grid' : strategy.tradingMode;
              const modeInfo = getTradingModeInfo(t)[effectiveMode];
              if (!modeInfo) return null;
              return (
                <div className="mx-4 mt-4 glass-border-glow glass-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: modeInfo.bg }}
                    >
                      <modeInfo.Icon className="w-4 h-4" style={{ color: modeInfo.color }} />
                    </span>
                    <span className="text-sm font-semibold" style={{ color: modeInfo.color }}>
                      {modeInfo.title}
                    </span>
                  </div>
                  <p className="text-xs text-[#9090A0] leading-relaxed mb-2">
                    {modeInfo.description}
                  </p>
                  {/* 模型图标列表（优先 strategy.models，fallback quickModel，fallback coinSourceConfig.models） */}
                  {(() => {
                    const modelList: string[] =
                      (strategy.models && strategy.models.length > 0 ? strategy.models : null)
                      || (strategy.quickModel ? [strategy.quickModel] : null)
                      || (strategy.coinSourceConfig?.models as string[])
                      || [];
                    if (modelList.length === 0) return null;
                    return (
                      <div className="flex items-center gap-1.5 mb-2">
                        {modelList.map((m: string) => {
                          const info = MODEL_DISPLAY[m];
                          const logo = info?.logo;
                          const name = info?.name || m;
                          return logo ? (
                            <img key={m} src={logo} alt={name} title={name} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <span key={m} title={name} className="w-6 h-6 rounded-full bg-[#1E1E2E] flex items-center justify-center text-[10px] text-[#9090A0]">
                              {name.charAt(0)}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div className="pt-2 border-t border-[#1E1E2E]">
                    <p className="text-xs text-[#606070]">
                      {buildConfigSummary(effectiveMode, strategy, t)}
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
            <div className="mx-4 glass-border-glow glass-card p-4">
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
            <div className="mx-4 glass-border-glow glass-card p-4">
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
            {/* 实时决策流 */}
            {liveDecisions.length > 0 && (
              <div className="mx-4 mt-4 bg-[#12121A] rounded-xl border border-[#06B6D4]/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-[#06B6D4] opacity-75" />
                    <span className="relative rounded-full h-2 w-2 bg-[#06B6D4]" />
                  </span>
                  <h3 className="text-sm font-semibold">{t('detail.liveDecisions')}</h3>
                  <span className="text-[10px] text-[#606070]">({liveDecisions.length})</span>
                </div>
                <div className="space-y-0">
                  {liveDecisions.map((d, idx) => (
                    <LiveDecisionRow
                      key={`${d.symbol}-${d.timestamp}-${idx}`}
                      decision={d}
                      isLast={idx === liveDecisions.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 历史决策 */}
            <div className="mx-4 mt-4 glass-border-glow glass-card p-4">
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
                <>
                  <div className="space-y-0">
                    {logs.map((log, idx) => (
                      <RecentDecisionRow
                        key={log.id}
                        log={log}
                        tradingMode={strategy.strategyType === 'grid' ? 'grid' : strategy.tradingMode}
                        onViewVotes={() => setVoteSheetLog(log)}
                        isLast={idx === logs.length - 1}
                      />
                    ))}
                  </div>
                  {/* 加载更多 / 已加载全部 */}
                  <div className="mt-3">
                    {canLoadMoreLogs ? (
                      <button
                        type="button"
                        onClick={handleLoadMoreLogs}
                        disabled={logsLoading}
                        className="w-full py-2.5 text-xs text-[#06B6D4] hover:text-[#0891B2] glass-border-glow glass-card hover:border-[#06B6D4]/30 transition-all flex items-center justify-center gap-2"
                      >
                        {logsLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {t('common.loading')}
                          </>
                        ) : (
                          `${t('common.loadMore')} (${logs.length}/${logsTotal})`
                        )}
                      </button>
                    ) : (
                      <div className="text-center text-[10px] text-[#606070] py-2">
                        {t('timeline.loadedAll')} ({logs.length}/{logsTotal})
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: 配置 */}
        {activeTab === "config" && (
          <div className={`p-4 space-y-4 ${isEditing ? 'pb-20' : ''}`}>
            {!isEditing ? (
              /* ── 阅读模式 ── */
              <>
                <div className="glass-border-glow glass-card p-4">
                  <h3 className="text-sm font-semibold mb-1">{t('detail.currentConfig')}</h3>
                  <div>
                    <ConfigRow label={t('detail.configStrategyType')} value={strategy.strategyType === 'grid' ? t('detail.gridTrading') : t('detail.normalStrategy')} />
                    {/* 交易所账户 */}
                    {strategy.exchangeApiKeyId && (
                      <ConfigRow
                        label={t('create.exchangeAccount')}
                        value={
                          detail?.exchangeLabel
                            ? `${detail.exchangeLabel}${detail.exchangeName ? ` · ${detail.exchangeName}` : ''}`
                            : detail?.exchangeName ?? strategy.exchangeApiKeyId.slice(0, 8) + '...'
                        }
                      />
                    )}

                    {/* Grid 策略配置 */}
                    {strategy.strategyType === 'grid' ? (
                      (() => {
                        const gc = (strategy.gridConfig ?? {}) as Record<string, any>;
                        return <>
                        <ConfigRow label={t('detail.configTradingPair')} value={gc.symbol || '—'} />
                        <ConfigRow label={t('detail.configInvestment')} value={`$${gc.totalInvestment?.toLocaleString() || '—'}`} />
                        <ConfigRow label={t('detail.configLeverage')} value={`${gc.leverage || 1}x`} />
                        <ConfigRow label={t('detail.configGridCount')} value={gc.gridCount || '—'} />
                        <ConfigRow label={t('detail.configPriceBounds')} value={(() => {
                          const lo = detail?.gridState?.lowerPrice ? Number(detail.gridState.lowerPrice) : null;
                          const hi = detail?.gridState?.upperPrice ? Number(detail.gridState.upperPrice) : null;
                          if (lo && hi && lo > 0 && hi > 0) {
                            const halfRangePct = ((hi - lo) / (hi + lo)) * 100;
                            return `$${lo.toFixed(2)} ~ $${hi.toFixed(2)} · ±${halfRangePct.toFixed(1)}%`;
                          }
                          if (!gc.useAtrBounds && gc.lowerBound && gc.upperBound) {
                            return `$${gc.lowerBound} ~ $${gc.upperBound}`;
                          }
                          return t('detail.autoRange') || '自动（等待初始化）';
                        })()} />
                        <ConfigRow label={t('detail.configMaxDrawdown')} value={`${gc.maxDrawdownPct || 15}%`} />
                        <ConfigRow label={t('detail.configStopLoss')} value={`${gc.stopLossPct || 5}%`} />
                        <ConfigRow label={t('detail.configDailyLossLimit')} value={gc.dailyLossLimitPct ? `${gc.dailyLossLimitPct}%` : '不限'} />
                        {detail.gridState && (
                          <div className="mt-3 pt-1 border-t border-[#1E1E2E]">
                            <p className="text-sm text-[#10B981] font-medium py-2">{t('detail.gridStatus')}</p>
                            <ConfigRow label={t('detail.activeOrders')} value={detail.gridState.activeOrders} />
                            <ConfigRow label={t('detail.filledOrders')} value={detail.gridState.filledOrders} />
                            <ConfigRow label={t('detail.gridLevels')} value={detail.gridState.gridLevels} />
                            {detail.gridState.upperPrice && detail.gridState.lowerPrice && (
                              <ConfigRow label={t('detail.configActualRange')} value={`${Number(detail.gridState.lowerPrice).toFixed(2)} - ${Number(detail.gridState.upperPrice).toFixed(2)}`} />
                            )}
                            {detail.gridState.gridSpacing && (
                              <ConfigRow label={t('detail.gridSpacing')} value={`$${detail.gridState.gridSpacing.toFixed(2)}`} />
                            )}
                            <ConfigRow label={t('detail.gridInitialized')} value={detail.gridState.isInitialized ? t('common.yes') : t('common.no')} />
                            {detail.gridState.isPaused && (
                              <ConfigRow label="暂停原因" value={detail.gridState.pauseReason || `已暂停 [${detail.gridState.pauseSource ?? '未知'}]`} />
                            )}
                          </div>
                        )}
                        {/* LLM 模型 */}
                        <ConfigRow
                          label="LLM"
                          value={MODEL_DISPLAY[(strategy.models?.[0]) as keyof typeof MODEL_DISPLAY]?.name
                            || strategy.quickModel || '—'}
                        />
                        {/* 执行间隔 */}
                        <ConfigRow label={t('detail.executionCycle')} value={`${strategy.intervalMinutes} ${t('common.min')}`} />
                        {/* 止停条件 */}
                        {!!(strategy.stopConditions?.maxCycles || strategy.stopConditions?.profitTargetPercent || strategy.stopConditions?.maxLossPercent) && (
                          <>
                            <div className="pt-1 border-t border-[#1E1E2E]">
                              <p className="text-xs text-[#606070] font-medium">{t('create.stopConditions')}</p>
                            </div>
                            {!!strategy.stopConditions?.maxCycles && (
                              <ConfigRow label={t('create.maxCycles')} value={`${strategy.stopConditions.maxCycles} ${t('common.times')}`} />
                            )}
                            {!!strategy.stopConditions?.profitTargetPercent && (
                              <ConfigRow label={t('create.profitTarget')} value={`${strategy.stopConditions.profitTargetPercent}%`} />
                            )}
                            {!!strategy.stopConditions?.maxLossPercent && (
                              <ConfigRow label={t('create.maxLoss')} value={`${strategy.stopConditions.maxLossPercent}%`} />
                            )}
                          </>
                        )}
                      </>;
                      })()
                    ) : (
                      <>
                    <ConfigRow label={t('detail.configTradingMode')} value={strategy.tradingMode === 'solo' ? t('detail.soloMode') : strategy.tradingMode === 'debate' ? t('detail.debateMode') : strategy.tradingMode === 'grid' ? t('detail.gridMode') : strategy.tradingMode === 'research' ? t('detail.researchMode') : strategy.tradingMode} />
                    {/* Solo 模型展示 */}
                    {strategy.tradingMode === 'solo' && (
                      <ConfigRow
                        label="LLM"
                        value={MODEL_DISPLAY[strategy.quickModel as keyof typeof MODEL_DISPLAY]?.name
                          || MODEL_DISPLAY[(strategy.models?.[0]) as keyof typeof MODEL_DISPLAY]?.name
                          || strategy.quickModel || '—'}
                      />
                    )}
                    {/* Research 模型 + 深度展示 */}
                    {strategy.tradingMode === 'research' && (
                      <>
                        <ConfigRow
                          label="LLM"
                          value={MODEL_DISPLAY[strategy.quickModel as keyof typeof MODEL_DISPLAY]?.name
                            || MODEL_DISPLAY[(strategy.models?.[0]) as keyof typeof MODEL_DISPLAY]?.name
                            || strategy.quickModel || '—'}
                        />
                        <ConfigRow
                          label={t('create.researchDepth')}
                          value={((strategy as unknown as Record<string, unknown>).depth === 'quick' ? t('create.quick')
                            : (strategy as unknown as Record<string, unknown>).depth === 'deep' ? t('create.deep')
                            : t('create.standard'))}
                        />
                      </>
                    )}
                    {/* Debate 模型展示 */}
                    {strategy.tradingMode === 'debate' && strategy.models && strategy.models.length > 0 && (
                      <div className="flex items-start gap-3 py-2.5 border-b border-[#1A1A24]">
                        <span className="text-sm text-[#9090A0] w-[36%] shrink-0 leading-normal">{t('detail.editDebateModels')}</span>
                        <div className="flex flex-wrap gap-1">
                          {strategy.models.map((m: string) => {
                            const info = MODEL_DISPLAY[m as keyof typeof MODEL_DISPLAY];
                            return (
                              <span key={m} className="px-2 py-0.5 text-xs font-medium bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30 rounded">
                                {info?.name || m}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* debateConfig 展示 */}
                    {strategy.tradingMode === 'debate' && strategy.debateConfig && (
                      <>
                        {strategy.debateConfig.maxRounds && (
                          <ConfigRow label={t('detail.editDebateMaxRounds')} value={strategy.debateConfig.maxRounds} />
                        )}
                        {strategy.debateConfig.temperature && (
                          <ConfigRow label={t('detail.editDebateTemperature')} value={strategy.debateConfig.temperature} />
                        )}
                      </>
                    )}
                    <ConfigRow label={t('detail.coinSource')} value={coinSourceConfig?.mode === 'static' ? t('detail.coinSourceManual') : coinSourceConfig?.mode === 'ai' ? t('detail.coinSourceAI') : coinSourceConfig?.mode === 'oi_top' ? t('detail.coinSourceOIHigh') : coinSourceConfig?.mode === 'oi_low' ? t('detail.coinSourceOILow') : coinSourceConfig?.mode === 'mixed' ? t('detail.coinSourceMixed') : '—'} />
                    <div className="flex items-start gap-3 py-2.5 border-b border-[#1A1A24]">
                      <span className="text-sm text-[#9090A0] w-[36%] shrink-0 leading-normal">{t('detail.tradingCoins')}</span>
                      <div className="flex flex-wrap gap-1">
                        {symbols.length > 0 ? symbols.map((s: string) => (
                          <span key={s} className="px-2 py-0.5 text-xs font-medium bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30 rounded">{s.split('/')[0]}</span>
                        )) : <span className="text-sm text-[#606070]">{t('common.notConfigured')}</span>}
                      </div>
                    </div>
                    {coinSourceConfig?.maxCoins && (
                      <ConfigRow label={t('detail.maxCoins')} value={coinSourceConfig.maxCoins} />
                    )}
                    {(coinSourceConfig?.excludedCoins?.length ?? 0) > 0 && (
                      <div className="flex items-start gap-3 py-2.5 border-b border-[#1A1A24]">
                        <span className="text-sm text-[#9090A0] w-[36%] shrink-0 leading-normal">{t('detail.excludeCoins')}</span>
                        <div className="flex flex-wrap gap-1">
                          {coinSourceConfig?.excludedCoins?.map((s: string) => (
                            <span key={s} className="px-2 py-0.5 text-xs font-medium bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded">{s.split('/')[0]}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <ConfigRow label={t('detail.allocatedCapital')} value={riskControlConfig?.allocatedCapital ? `$${Number(riskControlConfig.allocatedCapital).toLocaleString()}` : '—'} />
                    <ConfigRow label={t('detail.maxLeverage')} value={`${maxLeverage}x`} />
                    <ConfigRow label={t('detail.maxPositions')} value={maxPositions} />
                    <ConfigRow label={t('detail.editDailyDrawdown')} value={maxDrawdown} />
                    <ConfigRow label={t('detail.maxDailyTrades')} value={riskControlConfig?.maxDailyTrades || '—'} />
                    <ConfigRow label={t('detail.cooldownTime')} value={riskControlConfig?.cooldownMinutes ? `${riskControlConfig.cooldownMinutes}min` : '—'} />
                    {/* 高级风控字段（有值时显示） */}
                    {riskControlConfig?.btcEthMaxLeverage && (
                      <ConfigRow label={t('detail.btcEthMaxLeverage')} value={`${riskControlConfig.btcEthMaxLeverage}x`} />
                    )}
                    {riskControlConfig?.altcoinMaxLeverage && (
                      <ConfigRow label={t('detail.altcoinMaxLeverage')} value={`${riskControlConfig.altcoinMaxLeverage}x`} />
                    )}
                    {riskControlConfig?.minRiskRewardRatio && (
                      <ConfigRow label={t('detail.minRiskRewardRatio')} value={`${riskControlConfig.minRiskRewardRatio}:1`} />
                    )}
                    {riskControlConfig?.minConfidence && (
                      <ConfigRow label={t('detail.minConfidence')} value={`${riskControlConfig.minConfidence}%`} />
                    )}
                    {riskControlConfig?.minPositionSize && (
                      <ConfigRow label={t('detail.minPositionSize')} value={`$${riskControlConfig.minPositionSize}`} />
                    )}
                      <ConfigRow label={t('detail.executionCycle')} value={`${strategy.intervalMinutes} ${t('common.min')}`} />
                      {/* 止停条件（有值时显示） */}
                      {!!(strategy.stopConditions?.maxCycles || strategy.stopConditions?.profitTargetPercent || strategy.stopConditions?.maxLossPercent) && (
                        <>
                          <div className="pt-1 border-t border-[#1E1E2E]">
                            <p className="text-xs text-[#606070] font-medium">止停条件</p>
                          </div>
                          {!!strategy.stopConditions?.maxCycles && (
                            <ConfigRow label="最大周期" value={`${strategy.stopConditions.maxCycles} 次`} />
                          )}
                          {!!strategy.stopConditions?.profitTargetPercent && (
                            <ConfigRow label="盈利目标" value={`${strategy.stopConditions.profitTargetPercent}%`} />
                          )}
                          {!!strategy.stopConditions?.maxLossPercent && (
                            <ConfigRow label="最大止损" value={`${strategy.stopConditions.maxLossPercent}%`} />
                          )}
                        </>
                      )}
                      </>
                    )}
                  </div>
                </div>

                {/* Prompt 配置（仅 Solo/Debate 显示，Research 和 Grid 无 Prompt） */}
                {strategy.promptSections && strategy.tradingMode !== 'research' && strategy.strategyType !== 'grid' && (
                  <div className="glass-border-glow glass-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold mb-3">{t('detail.promptConfig')}</h3>
                    <div className="space-y-2.5">
                      <ConfigRow label={t('detail.editTradingStyle')} value={strategy.promptSections.mode === 'aggressive' ? t('detail.promptAggressive') : strategy.promptSections.mode === 'scalping' ? t('detail.promptScalping') : t('detail.promptConservative')} />
                      {strategy.promptSections.role && (
                        <div>
                          <p className="text-xs text-[#606070] mb-1">{t('detail.roleDefinition')}</p>
                          <div className="pl-2 border-l-2 border-[#1E1E2E]">
                            <TruncatedText text={strategy.promptSections.role} maxLines={3} />
                          </div>
                        </div>
                      )}
                      {strategy.promptSections.tradingFrequency && (
                        <div>
                          <p className="text-xs text-[#606070] mb-1">{t('detail.tradingFrequency')}</p>
                          <div className="pl-2 border-l-2 border-[#1E1E2E]">
                            <TruncatedText text={strategy.promptSections.tradingFrequency} maxLines={3} />
                          </div>
                        </div>
                      )}
                      {strategy.promptSections.entryStandards && (
                        <div>
                          <p className="text-xs text-[#606070] mb-1">{t('detail.entryStandards')}</p>
                          <div className="pl-2 border-l-2 border-[#1E1E2E]">
                            <TruncatedText text={strategy.promptSections.entryStandards} maxLines={3} />
                          </div>
                        </div>
                      )}
                      {strategy.promptSections.custom && (
                        <div>
                          <p className="text-xs text-[#606070] mb-1">{t('detail.decisionProcess')}</p>
                          <div className="pl-2 border-l-2 border-[#1E1E2E]">
                            <TruncatedText text={strategy.promptSections.custom} maxLines={3} />
                          </div>
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
                {/* 策略名称（所有策略类型通用） */}
                <div className="space-y-2">
                  <label className="block text-sm text-[#9090A0]">{t('create.strategyName')}</label>
                  <input
                    type="text"
                    placeholder={t('create.strategyNamePlaceholder')}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#12121A] border border-[#1E1E2E] rounded-xl text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4] transition-colors"
                    aria-label={t('create.strategyName')}
                  />
                </div>

                {strategy.strategyType === 'grid' ? (
                  /* ── Grid 专属编辑 ── */
                  <>
                    {/* 交易所选择 */}
                    <ExchangeKeySelector
                      value={editExchangeApiKeyId}
                      onChange={setEditExchangeApiKeyId}
                      label={t('create.exchangeAccount')}
                    />

                    {/* 卡片 1: 网格参数 */}
                    <div className="glass-border-glow glass-card p-4 space-y-3">
                      <h3 className="text-sm font-semibold">{t('detail.editGridParams')}</h3>

                      {/* 交易对（Tag-input + 搜索，与创建表单一致） */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs text-[#9090A0]">{t('detail.symbol')}</label>
                          <span className="text-[10px] text-[#606070]">⚠ 网格仅支持单一交易对</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl min-h-[40px]">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs font-medium">
                            {editGridSymbol}
                          </span>
                          <div className="flex items-center flex-1 min-w-[100px]">
                            <Search className="w-3.5 h-3.5 text-[#606070] mr-1.5 flex-shrink-0" />
                            <input
                              type="text"
                              value={editGridCoinSearch}
                              onChange={(e) => setEditGridCoinSearch(e.target.value)}
                              placeholder="搜索更多..."
                              className="flex-1 bg-transparent text-sm text-[#F8F8FC] placeholder:text-[#606070] outline-none min-w-0"
                            />
                          </div>
                        </div>
                        {!editGridCoinSearch && <div className="text-[10px] text-[#606070]">{t('create.popular')}</div>}
                        <div className="flex flex-wrap gap-1.5">
                          {filteredEditGridCoins.map((coin) => (
                            <button key={coin} type="button"
                              onClick={() => { setEditGridSymbol(coin); setEditGridCoinSearch(''); }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                editGridSymbol === coin ? 'bg-[#06B6D4] text-black' : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                              }`}
                              aria-label={coin} title={coin}
                            >{coin}</button>
                          ))}
                        </div>
                      </div>

                      <NumberStepper label={t('detail.editGridInvestment')} value={editGridInvestment} min={100} max={50000} step={100} prefix="$" onChange={setEditGridInvestment} />

                      {/* 杠杆 + 网格层数 — 两列输入 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <p className="text-xs text-[#9090A0]">{t('detail.editGridLeverage')}</p>
                          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                            <input
                              type="number" min={1} max={20}
                              value={editGridLeverage || ''}
                              onChange={(e) => setEditGridLeverage(e.target.value === '' ? 0 : parseInt(e.target.value))}
                              className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                              aria-label={t('detail.editGridLeverage')}
                            />
                            <span className="text-[#606070] text-xs shrink-0">x</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-[#9090A0]">{t('detail.editGridCount')}</p>
                          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                            <input
                              type="number" min={5} max={100}
                              value={editGridCount || ''}
                              onChange={(e) => setEditGridCount(e.target.value === '' ? 0 : parseInt(e.target.value))}
                              className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                              aria-label={t('detail.editGridCount')}
                            />
                            <span className="text-[#606070] text-xs shrink-0">格</span>
                          </div>
                        </div>
                      </div>

                      {/* 配置后果预览：强平距离、每层保证金、风险等级、推荐 */}
                      {(() => {
                        const safeCount = Math.max(editGridCount, 1);
                        const safeLeverage = Math.max(editGridLeverage, 1);
                        const perLevelMargin = editGridInvestment / safeCount;
                        const liqDropPct = Math.floor((1 / safeLeverage) * 100);

                        const risk = safeLeverage <= 1 ? { label: '安全',   color: '#10B981', bar: 10 }
                          : safeLeverage <= 2           ? { label: '低风险', color: '#22C55E', bar: 25 }
                          : safeLeverage <= 3           ? { label: '中等',   color: '#F59E0B', bar: 50 }
                          : safeLeverage <= 5           ? { label: '较高',   color: '#EF4444', bar: 72 }
                          :                               { label: '高风险', color: '#DC2626', bar: 92 };

                        const rec = editGridInvestment < 300  ? { leverage: 1, count: 5  }
                          : editGridInvestment < 1000         ? { leverage: 2, count: 6  }
                          : editGridInvestment < 3000         ? { leverage: 2, count: 8  }
                          :                                     { leverage: 3, count: 10 };

                        const showRec = safeLeverage > rec.leverage;

                        return (
                          <div className="p-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#9090A0]">
                                每层保证金{' '}
                                <b className="text-[#F8F8FC]">${perLevelMargin.toFixed(0)}</b>
                                <span className="text-[#404060] mx-1.5">·</span>
                                杠杆上限{' '}
                                <b className="text-[#F8F8FC]">{safeLeverage}x</b>
                                <span className="text-[#404060] mx-1">（AI 自动决策）</span>
                              </span>
                              <span className="font-medium" style={{ color: risk.color }}>{risk.label}</span>
                            </div>
                            <div className="h-1 bg-[#1E1E2E] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${risk.bar}%`, backgroundColor: risk.color }}
                              />
                            </div>
                            <p className="text-[11px] text-[#606070]">
                              最差强平距离：跌 <b className="text-[#9090A0]">{liqDropPct}%</b>（AI 用满 {safeLeverage}x 时），实际通常更低
                            </p>
                            {showRec && (
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-[#606070]">
                                  💡 ${editGridInvestment} 建议上限 {rec.leverage}x · {rec.count}格，最差强平 &gt;{Math.floor(100 / rec.leverage)}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() => { setEditGridLeverage(rec.leverage); setEditGridCount(rec.count); }}
                                  className="px-2 py-0.5 rounded bg-[#06B6D4]/15 text-[#06B6D4] hover:bg-[#06B6D4]/25 transition-colors"
                                >
                                  应用
                                </button>
                              </div>
                            )}
                            {/* 可行性检查：极端市场（杠杆被压到 2x）下能运行几格 */}
                            {(() => {
                              const WORST_LEV_CAP = 2   // narrow/volatile regime 杠杆上限
                              const _base = editGridSymbol.split('/')[0].toUpperCase()
                              const MIN_NOTIONAL = _base === 'BTC' ? 100 : _base === 'ETH' ? 20 : 5
                              const effLev = Math.min(safeLeverage, WORST_LEV_CAP)
                              const maxViable = Math.floor((editGridInvestment * effLev) / MIN_NOTIONAL)
                              const idleCount = Math.max(0, editGridCount - maxViable)
                              if (idleCount === 0) return null
                              const minInv = Math.ceil((editGridCount * MIN_NOTIONAL) / effLev)
                              return (
                                <div className="flex items-start gap-1 text-[11px] text-[#F59E0B]">
                                  <span>⚠</span>
                                  <span>
                                    极端市场仅 {maxViable} 格可下单，{idleCount} 格将空转 · 建议资金 ≥ ${minInv}
                                  </span>
                                </div>
                              )
                            })()}
                          </div>
                        );
                      })()}

                      {/* 上偏移 + 下偏移 — 百分比输入 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <p className="text-xs text-[#9090A0]">上偏移</p>
                          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                            <input
                              type="number" min={0} max={50}
                              value={editGridUpperPct || ''}
                              onChange={(e) => setEditGridUpperPct(parseFloat(e.target.value) || 0)}
                              placeholder="公式自动"
                              className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                              aria-label="上偏移百分比"
                            />
                            <span className="text-[#606070] text-xs shrink-0">%</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-[#9090A0]">下偏移</p>
                          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                            <input
                              type="number" min={0} max={50}
                              value={editGridLowerPct || ''}
                              onChange={(e) => setEditGridLowerPct(parseFloat(e.target.value) || 0)}
                              placeholder="公式自动"
                              className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                              aria-label="下偏移百分比"
                            />
                            <span className="text-[#606070] text-xs shrink-0">%</span>
                          </div>
                        </div>
                      </div>
                      {/* 实时换算预览 */}
                      {editGridCurrentPrice > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-[#606070] px-1 -mt-1">
                          {editGridUpperPct > 0 && editGridLowerPct > 0 ? (
                            <>
                              <span>≈ ${(editGridCurrentPrice * (1 - editGridLowerPct / 100)).toFixed(2)}</span>
                              <span>当前: ${editGridCurrentPrice.toFixed(2)}</span>
                              <span>≈ ${(editGridCurrentPrice * (1 + editGridUpperPct / 100)).toFixed(2)}</span>
                            </>
                          ) : (
                            <span>当前价: ${editGridCurrentPrice.toFixed(2)} · 留空则自动计算边界，上下各约 {(3 * editGridCount / 10).toFixed(1)}%，每格间距 0.6%</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 卡片 2: 风控 + 运行参数 */}
                    <div className="glass-border-glow glass-card p-4 space-y-3">
                      <h3 className="text-sm font-semibold">{t('detail.editGridRiskControl')}</h3>

                      {/* 峰值回撤 + 单格止损 — 两列输入 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <p className="text-xs text-[#9090A0]">{t('detail.editGridMaxDrawdown')}</p>
                          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                            <input
                              type="number" min={1} max={100}
                              value={editGridMaxDrawdown || ''}
                              onChange={(e) => setEditGridMaxDrawdown(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                              aria-label={t('detail.editGridMaxDrawdown')}
                            />
                            <span className="text-[#606070] text-xs shrink-0">%</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-[#9090A0]">{t('detail.editGridStopLoss')}</p>
                          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                            <input
                              type="number" min={1} max={100}
                              value={editGridStopLoss || ''}
                              onChange={(e) => setEditGridStopLoss(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                              aria-label={t('detail.editGridStopLoss')}
                            />
                            <span className="text-[#606070] text-xs shrink-0">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-[#9090A0]">{t('detail.editRunInterval')}</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {[{ m: 3, l: '3m' }, { m: 5, l: '5m' }, { m: 15, l: '15m' }, { m: 30, l: '30m' }].map(({ m, l }) => (
                            <button key={m} type="button" onClick={() => setEditGridInterval(m)}
                              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                                editGridInterval === m
                                  ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                                  : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                              }`}
                              title={l} aria-label={l}
                            >{l}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 卡片 3: LLM 模型（可折叠下拉） */}
                    <div className="glass-border-glow glass-card p-4 space-y-3">
                      <h3 className="text-sm font-semibold">LLM</h3>
                      <div>
                        <button type="button"
                          onClick={() => setShowEditGridModelDropdown(!showEditGridModelDropdown)}
                          className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
                          title="选择模型" aria-label="选择模型"
                        >
                          <div className="flex items-center gap-3">
                            {MODEL_DISPLAY[editGridModel as keyof typeof MODEL_DISPLAY]?.logo && (
                              <img src={MODEL_DISPLAY[editGridModel as keyof typeof MODEL_DISPLAY].logo}
                                alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-[#F8F8FC]">
                                {MODEL_DISPLAY[editGridModel as keyof typeof MODEL_DISPLAY]?.name ?? editGridModel}
                              </div>
                              <div className="text-xs text-[#606070]">
                                {MODEL_DISPLAY[editGridModel as keyof typeof MODEL_DISPLAY]?.provider ?? ''}
                              </div>
                            </div>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showEditGridModelDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showEditGridModelDropdown && (
                          <div className="mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl overflow-hidden">
                            {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                              const sel = editGridModel === modelId;
                              return (
                                <button key={modelId} type="button"
                                  onClick={() => { setEditGridModel(modelId); setShowEditGridModelDropdown(false); }}
                                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'}`}
                                  title={info.name} aria-label={info.name}
                                >
                                  {info.logo && <img src={info.logo} alt={info.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />}
                                  <div className="flex-1 text-left">
                                    <div className={`text-sm font-medium ${sel ? 'text-[#06B6D4]' : 'text-[#F8F8FC]'}`}>{info.name}</div>
                                    <div className="text-xs text-[#606070]">{info.provider}</div>
                                  </div>
                                  {sel && <Check className="w-4 h-4 text-[#06B6D4] flex-shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 卡片 4: Grid 止停条件（与非Grid一致） */}
                    <div className="rounded-xl border border-[#1E1E2E] overflow-hidden">
                      <button type="button" onClick={() => setShowEditStopConditions(!showEditStopConditions)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-[#06B6D4]" />
                          <span className="text-sm font-medium text-[#9090A0]">止停条件（选填）</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showEditStopConditions ? 'rotate-180' : ''}`} />
                      </button>
                      {showEditStopConditions && (
                      <div className="px-4 pb-4 space-y-2">
                        <p className="text-xs text-[#606070]">达到任一条件后策略自动停止，0=不限</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-xs text-[#9090A0]">最大周期</p>
                            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                              <input type="number" min={0} value={editMaxCycles || ''} onChange={(e) => setEditMaxCycles(parseFloat(e.target.value) || 0)}
                                placeholder="0" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                                aria-label="最大周期"
                              />
                              <span className="text-[#606070] text-xs shrink-0">次</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-[#9090A0]">盈利目标</p>
                            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                              <input type="number" min={0} step={0.1} value={editProfitTarget || ''} onChange={(e) => setEditProfitTarget(parseFloat(e.target.value) || 0)}
                                placeholder="0" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                                aria-label="盈利目标"
                              />
                              <span className="text-[#606070] text-xs shrink-0">%</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-xs text-[#9090A0]">{t('create.maxLoss')}</p>
                            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                              <input type="number" min={0} step={0.1} value={editMaxLoss || ''} onChange={(e) => setEditMaxLoss(parseFloat(e.target.value) || 0)}
                                placeholder="0" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                                aria-label={t('create.maxLoss')}
                              />
                              <span className="text-[#606070] text-xs shrink-0">%</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-[#9090A0]">{t('detail.configDailyLossLimit')}</p>
                            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                              <input type="number" min={0} max={20} value={editGridDailyLossLimit || ''}
                                onChange={(e) => setEditGridDailyLossLimit(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                placeholder="0" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                                aria-label={t('detail.configDailyLossLimit')}
                              />
                              <span className="text-[#606070] text-xs shrink-0">%</span>
                            </div>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <p className="text-xs text-[#9090A0]">网格重建阈值 <span className="text-[#606070]">（价格偏离中点超过此值自动重建，20=激进/趋势，30=保守/横盘）</span></p>
                            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                              <input type="number" min={10} max={50} step={5} value={editGridAutoAdjustThreshold || ''}
                                onChange={(e) => setEditGridAutoAdjustThreshold(e.target.value === '' ? 20 : parseInt(e.target.value))}
                                placeholder="20" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                                aria-label="网格重建阈值"
                              />
                              <span className="text-[#606070] text-xs shrink-0">%</span>
                            </div>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#9090A0]">方向自动切换</p>
                                <p className="text-[10px] text-[#606070]">突破时偏转方向，回归后恢复中性</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditGridEnableDirectionAdjust(!editGridEnableDirectionAdjust)}
                                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                  editGridEnableDirectionAdjust ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'
                                }`}
                              >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                  editGridEnableDirectionAdjust ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                            </div>
                          </div>
                          {editGridEnableDirectionAdjust && (
                            <div className="space-y-1 col-span-2">
                              <p className="text-xs text-[#9090A0]">偏向比例 <span className="text-[#606070]">（默认 70%）</span></p>
                              <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                                <input type="number" min={50} max={90} step={5} value={editGridDirectionBiasRatio || ''}
                                  onChange={(e) => setEditGridDirectionBiasRatio(e.target.value === '' ? 70 : parseInt(e.target.value))}
                                  placeholder="70" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0 placeholder:text-[#606070]"
                                  aria-label="偏向比例"
                                />
                                <span className="text-[#606070] text-xs shrink-0">%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      )}
                    </div>

                  </>
                ) : (
                <>
                {/* 交易所选择 */}
                <ExchangeKeySelector
                  value={editExchangeApiKeyId}
                  onChange={setEditExchangeApiKeyId}
                  label={t('create.exchangeAccount')}
                />

                {/* 卡片 0: LLM 模型选择（solo=单选下拉 / debate=多选下拉） */}
                <div className="glass-border-glow glass-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold">
                    {strategy.tradingMode === 'debate'
                      ? t('create.consensusModels', { count: editDebateModels.length })
                      : 'LLM'}
                  </h3>

                  {/* Solo 单选下拉 */}
                  {strategy.tradingMode !== 'debate' && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowEditSoloModelDropdown(!showEditSoloModelDropdown)}
                        className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
                        title="选择模型" aria-label="选择模型"
                      >
                        <div className="flex items-center gap-3">
                          {MODEL_DISPLAY[editSoloModel as keyof typeof MODEL_DISPLAY]?.logo && (
                            <img src={MODEL_DISPLAY[editSoloModel as keyof typeof MODEL_DISPLAY].logo}
                              alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-[#F8F8FC]">
                              {MODEL_DISPLAY[editSoloModel as keyof typeof MODEL_DISPLAY]?.name ?? editSoloModel}
                            </div>
                            <div className="text-xs text-[#606070]">
                              {MODEL_DISPLAY[editSoloModel as keyof typeof MODEL_DISPLAY]?.provider ?? ''}
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showEditSoloModelDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showEditSoloModelDropdown && (
                        <div className="mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl overflow-hidden">
                          {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                            const sel = editSoloModel === modelId;
                            return (
                              <button key={modelId} type="button"
                                onClick={() => { setEditSoloModel(modelId); setShowEditSoloModelDropdown(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'}`}
                                title={info.name} aria-label={info.name}
                              >
                                {info.logo && <img src={info.logo} alt={info.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />}
                                <div className="flex-1 text-left">
                                  <div className={`text-sm font-medium ${sel ? 'text-[#06B6D4]' : 'text-[#F8F8FC]'}`}>{info.name}</div>
                                  <div className="text-xs text-[#606070]">{info.provider}</div>
                                </div>
                                {sel && <Check className="w-4 h-4 text-[#06B6D4] flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Debate 多选下拉（叠层图标 + 展开列表） */}
                  {strategy.tradingMode === 'debate' && (
                    <div className="space-y-3">
                      <div>
                        <button type="button"
                          onClick={() => setShowEditDebateModelDropdown(!showEditDebateModelDropdown)}
                          className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
                          title="选择共识模型" aria-label="选择共识模型"
                        >
                          <div className="flex items-center -space-x-2">
                            {editDebateModels.map((id) => {
                              const m = MODEL_DISPLAY[id as keyof typeof MODEL_DISPLAY];
                              return m?.logo
                                ? <img key={id} src={m.logo} alt={m.name}
                                    className="w-7 h-7 rounded-full border-2 border-[#12121A] object-cover" title={m.name} />
                                : <div key={id} className="w-7 h-7 rounded-full border-2 border-[#12121A]"
                                    style={{ backgroundColor: (m as { color?: string })?.color || '#1E1E2E' }} title={m?.name} />;
                            })}
                          </div>
                          <ChevronDown className={`w-5 h-5 text-[#606070] transition-transform ${showEditDebateModelDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showEditDebateModelDropdown && (
                          <div className="mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl overflow-hidden">
                            <p className="px-4 pt-3 pb-1 text-xs text-[#606070]">{t('create.consensusModelsDesc')}</p>
                            {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                              const sel = editDebateModels.includes(modelId);
                              return (
                                <button key={modelId} type="button"
                                  onClick={() => {
                                    if (sel) {
                                      if (editDebateModels.length > 2) setEditDebateModels(editDebateModels.filter(id => id !== modelId));
                                    } else {
                                      if (editDebateModels.length < 5) setEditDebateModels([...editDebateModels, modelId]);
                                    }
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'}`}
                                  title={info.name} aria-label={info.name}
                                >
                                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#06B6D4]' : 'bg-[#1E1E2E]'}`}>
                                    {sel && <Check className="w-3 h-3 text-[#F8F8FC]" />}
                                  </div>
                                  {info.logo && <img src={info.logo} alt={info.name} className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />}
                                  <div className="flex-1 min-w-0 text-left">
                                    <span className="text-sm text-[#F8F8FC]">{info.name}</span>
                                    <span className="text-xs text-[#606070] ml-2">{info.provider}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <PillGroup label={t('detail.editDebateMaxRounds')}
                        options={[2,3,5].map(v => ({ value: v, label: String(v) }))}
                        value={editDebateMaxRounds} onChange={setEditDebateMaxRounds} />
                      <PillGroup label={t('detail.editDebateTemperature')}
                        options={[0.3, 0.5, 0.7, 0.9, 1.0].map(v => ({ value: v, label: String(v) }))}
                        value={editDebateTemperature} onChange={setEditDebateTemperature} />
                    </div>
                  )}
                </div>
                {/* 卡片 1-R: Research 专属 — 单一交易对 + 深度选择 */}
                {strategy.tradingMode === 'research' && (
                  <div className="glass-border-glow glass-card p-4 space-y-4">
                    <h3 className="text-sm font-semibold">{t('create.tradingPair')}</h3>

                    {/* 币种来源 */}
                    <div className="space-y-3">
                      <label className="block text-sm text-[#9090A0]">{t('detail.editCoinSource')}</label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { key: 'static', label: t('detail.coinSourceManual') },
                          { key: 'ai', label: t('detail.coinSourceAI') },
                          { key: 'oi_top', label: t('detail.coinSourceOIHigh') },
                          { key: 'oi_low', label: t('detail.coinSourceOILow') },
                          { key: 'mixed', label: t('detail.coinSourceMixed') },
                        ] as const).map(({ key, label }) => (
                          <button key={key} type="button"
                            onClick={() => setEditCoinMode(key)}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${editCoinMode === key
                              ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                              : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'}`}
                            title={label} aria-label={label}
                          >{label}</button>
                        ))}
                      </div>
                    </div>

                    {/* 单一交易对选择（tag-input + 搜索，与创建表单一致） */}
                    {(editCoinMode === 'static' || editCoinMode === 'mixed') && (
                      <div className="space-y-3">
                        <label className="block text-sm text-[#9090A0]">{t('create.tradingPair')}</label>
                        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl min-h-[40px]">
                          {editResearchSymbol && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs">
                              {editResearchSymbol.split('/')[0]}
                              <X className="w-3 h-3 cursor-pointer hover:text-white"
                                onClick={() => setEditResearchSymbol('')}
                              />
                            </span>
                          )}
                          <div className="flex items-center flex-1 min-w-[120px]">
                            <Search className="w-3.5 h-3.5 text-[#606070] mr-1.5 flex-shrink-0" />
                            <input
                              type="text"
                              placeholder={t('create.searchCoins')}
                              value={editResearchSymbolSearch}
                              onChange={(e) => setEditResearchSymbolSearch(e.target.value)}
                              className="flex-1 bg-transparent text-sm text-[#F8F8FC] placeholder:text-[#606070] outline-none min-w-0"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-[#606070]">{t('create.popular')}</span>
                            <button type="button" onClick={() => { setEditResearchSymbol(''); setEditResearchSymbolSearch(''); }}
                              className="px-2.5 py-1 rounded-lg text-xs bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-colors"
                            >{t('common.clear')}</button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {filteredEditResearchSymbols.map((coinName) => {
                              const full = `${coinName}/USDT:USDT`;
                              const sel = editResearchSymbol === full;
                              return (
                                <button key={coinName} type="button"
                                  onClick={() => { setEditResearchSymbol(full); setEditResearchSymbolSearch(''); }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    sel ? 'bg-[#06B6D4] text-black' : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                                  }`}
                                  aria-label={coinName} title={coinName}
                                >{coinName}</button>
                              );
                            })}
                            {editResearchSymbolSearch && filteredEditResearchSymbols.length === 0 && (
                              <span className="text-xs text-[#606070] py-2">{t('create.notFound')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 研究深度选择 */}
                    <div className="space-y-3">
                      <label className="block text-sm text-[#9090A0]">{t('create.researchDepth')}</label>
                      <div className="flex gap-2">
                        {([
                          { value: 'quick' as const, time: '~1min' },
                          { value: 'standard' as const, time: '~3min' },
                          { value: 'deep' as const, time: '~5min' },
                        ]).map((opt) => (
                          <button key={opt.value} type="button"
                            onClick={() => setEditResearchDepth(opt.value)}
                            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                              editResearchDepth === opt.value
                                ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                                : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                            }`}
                            aria-label={`${opt.value} ${opt.time}`} title={`${opt.value} ${opt.time}`}
                          >
                            <div className="text-sm">
                              {opt.value === 'quick' ? t('create.quick') : opt.value === 'deep' ? t('create.deep') : t('create.standard')}
                            </div>
                            <div className="text-xs mt-0.5 opacity-70">{opt.time}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 卡片 1: 交易币种（Solo/Debate 多币种选择，Research 跳过） */}
                {strategy.tradingMode !== 'research' && (
                <div className="glass-border-glow glass-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold">{t('detail.editCoins')}</h3>
                  <label className="block text-sm text-[#9090A0]">{t('detail.editCoinSource')}</label>
                  <div className="flex flex-wrap gap-2">
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
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${editCoinMode === key
                          ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                          : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'}`}
                        title={label} aria-label={label}
                      >{label}</button>
                    ))}
                  </div>

                  {/* 币种选择（static / mixed）— Tag-input + 搜索 */}
                  {(editCoinMode === 'static' || editCoinMode === 'mixed') && (
                    <div className="space-y-3">
                      <span className="text-sm text-[#9090A0]">
                        {editCoinMode === 'mixed' ? t('detail.coinSourceMixed') : t('detail.coinSourceManual')}
                      </span>
                      {/* Tag-input：已选 chips + 内联搜索 */}
                      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl min-h-[40px]">
                        {editCoins.map((coin) => {
                          const short = coin.split('/')[0];
                          return (
                            <span key={coin} className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs">
                              {short}
                              <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => toggleEditCoin(coin)} />
                            </span>
                          );
                        })}
                        <div className="flex items-center flex-1 min-w-[120px]">
                          <Search className="w-3.5 h-3.5 text-[#606070] mr-1.5 flex-shrink-0" />
                          <input
                            type="text"
                            value={editCoinSearch}
                            onChange={(e) => setEditCoinSearch(e.target.value)}
                            placeholder={editCoins.length === 0 ? '搜索币种...' : ''}
                            className="flex-1 bg-transparent text-sm text-[#F8F8FC] placeholder:text-[#606070] outline-none min-w-0"
                          />
                        </div>
                      </div>
                      {/* Quick Select + Coin chips */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-[#606070]">{t('create.popular')}</span>
                          <button type="button" onClick={() => setEditCoins([])}
                            className="px-2.5 py-1 rounded-lg text-xs bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-colors"
                          >{t('common.clear')}</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {filteredEditCoins.map((coinName) => {
                            const full = `${coinName}/USDT:USDT`;
                            const sel = editCoins.includes(full);
                            return (
                              <button key={coinName} type="button"
                                onClick={() => { toggleEditCoin(full); setEditCoinSearch(''); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  sel ? 'bg-[#06B6D4] text-black' : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                                }`}
                                aria-label={coinName} title={coinName}
                              >{coinName}</button>
                            );
                          })}
                          {editCoinSearch && filteredEditCoins.length === 0 && (
                            <span className="text-xs text-[#606070] py-2">{t('create.notFound')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* maxCoins 滑块 (非 static) */}
                  {editCoinMode !== 'static' && (
                    <PillGroup label={t('detail.editMaxCoins')} options={[3,5,8,10,15].map(v => ({ value: v, label: String(v) }))} value={editMaxCoins} onChange={setEditMaxCoins} />
                  )}

                  {/* 排除币种（折叠面板，与创建表单一致） */}
                  <div className="rounded-xl border border-[#1E1E2E] overflow-hidden">
                    <button type="button"
                      onClick={() => setShowEditExcluded(!showEditExcluded)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
                      title={t('detail.editExcludeCoins')} aria-label={t('detail.editExcludeCoins')}
                    >
                      <span className="text-sm font-medium text-[#9090A0]">
                        {t('detail.editExcludeCoins')} {editExcludedCoins.length > 0 && `(${editExcludedCoins.length})`}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showEditExcluded ? 'rotate-180' : ''}`} />
                    </button>
                    {showEditExcluded && (
                      <div className="px-4 pb-4">
                        <p className="text-xs text-[#606070] mb-3">选中的币种将被排除在交易范围外</p>
                        <div className="flex flex-wrap gap-2">
                          {POPULAR_COINS.map(coin => {
                            const short = coin.split('/')[0];
                            const excluded = editExcludedCoins.includes(coin);
                            return (
                              <button
                                key={coin}
                                onClick={() => toggleEditExcludedCoin(coin)}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${excluded
                                  ? 'bg-[#EF4444]/10 border border-[#EF4444] text-[#EF4444]'
                                  : 'bg-[#12121A] border border-[#1E1E2E] text-[#9090A0] hover:border-[#EF4444]/40'}`}
                                title={short} aria-label={short}
                              >{short}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* 卡片 2: 风控参数（与创建表单对齐，全用 input 2列网格） */}
                <div className="glass-border-glow glass-card p-4 space-y-4">
                  <h3 className="text-sm font-semibold">{t('detail.editRiskControl')}</h3>
                  {/* 资金上限（全宽） */}
                  <div className="space-y-1">
                    <p className="text-xs text-[#9090A0]">{t('create.allocatedCapital')}</p>
                    <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <span className="text-[#606070] text-xs">$</span>
                      <input type="number" min={500} max={100000} step="any"
                        value={editAllocatedCapital || ''}
                        onChange={(e) => setEditAllocatedCapital(parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                      />
                    </div>
                  </div>
                  {/* 2列网格参数 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[#606070] mb-1">{t('create.maxLeverage')}</p>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                        <input type="number" min={1} max={100}
                          value={editMaxLeverage || ''}
                          onChange={(e) => setEditMaxLeverage(parseFloat(e.target.value) || 0)}
                          className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                        />
                        <span className="text-[#606070] text-xs">x</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#606070] mb-1">日亏损上限</p>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                        <span className="text-[#606070] text-xs">$</span>
                        <input type="number" min={0}
                          value={editMaxDailyDrawdown || ''}
                          onChange={(e) => setEditMaxDailyDrawdown(parseFloat(e.target.value) || 0)}
                          className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#606070] mb-1">{t('create.maxDailyTrades')}</p>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                        <input type="number" min={1} max={200}
                          value={editMaxDailyTrades || ''}
                          onChange={(e) => setEditMaxDailyTrades(parseInt(e.target.value) || 0)}
                          className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                        />
                        <span className="text-[#606070] text-xs">次</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#606070] mb-1">{t('create.cooldownMinutes')}</p>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                        <input type="number" min={0} max={1440}
                          value={editCooldownMinutes || ''}
                          onChange={(e) => setEditCooldownMinutes(parseInt(e.target.value) || 0)}
                          className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                        />
                        <span className="text-[#606070] text-xs">min</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#606070] mb-1">{t('create.minConfidence')}</p>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                        <input type="number" min={0} max={100}
                          value={editMinConfidence || ''}
                          onChange={(e) => setEditMinConfidence(parseInt(e.target.value) || 0)}
                          className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                        />
                        <span className="text-[#606070] text-xs">%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#606070] mb-1">最低盈亏比</p>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                        <input type="number" min={0} max={20} step={0.1}
                          value={editMinRR || ''}
                          onChange={(e) => setEditMinRR(parseFloat(e.target.value) || 0)}
                          className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                        />
                        <span className="text-[#606070] text-xs">:1</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#606070] mb-1">{t('create.minPositionSize')}</p>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                        <span className="text-[#606070] text-xs">$</span>
                        <input type="number" min={0}
                          value={editMinPositionSize || ''}
                          onChange={(e) => setEditMinPositionSize(parseFloat(e.target.value) || 0)}
                          className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {/* 卡片 3: Prompt 配置 (4段) — Research 模式跳过 */}
                {strategy.tradingMode !== 'research' && (
                <div className="glass-border-glow glass-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold">{t('detail.editPromptConfig')}</h3>

                  {/* 系统能力说明（与创建页一致） */}
                  <div className="bg-[#06B6D4]/5 border border-[#06B6D4]/15 rounded-lg px-3 py-2.5">
                    <p className="text-[11px] text-[#06B6D4]/80 leading-relaxed">
                      {t('create.customInstructionsInfo')}
                    </p>
                  </div>

                  {/* AI 交易风格 */}
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
                          className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${editPromptMode === key
                            ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                            : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'}`}
                          title={label} aria-label={label}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* 4 段可折叠 Prompt 编辑器（标签与创建页保持一致） */}
                  {(() => {
                    const promptSections: Array<{
                      id: string; label: string;
                      value: string; setter: (v: string) => void;
                      defaultVal: string; maxLen: number; placeholder: string;
                    }> = [
                      { id: 'role', label: t('create.promptRole'), value: editPromptRole, setter: setEditPromptRole, defaultVal: t('detail.promptDefaultRole'), maxLen: 300, placeholder: t('detail.promptDefaultRole') },
                      { id: 'frequency', label: t('create.promptFrequency'), value: editPromptTradingFrequency, setter: setEditPromptTradingFrequency, defaultVal: t('detail.promptDefaultFrequency'), maxLen: 300, placeholder: t('detail.promptDefaultFrequency') },
                      { id: 'entry', label: t('create.promptEntry'), value: editPromptEntryStandards, setter: setEditPromptEntryStandards, defaultVal: t('detail.promptDefaultEntry'), maxLen: 300, placeholder: t('detail.promptDefaultEntry') },
                      { id: 'decision', label: t('create.promptDecision'), value: editPromptCustom, setter: setEditPromptCustom, defaultVal: t('detail.promptDefaultDecision'), maxLen: 500, placeholder: t('detail.promptDefaultDecision') },
                    ];
                    return promptSections.map((sec) => (
                      <details key={sec.id} className="group">
                        <summary className="flex items-center justify-between cursor-pointer list-none text-xs text-[#9090A0] py-1.5 select-none">
                          <span>{sec.label}</span>
                          <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          <textarea
                            value={sec.value}
                            onChange={(e) => sec.setter(e.target.value)}
                            maxLength={sec.maxLen}
                            rows={3}
                            placeholder={sec.placeholder}
                            className="w-full px-3 py-2 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4] resize-none"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-[#606070]">{sec.value.length}/{sec.maxLen}</p>
                            {sec.value ? (
                              <button
                                onClick={() => sec.setter('')}
                                className="flex items-center gap-1 text-[10px] text-[#606070] hover:text-[#06B6D4] transition-colors"
                                title={t('common.clear')} aria-label={t('common.clear')}
                              >
                                <X className="w-3 h-3" />{t('common.clear')}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </details>
                    ));
                  })()}

                </div>
                )}

                {/* 卡片 4: 执行配置（间隔按模式动态展示，与创建表单一致） */}
                <div className="space-y-3">
                  <label className="block text-sm text-[#9090A0]">{t('detail.editRunInterval')}</label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {(strategy.tradingMode === 'solo'
                      ? [{ m: 3, l: '3m' }, { m: 5, l: '5m' }, { m: 15, l: '15m' }, { m: 30, l: '30m' }, { m: 60, l: '60m' }]
                      : strategy.tradingMode === 'debate'
                      ? [{ m: 5, l: '5m' }, { m: 15, l: '15m' }, { m: 30, l: '30m' }, { m: 60, l: '60m' }]
                      : strategy.tradingMode === 'research'
                      ? [{ m: 15, l: '15m' }, { m: 30, l: '30m' }, { m: 60, l: '60m' }, { m: 240, l: '4h' }]
                      : [{ m: 15, l: '15m' }, { m: 30, l: '30m' }, { m: 60, l: '1h' }, { m: 240, l: '4h' }, { m: 1440, l: '24h' }]
                    ).map(({ m, l }) => (
                      <button key={m} type="button" onClick={() => setEditInterval(m)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${editInterval === m
                          ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                          : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'}`}
                        title={l} aria-label={l}
                      >{l}</button>
                    ))}
                  </div>
                </div>

                {/* 卡片 5: 止停条件（折叠面板，与创建表单一致） */}
                <div className="rounded-xl border border-[#1E1E2E] overflow-hidden">
                  <button type="button" onClick={() => setShowEditStopConditions(!showEditStopConditions)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-[#06B6D4]" />
                      <span className="text-sm font-medium text-[#9090A0]">止停条件（选填）</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showEditStopConditions ? 'rotate-180' : ''}`} />
                  </button>
                  {showEditStopConditions && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-[#606070]">达到任一条件后策略自动停止，0=不限</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9090A0] w-20 shrink-0">最大周期</span>
                      <input type="number" min={0} value={editMaxCycles || ''} onChange={(e) => setEditMaxCycles(parseFloat(e.target.value) || 0)}
                        placeholder="0" className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-[#06B6D4]/40 focus:outline-none"
                      />
                      <span className="text-xs text-[#606070]">次</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9090A0] w-20 shrink-0">盈利目标</span>
                      <input type="number" min={0} step={0.1} value={editProfitTarget || ''} onChange={(e) => setEditProfitTarget(parseFloat(e.target.value) || 0)}
                        placeholder="0" className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-[#06B6D4]/40 focus:outline-none"
                      />
                      <span className="text-xs text-[#606070]">%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9090A0] w-20 shrink-0">最大止损</span>
                      <input type="number" min={0} step={0.1} value={editMaxLoss || ''} onChange={(e) => setEditMaxLoss(parseFloat(e.target.value) || 0)}
                        placeholder="0" className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-[#06B6D4]/40 focus:outline-none"
                      />
                      <span className="text-xs text-[#606070]">%</span>
                    </div>
                  </div>
                  )}
                </div>
                </>
                )}

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
        <div className="fixed inset-0 z-[100] flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowPauseModal(false)}
          />
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl p-6 pb-24 animate-slide-up">
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
        <div className="fixed inset-0 z-[100] flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowStopModal(false)}
          />
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl p-6 pb-24 animate-slide-up">
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

      {/* 弹窗: 恢复风控暂停的网格策略 */}
      {showResumeGridModal && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowResumeGridModal(false)}
          />
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl p-6 pb-24 animate-slide-up">
            <h2 className="text-base font-semibold mb-3">{t('detail.gridResumeConfirmTitle')}</h2>
            <p className="text-xs text-[#9090A0] mb-2">{riskPauseReason}</p>
            <p className="text-xs text-[#9090A0] mb-3">{t('detail.gridResumeConfirmDesc')}</p>
            <div className="p-2.5 bg-[#0A0A0F] rounded-lg space-y-1 mb-4">
              <p className="text-[11px] text-[#606070]">{t('detail.gridResumeWillDo')}</p>
              {isGridRiskPaused && (
                <>
                  <p className="text-xs text-[#9090A0]">• {t('detail.gridResumePeakReset')}</p>
                  <p className="text-xs text-[#9090A0]">• {t('detail.gridResumeDailyReset')}</p>
                </>
              )}
              {isSoloDebateRiskPaused && (
                <p className="text-xs text-[#9090A0]">• {t('detail.soloResumeDrawdownNote')}</p>
              )}
              <p className="text-xs text-[#9090A0]">• {t('detail.gridResumeRiskRemain')}</p>
            </div>
            <div className="flex items-center gap-3 mb-16">
              <button
                onClick={() => setShowResumeGridModal(false)}
                className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1E1E2E]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  try {
                    if (isGridRiskPaused) {
                      await strategyControl.mutateAsync({ id: strategyId!, action: 'resume-grid' });
                    } else {
                      await strategyControl.mutateAsync({ id: strategyId!, action: 'start' });
                    }
                    toast.success(t('detail.gridResumeSuccess'));
                    setShowResumeGridModal(false);
                  } catch (err: unknown) {
                    toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('common.failed'));
                  }
                }}
                disabled={strategyControl.isPending}
                className="flex-1 py-3 bg-[#EF4444] text-white text-sm font-medium rounded-lg active:opacity-80 disabled:opacity-50"
              >
                {strategyControl.isPending ? t('detail.gridResuming') : t('detail.gridConfirmResume')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗3: Debate 多模型投票详情 */}
      {voteSheetLog && (
        <VoteDetailSheet
          log={voteSheetLog}
          onClose={() => setVoteSheetLog(null)}
        />
      )}

    </div>
  );
}

// 决策状态图标
function DecisionStatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'executed':
      return <Check className="w-3.5 h-3.5 text-[#10B981]" />;
    case 'blocked':
      return <X className="w-3.5 h-3.5 text-[#F43F5E]" />;
    case 'failed':
      return <X className="w-3.5 h-3.5 text-[#EF4444]" />;
    case 'skipped':
      return <span className="w-3.5 h-3.5 rounded-full border border-[#606070] inline-block" />;
    default:
      return <span className="w-3.5 h-3.5 rounded-full border border-[#606070] inline-block" />;
  }
}

// 实时决策行（WS 推送）
function LiveDecisionRow({ decision: d, isLast }: {
  decision: StrategyDecisionEvent;
  isLast: boolean;
}) {
  const t = useTranslations('ai');
  const ac = ACTION_CONFIG[d.action];
  const actionKeyMap: Record<string, string> = {
    open_long: 'detail.actionOpenLong', open_short: 'detail.actionOpenShort',
    close_long: 'detail.actionCloseLong', close_short: 'detail.actionCloseShort',
    hold: 'detail.actionHold', wait: 'detail.actionWait',
  };
  const label = actionKeyMap[d.action] ? t(actionKeyMap[d.action]) : (ac?.label || d.action);
  const color = ac?.color || '#94A3B8';
  const bg = ac?.bg || 'rgba(148,163,184,0.15)';
  const time = d.timestamp
    ? new Date(d.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';
  const symbolDisplay = d.symbol ? d.symbol.split('/')[0] : '—';

  // 状态标签
  const statusLabel: Record<string, string> = {
    executed: t('detail.statusExecuted'),
    blocked: t('detail.statusBlocked'),
    skipped: t('detail.statusSkipped'),
    failed: t('detail.statusFailed'),
  };
  const statusColor: Record<string, string> = {
    executed: '#10B981', blocked: '#F43F5E', skipped: '#606070', failed: '#EF4444',
  };

  // 第二行详情
  let detailText = '';
  if (d.status === 'executed' && d.price) {
    detailText = `$${d.price.toFixed(2)} × ${d.amount ?? '—'}`;
    if (d.orderId) detailText += ` | ${d.orderId.slice(0, 8)}…`;
  } else if (d.status === 'blocked') {
    detailText = `${d.blockedBy || '—'}: ${d.reasoning || ''}`;
  } else if (d.status === 'failed') {
    detailText = d.error || d.reasoning || '';
  } else if (d.status === 'skipped') {
    detailText = d.reasoning || d.blockedBy || '';
  }

  return (
    <div className={`py-2.5 ${!isLast ? 'border-b border-[#1E1E2E]' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#606070] w-14 flex-shrink-0">{time}</span>
        <span className="text-xs font-medium text-[#F8F8FC] w-12 flex-shrink-0 truncate">{symbolDisplay}</span>
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ color, backgroundColor: bg }}>
          {label}
        </span>
        {d.confidence > 0 && <span className="text-[10px] text-[#9090A0]">{Math.round(d.confidence)}%</span>}
        {d.leverage && <span className="text-[10px] text-[#9090A0]">{d.leverage}x</span>}
        <div className="flex-1" />
        {d.status && (
          <span className="text-[10px] font-medium" style={{ color: statusColor[d.status] || '#606070' }}>
            {statusLabel[d.status] || d.status}
          </span>
        )}
        <DecisionStatusIcon status={d.status} />
      </div>
      {detailText && (
        <p className="text-[10px] mt-1 ml-14 truncate" style={{ color: statusColor[d.status || ''] || '#606070' }}>
          {detailText.slice(0, 120)}
        </p>
      )}
    </div>
  );
}

// 最近决策行（增强版：含状态详情+展开行）
function RecentDecisionRow({ log, tradingMode, onViewVotes, isLast }: {
  log: StrategyLog;
  tradingMode: string;
  onViewVotes: () => void;
  isLast: boolean;
}) {
  const t = useTranslations('ai');
  const [expanded, setExpanded] = useState(false);
  const isGrid = tradingMode === 'grid';
  // Grid 日志结构: { decisions: [{action, ...}] }, Solo/Debate: { action, confidence, ... }
  const gridDecisions = isGrid ? (log.decision?.decisions as Array<{ action: string; reasoning?: string }> || []) : [];
  const action = isGrid
    ? (gridDecisions[0]?.action || log.decision?.action || 'grid')
    : (log.decision?.action || 'hold');
  const ac = ACTION_CONFIG[action];
  const actionKeyMap: Record<string, string> = {
    open_long: 'detail.actionOpenLong', open_short: 'detail.actionOpenShort',
    close_long: 'detail.actionCloseLong', close_short: 'detail.actionCloseShort',
    hold: 'detail.actionHold', wait: 'detail.actionWait',
  };
  const gridActionLabels: Record<string, string> = {
    grid_initialized: t('timeline.gridInitialized'), adjust_grid: t('timeline.gridAdjust'),
    place_buy_limit: t('timeline.gridPlaceBuy'), place_sell_limit: t('timeline.gridPlaceSell'),
    cancel_order: t('timeline.gridCancel'), rebalance: t('timeline.gridRebalance'),
    emergency_exit: t('timeline.gridEmergencyExit'), hold: t('detail.actionHold'),
    exit_all: t('timeline.gridExitAll'), reduce_exposure: t('timeline.gridReduce'),
    pause_grid: t('timeline.gridPause'), cancel_all_orders: t('timeline.gridExitAll'),
  };
  const BLOCKED_BY_I18N: Record<string, string> = {
    L1: 'timeline.blockedByL1', L2: 'timeline.blockedByL2', L4: 'timeline.blockedByL4',
    L5: 'timeline.blockedByL5', L6: 'timeline.blockedByL6', L8: 'timeline.blockedByL8',
    L9: 'timeline.blockedByL9', E4: 'timeline.blockedByE4', R4: 'timeline.blockedByR4',
    safety: 'timeline.blockedBySafety', risk_debate: 'timeline.blockedByRisk',
    has_position: 'timeline.blockedByHasPosition',
  };
  const label = isGrid
    ? (log.decision?.gridSummary || (gridActionLabels[action] || action) + (gridDecisions.length > 1 ? ` +${gridDecisions.length - 1}` : ''))
    : (actionKeyMap[action] ? t(actionKeyMap[action]) : (ac?.label || action));
  const color = isGrid ? '#10B981' : (ac?.color || '#94A3B8');
  const bg = isGrid ? 'rgba(16,185,129,0.15)' : (ac?.bg || 'rgba(148,163,184,0.15)');
  const time = new Date(log.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const hasVotes = tradingMode === 'debate' && log.decision?.votes && log.decision.votes.length > 0;
  const symbolDisplay = log.symbol ? log.symbol.split('/')[0] : '—';

  // 从 executionResult 提取状态
  const er = log.executionResult;
  const logStatus: string = er?.blocked ? 'blocked'
    : er?.skipped ? 'skipped'
    : er?.error && !log.executed ? 'failed'
    : log.executed ? 'executed'
    : 'skipped';
  const statusLabel: Record<string, string> = {
    executed: t('detail.statusExecuted'), blocked: t('detail.statusBlocked'),
    skipped: t('detail.statusSkipped'), failed: t('detail.statusFailed'),
  };
  const statusColor: Record<string, string> = {
    executed: '#10B981', blocked: '#F43F5E', skipped: '#606070', failed: '#EF4444',
  };

  // 详情文本
  let detailText = '';
  if (logStatus === 'executed' && er?.orderId) {
    detailText = t('timeline.orderId', { id: er.orderId });
    if (er.price) detailText = `$${er.price} | ${detailText}`;
  } else if (logStatus === 'blocked') {
    const blockedLabel = er?.blockedBy ? (BLOCKED_BY_I18N[er.blockedBy] ? t(BLOCKED_BY_I18N[er.blockedBy]) : er.blockedBy) : '—';
    detailText = `${blockedLabel}: ${er?.reason || ''}`;
  } else if (logStatus === 'failed') {
    detailText = er?.error || er?.reason || '';
  } else if (logStatus === 'skipped') {
    detailText = er?.reason || log.decision?.reasoning?.slice(0, 100) || '';
  }
  // Grid 日志：从 decisions 数组中提取最有意义的推理（优先 adjust_grid > hold > 全部拼接）
  // 特殊：grid_initialized 日志的 reasoning 在顶层（不在 decisions 数组中）
  const gridReasoning = isGrid
    ? (() => {
        // grid_initialized 等顶层 action 直接用顶层 reasoning
        if (gridDecisions.length === 0 && log.decision?.reasoning) {
          return log.decision.reasoning;
        }
        const adjustR = gridDecisions.find(d => d.action === 'adjust_grid' && d.reasoning)?.reasoning;
        if (adjustR) return adjustR;
        const holdR = gridDecisions.find(d => d.action === 'hold' && d.reasoning)?.reasoning;
        if (holdR) return holdR;
        // 降级：拼接所有非空推理（cancel_order 也包含市场判断），取最长的前2条
        const allR = [...new Set(gridDecisions.filter(d => d.reasoning).map(d => d.reasoning as string))]
          .sort((a, b) => b.length - a.length).slice(0, 2);
        return allR.join('\n') || '';
      })()
    : '';
  const hasDetail = detailText || log.decision?.reasoning || gridReasoning;

  return (
    <div className={`py-2.5 ${!isLast ? 'border-b border-[#1E1E2E]' : ''}`}>
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => hasDetail && setExpanded(v => !v)}
      >
        <span className="text-xs text-[#606070] w-10 flex-shrink-0">{time}</span>
        <span className="text-xs font-medium text-[#F8F8FC] w-12 flex-shrink-0 truncate">
          {symbolDisplay}
        </span>
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ color, backgroundColor: bg }}>
          {label}
        </span>
        {log.decision?.confidence && (
          <span className="text-[10px] text-[#9090A0]">{Math.round(log.decision.confidence)}%</span>
        )}
        <div className="flex-1" />
        {hasVotes && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewVotes(); }}
            className="px-2 py-0.5 text-[10px] font-medium text-[#8B5CF6] bg-[#8B5CF6]/10 rounded active:opacity-70"
            title={t('detail.voteDetail', { symbol: log.symbol })} aria-label={t('detail.voteModelVotes')}
          >
            {t('detail.voteModelVotes')}
          </button>
        )}
        <span className="text-[10px] font-medium" style={{ color: statusColor[logStatus] || '#606070' }}>
          {statusLabel[logStatus] || '—'}
        </span>
        <DecisionStatusIcon status={logStatus} />
      </div>
      {/* 展开详情 */}
      {expanded && hasDetail && (
        <div className="mt-1.5 ml-10 pl-2 border-l-2 border-[#1E1E2E] space-y-1">
          {detailText && (
            <p className="text-[10px]" style={{ color: statusColor[logStatus] || '#606070' }}>
              {detailText.slice(0, 200)}
            </p>
          )}
          {/* Solo/Debate 模式：显示 decision.reasoning */}
          {!isGrid && log.decision?.reasoning && (
            <p className="text-[10px] text-[#9090A0]">
              {log.decision.reasoning.slice(0, 200)}
            </p>
          )}
          {/* Grid 模式：显示从 decisions 中提取的市场分析推理 */}
          {isGrid && gridReasoning && (
            <p className="text-[10px] text-[#9090A0] leading-relaxed whitespace-pre-line">
              {gridReasoning.slice(0, 400)}
            </p>
          )}
          {/* Grid 初始化日志：显示网格范围快照 */}
          {isGrid && log.decision?.gridSnapshot?.rangeSource && (
            <div className="flex items-center gap-2 text-[10px] text-[#06B6D4]">
              <span>范围来源: {log.decision.gridSnapshot.rangeSource}</span>
              {log.decision.gridSnapshot.upperPrice && log.decision.gridSnapshot.lowerPrice && (
                <span>${Number(log.decision.gridSnapshot.lowerPrice).toFixed(2)} ~ ${Number(log.decision.gridSnapshot.upperPrice).toFixed(2)}</span>
              )}
            </div>
          )}
          {log.decision?.leverage && (
            <p className="text-[10px] text-[#9090A0]">
              {log.decision.leverage}x | {t('timeline.slLabel')}: {log.decision?.stopLoss ?? '—'} | {t('timeline.tpLabel')}: {log.decision?.takeProfit ?? '—'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// 只读配置行（固定标签宽度，值紧接标签，自然阅读顺序）
function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#1A1A24] last:border-0">
      <span className="text-sm text-[#9090A0] w-[36%] shrink-0 leading-normal">{label}</span>
      <span className="text-sm text-[#F8F8FC] flex-1 break-all leading-normal">{value}</span>
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

  const actionLabel: Record<string, string> = {
    open_long: t('detail.actionOpenLong'), open_short: t('detail.actionOpenShort'),
    close_long: t('detail.actionCloseLong'), close_short: t('detail.actionCloseShort'),
    hold: t('detail.actionHold'), wait: t('detail.actionWait'),
  };

  // 统计各 action 票数
  const actionCounts: Record<string, number> = {};
  for (const v of validVotes) {
    actionCounts[v.action] = (actionCounts[v.action] || 0) + 1;
  }
  // 按固定顺序排列
  const ACTION_ORDER = ['open_long', 'open_short', 'close_long', 'close_short', 'hold', 'wait'];
  const actionGroups = ACTION_ORDER
    .filter(a => actionCounts[a] > 0)
    .map(a => ({ action: a, count: actionCounts[a] }));

  // action → 颜色映射
  const ACTION_COLORS: Record<string, string> = {
    open_long: '#10B981', open_short: '#F43F5E',
    close_long: '#F59E0B', close_short: '#06B6D4',
    hold: '#64748B', wait: '#94A3B8',
  };

  const toggleVoteExpand = (idx: number) => {
    const newSet = new Set(expandedVotes);
    if (newSet.has(idx)) newSet.delete(idx);
    else newSet.add(idx);
    setExpandedVotes(newSet);
  };

  // 共识结果
  const consensusAction = log.decision?.action || 'hold';

  // 模型显示名辅助
  const getModelName = (modelId: string) => MODEL_DISPLAY[modelId]?.name || modelId;
  const getModelColor = (modelId: string) => MODEL_DISPLAY[modelId]?.color || '#94A3B8';
  const getModelProvider = (modelId: string) => MODEL_DISPLAY[modelId]?.provider || '';

  return (
    <div className="fixed inset-0 z-[100] flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-h-[85vh] overflow-y-auto bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] shadow-2xl animate-slide-up pb-24">
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
                {new Date(log.createdAt).toLocaleString(undefined, {
                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <button onClick={onClose} title={t('common.collapse')} aria-label={t('common.collapse')} className="p-2 -mr-2 active:opacity-70">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 动态阶段进度指示 (有风控成本→4阶段, 否则→2阶段) */}
          {(() => {
            const logRecord = log as unknown as Record<string, unknown>;
            const riskResult = logRecord.riskDebateResult as { totalCost?: number } | undefined;
            const hasRiskDebate = (riskResult?.totalCost ?? 0) > 0;
            const stageEntries = hasRiskDebate
              ? [
                  { key: 'invest', label: t('detail.stageInvestDebate') },
                  { key: 'risk', label: t('detail.stageRiskDebate') },
                  { key: 'consensus', label: t('detail.stageConsensusVote') },
                ]
              : [
                  { key: 'debate', label: t('detail.stageDebateV2') },
                  { key: 'voting', label: t('detail.stageVotingV2') },
                ];
            return (
              <div className="flex items-center gap-1">
                {stageEntries.map((entry, idx) => (
                  <div key={entry.key} className="flex items-center flex-1">
                    <div className="flex items-center gap-1 flex-1">
                      <div className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-[#F8F8FC]" />
                      </div>
                      <span className="text-[10px] text-[#9090A0] truncate">{entry.label}</span>
                    </div>
                    {idx < stageEntries.length - 1 && <div className="w-3 h-px bg-[#10B981] mx-0.5 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* 综合判断 */}
          <div className="bg-[#1E1E2E] border border-[#1E1E2E] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#9090A0]">{t('detail.consensusResult')}</span>
              <span
                className="px-3 py-1 text-sm font-semibold rounded-lg"
                style={{
                  color: ACTION_COLORS[consensusAction] || '#94A3B8',
                  backgroundColor: `${ACTION_COLORS[consensusAction] || '#94A3B8'}20`,
                }}
              >
                {actionLabel[consensusAction] || consensusAction}
              </span>
            </div>
            {log.decision.confidence != null && log.decision.confidence > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-[#12121A] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(log.decision.confidence, 100)}%`,
                      backgroundColor: ACTION_COLORS[consensusAction] || '#94A3B8',
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-[#F8F8FC] w-12 text-right">
                  {Math.round(log.decision.confidence)}%
                </span>
              </div>
            )}
            <p className="text-xs text-[#606070]">
              {validVotes.length}/{votes.length} {t('detail.modelsCompleted')}
            </p>
          </div>

          {/* 各模型分析 */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#9090A0]">{t('detail.modelAnalysis')}</p>

            {validVotes.map((vote, idx) => {
              const isExpanded = expandedVotes.has(idx);
              const modelColor = getModelColor(vote.modelId);
              const isOpen = vote.action === 'open_long' || vote.action === 'open_short';

              return (
                <button
                  key={`${vote.modelId}-${idx}`}
                  type="button"
                  onClick={() => vote.reasoning ? toggleVoteExpand(idx) : undefined}
                  className="w-full text-left bg-[#1E1E2E] rounded-lg p-3 space-y-2"
                  style={{ borderLeft: `3px solid ${modelColor}`, borderRight: '1px solid #1E1E2E', borderTop: '1px solid #1E1E2E', borderBottom: '1px solid #1E1E2E' }}
                >
                  {/* 模型名 + 判断 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-[#F8F8FC] truncate">
                        {getModelName(vote.modelId)}
                      </span>
                      {getModelProvider(vote.modelId) && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#12121A] text-[#606070] flex-shrink-0">
                          {getModelProvider(vote.modelId)}
                        </span>
                      )}
                    </div>
                    <span
                      className="px-2 py-0.5 text-xs font-semibold rounded flex-shrink-0"
                      style={{
                        color: ACTION_COLORS[vote.action] || '#94A3B8',
                        backgroundColor: `${ACTION_COLORS[vote.action] || '#94A3B8'}15`,
                      }}
                    >
                      {actionLabel[vote.action] || vote.action}
                    </span>
                  </div>

                  {/* 置信度条 + 参数 */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-[#12121A] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(vote.confidence, 100)}%`,
                          backgroundColor: ACTION_COLORS[vote.action] || '#94A3B8',
                        }}
                      />
                    </div>
                    <span className="text-xs text-[#9090A0] w-9 text-right">{Math.round(vote.confidence)}%</span>
                  </div>

                  {/* 开仓参数（仅开多/开空时显示） */}
                  {isOpen && (
                    <div className="flex items-center gap-3 text-xs text-[#606070]">
                      <span>{t('detail.leverage')} {vote.weight || '-'}x</span>
                      {(vote as unknown as Record<string, unknown>).positionSizePercent != null && (
                        <>
                          <span className="text-[#2B3139]">·</span>
                          <span>{t('detail.positionSize')} {String((vote as unknown as Record<string, unknown>).positionSizePercent)}%</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* 展开分析推理 */}
                  {vote.reasoning && (
                    <div className="flex items-center text-xs">
                      <span className="text-[#06B6D4]">
                        {isExpanded ? t('detail.collapseReasoning') : t('detail.expandReasoning')}
                      </span>
                    </div>
                  )}
                  {isExpanded && vote.reasoning && (
                    <div className="pt-2 border-t border-[#1E1E2E]">
                      <TruncatedText text={vote.reasoning} maxLines={4} />
                    </div>
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
                    {t('detail.analysisFailed')}
                  </span>
                </div>
                {vote.error && (
                  <p className="text-xs text-[#F43F5E] mt-1">{vote.error}</p>
                )}
              </div>
            ))}
          </div>

          {/* 共识推理摘要 */}
          {log.decision.reasoning && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#9090A0]">{t('detail.consensusSummary')}</p>
              <div className="bg-[#1E1E2E] border border-[#1E1E2E] rounded-lg p-3">
                <TruncatedText text={log.decision.reasoning} maxLines={4} />
              </div>
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
