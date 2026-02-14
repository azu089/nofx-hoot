'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AiConfig,
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
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await api.put<{ success: boolean; strategy: any }>(`/ai/strategy/${id}`, body);
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

export function useStrategyControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: 'start' | 'stop' | 'pause'; body?: any }) => {
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
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await api.put<{ success: boolean; strategy: any }>(`/ai/strategy/${id}/config`, body);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai-strategy', vars.id] });
    },
  });
}

export function useStrategyLogs(id: string | undefined, page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['ai-strategy-logs', id, page, limit],
    queryFn: async () => {
      const res = await api.get<StrategyLogsResponse>(`/ai/strategy/${id}/logs?page=${page}&limit=${limit}`);
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
