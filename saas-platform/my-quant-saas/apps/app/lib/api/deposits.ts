import { api } from './client';
import { ApiResponse, Deposit } from './types';

/**
 * 充值相关 API
 */
export const depositsApi = {
  /**
   * 获取充值列表
   */
  list: (params?: { page?: number; limit?: number }) =>
    api.get<never, ApiResponse<{ deposits: Deposit[]; total: number }>>('/deposits', {
      params,
    }),

  /**
   * 创建充值申请
   */
  create: (data: { amount: string; method: string }) =>
    api.post<never, ApiResponse<Deposit>>('/deposits', data),

  /**
   * 获取充值详情
   */
  getById: (id: string) => api.get<never, ApiResponse<Deposit>>(`/deposits/${id}`),
};
