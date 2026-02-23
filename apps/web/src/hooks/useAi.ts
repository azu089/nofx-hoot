'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AiConfig,
  AiStrategy,
  UpdateAiConfigBody,
  UpdateAiConfigResponse,
  AiBudget,
  AiPerformance,
  ResearchHistoryResponse,
  ResearchStatus,
  ResearchReport,
  StartResearchBody,
  StartResearchResponse,
  ExecuteResearchResponse,
  StrategyListResponse,
  StrategyDetailResponse,
  CreateStrategyBody,
  CreateStrategyResponse,
  StrategyControlResponse,
  StrategyLogsResponse,
  StrategyPnlChartResponse,
  CompetitionResponse,
  StrategyPositionsResponse,
  UserPositionsResponse,
  PromptPreviewResponse,
  TriggerCycleResponse,
  PromptSections,
  RiskControlConfig,
  CampaignStats,
  TimelineResponse,
  ResearchStagesResponse,
} from '@/types/ai';

// ========================= AI 配置 =========================

export function useAiConfig() {
  return useQuery({
    queryKey: ['ai-config'],
    queryFn: async () => {
      const res = await api.get<AiConfig>('/ai/config');
      return res.data;
    },
    staleTime: 30000,
  });
}

export function useUpdateAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateAiConfigBody) => {
      const res = await api.put<UpdateAiConfigResponse>('/ai/config', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-config'] });
      qc.invalidateQueries({ queryKey: ['ai-budget'] });
    },
  });
}

/**
 * AI 输出语言自动跟随 App 语言设置
 * 在 AI 相关页面调用此 hook，当 App locale 与 AiConfig.locale 不一致时静默同步
 */
export function useAiLocaleSync(appLocale: string) {
  const { data: aiConfig } = useAiConfig();
  const updateConfig = useUpdateAiConfig();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!aiConfig || !appLocale) return;
    if (syncedRef.current === appLocale) return;
    if (aiConfig.locale === appLocale) {
      syncedRef.current = appLocale;
      return;
    }
    syncedRef.current = appLocale;
    updateConfig.mutate({ locale: appLocale });
  }, [aiConfig, appLocale]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ========================= 预算 =========================

export function useAiBudget() {
  return useQuery({
    queryKey: ['ai-budget'],
    queryFn: async () => {
      const res = await api.get<AiBudget>('/ai/budget');
      return res.data;
    },
    staleTime: 60000,
  });
}

// ========================= 性能 =========================

export function useAiPerformance() {
  return useQuery({
    queryKey: ['ai-performance'],
    queryFn: async () => {
      const res = await api.get<AiPerformance>('/ai/performance');
      return res.data;
    },
    staleTime: 120000,
  });
}

// ========================= 产品 A: 研究 =========================

export function useStartResearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: StartResearchBody) => {
      const res = await api.post<StartResearchResponse>('/ai/research/start', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-research-history'] });
      qc.invalidateQueries({ queryKey: ['ai-budget'] });
    },
  });
}

export function useResearchHistory(page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: ['ai-research-history', page, limit],
    queryFn: async () => {
      const res = await api.get<ResearchHistoryResponse>(`/ai/research/history?page=${page}&limit=${limit}`);
      return res.data;
    },
    staleTime: 30000,
  });
}

export function useResearchStatus(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['ai-research-status', sessionId],
    queryFn: async () => {
      const res = await api.get<ResearchStatus>(`/ai/research/${sessionId}/status`);
      return res.data;
    },
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 3000 : false;
    },
  });
}

export function useResearchReport(sessionId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ai-research-report', sessionId],
    queryFn: async () => {
      const res = await api.get<ResearchReport>(`/ai/research/${sessionId}/report`);
      return res.data;
    },
    enabled: !!sessionId && enabled,
  });
}

export function useExecuteResearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await api.post<ExecuteResearchResponse>(`/ai/research/${sessionId}/execute`, {});
      return res.data;
    },
    onSuccess: (_data, sessionId) => {
      qc.invalidateQueries({ queryKey: ['ai-research-status', sessionId] });
      qc.invalidateQueries({ queryKey: ['ai-research-report', sessionId] });
      qc.invalidateQueries({ queryKey: ['ai-research-history'] });
    },
  });
}

// ========================= 产品 A: 循环控制 =========================

export function useStopResearchCycling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await api.post<{ success: boolean; message: string }>(`/ai/research/${sessionId}/stop-cycling`, {});
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-research-history'] });
      qc.invalidateQueries({ queryKey: ['ai-campaign'] });
    },
  });
}

export function usePauseResearchCycling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await api.post<{ success: boolean; message: string }>(`/ai/research/${sessionId}/pause-cycling`, {});
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-campaign'] });
    },
  });
}

export function useResumeResearchCycling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await api.post<{ success: boolean; message: string }>(`/ai/research/${sessionId}/resume-cycling`, {});
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-campaign'] });
    },
  });
}

export function useCampaignStats(rootSessionId: string | undefined) {
  return useQuery({
    queryKey: ['ai-campaign', rootSessionId],
    queryFn: async () => {
      const res = await api.get<CampaignStats>(`/ai/research/${rootSessionId}/campaign`);
      return res.data;
    },
    enabled: !!rootSessionId,
    refetchInterval: 30000, // 每30秒刷新
  });
}

export function useUpdateResearchConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await api.put<{ success: boolean; config: Record<string, unknown> }>(`/ai/research/${id}/config`, body);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai-campaign', vars.id] });
      qc.invalidateQueries({ queryKey: ['ai-research-status', vars.id] });
    },
  });
}

// ========================= 产品 B: 策略 =========================

export function useStrategyList(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['ai-strategies', page, limit],
    queryFn: async () => {
      const res = await api.get<StrategyListResponse>(`/ai/strategy?page=${page}&limit=${limit}`);
      return res.data;
    },
    staleTime: 30000,
  });
}

export function useCreateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateStrategyBody) => {
      const res = await api.post<CreateStrategyResponse>('/ai/strategy', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-strategies'] });
    },
  });
}

export function useStrategyDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['ai-strategy', id],
    queryFn: async () => {
      const res = await api.get<StrategyDetailResponse>(`/ai/strategy/${id}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 15000,
  });
}

export function useUpdateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<AiStrategy> }) => {
      const res = await api.put<{ success: boolean; strategy: AiStrategy }>(`/ai/strategy/${id}`, body);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai-strategy', vars.id] });
      qc.invalidateQueries({ queryKey: ['ai-strategies'] });
    },
  });
}

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ success: boolean; message: string }>(`/ai/strategy/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-strategies'] });
    },
  });
}

export function useDeleteResearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ success: boolean; message: string }>(`/ai/research/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-research-history'] });
    },
  });
}

export function useStrategyControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: 'start' | 'stop' | 'pause'; body?: Record<string, unknown> }) => {
      const res = await api.post<StrategyControlResponse>(`/ai/strategy/${id}/${action}`, body || {});
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai-strategy', vars.id] });
      qc.invalidateQueries({ queryKey: ['ai-strategies'] });
    },
  });
}

export function useHotUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await api.put<{ success: boolean; strategy: AiStrategy }>(`/ai/strategy/${id}/config`, body);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai-strategy', vars.id] });
    },
  });
}

export function useStrategyPositions(id: string | undefined, status: string = 'all') {
  return useQuery({
    queryKey: ['ai-strategy-positions', id, status],
    queryFn: async () => {
      const res = await api.get<StrategyPositionsResponse>(`/ai/strategy/${id}/positions?status=${status}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 15000,
  });
}

export function useStrategyLogs(id: string | undefined, page: number = 1, limit: number = 20, actionsOnly: boolean = true) {
  return useQuery({
    queryKey: ['ai-strategy-logs', id, page, limit, actionsOnly],
    queryFn: async () => {
      const res = await api.get<StrategyLogsResponse>(`/ai/strategy/${id}/logs?page=${page}&limit=${limit}&actionsOnly=${actionsOnly}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 15000,
  });
}

export function useStrategyPnlChart(id: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: ['ai-strategy-pnl', id, days],
    queryFn: async () => {
      const res = await api.get<StrategyPnlChartResponse>(`/ai/strategy/${id}/pnl-chart?days=${days}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 60000,
  });
}

export function useCompetition(period: string = 'weekly', page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['ai-competition', period, page, limit],
    queryFn: async () => {
      const res = await api.get<CompetitionResponse>(`/ai/strategy/competition?period=${period}&page=${page}&limit=${limit}`);
      return res.data;
    },
    staleTime: 60000,
  });
}

// ========================= 用户级持仓（独立于策略） =========================

/** 用户所有 AI 持仓（含已删除策略的历史），单端点替代 N+1 查询 */
export function useUserPositions(status: 'open' | 'closed' | 'all' = 'all', page: number = 1, limit: number = 50) {
  return useQuery({
    queryKey: ['ai-user-positions', status, page, limit],
    queryFn: async () => {
      const res = await api.get<UserPositionsResponse>(`/ai/positions?status=${status}&page=${page}&limit=${limit}`);
      return res.data;
    },
    staleTime: 15000,
  });
}

// ========================= Prompt 预览 =========================

export function usePreviewPrompt() {
  return useMutation({
    mutationFn: async (body: {
      promptSections?: PromptSections;
      riskControlConfig?: Partial<RiskControlConfig>;
      intervalMinutes?: number;
    }) => {
      const res = await api.post<PromptPreviewResponse>('/ai/strategy/preview-prompt', body);
      return res.data;
    },
  });
}

// ========================= 统一时间线 =========================

/** 跨策略/研究的统一时间线 */
export function useAiTimeline(page: number = 1, limit: number = 10, type: string = 'all', actionsOnly: boolean = true) {
  return useQuery({
    queryKey: ['ai-timeline', page, limit, type, actionsOnly],
    queryFn: async () => {
      const res = await api.get<TimelineResponse>(`/ai/timeline?page=${page}&limit=${limit}&type=${type}&actionsOnly=${actionsOnly}`);
      return res.data;
    },
    staleTime: 15000,
  });
}

/** 懒加载研究阶段详情 */
export function useResearchStages(sessionId: string | null) {
  return useQuery({
    queryKey: ['research-stages', sessionId],
    queryFn: async () => {
      const res = await api.get<ResearchStagesResponse>(`/ai/research/${sessionId}/stages`);
      return res.data;
    },
    enabled: !!sessionId,
    staleTime: 60000,
  });
}

// ========================= 手动触发策略周期 =========================

export function useTriggerCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (strategyId: string) => {
      const res = await api.post<TriggerCycleResponse>(`/ai/strategy/${strategyId}/trigger-cycle`, {});
      return res.data;
    },
    onSuccess: (_data, strategyId) => {
      qc.invalidateQueries({ queryKey: ['ai-strategy', strategyId] });
      qc.invalidateQueries({ queryKey: ['ai-strategy-logs', strategyId] });
      qc.invalidateQueries({ queryKey: ['ai-strategy-positions', strategyId] });
    },
  });
}
