import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['all', 'active', 'banned'])
  status?: 'all' | 'active' | 'banned' = 'all';
}

export class AdminUserResponseDto {
  id: string;
  email: string;
  vipLevel: number;
  balance: string;
  status: string;
  instanceCount: number;
  totalTrades: number;
  createdAt: string;
  lastLogin: string;
}

export class AdminUsersListResponseDto {
  data: AdminUserResponseDto[];
  total: number;
  page: number;
  totalPages: number;
}

export class BanUserDto {
  @IsString()
  reason?: string;
}

export class ResetPasswordResponseDto {
  success: boolean;
  tempPassword: string;
}
