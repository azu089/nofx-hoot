import { IsString, IsNumber, IsOptional, IsEnum, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

// 质押类型
export enum StakingType {
  A = 'A', // 空投获得，权重固定 1.0x
  B = 'B', // 购买获得，权重随时间增长 1.0x -> 3.0x
}

// 创建质押
export class CreateStakingDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @IsEnum(StakingType)
  type: StakingType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lockDays?: number; // 锁定天数（0-365）
}

// 解除质押
export class UnstakeDto {
  @IsString()
  stakingId: string;
}

// 质押响应
export class StakingResponse {
  id: string;
  type: string;
  amount: string;
  weight: string;
  weightedAmount: string;
  stakedAt: Date;
  lockDays: number;
  lockUntil: Date | null;
  status: string;
}

// 质押统计
export class StakingStats {
  totalStaked: string;
  totalWeighted: string;
  estimatedWeeklyDividend: string;
  nextDividendDate: Date | null;
}

// 分红记录响应
export class DividendResponse {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  stakedAmount: string;
  weightedAmount: string;
  dividendAmount: string;
  status: string;
  paidAt: Date | null;
}
