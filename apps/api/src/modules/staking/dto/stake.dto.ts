import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Matches,
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
 */
export class StakeDto {
  @IsString()
  @IsNotEmpty({ message: '质押金额不能为空' })
  @Matches(/^\d+(\.\d{1,8})?$/, { message: '质押金额格式错误，最多8位小数' })
  amount: string;

  @IsEnum(['A', 'B'], { message: '质押类型必须为 A 或 B' })
  @IsNotEmpty({ message: '质押类型不能为空' })
  stake_type: 'A' | 'B';

  @IsOptional()
  @IsNumber({}, { message: '锁定天数必须为数字' })
  @IsIn(ALLOWED_LOCK_DAYS, { message: '锁定天数只能是 30、90、180 或 365 天' })
  lock_days?: number; // 仅 B 类需要，且必须在白名单内
}
