import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// 分页查询 DTO
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

// 用户列表查询
export class UserListDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string; // active, inactive
}

// 更新用户状态
export class UpdateUserStatusDto {
  @IsEnum(['active', 'inactive', 'banned'])
  status: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

// 策略列表查询
export class StrategyListDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string; // active, inactive
}

// 创建策略
export class CreateStrategyDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  freqtradeId: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;
}

// 更新策略
export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  isActive?: boolean;
}

// 提现审核操作
export class WithdrawActionDto {
  @IsEnum(['approved', 'rejected'])
  action: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  txHash?: string; // 审核通过时的交易哈希
}

// 提现列表查询
export class WithdrawListDto extends PaginationDto {
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected', 'completed'])
  status?: string;
}
