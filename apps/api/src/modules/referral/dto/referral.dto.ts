import { IsString, MaxLength } from 'class-validator';

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
// 业务规则：
//   - 返佣来源：燃油费（用户交易平仓盈利时从GAS扣除的手续费）
//   - 订阅费 = 平台纯收入，不参与返佣（平台需覆盖 LLM API 成本）
//   - 质押分红收益 = 不参与返佣
//   - 返佣层级：2 级（无三级）
//   - 燃油费流向：50% → 全网质押分红池；邀请返佣额外从平台支付
export const REFERRAL_CONFIG = {
  // 层级返佣比例（占燃油费金额的百分比）
  LEVEL1_RATE: 0.10, // 一级返佣 10%（直接邀请人）
  LEVEL2_RATE: 0.05, // 二级返佣 5%（邀请人的邀请人）

  // 邀请码长度
  INVITE_CODE_LENGTH: 8,
} as const;
