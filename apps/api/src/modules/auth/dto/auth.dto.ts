import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

// 注册 DTO
export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString()
  @MinLength(6, { message: '密码至少6位' })
  @MaxLength(32, { message: '密码最多32位' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string;
}

// 登录 DTO
export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString()
  @MinLength(6, { message: '密码至少6位' })
  password: string;
}

// 登录响应
export class LoginResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  user: {
    id: string;
    email?: string | null;
    nickname?: string | null;
    walletAddress?: string | null;
    telegramId?: string | null;
    usdtBalance?: string;
    hootBalance?: string;
    pointBalance?: string;
  };
  isNewUser?: boolean; // 新注册用户标识
}

// Refresh Token 请求 DTO
export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

// 带 Refresh Token 的 Token 对响应
export class TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token 过期时间（秒）
  user?: {
    id: string;
    email?: string | null;
    nickname?: string | null;
    walletAddress?: string | null;
    telegramId?: string | null;
    usdtBalance?: string;
    hootBalance?: string;
    pointBalance?: string;
  };
  isNewUser?: boolean;
}

// 用户信息响应
export class UserResponse {
  id: string;
  email?: string | null;
  nickname?: string | null;
  createdAt?: Date;
  // 会员信息
  membershipStatus?: string;
  membershipExpireAt?: Date | null;
  subscriptionTier?: string; // basic, premium, pro
  vipLevel?: number;
  // 绑定状态
  telegramId?: string | null;
  telegramUsername?: string | null;
  walletAddress?: string | null;
  emailVerified?: boolean;
}
