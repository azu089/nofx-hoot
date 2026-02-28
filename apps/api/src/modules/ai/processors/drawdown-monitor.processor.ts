import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingService, TradingConfig } from '../../trading/trading.service';
import { AdapterFactoryService } from '../../exchange-adapters/adapter-factory.service';
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
    @Optional() private readonly adapterFactory?: AdapterFactoryService,
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
        leverage: true,
        aiStrategyId: true,
      },
    });

    if (positions.length === 0) {
      return { checked: 0, closed: 0 };
    }

    // 批量加载关联策略的风控配置（利润回撤保护阈值）
    const strategyIds = [...new Set(positions.map(p => p.aiStrategyId).filter(Boolean))] as string[];
    const strategyConfigMap = new Map<string, any>();
    if (strategyIds.length > 0) {
      const strategies = await this.prisma.aiStrategy.findMany({
        where: { id: { in: strategyIds } },
        select: { id: true, riskControlConfig: true },
      });
      for (const s of strategies) {
        strategyConfigMap.set(s.id, s.riskControlConfig);
      }
    }

    // 按用户+APIKey 分组获取交易所持仓（批量，减少 API 调用次数）
    const exchangePosCache = new Map<string, any[]>();
    if (this.adapterFactory) {
      const keys = [...new Set(positions.filter(p => p.apiKeyId).map(p => `${p.userId}:${p.apiKeyId}`))];
      for (const key of keys) {
        const [userId, apiKeyId] = key.split(':');
        try {
          const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
          const eps = await adapter.getPositions();
          exchangePosCache.set(key, eps as any);
        } catch (e: any) {
          this.logger.debug(`[AI监控] 获取交易所持仓失败(${key.slice(0, 16)}): ${e.message}`);
        }
      }
    }

    let closedCount = 0;

    for (const pos of positions) {
      try {
        if (!pos.apiKeyId) continue;

        // 从缓存获取该用户的交易所持仓，更新 amount/margin
        const cacheKey = `${pos.userId}:${pos.apiKeyId}`;
        const exchangePositions = exchangePosCache.get(cacheKey) as any[] | undefined;
        let liveAmount: number | undefined;
        let liveMargin: number | undefined;
        let liveMarkPrice: number | undefined;
        let liveUnrealizedPnl: number | undefined;

        if (exchangePositions) {
          const ep = exchangePositions.find(
            (e: any) => isSameSymbol(e.symbol, pos.symbol) && e.side === pos.side,
          );
          if (ep) {
            liveAmount = ep.quantity;
            liveMargin = ep.margin;
            liveMarkPrice = ep.markPrice;
            liveUnrealizedPnl = ep.unrealizedPnl;
          }
        }

        // 获取当前价格（优先用 exchange 持仓里的 markPrice，fallback 到单独查价）
        const currentPrice = liveMarkPrice || await this.tradingService.getCurrentPrice(
          pos.userId,
          pos.apiKeyId,
          pos.symbol,
        );

        if (!currentPrice || currentPrice <= 0) continue;

        // 以交易所实时数据为准，fallback 到 DB 数据
        const entryPrice = Number(pos.entryPrice);
        const amount = liveAmount ?? Number(pos.amount);
        const margin = liveMargin ?? Number(pos.margin || 0);

        if (entryPrice <= 0 || margin <= 0) continue;

        const unrealizedPnl = liveUnrealizedPnl ?? (
          pos.side === 'long'
            ? (currentPrice - entryPrice) * amount
            : (entryPrice - currentPrice) * amount
        );
        const pnlPercent = (unrealizedPnl / margin) * 100;

        // 更新高水位
        const currentHWM = pos.highWaterMark ? Number(pos.highWaterMark) : null;
        const baseUpdateData: any = {
          markPrice: new Decimal(currentPrice),
          unrealizedPnl: new Decimal(unrealizedPnl),
          lastSyncAt: new Date(),
        };
        // 同步交易所的实时 amount 和 margin（若获取到）
        if (liveAmount !== undefined) baseUpdateData.amount = new Decimal(liveAmount);
        if (liveMargin !== undefined) baseUpdateData.margin = new Decimal(liveMargin);

        if (currentHWM === null || pnlPercent > currentHWM) {
          await this.prisma.position.update({
            where: { id: pos.id },
            data: {
              highWaterMark: new Decimal(Math.max(pnlPercent, 0)),
              ...baseUpdateData,
            },
          });
        } else {
          await this.prisma.position.update({
            where: { id: pos.id },
            data: baseUpdateData,
          });
        }

        // 绝对亏损保护：不依赖高水位，当前亏损超过阈值直接平仓
        // 高杠杆（≥5x）收紧到 -20%，低杠杆维持 -30%（减少高杠杆滑动窗口风险）
        const lev = (pos as any).leverage ?? 1;
        const ABSOLUTE_LOSS_THRESHOLD = lev >= 5 ? -20 : -30;
        if (pnlPercent < ABSOLUTE_LOSS_THRESHOLD) {
          this.logger.warn(
            `[AI监控] 绝对亏损保护触发: ${pos.symbol} ${pos.side} 亏损 ${pnlPercent.toFixed(1)}% < ${ABSOLUTE_LOSS_THRESHOLD}% (杠杆 ${lev}x)`,
          );
          await this.autoClosePosition(
            pos,
            `绝对亏损保护：当前亏损 ${pnlPercent.toFixed(1)}% 超过 ${ABSOLUTE_LOSS_THRESHOLD}% 阈值 (杠杆 ${lev}x)`,
            currentPrice,
          );
          closedCount++;
          continue; // 跳过高水位检查
        }

        // 盈利保护回撤检查：使用策略级配置（fallback 默认 5%/40%）
        const rc = pos.aiStrategyId ? strategyConfigMap.get(pos.aiStrategyId) : null;
        const pdEnabled = (rc as any)?.profitDrawdownEnabled !== false; // 默认开启
        const pdMinProfit = (rc as any)?.profitDrawdownMinProfit || 5;
        const pdMaxRetracement = ((rc as any)?.profitDrawdownMaxRetracement || 40) / 100;

        if (pdEnabled && currentHWM !== null && currentHWM > pdMinProfit) {
          const drawdownFromPeak =
            (currentHWM - pnlPercent) / currentHWM;

          if (drawdownFromPeak >= pdMaxRetracement) {
            this.logger.warn(
              `[AI监控] 盈利保护触发: ${pos.symbol} ${pos.side} 高水位 ${currentHWM.toFixed(1)}%，当前 ${pnlPercent.toFixed(1)}%，回撤 ${(drawdownFromPeak * 100).toFixed(1)}%（阈值 ≥${pdMinProfit}% → ${(pdMaxRetracement * 100).toFixed(0)}%）`,
            );

            await this.autoClosePosition(
              pos,
              `盈利保护：从最高点 ${currentHWM.toFixed(1)}% 回撤至 ${pnlPercent.toFixed(1)}%（回撤 ${(drawdownFromPeak * 100).toFixed(0)}% ≥ ${(pdMaxRetracement * 100).toFixed(0)}%）`,
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
