import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsEmail,
  IsEthereumAddress,
} from 'class-validator';

// Telegram 绑定 DTO（已登录用户绑定 TG）
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

// Telegram 自动登录 DTO（TG Bot 调用）
export class TelegramLoginDto {
  @IsString()
  telegramId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string; // 深度链接邀请码 (start=ref_XXX)
}

// Telegram WebApp 登录 DTO（Mini App 前端调用）
export class TelegramWebAppLoginDto {
  @IsString()
  initData: string; // TG WebApp initData 原始字符串
}

// 生成绑定码响应
export class BindCodeResponse {
  bindCode: string;
  expiresAt: Date;
}

// ===== 钱包登录 DTO =====

// 获取 Nonce
export class GetWalletNonceDto {
  @IsEthereumAddress({ message: '钱包地址格式不正确' })
  address: string;
}

// 钱包登录
export class WalletLoginDto {
  @IsEthereumAddress({ message: '钱包地址格式不正确' })
  address: string;

  @IsString()
  signature: string;

  @IsString()
  message: string; // 包含 nonce 的签名消息
}

// ===== 绑定 DTO =====

// 绑定邮箱
export class BindEmailDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString()
  @MinLength(6, { message: '密码至少6位' })
  @MaxLength(32, { message: '密码最多32位' })
  password: string;
}

// 绑定钱包
export class BindWalletDto {
  @IsEthereumAddress({ message: '钱包地址格式不正确' })
  address: string;

  @IsString()
  signature: string;

  @IsString()
  message: string;
}
