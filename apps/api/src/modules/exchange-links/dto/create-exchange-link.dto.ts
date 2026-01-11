import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsUrl, IsArray } from 'class-validator';

export class CreateExchangeLinkDto {
  @ApiProperty({ description: '交易所ID（唯一）', example: 'binance' })
  @IsString()
  @IsNotEmpty()
  exchange_id: string;

  @ApiProperty({ description: '交易所名称', example: 'Binance' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Logo (emoji 或 URL)', example: '🟡' })
  @IsString()
  @IsNotEmpty()
  logo: string;

  @ApiProperty({ description: '返佣比例显示文本', example: '20%' })
  @IsString()
  @IsNotEmpty()
  rebate: string;

  @ApiProperty({ description: '推广链接', example: 'https://www.binance.com/zh-CN/register?ref=QUANTFI123' })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  link: string;

  @ApiPropertyOptional({ description: '交易所描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '特性标签数组', type: [String], example: ['现货交易', '合约交易'] })
  @IsArray()
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: '排序', example: 0 })
  @IsInt()
  @IsOptional()
  sort_order?: number;
}
