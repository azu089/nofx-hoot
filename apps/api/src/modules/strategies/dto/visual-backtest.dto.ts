import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 指标类型枚举
 */
export enum IndicatorType {
  RSI = 'RSI',
  MACD = 'MACD',
  MA = 'MA',
  EMA = 'EMA',
  BOLLINGER = 'BOLLINGER',
  ATR = 'ATR',
  STOCH = 'STOCH',
  ADX = 'ADX',
}

/**
 * 操作符类型枚举
 */
export enum OperatorType {
  LT = '<',
  GT = '>',
  EQ = '==',
  CROSS_ABOVE = 'cross_above',
  CROSS_BELOW = 'cross_below',
}

/**
 * 指标配置
 */
export class IndicatorConfigDto {
  @ApiProperty({ description: '指标唯一 ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: '指标类型', enum: IndicatorType })
  @IsEnum(IndicatorType)
  type: IndicatorType;

  @ApiProperty({ description: '指标参数', example: { period: 14 } })
  @IsObject()
  params: Record<string, number>;
}

/**
 * 条件配置
 */
export class ConditionConfigDto {
  @ApiProperty({ description: '条件唯一 ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: '关联的指标 ID' })
  @IsString()
  @IsNotEmpty()
  indicator: string;

  @ApiPropertyOptional({ description: '指标字段（如 MACD 的 macd/signal）' })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiProperty({ description: '比较操作符', enum: OperatorType })
  @IsEnum(OperatorType)
  operator: OperatorType;

  @ApiProperty({ description: '比较值（数字或指标引用）' })
  @IsNotEmpty()
  value: number | string;
}

/**
 * 风控配置
 */
export class RiskConfigDto {
  @ApiProperty({ description: '止损比例', example: -0.05 })
  @IsNumber()
  @Min(-1)
  @Max(0)
  stoploss: number;

  @ApiProperty({ description: '止盈比例', example: 0.1 })
  @IsNumber()
  @Min(0)
  @Max(2)
  takeProfit: number;

  @ApiProperty({ description: '是否启用追踪止损', default: false })
  @IsBoolean()
  trailingStop: boolean;

  @ApiPropertyOptional({ description: '追踪止损偏移量', example: 0.02 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  trailingStopOffset?: number;
}

/**
 * 可视化回测请求 DTO
 */
export class VisualBacktestRequestDto {
  @ApiProperty({ description: '策略名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '技术指标配置', type: [IndicatorConfigDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IndicatorConfigDto)
  indicators: IndicatorConfigDto[];

  @ApiProperty({ description: '买入条件', type: [ConditionConfigDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConditionConfigDto)
  buyConditions: ConditionConfigDto[];

  @ApiProperty({ description: '卖出条件', type: [ConditionConfigDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConditionConfigDto)
  sellConditions: ConditionConfigDto[];

  @ApiProperty({ description: '风控配置', type: RiskConfigDto })
  @ValidateNested()
  @Type(() => RiskConfigDto)
  riskManagement: RiskConfigDto;

  @ApiProperty({
    description: '交易对列表',
    example: ['BTC/USDT', 'ETH/USDT'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  pairs: string[];

  @ApiProperty({ description: '起始日期', example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: '结束日期', example: '2024-06-30' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: '初始资金 (USDT)', example: 10000 })
  @IsNumber()
  @Min(100)
  @Max(1000000)
  initialCapital: number;

  @ApiPropertyOptional({ description: '杠杆倍数', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  leverage?: number;

  @ApiPropertyOptional({
    description: 'K 线周期',
    example: '4h',
    enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
  })
  @IsOptional()
  @IsString()
  timeframe?: string;
}
