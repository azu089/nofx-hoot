import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  SubscribeStrategyDto,
  StrategyResponse,
  StrategyDetailResponse,
  MySubscriptionResponse,
} from './dto/strategy.dto';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionConfigResponse,
} from './dto/subscription-config.dto';
import { TradingConfigService } from '../trading/config/config.service';

@Injectable()
export class StrategiesService {
  constructor(
    private prisma: PrismaService,
    private configService: TradingConfigService,
  ) {}

  // 获取策略列表
  async findAll(): Promise<StrategyResponse[]> {
    const strategies = await this.prisma.strategy.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
    });

    return strategies.map((s) => this.formatStrategyResponse(s));
  }

  // 获取首页推荐策略
  async getFeatured(limit = 3): Promise<StrategyResponse[]> {
    const strategies = await this.prisma.strategy.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    // 如果没有设置推荐策略，返回订阅最多的
    if (strategies.length === 0) {
      const fallback = await this.prisma.strategy.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: { subscriptions: true },
          },
        },
        orderBy: { subscriptions: { _count: 'desc' } },
        take: limit,
      });
      return fallback.map((s) => this.formatStrategyResponse(s));
    }

    return strategies.map((s) => this.formatStrategyResponse(s));
  }

  // 格式化策略响应
  private formatStrategyResponse(s: any): StrategyResponse {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      freqtradeId: s.freqtradeId,
      isActive: s.isActive,
      createdAt: s.createdAt,
      subscriberCount: s._count?.subscriptions || 0,
      imageUrl: s.imageUrl,
      riskLevel: s.riskLevel,
      tags: s.tags || [],
      return7d: s.return7d?.toString(),
      return30d: s.return30d?.toString(),
      return90d: s.return90d?.toString(),
      maxDrawdown: s.maxDrawdown?.toString(),
      winRate: s.winRate?.toString(),
      totalTrades: s.totalTrades || 0,
      isFeatured: s.isFeatured,
    };
  }

  // 获取策略详情
  async findOne(userId: string, id: string): Promise<StrategyDetailResponse> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
        subscriptions: {
          where: { userId },
          take: 1,
        },
      },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    const subscription = strategy.subscriptions[0];

    return {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      freqtradeId: strategy.freqtradeId,
      isActive: strategy.isActive,
      createdAt: strategy.createdAt,
      subscriberCount: strategy._count.subscriptions,
      isSubscribed: !!subscription,
      subscription: subscription
        ? {
            id: subscription.id,
            apiKeyId: subscription.apiKeyId,
            amountPerTrade: subscription.amountPerTrade.toString(),
            maxPositions: subscription.maxPositions,
            isActive: subscription.isActive,
          }
        : undefined,
    };
  }

  // 订阅策略
  async subscribe(
    userId: string,
    strategyId: string,
    dto: SubscribeStrategyDto,
  ): Promise<MySubscriptionResponse> {
    // 检查策略是否存在
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    // 检查是否已订阅
    const existingSubscription =
      await this.prisma.strategySubscription.findUnique({
        where: {
          userId_strategyId: {
            userId,
            strategyId,
          },
        },
      });

    if (existingSubscription) {
      throw new ConflictException('已订阅该策略');
    }

    // 检查 API Key 是否属于该用户
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: dto.apiKeyId,
        userId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在或不属于当前用户');
    }

    // 创建订阅
    const subscription = await this.prisma.strategySubscription.create({
      data: {
        userId,
        strategyId,
        apiKeyId: dto.apiKeyId,
        amountPerTrade: new Decimal(dto.amountPerTrade),
        maxPositions: dto.maxPositions || 3,
      },
      include: {
        strategy: true,
      },
    });

    return {
      id: subscription.id,
      strategy: {
        id: subscription.strategy.id,
        name: subscription.strategy.name,
        description: subscription.strategy.description,
        freqtradeId: subscription.strategy.freqtradeId,
        isActive: subscription.strategy.isActive,
        createdAt: subscription.strategy.createdAt,
      },
      apiKeyId: subscription.apiKeyId,
      amountPerTrade: subscription.amountPerTrade.toString(),
      maxPositions: subscription.maxPositions,
      isActive: subscription.isActive,
      createdAt: subscription.createdAt,
    };
  }

  // 取消订阅
  async unsubscribe(userId: string, strategyId: string): Promise<void> {
    const subscription = await this.prisma.strategySubscription.findUnique({
      where: {
        userId_strategyId: {
          userId,
          strategyId,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('未订阅该策略');
    }

    await this.prisma.strategySubscription.delete({
      where: { id: subscription.id },
    });
  }

  // 获取我的订阅
  async getMySubscriptions(userId: string): Promise<MySubscriptionResponse[]> {
    const subscriptions = await this.prisma.strategySubscription.findMany({
      where: { userId },
      include: {
        strategy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((s) => ({
      id: s.id,
      strategy: {
        id: s.strategy.id,
        name: s.strategy.name,
        description: s.strategy.description,
        freqtradeId: s.strategy.freqtradeId,
        isActive: s.strategy.isActive,
        createdAt: s.strategy.createdAt,
      },
      apiKeyId: s.apiKeyId,
      amountPerTrade: s.amountPerTrade.toString(),
      maxPositions: s.maxPositions,
      isActive: s.isActive,
      createdAt: s.createdAt,
    }));
  }

  // ==================== 订阅配置管理 ====================

  /**
   * 创建订阅（带完整配置）
   */
  async createSubscription(
    userId: string,
    strategyId: string,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionConfigResponse> {
    // 检查策略是否存在
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    // 检查是否已订阅
    const existing = await this.prisma.strategySubscription.findUnique({
      where: { userId_strategyId: { userId, strategyId } },
    });

    if (existing) {
      throw new ConflictException('已订阅该策略');
    }

    // 检查 API Key 是否属于该用户
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: dto.basic.apiKeyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key 不存在或不属于当前用户');
    }

    // 获取平台配置进行验证
    const platformConfig = await this.configService.getPlatformConfig();

    // 验证配置是否在平台限制范围内
    await this.validateSubscriptionConfig(dto, platformConfig);

    // 创建订阅
    const subscription = await this.prisma.strategySubscription.create({
      data: {
        userId,
        strategyId,
        // === 基础配置 ===
        apiKeyId: dto.basic.apiKeyId,
        amountPerTrade: new Decimal(dto.basic.amountPerTrade),
        tradingType: dto.basic.tradingType || 'spot',
        direction: dto.basic.direction || 'both',
        tradingPairs: dto.basic.tradingPairs || [],
        autoClose: dto.basic.autoClose ?? true,
        stopLossPercent: dto.basic.stopLossPercent
          ? new Decimal(dto.basic.stopLossPercent)
          : null,
        takeProfitPercent: dto.basic.takeProfitPercent
          ? new Decimal(dto.basic.takeProfitPercent)
          : null,
        // === 高级配置 - 合约 ===
        leverage: dto.advanced?.leverage ?? 1,
        marginMode: dto.advanced?.marginMode ?? 'cross',
        slippageTolerance: new Decimal(dto.advanced?.slippageTolerance ?? 0.5),
        maxPositions: dto.advanced?.maxPositions ?? 3,
        // === 移动止损 ===
        trailingStopEnabled: dto.advanced?.trailingStopEnabled ?? false,
        trailingStopActivation: dto.advanced?.trailingStopActivation
          ? new Decimal(dto.advanced.trailingStopActivation)
          : null,
        trailingStopCallback: dto.advanced?.trailingStopCallback
          ? new Decimal(dto.advanced.trailingStopCallback)
          : null,
        // === DCA 补仓 ===
        dcaEnabled: dto.advanced?.dcaEnabled ?? false,
        dcaMaxCount: dto.advanced?.dcaMaxCount ?? 3,
        dcaTrigger: new Decimal(dto.advanced?.dcaTrigger ?? 5),
        dcaMultiplier: new Decimal(dto.advanced?.dcaMultiplier ?? 1.5),
        // === 防瀑布保护 ===
        waterfallProtection: dto.advanced?.waterfallProtection ?? true,
        waterfallTriggerPercent: new Decimal(dto.advanced?.waterfallTriggerPercent ?? 15),
        // === 黑天鹅保护 ===
        blackSwanProtection: dto.advanced?.blackSwanProtection ?? false,
        blackSwanType: dto.advanced?.blackSwanType ?? 'account_loss',
        blackSwanTrigger: new Decimal(dto.advanced?.blackSwanTrigger ?? 10),
        blackSwanAction: dto.advanced?.blackSwanAction ?? 'close_all',
        // === 单日亏损限制 ===
        dailyMaxLossEnabled: dto.advanced?.dailyMaxLossEnabled ?? false,
        dailyMaxLossPercent: new Decimal(dto.advanced?.dailyMaxLossPercent ?? 20),
        // === 执行配置 ===
        maxRetries: dto.advanced?.maxRetries ?? 3,
        retryDelayMs: dto.advanced?.retryDelayMs ?? 1000,
      },
      include: { strategy: true },
    });

    return this.formatSubscriptionResponse(subscription, apiKey.label, platformConfig);
  }

  /**
   * 获取订阅配置详情
   */
  async getSubscriptionConfig(
    userId: string,
    subscriptionId: string,
  ): Promise<SubscriptionConfigResponse> {
    const subscription = await this.prisma.strategySubscription.findFirst({
      where: { id: subscriptionId, userId },
      include: { strategy: true },
    });

    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: subscription.apiKeyId },
    });

    const platformConfig = await this.configService.getPlatformConfig();

    return this.formatSubscriptionResponse(
      subscription,
      apiKey?.label || '未知',
      platformConfig,
    );
  }

  /**
   * 更新订阅配置
   */
  async updateSubscriptionConfig(
    userId: string,
    subscriptionId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionConfigResponse> {
    const subscription = await this.prisma.strategySubscription.findFirst({
      where: { id: subscriptionId, userId },
      include: { strategy: true },
    });

    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    // 获取平台配置进行验证
    const platformConfig = await this.configService.getPlatformConfig();

    // 构建完整配置用于验证（只需要验证关键字段）
    const fullConfig: CreateSubscriptionDto = {
      basic: {
        apiKeyId: dto.basic?.apiKeyId || subscription.apiKeyId,
        amountPerTrade:
          dto.basic?.amountPerTrade ??
          parseFloat(subscription.amountPerTrade.toString()),
        tradingType:
          (dto.basic?.tradingType as 'spot' | 'futures') ||
          (subscription.tradingType as 'spot' | 'futures'),
        direction:
          (dto.basic?.direction as 'long' | 'short' | 'both') ||
          (subscription.direction as 'long' | 'short' | 'both'),
        tradingPairs: dto.basic?.tradingPairs ?? subscription.tradingPairs,
        autoClose: dto.basic?.autoClose ?? subscription.autoClose,
        stopLossPercent:
          dto.basic?.stopLossPercent ??
          (subscription.stopLossPercent
            ? parseFloat(subscription.stopLossPercent.toString())
            : undefined),
        takeProfitPercent:
          dto.basic?.takeProfitPercent ??
          (subscription.takeProfitPercent
            ? parseFloat(subscription.takeProfitPercent.toString())
            : undefined),
      },
      advanced: {
        leverage: dto.advanced?.leverage ?? subscription.leverage,
        marginMode:
          (dto.advanced?.marginMode as 'cross' | 'isolated') ||
          (subscription.marginMode as 'cross' | 'isolated'),
        slippageTolerance:
          dto.advanced?.slippageTolerance ??
          parseFloat(subscription.slippageTolerance.toString()),
        maxPositions: dto.advanced?.maxPositions ?? subscription.maxPositions,
        maxRetries: dto.advanced?.maxRetries ?? subscription.maxRetries,
        retryDelayMs: dto.advanced?.retryDelayMs ?? subscription.retryDelayMs,
      },
    };

    // 验证配置
    await this.validateSubscriptionConfig(fullConfig, platformConfig);

    // 如果更换了 API Key，需要验证
    if (dto.basic?.apiKeyId && dto.basic.apiKeyId !== subscription.apiKeyId) {
      const apiKey = await this.prisma.apiKey.findFirst({
        where: { id: dto.basic.apiKeyId, userId },
      });
      if (!apiKey) {
        throw new NotFoundException('API Key 不存在或不属于当前用户');
      }
    }

    // 更新订阅
    const updated = await this.prisma.strategySubscription.update({
      where: { id: subscriptionId },
      data: {
        // === 基础配置 ===
        ...(dto.basic?.apiKeyId && { apiKeyId: dto.basic.apiKeyId }),
        ...(dto.basic?.amountPerTrade !== undefined && {
          amountPerTrade: new Decimal(dto.basic.amountPerTrade),
        }),
        ...(dto.basic?.tradingType && { tradingType: dto.basic.tradingType }),
        ...(dto.basic?.direction && { direction: dto.basic.direction }),
        ...(dto.basic?.tradingPairs && { tradingPairs: dto.basic.tradingPairs }),
        ...(dto.basic?.autoClose !== undefined && { autoClose: dto.basic.autoClose }),
        ...(dto.basic?.stopLossPercent !== undefined && {
          stopLossPercent: dto.basic.stopLossPercent
            ? new Decimal(dto.basic.stopLossPercent)
            : null,
        }),
        ...(dto.basic?.takeProfitPercent !== undefined && {
          takeProfitPercent: dto.basic.takeProfitPercent
            ? new Decimal(dto.basic.takeProfitPercent)
            : null,
        }),
        // === 高级配置 - 合约 ===
        ...(dto.advanced?.leverage !== undefined && { leverage: dto.advanced.leverage }),
        ...(dto.advanced?.marginMode && { marginMode: dto.advanced.marginMode }),
        ...(dto.advanced?.slippageTolerance !== undefined && {
          slippageTolerance: new Decimal(dto.advanced.slippageTolerance),
        }),
        ...(dto.advanced?.maxPositions !== undefined && {
          maxPositions: dto.advanced.maxPositions,
        }),
        // === 移动止损 ===
        ...(dto.advanced?.trailingStopEnabled !== undefined && {
          trailingStopEnabled: dto.advanced.trailingStopEnabled,
        }),
        ...(dto.advanced?.trailingStopActivation !== undefined && {
          trailingStopActivation: dto.advanced.trailingStopActivation
            ? new Decimal(dto.advanced.trailingStopActivation)
            : null,
        }),
        ...(dto.advanced?.trailingStopCallback !== undefined && {
          trailingStopCallback: dto.advanced.trailingStopCallback
            ? new Decimal(dto.advanced.trailingStopCallback)
            : null,
        }),
        // === DCA 补仓 ===
        ...(dto.advanced?.dcaEnabled !== undefined && { dcaEnabled: dto.advanced.dcaEnabled }),
        ...(dto.advanced?.dcaMaxCount !== undefined && { dcaMaxCount: dto.advanced.dcaMaxCount }),
        ...(dto.advanced?.dcaTrigger !== undefined && {
          dcaTrigger: new Decimal(dto.advanced.dcaTrigger),
        }),
        ...(dto.advanced?.dcaMultiplier !== undefined && {
          dcaMultiplier: new Decimal(dto.advanced.dcaMultiplier),
        }),
        // === 防瀑布保护 ===
        ...(dto.advanced?.waterfallProtection !== undefined && {
          waterfallProtection: dto.advanced.waterfallProtection,
        }),
        ...(dto.advanced?.waterfallTriggerPercent !== undefined && {
          waterfallTriggerPercent: new Decimal(dto.advanced.waterfallTriggerPercent),
        }),
        // === 黑天鹅保护 ===
        ...(dto.advanced?.blackSwanProtection !== undefined && {
          blackSwanProtection: dto.advanced.blackSwanProtection,
        }),
        ...(dto.advanced?.blackSwanType && { blackSwanType: dto.advanced.blackSwanType }),
        ...(dto.advanced?.blackSwanTrigger !== undefined && {
          blackSwanTrigger: new Decimal(dto.advanced.blackSwanTrigger),
        }),
        ...(dto.advanced?.blackSwanAction && { blackSwanAction: dto.advanced.blackSwanAction }),
        // === 单日亏损限制 ===
        ...(dto.advanced?.dailyMaxLossEnabled !== undefined && {
          dailyMaxLossEnabled: dto.advanced.dailyMaxLossEnabled,
        }),
        ...(dto.advanced?.dailyMaxLossPercent !== undefined && {
          dailyMaxLossPercent: new Decimal(dto.advanced.dailyMaxLossPercent),
        }),
        // === 执行配置 ===
        ...(dto.advanced?.maxRetries !== undefined && {
          maxRetries: dto.advanced.maxRetries,
        }),
        ...(dto.advanced?.retryDelayMs !== undefined && {
          retryDelayMs: dto.advanced.retryDelayMs,
        }),
      },
      include: { strategy: true },
    });

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: updated.apiKeyId },
    });

    return this.formatSubscriptionResponse(updated, apiKey?.label || '未知', platformConfig);
  }

  /**
   * 切换订阅状态（启用/禁用）
   */
  async toggleSubscription(
    userId: string,
    subscriptionId: string,
    isActive: boolean,
  ): Promise<{ isActive: boolean }> {
    const subscription = await this.prisma.strategySubscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    await this.prisma.strategySubscription.update({
      where: { id: subscriptionId },
      data: { isActive },
    });

    return { isActive };
  }

  // ==================== 私有方法 ====================

  /**
   * 验证订阅配置是否在平台限制范围内
   */
  private async validateSubscriptionConfig(
    dto: CreateSubscriptionDto,
    platformConfig: any,
  ): Promise<void> {
    const errors: string[] = [];

    // 验证交易金额
    if (dto.basic.amountPerTrade < platformConfig.minOrderAmountUsdt) {
      errors.push(
        `每单金额不能低于 ${platformConfig.minOrderAmountUsdt} USDT`,
      );
    }
    if (dto.basic.amountPerTrade > platformConfig.maxOrderAmountUsdt) {
      errors.push(
        `每单金额不能超过 ${platformConfig.maxOrderAmountUsdt} USDT`,
      );
    }

    // 验证杠杆
    if (dto.advanced?.leverage) {
      if (dto.advanced.leverage > platformConfig.maxLeverage) {
        errors.push(`杠杆不能超过 ${platformConfig.maxLeverage}x`);
      }
    }

    // 验证持仓数
    if (dto.advanced?.maxPositions) {
      if (dto.advanced.maxPositions > platformConfig.maxPositions) {
        errors.push(`最大持仓数不能超过 ${platformConfig.maxPositions}`);
      }
    }

    // 合约交易检查
    if (dto.basic.tradingType === 'futures') {
      if (!platformConfig.futuresEnabled) {
        errors.push('平台暂不支持合约交易');
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  /**
   * 格式化订阅配置响应
   */
  private formatSubscriptionResponse(
    subscription: any,
    apiKeyLabel: string,
    platformConfig: any,
  ): SubscriptionConfigResponse {
    return {
      id: subscription.id,
      strategyId: subscription.strategyId,
      strategyName: subscription.strategy.name,
      isActive: subscription.isActive,
      basic: {
        apiKeyId: subscription.apiKeyId,
        apiKeyLabel,
        amountPerTrade: subscription.amountPerTrade.toString(),
        tradingType: subscription.tradingType,
        direction: subscription.direction,
        tradingPairs: subscription.tradingPairs || [],
        autoClose: subscription.autoClose,
        stopLossPercent: subscription.stopLossPercent?.toString(),
        takeProfitPercent: subscription.takeProfitPercent?.toString(),
      },
      advanced: {
        leverage: subscription.leverage,
        marginMode: subscription.marginMode,
        slippageTolerance: subscription.slippageTolerance.toString(),
        maxPositions: subscription.maxPositions,
        // 移动止损
        trailingStopEnabled: subscription.trailingStopEnabled,
        trailingStopActivation: subscription.trailingStopActivation?.toString(),
        trailingStopCallback: subscription.trailingStopCallback?.toString(),
        // DCA
        dcaEnabled: subscription.dcaEnabled,
        dcaMaxCount: subscription.dcaMaxCount,
        dcaTrigger: subscription.dcaTrigger.toString(),
        dcaMultiplier: subscription.dcaMultiplier.toString(),
        // 防瀑布
        waterfallProtection: subscription.waterfallProtection,
        waterfallTriggerPercent: subscription.waterfallTriggerPercent.toString(),
        // 黑天鹅
        blackSwanProtection: subscription.blackSwanProtection,
        blackSwanType: subscription.blackSwanType,
        blackSwanTrigger: subscription.blackSwanTrigger.toString(),
        blackSwanAction: subscription.blackSwanAction,
        // 单日亏损
        dailyMaxLossEnabled: subscription.dailyMaxLossEnabled,
        dailyMaxLossPercent: subscription.dailyMaxLossPercent.toString(),
        // 执行配置
        maxRetries: subscription.maxRetries,
        retryDelayMs: subscription.retryDelayMs,
      },
      platformLimits: {
        maxLeverage: platformConfig.maxLeverage,
        maxAmountPerTrade: platformConfig.maxOrderAmountUsdt,
        minAmountPerTrade: platformConfig.minOrderAmountUsdt,
        maxPositions: platformConfig.maxPositions,
      },
      createdAt: subscription.createdAt,
    };
  }
}
