"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { useStrategyDetail, useStrategyLogs, useStrategyPnlChart, useStrategyControl } from "@/hooks/useAi";

export function AIStrategyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const strategyId = params?.id as string | undefined;

  const [activeTab, setActiveTab] = useState<
    "overview" | "positions" | "decisions" | "config"
  >("overview");
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [pauseDuration, setPauseDuration] = useState<string>("1h");
  const [timeFilter, setTimeFilter] = useState<string>("7d");
  const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(
    new Set()
  );

  // Data fetching
  const { data: detail, isLoading: detailLoading } = useStrategyDetail(strategyId);
  const { data: logsData } = useStrategyLogs(strategyId, 1, 20);

  const daysMap: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '全部': 365 };
  const chartDays = daysMap[timeFilter] || 7;
  const { data: pnlChart } = useStrategyPnlChart(strategyId, chartDays);

  const strategyControl = useStrategyControl();

  // Loading state
  if (!strategyId || detailLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div className="text-[#64748B]">加载中...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div className="text-[#64748B]">策略不存在</div>
      </div>
    );
  }

  const toggleDecision = (id: string) => {
    const newSet = new Set(expandedDecisions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedDecisions(newSet);
  };

  const getActionText = (action: string) => {
    const map: Record<string, string> = {
      open_long: "开多",
      open_short: "开空",
      close_long: "平多",
      close_short: "平空",
      hold: "持有",
      reduce_position: "减仓",
    };
    return map[action] || action;
  };

  const formatTimeUntil = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return '即将';
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
    if (days > 0) return `${days}天${hours}h`;
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
    <div className="min-h-screen bg-[#0A0A0F] text-white w-full max-w-[390px] mx-auto">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-[#0A0A0F] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            title="返回"
            aria-label="返回"
            onClick={() => router.back()}
            className="p-2 -ml-2 active:opacity-70"
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
              <span className={`w-2 h-2 rounded-full ${strategy.isActive ? 'bg-[#22C55E]' : 'bg-[#64748B]'}`} />
              {strategy.isActive ? '运行中' : '已停止'}
            </span>
          </div>
          {strategy.isActive && (
            <div className="flex items-center gap-2">
              <button
                title="暂停"
                aria-label="暂停策略"
                onClick={() => setShowPauseModal(true)}
                className="px-3 py-1.5 text-xs font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1A1A24]"
              >
                暂停
              </button>
              <button
                title="停止"
                aria-label="停止策略"
                onClick={() => setShowStopModal(true)}
                className="px-3 py-1.5 text-xs font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1A1A24]"
              >
                停止
              </button>
            </div>
          )}
        </div>

        {/* 运行信息 */}
        <div className="px-4 pb-3">
          <p className="text-xs text-[#64748B]">
            运行 {formatRunningTime(strategy.createdAt)} · 下次分析{" "}
            {formatTimeUntil(detail.nextCycleAt)}后
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="px-4 pb-4 grid grid-cols-4 gap-2">
          <div className="bg-[#12121A] rounded-lg p-2.5 border border-[#1E1E2E]">
            <p className="text-[10px] text-[#64748B] mb-0.5">PnL</p>
            <p className={`text-sm font-semibold ${Number(strategy.totalPnl) >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
              {Number(strategy.totalPnl) >= 0 ? '+' : ''}{Number(strategy.totalPnl).toFixed(2)}
            </p>
          </div>
          <div className="bg-[#12121A] rounded-lg p-2.5 border border-[#1E1E2E]">
            <p className="text-[10px] text-[#64748B] mb-0.5">胜率</p>
            <p className="text-sm font-semibold">
              {Number(strategy.winRate).toFixed(1)}%
            </p>
          </div>
          <div className="bg-[#12121A] rounded-lg p-2.5 border border-[#1E1E2E]">
            <p className="text-[10px] text-[#64748B] mb-0.5">Sharpe</p>
            <p className="text-sm font-semibold">
              {Number(strategy.sharpe).toFixed(2)}
            </p>
          </div>
          <div className="bg-[#12121A] rounded-lg p-2.5 border border-[#1E1E2E]">
            <p className="text-[10px] text-[#64748B] mb-0.5">交易</p>
            <p className="text-sm font-semibold">
              {strategy.totalTrades}
            </p>
          </div>
        </div>

        {/* Tab 栏 */}
        <div className="flex items-center border-b border-[#1E1E2E]">
          {[
            { key: "overview", label: "概览" },
            { key: "positions", label: "持仓" },
            { key: "decisions", label: "决策日志" },
            { key: "config", label: "配置" },
          ].map((tab) => (
            <button
              key={tab.key}
              title={tab.label}
              aria-label={tab.label}
              onClick={() =>
                setActiveTab(
                  tab.key as "overview" | "positions" | "decisions" | "config"
                )
              }
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "text-[#06B6D4] border-[#06B6D4]"
                  : "text-[#64748B] border-transparent"
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
            {/* 时间筛选 */}
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2">
                {["24h", "7d", "30d", "全部"].map((filter) => (
                  <button
                    key={filter}
                    title={filter}
                    aria-label={`选择${filter}`}
                    onClick={() => setTimeFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      timeFilter === filter
                        ? "bg-[#06B6D4] text-white"
                        : "bg-[#12121A] text-[#94A3B8] border border-[#1E1E2E]"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* PnL 曲线图 */}
            <div className="mx-4 bg-[#12121A] rounded-lg p-4 border border-[#1E1E2E]">
              <div className="mb-4">
                <p className="text-xs text-[#64748B] mb-1">{timeFilter} 累计 PnL</p>
                <p className={`text-2xl font-bold ${(pnlChart?.finalPnl ?? 0) >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
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
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-[#64748B]">
                    {pnlHistory
                      .filter((_, i) => i % Math.max(1, Math.floor(pnlHistory.length / 4)) === 0)
                      .map((point) => (
                        <span key={point.date}>{new Date(point.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-[#64748B] text-sm py-8">暂无数据</div>
              )}
            </div>

            {/* 今日统计 */}
            <div className="mx-4 bg-[#12121A] rounded-lg p-4 border border-[#1E1E2E]">
              <h3 className="text-sm font-semibold mb-3">今日统计</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8]">今日 PnL</span>
                  <span className={`text-sm font-semibold ${detail.todayPnl >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                    {detail.todayPnl >= 0 ? '+' : ''}${detail.todayPnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8]">交易笔数</span>
                  <span className="text-sm font-semibold">
                    {todayTrades}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8]">胜/负</span>
                  <span className="text-sm font-semibold">
                    <span className="text-[#4ADE80]">
                      {todayWins}
                    </span>
                    <span className="text-[#64748B]"> / </span>
                    <span className="text-[#F87171]">
                      {todayLosses}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: 持仓 */}
        {activeTab === "positions" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">当前持仓</h3>
            </div>
            <div className="bg-[#12121A] rounded-lg p-8 border border-[#1E1E2E] text-center">
              <p className="text-[#64748B] text-sm">暂无持仓数据</p>
              <p className="text-[#64748B] text-xs mt-2">持仓 API 接口开发中</p>
            </div>
          </div>
        )}

        {/* Tab 3: 决策日志 */}
        {activeTab === "decisions" && (
          <div className="p-4 space-y-3">
            {logs.length === 0 ? (
              <div className="bg-[#12121A] rounded-lg p-8 border border-[#1E1E2E] text-center">
                <p className="text-[#64748B] text-sm">暂无决策日志</p>
              </div>
            ) : (
              logs.map((log) => {
                const status = log.executed
                  ? (log.executionResult?.error ? 'failed' : 'executed')
                  : 'skipped';
                const reason = log.executionResult?.error || log.decision.reasoning || '';

                return (
                  <div
                    key={log.id}
                    className="bg-[#12121A] rounded-lg p-4 border border-[#1E1E2E] space-y-2"
                  >
                    {/* 头部 */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-[#64748B]">
                            {formatLogTime(log.createdAt)}
                          </span>
                          <span className="text-sm font-medium">
                            {log.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#06B6D4]/10 text-[#06B6D4]">
                            {getActionText(log.decision.action)}
                          </span>
                          {log.decision.confidence && (
                            <span className="text-xs text-[#94A3B8]">
                              置信度 {Math.round(log.decision.confidence)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 执行结果 */}
                    <div className="pt-2 border-t border-[#1E1E2E]">
                      {status === "executed" && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-[#4ADE80]">✅</span>
                          <div>
                            <span className="text-[#94A3B8]">已执行</span>
                            {log.executionResult?.price && (
                              <span>
                                <span className="text-[#94A3B8]"> @ </span>
                                <span className="text-white font-medium">
                                  ${log.executionResult.price.toLocaleString()}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {status === "skipped" && (
                        <div className="flex items-start gap-2 text-xs">
                          <span>⏭</span>
                          <div>
                            <p className="text-[#94A3B8] mb-0.5">跳过</p>
                            {reason && <p className="text-[#64748B]">{reason}</p>}
                          </div>
                        </div>
                      )}
                      {status === "failed" && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-[#F87171]">❌</span>
                          <div>
                            <p className="text-[#94A3B8] mb-0.5">失败</p>
                            {reason && <p className="text-[#F87171]">{reason}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 4: 配置 */}
        {activeTab === "config" && (
          <div className="p-4 space-y-4">
            <div className="bg-[#12121A] rounded-lg p-4 border border-[#1E1E2E] space-y-3">
              <h3 className="text-sm font-semibold mb-3">当前配置</h3>

              <div className="space-y-2.5">
                <div>
                  <p className="text-xs text-[#64748B] mb-1">策略类型</p>
                  <p className="text-sm">{strategy.strategyType}</p>
                </div>

                <div>
                  <p className="text-xs text-[#64748B] mb-1">交易模式</p>
                  <p className="text-sm">
                    {strategy.tradingMode}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#64748B] mb-1">交易币种</p>
                  <div className="flex flex-wrap gap-1.5">
                    {symbols.length > 0 ? (
                      symbols.map((symbol: string) => (
                        <span
                          key={symbol}
                          className="px-2 py-1 text-xs bg-[#1A1A24] border border-[#1E1E2E] rounded"
                        >
                          {symbol}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[#64748B]">未配置</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-[#64748B] mb-1">杠杆倍数</p>
                  <p className="text-sm">{maxLeverage}</p>
                </div>

                <div>
                  <p className="text-xs text-[#64748B] mb-1">最大持仓数</p>
                  <p className="text-sm">
                    {maxPositions}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#64748B] mb-1">最大回撤</p>
                  <p className="text-sm">
                    {maxDrawdown}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#64748B] mb-1">执行周期</p>
                  <p className="text-sm">{strategy.intervalMinutes} 分钟</p>
                </div>
              </div>
            </div>

            <button
              title="编辑配置"
              aria-label="编辑配置"
              className="w-full py-3 bg-[#06B6D4] text-white text-sm font-medium rounded-lg active:opacity-80"
            >
              编辑配置
            </button>
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
          <div className="relative w-full bg-[#12121A] rounded-t-2xl p-6 animate-slide-up">
            <h2 className="text-lg font-semibold mb-4">暂停策略</h2>

            <div className="mb-6">
              <p className="text-xs text-[#64748B] mb-3">暂停时长</p>
              <div className="flex flex-wrap gap-2">
                {["30min", "1h", "4h", "24h", "手动恢复"].map((duration) => (
                  <button
                    key={duration}
                    title={duration}
                    aria-label={`暂停${duration}`}
                    onClick={() => setPauseDuration(duration)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      pauseDuration === duration
                        ? "bg-[#06B6D4] text-white"
                        : "bg-[#1A1A24] text-[#94A3B8] border border-[#1E1E2E]"
                    }`}
                  >
                    {duration}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                title="取消"
                aria-label="取消"
                onClick={() => setShowPauseModal(false)}
                className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1A1A24]"
              >
                取消
              </button>
              <button
                title="确认暂停"
                aria-label="确认暂停"
                onClick={handlePause}
                disabled={strategyControl.isPending}
                className="flex-1 py-3 bg-[#06B6D4] text-white text-sm font-medium rounded-lg active:opacity-80 disabled:opacity-50"
              >
                {strategyControl.isPending ? '暂停中...' : '确认暂停'}
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
          <div className="relative w-full bg-[#12121A] rounded-t-2xl p-6 animate-slide-up">
            <h2 className="text-lg font-semibold mb-2">停止策略？</h2>
            <p className="text-sm text-[#94A3B8] mb-6">
              停止后策略将不再自动交易。当前持仓不会自动平仓。
            </p>

            <div className="flex items-center gap-3">
              <button
                title="取消"
                aria-label="取消"
                onClick={() => setShowStopModal(false)}
                className="flex-1 py-3 text-sm font-medium border border-[#1E1E2E] rounded-lg active:bg-[#1A1A24]"
              >
                取消
              </button>
              <button
                title="确认停止"
                aria-label="确认停止"
                onClick={handleStop}
                disabled={strategyControl.isPending}
                className="flex-1 py-3 bg-[#F87171] text-white text-sm font-medium rounded-lg active:opacity-80 disabled:opacity-50"
              >
                {strategyControl.isPending ? '停止中...' : '确认停止'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
