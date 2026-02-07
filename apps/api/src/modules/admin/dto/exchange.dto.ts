import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
} from 'class-validator';

// 创建交易所
export class CreateExchangeDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  logo: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsString()
  affiliateUrl?: string;

  @IsOptional()
  @IsString()
  status?: string; // supported | coming_soon

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// 更新交易所（全部可选）
export class UpdateExchangeDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsString()
  affiliateUrl?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
