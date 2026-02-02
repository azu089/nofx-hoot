/**
 * 管理员认证 DTO（增强版）
 * 支持两步验证、敏感操作确认
 */
import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  Length,
} from 'class-validator';

// 登录请求
export class AdminLoginDto {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少6位' })
  password: string;

  @IsString()
  @IsOptional()
  @Length(6, 6, { message: '验证码必须是6位数字' })
  totpCode?: string; // 两步验证码（可选）
}

// 登录响应
export class AdminLoginResponseDto {
  token?: string;
  requireTotp?: boolean; // 是否需要两步验证
  message?: string;
  admin?: {
    id: string;
    username: string;
    nickname: string;
    role: string;
    totpEnabled: boolean;
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

  @IsString()
  @IsOptional()
  @Length(6, 6, { message: '验证码必须是6位数字' })
  totpCode?: string; // 如果启用了两步验证
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
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  role?: string;
}

// ==================== TOTP 相关 ====================

// 启用 TOTP
export class EnableTotpDto {
  @IsString()
  @IsNotEmpty({ message: '请输入验证码' })
  @Length(6, 6, { message: '验证码必须是6位数字' })
  totpCode: string;
}

// 禁用 TOTP
export class DisableTotpDto {
  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: '请输入验证码' })
  @Length(6, 6, { message: '验证码必须是6位数字' })
  totpCode: string;
}

// 验证 TOTP（用于敏感操作）
export class VerifyTotpDto {
  @IsString()
  @IsNotEmpty({ message: '请输入验证码' })
  @Length(6, 6, { message: '验证码必须是6位数字' })
  totpCode: string;
}

// ==================== 敏感操作确认 ====================

// 敏感操作基础 DTO（需要 TOTP 确认）
export class SensitiveOperationDto {
  @IsString()
  @IsOptional()
  @Length(6, 6, { message: '验证码必须是6位数字' })
  totpCode?: string; // 如果启用了两步验证，必填
}

// 审批提现（敏感操作）
export class ApproveWithdrawDto extends SensitiveOperationDto {
  @IsString()
  @IsOptional()
  remark?: string; // 审批备注
}

// 拒绝提现（敏感操作）
export class RejectWithdrawDto extends SensitiveOperationDto {
  @IsString()
  @IsNotEmpty({ message: '请填写拒绝原因' })
  reason: string; // 拒绝原因
}

// 修改用户余额（敏感操作）
export class AdjustBalanceDto extends SensitiveOperationDto {
  @IsString()
  @IsNotEmpty()
  amount: string; // 调整金额（正数增加，负数减少）

  @IsString()
  @IsNotEmpty({ message: '请填写调整原因' })
  reason: string;
}
