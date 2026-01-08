import {
  IsUUID,
  IsNumber,
  IsInt,
  IsBoolean,
  IsArray,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
  ArrayMaxSize,
  IsString,
  IsEnum,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 支持的 K 线周期
 */
export enum Timeframe {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d',
}

/**
 * 支持的交易所
 */
export enum SupportedExchange {
  BINANCE = 'binance',
  OKX = 'okx',
  BYBIT = 'bybit',
}

/**
 * 分阶段止盈配置项
 */
export class MinimalRoiEntry {
  @ApiProperty({ description: '分钟数', example: 0 })
  @IsInt()
  @Min(0)
  @Max(10080) // 最多 7 天
  minutes: number;

  @ApiProperty({ description: '止盈比例（0-10, 例如 0.1 = 10%）', example: 0.1 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(10) // 最高 1000% 止盈
  roi: number;
}

/**
 * 创建策略配置 DTO
 * 用户为某个策略创建自己的配置
 */
export class CreateStrategyConfigDto {
  @ApiProperty({ description: '策略 ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  strategy_id: string;

  @ApiPropertyOptional({ description: 'VPS 实例 ID（可选，后续绑定）', example: 'uuid' })
  @IsOptional()
  @IsUUID()
  instance_id?: string;

  @ApiProperty({ description: '投入金额 (USDT)', example: '100.00000000', type: String })
  @IsString()
  @IsNotEmpty()
  stake_amount: string; // 使用 string 对应 DECIMAL

  @ApiProperty({ description: '最大同时持仓数', example: 3, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  max_open_trades: number;

  @ApiProperty({ description: '杠杆倍数', example: 1, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  leverage: number;

  @ApiProperty({ description: '止损比例（-1 到 0）', example: -0.1, minimum: -1, maximum: 0 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-1)
  @Max(0)
  stoploss: number;

  @ApiPropertyOptional({ description: '是否启用移动止损', example: false })
  @IsOptional()
  @IsBoolean()
  trailing_stop?: boolean;

  @ApiPropertyOptional({ description: '移动止损触发点（正数）', example: 0.01, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  trailing_stop_positive?: number;

  @ApiPropertyOptional({ description: '移动止损偏移量', example: 0.02, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  trailing_stop_positive_offset?: number;

  @ApiPropertyOptional({ description: '是否只在达到偏移量时启用移动止损', example: true })
  @IsOptional()
  @IsBoolean()
  trailing_only_offset_is_reached?: boolean;

  @ApiPropertyOptional({
    description: 'K 线周期',
    example: '5m',
    enum: Timeframe,
  })
  @IsOptional()
  @IsEnum(Timeframe)
  timeframe?: Timeframe;

  @ApiPropertyOptional({
    description: '分阶段止盈配置',
    example: [
      { minutes: 0, roi: 0.1 },
      { minutes: 30, roi: 0.05 },
      { minutes: 60, roi: 0.02 },
    ],
    type: [MinimalRoiEntry],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MinimalRoiEntry)
  minimal_roi?: MinimalRoiEntry[];

  @ApiPropertyOptional({ description: '是否启用交易所级止损', example: true })
  @IsOptional()
  @IsBoolean()
  stoploss_on_exchange?: boolean;

  @ApiPropertyOptional({
    description: '交易所',
    example: 'binance',
    enum: SupportedExchange,
  })
  @IsOptional()
  @IsEnum(SupportedExchange)
  exchange?: SupportedExchange;

  @ApiPropertyOptional({
    description: '交易对白名单（选择的币种）',
    example: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  pair_whitelist?: string[];

  @ApiPropertyOptional({
    description: '黑名单（不交易的币种）',
    example: ['DOGE/USDT', 'SHIB/USDT'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  blacklist?: string[];

  @ApiPropertyOptional({ description: '自定义配置（JSON）', example: { custom_param: 'value' } })
  @IsOptional()
  @IsObject()
  custom_config?: Record<string, any>;

  @ApiPropertyOptional({
    description: '强制覆盖现有配置（如存在活跃配置）',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
