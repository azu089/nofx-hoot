import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsNumber, IsIn, IsArray, IsUrl, IsDateString } from 'class-validator';

// ==================== 内容管理 ====================

/**
 * 创建内容 DTO
 */
export class CreateContentDto {
  @ApiProperty({ description: '内容键', example: 'landing.hero.title' })
  @IsString()
  contentKey: string;

  @ApiProperty({ description: '内容类型', enum: ['text', 'richtext', 'image', 'json'] })
  @IsIn(['text', 'richtext', 'image', 'json'])
  contentType: string;

  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: '内容' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '语言', default: 'zh-CN' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ description: '是否发布' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: '定时发布时间' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @ApiPropertyOptional({ description: '过期时间' })
  @IsOptional()
  @IsDateString()
  expireAt?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '元数据' })
  @IsOptional()
  metadata?: any;
}

/**
 * 更新内容 DTO
 */
export class UpdateContentDto {
  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '是否发布' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: '定时发布时间' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @ApiPropertyOptional({ description: '过期时间' })
  @IsOptional()
  @IsDateString()
  expireAt?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '元数据' })
  @IsOptional()
  metadata?: any;
}

// ==================== Banner 管理 ====================

/**
 * 创建 Banner DTO
 */
export class CreateBannerDto {
  @ApiProperty({ description: '位置', enum: ['home_hero', 'home_promo', 'login_side', 'dashboard_top'] })
  @IsIn(['home_hero', 'home_promo', 'login_side', 'dashboard_top'])
  position: string;

  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: '副标题' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({ description: '图片 URL' })
  @IsUrl()
  imageUrl: string;

  @ApiPropertyOptional({ description: '链接 URL' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ description: '链接打开方式', enum: ['_self', '_blank'] })
  @IsOptional()
  @IsIn(['_self', '_blank'])
  linkTarget?: string;

  @ApiPropertyOptional({ description: '按钮文字' })
  @IsOptional()
  @IsString()
  buttonText?: string;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

/**
 * 更新 Banner DTO
 */
export class UpdateBannerDto {
  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '副标题' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({ description: '图片 URL' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '链接 URL' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ description: '链接打开方式' })
  @IsOptional()
  @IsIn(['_self', '_blank'])
  linkTarget?: string;

  @ApiPropertyOptional({ description: '按钮文字' })
  @IsOptional()
  @IsString()
  buttonText?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

// ==================== 帮助文档 ====================

/**
 * 创建帮助文档 DTO
 */
export class CreateHelpDocDto {
  @ApiProperty({ description: '分类', enum: ['faq', 'tutorial', 'guide'] })
  @IsIn(['faq', 'tutorial', 'guide'])
  category: string;

  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'URL 友好标识' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ description: '摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ description: '内容（富文本）' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '标签' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '是否发布', default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

/**
 * 更新帮助文档 DTO
 */
export class UpdateHelpDocDto {
  @ApiPropertyOptional({ description: '分类' })
  @IsOptional()
  @IsIn(['faq', 'tutorial', 'guide'])
  category?: string;

  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: '内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '标签' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: '是否发布' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
