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

// B 类允许的锁定天数
export const ALLOWED_LOCK_DAYS = [30, 90, 180, 365];

/**
 * 质押 DTO
 *
 * A 类质押（积分）：无需锁定期，lock_days 可选（会被忽略）
 * B 类质押（代币）：必须指定 lock_days，且只能是 30/90/180/365 天
 */
export class StakeDto {
  @IsString()
  @IsNotEmpty({ message: '质押金额不能为空' })
  @Matches(/^\d+(\.\d{1,8})?$/, { message: '质押金额格式错误，最多8位小数' })
  amount: string;

  @IsEnum(['A', 'B'], { message: '质押类型必须为 A 或 B' })
  @IsNotEmpty({ message: '质押类型不能为空' })
  stake_type: 'A' | 'B';

  // 仅 B 类质押需要验证 lock_days
  @ValidateIf((o) => o.stake_type === 'B')
  @IsNotEmpty({ message: 'B 类质押必须指定锁定天数' })
  @IsNumber({}, { message: '锁定天数必须为数字' })
  @IsIn(ALLOWED_LOCK_DAYS, { message: 'B 类质押锁定天数只能是 30、90、180 或 365 天' })
  lock_days?: number;
}
