import { Expose } from 'class-transformer';

/**
 * 代理商响应 DTO
 */
export class AgentResponseDto {
  @Expose()
  id: string;

  @Expose()
  code: string; // 邀请码

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  commission_rate: string; // DECIMAL 字段

  @Expose()
  total_users: number;

  @Expose()
  total_commission: string; // DECIMAL 字段

  @Expose()
  status: string;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;
}

/**
 * 代理商统计数据 DTO
 */
export class AgentStatsDto {
  // 基础统计
  totalUsers: number; // 总用户数
  totalCommission: string; // 累计返佣金额
  pendingCommission: string; // 待结算佣金
  withdrawableCommission: string; // 可提现佣金
  paidCommission: string; // 已支付佣金

  // 本月统计
  monthlyUsers: number; // 本月新增用户
  monthlyCommission: string; // 本月返佣金额

  // 今日统计
  todayUsers: number; // 今日新增用户
  todayCommission: string; // 今日返佣金额
}

/**
 * 下级用户简要信息 DTO
 */
export class ReferralUserDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  vip_level: number;

  @Expose()
  created_at: Date;

  // 贡献统计
  totalSpent: string; // 总消费金额
  totalCommission: string; // 总返佣金额
}
