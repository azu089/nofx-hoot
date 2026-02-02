import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PlatformConfig,
  UserRiskConfig,
  UserFundConfig,
  UserNotificationConfig,
  UserTradingHoursConfig,
  SubscriptionConfig,
  DEFAULT_PLATFORM_CONFIG,
  DEFAULT_USER_RISK_CONFIG,
  DEFAULT_USER_FUND_CONFIG,
  DEFAULT_EXECUTION_CONFIG,
  DEFAULT_POSITION_CONFIG,
  DEFAULT_RISK_MANAGEMENT_CONFIG,
  DEFAULT_SIGNAL_HANDLING_CONFIG,
} from './trading-config.types';

/**
 * 配置管理服务
 * 负责加载、缓存、验证所有层级的配置
 */
@Injectable()
export class TradingConfigService implements OnModuleInit {
  private readonly logger = new Logger(TradingConfigService.name);

  // 平台配置缓存
  private platformConfigCache: PlatformConfig | null = null;
  private platformConfigCacheTime: number = 0;
  private readonly PLATFORM_CACHE_TTL = 60 * 1000; // 1 分钟

  // 用户配置缓存
  private userConfigCache: Map<
    string,
    {
      config: UserFullConfig;
      timestamp: number;
    }
  > = new Map();
  private readonly USER_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // 启动时初始化平台配置
    await this.initializePlatformConfig();
  }

  // ========== 平台配置 ==========

  /**
   * 初始化平台配置（如果不存在则创建默认配置）
   */
  private async initializePlatformConfig(): Promise<void> {
    const existing = await this.prisma.platformConfig.findUnique({
      where: { key: 'main' },
    });

    if (!existing) {
      await this.prisma.platformConfig.create({
        data: {
          key: 'main',
          value: JSON.stringify(DEFAULT_PLATFORM_CONFIG),
          description: '平台主配置',
        },
      });
      this.logger.log('已初始化平台默认配置');
    }
  }

  /**
   * 获取平台配置
   */
  async getPlatformConfig(): Promise<PlatformConfig> {
    const now = Date.now();

    // 检查缓存
    if (
      this.platformConfigCache &&
      now - this.platformConfigCacheTime < this.PLATFORM_CACHE_TTL
    ) {
      return this.platformConfigCache;
    }

    // 从数据库加载
    const record = await this.prisma.platformConfig.findUnique({
      where: { key: 'main' },
    });

    if (!record) {
      this.platformConfigCache = DEFAULT_PLATFORM_CONFIG;
    } else {
      try {
        this.platformConfigCache = {
          ...DEFAULT_PLATFORM_CONFIG,
          ...JSON.parse(record.value),
        };
      } catch (e) {
        this.logger.error('解析平台配置失败，使用默认配置');
        this.platformConfigCache = DEFAULT_PLATFORM_CONFIG;
      }
    }

    this.platformConfigCacheTime = now;
    return this.platformConfigCache!;
  }

  /**
   * 更新平台配置
   */
  async updatePlatformConfig(
    updates: Partial<PlatformConfig>,
    updatedBy?: string,
  ): Promise<PlatformConfig> {
    const current = await this.getPlatformConfig();
    const newConfig = { ...current, ...updates };

    await this.prisma.platformConfig.upsert({
      where: { key: 'main' },
      update: {
        value: JSON.stringify(newConfig),
        updatedBy,
      },
      create: {
        key: 'main',
        value: JSON.stringify(newConfig),
        updatedBy,
      },
    });

    // 清除缓存
    this.platformConfigCache = null;
    this.logger.log('平台配置已更新');

    return newConfig;
  }

  // ========== 用户配置 ==========

  /**
   * 获取用户完整配置
   */
  async getUserConfig(userId: string): Promise<UserFullConfig> {
    const now = Date.now();

    // 检查缓存
    const cached = this.userConfigCache.get(userId);
    if (cached && now - cached.timestamp < this.USER_CACHE_TTL) {
      return cached.config;
    }

    // 从数据库加载
    let record = await this.prisma.userTradingConfig.findUnique({
      where: { userId },
    });

    // 如果不存在，创建默认配置
    if (!record) {
      record = await this.prisma.userTradingConfig.create({
        data: {
          userId,
          riskConfig: JSON.stringify(DEFAULT_USER_RISK_CONFIG),
          fundConfig: JSON.stringify(DEFAULT_USER_FUND_CONFIG),
          notificationConfig: JSON.stringify({}),
          tradingHoursConfig: JSON.stringify({}),
        },
      });
    }

    const config: UserFullConfig = {
      tradingEnabled: record.tradingEnabled,
      newOrdersEnabled: record.newOrdersEnabled,
      risk: this.parseJsonConfig(record.riskConfig, DEFAULT_USER_RISK_CONFIG),
      fund: this.parseJsonConfig(record.fundConfig, DEFAULT_USER_FUND_CONFIG),
      notification: this.parseJsonConfig(record.notificationConfig, {}),
      tradingHours: this.parseJsonConfig(record.tradingHoursConfig, {}),
    };

    // 缓存
    this.userConfigCache.set(userId, { config, timestamp: now });

    return config;
  }

  /**
   * 更新用户风控配置
   */
  async updateUserRiskConfig(
    userId: string,
    updates: Partial<UserRiskConfig>,
  ): Promise<UserRiskConfig> {
    const current = await this.getUserConfig(userId);
    const newRiskConfig = { ...current.risk, ...updates };

    await this.prisma.userTradingConfig.upsert({
      where: { userId },
      update: {
        riskConfig: JSON.stringify(newRiskConfig),
      },
      create: {
        userId,
        riskConfig: JSON.stringify(newRiskConfig),
        fundConfig: JSON.stringify(DEFAULT_USER_FUND_CONFIG),
      },
    });

    // 清除缓存
    this.userConfigCache.delete(userId);

    return newRiskConfig;
  }

  /**
   * 更新用户资金配置
   */
  async updateUserFundConfig(
    userId: string,
    updates: Partial<UserFundConfig>,
  ): Promise<UserFundConfig> {
    const current = await this.getUserConfig(userId);
    const newFundConfig = { ...current.fund, ...updates };

    await this.prisma.userTradingConfig.upsert({
      where: { userId },
      update: {
        fundConfig: JSON.stringify(newFundConfig),
      },
      create: {
        userId,
        fundConfig: JSON.stringify(newFundConfig),
        riskConfig: JSON.stringify(DEFAULT_USER_RISK_CONFIG),
      },
    });

    this.userConfigCache.delete(userId);

    return newFundConfig;
  }

  /**
   * 切换用户交易开关
   */
  async toggleUserTrading(userId: string, enabled: boolean): Promise<void> {
    await this.prisma.userTradingConfig.upsert({
      where: { userId },
      update: { tradingEnabled: enabled },
      create: {
        userId,
        tradingEnabled: enabled,
        riskConfig: JSON.stringify(DEFAULT_USER_RISK_CONFIG),
        fundConfig: JSON.stringify(DEFAULT_USER_FUND_CONFIG),
      },
    });

    this.userConfigCache.delete(userId);
    this.logger.log(`用户 ${userId} 交易已${enabled ? '启用' : '禁用'}`);
  }

  // ========== 订阅配置 ==========

  /**
   * 获取订阅的完整执行配置
   * 合并平台配置 -> 用户配置 -> 订阅配置
   */
  async getSubscriptionExecutionConfig(
    subscriptionId: string,
  ): Promise<MergedExecutionConfig> {
    const subscription = await this.prisma.strategySubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('订阅不存在');
    }

    const [platformConfig, userConfig] = await Promise.all([
      this.getPlatformConfig(),
      this.getUserConfig(subscription.userId),
    ]);

    // 合并配置
    return this.mergeExecutionConfig(platformConfig, userConfig, subscription);
  }

  /**
   * 合并执行配置
   */
  private mergeExecutionConfig(
    platform: PlatformConfig,
    user: UserFullConfig,
    subscription: any,
  ): MergedExecutionConfig {
    return {
      // 平台级限制
      platform: {
        tradingEnabled: platform.tradingEnabled,
        newOrdersEnabled: platform.newOrdersEnabled,
        maxOrderAmountUsdt: platform.maxOrderAmountUsdt,
        minOrderAmountUsdt: platform.minOrderAmountUsdt,
        allowedSymbols: platform.allowedSymbols,
        blockedSymbols: platform.blockedSymbols,
      },

      // 用户级限制
      user: {
        tradingEnabled: user.tradingEnabled,
        newOrdersEnabled: user.newOrdersEnabled,
        maxSingleOrderUsdt: user.risk.maxSingleOrderUsdt,
        maxOpenPositions: user.risk.maxOpenPositions,
        maxDailyTrades: user.risk.maxDailyTrades,
        maxDailyLossUsdt: user.risk.maxDailyLossUsdt,
        maxLeverage: user.risk.maxLeverage,
      },

      // 订阅级配置
      subscription: {
        apiKeyId: subscription.apiKeyId,
        tradingType: subscription.tradingType || 'spot',
        leverage: subscription.leverage || 1,
        marginMode: subscription.marginMode || 'cross',
        amountPerTrade: parseFloat(subscription.amountPerTrade.toString()),
        maxPositions: subscription.maxPositions || 3,
        slippageTolerance: parseFloat(
          (subscription.slippageTolerance || 0.5).toString(),
        ),
        autoClose: subscription.autoClose !== false,
        maxRetries: subscription.maxRetries || 3,
        retryDelayMs: subscription.retryDelayMs || 1000,
      },

      // 执行配置
      execution: DEFAULT_EXECUTION_CONFIG,

      // 仓位配置
      position: {
        ...DEFAULT_POSITION_CONFIG,
        entry: {
          ...DEFAULT_POSITION_CONFIG.entry,
          fixedAmountUsdt: parseFloat(subscription.amountPerTrade.toString()),
        },
        exit: {
          ...DEFAULT_POSITION_CONFIG.exit,
          autoCloseOnSignal: subscription.autoClose !== false,
        },
        maxPositions: subscription.maxPositions || 3,
      },

      // 风控配置
      riskManagement: {
        ...DEFAULT_RISK_MANAGEMENT_CONFIG,
        stopLoss: {
          ...DEFAULT_RISK_MANAGEMENT_CONFIG.stopLoss,
          enabled: !!subscription.stopLossPercent,
          fixedPercent: subscription.stopLossPercent
            ? parseFloat(subscription.stopLossPercent.toString())
            : undefined,
        },
        takeProfit: {
          ...DEFAULT_RISK_MANAGEMENT_CONFIG.takeProfit,
          enabled: !!subscription.takeProfitPercent,
          fixedPercent: subscription.takeProfitPercent
            ? parseFloat(subscription.takeProfitPercent.toString())
            : undefined,
        },
      },

      // 信号处理配置
      signalHandling: DEFAULT_SIGNAL_HANDLING_CONFIG,
    };
  }

  // ========== 工具方法 ==========

  private parseJsonConfig<T>(json: string, defaultValue: T): T {
    try {
      return { ...defaultValue, ...JSON.parse(json) };
    } catch {
      return defaultValue;
    }
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.platformConfigCache = null;
    this.userConfigCache.clear();
    this.logger.log('所有配置缓存已清除');
  }

  /**
   * 清除用户缓存
   */
  clearUserCache(userId: string): void {
    this.userConfigCache.delete(userId);
  }
}

// ========== 辅助类型 ==========

export interface UserFullConfig {
  tradingEnabled: boolean;
  newOrdersEnabled: boolean;
  risk: UserRiskConfig;
  fund: UserFundConfig;
  notification: Partial<UserNotificationConfig>;
  tradingHours: Partial<UserTradingHoursConfig>;
}

export interface MergedExecutionConfig {
  platform: {
    tradingEnabled: boolean;
    newOrdersEnabled: boolean;
    maxOrderAmountUsdt: number;
    minOrderAmountUsdt: number;
    allowedSymbols: string[];
    blockedSymbols: string[];
  };
  user: {
    tradingEnabled: boolean;
    newOrdersEnabled: boolean;
    maxSingleOrderUsdt: number;
    maxOpenPositions: number;
    maxDailyTrades: number;
    maxDailyLossUsdt: number;
    maxLeverage: number;
  };
  subscription: {
    apiKeyId: string;
    tradingType: 'spot' | 'futures';
    leverage: number;
    marginMode: 'cross' | 'isolated';
    amountPerTrade: number;
    maxPositions: number;
    slippageTolerance: number;
    autoClose: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };
  execution: typeof DEFAULT_EXECUTION_CONFIG;
  position: typeof DEFAULT_POSITION_CONFIG;
  riskManagement: typeof DEFAULT_RISK_MANAGEMENT_CONFIG;
  signalHandling: typeof DEFAULT_SIGNAL_HANDLING_CONFIG;
}
