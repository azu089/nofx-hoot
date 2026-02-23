'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/admin-auth';

// ========================= useAdminApi — 通用 GET 数据拉取 =========================

/**
 * 通用管理后台数据拉取 Hook
 * 挂载时自动请求，deps 变化时自动重新请求
 */
export function useAdminApi<T>(
  path: string,
  options?: {
    /** 是否启用自动拉取，默认 true */
    enabled?: boolean;
    /** 依赖数组，变化时重新拉取（与 path 本身一起作为依赖） */
    deps?: unknown[];
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = options?.enabled !== false;

  const fetch = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await adminApi.get<T>(path);
      setData(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '请求失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, ...(options?.deps ?? [])]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ========================= useAdminMutation — 通用写操作 =========================

/**
 * 通用管理后台写操作 Hook（POST / PUT / PATCH / DELETE）
 * 自动处理 loading、错误状态，并通过 sonner 弹出 toast 提示
 */
export function useAdminMutation<TData = unknown, TInput = unknown>(options?: {
  onSuccess?: (data: TData) => void;
  onError?: (error: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (
      path: string,
      method: 'post' | 'put' | 'patch' | 'delete',
      data?: TInput
    ): Promise<TData | undefined> => {
      setLoading(true);
      setError(null);

      try {
        let response;

        switch (method) {
          case 'post':
            response = await adminApi.post<TData>(path, data ?? {});
            break;
          case 'put':
            response = await adminApi.put<TData>(path, data ?? {});
            break;
          case 'patch':
            response = await adminApi.patch<TData>(path, data ?? {});
            break;
          case 'delete':
            response = await adminApi.delete<TData>(path);
            break;
        }

        const result = response.data;
        toast.success('操作成功');
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : '操作失败';
        setError(message);
        toast.error(message);
        options?.onError?.(message);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options?.onSuccess, options?.onError]
  );

  return { mutate, loading, error };
}

// ========================= useAdminList — 带分页、搜索、筛选的列表 =========================

/** 后端列表响应格式（兼容 items / users 等不同字段名） */
interface ListApiResponse<T> {
  items?: T[];
  users?: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 管理后台列表 Hook
 * 内置分页、搜索、筛选，自动拼接查询字符串并在状态变化时重新请求
 */
export function useAdminList<T>(
  basePath: string,
  options?: {
    /** 每页条数，默认 20 */
    defaultLimit?: number;
    /** 初始筛选条件 */
    defaultFilters?: Record<string, string>;
  }
) {
  const limit = options?.defaultLimit ?? 20;

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(
    options?.defaultFilters ?? {}
  );

  const buildQueryString = useCallback(
    (currentPage: number, currentSearch: string, currentFilters: Record<string, string>) => {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(limit));

      if (currentSearch.trim()) {
        params.set('search', currentSearch.trim());
      }

      for (const [key, value] of Object.entries(currentFilters)) {
        if (value !== '' && value !== undefined) {
          params.set(key, value);
        }
      }

      return params.toString();
    },
    [limit]
  );

  const fetch = useCallback(
    async (currentPage: number, currentSearch: string, currentFilters: Record<string, string>) => {
      setLoading(true);
      setError(null);

      try {
        const qs = buildQueryString(currentPage, currentSearch, currentFilters);
        const path = `${basePath}?${qs}`;
        const response = await adminApi.get<ListApiResponse<T>>(path);
        const payload = response.data;

        // 兼容 items / users 等不同数组字段名
        const rows = payload.items ?? payload.users ?? [];

        setItems(rows);
        setTotal(payload.total ?? 0);
        setTotalPages(payload.totalPages ?? 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [basePath, buildQueryString]
  );

  // page / search / filters 任意变化时重新拉取
  useEffect(() => {
    fetch(page, search, filters);
  }, [page, search, filters, fetch]);

  /** 修改单个筛选条件，同时重置到第一页 */
  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  /** 修改搜索词，同时重置到第一页 */
  const handleSetSearch = useCallback((s: string) => {
    setSearch(s);
    setPage(1);
  }, []);

  const refetch = useCallback(() => {
    fetch(page, search, filters);
  }, [fetch, page, search, filters]);

  return {
    items,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    filters,
    setPage,
    setSearch: handleSetSearch,
    setFilter,
    refetch,
  };
}
