import { IsString, IsOptional, MaxLength } from 'class-validator';

// Telegram 绑定 DTO
export class BindTelegramDto {
  @IsString()
  telegramId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  telegramUsername?: string;

  @IsString()
  bindCode: string; // 网站生成的绑定码
}

// 生成绑定码响应
export class BindCodeResponse {
  bindCode: string;
  expiresAt: Date;
}
