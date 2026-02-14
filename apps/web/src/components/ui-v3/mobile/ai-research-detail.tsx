'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Clock, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useResearchStatus, useResearchReport, useExecuteResearch } from '@/hooks/useAi';

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

export function ResearchDetailPage() {
  const params = useParams();
  const sessionId = params?.id as string;

  const [expandedStage, setExpandedStage] = useState<string | null>('analysts');
  const [activeTab, setActiveTab] = useState<string>('analysts');
  const [showExecuteModal, setShowExecuteModal] = useState(false);

  const { data: statusData, isLoading: statusLoading } = useResearchStatus(sessionId);
  const { data: reportData } = useResearchReport(
    sessionId,
    statusData?.status === 'completed' || statusData?.status === 'failed'
  );
  const executeResearch = useExecuteResearch();

  const status = (statusData?.status || 'running') as Status;
  const symbol = statusData?.symbol || 'BTC/USDT';

  // 从 reportData 构建 stages
  const stages: Stage[] = (reportData?.stages || []).map((s: any, idx: number) => ({
    id: `stage-${idx + 1}`,
    name: s.name || `阶段 ${idx + 1}`,
    status: s.status as StageStatus || 'pending',
    description: s.status === 'running' ? 'AI正在处理...' : undefined,
    ...(idx === 0 && s.status === 'completed' ? {
      analysts: [
        { id: 'market', name: '市场分析师', status: 'completed' as StageStatus },
        { id: 'technical', name: '技术分析师', status: 'completed' as StageStatus },
        { id: 'fundamental', name: '基本面分析师', status: 'completed' as StageStatus },
        { id: 'news', name: '新闻分析师', status: 'completed' as StageStatus },
        { id: 'sentiment', name: '情绪分析师', status: 'completed' as StageStatus },
      ]
    } : {})
  }));

  // 如果没有 stages，提供默认 5 阶段
  if (stages.length === 0 && status === 'running') {
    stages.push(
      { id: 'analysts', name: '分析师研究', status: 'pending' },
      { id: 'debate', name: '多空辩论', status: 'pending' },
      { id: 'trader', name: '交易员提案', status: 'pending' },
      { id: 'risk', name: '风控辩论', status: 'pending' },
      { id: 'decision', name: '最终决策', status: 'pending' }
    );
  }

  const decisionData: DecisionData | null = reportData?.finalDecision ? {
    direction: reportData.finalDecision.action?.includes('long') ? 'long' : 'short',
    confidence: reportData.finalDecision.confidence || 0,
    leverage: reportData.finalDecision.leverage || 1,
    positionPercent: reportData.finalDecision.positionSizePercent || 0,
    riskRewardRatio: '1:3.2', // 计算或从 reasoning 提取
    stopLoss: reportData.finalDecision.stopLoss?.toString() || '0',
    takeProfit: reportData.finalDecision.takeProfit?.toString() || '0',
    riskLevel: reportData.finalDecision.confidence > 80 ? 'low' : reportData.finalDecision.confidence > 60 ? 'medium' : 'high',
    duration: '计算中',
  } : null;

  const handleExecute = async () => {
    if (!sessionId) return;
    try {
      await executeResearch.mutateAsync(sessionId);
      alert('交易已执行');
      setShowExecuteModal(false);
    } catch (err: any) {
      alert(err.message || '执行失败');
    }
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#94A3B8]">加载中...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'analysts', name: '分析师' },
    { id: 'debate', name: '辩论' },
    { id: 'trader', name: '交易员' },
    { id: 'risk', name: '风控' },
    { id: 'decision', name: '决策' },
  ];

  const getStageIcon = (stageStatus: StageStatus) => {
    switch (stageStatus) {
      case 'completed':
        return <div className="w-4 h-4 rounded-full bg-[#22C55E]" />;
      case 'running':
        return <div className="w-4 h-4 rounded-full bg-[#06B6D4] animate-pulse" />;
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-[#64748B]" />;
    }
  };

  const getStatusText = (stageStatus: StageStatus) => {
    switch (stageStatus) {
      case 'completed':
        return <span className="text-[#22C55E]">✅ 完成</span>;
      case 'running':
        return <span className="text-[#06B6D4]">🔄 进行中</span>;
      case 'pending':
        return <span className="text-[#64748B]">⏳ 等待</span>;
    }
  };

  const getRiskLevelConfig = (level: RiskLevel) => {
    switch (level) {
      case 'low':
        return { text: '低风险', color: 'text-[#22C55E]', icon: '🟢' };
      case 'medium':
        return { text: '中风险', color: 'text-[#F59E0B]', icon: '🟡' };
      case 'high':
        return { text: '高风险', color: 'text-[#EF4444]', icon: '🔴' };
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-10 bg-[#12121A] border-b border-[#1E1E2E]">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 -ml-2 hover:bg-[#1A1A24] rounded-lg transition-colors"
            aria-label="返回"
            title="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">
            {status === 'running' ? `${symbol} 研究中...` : `${symbol} 研究报告`}
          </h1>
        </div>
      </header>

      {/* Running 状态 - 进度视图 */}
      {status === 'running' && (
        <div className="px-4 py-6">
          <div className="space-y-3">
            {stages.map((stage) => (
              <div key={stage.id} className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-4">
                <button
                  onClick={() =>
                    stage.analysts &&
                    setExpandedStage(expandedStage === stage.id ? null : stage.id)
                  }
                  className="w-full flex items-center justify-between"
                  disabled={!stage.analysts}
                  aria-label={`${stage.name} 阶段`}
                >
                  <div className="flex items-center gap-3">
                    {getStageIcon(stage.status)}
                    <span className="font-medium">{stage.name}</span>
                    {getStatusText(stage.status)}
                  </div>
                  {stage.analysts &&
                    (expandedStage === stage.id ? (
                      <ChevronUp className="w-5 h-5 text-[#94A3B8]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#94A3B8]" />
                    ))}
                </button>

                {stage.status === 'running' && stage.description && (
                  <p className="mt-2 text-sm text-[#94A3B8]">{stage.description}</p>
                )}

                {/* 分析师子项 */}
                {stage.analysts && expandedStage === stage.id && (
                  <div className="mt-4 pt-4 border-t border-[#1E1E2E] space-y-2">
                    {stage.analysts.map((analyst) => (
                      <div key={analyst.id} className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                        <span className="text-[#94A3B8]">{analyst.name}</span>
                        <span className="ml-auto text-[#22C55E]">✅</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 底部信息 */}
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[#64748B]">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>研究中...</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              <span>费用 ${(statusData?.totalCost || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Completed 状态 - 报告视图 */}
      {status === 'completed' && decisionData && (
        <div className="pb-6">
          {/* 决策大卡片 */}
          <div
            className={`mx-4 mt-6 p-6 rounded-2xl border-2 ${
              decisionData.direction === 'long'
                ? 'bg-[#22C55E]/10 border-[#22C55E]/30'
                : 'bg-[#EF4444]/10 border-[#EF4444]/30'
            }`}
          >
            {/* 方向和行动 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {decisionData.direction === 'long' ? (
                  <>
                    <TrendingUp className="w-8 h-8 text-[#22C55E]" />
                    <div>
                      <div className="text-2xl font-bold text-[#22C55E]">做多</div>
                      <div className="text-sm text-[#94A3B8]">BUY</div>
                    </div>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-8 h-8 text-[#EF4444]" />
                    <div>
                      <div className="text-2xl font-bold text-[#EF4444]">做空</div>
                      <div className="text-sm text-[#94A3B8]">SELL</div>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-[#94A3B8]">置信度</div>
                <div className="text-2xl font-bold">{decisionData.confidence}%</div>
              </div>
            </div>

            {/* 4个数据网格 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#0A0A0F]/50 rounded-xl p-4">
                <div className="text-xs text-[#94A3B8] mb-1">杠杆</div>
                <div className="text-xl font-bold">{decisionData.leverage}x</div>
              </div>
              <div className="bg-[#0A0A0F]/50 rounded-xl p-4">
                <div className="text-xs text-[#94A3B8] mb-1">仓位</div>
                <div className="text-xl font-bold">{decisionData.positionPercent}%</div>
              </div>
              <div className="bg-[#0A0A0F]/50 rounded-xl p-4">
                <div className="text-xs text-[#94A3B8] mb-1">R:R比</div>
                <div className="text-xl font-bold">{decisionData.riskRewardRatio}</div>
              </div>
              <div className="bg-[#0A0A0F]/50 rounded-xl p-4">
                <div className="text-xs text-[#94A3B8] mb-1">风控评级</div>
                <div className={`text-lg font-bold ${getRiskLevelConfig(decisionData.riskLevel).color}`}>
                  {getRiskLevelConfig(decisionData.riskLevel).icon}{' '}
                  {getRiskLevelConfig(decisionData.riskLevel).text}
                </div>
              </div>
            </div>

            {/* 止损止盈 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94A3B8]">止损价</span>
                <span className="font-mono font-semibold text-[#EF4444]">
                  ${decisionData.stopLoss}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94A3B8]">止盈价</span>
                <span className="font-mono font-semibold text-[#22C55E]">
                  ${decisionData.takeProfit}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#1E1E2E]">
                <span className="text-sm text-[#94A3B8]">研究耗时</span>
                <span className="text-sm font-medium">{decisionData.duration}</span>
              </div>
            </div>
          </div>

          {/* 执行交易按钮 */}
          {!reportData?.executedTradeId &&
           decisionData.direction &&
           reportData?.finalDecision?.action !== 'hold' &&
           reportData?.finalDecision?.action !== 'wait' && (
            <div className="px-4 mt-6">
              <button
                onClick={() => setShowExecuteModal(true)}
                className="w-full py-4 bg-[#06B6D4] text-white rounded-xl font-semibold text-lg hover:bg-[#0891B2] transition-colors flex items-center justify-center gap-2"
                aria-label="执行交易"
                title="执行交易"
              >
                🚀 执行交易
              </button>
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
                      : 'text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                  aria-label={`${tab.name}标签`}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tab 内容区 */}
          <div className="px-4 mt-6">
            <div className="bg-[#12121A] border border-[#1E1E2E] rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">
                {tabs.find((t) => t.id === activeTab)?.name}报告
              </h3>
              <div className="text-sm text-[#94A3B8] leading-relaxed whitespace-pre-line">
                {reportData?.finalDecision?.reasoning || '分析中...'}
              </div>
            </div>
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
          <div className="relative w-full bg-[#12121A] rounded-t-3xl border-t border-[#1E1E2E] animate-slide-up">
            <div className="px-6 py-6">
              {/* 标题 */}
              <h2 className="text-xl font-bold mb-6">确认执行交易？</h2>

              {/* 交易摘要卡片 */}
              <div className="bg-[#1A1A24] border border-[#1E1E2E] rounded-xl p-5 mb-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">交易对</span>
                  <span className="font-semibold">{symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">方向</span>
                  <span className={`font-semibold ${decisionData?.direction === 'long' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {decisionData?.direction === 'long' ? '做多 (BUY)' : '做空 (SELL)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">杠杆</span>
                  <span className="font-semibold">{decisionData?.leverage}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">仓位比例</span>
                  <span className="font-semibold">{decisionData?.positionPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">止损</span>
                  <span className="font-mono text-[#EF4444]">${decisionData?.stopLoss}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">止盈</span>
                  <span className="font-mono text-[#22C55E]">${decisionData?.takeProfit}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-[#1E1E2E]">
                  <span className="text-[#94A3B8]">API Key</span>
                  <span className="font-mono text-sm">已绑定 API Key</span>
                </div>
              </div>

              {/* 警告 */}
              <div className="flex items-start gap-3 mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EF4444]">
                  此操作将使用真实资金下单，请确保您已仔细检查所有参数。交易有风险，投资需谨慎。
                </p>
              </div>

              {/* 按钮组 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExecuteModal(false)}
                  className="flex-1 py-4 bg-[#1A1A24] border border-[#1E1E2E] text-white rounded-xl font-semibold hover:bg-[#0A0A0F] transition-colors"
                  aria-label="取消"
                  title="取消"
                >
                  取消
                </button>
                <button
                  onClick={handleExecute}
                  disabled={executeResearch.isPending}
                  className="flex-1 py-4 bg-[#06B6D4] text-white rounded-xl font-semibold hover:bg-[#0891B2] transition-colors disabled:opacity-50"
                  aria-label="确认执行"
                  title="确认执行"
                >
                  {executeResearch.isPending ? '执行中...' : '确认执行'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResearchDetailPage;
