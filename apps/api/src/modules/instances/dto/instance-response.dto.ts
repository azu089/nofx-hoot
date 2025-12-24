import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * VPS 实例响应 DTO
 */
export class InstanceResponseDto {
  id: string;
  userId: string;

  // DigitalOcean 信息
  dropletId: string | null;
  region: string;
  size: string;

  // 网络信息
  ipAddress: string | null;

  // 状态
  status: string;
  lastHeartbeat: Date | null;

  // 资源监控
  cpuUsage: number | null;
  memoryUsage: number | null;

  // 时间
  provisionedAt: Date | null;
  destroyedAt: Date | null;
  destroyReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建实例请求 DTO
 */
export class CreateInstanceDto {
  @ApiPropertyOptional({ description: '区域', default: 'sgp1' })
  @IsOptional()
  @IsString()
  region?: string; // 默认 sgp1

  @ApiPropertyOptional({ description: '规格', default: 's-1vcpu-1gb' })
  @IsOptional()
  @IsString()
  size?: string;   // 默认 s-1vcpu-1gb
}

/**
 * 心跳上报 DTO
 */
export class HeartbeatDto {
  @ApiPropertyOptional({ description: 'CPU 使用率 (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuUsage?: number;

  @ApiPropertyOptional({ description: '内存使用率 (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  memoryUsage?: number;
}
