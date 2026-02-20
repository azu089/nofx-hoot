import {
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  IsString,
  IsIn,
  Min,
  Max,
  IsObject,
} from 'class-validator';

/**
 * 更新 AI 配置 DTO
 */
export class UpdateAiConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[]; // 监控的交易对

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  timeframes?: string[]; // 分析周期

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  models?: string[]; // 使用的模型列表

  @IsOptional()
  @IsObject()
  rolePrompts?: Record<string, string>; // 自定义角色提示词

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minConfidence?: number; // 最低置信度阈值

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(1440)
  analysisInterval?: number; // 分析间隔（分钟）

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxPositionSize?: number; // 最大仓位比例 (%)

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxLeverage?: number; // 最大杠杆

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxDailyTrades?: number; // 每日最大交易次数

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxDailyDrawdown?: number; // 每日最大回撤 (%)

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  cooldownMinutes?: number; // 冷却时间（分钟）

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  circuitBreaker?: number; // 连续失败次数触发熔断

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(10)
  maxDebateRounds?: number; // AI 辩论最大轮次 (3-10)

  @IsOptional()
  @IsObject()
  roleModels?: Record<string, string>; // Per-role 模型配置: {"bull": "deepseek-chat", "bear": "gpt-4o-mini", ...}

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  monthlyBudget?: number; // 每月 LLM 预算（美元）

  @IsOptional()
  @IsObject()
  apiKeys?: Record<string, string>; // 用户 API Keys: {deepseek: "sk-xxx", openai: "sk-xxx", openrouter: "sk-xxx"}

  @IsOptional()
  @IsString()
  locale?: string;

  // v6 双模式 + 自动运行新增字段

  @IsOptional()
  @IsString()
  @IsIn(['quick', 'expert'])
  mode?: string; // 分析模式: quick(单AI) / expert(多角色辩论)

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  amountPerTrade?: number; // 每笔交易金额 (USDT)

  @IsOptional()
  @IsString()
  exchangeApiKeyId?: string; // 关联的交易所 API Key ID
}
