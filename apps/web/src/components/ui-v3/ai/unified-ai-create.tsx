'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  ChevronDown,
  Check,
  Search,
  Shield,
  Scale,
  Flame,
  Brain,
  Grid3X3,
  RotateCcw,
  FlaskConical,
  Zap,
  MessageSquare,
  X,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useStartResearch,
  useCreateStrategy,
  useStrategyControl,
  useAiConfig,
  useUpdateAiConfig,
  useAiLocaleSync,
} from '@/hooks/useAi';
import type { CreateStrategyBody } from '@/types/ai';
import { ExchangeKeySelector } from '@/components/ui-v3/ai/exchange-key-selector';
import { MODEL_DISPLAY, DEFAULT_DEBATE_MODELS } from '@/constants/debate';
import { useTranslations } from '@/i18n/provider';
import { useLocale } from 'next-intl';
import { PillGroup } from '@/components/ui-v3/ai/pill-group';
import { NumberStepper } from '@/components/ui-v3/ai/number-stepper';

// ═══════════════════ Types ═══════════════════

type ReasoningMode = 'research' | 'solo' | 'debate' | 'grid';
type ResearchDepth = 'quick' | 'standard' | 'deep';
type CoinSource = 'manual' | 'ai' | 'oi_top' | 'oi_low' | 'mixed';
type StrategyStyle = 'conservative' | 'balanced' | 'aggressive';
type Interval = '3m' | '5m' | '15m' | '30m' | '60m' | '4h' | '24h';

// ═══════════════════ Constants ═══════════════════

const REASONING_OPTION_KEYS: { key: ReasoningMode; icon: typeof Brain }[] = [
  { key: 'solo', icon: Zap },
  { key: 'debate', icon: MessageSquare },
  { key: 'research', icon: FlaskConical },
  { key: 'grid', icon: Grid3X3 },
];

const DEPTH_OPTION_KEYS: { value: ResearchDepth; time: string }[] = [
  { value: 'quick', time: '~1min' },
  { value: 'standard', time: '~3min' },
  { value: 'deep', time: '~5min' },
];

const ALL_SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT',
  'MATIC/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'FIL/USDT',
  'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT', 'INJ/USDT',
  'TIA/USDT', 'SEI/USDT', 'JUP/USDT', 'WIF/USDT', 'PEPE/USDT',
  'NEAR/USDT', 'FTM/USDT', 'AAVE/USDT', 'MKR/USDT', 'RENDER/USDT',
];

const POPULAR_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB'];
const COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ARB', 'OP'];
const GRID_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'];
/** 按策略性质提供不同间隔选项 */
const STRATEGY_INTERVALS: Record<ReasoningMode, Interval[]> = {
  research: ['15m', '30m', '60m', '4h'],
  solo:     ['3m', '5m', '15m', '30m', '60m'],
  debate:   ['5m', '15m', '30m', '60m'],
  grid:     ['3m', '5m', '15m', '30m'],
};
const STRATEGY_DEFAULT_INTERVAL: Record<ReasoningMode, Interval> = {
  research: '30m',
  solo:     '3m',
  debate:   '5m',
  grid:     '3m',
};

// placeholder 仅做输入引导，不暴露实际 system prompt 内容
const PROMPT_PLACEHOLDERS = {
  role: 'Hoot 已内置：专业加密合约交易员角色，具备风控意识。\n可追加您的风格偏好，例如：「优先顺势做多，避免逆势抄底」',
  tradingFrequency: 'Hoot 已内置：根据您的策略间隔自动判断交易节奏。\n可追加频率约束，例如：「每个周期最多开仓一次，不连续追单」',
  entryStandards: 'Hoot 已内置：RSI + MACD + EMA + 布林带综合信号判断。\n可追加您特别重视的信号，例如：「必须同时满足均线多头排列才入场」',
  decisionProcess: 'Hoot 已内置：完整多步骤分析框架（趋势→信号→风控→仓位）。\n可追加特殊约束，例如：「BTC 跌破 20 日均线时所有山寨币暂停开仓」',
};

const STRATEGY_PRESETS = {
  conservative: {
    icon: Shield,
    descKey: 'create.conservativeDesc',
    tagKeys: ['create.tagLev1_3', 'create.tagConf80', 'create.tagDD5'],
    params: {
      allocatedCapital: 10000, maxLeverage: 3, maxPositions: 2,
      dailyDrawdown: 5, maxDailyTrades: 5, cooldownMinutes: 30,
      maxPosition: 30, minConfidence: 80, minRR: 3,
      maxMarginUsage: 60, maxPerTrade: 10, circuitBreaker: 3,
      btcEthMaxPositionValueRatio: 3, altcoinMaxPositionValueRatio: 0.5,
      mainTimeframe: '4h', auxTimeframe: '1h',
      selectedTimeframes: ['1h', '4h', '1d'], primaryTimeframe: '4h', klineCount: 30,
    },
  },
  balanced: {
    icon: Scale,
    descKey: 'create.balancedDesc',
    tagKeys: ['create.tagLev3_5', 'create.tagConf70', 'create.tagDD10'],
    params: {
      allocatedCapital: 10000, maxLeverage: 5, maxPositions: 3,
      dailyDrawdown: 10, maxDailyTrades: 10, cooldownMinutes: 15,
      maxPosition: 50, minConfidence: 70, minRR: 2,
      maxMarginUsage: 80, maxPerTrade: 20, circuitBreaker: 5,
      btcEthMaxPositionValueRatio: 5, altcoinMaxPositionValueRatio: 1.0,
      mainTimeframe: '1h', auxTimeframe: '15m',
      selectedTimeframes: ['15m', '1h', '4h'], primaryTimeframe: '1h', klineCount: 30,
    },
  },
  aggressive: {
    icon: Flame,
    descKey: 'create.aggressiveDesc',
    tagKeys: ['create.tagLev5_10', 'create.tagConf60', 'create.tagDD15'],
    params: {
      allocatedCapital: 10000, maxLeverage: 10, maxPositions: 5,
      dailyDrawdown: 15, maxDailyTrades: 20, cooldownMinutes: 5,
      maxPosition: 70, minConfidence: 60, minRR: 1.5,
      maxMarginUsage: 90, maxPerTrade: 30, circuitBreaker: 7,
      btcEthMaxPositionValueRatio: 8, altcoinMaxPositionValueRatio: 2.0,
      mainTimeframe: '15m', auxTimeframe: '5m',
      selectedTimeframes: ['5m', '15m', '1h'], primaryTimeframe: '15m', klineCount: 50,
    },
  },
};

type PresetParams = typeof STRATEGY_PRESETS['balanced']['params'];

// ═══════════════════ Main Component ═══════════════════

export function UnifiedAiCreate() {
  const t = useTranslations('ai');
  const router = useRouter();
  const startResearch = useStartResearch();
  const createStrategy = useCreateStrategy();
  const strategyControl = useStrategyControl();
  const { data: aiConfig } = useAiConfig();
  useUpdateAiConfig(); // 保留 hook 调用以维持订阅，暂不使用返回值
  const appLocale = useLocale();
  useAiLocaleSync(appLocale);
  // ── Strategy mode selection ─────────────────────
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>('solo');
  const reasoningRef = useRef<HTMLDivElement>(null);

  // ── Model selection ─────────────────────────────
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const [debateModels, setDebateModels] = useState([...DEFAULT_DEBATE_MODELS]);
  const [showModelListDropdown, setShowModelListDropdown] = useState(false);
  const modelListRef = useRef<HTMLDivElement>(null);

  // ── Core state ─────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Shared fields ─────────────────────────────
  const [strategyName, setStrategyName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [exchangeApiKeyId, setExchangeApiKeyId] = useState<string | null>(null);
  // strategyStyle 用于 derivedPromptMode（prompt 配置的 mode 字段），固定 'balanced' 即可
  const [strategyStyle] = useState<StrategyStyle>('balanced');
  const [customParams, setCustomParams] = useState<PresetParams>(STRATEGY_PRESETS['balanced'].params);
  const [interval, setInterval_] = useState<Interval>(STRATEGY_DEFAULT_INTERVAL.solo);

  // ── Stop conditions ─────────────────────────────
  const [maxCycles, setMaxCycles] = useState(0);
  const [profitTarget, setProfitTarget] = useState(0);
  const [maxLoss, setMaxLoss] = useState(0);

  // ── Research-specific ─────────────────────────────
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [depth, setDepth] = useState<ResearchDepth>('standard');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [symbolLimit, setSymbolLimit] = useState<number | null>(null);

  // ── Solo/Debate: coins ─────────────────────────────
  const [coinSource, setCoinSource] = useState<CoinSource>('manual');
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [excludedCoins, setExcludedCoins] = useState<string[]>([]);
  const [maxCoins] = useState(5); // 提交时仍用于 coinSourceConfig.maxCoins，UI 不再展示选择器
  const [showExcludedCoins, setShowExcludedCoins] = useState(false);
  const [coinSearch, setCoinSearch] = useState('');
  const [minPositionSize, setMinPositionSize] = useState(100);
  // 日亏损上限（单位：$，直接金额，非百分比）
  const [maxDailyDrawdownDollar, setMaxDailyDrawdownDollar] = useState(500);
  // 利润回撤保护
  const [profitDrawdownEnabled, setProfitDrawdownEnabled] = useState(true);
  const [profitDrawdownMinProfit, setProfitDrawdownMinProfit] = useState(5);
  const [profitDrawdownMaxRetracement, setProfitDrawdownMaxRetracement] = useState(40);

  // ── Grid-specific ─────────────────────────────
  const [gridSymbol, setGridSymbol] = useState('BTC');
  const [gridCoinSearch, setGridCoinSearch] = useState('');
  const [gridCount, setGridCount] = useState(10);
  const [gridInvestment, setGridInvestment] = useState(1000);
  const [gridLeverage, setGridLeverage] = useState(1);
  const [gridUpperBound, setGridUpperBound] = useState(0);
  const [gridLowerBound, setGridLowerBound] = useState(0);
  const [gridMaxDrawdown, setGridMaxDrawdown] = useState(15);
  const [gridStopLoss, setGridStopLoss] = useState(5);

  // ── Prompt config ─────────────────────────────
  const [promptRole, setPromptRole] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [promptTradingFrequency, setPromptTradingFrequency] = useState('');
  const [promptEntryStandards, setPromptEntryStandards] = useState('');

  // ── UI toggles ─────────────────────────────
  const [showRiskControl, setShowRiskControl] = useState(false);
  const [showPromptConfig, setShowPromptConfig] = useState(false);
  const [showStopConditions, setShowStopConditions] = useState(false);

  // ── Derived state ─────────────────────────────
  const isResearch = reasoningMode === 'research';
  const isGrid = reasoningMode === 'grid';
  const isDebate = reasoningMode === 'debate';
  const derivedPromptMode = strategyStyle === 'aggressive' ? 'aggressive' : 'conservative';

  // currentReasoningKey removed; mode selector now uses tabs;

  // ── 智能默认名称 ─────────────────────────────
  const generateDefaultName = useCallback(
    (opts: { mode: ReasoningMode; coins: string[]; gSymbol: string; symbol: string }) => {
      if (opts.mode === 'research') {
        return `${opts.symbol.split('/')[0]} ${t('create.nameResearch')}`;
      }
      const modeLabel = opts.mode === 'grid'
        ? t('create.nameGrid')
        : opts.mode === 'debate' ? t('create.nameConsensus') : t('create.nameSolo');
      const coinNames = opts.mode === 'grid'
        ? opts.gSymbol
        : opts.coins.slice(0, 3).join(' ');
      return coinNames ? `${coinNames} ${modeLabel}` : modeLabel;
    },
    [],
  );

  const autoFillName = useCallback(
    (overrides?: Partial<{ mode: ReasoningMode; coins: string[]; gSymbol: string; symbol: string }>) => {
      if (nameManuallyEdited) return;
      setStrategyName(generateDefaultName({
        mode: overrides?.mode ?? reasoningMode,
        coins: overrides?.coins ?? selectedCoins,
        gSymbol: overrides?.gSymbol ?? gridSymbol,
        symbol: overrides?.symbol ?? selectedSymbol,
      }));
    },
    [nameManuallyEdited, generateDefaultName, reasoningMode, selectedCoins, gridSymbol, selectedSymbol],
  );

  // ── Effects ─────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setShowModelDropdown(false);
      if (modelListRef.current && !modelListRef.current.contains(e.target as Node)) setShowModelListDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (aiConfig?.amountPerTrade) {
      setCustomParams((p) => ({
        ...p,
        allocatedCapital: Math.max(p.allocatedCapital, aiConfig.amountPerTrade * 10),
      }));
    }
  }, [aiConfig]);

  const filteredSymbols = useMemo(() => {
    if (symbolSearch) {
      const q = symbolSearch.toUpperCase();
      return ALL_SYMBOLS.filter((s) => s.includes(q));
    }
    if (symbolLimit) return ALL_SYMBOLS.slice(0, symbolLimit);
    return POPULAR_SYMBOLS.map((s) => `${s}/USDT`);
  }, [symbolSearch, symbolLimit]);

  const allCoinNames = useMemo(() => [...new Set(ALL_SYMBOLS.map((s) => s.split('/')[0]))], []);
  const filteredCoins = useMemo(() => {
    if (!coinSearch) return COINS;
    const q = coinSearch.toUpperCase();
    return allCoinNames.filter((c) => c.includes(q));
  }, [coinSearch, allCoinNames]);
  const filteredGridCoins = useMemo(() => {
    if (!gridCoinSearch) return GRID_COINS;
    const q = gridCoinSearch.toUpperCase();
    return allCoinNames.filter((c) => c.includes(q));
  }, [gridCoinSearch, allCoinNames]);

  // ── Handlers ─────────────────────────────

  // 当前模式对应的间隔选项
  const intervals = STRATEGY_INTERVALS[reasoningMode];

  const handleReasoningChange = (mode: ReasoningMode) => {
    setReasoningMode(mode);
    autoFillName({ mode });
    // 切换模式时重置间隔为新模式的默认值（或保留当前值如果新列表中存在）
    const newIntervals = STRATEGY_INTERVALS[mode];
    if (!newIntervals.includes(interval)) {
      setInterval_(STRATEGY_DEFAULT_INTERVAL[mode]);
    }
  };

  const handleCoinToggle = (coin: string) => {
    setSelectedCoins((prev) => {
      const next = prev.includes(coin) ? prev.filter((c) => c !== coin) : [...prev, coin];
      // 延迟一帧，让 state 先更新
      setTimeout(() => autoFillName({ coins: next }), 0);
      return next;
    });
  };

  const handleQuickSelect = (count: number) => {
    const next = allCoinNames.slice(0, count);
    setSelectedCoins(next);
    autoFillName({ coins: next });
  };

  const handleExcludedCoinToggle = (coin: string) => {
    setExcludedCoins((prev) =>
      prev.includes(coin) ? prev.filter((c) => c !== coin) : [...prev, coin]
    );
  };

  const handleModelToggle = (modelId: string) => {
    setDebateModels((prev) => {
      const next = prev.includes(modelId)
        ? prev.filter((m) => m !== modelId)
        : [...prev, modelId];
      if (next.length < 2 || next.length > 5) return prev;
      return next;
    });
  };

  const intervalToMinutes = (v: string): number => {
    const map: Record<string, number> = { '3m': 3, '5m': 5, '15m': 15, '30m': 30, '60m': 60, '4h': 240, '24h': 1440 };
    return map[v] || 60;
  };

  // ── Submit ─────────────────────────────

  const handleSubmit = async (saveOnly: boolean) => {
    try {
      setIsSubmitting(true);
      const mins = intervalToMinutes(interval);

      // ===== Research =====
      if (isResearch) {
        const result = await startResearch.mutateAsync({
          symbol: selectedSymbol,
          depth,
          autoExecute: true,
          quickModel: selectedModel,
          ...(exchangeApiKeyId && { exchangeApiKeyId }),
          cyclingConfig: {
            enabled: true,
            intervalMinutes: mins,
            maxCycles,
            profitTargetPercent: profitTarget,
            maxLossPercent: maxLoss,
          },
          riskControlConfig: {
            maxPositions: customParams.maxPositions,
            maxLeverage: customParams.maxLeverage,
            maxDailyDrawdown: maxDailyDrawdownDollar,  // 直接$金额
            allocatedCapital: customParams.allocatedCapital,
            maxDailyTrades: customParams.maxDailyTrades,
            cooldownMinutes: customParams.cooldownMinutes,
            minPositionSize,
            minConfidence: customParams.minConfidence,
            minRiskRewardRatio: customParams.minRR,
            profitDrawdownEnabled,
            profitDrawdownMinProfit,
            profitDrawdownMaxRetracement,
          },
        });
        router.push(`/ai/research/${result.sessionId}`);
        return;
      }

      // ===== Strategy (Solo/Debate × Normal/Grid) =====
      const coinSourceModeMap: Record<CoinSource, string> = {
        manual: 'static', ai: 'ai', oi_top: 'oi_top', oi_low: 'oi_low', mixed: 'mixed',
      };
      const coins = selectedCoins.map((c) => `${c}/USDT:USDT`);
      const excluded = excludedCoins.map((c) => `${c}/USDT:USDT`);

      const body: Record<string, any> = {
        name: strategyName.trim() || generateDefaultName({ mode: reasoningMode, coins: selectedCoins, gSymbol: gridSymbol, symbol: selectedSymbol }),
        strategyType: isGrid ? 'grid' : 'normal',
        tradingMode: isDebate ? 'debate' : 'solo',
        coinSourceConfig: isGrid
          ? { mode: 'static', coins: [`${gridSymbol}/USDT:USDT`], maxCoins: 1 }
          : {
              mode: coinSourceModeMap[coinSource],
              coins,
              maxCoins,
              excludedCoins: excluded.length > 0 ? excluded : undefined,
            },
        indicatorConfig: {
          timeframe: customParams.primaryTimeframe || customParams.mainTimeframe,
          secondaryTimeframe: customParams.auxTimeframe,
          selectedTimeframes: customParams.selectedTimeframes,
          primaryTimeframe: customParams.primaryTimeframe,
          klineCount: customParams.klineCount,
          indicators: ['EMA:20,50', 'MACD', 'RSI:14', 'ATR:14', 'BOLL:20'],
        },
        riskControlConfig: {
          maxPositions: customParams.maxPositions,
          maxMarginUsage: customParams.maxMarginUsage,
          minPositionSize,
          maxLeverage: isGrid ? gridLeverage : customParams.maxLeverage,
          maxPositionPercent: customParams.maxPosition,
          minConfidence: customParams.minConfidence,
          minRiskRewardRatio: customParams.minRR,
          amountPerTrade: customParams.allocatedCapital * (customParams.maxPerTrade / 100),
          maxDailyDrawdown: maxDailyDrawdownDollar,  // 直接$金额，非百分比换算
          allocatedCapital: customParams.allocatedCapital,
          maxDailyTrades: customParams.maxDailyTrades,
          cooldownMinutes: customParams.cooldownMinutes,
          circuitBreaker: customParams.circuitBreaker,
          btcEthMaxPositionValueRatio: customParams.btcEthMaxPositionValueRatio,
          altcoinMaxPositionValueRatio: customParams.altcoinMaxPositionValueRatio,
          profitDrawdownEnabled,
          profitDrawdownMinProfit,
          profitDrawdownMaxRetracement,
        },
        intervalMinutes: mins,
        ...(exchangeApiKeyId && { exchangeApiKeyId }),
      };

      // Grid config
      if (isGrid) {
        body.gridConfig = {
          symbol: `${gridSymbol}/USDT:USDT`,
          gridCount, totalInvestment: gridInvestment, leverage: gridLeverage,
          upperBound: gridUpperBound,
          lowerBound: gridLowerBound,
          maxDrawdownPct: gridMaxDrawdown, stopLossPct: gridStopLoss,
        };
      }

      // Prompt config (non-Grid)
      if (!isGrid) {
        body.promptSections = {
          role: promptRole.trim() || undefined,
          mode: derivedPromptMode,
          custom: customPrompt.trim() || undefined,
          tradingFrequency: promptTradingFrequency.trim() || undefined,
          entryStandards: promptEntryStandards.trim() || undefined,
        };
      }

      // Debate models + config
      if (isDebate) {
        body.debateConfig = { maxRounds: 3, riskRounds: 3, temperature: 0.7 };
        body.coinSourceConfig.models = debateModels;
        body.models = debateModels;
      }

      // Solo/Grid: attach single model
      if (!isDebate) {
        body.coinSourceConfig.models = [selectedModel];
        body.models = [selectedModel];
      }

      // Stop conditions (non-Research)
      body.stopConditions = {
        maxCycles: maxCycles || 0,
        profitTargetPercent: profitTarget || 0,
        maxLossPercent: maxLoss || 0,
      };

      const result = await createStrategy.mutateAsync(body as CreateStrategyBody);

      if (!saveOnly && result.strategy?.id) {
        await strategyControl.mutateAsync({ id: result.strategy.id, action: 'start' });
      }

      router.push(`/ai/strategy/${result.strategy.id}`);
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Create failed:', error);
      }
      toast.error(error instanceof Error ? error.message : t('common.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reasoning mode label helpers ─────────────────────────────
  const getModeLabel = (key: ReasoningMode): string => {
    if (key === 'research') return t('modes.research');
    if (key === 'solo') return '极速';  // solo 模式品牌名称：极速（单模型，不同于共识debate≥2模型）
    if (key === 'grid') return t('modes.grid');
    return t('modes.debate');
  };

  const getModeDesc = (key: ReasoningMode): string => {
    if (key === 'research') return t('modes.researchDesc');
    if (key === 'solo') return t('modes.soloDesc');
    if (key === 'grid') return t('modes.gridDesc');
    return t('modes.debateDesc');
  };

  // ── Depth label helpers ─────────────────────────────
  const getDepthLabel = (value: ResearchDepth): string => {
    if (value === 'quick') return t('create.quick');
    if (value === 'deep') return t('create.deep');
    return t('create.standard');
  };

  // ── CoinSource label helpers ─────────────────────────────
  const getCoinSourceLabel = (src: CoinSource): string => {
    if (src === 'manual') return t('create.coinSourceManual');
    if (src === 'ai') return t('create.coinSourceAI');
    if (src === 'oi_top') return t('create.coinSourceOIHigh');
    if (src === 'oi_low') return t('create.coinSourceOILow');
    return t('create.coinSourceMixed');
  };

  // ═══════════════════ Render ═══════════════════

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC]">
      {/* ── Header ────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-[#1E1E2E] rounded-xl transition-colors"
            aria-label={t('common.back')} title={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold">{t('create.title')}</h1>
          <div className="w-9" />
        </div>
      </header>

      {/* ── Form content (single page scroll) ────────────────────────── */}
      <main className="pb-44 p-4 space-y-6">

        {/* ═══════════ 1. Reasoning Mode Tabs ═══════════ */}
        <div className="flex gap-1 bg-[#12121A] p-1 rounded-xl">
          {REASONING_OPTION_KEYS.map(({ key, icon: Icon }) => {
            const sel = reasoningMode === key;
            return (
              <button key={key} type="button" onClick={() => handleReasoningChange(key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                  sel ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30' : 'text-[#9090A0] hover:text-[#F8F8FC]'
                }`}
                aria-label={getModeLabel(key)} title={getModeLabel(key)}
              >
                <Icon className="w-4 h-4" />
                <span>{getModeLabel(key)}</span>
              </button>
            );
          })}
        </div>

        {/* ═══════════ 策略名称（所有模式固定显示）═══════════ */}
        <div className="space-y-2">
          <label className="block text-sm text-[#9090A0]">{t('create.strategyName')}</label>
          <input
            type="text"
            placeholder={t('create.strategyNamePlaceholder')}
            value={strategyName}
            onChange={(e) => {
              const val = e.target.value;
              setStrategyName(val);
              setNameManuallyEdited(val !== '');
            }}
            className="w-full px-4 py-3 bg-[#12121A] border border-[#1E1E2E] rounded-xl text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4] transition-colors"
            aria-label={t('create.strategyName')}
          />
        </div>

        {/* ═══════════ 交易所（所有模式固定显示）═══════════ */}
        <ExchangeKeySelector
          value={exchangeApiKeyId}
          onChange={setExchangeApiKeyId}
          label={t('create.exchangeAccount')}
        />

        {/* ═══════════ 交易目标 section ═══════════ */}

        {/* ═══════════ 5. Research: Coin Source + Single Coin + Depth ═══════════ */}
        {isResearch && (
          <>
            {/* 币种来源（与共识/极速一致）*/}
            <div className="space-y-3">
              <label className="block text-sm text-[#9090A0]">{t('create.coinSource')}</label>
              <div className="flex flex-wrap gap-2">
                {(['manual', 'ai', 'oi_top', 'oi_low', 'mixed'] as CoinSource[]).map((src) => (
                  <button
                    key={src} type="button"
                    onClick={() => setCoinSource(src)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      coinSource === src
                        ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                        : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                    }`}
                  >{getCoinSourceLabel(src)}</button>
                ))}
              </div>
              {coinSource !== 'manual' && coinSource !== 'mixed' && (
                <p className="text-xs text-[#606070]">
                  {coinSource === 'ai' && t('create.coinSourceAIDesc')}
                  {coinSource === 'oi_top' && t('create.coinSourceOIDesc')}
                  {coinSource === 'oi_low' && t('create.coinSourceOILowDesc')}
                </p>
              )}
            </div>

            {/* 手动/混合：单一交易对选择 */}
            {(coinSource === 'manual' || coinSource === 'mixed') && (
              <div className="space-y-3">
                <label className="block text-sm text-[#9090A0]">{t('create.tradingPair')}</label>

                {/* Tag-input：选中 chip + 内联搜索 */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl min-h-[40px]">
                  {selectedSymbol && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs">
                      {selectedSymbol.replace('/USDT', '')}
                      <X className="w-3 h-3 cursor-pointer hover:text-white"
                        onClick={() => setSelectedSymbol('')}
                      />
                    </span>
                  )}
                  <div className="flex items-center flex-1 min-w-[120px]">
                    <Search className="w-3.5 h-3.5 text-[#606070] mr-1.5 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={t('create.searchCoins')}
                      value={symbolSearch}
                      onChange={(e) => setSymbolSearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-[#F8F8FC] placeholder:text-[#606070] outline-none min-w-0"
                    />
                  </div>
                </div>

                {/* Quick select + Symbol list */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[#606070]">{t('create.quickSelect')}</span>
                    {[10, 20, 30].map((n) => (
                      <button key={n} type="button"
                        onClick={() => { setSymbolLimit(n); setSymbolSearch(''); }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-colors"
                      >Top {n}</button>
                    ))}
                    <button type="button" onClick={() => { setSelectedSymbol(''); setSymbolLimit(null); setSymbolSearch(''); }}
                      className="px-2.5 py-1 rounded-lg text-xs bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-colors"
                    >{t('common.clear')}</button>
                  </div>
                  {!symbolSearch && <div className="text-[10px] text-[#606070]">{t('create.popular')}</div>}
                  <div className="flex flex-wrap gap-1.5">
                    {filteredSymbols.map((symbol) => (
                      <button key={symbol} type="button"
                        onClick={() => { setSelectedSymbol(symbol); setSymbolSearch(''); setSymbolLimit(null); autoFillName({ symbol }); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedSymbol === symbol ? 'bg-[#06B6D4] text-black' : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                        }`}
                        aria-label={symbol} title={symbol}
                      >{symbol.replace('/USDT', '')}</button>
                    ))}
                    {symbolSearch && filteredSymbols.length === 0 && (
                      <span className="text-xs text-[#606070] py-2">{t('create.notFound')}</span>
                    )}
                  </div>
                </div>
              </div>
            )}


            <div className="space-y-3">
              <label className="block text-sm text-[#9090A0]">{t('create.researchDepth')}</label>
              <div className="flex gap-2">
                {DEPTH_OPTION_KEYS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDepth(opt.value)}
                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                      depth === opt.value
                        ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]'
                        : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                    }`}
                    aria-label={`${getDepthLabel(opt.value)} ${opt.time}`} title={`${getDepthLabel(opt.value)} ${opt.time}`}
                  >
                    <div className="text-sm">{getDepthLabel(opt.value)}</div>
                    <div className="text-xs mt-0.5 opacity-70">{opt.time}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══════════ 5b. Solo+Normal / Debate: Multi Coin Selection ═══════════ */}
        {(!isResearch && !isGrid) && (
          <>
            <div className="space-y-3">
              <label className="block text-sm text-[#9090A0]">{t('create.coinSource')}</label>
              <div className="flex flex-wrap gap-2">
                {(['manual', 'ai', 'oi_top', 'oi_low', 'mixed'] as CoinSource[]).map((src) => (
                  <button
                    key={src} type="button"
                    onClick={() => setCoinSource(src)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      coinSource === src ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]' : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                    }`}
                    aria-label={getCoinSourceLabel(src)} title={getCoinSourceLabel(src)}
                  >
                    {getCoinSourceLabel(src)}
                  </button>
                ))}
              </div>
              {coinSource !== 'manual' && (
                <p className="text-xs text-[#606070]">
                  {coinSource === 'ai' && t('create.coinSourceAIDesc')}
                  {coinSource === 'oi_top' && t('create.coinSourceOIDesc')}
                  {coinSource === 'oi_low' && t('create.coinSourceOILowDesc')}
                  {coinSource === 'mixed' && t('create.coinSourceMixedDesc')}
                </p>
              )}
            </div>

            {(coinSource === 'manual' || coinSource === 'mixed') && (
              <div className="space-y-3">
                <span className="text-sm text-[#9090A0]">
                  {coinSource === 'mixed' ? t('create.seedCoins') : t('create.tradingPair')}
                </span>

                {/* Tag-input：已选 chips + 内联搜索（单一输入区，消除双搜索框）*/}
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl min-h-[40px]">
                  {selectedCoins.map((coin) => (
                    <span key={coin} className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs">
                      {coin}
                      <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => handleCoinToggle(coin)} />
                    </span>
                  ))}
                  <div className="flex items-center flex-1 min-w-[120px]">
                    <Search className="w-3.5 h-3.5 text-[#606070] mr-1.5 flex-shrink-0" />
                    <input
                      type="text"
                      value={coinSearch}
                      onChange={(e) => setCoinSearch(e.target.value)}
                      placeholder={selectedCoins.length === 0 ? t('create.searchCoins') : ''}
                      className="flex-1 bg-transparent text-sm text-[#F8F8FC] placeholder:text-[#606070] outline-none min-w-0"
                    />
                  </div>
                </div>

                {/* Coin picker */}
                <div className="space-y-3">
                  {/* Quick select */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[#606070]">{t('create.quickSelect')}</span>
                    {[10, 20, 30].map((n) => (
                      <button key={n} type="button" onClick={() => handleQuickSelect(n)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-colors"
                      >Top {n}</button>
                    ))}
                    <button type="button" onClick={() => setSelectedCoins([])}
                      className="px-2.5 py-1 rounded-lg text-xs bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-colors"
                    >{t('common.clear')}</button>
                  </div>

                  {/* Coin chips */}
                  {!coinSearch && <div className="text-[10px] text-[#606070]">{t('create.popular')}</div>}
                  <div className="flex flex-wrap gap-1.5">
                    {filteredCoins.map((coin) => {
                      const sel = selectedCoins.includes(coin);
                      return (
                        <button key={coin} type="button" onClick={() => { handleCoinToggle(coin); setCoinSearch(''); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            sel ? 'bg-[#06B6D4] text-black' : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                          }`}
                          aria-label={coin} title={coin}
                        >{coin}</button>
                      );
                    })}
                    {coinSearch && filteredCoins.length === 0 && (
                      <span className="text-xs text-[#606070] py-2">{t('create.notFound')}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Excluded coins */}
            <div className="rounded-xl border border-[#1E1E2E] overflow-hidden">
              <button type="button" onClick={() => setShowExcludedCoins(!showExcludedCoins)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
                aria-label={t('create.excludeCoins')} title={t('create.excludeCoins')}
              >
                <span className="text-sm font-medium text-[#9090A0]">
                  {t('create.excludeCoins')} {excludedCoins.length > 0 && `(${excludedCoins.length})`}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showExcludedCoins ? 'rotate-180' : ''}`} />
              </button>
              {showExcludedCoins && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-[#606070] mb-3">{t('create.excludeCoinsDesc')}</p>
                  <div className="flex flex-wrap gap-2">
                    {COINS.map((coin) => {
                      const ex = excludedCoins.includes(coin);
                      return (
                        <button key={coin} type="button" onClick={() => handleExcludedCoinToggle(coin)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            ex ? 'bg-[#EF4444]/10 border border-[#EF4444] text-[#EF4444]' : 'bg-[#12121A] border border-[#1E1E2E] text-[#9090A0] hover:border-[#EF4444]/40'
                          }`}
                          aria-label={t('create.excludeCoin', { coin })} title={t('create.excludeCoin', { coin })}
                        >{coin}</button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════ 5c. Solo+Grid: Grid Params ═══════════ */}
        {isGrid && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Grid3X3 className="w-4 h-4 text-[#06B6D4]" />
              <h3 className="text-sm font-semibold">{t('create.gridParams')}</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-[#9090A0]">{t('create.gridPair')}</label>
                <span className="text-[10px] text-[#606070]">⚠ 网格仅支持单一交易对</span>
              </div>
              {/* Tag-input：选中 chip + 内联搜索 */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl min-h-[40px]">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs font-medium">
                  {gridSymbol}
                </span>
                <div className="flex items-center flex-1 min-w-[100px]">
                  <Search className="w-3.5 h-3.5 text-[#606070] mr-1.5 flex-shrink-0" />
                  <input
                    type="text"
                    value={gridCoinSearch}
                    onChange={(e) => setGridCoinSearch(e.target.value)}
                    placeholder="搜索更多..."
                    className="flex-1 bg-transparent text-sm text-[#F8F8FC] placeholder:text-[#606070] outline-none min-w-0"
                  />
                </div>
              </div>
              {!gridCoinSearch && <div className="text-[10px] text-[#606070]">{t('create.popular')}</div>}
              <div className="flex flex-wrap gap-1.5">
                {filteredGridCoins.map((coin) => (
                  <button key={coin} type="button"
                    onClick={() => { setGridSymbol(coin); setGridCoinSearch(''); autoFillName({ gSymbol: coin }); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      gridSymbol === coin ? 'bg-[#06B6D4] text-black' : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                    }`}
                    aria-label={coin} title={coin}
                  >{coin}</button>
                ))}
              </div>
            </div>

            <NumberStepper label="资金上限" value={gridInvestment} min={100} max={50000} step={100} prefix="$" onChange={setGridInvestment} />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-[#9090A0]">{t('create.gridLeverage')}</p>
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                  <input type="number" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0" min={1} max={20}
                    value={gridLeverage || ''} onChange={(e) => setGridLeverage(parseInt(e.target.value) || 0)}
                    aria-label={t('create.gridLeverage')}
                  />
                  <span className="text-[#606070] text-xs shrink-0">x</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#9090A0]">{t('create.gridCount')}</p>
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                  <input type="number" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0" min={5} max={100}
                    value={gridCount || ''} onChange={(e) => setGridCount(parseInt(e.target.value) || 0)}
                    aria-label={t('create.gridCount')}
                  />
                  <span className="text-[#606070] text-xs shrink-0">格</span>
                </div>
              </div>
            </div>

            {/* 配置后果预览：实时展示强平距离、每层保证金、风险等级 */}
            {(() => {
              const safeCount = Math.max(gridCount, 1);
              const safeLeverage = Math.max(gridLeverage, 1);
              const perLevelMargin = gridInvestment / safeCount;
              const liqDropPct = Math.floor((1 / safeLeverage) * 100);

              const risk = safeLeverage <= 1 ? { label: '安全',   color: '#10B981', bar: 10 }
                : safeLeverage <= 2           ? { label: '低风险', color: '#22C55E', bar: 25 }
                : safeLeverage <= 3           ? { label: '中等',   color: '#F59E0B', bar: 50 }
                : safeLeverage <= 5           ? { label: '较高',   color: '#EF4444', bar: 72 }
                :                               { label: '高风险', color: '#DC2626', bar: 92 };

              const rec = gridInvestment < 300  ? { leverage: 1, count: 5  }
                : gridInvestment < 1000         ? { leverage: 2, count: 6  }
                : gridInvestment < 3000         ? { leverage: 2, count: 8  }
                :                                 { leverage: 3, count: 10 };

              const showRec = safeLeverage > rec.leverage;

              return (
                <div className="p-3 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9090A0]">
                      每层保证金{' '}
                      <b className="text-[#F8F8FC]">${perLevelMargin.toFixed(0)}</b>
                      <span className="text-[#404060] mx-1.5">·</span>
                      强平距离{' '}
                      <b className="text-[#F8F8FC]">跌 {liqDropPct}%</b> 触发
                    </span>
                    <span className="font-medium" style={{ color: risk.color }}>{risk.label}</span>
                  </div>
                  <div className="h-1 bg-[#1E1E2E] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${risk.bar}%`, backgroundColor: risk.color }}
                    />
                  </div>
                  {showRec && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#606070]">
                        💡 ${gridInvestment} 建议 {rec.leverage}x · {rec.count}格，强平距离 &gt;{Math.floor(100 / rec.leverage)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => { setGridLeverage(rec.leverage); setGridCount(rec.count); }}
                        className="px-2 py-0.5 rounded bg-[#06B6D4]/15 text-[#06B6D4] hover:bg-[#06B6D4]/25 transition-colors"
                      >
                        应用
                      </button>
                    </div>
                  )}
                  {/* 可行性检查：极端市场（杠杆被压到 2x）下能运行几格 */}
                  {(() => {
                    const WORST_LEV_CAP = 2   // narrow/volatile regime 杠杆上限
                    const MIN_NOTIONAL  = 20  // Binance 合约最低名义值
                    const effLev = Math.min(safeLeverage, WORST_LEV_CAP)
                    const maxViable = Math.floor((gridInvestment * effLev) / MIN_NOTIONAL)
                    const idleCount = Math.max(0, gridCount - maxViable)
                    if (idleCount === 0) return null
                    const minInv = Math.ceil((gridCount * MIN_NOTIONAL) / effLev)
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

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-[#9090A0]">{t('create.gridUpperBound')}</p>
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                  <span className="text-[#606070] text-xs shrink-0">$</span>
                  <input type="number" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0" min={0}
                    value={gridUpperBound || ''} placeholder="0"
                    onChange={(e) => setGridUpperBound(parseFloat(e.target.value) || 0)}
                    aria-label={t('create.gridUpperBound')}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#9090A0]">{t('create.gridLowerBound')}</p>
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                  <span className="text-[#606070] text-xs shrink-0">$</span>
                  <input type="number" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0" min={0}
                    value={gridLowerBound || ''} placeholder="0"
                    onChange={(e) => setGridLowerBound(parseFloat(e.target.value) || 0)}
                    aria-label={t('create.gridLowerBound')}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-[#9090A0]">{t('create.gridMaxDrawdown')}</p>
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                  <input type="number" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0" min={1} max={100}
                    value={gridMaxDrawdown || ''} onChange={(e) => setGridMaxDrawdown(parseInt(e.target.value) || 0)}
                    aria-label={t('create.gridMaxDrawdown')}
                  />
                  <span className="text-[#606070] text-xs shrink-0">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#9090A0]">{t('create.gridStopLossPercent')}</p>
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                  <input type="number" className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0" min={1} max={100}
                    value={gridStopLoss || ''} onChange={(e) => setGridStopLoss(parseInt(e.target.value) || 0)}
                    aria-label={t('create.gridStopLossPercent')}
                  />
                  <span className="text-[#606070] text-xs shrink-0">%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ AI 模型 section ═══════════ */}
        <div className="h-px bg-[#1E1E2E]" />

        {/* ═══════════ 6. Model Selection ═══════════ */}
        {/* Single model dropdown for Research / Solo */}
        {!isDebate && (
          <div className="space-y-3">
            <label className="block text-sm text-[#9090A0]">LLM</label>
            <div className="relative" ref={modelRef}>
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
                aria-label={t('create.selectModel')} title={t('create.selectModel')}
              >
                <div className="flex items-center gap-3">
                  {MODEL_DISPLAY[selectedModel]?.logo ? (
                    <Image src={MODEL_DISPLAY[selectedModel].logo} alt={MODEL_DISPLAY[selectedModel].name} width={28} height={28} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ backgroundColor: MODEL_DISPLAY[selectedModel]?.color ?? '#64748B' }} />
                  )}
                  <div>
                    <div className="text-sm font-medium text-[#F8F8FC]">{MODEL_DISPLAY[selectedModel]?.name ?? selectedModel}</div>
                    <div className="text-xs text-[#606070]">{MODEL_DISPLAY[selectedModel]?.provider ?? ''}</div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showModelDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                  {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                    const sel = selectedModel === modelId;
                    return (
                      <button
                        key={modelId} type="button"
                        onClick={() => { setSelectedModel(modelId); setShowModelDropdown(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                          sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'
                        }`}
                      >
                        {info.logo ? (
                          <Image src={info.logo} alt={info.name} width={28} height={28} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ backgroundColor: info.color }} />
                        )}
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
        )}

        {/* Multi-model dropdown for Debate */}
        {isDebate && (
          <div className="space-y-2">
            <label className="block text-sm text-[#9090A0]">{t('create.consensusModels', { count: debateModels.length })}</label>
            <div className="relative" ref={modelListRef}>
              {/* Trigger — 图标堆叠 + 箭头 */}
              <button type="button"
                onClick={() => setShowModelListDropdown(!showModelListDropdown)}
                className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
              >
                <div className="flex items-center -space-x-2">
                  {debateModels.map((id) => {
                    const m = MODEL_DISPLAY[id];
                    return m?.logo
                      ? <Image key={id} src={m.logo} alt={m.name} width={28} height={28}
                          className="w-7 h-7 rounded-full border-2 border-[#12121A] object-cover" title={m.name} />
                      : <div key={id} className="w-7 h-7 rounded-full border-2 border-[#12121A]"
                          style={{ backgroundColor: m?.color || '#1E1E2E' }} title={m?.name} />;
                  })}
                </div>
                <ChevronDown className={`w-5 h-5 text-[#606070] transition-transform ${showModelListDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {showModelListDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-2xl max-h-[320px] overflow-y-auto">
                  <p className="px-4 pt-3 pb-1 text-xs text-[#606070]">{t('create.consensusModelsDesc')}</p>
                  {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                    const sel = debateModels.includes(modelId);
                    return (
                      <button key={modelId} type="button" onClick={() => handleModelToggle(modelId)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                          sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'
                        }`}
                        title={info.name}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#06B6D4]' : 'bg-[#1E1E2E]'}`}>
                          {sel && <Check className="w-3 h-3 text-[#F8F8FC]" />}
                        </div>
                        <Image src={info.logo} alt={info.name} width={24} height={24}
                          className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
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
          </div>
        )}

        {/* ═══════════ 7. Interval ═══════════ */}
        <div className="space-y-3">
          <label className="block text-sm text-[#9090A0]">{t('create.runInterval')}</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {intervals.map((iv) => (
              <button key={iv} type="button" onClick={() => setInterval_(iv)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  interval === iv ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]' : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                }`}
                aria-label={t('create.intervalLabel', { iv })} title={iv}
              >{iv}</button>
            ))}
          </div>
        </div>

        {/* ═══════════ 8. Grid Risk (inline, only Solo+Grid) ═══════════ */}
        {/* Grid risk is already embedded in grid params above (maxDrawdown, stopLoss) */}

        {/* ═══════════ 9. Risk Control Collapsible (non-Grid) ═══════════ */}
        {!isGrid && (
          <div className="rounded-xl border border-[#1E1E2E] overflow-hidden">
            <button type="button" onClick={() => setShowRiskControl(!showRiskControl)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
              aria-label={t('create.riskControl')} title={t('create.riskControl')}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#06B6D4]" />
                <div className="text-left">
                  <div className="text-sm font-medium text-[#9090A0]">{t('create.riskControl')}</div>
                  <div className="text-[10px] text-[#606070]">{t('create.riskControlDesc')}</div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showRiskControl ? 'rotate-180' : ''}`} />
            </button>
            {showRiskControl && (
              <div className="px-4 pb-4 space-y-4">
                {/* 资金上限 */}
                <div className="space-y-1">
                  <p className="text-xs text-[#9090A0]">{t('create.allocatedCapital')}</p>
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                    <span className="text-[#606070] text-xs">$</span>
                    <input type="number" min={500} max={100000}
                      value={customParams.allocatedCapital || ''}
                      onChange={(e) => setCustomParams((p) => ({ ...p, allocatedCapital: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                    />
                  </div>
                </div>

                {/* 2列风控参数网格 */}
                <div className="grid grid-cols-2 gap-2">
                  {/* 最大杠杆 */}
                  <div>
                    <p className="text-[10px] text-[#606070] mb-1">{t('create.maxLeverage')}</p>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <input type="number" min={1} max={100}
                        value={customParams.maxLeverage || ''}
                        onChange={(e) => setCustomParams((p) => ({ ...p, maxLeverage: parseFloat(e.target.value) || 0 }))}
                        className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                      />
                      <span className="text-[#606070] text-xs">x</span>
                    </div>
                  </div>
                  {/* 日亏损上限（$，非%） */}
                  <div>
                    <p className="text-[10px] text-[#606070] mb-1">日亏损上限</p>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <span className="text-[#606070] text-xs">$</span>
                      <input type="number" min={0}
                        value={maxDailyDrawdownDollar || ''}
                        onChange={(e) => setMaxDailyDrawdownDollar(parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                      />
                    </div>
                  </div>
                  {/* 每日最大交易 */}
                  <div>
                    <p className="text-[10px] text-[#606070] mb-1">{t('create.maxDailyTrades')}</p>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <input type="number" min={1} max={200}
                        value={customParams.maxDailyTrades || ''}
                        onChange={(e) => setCustomParams((p) => ({ ...p, maxDailyTrades: parseInt(e.target.value) || 0 }))}
                        className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                      />
                      <span className="text-[#606070] text-xs">次</span>
                    </div>
                  </div>
                  {/* 冷却时间 */}
                  <div>
                    <p className="text-[10px] text-[#606070] mb-1">{t('create.cooldownMinutes')}</p>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <input type="number" min={0} max={1440}
                        value={customParams.cooldownMinutes || ''}
                        onChange={(e) => setCustomParams((p) => ({ ...p, cooldownMinutes: parseInt(e.target.value) || 0 }))}
                        className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                      />
                      <span className="text-[#606070] text-xs">min</span>
                    </div>
                  </div>
                  {/* 最低置信度 */}
                  <div>
                    <p className="text-[10px] text-[#606070] mb-1">{t('create.minConfidence')}</p>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <input type="number" min={0} max={100}
                        value={customParams.minConfidence || ''}
                        onChange={(e) => setCustomParams((p) => ({ ...p, minConfidence: parseInt(e.target.value) || 0 }))}
                        className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                      />
                      <span className="text-[#606070] text-xs">%</span>
                    </div>
                  </div>
                  {/* 最低盈亏比 */}
                  <div>
                    <p className="text-[10px] text-[#606070] mb-1">最低盈亏比</p>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <input type="number" min={0} max={20} step={0.1}
                        value={customParams.minRR || ''}
                        onChange={(e) => setCustomParams((p) => ({ ...p, minRR: parseFloat(e.target.value) || 0 }))}
                        className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                      />
                      <span className="text-[#606070] text-xs">:1</span>
                    </div>
                  </div>
                  {/* 最小持仓 */}
                  <div>
                    <p className="text-[10px] text-[#606070] mb-1">{t('create.minPositionSize')}</p>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                      <span className="text-[#606070] text-xs">$</span>
                      <input type="number" min={0}
                        value={minPositionSize || ''}
                        onChange={(e) => setMinPositionSize(parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                      />
                    </div>
                  </div>
                </div>

                {/* 利润回撤保护 */}
                <div className="pt-3 border-t border-[#1E1E2E]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-[#06B6D4]" />
                      <span className="text-sm font-medium text-[#9090A0]">{t('create.profitDrawdown')}</span>
                    </div>
                    <button type="button"
                      onClick={() => setProfitDrawdownEnabled(!profitDrawdownEnabled)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${profitDrawdownEnabled ? 'bg-[#06B6D4]' : 'bg-[#1E1E2E]'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${profitDrawdownEnabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  {profitDrawdownEnabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-[#606070] mb-1">{t('create.profitDrawdownMinProfit')}</p>
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                          <input type="number" min={1} max={50} step={1}
                            value={profitDrawdownMinProfit || ''}
                            onChange={(e) => setProfitDrawdownMinProfit(parseFloat(e.target.value) || 5)}
                            className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                          />
                          <span className="text-[#606070] text-xs">%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#606070] mb-1">{t('create.profitDrawdownMaxRetracement')}</p>
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl">
                          <input type="number" min={10} max={80} step={5}
                            value={profitDrawdownMaxRetracement || ''}
                            onChange={(e) => setProfitDrawdownMaxRetracement(parseFloat(e.target.value) || 40)}
                            className="flex-1 bg-transparent text-sm text-[#F8F8FC] outline-none min-w-0"
                          />
                          <span className="text-[#606070] text-xs">%</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-[#606070] mt-1">{t('create.profitDrawdownDesc')}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ 10. Stop Conditions Collapsible ═══════════ */}
        <div className="rounded-xl border border-[#1E1E2E] overflow-hidden">
          <button type="button" onClick={() => setShowStopConditions(!showStopConditions)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
            aria-label={t('create.stopConditions')} title={t('create.stopConditions')}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-sm font-medium text-[#9090A0]">{t('create.stopConditionsOptional')}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showStopConditions ? 'rotate-180' : ''}`} />
          </button>
          {showStopConditions && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-[#606070]">{t('create.stopConditionsDesc')}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9090A0] w-20 shrink-0">{t('create.maxCycles')}</span>
                <input type="number" min={0} value={maxCycles || ''} onChange={(e) => setMaxCycles(parseInt(e.target.value) || 0)}
                  placeholder={t('common.unlimited')} className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-[#06B6D4]/40 focus:outline-none"
                />
                <span className="text-xs text-[#606070]">{t('common.times')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9090A0] w-20 shrink-0">{t('create.profitTarget')}</span>
                <input type="number" min={0} value={profitTarget || ''} onChange={(e) => setProfitTarget(parseFloat(e.target.value) || 0)}
                  placeholder={t('common.unlimited')} className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-[#06B6D4]/40 focus:outline-none"
                />
                <span className="text-xs text-[#606070]">%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9090A0] w-20 shrink-0">{t('create.maxLoss')}</span>
                <input type="number" min={0} value={maxLoss || ''} onChange={(e) => setMaxLoss(parseFloat(e.target.value) || 0)}
                  placeholder={t('common.unlimited')} className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-[#06B6D4]/40 focus:outline-none"
                />
                <span className="text-xs text-[#606070]">%</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ 11. Prompt Config Collapsible (non-Grid, non-Research) ═══════════ */}
        {!isGrid && !isResearch && (
          <div className="rounded-xl border border-[#1E1E2E] overflow-hidden">
            <button type="button" onClick={() => setShowPromptConfig(!showPromptConfig)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#12121A] transition-colors"
              aria-label={t('create.customInstructions')} title={t('create.customInstructions')}
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#06B6D4]" />
                <span className="text-sm font-medium text-[#9090A0]">{t('create.customInstructions')}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showPromptConfig ? 'rotate-180' : ''}`} />
            </button>
            {showPromptConfig && (
              <div className="px-4 pb-4 space-y-4">
                {/* 系统能力说明 */}
                <div className="bg-[#06B6D4]/5 border border-[#06B6D4]/15 rounded-lg px-3 py-2.5">
                  <p className="text-[11px] text-[#06B6D4]/80 leading-relaxed">
                    {t('create.customInstructionsInfo')}
                  </p>
                </div>

                {[
                  { id: 'role', label: t('create.promptRole'), val: promptRole, set: setPromptRole, ph: PROMPT_PLACEHOLDERS.role, max: 300 },
                  { id: 'frequency', label: t('create.promptFrequency'), val: promptTradingFrequency, set: setPromptTradingFrequency, ph: PROMPT_PLACEHOLDERS.tradingFrequency, max: 300 },
                  { id: 'entry', label: t('create.promptEntry'), val: promptEntryStandards, set: setPromptEntryStandards, ph: PROMPT_PLACEHOLDERS.entryStandards, max: 300 },
                  { id: 'decision', label: t('create.promptDecision'), val: customPrompt, set: setCustomPrompt, ph: PROMPT_PLACEHOLDERS.decisionProcess, max: 500 },
                ].map((sec) => (
                  <details key={sec.id} className="group">
                    <summary className="flex items-center justify-between cursor-pointer list-none text-xs text-[#9090A0] py-1.5 select-none">
                      <span>{sec.label}</span>
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        placeholder={sec.ph} value={sec.val} onChange={(e) => sec.set(e.target.value)}
                        rows={3} maxLength={sec.max}
                        className="w-full px-3 py-2 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4] resize-none"
                        aria-label={sec.label}
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-[#606070]">{sec.val.length}/{sec.max}</p>
                        {sec.val && (
                          <button type="button" onClick={() => sec.set('')}
                            className="flex items-center gap-1 text-[10px] text-[#606070] hover:text-[#06B6D4] transition-colors"
                            aria-label={t('common.clear')} title={t('common.clear')}
                          >
                            <X className="w-3 h-3" />{t('common.clear')}
                          </button>
                        )}
                      </div>
                    </div>
                  </details>
                ))}

              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Fixed bottom buttons ────────────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 md:bottom-0 md:left-60 bg-[#0A0A0F]/95 backdrop-blur-lg border-t border-[#1E1E2E] px-4 py-3 z-20">
        <div className="flex gap-2">
          <button type="button" onClick={() => handleSubmit(true)} disabled={isSubmitting}
            className={`flex-1 py-2.5 text-sm bg-[#12121A] hover:bg-[#1E1E2E] text-[#9090A0] font-medium rounded-lg border border-[#1E1E2E] transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={t('create.saveOnly')} title={t('create.saveOnly')}
          >
            {isSubmitting ? t('common.saving') : t('create.saveOnly')}
          </button>
          <button type="button" onClick={() => handleSubmit(false)} disabled={isSubmitting}
            className={`flex-[2] py-2.5 text-sm bg-[#06B6D4] hover:bg-[#0891B2] text-[#F8F8FC] font-semibold rounded-lg transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={t('create.saveAndStart')} title={t('create.saveAndStart')}
          >
            {isSubmitting ? t('common.creating') : t('create.saveAndStart')}
          </button>
        </div>
      </div>

    </div>
  );
}
