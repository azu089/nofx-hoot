import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 策略收益统计响应 DTO - Phase 16.5
 */
export class StrategyRevenueStatsDto {
  @ApiProperty({ description: '总收益 (USDT)' })
  totalRevenue: string;

  @ApiProperty({ description: '待结算收益 (USDT)' })
  pendingRevenue: string;

  @ApiProperty({ description: '已结算收益 (USDT)' })
  settledRevenue: string;

  @ApiProperty({ description: '按策略分组的收益', type: [Object] })
  revenueByStrategy: Array<{
    strategyId: string;
    strategyName: string;
    revenue: string;
    users: number;
    tier: string;
  }>;
}

/**
 * 收益明细查询参数 DTO
 */
export class RevenueLogsQueryDto {
  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ description: '策略 ID 筛选', required: false })
  @IsOptional()
  @IsString()
  strategyId?: string;
}

/**
 * 收益明细响应 DTO
 */
export class RevenueLogsResponseDto {
  @ApiProperty({ description: '收益记录列表', type: [Object] })
  logs: Array<{
    id: string;
    strategyName: string;
    userName: string;
    baseAmount: string;
    revenueAmount: string;
    revenueShareRate: string;
    status: string;
    createdAt: Date;
  }>;

  @ApiProperty({ description: '总记录数' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}

/**
 * 升级进度响应 DTO
 */
export class UpgradeProgressDto {
  @ApiProperty({ description: '当前等级' })
  currentTier: string;

  @ApiProperty({ description: '当前分成比例' })
  currentRate: string;

  @ApiProperty({ description: '下一等级信息', required: false })
  nextTier?: {
    level: string;
    requiredUsers: number;
    requiredProfit: number;
    requiredWinRate: number;
    progressUsers: number;
    progressProfit: number;
    progressWinRate: number;
  };
}
