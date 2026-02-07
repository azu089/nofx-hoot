import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';

// 空投类型
export enum AirdropType {
  REGISTER = 'register', // 注册奖励
  BIND_TG = 'bind_tg', // 绑定 Telegram（已有账户绑定）
  BIND_WALLET = 'bind_wallet', // 绑定钱包（已有账户绑定）
  BIND_EMAIL = 'bind_email', // 绑定邮箱（已有账户绑定）
  REFERRAL = 'referral', // 邀请奖励
  TRADING_PROFIT = 'trading_profit', // 盈利交易奖励
  CHECKIN = 'checkin', // 每日签到
}

// 空投状态
export enum AirdropStatus {
  PENDING = 'pending', // 待确认
  CONFIRMED = 'confirmed', // 已确认
  VESTING = 'vesting', // 释放中
  COMPLETED = 'completed', // 已完成
  CANCELLED = 'cancelled', // 已取消
}

// ============================================================
// 空投奖励配置 v3 - 基于行业标准研究
// ============================================================
// 参考来源:
// - Binance SIGN: 单用户上限 4% 总分配
// - 主流交易所注册奖励: $20-100 等值
// - 行业释放周期: 6-12 个月（空投用户）
// - 推荐机制: 5%-20% 终身佣金制
// ============================================================

export const AIRDROP_REWARDS = {
  [AirdropType.REGISTER]: 50, // 注册 +50 HOOT（首次注册，需完成验证）
  [AirdropType.BIND_TG]: 10, // 绑定 TG +10 HOOT
  [AirdropType.BIND_WALLET]: 10, // 绑定钱包 +10 HOOT
  [AirdropType.BIND_EMAIL]: 15, // 绑定邮箱 +15 HOOT（需邮箱验证）
  [AirdropType.REFERRAL]: 25, // 邀请 +25 HOOT（降低避免滥用）
  [AirdropType.TRADING_PROFIT]: 3, // 盈利 * 3 HOOT（保守倍数）
  [AirdropType.CHECKIN]: {
    // 签到奖励（渐进式）
    base: 3, // 基础奖励 3 HOOT
    max: 15, // 最大奖励 15 HOOT（连续 7 天达到）
    increment: 2, // 连续签到每天 +2 HOOT
  },
};

// ============================================================
// 空投上限配置（防滥用 + 防通胀）
// ============================================================
// 设计原则:
// 1. 每日上限 - 防止短期大量刷取
// 2. 终身上限 - 防止长期无限累积（关键！）
// 3. 单用户最大 3585 HOOT（参考 Binance 4% 上限原则）
// ============================================================

export const AIRDROP_CAPS = {
  // 签到上限
  checkinDailyCap: 15, // 每日最多 15 HOOT（连续签到上限）
  checkinLifetimeCap: 500, // 终身最多 500 HOOT

  // 交易盈利上限
  tradingProfitDailyCap: 50, // 每日最多 50 HOOT
  tradingProfitLifetimeCap: 1000, // 终身最多 1000 HOOT（新增）

  // 邀请上限
  referralDailyCap: 250, // 每日最多 250 HOOT（10 人 * 25）
  referralLifetimeCap: 2000, // 终身最多 2000 HOOT（新增，80 人上限）
};

// ============================================================
// 单用户最大 HOOT 计算 (v3)
// ============================================================
// 一次性奖励:
//   - 注册: 50 HOOT
//   - 绑定 TG: 10 HOOT
//   - 绑定钱包: 10 HOOT
//   - 绑定邮箱: 15 HOOT
//   小计: 85 HOOT
//
// 可重复奖励（有终身上限）:
//   - 签到: 500 HOOT (终身上限)
//   - 推荐: 2000 HOOT (终身上限，约 80 人)
//   - 交易盈利: 1000 HOOT (终身上限)
//   小计: 3500 HOOT
//
// 单用户终身最大: 3585 HOOT
// ============================================================

// ============================================================
// HOOT 消耗机制（通缩设计）
// ============================================================
// 1. 订阅策略消耗 HOOT（每月 X HOOT）
// 2. 高级功能解锁消耗 HOOT
// 3. VIP 服务消耗 HOOT
// 4. 链上提现手续费 5%（销毁）
// 5. 策略订阅费用（部分销毁）
// ============================================================

// ============================================================
// Vesting 释放配置（统一 90 天）
// ============================================================
// 行业标准: 空投用户 6-12 个月释放
// HOOT 策略: 90 天（3 个月）- 平衡用户体验与防抛压
// ============================================================

export const VESTING_CONFIG = {
  defaultDays: 90, // 统一释放周期 90 天
  minDays: 90, // 最短 90 天（与默认一致）
  maxDays: 180, // 最长 180 天（特殊情况可延长）
  cliffDays: 7, // 7 天锁定期（防止立即提现）
  minWithdraw: 100, // 最低提现数量
  withdrawFeePercent: 5, // 提现手续费 5%（销毁机制）
};

// ============================================================
// 任务系统 DTO
// ============================================================

// 任务状态
export enum TaskStatus {
  INCOMPLETE = 'incomplete', // 任务未完成（如未绑定 TG）
  COMPLETED = 'completed', // 已完成（奖励自动到账）
  REPEATABLE = 'repeatable', // 可重复任务（邀请、盈利交易）
}

// 任务项
export interface TaskItemDto {
  id: string; // 任务ID（register/bind_tg/bind_wallet/bind_email/referral/trading_profit）
  label: string; // 任务名称
  description: string; // 任务描述
  reward: string; // 奖励描述（如 "50 HOOT"、"25 HOOT/人"）
  rewardAmount: number; // 奖励数值
  status: TaskStatus; // 任务状态
  claimedAmount?: string; // 已领取金额（repeatable 类型）
  claimedCount?: number; // 已领取次数（repeatable 类型）
  actionUrl?: string; // 跳转链接（incomplete 状态时使用）
}

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
  totalBalance: string; // 总余额（含锁定）
  lockedBalance: string; // 锁定余额
  availableBalance: string; // 可用余额
  pendingAmount: string; // 待确认空投
  vestingProgress: number; // 释放进度 0-100
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
