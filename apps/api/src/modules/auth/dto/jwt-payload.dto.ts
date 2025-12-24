/**
 * JWT Payload 数据结构
 * 用于 JWT 策略验证和装饰器提取
 */
export interface JwtPayload {
  /**
   * 用户 ID
   */
  sub: string;

  /**
   * 用户邮箱
   */
  email: string;

  /**
   * VIP 等级
   */
  vipLevel: number;

  /**
   * JWT 签发时间（Unix 时间戳）
   */
  iat?: number;

  /**
   * JWT 过期时间（Unix 时间戳）
   */
  exp?: number;
}
