import { IsString, IsOptional, IsBoolean, IsDateString, IsIn, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePopupDto {
  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '内容' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ['info', 'warning', 'success', 'promotion'], default: 'info' })
  @IsOptional()
  @IsIn(['info', 'warning', 'success', 'promotion'])
  type?: string;

  @ApiPropertyOptional({ description: '图片URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '操作按钮文字' })
  @IsOptional()
  @IsString()
  actionLabel?: string;

  @ApiPropertyOptional({ description: '操作按钮链接' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ enum: ['all', 'new_users', 'vip', 'specific'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'new_users', 'vip', 'specific'])
  targetAudience?: string;

  @ApiPropertyOptional({ description: '优先级', default: 0 })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ description: '仅显示一次', default: false })
  @IsOptional()
  @IsBoolean()
  showOnce?: boolean;
}

export class UpdatePopupDto {
  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: ['info', 'warning', 'success', 'promotion'] })
  @IsOptional()
  @IsIn(['info', 'warning', 'success', 'promotion'])
  type?: string;

  @ApiPropertyOptional({ description: '图片URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '操作按钮文字' })
  @IsOptional()
  @IsString()
  actionLabel?: string;

  @ApiPropertyOptional({ description: '操作按钮链接' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ enum: ['all', 'new_users', 'vip', 'specific'] })
  @IsOptional()
  @IsIn(['all', 'new_users', 'vip', 'specific'])
  targetAudience?: string;

  @ApiPropertyOptional({ description: '优先级' })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '仅显示一次' })
  @IsOptional()
  @IsBoolean()
  showOnce?: boolean;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class PopupQueryDto {
  @ApiPropertyOptional({ description: '是否只查启用的' })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
