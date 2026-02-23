import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService } from './trading.service';
import { FeeService } from './fee.service';
import { NotificationsService } from '../notifications/notifications.service';
import Decimal from 'decimal.js';

interface PositionMonitorConfig {
  stopLossPercent?: number;
  takeProfitPercent?: number;
  trailingStopEnabled?: boolean;
  trailingStopActivation?: number; // 激活盈利 %
  trailingStopCallback?: number; // 回撤 %
}

interface TrackedPosition {
  positionId: string;
  userId: string;
  apiKeyId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  amount: number;
  config: PositionMonitorConfig;
  // 移动止损追踪
  highestPrice?: number; // 多头：最高价
  lowestPrice?: number; // 空头：最低价
  trailingStopActivated?: boolean;
}

@Injectable()
export class PositionMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PositionMonitorService.name);
  private trackedPositions: Map<string, TrackedPosition> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL_MS = 5000; // 5秒检查一次

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
    private feeService: FeeService,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    // 启动时加载所有活跃持仓
    await this.loadActivePositions();
    // 启动监控循环
    this.startMonitoring();
  }

  onModuleDestroy() {
    this.stopMonitoring();
  }

  // 加载活跃持仓
  private async loadActivePositions() {
    const positions = await this.prisma.position.findMany({
      where: { status: 'open' },
      include: {
        subscription: {
          select: {
            stopLossPercent: true,
            takeProfitPercent: true,
            trailingStopEnabled: true,
            trailingStopActivation: true,
            trailingStopCallback: true,
            apiKeyId: true,
          },
        },
      },
    });

    for (const pos of positions) {
      // 必须有 apiKeyId 才能执行交易操作
      const apiKeyId = pos.subscription?.apiKeyId || pos.apiKeyId;
      if (!apiKeyId) {
        this.logger.warn(`持仓 ${pos.id} 缺少 apiKeyId，跳过监控`);
        continue;
      }

      this.trackPosition({
        positionId: pos.id,
        userId: pos.userId,
        apiKeyId,
        symbol: pos.symbol,
        side: pos.side as 'long' | 'short',
        entryPrice: new Decimal(pos.entryPrice).toNumber(),
        amount: new Decimal(pos.amount).toNumber(),
        config: {
          stopLossPercent: pos.subscription?.stopLossPercent
            ? new Decimal(pos.subscription.stopLossPercent).toNumber()
            : undefined,
          takeProfitPercent: pos.subscription?.takeProfitPercent
            ? new Decimal(pos.subscription.takeProfitPercent).toNumber()
            : undefined,
          trailingStopEnabled: pos.subscription?.trailingStopEnabled || false,
          trailingStopActivation: pos.subscription?.trailingStopActivation
            ? new Decimal(pos.subscription.trailingStopActivation).toNumber()
            : undefined,
          trailingStopCallback: pos.subscription?.trailingStopCallback
            ? new Decimal(pos.subscription.trailingStopCallback).toNumber()
            : undefined,
        },
      });
    }

    this.logger.log(`加载了 ${this.trackedPositions.size} 个活跃持仓`);
  }

  // 添加持仓到监控
  trackPosition(position: TrackedPosition) {
    this.trackedPositions.set(position.positionId, {
      ...position,
      highestPrice: position.entryPrice,
      lowestPrice: position.entryPrice,
      trailingStopActivated: false,
    });
    this.logger.log(`开始监控持仓: ${position.symbol} (${position.side})`);
  }

  // 移除持仓监控
  untrackPosition(positionId: string) {
    this.trackedPositions.delete(positionId);
    this.logger.log(`停止监控持仓: ${positionId}`);
  }

  // 启动监控
  private startMonitoring() {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(async () => {
      await this.checkAllPositions();
    }, this.MONITOR_INTERVAL_MS);

    this.logger.log('持仓监控已启动');
  }

  // 停止监控
  private stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.logger.log('持仓监控已停止');
    }
  }

  // 检查所有持仓
  private async checkAllPositions() {
    for (const [positionId, position] of this.trackedPositions) {
      try {
        await this.checkPosition(position);
      } catch (error) {
        this.logger.error(
          `检查持仓失败 ${positionId}: ${(error as Error).message}`,
        );
      }
    }
  }

  // 检查单个持仓
  private async checkPosition(position: TrackedPosition) {
    const { userId, apiKeyId, symbol, side, entryPrice, amount, config } =
      position;

    // 获取当前价格
    const currentPrice = await this.tradingService.getCurrentPrice(
      userId,
      apiKeyId,
      symbol,
    );

    if (!currentPrice) {
      this.logger.warn(`无法获取 ${symbol} 价格`);
      return;
    }

    // 计算盈亏百分比
    const pnlPercent = this.calculatePnlPercent(side, entryPrice, currentPrice);

    // 更新追踪价格（用于移动止损）
    this.updateTrackingPrice(position, currentPrice);

    // 检查止损
    if (config.stopLossPercent && pnlPercent <= -config.stopLossPercent) {
      await this.triggerStopLoss(position, currentPrice, pnlPercent);
      return;
    }

    // 检查止盈
    if (config.takeProfitPercent && pnlPercent >= config.takeProfitPercent) {
      await this.triggerTakeProfit(position, currentPrice, pnlPercent);
      return;
    }

    // 检查移动止损
    if (config.trailingStopEnabled) {
      const shouldClose = this.checkTrailingStop(
        position,
        currentPrice,
        pnlPercent,
      );
      if (shouldClose) {
        await this.triggerTrailingStop(position, currentPrice, pnlPercent);
        return;
      }
    }
  }

  // 计算盈亏百分比
  private calculatePnlPercent(
    side: 'long' | 'short',
    entryPrice: number,
    currentPrice: number,
  ): number {
    if (side === 'long') {
      return ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      return ((entryPrice - currentPrice) / entryPrice) * 100;
    }
  }

  // 更新追踪价格
  private updateTrackingPrice(position: TrackedPosition, currentPrice: number) {
    if (position.side === 'long') {
      if (!position.highestPrice || currentPrice > position.highestPrice) {
        position.highestPrice = currentPrice;
      }
    } else {
      if (!position.lowestPrice || currentPrice < position.lowestPrice) {
        position.lowestPrice = currentPrice;
      }
    }
  }

  // 检查移动止损
  private checkTrailingStop(
    position: TrackedPosition,
    currentPrice: number,
    pnlPercent: number,
  ): boolean {
    const { config, side, entryPrice } = position;

    // 检查是否达到激活条件
    if (!position.trailingStopActivated) {
      if (
        config.trailingStopActivation &&
        pnlPercent >= config.trailingStopActivation
      ) {
        position.trailingStopActivated = true;
        this.logger.log(
          `移动止损已激活: ${position.symbol} 盈利 ${pnlPercent.toFixed(2)}%`,
        );
        // 记录激活事件
        this.prisma.tradeExecutionLog.create({
          data: {
            userId: position.userId,
            positionId: position.positionId,
            exchange: '',
            symbol: position.symbol,
            side: position.side,
            orderType: 'trailing_stop_activate',
            requestedAmountUsdt: new Decimal(0),
            status: 'filled',
            completedAt: new Date(),
            configSnapshot: JSON.stringify({
              activationPercent: config.trailingStopActivation,
              currentPnlPercent: pnlPercent,
              currentPrice,
              entryPrice: position.entryPrice,
            }),
          },
        }).catch((e: Error) => this.logger.warn(`记录移动止损激活失败: ${e.message}`));
      } else {
        return false; // 未激活
      }
    }

    // 已激活，检查回撤
    if (!config.trailingStopCallback) return false;

    let callbackPercent: number;
    if (side === 'long') {
      // 多头：从最高价回撤
      callbackPercent =
        ((position.highestPrice! - currentPrice) / position.highestPrice!) *
        100;
    } else {
      // 空头：从最低价反弹
      callbackPercent =
        ((currentPrice - position.lowestPrice!) / position.lowestPrice!) * 100;
    }

    return callbackPercent >= config.trailingStopCallback;
  }

  // 触发止损
  private async triggerStopLoss(
    position: TrackedPosition,
    currentPrice: number,
    pnlPercent: number,
  ) {
    this.logger.warn(
      `触发止损: ${position.symbol} 亏损 ${pnlPercent.toFixed(2)}%`,
    );

    await this.closePositionAndNotify(
      position,
      'stop_loss',
      currentPrice,
      pnlPercent,
    );
  }

  // 触发止盈
  private async triggerTakeProfit(
    position: TrackedPosition,
    currentPrice: number,
    pnlPercent: number,
  ) {
    this.logger.log(
      `触发止盈: ${position.symbol} 盈利 ${pnlPercent.toFixed(2)}%`,
    );

    await this.closePositionAndNotify(
      position,
      'take_profit',
      currentPrice,
      pnlPercent,
    );
  }

  // 触发移动止损
  private async triggerTrailingStop(
    position: TrackedPosition,
    currentPrice: number,
    pnlPercent: number,
  ) {
    this.logger.log(
      `触发移动止损: ${position.symbol} 当前盈利 ${pnlPercent.toFixed(2)}%`,
    );

    await this.closePositionAndNotify(
      position,
      'trailing_stop',
      currentPrice,
      pnlPercent,
    );
  }

  // 平仓并发送通知
  private async closePositionAndNotify(
    position: TrackedPosition,
    reason: 'stop_loss' | 'take_profit' | 'trailing_stop',
    currentPrice: number,
    pnlPercent: number,
  ) {
    const { positionId, userId, apiKeyId, symbol, side, amount, entryPrice } = position;

    try {
      // 执行平仓
      const result = await this.tradingService.closePosition(
        userId,
        apiKeyId,
        symbol,
        amount,
        side,
      );

      // G4: 计算绝对盈亏 (USDT) — 对齐 ai-execution.service.ts
      const absolutePnl = side === 'long'
        ? (currentPrice - entryPrice) * amount
        : (entryPrice - currentPrice) * amount;

      // 更新数据库
      await this.prisma.position.update({
        where: { id: positionId },
        data: {
          status: 'closed',
          exitPrice: new Decimal(currentPrice).toString(),
          closedAt: new Date(),
          closeReason: reason,
          realizedPnl: new Decimal(absolutePnl).toFixed(8),
          pnl: new Decimal(absolutePnl).toFixed(8),
        },
      });

      // ===== 写入 TradeExecutionLog =====
      try {
        await this.prisma.tradeExecutionLog.create({
          data: {
            userId,
            positionId,
            exchange: result.exchange,
            symbol,
            side: side === 'long' ? 'sell' : 'buy',
            orderType: reason,
            requestedAmountUsdt: new Decimal(amount * currentPrice),
            executedAmount: new Decimal(result.amount),
            executedPrice: new Decimal(result.price),
            executedVolumeUsdt: new Decimal(result.amount * result.price),
            status: 'filled',
            completedAt: new Date(),
            configSnapshot: JSON.stringify({
              reason,
              triggerPrice: currentPrice,
              pnlPercent,
              entryPrice: position.entryPrice,
              stopLossPercent: position.config.stopLossPercent,
              takeProfitPercent: position.config.takeProfitPercent,
              trailingStopActivation: position.config.trailingStopActivation,
              trailingStopCallback: position.config.trailingStopCallback,
              highestPrice: position.highestPrice,
              lowestPrice: position.lowestPrice,
            }),
          },
        });
      } catch (logErr) {
        this.logger.warn(`写入 TradeExecutionLog 失败: ${(logErr as Error).message}`);
      }

      // ===== 燃油费扣除（仅盈利时） =====
      if (absolutePnl > 0) {
        try {
          const feeCalc = await this.feeService.calculateFee(userId, new Decimal(absolutePnl).toFixed(8));
          if (parseFloat(feeCalc.feeAmount) > 0) {
            const uniqueOrderId = this.feeService.generateUniqueOrderId('GAS_FEE', userId, positionId);
            await this.feeService.chargeFee({
              userId,
              positionId,
              profit: feeCalc.profit,
              feeRate: feeCalc.finalFeeRate,
              feeAmount: feeCalc.feeAmount,
              uniqueOrderId,
            });
            this.logger.log(`燃油费已扣除: ${symbol} 盈利=$${absolutePnl.toFixed(2)} 费用=$${feeCalc.feeAmount} (${reason})`);
          }
        } catch (feeErr) {
          this.logger.error(`燃油费扣除失败(非致命): ${(feeErr as Error).message}`);
        }
      }

      // 移除监控
      this.untrackPosition(positionId);

      // 发送通知
      const reasonText = {
        stop_loss: '止损',
        take_profit: '止盈',
        trailing_stop: '移动止损',
      }[reason];

      await this.notificationsService.sendNotification(userId, {
        type: 'position_closed',
        title: `${reasonText}平仓`,
        body: `${symbol} ${side === 'long' ? '多' : '空'}单已${reasonText}，盈亏 ${pnlPercent.toFixed(2)}%`,
        data: {
          positionId,
          symbol,
          reason,
          pnlPercent,
          exitPrice: currentPrice,
        },
      });

      this.logger.log(`平仓成功: ${symbol} 原因: ${reason}`);
    } catch (error) {
      this.logger.error(`平仓失败 ${positionId}: ${(error as Error).message}`);

      // 发送失败通知
      await this.notificationsService.sendNotification(userId, {
        type: 'position_close_failed',
        title: '平仓失败',
        body: `${symbol} 自动平仓失败，请手动处理`,
        data: { positionId, symbol, reason, error: (error as Error).message },
      });
    }
  }
}
