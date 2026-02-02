import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SignalJobData,
  TradeJobData,
  TradingConfigData,
} from '../dto/signal.dto';

@Processor('signal')
export class SignalProcessor extends WorkerHost {
  private readonly logger = new Logger(SignalProcessor.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('trade') private tradeQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<SignalJobData>): Promise<{ distributed: number }> {
    const { signalId, strategyId, symbol, side, price } = job.data;

    this.logger.log(`处理信号分发: ${signalId} ${side} ${symbol}`);

    // 查找订阅该策略的所有活跃用户（包含交易配置）
    const subscriptions = await this.prisma.strategySubscription.findMany({
      where: {
        strategyId,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    this.logger.log(`找到 ${subscriptions.length} 个订阅用户`);

    // 为每个订阅用户创建交易任务
    for (const sub of subscriptions) {
      // 获取 API Key 信息
      const apiKey = await this.prisma.apiKey.findUnique({
        where: { id: sub.apiKeyId },
        select: { exchange: true, isActive: true },
      });

      if (!apiKey || !apiKey.isActive) {
        this.logger.warn(`用户 ${sub.userId} 的 API Key 无效，跳过`);
        continue;
      }

      // 构建交易配置
      const tradingConfig: TradingConfigData = {
        tradingType: (sub as any).tradingType || 'spot',
        leverage: (sub as any).leverage || 1,
        marginMode: (sub as any).marginMode || 'cross',
        slippageTolerance: parseFloat(
          ((sub as any).slippageTolerance || 0.5).toString(),
        ),
        autoClose: (sub as any).autoClose !== false, // 默认 true
        stopLossPercent: (sub as any).stopLossPercent
          ? parseFloat((sub as any).stopLossPercent.toString())
          : undefined,
        takeProfitPercent: (sub as any).takeProfitPercent
          ? parseFloat((sub as any).takeProfitPercent.toString())
          : undefined,
        maxRetries: (sub as any).maxRetries || 3,
        retryDelayMs: (sub as any).retryDelayMs || 1000,
      };

      const tradeJob: TradeJobData = {
        signalId,
        userId: sub.userId,
        subscriptionId: sub.id,
        apiKeyId: sub.apiKeyId,
        exchange: apiKey.exchange,
        symbol,
        side,
        price,
        amountPerTrade: sub.amountPerTrade.toString(),
        tradingConfig,
      };

      await this.tradeQueue.add('execute', tradeJob, {
        attempts: tradingConfig.maxRetries,
        backoff: {
          type: 'exponential',
          delay: tradingConfig.retryDelayMs,
        },
      });

      this.logger.log(
        `已为用户 ${sub.userId} 创建交易任务 (${tradingConfig.tradingType})`,
      );
    }

    // 更新信号分发时间
    await this.prisma.signal.update({
      where: { id: signalId },
      data: { distributedAt: new Date() },
    });

    return { distributed: subscriptions.length };
  }
}
