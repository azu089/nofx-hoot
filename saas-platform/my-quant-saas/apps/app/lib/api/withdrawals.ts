import { api } from './client';
import { ApiResponse, Withdrawal } from './types';

/**
 * 提现相关 API
 */
export const withdrawalsApi = {
  /**
   * 获取提现列表
   */
  list: (params?: { page?: number; limit?: number }) =>
    api.get<never, ApiResponse<{ withdrawals: Withdrawal[]; total: number }>>('/withdrawals', {
      params,
    }),

  /**
   * 创建提现申请
   */
  create: (data: { amount: string; chain: string; to_address: string }) =>
    api.post<never, ApiResponse<Withdrawal>>('/withdrawals', data),

  /**
   * 获取提现详情
   */
  getById: (id: string) => api.get<never, ApiResponse<Withdrawal>>(`/withdrawals/${id}`),
};
