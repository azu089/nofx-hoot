import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsJSON } from 'class-validator';

/**
 * 创建策略 DTO
 */
export class CreateStrategyDto {
  @IsString()
  @IsNotEmpty({ message: '策略名称不能为空' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty({ message: '策略内容不能为空' })
  content: string;

  @IsOptional()
  @IsJSON({ message: 'config 必须是有效的 JSON' })
  config?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * 更新策略 DTO
 */
export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsJSON({ message: 'config 必须是有效的 JSON' })
  config?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
