import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

/**
 * 策略上传 DTO - Phase 16.5
 *
 * 用户上传策略时需要提供：
 * 1. 策略基本信息（名称、描述、代码）
 * 2. 回测参数（开始日期、结束日期、初始资金、交易对）
 */
export class UploadStrategyDto {
  @ApiProperty({ description: '策略名称', example: '我的动量策略' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: '策略描述',
    example: '基于 RSI 和 EMA 的动量策略',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: '策略 Python 代码',
    example: `import pandas as pd
import talib

def populate_indicators(dataframe, metadata):
    dataframe['rsi'] = talib.RSI(dataframe['close'], timeperiod=14)
    return dataframe`,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(50)
  @MaxLength(50000)
  content: string;

  // ===== 回测参数 =====

  @ApiProperty({
    description: '回测开始日期',
    example: '2024-01-01',
  })
  @IsDateString()
  backtestStartDate: string;

  @ApiProperty({
    description: '回测结束日期',
    example: '2024-03-31',
  })
  @IsDateString()
  backtestEndDate: string;

  @ApiProperty({
    description: '回测初始资金 (USDT)',
    example: 10000,
  })
  @IsNumber()
  @Min(100)
  @Max(1000000)
  backtestInitialCapital: number;

  @ApiProperty({
    description: '回测交易对',
    example: ['BTC/USDT', 'ETH/USDT'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  backtestPairs: string[];
}

/**
 * 策略上传响应 DTO
 */
export class UploadStrategyResponseDto {
  @ApiProperty({ description: '策略 ID' })
  strategyId: string;

  @ApiProperty({ description: '审核状态', enum: ['approved', 'flagged'] })
  reviewStatus: string;

  @ApiProperty({ description: '是否通过自动审核' })
  autoCheckPassed: boolean;

  @ApiProperty({ description: '自动审核警告（如有）', type: [String] })
  warnings: string[];

  @ApiProperty({ description: '回测结果摘要' })
  backtestSummary: {
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}
