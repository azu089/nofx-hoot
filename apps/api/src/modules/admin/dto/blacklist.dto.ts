import { IsString, IsOptional, IsBoolean, IsDateString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBlacklistDto {
  @ApiProperty({ enum: ['user', 'email', 'ip', 'device'], description: '黑名单类型' })
  @IsString()
  @IsIn(['user', 'email', 'ip', 'device'])
  type: string;

  @ApiProperty({ description: '具体值（用户ID/邮箱/IP/设备指纹）' })
  @IsString()
  value: string;

  @ApiPropertyOptional({ description: '封禁原因' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: '过期时间（null=永久）' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateBlacklistDto {
  @ApiPropertyOptional({ description: '封禁原因' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: '过期时间' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BlacklistQueryDto {
  @ApiPropertyOptional({ enum: ['user', 'email', 'ip', 'device'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
