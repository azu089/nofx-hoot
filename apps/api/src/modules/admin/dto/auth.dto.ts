/**
 * 管理员认证 DTO
 */
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

// 登录请求
export class AdminLoginDto {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少6位' })
  password: string;
}

// 登录响应
export class AdminLoginResponseDto {
  token: string;
  admin: {
    id: string;
    username: string;
    nickname: string;
    role: string;
  };
}

// 修改密码
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: '新密码至少6位' })
  newPassword: string;
}

// 创建管理员
export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  nickname?: string;

  @IsString()
  email?: string;

  @IsString()
  role?: string;
}
