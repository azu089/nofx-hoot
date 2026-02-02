import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsInt,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// 创建质押
// 只支持单币 HOOT 质押，权重基于锁定天数
// 活期（lockDays=0）：权重 1.0x
// 定期（lockDays>0）：权重随锁定时间增长 1.0x -> 3.0x（最长365天）
export class CreateStakingDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  @Type(() => Number)
  lockDays?: number; // 锁定天数（0-365），0=活期
}

// 解除质押
export class UnstakeDto {
  @IsString()
  stakingId: string;
}

// 质押响应
export class StakingResponse {
  id: string;
  amount: string;
  weight: string;
  weightedAmount: string;
  stakedAt: Date;
  lockDays: number;
  lockUntil: Date | null;
  status: string; // active, locked, unstaked
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
