import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  IsIn,
} from 'class-validator';

// 质押金额限制
export const STAKE_LIMITS = {
  MIN_AMOUNT: '10', // 最小质押 10
  MAX_AMOUNT: '1000000', // 最大质押 100万
};

// 允许的锁定天数（积分和代币质押通用）
export const ALLOWED_LOCK_DAYS = [30, 90, 180, 365];

// 锁定期权重倍数表（积分和代币质押通用）
export const LOCK_PERIOD_WEIGHTS: Record<number, number> = {
  30: 1.2,   // 30 天 → 1.2x
  90: 1.5,   // 90 天 → 1.5x
  180: 2.0,  // 180 天 → 2.0x
  365: 3.0,  // 365 天 → 3.0x
};

/**
 * 质押 DTO
 *
 * 积分质押（A 类）和代币质押（B 类）统一规则：
 * - 都必须指定 lock_days（30/90/180/365 天）
 * - 权重倍数相同（由锁定期决定）
 * - 权重归一化：1000 积分 = 1 QFI 的基础权重
 */
export class StakeDto {
  @IsString()
  @IsNotEmpty({ message: '质押金额不能为空' })
  @Matches(/^\d+(\.\d{1,8})?$/, { message: '质押金额格式错误，最多8位小数' })
  amount: string;

  @IsEnum(['A', 'B'], { message: '质押类型必须为 A 或 B' })
  @IsNotEmpty({ message: '质押类型不能为空' })
  stake_type: 'A' | 'B';

  // 积分和代币质押都必须指定锁定天数
  @IsNotEmpty({ message: '必须指定锁定天数' })
  @IsNumber({}, { message: '锁定天数必须为数字' })
  @IsIn(ALLOWED_LOCK_DAYS, { message: '锁定天数只能是 30、90、180 或 365 天' })
  lock_days: number;
}
