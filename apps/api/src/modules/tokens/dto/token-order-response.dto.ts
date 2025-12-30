/**
 * 代币订单响应 DTO
 */
export class TokenOrderResponseDto {
  id: string;
  userId: string;
  pointsSpent: string;
  tokensTotal: string;
  exchangeRate: string;
  vestingMode: 'standard' | 'fast';
  tokensReleased: string;
  tokensPending: string;
  tokensBurned: string;
  vestingStartAt: Date;
  vestingEndAt: Date | null;
  lastReleaseAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 兑换成功响应 DTO
 */
export class ExchangeResponseDto {
  orderId: string;
  tokensReceived: string;
  tokensPending: string;
  tokensBurned: string;
  message: string;
}
