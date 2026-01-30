import { IsString, MaxLength, IsOptional } from 'class-validator';

// 绑定邀请码 DTO
export class BindInviteCodeDto {
  @IsString()
  @MaxLength(20)
  inviteCode: string;
}

// 邀请统计响应
export class ReferralStatsResponse {
  inviteCode: string;
  totalInvites: number;
  totalRewards: string;
  pendingRewards: string;
  inviteLink: string;
}

// 被邀请人信息
export class InviteeResponse {
  id: string;
  nickname: string;
  email: string; // 脱敏
  createdAt: Date;
  totalContribution: string; // 贡献的返佣金额
}

// 返佣记录响应
export class RewardRecordResponse {
  id: string;
  fromUserNickname: string;
  type: string;
  amount: string;
  asset: string;
  status: string;
  createdAt: Date;
}

// 返佣配置
export const REFERRAL_CONFIG = {
  // 返佣比例
  SUBSCRIPTION_RATE: 0.1, // 订阅费 10%
  TRADING_FEE_RATE: 0.05, // 交易手续费 5%

  // 邀请码长度
  INVITE_CODE_LENGTH: 8,
} as const;
