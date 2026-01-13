import { IsString, IsOptional, IsBoolean, IsDateString, IsNumber, IsArray, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ==================== Banner 管理 ====================

export class CreateBannerDto {
  @ApiProperty({ enum: ['home_hero', 'home_promo', 'login_side', 'dashboard_top'] })
  @IsString()
  @IsIn(['home_hero', 'home_promo', 'login_side', 'dashboard_top'])
  position: string;

  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: '副标题' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({ description: '图片URL' })
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({ description: '链接URL' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ enum: ['_self', '_blank'], default: '_self' })
  @IsOptional()
  @IsIn(['_self', '_blank'])
  linkTarget?: string;

  @ApiPropertyOptional({ description: '按钮文字' })
  @IsOptional()
  @IsString()
  buttonText?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class UpdateBannerDto {
  @ApiPropertyOptional({ enum: ['home_hero', 'home_promo', 'login_side', 'dashboard_top'] })
  @IsOptional()
  @IsIn(['home_hero', 'home_promo', 'login_side', 'dashboard_top'])
  position?: string;

  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '副标题' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({ description: '图片URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '链接URL' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ enum: ['_self', '_blank'] })
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

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

// ==================== 帮助文档管理 ====================

export class CreateHelpDocDto {
  @ApiProperty({ enum: ['faq', 'tutorial', 'guide'] })
  @IsString()
  @IsIn(['faq', 'tutorial', 'guide'])
  category: string;

  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'URL 友好的标识' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ description: '摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ description: '内容（支持 Markdown）' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '标签列表' })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否发布', default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateHelpDocDto {
  @ApiPropertyOptional({ enum: ['faq', 'tutorial', 'guide'] })
  @IsOptional()
  @IsIn(['faq', 'tutorial', 'guide'])
  category?: string;

  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'URL 友好的标识' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: '摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: '内容（支持 Markdown）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '标签列表' })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否发布' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// ==================== 内容管理 ====================

export class CreateContentDto {
  @ApiProperty({ description: '内容键（唯一标识）' })
  @IsString()
  contentKey: string;

  @ApiProperty({ enum: ['text', 'richtext', 'image', 'json'] })
  @IsString()
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

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '元数据' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateContentDto {
  @ApiPropertyOptional({ enum: ['text', 'richtext', 'image', 'json'] })
  @IsOptional()
  @IsIn(['text', 'richtext', 'image', 'json'])
  contentType?: string;

  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '语言' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ description: '是否发布' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '元数据' })
  @IsOptional()
  metadata?: Record<string, any>;
}
