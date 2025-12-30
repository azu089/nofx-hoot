import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * API Key 响应 DTO（不包含敏感信息）
 */
export class ApiKeyResponseDto {
  @ApiProperty({ description: 'API Key ID' })
  id: string;

  @ApiProperty({ description: '交易所' })
  exchange: string;

  @ApiPropertyOptional({ description: '标签' })
  label: string | null;

  @ApiPropertyOptional({ description: '权限列表' })
  permissions: string[] | null;

  @ApiProperty({ description: '是否激活' })
  isActive: boolean;

  @ApiPropertyOptional({ description: '最后验证时间' })
  lastVerifiedAt: Date | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

/**
 * API Key 验证响应 DTO
 */
export class VerifyApiKeyResponseDto {
  @ApiProperty({ description: '是否有效' })
  valid: boolean;

  @ApiPropertyOptional({ description: '权限列表' })
  permissions?: string[];

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string;
}
