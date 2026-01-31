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
  user: {
    id: string;
    email?: string | null;
    nickname?: string | null;
    walletAddress?: string | null;
    telegramId?: string | null;
  };
  isNewUser?: boolean; // 新注册用户标识
}

// 用户信息响应
export class UserResponse {
  id: string;
  email?: string | null;
  nickname?: string | null;
  createdAt?: Date;
}
