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

/**
 * 单笔持仓解读请求 DTO
 */
export class InterpretTradeDto {
  @IsString()
  @IsNotEmpty({ message: '交易对不能为空' })
  pair: string; // 交易对，如 BTC/USDT

  @IsString()
  @IsNotEmpty({ message: '方向不能为空' })
  side: string; // 方向：buy/sell

  @IsString()
  @IsNotEmpty({ message: '数量不能为空' })
  amount: string; // 持仓数量

  @IsString()
  @IsNotEmpty({ message: '价格不能为空' })
  price: string; // 开仓价格

  @IsString()
  @IsNotEmpty({ message: '盈亏不能为空' })
  pnl: string; // 浮动盈亏（USDT）

  @IsString()
  @IsNotEmpty({ message: '执行时间不能为空' })
  executed_at: string; // 开仓时间（ISO 格式）
}
