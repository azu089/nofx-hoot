'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useStartResearch,
  useCreateStrategy,
  useStrategyControl,
  useAiConfig,
  useUpdateAiConfig,
} from '@/hooks/useAi';
import type { CreateStrategyBody } from '@/types/ai';
import { ExchangeKeySelector } from '@/components/ui-v3/ai/exchange-key-selector';
import { MODEL_DISPLAY, DEFAULT_DEBATE_MODELS } from '@/constants/debate';
import { useTranslations } from '@/i18n/provider';

// ═══════════════════ Types ═══════════════════

type ReasoningMode = 'research' | 'solo' | 'debate';
type StrategyType = 'normal' | 'grid';
type ResearchDepth = 'quick' | 'standard' | 'deep';
type CoinSource = '手动选择' | 'AI推荐' | 'OI榜' | 'OI低' | '混合';
type StrategyStyle = '保守型' | '均衡型' | '激进型';
type Interval = '15m' | '30m' | '60m' | '4h' | '24h';

// ═══════════════════ Constants ═══════════════════

const REASONING_OPTION_KEYS: { key: ReasoningMode; icon: typeof Brain }[] = [
  { key: 'research', icon: FlaskConical },
  { key: 'solo', icon: Zap },
  { key: 'debate', icon: MessageSquare },
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
const INTERVALS: Interval[] = ['15m', '30m', '60m', '4h', '24h'];

// placeholder 仅做输入引导，不暴露实际 system prompt 内容
const PROMPT_PLACEHOLDERS = {
  role: 'Hoot 已内置：专业加密合约交易员角色，具备风控意识。\n可追加您的风格偏好，例如：「优先顺势做多，避免逆势抄底」',
  tradingFrequency: 'Hoot 已内置：根据您的策略间隔自动判断交易节奏。\n可追加频率约束，例如：「每个周期最多开仓一次，不连续追单」',
  entryStandards: 'Hoot 已内置：RSI + MACD + EMA + 布林带综合信号判断。\n可追加您特别重视的信号，例如：「必须同时满足均线多头排列才入场」',
  decisionProcess: 'Hoot 已内置：完整多步骤分析框架（趋势→信号→风控→仓位）。\n可追加特殊约束，例如：「BTC 跌破 20 日均线时所有山寨币暂停开仓」',
};

const STRATEGY_PRESET_KEYS = ['保守型', '均衡型', '激进型'] as const;

const STRATEGY_PRESETS = {
  保守型: {
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
  均衡型: {
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
  激进型: {
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

type PresetParams = typeof STRATEGY_PRESETS['均衡型']['params'];

// ═══════════════════ Helper Components ═══════════════════

function SliderField({
  label, value, onChange, min, max, step = 1, unit = '',
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[#9090A0]">{label}</label>
        <span className="text-sm font-semibold text-[#F8F8FC]">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-[#1E1E2E] rounded-xl appearance-none cursor-pointer slider-thumb"
        aria-label={label} title={label}
      />
    </div>
  );
}

// ═══════════════════ Main Component ═══════════════════

export function UnifiedAiCreate() {
  const t = useTranslations('ai');
  const router = useRouter();
  const startResearch = useStartResearch();
  const createStrategy = useCreateStrategy();
  const strategyControl = useStrategyControl();
  const { data: aiConfig } = useAiConfig();
  const updateAiConfig = useUpdateAiConfig();
  // ── Two-dimensional selection ─────────────────────
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>('research');
  const [strategyType, setStrategyType] = useState<StrategyType>('normal');
  const [showReasoningDropdown, setShowReasoningDropdown] = useState(false);
  const reasoningRef = useRef<HTMLDivElement>(null);

  // ── Model selection ─────────────────────────────
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const [debateModels, setDebateModels] = useState([...DEFAULT_DEBATE_MODELS]);

  // ── Core state ─────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Shared fields ─────────────────────────────
  const [strategyName, setStrategyName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [exchangeApiKeyId, setExchangeApiKeyId] = useState<string | null>(null);
  const [strategyStyle, setStrategyStyle] = useState<StrategyStyle>('均衡型');
  const [customParams, setCustomParams] = useState<PresetParams>(STRATEGY_PRESETS['均衡型'].params);
  const [interval, setInterval_] = useState<Interval>('60m');

  // ── Stop conditions ─────────────────────────────
  const [maxCycles, setMaxCycles] = useState(0);
  const [profitTarget, setProfitTarget] = useState(0);
  const [maxLoss, setMaxLoss] = useState(0);

  // ── Research-specific ─────────────────────────────
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [depth, setDepth] = useState<ResearchDepth>('standard');
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Solo/Debate: coins ─────────────────────────────
  const [coinSource, setCoinSource] = useState<CoinSource>('手动选择');
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [excludedCoins, setExcludedCoins] = useState<string[]>([]);
  const [maxCoins, setMaxCoins] = useState(5);
  const [showExcludedCoins, setShowExcludedCoins] = useState(false);
  const [coinSearch, setCoinSearch] = useState('');
  const [showCoinPicker, setShowCoinPicker] = useState(false);

  // ── Grid-specific ─────────────────────────────
  const [gridSymbol, setGridSymbol] = useState('BTC');
  const [gridCount, setGridCount] = useState(10);
  const [gridInvestment, setGridInvestment] = useState(1000);
  const [gridLeverage, setGridLeverage] = useState(1);
  const [gridBoundsMode, setGridBoundsMode] = useState<'auto' | 'manual'>('auto');
  const [gridUpperBound, setGridUpperBound] = useState(0);
  const [gridLowerBound, setGridLowerBound] = useState(0);
  const [gridAtrMultiplier, setGridAtrMultiplier] = useState(2);
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
  const isGrid = strategyType === 'grid' && reasoningMode === 'solo';
  const isDebate = reasoningMode === 'debate';
  const showStrategyType = reasoningMode === 'solo';
  const derivedPromptMode = strategyStyle === '激进型' ? 'aggressive' : 'conservative';

  const currentReasoningKey = REASONING_OPTION_KEYS.find((o) => o.key === reasoningMode)!;

  // ── 智能默认名称 ─────────────────────────────
  const generateDefaultName = useCallback(
    (opts: { mode: ReasoningMode; sType: StrategyType; coins: string[]; gSymbol: string; symbol: string }) => {
      if (opts.mode === 'research') {
        return `${opts.symbol.split('/')[0]} ${t('create.nameResearch')}`;
      }
      const modeLabel = (opts.sType === 'grid' && opts.mode === 'solo')
        ? t('create.nameGrid')
        : opts.mode === 'debate' ? t('create.nameConsensus') : t('create.nameSolo');
      const coinNames = (opts.sType === 'grid' && opts.mode === 'solo')
        ? opts.gSymbol
        : opts.coins.slice(0, 3).join(' ');
      return coinNames ? `${coinNames} ${modeLabel}` : modeLabel;
    },
    [],
  );

  const autoFillName = useCallback(
    (overrides?: Partial<{ mode: ReasoningMode; sType: StrategyType; coins: string[]; gSymbol: string; symbol: string }>) => {
      if (nameManuallyEdited) return;
      setStrategyName(generateDefaultName({
        mode: overrides?.mode ?? reasoningMode,
        sType: overrides?.sType ?? strategyType,
        coins: overrides?.coins ?? selectedCoins,
        gSymbol: overrides?.gSymbol ?? gridSymbol,
        symbol: overrides?.symbol ?? selectedSymbol,
      }));
    },
    [nameManuallyEdited, generateDefaultName, reasoningMode, strategyType, selectedCoins, gridSymbol, selectedSymbol],
  );

  // ── Effects ─────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowSymbolDropdown(false);
      if (reasoningRef.current && !reasoningRef.current.contains(e.target as Node)) setShowReasoningDropdown(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setShowModelDropdown(false);
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
    if (!symbolSearch) return POPULAR_SYMBOLS.map((s) => `${s}/USDT`);
    const q = symbolSearch.toUpperCase();
    return ALL_SYMBOLS.filter((s) => s.includes(q));
  }, [symbolSearch]);

  const allCoinNames = useMemo(() => [...new Set(ALL_SYMBOLS.map((s) => s.split('/')[0]))], []);
  const filteredCoins = useMemo(() => {
    if (!coinSearch) return COINS;
    const q = coinSearch.toUpperCase();
    return allCoinNames.filter((c) => c.includes(q));
  }, [coinSearch, allCoinNames]);

  // ── Handlers ─────────────────────────────

  const handleReasoningChange = (mode: ReasoningMode) => {
    setReasoningMode(mode);
    const sType = mode !== 'solo' ? 'normal' : strategyType;
    if (mode !== 'solo') setStrategyType('normal');
    setShowReasoningDropdown(false);
    autoFillName({ mode, sType });
  };

  const handleStyleChange = (style: StrategyStyle) => {
    setStrategyStyle(style);
    setCustomParams(STRATEGY_PRESETS[style].params);
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
    const map: Record<string, number> = { '15m': 15, '30m': 30, '60m': 60, '4h': 240, '24h': 1440 };
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
            maxDailyDrawdown: customParams.dailyDrawdown,
            allocatedCapital: customParams.allocatedCapital,
            maxDailyTrades: customParams.maxDailyTrades,
            cooldownMinutes: customParams.cooldownMinutes,
          },
        });
        router.push(`/ai/research/${result.sessionId}`);
        return;
      }

      // ===== Strategy (Solo/Debate × Normal/Grid) =====
      const coinSourceModeMap: Record<string, string> = {
        '手动选择': 'static', 'AI推荐': 'ai', OI榜: 'oi_top', OI低: 'oi_low', '混合': 'mixed',
      };
      const coins = selectedCoins.map((c) => `${c}/USDT:USDT`);
      const excluded = excludedCoins.map((c) => `${c}/USDT:USDT`);

      const modeLabel = isDebate ? t('create.nameConsensus') : isGrid ? t('create.nameGrid') : t('create.nameSolo');
      const body: Record<string, any> = {
        name: strategyName.trim() || generateDefaultName({ mode: reasoningMode, sType: strategyType, coins: selectedCoins, gSymbol: gridSymbol, symbol: selectedSymbol }),
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
          minPositionSize: 12,
          maxLeverage: isGrid ? gridLeverage : customParams.maxLeverage,
          maxPositionPercent: customParams.maxPosition,
          minConfidence: customParams.minConfidence,
          minRiskReward: customParams.minRR,
          amountPerTrade: customParams.allocatedCapital * (customParams.maxPerTrade / 100),
          maxDailyDrawdown: customParams.allocatedCapital * (customParams.dailyDrawdown / 100),
          allocatedCapital: customParams.allocatedCapital,
          maxDailyTrades: customParams.maxDailyTrades,
          cooldownMinutes: customParams.cooldownMinutes,
          circuitBreaker: customParams.circuitBreaker,
          btcEthMaxPositionValueRatio: customParams.btcEthMaxPositionValueRatio,
          altcoinMaxPositionValueRatio: customParams.altcoinMaxPositionValueRatio,
        },
        intervalMinutes: mins,
        ...(exchangeApiKeyId && { exchangeApiKeyId }),
      };

      // Grid config
      if (isGrid) {
        body.gridConfig = {
          symbol: `${gridSymbol}/USDT:USDT`,
          gridCount, totalInvestment: gridInvestment, leverage: gridLeverage,
          useAtrBounds: gridBoundsMode === 'auto', atrMultiplier: gridAtrMultiplier,
          upperBound: gridBoundsMode === 'manual' ? gridUpperBound : 0,
          lowerBound: gridBoundsMode === 'manual' ? gridLowerBound : 0,
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
      }

      // Solo/Grid: attach single model
      if (!isDebate) {
        body.coinSourceConfig.models = [selectedModel];
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
    } catch (error: any) {
      console.error('Create failed:', error);
      toast.error(error.message || t('common.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Style label helpers ─────────────────────────────
  const getStyleLabel = (style: StrategyStyle): string => {
    if (style === '保守型') return t('create.conservative');
    if (style === '激进型') return t('create.aggressive');
    return t('create.balanced');
  };

  // ── Reasoning mode label helpers ─────────────────────────────
  const getModeLabel = (key: ReasoningMode): string => {
    if (key === 'research') return t('modes.research');
    if (key === 'solo') return t('modes.solo');
    return t('modes.debate');
  };

  const getModeDesc = (key: ReasoningMode): string => {
    if (key === 'research') return t('modes.researchDesc');
    if (key === 'solo') return t('modes.soloDesc');
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
    if (src === '手动选择') return t('create.coinSourceManual');
    if (src === 'AI推荐') return t('create.coinSourceAI');
    if (src === 'OI榜') return t('create.coinSourceOIHigh');
    if (src === 'OI低') return t('create.coinSourceOILow');
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

        {/* ═══════════ 1. Reasoning Mode Dropdown ═══════════ */}
        <div className="space-y-2">
          <label className="block text-sm text-[#9090A0]">{t('create.reasoningMode')}</label>
          <div className="relative" ref={reasoningRef}>
            <button
              type="button"
              onClick={() => setShowReasoningDropdown(!showReasoningDropdown)}
              className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
              aria-label={t('create.selectMode')} title={t('create.selectMode')}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#06B6D4]/15 flex items-center justify-center">
                  <currentReasoningKey.icon className="w-4 h-4 text-[#06B6D4]" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-[#F8F8FC]">{getModeLabel(currentReasoningKey.key)}</div>
                  <div className="text-xs text-[#606070]">{getModeDesc(currentReasoningKey.key)}</div>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-[#606070] transition-transform ${showReasoningDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showReasoningDropdown && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-xl shadow-2xl overflow-hidden">
                {REASONING_OPTION_KEYS.map((opt) => {
                  const Icon = opt.icon;
                  const sel = reasoningMode === opt.key;
                  return (
                    <button
                      key={opt.key} type="button"
                      onClick={() => handleReasoningChange(opt.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        sel ? 'bg-[#06B6D4]/10' : 'hover:bg-[#1E1E2E]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sel ? 'bg-[#06B6D4]/20' : 'bg-[#1E1E2E]'}`}>
                        <Icon className={`w-4 h-4 ${sel ? 'text-[#06B6D4]' : 'text-[#9090A0]'}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-sm font-medium ${sel ? 'text-[#06B6D4]' : 'text-[#F8F8FC]'}`}>{getModeLabel(opt.key)}</div>
                        <div className="text-xs text-[#606070]">{getModeDesc(opt.key)}</div>
                      </div>
                      {sel && <Check className="w-4 h-4 text-[#06B6D4]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════ 策略名称 ═══════════ */}
        {!isResearch && (
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
        )}

        {/* ═══════════ 2. Strategy Type Toggle (Solo only) ═══════════ */}
        {showStrategyType && (
          <div className="space-y-2">
            <label className="block text-sm text-[#9090A0]">{t('create.strategyName')}</label>
            <div className="flex gap-2">
              {([
                { key: 'normal' as StrategyType, label: t('modes.solo'), icon: Zap },
                { key: 'grid' as StrategyType, label: t('modes.grid'), icon: Grid3X3 },
              ]).map((opt) => {
                const sel = strategyType === opt.key;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key} type="button"
                    onClick={() => { setStrategyType(opt.key); autoFillName({ sType: opt.key }); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      sel
                        ? 'bg-[#06B6D4]/10 border border-[#06B6D4] text-[#06B6D4]'
                        : 'bg-[#12121A] border border-[#1E1E2E] text-[#9090A0] hover:border-[#06B6D4]/40'
                    }`}
                    aria-label={opt.label} title={opt.label}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════ 交易目标 section ═══════════ */}

        {/* ═══════════ 5. Research: Single Coin + Depth ═══════════ */}
        {isResearch && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-[#9090A0]">{t('create.selectCoins')}</label>
                <button type="button" onClick={() => setShowSymbolDropdown(!showSymbolDropdown)}
                  className="text-xs text-[#06B6D4]"
                >
                  {showSymbolDropdown ? t('create.collapseCoins') : t('create.selectCoins2')}
                </button>
              </div>

              {/* Selected chip container */}
              <div
                className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl min-h-[40px] cursor-text"
                onClick={() => setShowSymbolDropdown(true)}
              >
                {selectedSymbol ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs">
                    {selectedSymbol}
                    <X className="w-3 h-3 cursor-pointer hover:text-white"
                      onClick={(e) => { e.stopPropagation(); setSelectedSymbol('BTC/USDT'); }}
                    />
                  </span>
                ) : (
                  <span className="text-xs text-[#606070]">{t('create.clickToSelect')}</span>
                )}
              </div>

              {/* Expandable picker */}
              {showSymbolDropdown && (
                <div className="space-y-2">
                  {/* Quick select */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[#606070]">{t('create.quickSelect')}</span>
                    {[10, 20, 30].map((n) => (
                      <button key={n} type="button"
                        onClick={() => setSelectedSymbol(ALL_SYMBOLS[n - 1] ?? ALL_SYMBOLS[0])}
                        className="px-2.5 py-1 rounded-lg text-xs bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-colors"
                      >Top {n}</button>
                    ))}
                    <button type="button" onClick={() => setSelectedSymbol('BTC/USDT')}
                      className="px-2.5 py-1 rounded-lg text-xs bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A] transition-colors"
                    >{t('common.clear')}</button>
                  </div>
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
                    <input
                      type="text" placeholder={t('create.searchCoins')}
                      value={symbolSearch}
                      onChange={(e) => setSymbolSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:border-[#06B6D4] focus:outline-none transition-colors"
                    />
                  </div>
                  {/* 常用 label — only when no search */}
                  {!symbolSearch && <div className="text-[10px] text-[#606070]">{t('create.popular')}</div>}
                  {/* Symbol list */}
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {filteredSymbols.map((symbol) => (
                      <button key={symbol} type="button"
                        onClick={() => { setSelectedSymbol(symbol); setSymbolSearch(''); setShowSymbolDropdown(false); autoFillName({ symbol }); }}
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
              )}
            </div>

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
                {(['手动选择', 'AI推荐', 'OI榜', 'OI低', '混合'] as CoinSource[]).map((src) => (
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
              {coinSource !== '手动选择' && (
                <p className="text-xs text-[#606070]">
                  {coinSource === 'AI推荐' && t('create.coinSourceAIDesc')}
                  {coinSource === 'OI榜' && t('create.coinSourceOIDesc')}
                  {coinSource === 'OI低' && t('create.coinSourceOILowDesc')}
                  {coinSource === '混合' && t('create.coinSourceMixedDesc')}
                </p>
              )}
            </div>

            {coinSource !== '手动选择' && (
              <SliderField label={t('create.maxCoins')} value={maxCoins} onChange={setMaxCoins} min={3} max={15} />
            )}

            {(coinSource === '手动选择' || coinSource === '混合') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9090A0]">
                    {coinSource === '混合' ? t('create.seedCoins') : t('create.tradingPair')}
                  </span>
                  <button type="button" onClick={() => setShowCoinPicker(!showCoinPicker)}
                    className="text-xs text-[#06B6D4]"
                  >
                    {showCoinPicker ? t('create.collapseCoins') : t('create.selectCoins2')}
                  </button>
                </div>

                {/* Selected chips container */}
                <div
                  className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl min-h-[40px] cursor-text"
                  onClick={() => setShowCoinPicker(true)}
                >
                  {selectedCoins.map((coin) => (
                    <span key={coin} className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4]/20 text-[#06B6D4] rounded text-xs">
                      {coin}
                      <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={(e) => { e.stopPropagation(); handleCoinToggle(coin); }} />
                    </span>
                  ))}
                  {selectedCoins.length === 0 && (
                    <span className="text-xs text-[#606070]">{t('create.clickToSelect')}</span>
                  )}
                </div>

                {/* Expandable picker */}
                {showCoinPicker && (
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

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
                      <input type="text" value={coinSearch} onChange={(e) => setCoinSearch(e.target.value)}
                        placeholder={t('create.searchCoins')}
                        className="w-full pl-9 pr-3 py-2 bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:border-[#06B6D4] focus:outline-none transition-colors"
                      />
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
                )}
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
              <label className="block text-xs text-[#9090A0]">{t('create.gridPair')}</label>
              <div className="flex flex-wrap gap-2">
                {GRID_COINS.map((coin) => (
                  <button key={coin} type="button" onClick={() => { setGridSymbol(coin); autoFillName({ gSymbol: coin }); }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      gridSymbol === coin ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]' : 'bg-[#12121A] text-[#9090A0] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                    }`}
                    aria-label={`${coin}/USDT`} title={`${coin}/USDT`}
                  >{coin}/USDT</button>
                ))}
              </div>
            </div>

            <SliderField label={t('create.gridInvestment')} value={gridInvestment} onChange={setGridInvestment} min={100} max={50000} step={100} unit="$" />
            <SliderField label={t('create.gridLeverage')} value={gridLeverage} onChange={setGridLeverage} min={1} max={5} unit="x" />
            <SliderField label={t('create.gridCount')} value={gridCount} onChange={setGridCount} min={5} max={50} />

            <div className="space-y-2">
              <label className="block text-xs text-[#9090A0]">{t('create.gridSpacing')}</label>
              <div className="grid grid-cols-2 gap-2">
                {([{ key: 'auto' as const, label: t('create.gridAutoATR') }, { key: 'manual' as const, label: t('create.gridManualSetting') }]).map((m) => (
                  <button key={m.key} type="button" onClick={() => setGridBoundsMode(m.key)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      gridBoundsMode === m.key
                        ? 'bg-[#06B6D4]/10 border border-[#06B6D4] text-[#06B6D4]'
                        : 'bg-[#12121A] border border-[#1E1E2E] text-[#9090A0] hover:border-[#06B6D4]/40'
                    }`}
                    aria-label={m.label} title={m.label}
                  >{m.label}</button>
                ))}
              </div>
            </div>

            {gridBoundsMode === 'auto' ? (
              <SliderField label={t('create.gridAtrMultiplier')} value={gridAtrMultiplier} onChange={setGridAtrMultiplier} min={1} max={5} step={0.5} unit="x" />
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="grid-upper" className="block text-xs text-[#9090A0]">{t('create.gridUpperBound')}</label>
                  <input id="grid-upper" type="number" placeholder={t('create.gridUpperBound')}
                    value={gridUpperBound || ''} onChange={(e) => setGridUpperBound(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4]"
                    aria-label={t('create.gridUpperBound')}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="grid-lower" className="block text-xs text-[#9090A0]">{t('create.gridLowerBound')}</label>
                  <input id="grid-lower" type="number" placeholder={t('create.gridLowerBound')}
                    value={gridLowerBound || ''} onChange={(e) => setGridLowerBound(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[#1E1E2E] border border-[#1E1E2E] rounded-xl text-sm text-[#F8F8FC] placeholder:text-[#606070] focus:outline-none focus:border-[#06B6D4]"
                    aria-label={t('create.gridLowerBound')}
                  />
                </div>
              </div>
            )}

            <SliderField label={t('create.gridMaxDrawdown')} value={gridMaxDrawdown} onChange={setGridMaxDrawdown} min={5} max={50} unit="%" />
            <SliderField label={t('create.gridStopLossPercent')} value={gridStopLoss} onChange={setGridStopLoss} min={1} max={20} unit="%" />
          </div>
        )}

        {/* ═══════════ AI 模型 section ═══════════ */}
        <div className="h-px bg-[#1E1E2E]" />

        {/* ═══════════ 6. Model Selection ═══════════ */}
        {/* Single model dropdown for Research / Solo */}
        {!isDebate && (
          <div className="space-y-3">
            <label className="block text-sm text-[#9090A0]">{t('create.aiModel')}</label>
            <div className="relative" ref={modelRef}>
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="w-full flex items-center justify-between bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3 hover:border-[#06B6D4]/50 transition-colors"
                aria-label={t('create.selectModel')} title={t('create.selectModel')}
              >
                <div className="flex items-center gap-3">
                  {MODEL_DISPLAY[selectedModel]?.logo ? (
                    <img src={MODEL_DISPLAY[selectedModel].logo} alt={MODEL_DISPLAY[selectedModel].name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
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
                          <img src={info.logo} alt={info.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
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

        {/* Multi-model checkbox for Debate */}
        {isDebate && (
          <div className="space-y-3">
            <label className="block text-sm text-[#9090A0]">{t('create.consensusModels', { count: debateModels.length })}</label>
            <p className="text-xs text-[#606070]">{t('create.consensusModelsDesc')}</p>
            <div className="space-y-2">
              {Object.entries(MODEL_DISPLAY).map(([modelId, info]) => {
                const sel = debateModels.includes(modelId);
                return (
                  <button key={modelId} type="button" onClick={() => handleModelToggle(modelId)}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                      sel ? 'bg-[#06B6D4]/10 border border-[#06B6D4]' : 'bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                    }`}
                    aria-label={t('create.selectModelName', { name: info.name })} title={info.name}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#06B6D4]' : 'bg-[#1E1E2E]'}`}>
                      {sel && <Check className="w-3 h-3 text-[#F8F8FC]" />}
                    </div>
                    {info.logo ? (
                      <img src={info.logo} alt={info.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: info.color }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#F8F8FC] truncate">{info.name}</div>
                      <div className="text-xs text-[#606070]">{info.provider}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════ 运行配置 section ═══════════ */}
        <div className="h-px bg-[#1E1E2E]" />

        <ExchangeKeySelector
          value={exchangeApiKeyId}
          onChange={setExchangeApiKeyId}
          label={t('create.exchangeAccount')}
        />

        {/* ═══════════ 7. Interval ═══════════ */}
        <div className="space-y-3">
          <label className="block text-sm text-[#9090A0]">{t('create.runInterval')}</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {INTERVALS.map((iv) => (
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
                <span className="px-2 py-0.5 text-[10px] bg-[#06B6D4]/15 text-[#06B6D4] rounded-full">{getStyleLabel(strategyStyle)}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${showRiskControl ? 'rotate-180' : ''}`} />
            </button>
            {showRiskControl && (
              <div className="px-4 pb-4 space-y-5">
                {/* Strategy style presets */}
                <div className="space-y-2.5">
                  <label className="block text-xs text-[#9090A0]">{t('create.stylePreset')}</label>
                  <div className="space-y-2">
                    {(STRATEGY_PRESET_KEYS as readonly StrategyStyle[]).map((style) => {
                      const preset = STRATEGY_PRESETS[style];
                      const Icon = preset.icon;
                      const sel = strategyStyle === style;
                      return (
                        <button key={style} type="button" onClick={() => handleStyleChange(style)}
                          className={`w-full p-3 rounded-xl text-left transition-all ${
                            sel ? 'bg-[#06B6D4]/10 border border-[#06B6D4]' : 'bg-[#12121A] border border-[#1E1E2E] hover:border-[#06B6D4]/40'
                          }`}
                          aria-label={t('create.selectStylePreset', { style: getStyleLabel(style) })} title={getStyleLabel(style)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${sel ? 'text-[#06B6D4]' : 'text-[#9090A0]'}`} />
                              <span className="font-semibold text-sm">{getStyleLabel(style)}</span>
                              <span className="text-xs text-[#606070]">{t(preset.descKey)}</span>
                            </div>
                            {sel && <Check className="w-4 h-4 text-[#06B6D4]" />}
                            {style === '均衡型' && !sel && <span className="px-2 py-0.5 bg-[#06B6D4]/20 text-[#06B6D4] text-[10px] rounded-full">{t('common.recommended')}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {preset.tagKeys.map((tagKey) => (
                              <span key={tagKey} className={`px-2 py-0.5 rounded-full text-[10px] ${sel ? 'bg-[#06B6D4]/10 text-[#06B6D4]' : 'bg-[#1E1E2E] text-[#606070]'}`}>{t(tagKey)}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced sliders */}
                <div className="space-y-4 pt-2 border-t border-[#1E1E2E]">
                  <p className="text-xs text-[#606070]">{t('create.presetAutoConfig')}</p>
                  <SliderField label={t('create.allocatedCapital')} value={customParams.allocatedCapital}
                    onChange={(v) => setCustomParams((p) => ({ ...p, allocatedCapital: v }))}
                    min={500} max={100000} step={500} unit="$"
                  />
                  <SliderField label={t('create.maxLeverage')} value={customParams.maxLeverage}
                    onChange={(v) => setCustomParams((p) => ({ ...p, maxLeverage: v }))}
                    min={1} max={20} unit="x"
                  />
                  <SliderField label={t('create.maxPositions')} value={customParams.maxPositions}
                    onChange={(v) => setCustomParams((p) => ({ ...p, maxPositions: v }))}
                    min={1} max={10}
                  />
                  <SliderField label={t('create.dailyDrawdown')} value={customParams.dailyDrawdown}
                    onChange={(v) => setCustomParams((p) => ({ ...p, dailyDrawdown: v }))}
                    min={3} max={20} unit="%"
                  />
                  <SliderField label={t('create.maxDailyTrades')} value={customParams.maxDailyTrades}
                    onChange={(v) => setCustomParams((p) => ({ ...p, maxDailyTrades: v }))}
                    min={1} max={50}
                  />
                  <SliderField label={t('create.cooldownMinutes')} value={customParams.cooldownMinutes}
                    onChange={(v) => setCustomParams((p) => ({ ...p, cooldownMinutes: v }))}
                    min={0} max={120} step={5} unit={t('common.min')}
                  />
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
