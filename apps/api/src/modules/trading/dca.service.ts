import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService } from './trading.service';
import { RiskControlService } from './risk-control.service';
import { NotificationsService } from '../notifications/notifications.service';
import Decimal from 'decimal.js';

interface DcaConfig {
  dcaEnabled: boolean;
  dcaMaxCount: number;       // 最大补仓次数
  dcaTrigger: number;        // 触发跌幅 %
  dcaMultiplier: number;     // 补仓倍率
  waterfallProtection: boolean;
  waterfallTriggerPercent: number; // 防瀑布触发 %
}

interface DcaPosition {
  positionId: string;
  userId: string;
  apiKeyId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  amount: number;
  baseAmount: number;        // 初始金额（USDT）
  dcaCount: number;          // 已补仓次数
  lastDcaPrice: number;      // 上次补仓价格
  config: DcaConfig;
}

@Injectable()
export class DcaService {
  private readonly logger = new Logger(DcaService.name);
  private trackedPositions: Map<string, DcaPosition> = new Map();

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
    private riskControlService: RiskControlService,
    private notificationsService: NotificationsService,
  ) {}

  // 添加持仓到 DCA 监控
  trackPosition(position: DcaPosition) {
    if (!position.config.dcaEnabled) return;

    this.trackedPositions.set(position.positionId, {
      ...position,
      dcaCount: 0,
      lastDcaPrice: position.entryPrice,
    });
    this.logger.log(`DCA 监控: ${position.symbol} 最大 ${position.config.dcaMaxCount} 次`);
  }

  // 移除监控
  untrackPosition(positionId: string) {
    this.trackedPositions.delete(positionId);
  }

  // 检查是否需要补仓（由 PositionMonitorService 调用）
  async checkDca(positionId: string, currentPrice: number): Promise<void> {
    const position = this.trackedPositions.get(positionId);
    if (!position) return;

    const { config, dcaCount, lastDcaPrice, side } = position;

    // 检查是否已达最大补仓次数
    if (dcaCount >= config.dcaMaxCount) {
      return;
    }

    // 计算相对上次补仓价格的跌幅
    let dropPercent: number;
    if (side === 'long') {
      dropPercent = ((lastDcaPrice - currentPrice) / lastDcaPrice) * 100;
    } else {
      // 空单：价格上涨是亏损
      dropPercent = ((currentPrice - lastDcaPrice) / lastDcaPrice) * 100;
    }

    // 检查防瀑布保护
    if (config.waterfallProtection) {
      const totalDrop = this.calculateTotalDrop(position, currentPrice);
      if (totalDrop >= config.waterfallTriggerPercent) {
        this.logger.warn(
          `防瀑布触发: ${position.symbol} 总跌幅 ${totalDrop.toFixed(2)}% 超过 ${config.waterfallTriggerPercent}%`,
        );
        await this.notifyWaterfallTriggered(position, totalDrop);
        return;
      }
    }

    // 检查是否触发补仓
    if (dropPercent >= config.dcaTrigger) {
      await this.executeDca(position, currentPrice, dropPercent);
    }
  }

  // 计算总跌幅
  private calculateTotalDrop(position: DcaPosition, currentPrice: number): number {
    const { side, entryPrice } = position;
    if (side === 'long') {
      return ((entryPrice - currentPrice) / entryPrice) * 100;
    } else {
      return ((currentPrice - entryPrice) / entryPrice) * 100;
    }
  }

  // 执行补仓
  private async executeDca(
    position: DcaPosition,
    currentPrice: number,
    dropPercent: number,
  ): Promise<void> {
    const { positionId, userId, apiKeyId, symbol, side, baseAmount, dcaCount, config } = position;

    // 计算补仓金额（倍率递增）
    const dcaAmount = new Decimal(baseAmount)
      .times(Math.pow(config.dcaMultiplier, dcaCount + 1))
      .toNumber();

    this.logger.log(
      `执行补仓 #${dcaCount + 1}: ${symbol} 金额 ${dcaAmount} USDT (跌幅 ${dropPercent.toFixed(2)}%)`,
    );

    // 风控检查
    const riskCheck = await this.riskControlService.check(
      userId,
      apiKeyId,
      symbol,
      dcaAmount,
    );

    if (!riskCheck.allowed) {
      this.logger.warn(`补仓被风控拒绝: ${riskCheck.reason}`);
      await this.notifyDcaBlocked(position, riskCheck.reason || '风控限制');
      return;
    }

    try {
      // 执行补仓订单
      const order = await this.tradingService.executeOrder(
        userId,
        apiKeyId,
        symbol,
        side === 'long' ? 'buy' : 'sell',
        dcaAmount,
      );

      // 更新持仓记录
      position.dcaCount += 1;
      position.lastDcaPrice = currentPrice;
      position.amount += order.amount;

      // 计算新的平均入场价
      const totalCost = new Decimal(position.entryPrice)
        .times(position.amount - order.amount)
        .plus(new Decimal(currentPrice).times(order.amount));
      position.entryPrice = totalCost.div(position.amount).toNumber();

      // 更新数据库
      await this.prisma.position.update({
        where: { id: positionId },
        data: {
          amount: new Decimal(position.amount).toString(),
          entryPrice: new Decimal(position.entryPrice).toString(),
          dcaCount: position.dcaCount,
          lastDcaAt: new Date(),
        },
      });

      // 记录 DCA 日志
      await this.prisma.dcaLog.create({
        data: {
          positionId,
          userId,
          dcaNumber: position.dcaCount,
          triggerPrice: new Decimal(currentPrice).toString(),
          dcaAmount: new Decimal(dcaAmount).toString(),
          newAvgPrice: new Decimal(position.entryPrice).toString(),
          dropPercent: new Decimal(dropPercent).toString(),
        },
      });

      // 发送通知
      await this.notificationsService.sendNotification(userId, {
        type: 'dca_executed',
        title: '补仓成功',
        body: `${symbol} 第 ${position.dcaCount} 次补仓，金额 ${dcaAmount} USDT`,
        data: {
          positionId,
          symbol,
          dcaNumber: position.dcaCount,
          dcaAmount,
          newAvgPrice: position.entryPrice,
        },
      });

      this.logger.log(`补仓成功: ${symbol} 新均价 ${position.entryPrice.toFixed(4)}`);
    } catch (error) {
      this.logger.error(`补仓失败: ${(error as Error).message}`);
      await this.notifyDcaFailed(position, (error as Error).message);
    }
  }

  // 通知：防瀑布触发
  private async notifyWaterfallTriggered(position: DcaPosition, dropPercent: number) {
    await this.notificationsService.sendNotification(position.userId, {
      type: 'waterfall_triggered',
      title: '防瀑布保护触发',
      body: `${position.symbol} 跌幅 ${dropPercent.toFixed(2)}% 超过阈值，暂停补仓`,
      data: {
        positionId: position.positionId,
        symbol: position.symbol,
        dropPercent,
      },
    });
  }

  // 通知：补仓被阻止
  private async notifyDcaBlocked(position: DcaPosition, reason: string) {
    await this.notificationsService.sendNotification(position.userId, {
      type: 'dca_blocked',
      title: '补仓被阻止',
      body: `${position.symbol} 补仓被阻止: ${reason}`,
      data: {
        positionId: position.positionId,
        symbol: position.symbol,
        reason,
      },
    });
  }

  // 通知：补仓失败
  private async notifyDcaFailed(position: DcaPosition, error: string) {
    await this.notificationsService.sendNotification(position.userId, {
      type: 'dca_failed',
      title: '补仓失败',
      body: `${position.symbol} 补仓执行失败: ${error}`,
      data: {
        positionId: position.positionId,
        symbol: position.symbol,
        error,
      },
    });
  }
}
