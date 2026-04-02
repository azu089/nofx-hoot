"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useResearchHistory, useStartResearch, useAiConfig, useUpdateAiConfig } from "@/hooks/useAi";
import { ExchangeKeySelector } from "@/components/ui-v3/ai/exchange-key-selector";
import { useTranslations } from "@/i18n/provider";

type ResearchDepth = "quick" | "standard" | "deep";

// 时间格式化辅助函数
function formatTimeAgo(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('common.justNow');
  if (minutes < 60) return t('common.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('common.daysAgo', { count: days });
}

const popularSymbols = ["BTC", "ETH", "SOL", "BNB"];

const allSymbols = [
  "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
  "DOGE/USDT", "ADA/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT",
  "MATIC/USDT", "UNI/USDT", "ATOM/USDT", "LTC/USDT", "FIL/USDT",
  "APT/USDT", "ARB/USDT", "OP/USDT", "SUI/USDT", "INJ/USDT",
  "TIA/USDT", "SEI/USDT", "JUP/USDT", "WIF/USDT", "PEPE/USDT",
  "NEAR/USDT", "FTM/USDT", "AAVE/USDT", "MKR/USDT", "RENDER/USDT",
];

interface AIResearchPageProps {
  embedded?: boolean;
  creationOnly?: boolean;
}

export function AIResearchPage({ embedded, creationOnly }: AIResearchPageProps = {}) {
  const router = useRouter();
  const t = useTranslations('ai');
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [depth, setDepth] = useState<ResearchDepth>("standard");
  const [exchangeApiKeyId, setExchangeApiKeyId] = useState<string | null>(null);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [cyclingEnabled, setCyclingEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [maxCycles, setMaxCycles] = useState(0);
  const [profitTarget, setProfitTarget] = useState(0);
  const [maxLoss, setMaxLoss] = useState(0);

  // 资金管理
  const [amountPerTrade, setAmountPerTrade] = useState(50);
  const [fundMaxLeverage, setFundMaxLeverage] = useState(5);
  const [maxPositions, setMaxPositions] = useState(3);
  const [fundingExpanded, setFundingExpanded] = useState(false);

  const { data: historyData, isLoading: historyLoading } = useResearchHistory(1, 5);
  const startResearch = useStartResearch();
  const { data: aiConfig } = useAiConfig();
  const updateAiConfig = useUpdateAiConfig();

  // 从 AiConfig 回填资金管理配置
  useEffect(() => {
    if (aiConfig) {
      if (aiConfig.amountPerTrade) setAmountPerTrade(aiConfig.amountPerTrade);
      if (aiConfig.maxLeverage) setFundMaxLeverage(aiConfig.maxLeverage);
      if (aiConfig.maxPositions) setMaxPositions(aiConfig.maxPositions);
    }
  }, [aiConfig]);

  // 过滤币种列表
  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return allSymbols;
    const q = symbolSearch.toUpperCase();
    return allSymbols.filter((s) => s.includes(q));
  }, [symbolSearch]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSymbolDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const depthOptions = [
    { value: "quick", label: t('create.quick'), time: "~1min" },
    { value: "standard", label: t('create.standard'), time: "~3min" },
    { value: "deep", label: t('create.deep'), time: "~5min" },
  ] as const;

  const intervalOptions = [
    { value: 15, label: t('research.interval15m') },
    { value: 30, label: t('research.interval30m') },
    { value: 60, label: t('research.interval1h') },
    { value: 240, label: t('research.interval4h') },
  ];

  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbol(`${symbol}/USDT`);
  };

  const handleStartResearch = async () => {
    try {
      // 步骤1: 保存资金管理配置到全局 AiConfig
      await updateAiConfig.mutateAsync({
        amountPerTrade,
        maxLeverage: fundMaxLeverage,
        maxPositions,
      });

      // 步骤2: 启动研究
      const result = await startResearch.mutateAsync({
        symbol: selectedSymbol,
        depth,
        autoExecute: true,
        ...(exchangeApiKeyId && { exchangeApiKeyId }),
        ...(cyclingEnabled && {
          cyclingConfig: {
            enabled: true,
            intervalMinutes,
            maxCycles,
            profitTargetPercent: profitTarget,
            maxLossPercent: maxLoss,
          },
          riskControlConfig: {
            allocatedCapital: amountPerTrade * 100,
            maxLeverage: fundMaxLeverage,
            maxPositions,
          },
        }),
      });
      router.push(`/ai/research/${result.sessionId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.failed'));
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case "BUY":
        return "text-[#10B981]";
      case "SELL":
        return "text-[#F43F5E]";
      case "HOLD":
        return "text-[#9090A0]";
      default:
        return "text-[#9090A0]";
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case "BUY":
        return <TrendingUp className="w-4 h-4" />;
      case "SELL":
        return <TrendingDown className="w-4 h-4" />;
      case "HOLD":
        return <Minus className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getDepthLabel = (depthValue: ResearchDepth) => {
    const option = depthOptions.find((opt) => opt.value === depthValue);
    return option?.label || depthValue;
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-[#0A0A0F] text-[#F8F8FC]`}>
      {/* 顶部导航栏 - 嵌入模式下隐藏 */}
      {!embedded && (
        <header className="sticky top-0 z-30 bg-[#0A0A0F] [transform:translateZ(0)] border-b border-[#1E1E2E]">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center hover:bg-[#1E1E2E] rounded-xl transition-colors"
              aria-label={t('common.back')}
              title={t('common.back')}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-base font-semibold text-[#F8F8FC]">{t('research.title')}</h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </header>
      )}

      {/* 主内容区 */}
      <main className="px-4 py-6 space-y-6">
        {/* 核心操作区 */}
        <div className="glass-border-glow glass-card p-5 space-y-6 !overflow-visible">
          {/* 选择币种 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#9090A0]">
              {t('research.selectSymbol')}
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                className="w-full flex items-center justify-between bg-[#1E1E2E] border border-[#1E1E2E] rounded-lg px-4 py-3 hover:border-cyan-500/50 transition-colors"
                onClick={() => setShowSymbolDropdown(!showSymbolDropdown)}
                aria-label={t('research.selectSymbol')}
                title={t('research.selectSymbol')}
              >
                <span className="text-[#F8F8FC] font-medium">{selectedSymbol}</span>
                <ChevronDown className={`w-5 h-5 text-[#606070] transition-transform ${showSymbolDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* 搜索下拉框 */}
              {showSymbolDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#12121A] border border-[#1E1E2E] rounded-lg shadow-2xl max-h-64 overflow-hidden">
                  {/* 搜索输入 */}
                  <div className="sticky top-0 bg-[#12121A] p-2 border-b border-[#1E1E2E]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
                      <input
                        type="text"
                        placeholder={t('research.searchSymbol')}
                        value={symbolSearch}
                        onChange={(e) => setSymbolSearch(e.target.value)}
                        className="w-full bg-[#1E1E2E] border border-[#1E1E2E] rounded-lg pl-9 pr-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  {/* 列表 */}
                  <div className="overflow-y-auto max-h-48">
                    {filteredSymbols.map((symbol) => (
                      <button
                        key={symbol}
                        onClick={() => {
                          setSelectedSymbol(symbol);
                          setShowSymbolDropdown(false);
                          setSymbolSearch("");
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          selectedSymbol === symbol
                            ? "bg-cyan-500/10 text-cyan-400"
                            : "text-[#F8F8FC] hover:bg-[#1E1E2E]"
                        }`}
                      >
                        {symbol}
                        {selectedSymbol === symbol && (
                          <Check className="inline w-4 h-4 ml-2 text-cyan-400" />
                        )}
                      </button>
                    ))}
                    {filteredSymbols.length === 0 && (
                      <p className="px-4 py-3 text-sm text-[#606070]">{t('research.noMatch')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 热门快捷标签 */}
            <div className="flex gap-2">
              {popularSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => handleSymbolClick(symbol)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedSymbol.startsWith(symbol)
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                      : "bg-[#1E1E2E] text-[#9090A0] border border-[#1E1E2E] hover:border-[#2E2E3E]"
                  }`}
                  aria-label={t('research.selectSymbolAction', { symbol })}
                  title={t('research.selectSymbolAction', { symbol })}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* 研究深度 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#9090A0]">
              {t('research.researchDepth')}
            </label>
            <div className="flex gap-2">
              {depthOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDepth(option.value)}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                    depth === option.value
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500"
                      : "bg-[#1E1E2E] text-[#9090A0] border border-transparent hover:bg-[#2E2E3E]"
                  }`}
                  aria-label={`${option.label} ${option.time}`}
                  title={`${option.label} ${option.time}`}
                >
                  <div className="text-sm">{option.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{option.time}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 资金管理 */}
          <div className="space-y-3">
            <button
              onClick={() => setFundingExpanded(!fundingExpanded)}
              className="flex w-full items-center justify-between"
            >
              <label className="text-sm font-medium text-[#9090A0] pointer-events-none">
                {t('research.fundManagement')}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#606070] font-mono">
                  {t('research.fundSummary', { amount: String(amountPerTrade), leverage: String(fundMaxLeverage), positions: String(maxPositions) })}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#606070] transition-transform ${fundingExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {fundingExpanded && (
              <div className="space-y-4 p-4 glass-border-glow glass-card">
                {/* 单次开仓金额 */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#9090A0]">{t('research.amountPerTrade')}</span>
                    <span className="text-[#F8F8FC] font-mono">${amountPerTrade}</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={10000}
                    step={10}
                    value={amountPerTrade}
                    onChange={(e) => setAmountPerTrade(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#2E2E3E] rounded-full appearance-none cursor-pointer accent-cyan-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-[#606070]">
                    <span>$10</span>
                    <span>$10000</span>
                  </div>
                </div>

                {/* 最大杠杆 */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#9090A0]">{t('research.maxLeverage')}</span>
                    <span className="text-[#F8F8FC] font-mono">{fundMaxLeverage}x</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={fundMaxLeverage}
                    onChange={(e) => setFundMaxLeverage(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#2E2E3E] rounded-full appearance-none cursor-pointer accent-cyan-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-[#606070]">
                    <span>1x</span>
                    <span>20x</span>
                  </div>
                </div>

                {/* 最大持仓数 */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#9090A0]">{t('research.maxPositions')}</span>
                    <span className="text-[#F8F8FC] font-mono">{maxPositions}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#2E2E3E] rounded-full appearance-none cursor-pointer accent-cyan-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-[#606070]">
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 自动循环 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#9090A0]">
                {t('research.autoCycling')}
              </label>
              <button
                onClick={() => setCyclingEnabled(!cyclingEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  cyclingEnabled ? "bg-cyan-500" : "bg-[#2E2E3E]"
                }`}
                aria-label={t('research.toggleCycling')}
                title={t('research.toggleCycling')}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    cyclingEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {cyclingEnabled && (
              <div className="space-y-4 p-4 glass-border-glow glass-card">
                {/* 循环间隔 */}
                <div className="space-y-2">
                  <label className="text-xs text-[#606070]">{t('research.cycleInterval')}</label>
                  <div className="grid grid-cols-4 gap-2">
                    {intervalOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setIntervalMinutes(opt.value)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                          intervalMinutes === opt.value
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                            : "bg-[#1E1E2E] text-[#9090A0] border border-transparent"
                        }`}
                        aria-label={opt.label}
                        title={opt.label}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 停止条件 */}
                <div className="space-y-2">
                  <label className="text-xs text-[#606070]">{t('research.stopConditions')}</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9090A0] w-20 shrink-0">{t('research.maxCycles')}</span>
                      <input
                        type="number"
                        min={0}
                        value={maxCycles || ""}
                        onChange={(e) => setMaxCycles(parseInt(e.target.value) || 0)}
                        placeholder={t('common.unlimited')}
                        className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none"
                      />
                      <span className="text-xs text-[#606070]">{t('common.times')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9090A0] w-20 shrink-0">{t('research.profitTarget')}</span>
                      <input
                        type="number"
                        min={0}
                        value={profitTarget || ""}
                        onChange={(e) => setProfitTarget(parseFloat(e.target.value) || 0)}
                        placeholder={t('common.unlimited')}
                        className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none"
                      />
                      <span className="text-xs text-[#606070]">%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9090A0] w-20 shrink-0">{t('research.maxLoss')}</span>
                      <input
                        type="number"
                        min={0}
                        value={maxLoss || ""}
                        onChange={(e) => setMaxLoss(parseFloat(e.target.value) || 0)}
                        placeholder={t('common.unlimited')}
                        className="flex-1 bg-[#1E1E2E] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-[#F8F8FC] placeholder-[#606070] focus:border-cyan-500/50 focus:outline-none"
                      />
                      <span className="text-xs text-[#606070]">%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 交易所账号 */}
          <ExchangeKeySelector
            value={exchangeApiKeyId}
            onChange={setExchangeApiKeyId}
            label={t('research.exchangeAccount')}
          />

          {/* 开始研究按钮 */}
          <button
            onClick={handleStartResearch}
            disabled={startResearch.isPending}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-[#F8F8FC] font-semibold py-4 rounded-xl transition-all duration-100 select-none shadow-lg shadow-[#06B6D4]/20 disabled:opacity-50 enabled:active:scale-[0.98] enabled:active:opacity-80"
            aria-label={t('research.startResearch')}
            title={t('research.startResearch')}
          >
            {startResearch.isPending ? t('common.starting') : cyclingEnabled ? t('research.startAutoResearch') : t('research.startResearch')}
          </button>
        </div>

        {/* 研究历史区 — creationOnly 模式下隐藏 */}
        {!creationOnly && <div className="space-y-4">
          {/* 标题栏 */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('research.researchHistory')}</h2>
            <button
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              aria-label={t('research.viewAllHistory')}
              title={t('research.viewAllHistory')}
            >
              {t('research.allHistory')}
            </button>
          </div>

          {/* 历史列表 */}
          <div className="glass-border-glow glass-card">
            {historyLoading ? (
              <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : historyData?.data && historyData.data.length > 0 ? (
              historyData.data.map((item, index) => {
                const isSuccess = item.status === "completed";
                const isFailed = item.status === "failed";
                const action = item.decision?.action || "";
                let result: "BUY" | "SELL" | "HOLD" = "HOLD";
                if (action === "open_long" || action === "close_short") result = "BUY";
                else if (action === "open_short" || action === "close_long") result = "SELL";
                const confidence = item.decision?.confidence || 0;

                return (
                  <div key={item.id}>
                    <div
                      className="p-4 hover:bg-[#1E1E2E] transition-colors cursor-pointer"
                      onClick={() => router.push(`/ai/research/${item.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#F8F8FC]">
                            {item.symbol}
                          </span>
                          {item.campaignStatus && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 rounded text-[10px] text-cyan-400">
                              <RefreshCw className="w-3 h-3" />
                              <span>{item.cycleCount || 0} {t('common.rounds')}</span>
                            </div>
                          )}
                          {isSuccess ? (
                            <div className="flex items-center justify-center w-5 h-5 bg-[#10B981]/20 rounded-full">
                              <Check className="w-3 h-3 text-[#10B981]" />
                            </div>
                          ) : isFailed ? (
                            <div className="flex items-center justify-center w-5 h-5 bg-[#F43F5E]/20 rounded-full">
                              <X className="w-3 h-3 text-[#F43F5E]" />
                            </div>
                          ) : null}
                        </div>
                        <span className="text-xs text-[#606070]">
                          {formatTimeAgo(item.createdAt, t)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#9090A0] text-xs rounded">
                            {getDepthLabel(item.depth as ResearchDepth)}
                          </span>
                          {isSuccess && (
                            <div
                              className={`flex items-center gap-1 font-semibold ${getResultColor(result)}`}
                            >
                              {getResultIcon(result)}
                              <span className="text-sm">{result}</span>
                            </div>
                          )}
                        </div>

                        {isSuccess && (
                          <span className="text-sm text-[#9090A0]">
                            {t('research.confidence')} <span className="font-mono">{Math.round(confidence)}%</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {index < historyData.data.length - 1 && (
                      <div className="border-t border-[#1E1E2E]" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <Search className="w-8 h-8 text-[#606070] mx-auto mb-2" />
                <p className="text-sm text-[#9090A0]">{t('research.noHistory')}</p>
              </div>
            )}
          </div>
        </div>}
      </main>
    </div>
  );
}

export default AIResearchPage;
