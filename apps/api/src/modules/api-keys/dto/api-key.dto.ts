import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';

// 支持的交易所
export const SUPPORTED_EXCHANGES = ['binance', 'okx', 'bybit'] as const;
export type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

// 创建 API Key DTO
export class CreateApiKeyDto {
  @IsIn(SUPPORTED_EXCHANGES, { message: '不支持的交易所' })
  exchange: SupportedExchange;

  @IsString()
  @IsNotEmpty({ message: '标签不能为空' })
  @MaxLength(32)
  label: string;

  @IsString()
  @IsNotEmpty({ message: 'API Key 不能为空' })
  apiKey: string;

  @IsString()
  @IsNotEmpty({ message: 'API Secret 不能为空' })
  apiSecret: string;
}

// API Key 响应（脱敏）
export class ApiKeyResponse {
  id: string;
  exchange: string;
  label: string;
  maskedKey: string; // 脱敏后的 Key
  isActive: boolean;
  createdAt: Date;
}

// API Key 列表响应
export class ApiKeyListResponse {
  items: ApiKeyResponse[];
  total: number;
}
