import { api } from './client';
import { ApiResponse, Instance } from './types';

/**
 * VPS 实例相关 API
 */
export const instancesApi = {
  /**
   * 获取用户所有实例
   */
  list: () => api.get<never, ApiResponse<Instance[]>>('/instances'),

  /**
   * 获取单个实例详情
   */
  get: (id: string) => api.get<never, ApiResponse<Instance>>(`/instances/${id}`),

  /**
   * 创建新实例
   */
  create: (data: { region: string; strategyId?: string }) =>
    api.post<never, ApiResponse<Instance>>('/instances', data),

  /**
   * 销毁实例
   */
  destroy: (id: string) => api.delete<never, ApiResponse<void>>(`/instances/${id}`),

  /**
   * 发送心跳
   */
  heartbeat: (id: string, data: { cpu_usage?: string; memory_usage?: string }) =>
    api.post<never, ApiResponse<void>>(`/instances/${id}/heartbeat`, data),
};
