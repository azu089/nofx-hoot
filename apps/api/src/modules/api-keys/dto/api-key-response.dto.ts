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

  @ApiProperty({ description: 'API Key 遮罩显示（基于 ID 生成）' })
  api_key_masked: string;

  @ApiPropertyOptional({ description: '权限列表' })
  permissions: string[] | null;

  @ApiProperty({ description: '是否激活' })
  isActive: boolean;

  @ApiProperty({ description: '是否已验证（last_verified_at 存在则为 true）' })
  is_valid: boolean;

  @ApiPropertyOptional({ description: '最后验证时间' })
  lastVerifiedAt: Date | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

/**
 * 交易所余额信息
 */
export class ExchangeBalanceDto {
  @ApiProperty({ description: '币种' })
  currency: string;

  @ApiProperty({ description: '可用余额' })
  free: string;

  @ApiProperty({ description: '冻结余额' })
  used: string;

  @ApiProperty({ description: '总余额' })
  total: string;
}

/**
 * API Key 验证响应 DTO
 */
export class VerifyApiKeyResponseDto {
  @ApiProperty({ description: '是否有效' })
  valid: boolean;

  @ApiPropertyOptional({ description: '权限列表' })
  permissions?: string[];

  @ApiPropertyOptional({ description: '交易所余额列表（主要币种）' })
  balances?: ExchangeBalanceDto[];

  @ApiPropertyOptional({ description: '总资产估值（USDT）' })
  totalBalanceUsdt?: string;

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string;
}
