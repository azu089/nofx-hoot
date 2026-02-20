import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingService, TradingConfig } from '../../trading/trading.service';
import { Decimal } from '@prisma/client/runtime/library';
import { isSameSymbol } from '../../../common/utils/symbol.util';

/**
 * AI 持仓回撤监控处理器
 *
 * 定期检查所有 AI 来源的开放持仓：
 * 1. 获取当前标记价格
 * 2. 计算未实现盈亏百分比
 * 3. 更新高水位（highWaterMark）
 * 4. 如果从高水位回撤 ≥40% 且曾盈利 >5%，自动平仓保护
 */
@Processor('ai-monitor')
export class DrawdownMonitorProcessor extends WorkerHost {
  private readonly logger = new Logger(DrawdownMonitorProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TradingService))
    private readonly tradingService: TradingService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ checked: number; closed: number }> {
    this.logger.debug('[AI监控] 开始检查 AI 持仓回撤...');

    // 查询所有 AI 来源的开放持仓
    const positions = await this.prisma.position.findMany({
      where: {
        status: 'open',
        source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
      },
      select: {
        id: true,
        userId: true,
        apiKeyId: true,
        symbol: true,
        side: true,
        entryPrice: true,
        amount: true,
        margin: true,
        highWaterMark: true,
      },
    });

    if (positions.length === 0) {
      return { checked: 0, closed: 0 };
    }

    let closedCount = 0;

    for (const pos of positions) {
      try {
        if (!pos.apiKeyId) continue;

        // 获取当前价格
        const currentPrice = await this.tradingService.getCurrentPrice(
          pos.userId,
          pos.apiKeyId,
          pos.symbol,
        );

        if (!currentPrice || currentPrice <= 0) continue;

        // 计算未实现盈亏百分比
        const entryPrice = Number(pos.entryPrice);
        const amount = Number(pos.amount);
        const margin = Number(pos.margin || 0);

        if (entryPrice <= 0 || margin <= 0) continue;

        let unrealizedPnl: number;
        if (pos.side === 'long') {
          unrealizedPnl = (currentPrice - entryPrice) * amount;
        } else {
          unrealizedPnl = (entryPrice - currentPrice) * amount;
        }
        const pnlPercent = (unrealizedPnl / margin) * 100;

        // 更新高水位
        const currentHWM = pos.highWaterMark ? Number(pos.highWaterMark) : null;
        if (currentHWM === null || pnlPercent > currentHWM) {
          await this.prisma.position.update({
            where: { id: pos.id },
            data: {
              highWaterMark: new Decimal(Math.max(pnlPercent, 0)),
              markPrice: new Decimal(currentPrice),
              unrealizedPnl: new Decimal(unrealizedPnl),
              lastSyncAt: new Date(),
            },
          });
        } else {
          // 仅更新标记价格和未实现盈亏
          await this.prisma.position.update({
            where: { id: pos.id },
            data: {
              markPrice: new Decimal(currentPrice),
              unrealizedPnl: new Decimal(unrealizedPnl),
              lastSyncAt: new Date(),
            },
          });
        }

        // 回撤检查：曾盈利 >5% 且从高水位回撤 ≥40%
        if (currentHWM !== null && currentHWM > 5) {
          const drawdownFromPeak =
            (currentHWM - pnlPercent) / currentHWM;

          if (drawdownFromPeak >= 0.4) {
            this.logger.warn(
              `[AI监控] 盈利保护触发: ${pos.symbol} ${pos.side} 高水位 ${currentHWM.toFixed(1)}%，当前 ${pnlPercent.toFixed(1)}%，回撤 ${(drawdownFromPeak * 100).toFixed(1)}%`,
            );

            await this.autoClosePosition(
              pos,
              `盈利保护：从最高点 ${currentHWM.toFixed(1)}% 回撤至 ${pnlPercent.toFixed(1)}%（回撤 ${(drawdownFromPeak * 100).toFixed(0)}% ≥ 40%）`,
              currentPrice,
            );
            closedCount++;
          }
        }
      } catch (error) {
        this.logger.warn(
          `[AI监控] 检查持仓 ${pos.id} 出错: ${error.message}`,
        );
      }
    }

    if (closedCount > 0) {
      this.logger.log(
        `[AI监控] 检查完成: ${positions.length} 个持仓，${closedCount} 个触发盈利保护`,
      );
    }

    return { checked: positions.length, closed: closedCount };
  }

  /**
   * 自动平仓
   */
  private async autoClosePosition(
    pos: {
      id: string;
      userId: string;
      apiKeyId: string | null;
      symbol: string;
      side: string;
      entryPrice: any;
      amount: any;
    },
    reason: string,
    currentPrice: number,
  ): Promise<void> {
    if (!pos.apiKeyId) return;

    const closeSide = pos.side === 'long' ? 'sell' : 'buy';
    const config: TradingConfig = {
      tradingType: 'futures',
      leverage: 1,
      marginMode: 'cross',
      slippageTolerance: 0.5,
      maxRetries: 2,
      retryDelayMs: 1000,
    };

    try {
      const result = await this.tradingService.executeOrder(
        pos.userId,
        pos.apiKeyId,
        pos.symbol,
        closeSide as 'buy' | 'sell',
        parseFloat(pos.amount.toString()),
        config,
      );

      const exitPrice = result.price || currentPrice;
      const entryPrice = parseFloat(pos.entryPrice.toString());
      const amount = parseFloat(pos.amount.toString());
      let pnl: number;

      if (pos.side === 'long') {
        pnl = (exitPrice - entryPrice) * amount;
      } else {
        pnl = (entryPrice - exitPrice) * amount;
      }

      await this.prisma.position.update({
        where: { id: pos.id },
        data: {
          status: 'closed',
          exitPrice: new Decimal(exitPrice),
          realizedPnl: new Decimal(pnl),
          closedAt: new Date(),
          closeReason: 'trailing_stop',
        },
      });

      this.logger.log(
        `[AI监控] 自动平仓成功: ${pos.id} ${pos.symbol} ${pos.side} PnL: ${pnl > 0 ? '+' : ''}${pnl.toFixed(4)} USDT，原因: ${reason}`,
      );

      // 推送 TG 风控告警通知（fire-and-forget）
      this.sendTgDrawdownAlert(pos.userId, pos.symbol, reason).catch(() => {});
    } catch (error) {
      this.logger.error(
        `[AI监控] 自动平仓失败: ${pos.id} ${pos.symbol} - ${error.message}`,
      );
    }
  }

  /**
   * 向 TG Bot 推送回撤告警通知
   */
  private async sendTgDrawdownAlert(
    userId: string,
    symbol: string,
    reason: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true },
      });

      if (!user?.telegramId) return;

      const tgBotApiUrl = process.env.TG_BOT_API_URL || 'http://localhost:4002';
      await fetch(`${tgBotApiUrl}/notify-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          type: 'alert',
          strategyName: symbol,
          drawdown: reason,
          action: 'paused',
        }),
      });
    } catch (e) {
      this.logger.debug(`TG 回撤告警发送失败(非致命): ${(e as Error).message}`);
    }
  }
}
