import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingService, TradingConfig } from '../trading.service';
import { RiskControlService } from '../risk-control.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { TradeJobData } from '../../signals/dto/signal.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Processor('trade')
export class TradeProcessor extends WorkerHost {
  private readonly logger = new Logger(TradeProcessor.name);

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
    private riskControlService: RiskControlService,
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
      tradingConfig,
    } = job.data;

    // 构建 TradingService 需要的配置
    const config: TradingConfig = {
      tradingType: tradingConfig?.tradingType || 'spot',
      leverage: tradingConfig?.leverage || 1,
      marginMode: tradingConfig?.marginMode || 'cross',
      slippageTolerance: tradingConfig?.slippageTolerance || 0.5,
      maxRetries: tradingConfig?.maxRetries || 3,
      retryDelayMs: tradingConfig?.retryDelayMs || 1000,
    };

    this.logger.log(
      `执行交易任务: 用户 ${userId} ${side} ${symbol} @ ${price} (${config.tradingType})`,
    );

    try {
      // 根据信号类型决定操作
      if (side === 'sell') {
        // 卖出信号 = 平仓
        return await this.handleSellSignal(
          userId,
          apiKeyId,
          signalId,
          exchange,
          symbol,
          config,
          tradingConfig?.autoClose !== false,
        );
      } else {
        // 买入信号 = 开仓
        return await this.handleBuySignal(
          userId,
          apiKeyId,
          signalId,
          exchange,
          symbol,
          price,
          parseFloat(amountPerTrade),
          config,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      this.logger.error(`交易失败: 用户 ${userId} - ${errorMessage}`);

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

  // 处理买入信号（开仓）
  private async handleBuySignal(
    userId: string,
    apiKeyId: string,
    signalId: string,
    exchange: string,
    symbol: string,
    price: string,
    requiredAmount: number,
    config: TradingConfig,
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    // 执行全面风控检查
    const riskCheck = await this.riskControlService.check(
      userId,
      apiKeyId,
      symbol,
      requiredAmount,
    );

    if (!riskCheck.allowed) {
      this.logger.warn(`用户 ${userId} 风控检查未通过: ${riskCheck.reason}`);

      await this.riskControlService.logRejection(
        userId,
        signalId,
        riskCheck.reason || 'unknown',
        riskCheck.details || {},
      );

      await this.sendTradeFailedNotification(
        userId,
        symbol,
        'buy',
        this.getRiskReasonMessage(riskCheck.reason, riskCheck.details),
      );

      return { success: false, error: riskCheck.reason };
    }

    // 执行交易
    const result = await this.tradingService.executeOrder(
      userId,
      apiKeyId,
      symbol,
      'buy',
      requiredAmount,
      config,
    );

    // 创建持仓记录
    const position = await this.prisma.position.create({
      data: {
        userId,
        exchange,
        symbol,
        side: 'long',
        entryPrice: new Decimal(result.price),
        amount: new Decimal(result.amount),
        exchangeOrderId: result.orderId,
        status: 'open',
        signalId,
      },
    });

    this.logger.log(`开仓成功: 用户 ${userId} 持仓 ${position.id}`);

    await this.notificationsService.notifyPositionOpened(
      userId,
      symbol,
      'long',
      result.price.toString(),
    );

    return { success: true, positionId: position.id };
  }

  // 处理卖出信号（平仓）
  private async handleSellSignal(
    userId: string,
    apiKeyId: string,
    signalId: string,
    exchange: string,
    symbol: string,
    config: TradingConfig,
    autoClose: boolean,
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    // 如果不启用自动平仓，跳过
    if (!autoClose) {
      this.logger.log(`用户 ${userId} 未启用自动平仓，跳过卖出信号`);
      return { success: true, error: 'auto_close_disabled' };
    }

    // 查找该用户该币种的开放持仓
    const openPosition = await this.prisma.position.findFirst({
      where: {
        userId,
        symbol,
        status: 'open',
      },
    });

    if (!openPosition) {
      this.logger.log(`用户 ${userId} 没有 ${symbol} 持仓，跳过平仓`);
      return { success: true, error: 'no_position_to_close' };
    }

    this.logger.log(
      `自动平仓: 用户 ${userId} 持仓 ${openPosition.id} ${symbol}`,
    );

    // 执行平仓
    const result = await this.tradingService.closePosition(
      userId,
      apiKeyId,
      symbol,
      parseFloat(openPosition.amount.toString()),
      openPosition.side as 'long' | 'short',
      config,
    );

    // 计算盈亏
    const entryPrice = new Decimal(openPosition.entryPrice.toString());
    const closePrice = new Decimal(result.price);
    const amount = new Decimal(openPosition.amount.toString());

    let pnl: Decimal;
    if (openPosition.side === 'long') {
      pnl = closePrice.minus(entryPrice).times(amount);
    } else {
      pnl = entryPrice.minus(closePrice).times(amount);
    }

    // 更新持仓状态
    await this.prisma.position.update({
      where: { id: openPosition.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closePrice: closePrice,
        pnl: pnl,
      },
    });

    this.logger.log(
      `平仓成功: 持仓 ${openPosition.id} PnL: ${pnl.toString()}`,
    );

    // 发送平仓通知
    await this.notificationsService.notifyPositionClosed(
      userId,
      symbol,
      closePrice.toString(),
      pnl.toString(),
    );

    return { success: true, positionId: openPosition.id };
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

  // 获取风控拒绝原因的用户友好消息
  private getRiskReasonMessage(reason?: string, details?: Record<string, any>): string {
    switch (reason) {
      case 'max_positions_reached':
        return `已达最大持仓数限制 (${details?.current || '?'}/${details?.max || '?'})`;
      case 'symbol_already_open':
        return `${details?.symbol || '该币种'} 已有持仓，不允许重复开仓`;
      case 'daily_limit_reached':
        return `已达每日交易次数限制 (${details?.current || '?'}/${details?.max || '?'})`;
      case 'insufficient_balance':
        return `余额不足: ${(details?.balance || 0).toFixed(2)} < ${(details?.required || 0).toFixed(2)} USDT`;
      case 'balance_below_minimum':
        return `交易后余额将低于最小要求 ${details?.minRequired || 10} USDT`;
      case 'balance_check_failed':
        return `余额查询失败: ${details?.error || '未知错误'}`;
      default:
        return reason || '未知风控限制';
    }
  }
}
