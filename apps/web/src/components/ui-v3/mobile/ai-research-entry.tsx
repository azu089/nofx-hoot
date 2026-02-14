"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useResearchHistory, useStartResearch } from "@/hooks/useAi";

type ResearchDepth = "quick" | "standard" | "deep";

// 时间格式化辅助函数
function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

const depthOptions = [
  { value: "quick", label: "快速", time: "~1min" },
  { value: "standard", label: "标准", time: "~3min" },
  { value: "deep", label: "深度", time: "~5min" },
] as const;

const popularSymbols = ["BTC", "ETH", "SOL", "BNB"];

export function AIResearchPage() {
  const router = useRouter();
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [depth, setDepth] = useState<ResearchDepth>("standard");
  const [autoExecute, setAutoExecute] = useState(false);

  const { data: historyData, isLoading: historyLoading } = useResearchHistory(1, 5);
  const startResearch = useStartResearch();

  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbol(`${symbol}/USDT`);
  };

  const handleStartResearch = async () => {
    try {
      const result = await startResearch.mutateAsync({
        symbol: selectedSymbol,
        depth,
        autoExecute,
      });
      router.push(`/ai-research/${result.sessionId}`);
    } catch (err: any) {
      alert(err.message || "启动研究失败");
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case "BUY":
        return "text-[#4ADE80]";
      case "SELL":
        return "text-[#F87171]";
      case "HOLD":
        return "text-[#94A3B8]";
      default:
        return "text-[#94A3B8]";
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
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-10 bg-[#0A0A0F] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
            aria-label="返回"
            title="返回"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">AI 研究团队</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* 主内容区 */}
      <main className="px-4 py-6 space-y-6">
        {/* 核心操作区 */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5 space-y-6">
          {/* 选择币种 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#94A3B8]">
              选择币种
            </label>
            <button
              className="w-full flex items-center justify-between bg-[#1A1A24] border border-[#1E1E2E] rounded-lg px-4 py-3 hover:border-cyan-500/50 transition-colors"
              aria-label="选择币种"
              title="选择币种"
            >
              <span className="text-white font-medium">{selectedSymbol}</span>
              <ChevronDown className="w-5 h-5 text-[#64748B]" />
            </button>

            {/* 热门快捷标签 */}
            <div className="flex gap-2">
              {popularSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => handleSymbolClick(symbol)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedSymbol.startsWith(symbol)
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                      : "bg-[#1A1A24] text-[#94A3B8] border border-[#1E1E2E] hover:border-[#2E2E3E]"
                  }`}
                  aria-label={`选择${symbol}`}
                  title={`选择${symbol}`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* 研究深度 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#94A3B8]">
              研究深度
            </label>
            <div className="flex gap-2">
              {depthOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDepth(option.value)}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                    depth === option.value
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500"
                      : "bg-[#1E1E2E] text-[#94A3B8] border border-transparent hover:bg-[#2E2E3E]"
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

          {/* 自动执行开关 */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">自动执行</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#64748B]">¥0.02 / 次</span>
              <button
                onClick={() => setAutoExecute(!autoExecute)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  autoExecute ? "bg-cyan-500" : "bg-[#1E1E2E]"
                }`}
                aria-label="自动执行开关"
                title="自动执行开关"
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    autoExecute ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 开始研究按钮 */}
          <button
            onClick={handleStartResearch}
            disabled={startResearch.isPending}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-4 rounded-xl transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            aria-label="开始研究"
            title="开始研究"
          >
            {startResearch.isPending ? "启动中..." : "🚀 开始研究"}
          </button>
        </div>

        {/* 研究历史区 */}
        <div className="space-y-4">
          {/* 标题栏 */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">研究历史</h2>
            <button
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              aria-label="查看全部历史"
              title="查看全部历史"
            >
              全部 →
            </button>
          </div>

          {/* 历史列表 */}
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl overflow-hidden">
            {historyLoading ? (
              <div className="p-4 text-center text-[#94A3B8]">加载中...</div>
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
                      className="p-4 hover:bg-[#1A1A24] transition-colors cursor-pointer"
                      onClick={() => router.push(`/ai-research/${item.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {item.symbol}
                          </span>
                          {isSuccess ? (
                            <div className="flex items-center justify-center w-5 h-5 bg-[#22C55E]/20 rounded-full">
                              <Check className="w-3 h-3 text-[#22C55E]" />
                            </div>
                          ) : isFailed ? (
                            <div className="flex items-center justify-center w-5 h-5 bg-[#EF4444]/20 rounded-full">
                              <X className="w-3 h-3 text-[#EF4444]" />
                            </div>
                          ) : null}
                        </div>
                        <span className="text-xs text-[#64748B]">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#1E1E2E] text-[#94A3B8] text-xs rounded">
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
                          <span className="text-sm text-[#94A3B8]">
                            置信度 {Math.round(confidence)}%
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
              <div className="p-4 text-center text-[#94A3B8]">暂无研究历史</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AIResearchPage;
