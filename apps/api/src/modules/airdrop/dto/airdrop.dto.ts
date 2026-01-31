import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';

// 空投类型
export enum AirdropType {
  REGISTER = 'register',        // 注册奖励
  BIND_TG = 'bind_tg',          // 绑定 Telegram（已有账户绑定）
  BIND_WALLET = 'bind_wallet',  // 绑定钱包（已有账户绑定）
  BIND_EMAIL = 'bind_email',    // 绑定邮箱（已有账户绑定）
  REFERRAL = 'referral',        // 邀请奖励
  TRADING_PROFIT = 'trading_profit', // 盈利交易奖励
  CHECKIN = 'checkin',          // 每日签到
}

// 空投状态
export enum AirdropStatus {
  PENDING = 'pending',       // 待确认
  CONFIRMED = 'confirmed',   // 已确认
  VESTING = 'vesting',       // 释放中
  COMPLETED = 'completed',   // 已完成
  CANCELLED = 'cancelled',   // 已取消
}

// 空投奖励配置（防通胀版本 v2）
export const AIRDROP_REWARDS = {
  [AirdropType.REGISTER]: 50,       // 注册 +50 HOOT（任意方式首次注册）
  [AirdropType.BIND_TG]: 10,        // 绑定 TG +10 HOOT（已有账户额外绑定）
  [AirdropType.BIND_WALLET]: 10,    // 绑定钱包 +10 HOOT
  [AirdropType.BIND_EMAIL]: 15,     // 绑定邮箱 +15 HOOT（因需验证，奖励更高）
  [AirdropType.REFERRAL]: 50,       // 邀请 +50 HOOT
  [AirdropType.TRADING_PROFIT]: 5,  // 盈利 * 5 HOOT（降低倍数）
  [AirdropType.CHECKIN]: {          // 签到奖励
    base: 5,                        // 基础奖励
    max: 30,                        // 最大奖励（连续 6 天达到上限）
    increment: 5,                   // 连续签到递增
  },
};

// 空投上限配置（防滥用）
export const AIRDROP_CAPS = {
  // 签到终身上限
  checkinLifetimeCap: 1000,         // 签到累计最多 1000 HOOT
  // 交易盈利每日上限
  tradingProfitDailyCap: 100,       // 每日最多 100 HOOT
  // 邀请每日上限
  referralDailyCap: 500,            // 每日最多 500 HOOT（10 人）
};

// HOOT 消耗机制（未来实现）
// 1. 订阅策略消耗 HOOT（每月 X HOOT）
// 2. 高级功能解锁消耗 HOOT
// 3. VIP 服务消耗 HOOT
// 4. 链上提现手续费消耗 HOOT

// Vesting 配置
export const VESTING_CONFIG = {
  defaultDays: 30,      // 默认释放天数
  minDays: 30,          // 最短释放周期
  maxDays: 90,          // 最长释放周期
  minWithdraw: 100,     // 最低提现数量
  withdrawFeePercent: 5, // 提现手续费 5%
};

// 查询空投历史 DTO
export class QueryAirdropDto {
  @IsOptional()
  @IsEnum(AirdropType)
  type?: AirdropType;

  @IsOptional()
  @IsEnum(AirdropStatus)
  status?: AirdropStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

// 空投余额响应
export class AirdropBalanceDto {
  totalBalance: string;      // 总余额（含锁定）
  lockedBalance: string;     // 锁定余额
  availableBalance: string;  // 可用余额
  pendingAmount: string;     // 待确认空投
  vestingProgress: number;   // 释放进度 0-100
}

// 空投记录响应
export class AirdropRecordDto {
  id: string;
  type: AirdropType;
  amount: string;
  status: AirdropStatus;
  vestingDays: number;
  vestingProgress: number;
  releasedAmount: string;
  source?: string;
  createdAt: Date;
  confirmedAt?: Date;
}

// 签到响应
export class CheckinResponseDto {
  success: boolean;
  reward: string;
  streak: number;
  nextReward: string;
  message: string;
}

// 提现请求 DTO
export class WithdrawHootDto {
  @IsNumber()
  @Min(100) // 最低 100 HOOT
  amount: number;

  @IsString()
  tonAddress: string; // TON 钱包地址
}
