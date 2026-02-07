import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { WebhookSignalDto, SignalJobData, TradeAction } from './dto/signal.dto';
import { toFuturesSymbol } from '../../common/utils/symbol.util';

@Injectable()
export class SignalsService {
  private readonly logger = new Logger(SignalsService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('signal') private signalQueue: Queue,
  ) {}

  // 接收 Freqtrade Webhook 信号
  async receiveWebhook(dto: WebhookSignalDto): Promise<{ signalId: string }> {
    // 统一标准化为合约格式: ETH/USDT → ETH/USDT:USDT
    const symbol = toFuturesSymbol(dto.symbol);

    // 解析 action: 若有 action 字段则使用，否则从 side 推断（向后兼容）
    const action: TradeAction = dto.action || (dto.side === 'buy' ? 'entry_long' : 'exit_long');

    this.logger.log(
      `收到信号: ${dto.strategy} ${action} ${symbol} @ ${dto.price}`,
    );

    // 查找对应的策略
    const strategy = await this.prisma.strategy.findUnique({
      where: { freqtradeId: dto.strategy },
    });

    if (!strategy) {
      throw new NotFoundException(`策略不存在: ${dto.strategy}`);
    }

    // 创建信号记录
    const signal = await this.prisma.signal.create({
      data: {
        strategyId: strategy.id,
        symbol,
        side: dto.side,
        price: new Decimal(dto.price),
      },
    });

    // 将信号加入队列进行分发
    const jobData: SignalJobData = {
      signalId: signal.id,
      strategyId: strategy.id,
      symbol,
      side: dto.side,
      action,
      price: dto.price.toString(),
    };

    await this.signalQueue.add('distribute', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    this.logger.log(`信号已加入队列: ${signal.id}`);

    return { signalId: signal.id };
  }

  // 获取最近的信号列表
  async getRecentSignals(limit = 20) {
    const signals = await this.prisma.signal.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return signals.map((s) => ({
      id: s.id,
      strategyId: s.strategyId,
      strategyName: s.strategy.name,
      symbol: s.symbol,
      side: s.side,
      price: s.price.toString(),
      distributedAt: s.distributedAt,
      createdAt: s.createdAt,
    }));
  }

  // 标记信号已分发
  async markDistributed(
    signalId: string,
    subscriberCount: number,
  ): Promise<void> {
    await this.prisma.signal.update({
      where: { id: signalId },
      data: {
        distributedAt: new Date(),
        subscriberCount,
      },
    });
  }

  // ==================== 信号执行追踪 ====================

  // 创建执行记录
  async createExecution(
    signalId: string,
    userId: string,
    status: string = 'pending',
  ): Promise<string> {
    const execution = await this.prisma.signalExecution.create({
      data: {
        signalId,
        userId,
        status,
        queuedAt: new Date(),
      },
    });
    return execution.id;
  }

  // 更新执行状态为排队中
  async markExecutionQueued(signalId: string, userId: string): Promise<void> {
    await this.prisma.signalExecution.upsert({
      where: {
        signalId_userId: { signalId, userId },
      },
      create: {
        signalId,
        userId,
        status: 'queued',
        queuedAt: new Date(),
      },
      update: {
        status: 'queued',
        queuedAt: new Date(),
      },
    });
  }

  // 更新执行状态为执行中
  async markExecutionStarted(
    signalId: string,
    userId: string,
    exchange: string,
  ): Promise<void> {
    await this.prisma.signalExecution.update({
      where: {
        signalId_userId: { signalId, userId },
      },
      data: {
        status: 'executing',
        exchange,
        startedAt: new Date(),
      },
    });
  }

  // 标记执行成功
  async markExecutionSuccess(
    signalId: string,
    userId: string,
    orderId: string,
    executedPrice: string,
    executedAmount: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.signalExecution.update({
        where: {
          signalId_userId: { signalId, userId },
        },
        data: {
          status: 'success',
          orderId,
          executedPrice,
          executedAmount,
          completedAt: new Date(),
        },
      });

      // 更新信号的成功计数
      await tx.signal.update({
        where: { id: signalId },
        data: {
          executedCount: { increment: 1 },
        },
      });
    });
  }

  // 标记执行失败
  async markExecutionFailed(
    signalId: string,
    userId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.signalExecution.update({
        where: {
          signalId_userId: { signalId, userId },
        },
        data: {
          status: 'failed',
          errorCode,
          errorMessage,
          completedAt: new Date(),
        },
      });

      // 更新信号的失败计数
      await tx.signal.update({
        where: { id: signalId },
        data: {
          failedCount: { increment: 1 },
        },
      });
    });
  }

  // 标记跳过
  async markExecutionSkipped(
    signalId: string,
    userId: string,
    skipReason: string,
  ): Promise<void> {
    await this.prisma.signalExecution.upsert({
      where: {
        signalId_userId: { signalId, userId },
      },
      create: {
        signalId,
        userId,
        status: 'skipped',
        skipReason,
        completedAt: new Date(),
      },
      update: {
        status: 'skipped',
        skipReason,
        completedAt: new Date(),
      },
    });
  }

  // 获取信号执行详情
  async getSignalExecutions(signalId: string) {
    const executions = await this.prisma.signalExecution.findMany({
      where: { signalId },
      orderBy: { createdAt: 'asc' },
    });

    return executions.map((e) => ({
      id: e.id,
      userId: e.userId,
      status: e.status,
      exchange: e.exchange,
      orderId: e.orderId,
      executedPrice: e.executedPrice?.toString(),
      executedAmount: e.executedAmount?.toString(),
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      skipReason: e.skipReason,
      queuedAt: e.queuedAt,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
    }));
  }

  // 获取用户的执行历史
  async getUserExecutions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      this.prisma.signalExecution.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          signal: {
            include: {
              strategy: {
                select: { name: true },
              },
            },
          },
        },
      }),
      this.prisma.signalExecution.count({ where: { userId } }),
    ]);

    return {
      items: executions.map((e) => ({
        id: e.id,
        signalId: e.signalId,
        strategyName: e.signal.strategy.name,
        symbol: e.signal.symbol,
        side: e.signal.side,
        status: e.status,
        exchange: e.exchange,
        executedPrice: e.executedPrice?.toString(),
        errorMessage: e.errorMessage,
        skipReason: e.skipReason,
        createdAt: e.createdAt,
        completedAt: e.completedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取信号统计
  async getSignalStats(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [signals, executions] = await Promise.all([
      this.prisma.signal.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          subscriberCount: true,
          executedCount: true,
          failedCount: true,
        },
      }),
      this.prisma.signalExecution.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: true,
      }),
    ]);

    const statusCounts = executions.reduce(
      (acc, e) => {
        acc[e.status] = e._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      period: `${hours}h`,
      totalSignals: signals.length,
      totalExecutions: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      successCount: statusCounts.success || 0,
      failedCount: statusCounts.failed || 0,
      skippedCount: statusCounts.skipped || 0,
      pendingCount:
        (statusCounts.pending || 0) +
        (statusCounts.queued || 0) +
        (statusCounts.executing || 0),
      successRate: statusCounts.success
        ? (
            (statusCounts.success /
              (statusCounts.success + (statusCounts.failed || 0))) *
            100
          ).toFixed(2) + '%'
        : '0%',
    };
  }
}
