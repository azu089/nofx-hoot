import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Telegram initData 验证 DTO
 * 用于验证 Telegram Mini App 发送的 initData
 */
export class TelegramAuthDto {
  @ApiProperty({ description: 'Telegram WebApp initData 字符串' })
  @IsString()
  @IsNotEmpty()
  initData: string;
}

/**
 * 绑定 Telegram 账户 DTO
 * 将 Telegram 账户绑定到现有用户
 */
export class LinkTelegramDto {
  @ApiProperty({ description: 'Telegram WebApp initData 字符串' })
  @IsString()
  @IsNotEmpty()
  initData: string;
}

/**
 * Telegram 登录响应
 */
export class TelegramAuthResponseDto {
  @ApiProperty({ description: '访问令牌' })
  accessToken: string;

  @ApiProperty({ description: '刷新令牌' })
  refreshToken: string;

  @ApiProperty({ description: '是否新用户' })
  isNewUser: boolean;

  @ApiProperty({ description: '用户 ID' })
  userId: string;

  @ApiPropertyOptional({ description: '用户邮箱（如果有）' })
  email?: string;
}

/**
 * Telegram 用户信息（从 initData 解析）
 */
export class TelegramUserInfo {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * 解析后的 Telegram initData
 */
export class ParsedInitData {
  user: TelegramUserInfo;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_type?: string;
  chat_instance?: string;
}

/**
 * 绑定状态响应
 */
export class TelegramLinkStatusDto {
  @ApiProperty({ description: '是否已绑定 Telegram' })
  isLinked: boolean;

  @ApiPropertyOptional({ description: 'Telegram 用户名' })
  telegramUsername?: string;

  @ApiPropertyOptional({ description: 'Telegram 名字' })
  telegramFirstName?: string;

  @ApiPropertyOptional({ description: '绑定时间' })
  linkedAt?: Date;
}
