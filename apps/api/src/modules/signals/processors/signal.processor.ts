import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisLockService } from '../../../common/redis/redis-lock.service';
import { SignalsService } from '../signals.service';
import {
  SignalJobData,
  TradeJobData,
  TradeAction,
  TradingConfigData,
} from '../dto/signal.dto';
import { isSameSymbol } from '../../../common/utils/symbol.util';

@Processor('signal')
export class SignalProcessor extends WorkerHost {
  private readonly logger = new Logger(SignalProcessor.name);

  // 交易锁超时时间（秒）- 防止死锁
  private readonly TRADE_LOCK_TTL = 60;

  // 延迟重试时间（毫秒）
  private readonly LOCK_RETRY_DELAY = 5000;

  constructor(
    private prisma: PrismaService,
    private redisLock: RedisLockService,
    @InjectQueue('trade') private tradeQueue: Queue,
    @Inject(forwardRef(() => SignalsService))
    private signalsService: SignalsService,
  ) {
    super();
  }

  async process(job: Job<SignalJobData>): Promise<{ distributed: number; queued: number }> {
    const { signalId, strategyId, symbol, side, action, price } = job.data;

    this.logger.log(`处理信号分发: ${signalId} ${action} ${symbol}`);

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

    let distributed = 0;
    let queued = 0;

    // 为每个订阅用户创建交易任务
    for (const sub of subscriptions) {
      // ===== 方向过滤 =====
      // direction: 'long' 只跟随多头信号, 'short' 只跟随空头信号, 'both' 全部跟随
      const subDirection = (sub as any).direction || 'both';
      if (subDirection === 'long' && (action === 'entry_short' || action === 'exit_short')) {
        this.logger.log(`用户 ${sub.userId} 配置仅做多，跳过空头信号 ${action}`);
        continue;
      }
      if (subDirection === 'short' && (action === 'entry_long' || action === 'exit_long')) {
        this.logger.log(`用户 ${sub.userId} 配置仅做空，跳过多头信号 ${action}`);
        continue;
      }

      // ===== 交易对过滤 =====
      // tradingPairs: 空数组=跟随策略所有交易对, 非空=只跟随指定交易对
      const subTradingPairs: string[] = (sub as any).tradingPairs || [];
      if (subTradingPairs.length > 0) {
        // 使用 isSameSymbol 统一比较，兼容 ETH/USDT / ETH/USDT:USDT / ETHUSDT
        const matched = subTradingPairs.some((p: string) => isSameSymbol(p, symbol));
        if (!matched) {
          this.logger.log(
            `用户 ${sub.userId} 交易对 ${symbol} 不在订阅列表 [${subTradingPairs.join(', ')}] 中，跳过`,
          );
          continue;
        }
      }

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
        action,
        price,
        amountPerTrade: sub.amountPerTrade.toString(),
        tradingConfig,
      };

      // ===== 并发锁控制 =====
      // 尝试获取用户交易锁，防止同一用户的多个信号同时执行导致超额
      const lockAcquired = await this.redisLock.acquireTradeLock(
        sub.userId,
        sub.apiKeyId,
        this.TRADE_LOCK_TTL,
      );

      if (!lockAcquired) {
        // 无法获取锁，说明该用户正在执行另一个交易
        // 延迟重试，确保交易按顺序执行
        this.logger.warn(
          `用户 ${sub.userId} 交易锁定中（API Key: ${sub.apiKeyId}），信号延迟 ${this.LOCK_RETRY_DELAY}ms 排队`,
        );

        // 创建执行记录（排队状态）
        await this.signalsService.markExecutionQueued(signalId, sub.userId);

        await this.tradeQueue.add('execute', tradeJob, {
          delay: this.LOCK_RETRY_DELAY,
          attempts: tradingConfig.maxRetries,
          backoff: {
            type: 'exponential',
            delay: tradingConfig.retryDelayMs,
          },
        });

        queued++;
        continue;
      }

      // 创建执行记录（排队状态）
      await this.signalsService.markExecutionQueued(signalId, sub.userId);

      // 成功获取锁，立即执行
      await this.tradeQueue.add('execute', tradeJob, {
        attempts: tradingConfig.maxRetries,
        backoff: {
          type: 'exponential',
          delay: tradingConfig.retryDelayMs,
        },
      });

      distributed++;
      this.logger.log(
        `已为用户 ${sub.userId} 创建交易任务 (${tradingConfig.tradingType})，锁已获取`,
      );
    }

    // 更新信号分发时间和订阅者数量
    await this.prisma.signal.update({
      where: { id: signalId },
      data: {
        distributedAt: new Date(),
        subscriberCount: distributed + queued,
      },
    });

    this.logger.log(
      `信号 ${signalId} 分发完成: 立即执行 ${distributed} 个, 延迟排队 ${queued} 个`,
    );

    return { distributed, queued };
  }
}
