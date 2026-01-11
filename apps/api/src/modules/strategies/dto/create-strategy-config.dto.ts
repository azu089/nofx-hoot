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
  IsIn,
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
 * 黑天鹅防护触发动作
 */
export enum BlackSwanAction {
  PAUSE = 'pause', // 暂停交易
  CLOSE_ALL = 'close_all', // 全部平仓
  NOTIFY_ONLY = 'notify_only', // 仅通知
}

/**
 * 黑天鹅防护配置
 * 用于自动检测市场异常并触发保护措施
 */
export class BlackSwanConfig {
  @ApiPropertyOptional({ description: '是否启用黑天鹅防护', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: '触发阈值（价格跌幅百分比，负数）',
    example: -10,
    minimum: -50,
    maximum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-50)
  @Max(0)
  threshold?: number; // 默认 -10 (下跌 10%)

  @ApiPropertyOptional({
    description: '检测时间窗口（分钟）',
    example: 5,
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  timeframe_minutes?: number; // 默认 5 分钟

  @ApiPropertyOptional({
    description: '触发动作',
    example: 'pause',
    enum: BlackSwanAction,
  })
  @IsOptional()
  @IsEnum(BlackSwanAction)
  action?: BlackSwanAction;
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
    description: '未成交订单超时时间（分钟）',
    example: 10,
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  unfilledtimeout?: number;

  @ApiPropertyOptional({
    description: '退出时是否取消未成交的挂单',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  cancel_open_orders_on_exit?: boolean;

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

  @ApiPropertyOptional({
    description: '黑天鹅防护配置',
    type: () => BlackSwanConfig,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BlackSwanConfig)
  black_swan?: BlackSwanConfig;

  @ApiPropertyOptional({
    description: '是否为模拟交易模式（不使用真实资金）',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;

  @ApiPropertyOptional({
    description: '是否跟随策略代码中的参数配置（止损/止盈/K线/追踪止损）',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  follow_strategy_code?: boolean;
}
