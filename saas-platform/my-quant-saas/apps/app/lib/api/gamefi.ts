import { api } from './client';
import { ApiResponse, Stake, PointsHistory, LeaderboardEntry } from './types';

/**
 * GameFi 相关 API
 */
export const gamefiApi = {
  /**
   * 获取质押列表
   */
  getStakes: () => api.get<never, ApiResponse<Stake[]>>('/gamefi/stakes'),

  /**
   * 创建质押
   * @param type 质押类型 A/B
   * @param amount 质押金额
   * @param lockDays 锁定天数
   */
  stake: (type: string, amount: string, lockDays: number) =>
    api.post<never, ApiResponse<{ id: string }>>('/gamefi/stake', {
      stake_type: type,
      amount,
      lock_days: lockDays,
    }),

  /**
   * 解除质押
   */
  unstake: (id: string) =>
    api.post<never, ApiResponse<{ id: string; amount: string }>>(`/gamefi/unstake/${id}`),

  /**
   * 获取积分历史
   * @param limit 返回条数，默认 50
   */
  getPointsHistory: (limit?: number) =>
    api.get<never, ApiResponse<PointsHistory[]>>('/gamefi/points/history', { params: { limit } }),

  /**
   * 积分兑换 USDT
   * @param points 兑换积分数
   */
  exchangePoints: (points: number) =>
    api.post<never, ApiResponse<{ usdt: string; points: number }>>('/gamefi/exchange', { points }),

  /**
   * 获取排行榜
   */
  getLeaderboard: () => api.get<never, ApiResponse<LeaderboardEntry[]>>('/gamefi/leaderboard'),
};
