import { api } from './client';
import { ApiResponse, Trade, Position, Order, BotStatus } from './types';

/**
 * 交易相关 API
 */
export const tradingApi = {
  /**
   * 获取交易历史
   */
  getTrades: (limit?: number) =>
    api.get<never, ApiResponse<Trade[]>>('/trades', { params: { limit } }),

  /**
   * 获取当前持仓
   */
  getPositions: () => api.get<never, ApiResponse<Position[]>>('/trades/positions'),

  /**
   * 获取订单列表
   */
  getOrders: (params?: { status?: string; limit?: number }) =>
    api.get<never, ApiResponse<Order[]>>('/trades/orders', { params }),

  /**
   * 获取机器人状态
   */
  getBotStatus: (instanceId: string) =>
    api.get<never, ApiResponse<BotStatus>>(`/freqtrade/${instanceId}/status`),

  /**
   * 启动机器人
   */
  startBot: (instanceId: string, strategyId: string) =>
    api.post<never, ApiResponse<void>>(`/freqtrade/${instanceId}/start`, { strategyId }),

  /**
   * 停止机器人
   */
  stopBot: (instanceId: string) =>
    api.post<never, ApiResponse<void>>(`/freqtrade/${instanceId}/stop`),
};
