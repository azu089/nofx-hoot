import { IsString, IsNotEmpty, IsIn, MaxLength, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

// ========================= 支持的交易所 =========================

// CEX 交易所
export const SUPPORTED_CEX_EXCHANGES = [
  'binance',
  'okx',
  'bybit',
  'gate',
  'bitget',
  'coinbase',
] as const;

// DEX 交易所
export const SUPPORTED_DEX_EXCHANGES = [
  'hyperliquid',
  'lighter',
  'aster',
] as const;

// 全部交易所
export const SUPPORTED_EXCHANGES = [
  ...SUPPORTED_CEX_EXCHANGES,
  ...SUPPORTED_DEX_EXCHANGES,
] as const;

export type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

// ========================= CEX: API Key DTO =========================

// 创建 CEX API Key DTO（保持向后兼容）
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

  @IsOptional()
  @IsString()
  passphrase?: string; // OKX 交易密码（passphrase），其他交易所忽略
}

// ========================= DEX: 钱包凭证 DTO =========================

// 创建 DEX 凭证 DTO（通用字段 + 交易所专属字段）
export class CreateDexCredentialDto {
  @IsIn(SUPPORTED_DEX_EXCHANGES, { message: '不支持的 DEX 交易所' })
  exchange: 'hyperliquid' | 'lighter' | 'aster';

  @IsString()
  @IsNotEmpty({ message: '标签不能为空' })
  @MaxLength(32)
  label: string;

  // === Hyperliquid ===
  @IsOptional()
  @IsString()
  walletAddress?: string; // 主钱包地址

  @IsOptional()
  @IsString()
  privateKey?: string; // Agent 私钥 (Hyperliquid) / 钱包私钥 (Lighter) / 签名私钥 (Aster)

  // === Lighter 专属 ===
  @IsOptional()
  @IsString()
  lighterApiKeyPrivateKey?: string; // Lighter API Key 私钥 (40字节)

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  lighterApiKeyIndex?: number; // API Key 索引

  // === Aster 专属 ===
  @IsOptional()
  @IsString()
  asterUserAddress?: string; // 主钱包地址

  @IsOptional()
  @IsString()
  asterSignerAddress?: string; // 签名钱包地址

  // === 通用 ===
  @IsOptional()
  @IsBoolean()
  isTestnet?: boolean;
}

// ========================= 响应 DTO =========================

// API Key / DEX 凭证响应（脱敏）
export class ApiKeyResponse {
  id: string;
  exchange: string;
  label: string;
  maskedKey: string; // CEX: 脱敏后的 Key / DEX: 脱敏后的钱包地址
  isActive: boolean;
  createdAt: Date;
  authType?: string; // "api_key" | "wallet"
  isTestnet?: boolean;
  walletAddress?: string; // DEX: 公开钱包地址（不脱敏）
}

// API Key 列表响应
export class ApiKeyListResponse {
  items: ApiKeyResponse[];
  total: number;
}

// ========================= 更新 DTO =========================

// 更新 API Key DTO
export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  label?: string;

  @IsOptional()
  @IsString()
  apiKey?: string; // 可选，留空不更新

  @IsOptional()
  @IsString()
  apiSecret?: string; // 可选，留空不更新

  @IsOptional()
  @IsString()
  passphrase?: string; // OKX 交易密码（可选，留空不更新）
}
