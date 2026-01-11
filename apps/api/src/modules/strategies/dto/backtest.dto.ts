import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';

/**
 * 回测请求 DTO
 */
export class BacktestRequestDto {
  @ApiProperty({ description: '策略 ID' })
  @IsString()
  strategyId: string;

  @ApiProperty({ description: '起始日期', example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: '结束日期', example: '2024-03-31' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: '初始资金 (USDT)', example: 10000 })
  @IsNumber()
  @Min(100)
  @Max(1000000)
  initialCapital: number;

  @ApiProperty({
    description: '交易对列表',
    example: ['BTC/USDT', 'ETH/USDT'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  pairs: string[];

  @ApiPropertyOptional({ description: '杠杆倍数', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  leverage?: number;

  @ApiPropertyOptional({ description: '止损比例', example: -0.05 })
  @IsOptional()
  @IsNumber()
  @Min(-1)
  @Max(0)
  stoploss?: number;

  @ApiPropertyOptional({ description: '止盈比例', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  takeprofit?: number;

  @ApiPropertyOptional({
    description: 'K 线周期',
    example: '4h',
    enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
  })
  @IsOptional()
  @IsString()
  timeframe?: string;

  @ApiPropertyOptional({ description: '最大持仓数', example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxOpenTrades?: number;

  @ApiPropertyOptional({ description: '手续费率', example: 0.001 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.01)
  fee?: number;

  @ApiPropertyOptional({
    description: '是否跟随策略代码中的参数配置（止损/止盈/K线/追踪止损）',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  followStrategyCode?: boolean;
}

/**
 * 收益曲线数据点
 */
export class CurveDataPoint {
  @ApiProperty({ description: '日期' })
  date: string;

  @ApiProperty({ description: '当日资金价值' })
  value: number;

  @ApiProperty({ description: '当日交易次数' })
  trades: number;
}

/**
 * 回测结果 DTO
 */
export class BacktestResultDto {
  @ApiProperty({ description: '总收益率 (%)' })
  totalReturn: number;

  @ApiProperty({ description: '胜率 (%)' })
  winRate: number;

  @ApiProperty({ description: '最大回撤 (%)' })
  maxDrawdown: number;

  @ApiProperty({ description: '夏普比率' })
  sharpeRatio: number;

  @ApiProperty({ description: '总交易次数' })
  totalTrades: number;

  @ApiProperty({ description: '平均盈利 (USDT)' })
  avgProfit: number;

  @ApiProperty({ description: '平均亏损 (USDT)' })
  avgLoss: number;

  @ApiProperty({ description: '盈亏比' })
  profitFactor: number;

  @ApiProperty({ description: '收益曲线', type: [CurveDataPoint] })
  curve: CurveDataPoint[];

  @ApiProperty({ description: '策略名称' })
  strategyName: string;

  @ApiProperty({ description: '回测开始日期' })
  startDate: string;

  @ApiProperty({ description: '回测结束日期' })
  endDate: string;

  @ApiProperty({ description: '初始资金' })
  initialCapital: number;

  @ApiProperty({ description: '最终资金' })
  finalCapital: number;

  @ApiProperty({ description: '交易对' })
  pairs: string[];
}

/**
 * 回测历史记录 DTO
 */
export class BacktestHistoryDto {
  @ApiProperty({ description: '回测记录 ID' })
  id: string;

  @ApiProperty({ description: '策略名称' })
  strategyName: string;

  @ApiProperty({ description: '回测日期范围' })
  dateRange: string;

  @ApiProperty({ description: '总收益率' })
  totalReturn: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}
