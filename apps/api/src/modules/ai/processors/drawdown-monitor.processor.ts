import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingService } from '../../trading/trading.service';
import { AdapterFactoryService } from '../../exchange-adapters/adapter-factory.service';
import { ExchangeAdapter } from '../../exchange-adapters/types/adapter.interface';
import { Decimal } from '@prisma/client/runtime/library';
import { isSameSymbol } from '../../../common/utils/symbol.util';
import { TradingGateway } from '../../../gateways/trading.gateway';

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

  /** 分批止盈阶段追踪（内存，重启清零，不影响正确性） */
  private readonly scaleOutMap = new Map<string, { stage: 0 | 1 | 2; originalAmount: number }>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TradingService))
    private readonly tradingService: TradingService,
    @Optional() private readonly adapterFactory?: AdapterFactoryService,
    @Optional() private readonly tradingGateway?: TradingGateway,
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

    // 批量加载关联策略的风控配置
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
          } else {
            // 交易所持仓已加载但找不到此仓 = 已平仓，跳过（防止 -2022 ReduceOnly 无限重试）
            this.scaleOutMap.delete(pos.id);
            continue;
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

        // 分批止盈检查（pnlPercent ≥ +3% 时触发；全平后 continue 跳过追踪止损）
        const scaledOut = await this.checkScaleOut(pos, pnlPercent, currentPrice);
        if (scaledOut) {
          closedCount++;
          continue;
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

        // 注：利润回撤保护已删除（与最大回撤保护功能重复），仅保留止损检查
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
   * 分批止盈检测（对齐 nofx scale-out）
   * 阶段：+3%→平 33%、+5%→平至原 50%、+8%→全平
   * @returns true = 已全部平仓，应 continue 跳过后续止损检查
   */
  private async checkScaleOut(
    pos: {
      id: string;
      userId: string;
      apiKeyId: string | null;
      symbol: string;
      side: string;
      amount: any;
    },
    pnlPercent: number,
    currentPrice: number,
  ): Promise<boolean> {
    if (pnlPercent < 3 || !pos.apiKeyId) return false;

    const existing = this.scaleOutMap.get(pos.id);
    const entry = existing ?? { stage: 0 as const, originalAmount: Number(pos.amount) };
    if (!existing) this.scaleOutMap.set(pos.id, entry);

    const orig = entry.originalAmount;
    let closeQty = 0;
    let newStage: 0 | 1 | 2 | 3 = entry.stage;

    if (entry.stage === 0 && pnlPercent >= 3) {
      closeQty = orig * 0.33;
      newStage = 1;
    } else if (entry.stage === 1 && pnlPercent >= 5) {
      closeQty = orig * 0.17; // 原仓 50% - 已平 33% = 再平 17%
      newStage = 2;
    } else if (entry.stage === 2 && pnlPercent >= 8) {
      closeQty = Number(pos.amount); // 剩余全部
      newStage = 3;
    }

    if (closeQty <= 0) return false;

    this.logger.log(
      `[AI监控] 分批止盈: ${pos.symbol} ${pos.side} stage ${entry.stage}→${newStage} 平仓 ${closeQty.toFixed(4)} (pnl=${pnlPercent.toFixed(2)}%)`,
    );

    if (!this.adapterFactory) {
      this.logger.warn('[AI监控] 分批止盈: adapterFactory 未注入，跳过');
      return false;
    }

    let adapter: ExchangeAdapter | undefined;
    try {
      // 直接使用 adapter.closeLong/closeShort（传入 SOL 数量），
      // 避免 tradingService.executeOrder 把数量当 USDT 再除以价格导致下单量缩水 100x
      adapter = await this.adapterFactory.createAdapter(pos.userId, pos.apiKeyId);
      if (pos.side === 'long') {
        await adapter.closeLong(pos.symbol, closeQty);
      } else {
        await adapter.closeShort(pos.symbol, closeQty);
      }

      if (newStage === 3) {
        await this.prisma.position.update({
          where: { id: pos.id },
          data: {
            status: 'closed',
            closedAt: new Date(),
            closeReason: 'scale_out_complete',
            exitPrice: new Decimal(currentPrice),
          },
        });
        this.scaleOutMap.delete(pos.id);
        return true; // 全部平仓
      } else {
        entry.stage = newStage as 0 | 1 | 2;
        return false; // 部分平仓，继续持有
      }
    } catch (e: any) {
      this.logger.warn(`[AI监控] 分批止盈执行失败(stage=${entry.stage}不推进，下轮重试): ${e.message}`);
      return false;
    } finally {
      await adapter?.dispose?.();
    }
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

    if (!this.adapterFactory) {
      this.logger.warn('[AI监控] 自动平仓: adapterFactory 未注入，跳过');
      return;
    }

    let adapter: ExchangeAdapter | undefined;
    try {
      // 直接使用 adapter.closeLong/closeShort（传入 SOL 数量），
      // 避免 tradingService.executeOrder 把数量当 USDT 再除以价格导致只平一小部分
      adapter = await this.adapterFactory.createAdapter(pos.userId, pos.apiKeyId);
      const closeAmount = parseFloat(pos.amount.toString());
      let result;
      if (pos.side === 'long') {
        result = await adapter.closeLong(pos.symbol, closeAmount);
      } else {
        result = await adapter.closeShort(pos.symbol, closeAmount);
      }

      const exitPrice = result.avgPrice || currentPrice;
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

      // 推送前端 WebSocket 持仓平仓通知
      try {
        this.tradingGateway?.sendPositionUpdate(pos.userId, {
          id: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          entryPrice: pos.entryPrice.toString(),
          amount: pos.amount.toString(),
          pnl: pnl.toFixed(4),
          status: 'closed',
          action: 'closed',
        });
      } catch { /* 非致命 */ }

      this.logger.log(
        `[AI监控] 自动平仓成功: ${pos.id} ${pos.symbol} ${pos.side} PnL: ${pnl > 0 ? '+' : ''}${pnl.toFixed(4)} USDT，原因: ${reason}`,
      );

      // 推送 TG 风控告警通知（fire-and-forget）
      this.sendTgDrawdownAlert(pos.userId, pos.symbol, reason).catch(() => {});
    } catch (error) {
      this.logger.error(
        `[AI监控] 自动平仓失败: ${pos.id} ${pos.symbol} - ${error.message}`,
      );
    } finally {
      await adapter?.dispose?.();
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
