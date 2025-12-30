import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';

/**
 * 策略生成请求 DTO
 */
export class GenerateStrategyDto {
  @IsString()
  @IsNotEmpty({ message: '策略描述不能为空' })
  description: string; // 用户的策略描述

  @IsEnum(['low', 'medium', 'high'], { message: '风险等级必须为 low/medium/high' })
  riskLevel: 'low' | 'medium' | 'high'; // 风险等级

  @IsOptional()
  @IsString()
  tradingPair?: string; // 交易对（可选，如 BTC/USDT）
}

/**
 * 交易分析请求 DTO
 */
export class AnalyzeTradesDto {
  @IsString()
  @IsNotEmpty({ message: '时间范围不能为空' })
  timeRange: string; // 时间范围，如 '7d', '30d', '90d'
}
