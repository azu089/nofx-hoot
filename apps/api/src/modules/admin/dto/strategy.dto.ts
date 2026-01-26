import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsJSON,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建策略 DTO
 */
export class CreateStrategyDto {
  @IsString()
  @IsNotEmpty({ message: '策略名称不能为空' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty({ message: '策略内容不能为空' })
  content: string;

  @IsOptional()
  @IsJSON({ message: 'config 必须是有效的 JSON' })
  config?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // 【Bug #3 修复】添加性能指标字段
  @IsOptional()
  @IsString()
  type?: string; // 策略类型: grid, trend, dca, arbitrage, scalping, swing

  @IsOptional()
  @IsString()
  riskLevel?: string; // 风险等级: low, medium, high

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  winRate?: number; // 胜率 (0-100%)

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(0)
  maxDrawdown?: number; // 最大回撤 (-100% - 0%)

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sharpeRatio?: number; // 夏普比率

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  monthlyReturn?: number; // 月收益率
}

/**
 * 更新策略 DTO
 */
export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsJSON({ message: 'config 必须是有效的 JSON' })
  config?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // 【Bug #3 修复】添加性能指标字段
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  winRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(0)
  maxDrawdown?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sharpeRatio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  monthlyReturn?: number;
}
