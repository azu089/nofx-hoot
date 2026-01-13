import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBrandConfigDto {
  @ApiProperty({ description: '配置键' })
  @IsString()
  configKey: string;

  @ApiProperty({ description: '配置值' })
  @IsString()
  configValue: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class BrandConfigBatchDto {
  @ApiProperty({ description: '配置列表', type: [UpdateBrandConfigDto] })
  configs: UpdateBrandConfigDto[];
}

// 默认品牌配置键
export const BRAND_CONFIG_KEYS = {
  APP_NAME: 'app_name',
  APP_SLOGAN: 'app_slogan',
  LOGO_URL: 'logo_url',
  LOGO_DARK_URL: 'logo_dark_url',
  FAVICON_URL: 'favicon_url',
  PRIMARY_COLOR: 'primary_color',
  SECONDARY_COLOR: 'secondary_color',
  FOOTER_TEXT: 'footer_text',
  CONTACT_EMAIL: 'contact_email',
  TELEGRAM_URL: 'telegram_url',
  TWITTER_URL: 'twitter_url',
  DISCORD_URL: 'discord_url',
} as const;
