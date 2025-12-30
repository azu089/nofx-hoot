import { api } from './client';
import { ApiResponse, Strategy, StrategyDetail, MyStrategy } from './types';

/**
 * 策略相关 API
 */
export const strategiesApi = {
  /**
   * 获取策略市场列表
   */
  list: (params?: { type?: string; risk_level?: string }) =>
    api.get<never, ApiResponse<Strategy[]>>('/strategies', { params }),

  /**
   * 获取策略详情
   */
  get: (id: string) => api.get<never, ApiResponse<StrategyDetail>>(`/strategies/${id}`),

  /**
   * 获取我的订阅策略
   */
  getMyStrategies: () => api.get<never, ApiResponse<MyStrategy[]>>('/strategies/subscribed'),

  /**
   * 订阅策略
   */
  subscribe: (strategyId: string, allocatedCapital: string) =>
    api.post<never, ApiResponse<MyStrategy>>('/strategies/subscribe', {
      strategyId,
      allocatedCapital,
    }),

  /**
   * 取消订阅
   */
  unsubscribe: (id: string) => api.delete<never, ApiResponse<void>>(`/strategies/subscribed/${id}`),

  /**
   * 启用/暂停策略
   */
  toggleStatus: (id: string, status: 'running' | 'paused') =>
    api.patch<never, ApiResponse<void>>(`/strategies/subscribed/${id}/status`, { status }),
};
