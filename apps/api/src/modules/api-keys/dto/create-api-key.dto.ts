import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 创建 API Key DTO
 */
export class CreateApiKeyDto {
  @ApiProperty({ description: '交易所', example: 'binance', enum: ['binance', 'okx', 'bybit'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['binance', 'okx', 'bybit'])
  exchange: string;

  @ApiProperty({ description: 'API Key', example: 'your-api-key' })
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @ApiProperty({ description: 'Secret Key', example: 'your-secret-key' })
  @IsString()
  @IsNotEmpty()
  secretKey: string;

  @ApiPropertyOptional({ description: '标签', example: '主账户' })
  @IsOptional()
  @IsString()
  label?: string;
}
