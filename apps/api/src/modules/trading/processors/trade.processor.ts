import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingService } from '../trading.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { TradeJobData } from '../../signals/dto/signal.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Processor('trade')
export class TradeProcessor extends WorkerHost {
  private readonly logger = new Logger(TradeProcessor.name);

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<TradeJobData>): Promise<{ success: boolean; positionId?: string; error?: string }> {
    const {
      signalId,
      userId,
      subscriptionId,
      apiKeyId,
      exchange,
      symbol,
      side,
      price,
      amountPerTrade,
    } = job.data;

    this.logger.log(
      `执行交易任务: 用户 ${userId} ${side} ${symbol} @ ${price}`,
    );

    try {
      // 检查用户余额
      const balance = await this.tradingService.fetchBalance(userId, apiKeyId);
      const requiredAmount = parseFloat(amountPerTrade);

      if (balance < requiredAmount) {
        this.logger.warn(
          `用户 ${userId} 余额不足: ${balance} < ${requiredAmount}`,
        );

        // 发送交易失败通知
        await this.sendTradeFailedNotification(
          userId,
          symbol,
          side,
          `余额不足: ${balance.toFixed(2)} < ${requiredAmount.toFixed(2)} USDT`,
        );

        return {
          success: false,
          error: `余额不足: ${balance} < ${requiredAmount}`,
        };
      }

      // 执行交易
      const result = await this.tradingService.executeOrder(
        userId,
        apiKeyId,
        symbol,
        side,
        requiredAmount,
      );

      // 创建持仓记录
      const position = await this.prisma.position.create({
        data: {
          userId,
          exchange,
          symbol,
          side: side === 'buy' ? 'long' : 'short',
          entryPrice: new Decimal(result.price),
          amount: new Decimal(result.amount),
          exchangeOrderId: result.orderId,
          status: 'open',
          signalId,
        },
      });

      this.logger.log(
        `交易成功: 用户 ${userId} 持仓 ${position.id}`,
      );

      // 发送开仓成功通知
      await this.notificationsService.notifyPositionOpened(
        userId,
        symbol,
        side === 'buy' ? 'long' : 'short',
        result.price.toString(),
      );

      return {
        success: true,
        positionId: position.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '未知错误';

      this.logger.error(
        `交易失败: 用户 ${userId} - ${errorMessage}`,
      );

      // 记录失败的持仓
      await this.prisma.position.create({
        data: {
          userId,
          exchange,
          symbol,
          side: side === 'buy' ? 'long' : 'short',
          entryPrice: new Decimal(price),
          amount: new Decimal(0),
          status: 'failed',
          signalId,
        },
      });

      // 发送交易失败通知
      await this.sendTradeFailedNotification(userId, symbol, side, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // 发送交易失败通知
  private async sendTradeFailedNotification(
    userId: string,
    symbol: string,
    side: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.notificationsService.send({
        userId,
        type: 'TRADE_FAILED' as any,
        title: '❌ 交易失败',
        message: '',
        data: { symbol, side, reason },
      });
    } catch (error) {
      this.logger.error(`发送失败通知时出错: ${error.message}`);
    }
  }
}
