import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

/**
 * 创建 Droplet 请求 DTO
 */
export class CreateDropletDto {
  @IsString()
  @IsNotEmpty()
  name: string; // Droplet 名称

  @IsString()
  @IsOptional()
  region?: string; // 区域，默认使用配置文件

  @IsString()
  @IsOptional()
  size?: string; // 规格，默认使用配置文件

  @IsString()
  @IsOptional()
  image?: string; // 镜像，默认使用配置文件

  @IsString({ each: true })
  @IsOptional()
  tags?: string[]; // 标签
}

/**
 * Droplet 响应 DTO
 */
export interface DropletResponse {
  id: string; // Droplet ID
  name: string; // 名称
  status: string; // 状态: new, active, off, archive
  ip: string; // 公网 IP
  region: string; // 区域
  size: string; // 规格
  image: string; // 镜像
  createdAt: string; // 创建时间
  tags: string[]; // 标签
}

/**
 * Droplet 列表响应 DTO
 */
export interface DropletListResponse {
  droplets: DropletResponse[];
  total: number;
}
