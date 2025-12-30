import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';

/**
 * 更新配置 DTO
 */
export class UpdateConfigDto {
  @ApiProperty({ description: '配置值' })
  value: any;

  @ApiPropertyOptional({ description: '配置描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '是否公开' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/**
 * 批量更新配置 DTO
 */
export class BatchUpdateConfigDto {
  @ApiProperty({ description: '配置列表' })
  configs: Record<string, any>;
}

/**
 * 配置响应 DTO
 */
export class ConfigResponseDto {
  @ApiProperty({ description: '配置键' })
  configKey: string;

  @ApiProperty({ description: '配置值' })
  configValue: any;

  @ApiProperty({ description: '配置类型' })
  configType: string;

  @ApiProperty({ description: '分类' })
  category: string;

  @ApiProperty({ description: '显示名称' })
  label: string;

  @ApiPropertyOptional({ description: '描述' })
  description?: string;

  @ApiProperty({ description: '是否公开' })
  isPublic: boolean;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

/**
 * 配置分类
 */
export type ConfigCategory = 'billing' | 'vip' | 'feature' | 'vps' | 'agent';

/**
 * 配置类型
 */
export type ConfigType = 'string' | 'number' | 'boolean' | 'json';
