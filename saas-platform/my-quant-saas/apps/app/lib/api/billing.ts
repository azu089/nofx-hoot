import { api } from './client';
import { ApiResponse, TodayPnL, PnLCurve, BillingLog } from './types';

/**
 * 计费相关 API
 */
export const billingApi = {
  /**
   * 获取今日盈亏统计
   */
  getTodayPnL: () => api.get<never, ApiResponse<TodayPnL>>('/billing/today-pnl'),

  /**
   * 获取 PnL 曲线
   */
  getPnLCurve: (params?: { days?: number }) =>
    api.get<never, ApiResponse<PnLCurve>>('/billing/pnl-curve', { params }),

  /**
   * 获取计费日志
   */
  getBillingLogs: (params?: { page?: number; limit?: number; type?: string }) =>
    api.get<never, ApiResponse<{ logs: BillingLog[]; total: number }>>('/billing/logs', {
      params,
    }),
};
