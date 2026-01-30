import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  SubscribeStrategyDto,
  StrategyResponse,
  StrategyDetailResponse,
  MySubscriptionResponse,
} from './dto/strategy.dto';

@Injectable()
export class StrategiesService {
  constructor(private prisma: PrismaService) {}

  // 获取策略列表
  async findAll(): Promise<StrategyResponse[]> {
    const strategies = await this.prisma.strategy.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return strategies.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      freqtradeId: s.freqtradeId,
      isActive: s.isActive,
      createdAt: s.createdAt,
      subscriberCount: s._count.subscriptions,
    }));
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
}
