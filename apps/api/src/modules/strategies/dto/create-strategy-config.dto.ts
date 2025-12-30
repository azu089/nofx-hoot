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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
  custom_config?: Record<string, any>;
}
