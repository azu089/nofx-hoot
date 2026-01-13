import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RevokeSessionDto {
  @ApiProperty({ description: '会话ID' })
  @IsString()
  sessionId: string;
}

export class RevokeAllSessionsDto {
  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: '排除的会话ID（保留当前会话）' })
  @IsOptional()
  @IsString()
  excludeSessionId?: string;
}

export class SessionQueryDto {
  @ApiPropertyOptional({ description: '用户ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '是否只查活跃会话', default: true })
  @IsOptional()
  activeOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
