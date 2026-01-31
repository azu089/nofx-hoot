import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsIn,
  IsArray,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 订阅配置 DTO
 * 分为普通配置和高级配置两部分
 */

// ========== 普通配置（用户必填/常用） ==========

export class BasicSubscriptionConfigDto {
  @IsString()
  apiKeyId: string;

  @IsNumber()
  @Min(5) // 最小 5 USDT
  @Max(100000) // 最大 10 万 USDT
  amountPerTrade: number;

  @IsIn(['spot', 'futures'])
  @IsOptional()
  tradingType?: 'spot' | 'futures' = 'spot';

  @IsIn(['long', 'short', 'both'])
  @IsOptional()
  direction?: 'long' | 'short' | 'both' = 'both';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tradingPairs?: string[] = []; // 空数组表示跟随策略

  @IsBoolean()
  @IsOptional()
  autoClose?: boolean = true; // 收到卖出信号自动平仓

  @IsNumber()
  @Min(0.1)
  @Max(50)
  @IsOptional()
  stopLossPercent?: number; // 止损百分比

  @IsNumber()
  @Min(0.1)
  @Max(500)
  @IsOptional()
  takeProfitPercent?: number; // 止盈百分比
}

// ========== 高级配置（可选/专业用户） ==========

export class AdvancedSubscriptionConfigDto {
  // === 合约配置 ===
  @IsNumber()
  @Min(1)
  @Max(125) // 平台最大杠杆，实际会受管理后台限制
  @IsOptional()
  leverage?: number = 1;

  @IsIn(['cross', 'isolated'])
  @IsOptional()
  marginMode?: 'cross' | 'isolated' = 'cross';

  // === 风控配置 ===
  @IsNumber()
  @Min(0.1)
  @Max(5)
  @IsOptional()
  slippageTolerance?: number = 0.5; // 滑点容忍度(%)

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxPositions?: number = 3; // 最大持仓数

  // === 移动止损配置 ===
  @IsBoolean()
  @IsOptional()
  trailingStopEnabled?: boolean = false;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  trailingStopActivation?: number; // 激活盈利(%)

  @IsNumber()
  @Min(0.5)
  @Max(50)
  @IsOptional()
  trailingStopCallback?: number; // 回撤比例(%)

  // === DCA 补仓配置 ===
  @IsBoolean()
  @IsOptional()
  dcaEnabled?: boolean = false;

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  dcaMaxCount?: number = 3; // 最大补仓次数

  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  dcaTrigger?: number = 5; // 触发跌幅(%)

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  dcaMultiplier?: number = 1.5; // 补仓倍率

  // === 防瀑布保护 ===
  @IsBoolean()
  @IsOptional()
  waterfallProtection?: boolean = true;

  @IsNumber()
  @Min(5)
  @Max(50)
  @IsOptional()
  waterfallTriggerPercent?: number = 15; // 触发跌幅(%)

  // === 黑天鹅保护 ===
  @IsBoolean()
  @IsOptional()
  blackSwanProtection?: boolean = false;

  @IsIn(['account_loss', 'coin_drop'])
  @IsOptional()
  blackSwanType?: 'account_loss' | 'coin_drop' = 'account_loss';

  @IsNumber()
  @Min(5)
  @Max(50)
  @IsOptional()
  blackSwanTrigger?: number = 10; // 触发阈值(%)

  @IsIn(['close_all', 'close_half', 'pause'])
  @IsOptional()
  blackSwanAction?: 'close_all' | 'close_half' | 'pause' = 'close_all';

  // === 单日亏损限制 ===
  @IsBoolean()
  @IsOptional()
  dailyMaxLossEnabled?: boolean = false;

  @IsNumber()
  @Min(5)
  @Max(100)
  @IsOptional()
  dailyMaxLossPercent?: number = 20; // 单日最大亏损(%)

  // === 执行配置 ===
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  maxRetries?: number = 3;

  @IsNumber()
  @Min(500)
  @Max(5000)
  @IsOptional()
  retryDelayMs?: number = 1000;
}

// ========== 完整订阅配置 ==========

export class CreateSubscriptionDto {
  @ValidateNested()
  @Type(() => BasicSubscriptionConfigDto)
  basic: BasicSubscriptionConfigDto;

  @ValidateNested()
  @Type(() => AdvancedSubscriptionConfigDto)
  @IsOptional()
  advanced?: AdvancedSubscriptionConfigDto;
}

export class UpdateSubscriptionDto {
  @ValidateNested()
  @Type(() => BasicSubscriptionConfigDto)
  @IsOptional()
  basic?: Partial<BasicSubscriptionConfigDto>;

  @ValidateNested()
  @Type(() => AdvancedSubscriptionConfigDto)
  @IsOptional()
  advanced?: Partial<AdvancedSubscriptionConfigDto>;
}

// ========== 用户通知配置 ==========

export class NotificationConfigDto {
  @IsBoolean()
  @IsOptional()
  signalReceived?: boolean = true;

  @IsBoolean()
  @IsOptional()
  orderExecuted?: boolean = true;

  @IsBoolean()
  @IsOptional()
  orderFailed?: boolean = true;

  @IsBoolean()
  @IsOptional()
  positionOpened?: boolean = true;

  @IsBoolean()
  @IsOptional()
  positionClosed?: boolean = true;

  @IsBoolean()
  @IsOptional()
  stopLossTriggered?: boolean = true;

  @IsBoolean()
  @IsOptional()
  dailySummary?: boolean = false;

  // 通知渠道
  @IsBoolean()
  @IsOptional()
  telegramEnabled?: boolean = true;

  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean = false;
}

// ========== 响应 DTO ==========

export class SubscriptionConfigResponse {
  id: string;
  strategyId: string;
  strategyName: string;
  isActive: boolean;

  // 普通配置
  basic: {
    apiKeyId: string;
    apiKeyLabel: string;
    amountPerTrade: string;
    tradingType: string;
    direction: string;
    tradingPairs: string[];
    autoClose: boolean;
    stopLossPercent?: string;
    takeProfitPercent?: string;
  };

  // 高级配置
  advanced: {
    leverage: number;
    marginMode: string;
    slippageTolerance: string;
    maxPositions: number;
    // 移动止损
    trailingStopEnabled: boolean;
    trailingStopActivation?: string;
    trailingStopCallback?: string;
    // DCA
    dcaEnabled: boolean;
    dcaMaxCount: number;
    dcaTrigger: string;
    dcaMultiplier: string;
    // 防瀑布
    waterfallProtection: boolean;
    waterfallTriggerPercent: string;
    // 黑天鹅
    blackSwanProtection: boolean;
    blackSwanType: string;
    blackSwanTrigger: string;
    blackSwanAction: string;
    // 单日亏损
    dailyMaxLossEnabled: boolean;
    dailyMaxLossPercent: string;
    // 执行配置
    maxRetries: number;
    retryDelayMs: number;
  };

  // 平台限制（只读，来自管理后台）
  platformLimits: {
    maxLeverage: number;
    maxAmountPerTrade: number;
    minAmountPerTrade: number;
    maxPositions: number;
  };

  createdAt: Date;
}
