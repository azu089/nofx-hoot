/**
 * 释放进度 DTO
 */
export class VestingProgressDto {
  totalVesting: string; // 总待释放代币
  released: string; // 已释放
  pending: string; // 待释放
  nextReleaseAmount: string; // 下次释放数量
  nextReleaseDate: Date | null; // 下次释放日期
  vestingOrders: VestingOrderDto[]; // 释放中订单列表
}

/**
 * 单个释放订单 DTO
 */
export class VestingOrderDto {
  orderId: string;
  tokensTotal: string;
  tokensReleased: string;
  tokensPending: string;
  vestingMode: 'standard' | 'fast';
  vestingStartAt: Date;
  vestingEndAt: Date | null;
  lastReleaseAt: Date | null;
  progress: number; // 释放进度百分比 (0-100)
  daysRemaining: number; // 剩余天数
}
