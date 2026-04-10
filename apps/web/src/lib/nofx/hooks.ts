/**
 * nofx 代理接口的 TanStack Query hooks。
 *
 * 直接复用 HOOT 现有 ApiClient（apps/web/src/lib/api.ts），它已经处理好了
 *  - localStorage hoot_token Bearer 注入
 *  - 401 自动 refresh token
 *  - locale 注入
 *  - 短路防 spam
 * 所以这里只需关心 nofx 业务路径 + Query Key 设计。
 *
 * 缓存策略：
 *  - traders 列表：staleTime 30s（用户切换 trader 时频繁调）
 *  - status/account：staleTime 5s（实时性高）
 *  - positions/decisions：staleTime 5s
 *  - retry: 1（nofx 不可达时不刷屏）
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  NofxTraderListItem,
  NofxPosition,
  NofxAccount,
  NofxLatestDecision,
  NofxStatistics,
  NofxEquityPoint,
  NofxStrategy,
  NofxAiModel,
  NofxExchange,
} from './types';

const QK = {
  traders: ['nofx', 'traders'] as const,
  status: (id: string) => ['nofx', 'trader', id, 'status'] as const,
  account: (id: string) => ['nofx', 'trader', id, 'account'] as const,
  positions: (id: string) => ['nofx', 'trader', id, 'positions'] as const,
  decisions: (id: string) => ['nofx', 'trader', id, 'decisions'] as const,
  statistics: (id: string) => ['nofx', 'trader', id, 'statistics'] as const,
  equity: (id: string, range: string) =>
    ['nofx', 'trader', id, 'equity', range] as const,
  strategies: ['nofx', 'strategies'] as const,
  models: ['nofx', 'models'] as const,
  exchanges: ['nofx', 'exchanges'] as const,
};

export function useNofxTraders() {
  return useQuery({
    queryKey: QK.traders,
    queryFn: async () => {
      const resp = await api.get<NofxTraderListItem[]>('/nofx/traders');
      return resp.data ?? [];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useNofxAccount(traderId: string | null) {
  return useQuery({
    queryKey: QK.account(traderId ?? ''),
    enabled: !!traderId,
    queryFn: async () => {
      const resp = await api.get<NofxAccount>(`/nofx/traders/${traderId}/account`);
      return resp.data;
    },
    staleTime: 5_000,
    retry: 1,
  });
}

export function useNofxPositions(traderId: string | null) {
  return useQuery({
    queryKey: QK.positions(traderId ?? ''),
    enabled: !!traderId,
    queryFn: async () => {
      const resp = await api.get<NofxPosition[]>(`/nofx/traders/${traderId}/positions`);
      return resp.data ?? [];
    },
    staleTime: 5_000,
    retry: 1,
  });
}

export function useNofxLatestDecisions(traderId: string | null) {
  return useQuery({
    queryKey: QK.decisions(traderId ?? ''),
    enabled: !!traderId,
    queryFn: async () => {
      const resp = await api.get<NofxLatestDecision[]>(
        `/nofx/traders/${traderId}/decisions/latest`,
      );
      return resp.data ?? [];
    },
    staleTime: 5_000,
    retry: 1,
  });
}

export function useNofxStatistics(traderId: string | null) {
  return useQuery({
    queryKey: QK.statistics(traderId ?? ''),
    enabled: !!traderId,
    queryFn: async () => {
      const resp = await api.get<NofxStatistics>(
        `/nofx/traders/${traderId}/statistics`,
      );
      return resp.data;
    },
    staleTime: 10_000,
    retry: 1,
  });
}

export function useNofxEquityHistory(traderId: string | null, range = '7d') {
  return useQuery({
    queryKey: QK.equity(traderId ?? '', range),
    enabled: !!traderId,
    queryFn: async () => {
      const resp = await api.get<NofxEquityPoint[]>(
        `/nofx/traders/${traderId}/equity-history?range=${encodeURIComponent(range)}`,
      );
      return resp.data ?? [];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useNofxStrategies() {
  return useQuery({
    queryKey: QK.strategies,
    // nofx 端 /api/strategies 返回 { strategies: [...] }（不是裸数组）
    // 我们在这里 unwrap，对外保持纯数组语义
    queryFn: async () => {
      const resp = await api.get<{ strategies?: NofxStrategy[] } | NofxStrategy[]>(
        '/nofx/strategies',
      );
      const raw = resp.data;
      if (Array.isArray(raw)) return raw;
      return raw?.strategies ?? [];
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useNofxAiModels() {
  return useQuery({
    queryKey: QK.models,
    queryFn: async () => {
      const resp = await api.get<NofxAiModel[]>('/nofx/models');
      return resp.data ?? [];
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useNofxExchanges() {
  return useQuery({
    queryKey: QK.exchanges,
    queryFn: async () => {
      const resp = await api.get<NofxExchange[]>('/nofx/exchanges');
      return resp.data ?? [];
    },
    staleTime: 60_000,
    retry: 1,
  });
}

// ==========================================================================
// 写操作 mutations (P6b-2)
// ==========================================================================

export function useStartTrader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (traderId: string) => {
      const resp = await api.post('/nofx/traders/' + traderId + '/start', {});
      return resp.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.traders }),
  });
}

export function useStopTrader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (traderId: string) => {
      const resp = await api.post('/nofx/traders/' + traderId + '/stop', {});
      return resp.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.traders }),
  });
}

export function useDeleteTrader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (traderId: string) => {
      const resp = await api.delete('/nofx/traders/' + traderId);
      return resp.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.traders }),
  });
}

export function useClosePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { traderId: string; symbol: string; side: string }) => {
      const resp = await api.post(
        '/nofx/traders/' + args.traderId + '/close-position',
        { symbol: args.symbol, side: args.side },
      );
      return resp.data;
    },
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: QK.positions(args.traderId) });
      qc.invalidateQueries({ queryKey: QK.account(args.traderId) });
    },
  });
}
