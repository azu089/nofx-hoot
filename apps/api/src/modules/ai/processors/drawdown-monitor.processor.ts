import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingService } from '../../trading/trading.service';
import { FeeService } from '../../trading/fee.service';
import { AdapterFactoryService } from '../../exchange-adapters/adapter-factory.service';
import { ExchangeAdapter } from '../../exchange-adapters/types/adapter.interface';
import { Decimal } from '@prisma/client/runtime/library';
import { isSameSymbol } from '../../../common/utils/symbol.util';
import { TradingGateway } from '../../../gateways/trading.gateway';

/**
 * AI 持仓回撤监控处理器（已精简为兜底同步）
 *
 * Phase 3 重构：Peak-Drawdown / 绝对亏损保护已迁移到 PriceWatchService（WebSocket 实时）
 *
 * 当前职责（30s 轮询兜底）：
 * 1. 检测 not_found_on_exchange — 交易所 SL/TP 条件单触发后，DB 未同步 → 标记 closed
 * 2. 同步实时数据到 DB（markPrice / unrealizedPnl / amount / margin）
 *
 * 不再负责：
 * - 峰值回撤平仓（PriceWatchService 实时触发）
 * - 绝对亏损平仓（PriceWatchService 实时触发）
 */
@Processor('ai-monitor')
export class DrawdownMonitorProcessor extends WorkerHost {
  private readonly logger = new Logger(DrawdownMonitorProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TradingService))
    private readonly tradingService: TradingService,
    @Optional() private readonly adapterFactory?: AdapterFactoryService,
    @Optional() private readonly tradingGateway?: TradingGateway,
    @Optional() private readonly feeService?: FeeService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ checked: number; closed: number }> {
    this.logger.debug('[AI监控] 开始检查 AI 持仓回撤...');
    this.logger.warn('[AI监控] process() 进入');

    // 查询所有 AI 来源的开放持仓（排除网格策略 — 网格有自己的 hardStopLoss 机制）
    let gridStrategyIds: string[] = [];
    try {
      gridStrategyIds = await this.prisma.aiStrategy.findMany({
        where: { strategyType: 'grid' },
        select: { id: true },
      }).then(rows => rows.map(r => r.id));
    } catch (e: any) {
      this.logger.error(`[AI监控] 查询 grid 策略失败: ${e.message}`);
    }

    let positions: any[];
    try {
      positions = await this.prisma.position.findMany({
        where: {
          status: 'open',
          source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
          // 封印：排除网格策略的持仓，网格有独立的止损/风控机制
          ...(gridStrategyIds.length > 0 ? { aiStrategyId: { notIn: gridStrategyIds } } : {}),
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
          peakPnlPercent: true,
          leverage: true,
          aiStrategyId: true,
          exchange: true,
          source: true,
          exchangeRef: true,
        },
      });
    } catch (e: any) {
      this.logger.error(`[AI监控] 查询 open 持仓失败: ${e.message}`);
      return { checked: 0, closed: 0 };
    }

    this.logger.warn(`[AI监控] 查到 ${positions.length} 个 open 持仓: ${positions.map(p => `${p.symbol}:${p.side}`).join(', ')}`);
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
    // adapter 缓存：复用给后续 autoClosePosition（生命周期由 factory 管理，不 dispose）
    const exchangePosCache = new Map<string, any[]>();
    const adapterCache = new Map<string, ExchangeAdapter>();
    if (this.adapterFactory) {
      const keys = [...new Set(positions.filter(p => p.apiKeyId).map(p => `${p.userId}:${p.apiKeyId}`))];
      for (const key of keys) {
        const [userId, apiKeyId] = key.split(':');
        try {
          const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
          adapterCache.set(key, adapter);
          const eps = await adapter.getPositions();
          exchangePosCache.set(key, eps as any);
        } catch (e: any) {
          this.logger.warn(`[AI监控] 获取交易所持仓失败(${key.slice(0, 16)}): ${e.message}`);
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
          this.logger.warn(`[AI监控] DB持仓 ${pos.symbol} ${pos.side} vs 交易所 ${exchangePositions.length} 个: [${exchangePositions.map((e: any) => `${e.symbol}:${e.side}`).join(', ')}]`);
          const ep = exchangePositions.find(
            (e: any) => isSameSymbol(e.symbol, pos.symbol) && e.side === pos.side,
          );
          if (ep) {
            liveAmount = ep.quantity;
            liveMargin = ep.margin;
            liveMarkPrice = ep.markPrice;
            liveUnrealizedPnl = ep.unrealizedPnl;
          } else {
            // 对齐 nofx OrderSync: 交易所已平仓（SL/TP 条件单触发），标记 DB closed
            await this.prisma.position.update({
              where: { id: pos.id },
              data: {
                status: 'closed',
                closedAt: new Date(),
                closeReason: 'not_found_on_exchange',
              },
            });
            this.logger.warn(
              `[AI监控] ${pos.symbol} ${pos.side} 交易所已无持仓（SL/TP 条件单触发），标记 closed`,
            );
            closedCount++;
            continue;
          }
        }

        // 同步实时数据到 DB（markPrice / unrealizedPnl / amount / margin）
        // WS 每 5s 落盘，此处 30s 兜底确保数据不丢失
        if (liveMarkPrice && liveMarkPrice > 0) {
          const entryPrice = Number(pos.entryPrice);
          const amount = liveAmount ?? Number(pos.amount);
          const margin = liveMargin ?? Number(pos.margin || 0);
          const unrealizedPnl = liveUnrealizedPnl ?? (
            pos.side === 'long'
              ? (liveMarkPrice - entryPrice) * amount
              : (entryPrice - liveMarkPrice) * amount
          );
          const pnlPercent = margin > 0 ? (unrealizedPnl / margin) * 100 : 0;

          const updateData: any = {
            markPrice: new Decimal(liveMarkPrice),
            unrealizedPnl: new Decimal(unrealizedPnl),
            lastSyncAt: new Date(),
          };
          if (liveAmount !== undefined) updateData.amount = new Decimal(liveAmount);
          if (liveMargin !== undefined) updateData.margin = new Decimal(liveMargin);

          // 更新高水位（仅当有新高时写入，不覆盖 WS 已写入的值）
          const currentHWM = pos.highWaterMark ? Number(pos.highWaterMark) : null;
          if (pnlPercent > 0 && (currentHWM === null || pnlPercent > currentHWM)) {
            updateData.highWaterMark = new Decimal(pnlPercent);
          }

          await this.prisma.position.update({ where: { id: pos.id }, data: updateData });
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

  // [已删除] checkScaleOut 分批止盈 — 与交易所 TP 条件单冲突 + AI 不知情会补仓循环
  // 止盈由 AI 决策（close_long/close_short）+ 交易所 TP 条件单负责

  /**
   * Peak-Drawdown 紧急平仓检测（对齐 nofx auto_trader_risk.go:checkPositionDrawdown）
   *
   * 规则：当前盈利 > 5% 且从峰值回撤 >= 40% → 紧急全平
   * 公式：drawdownPct = (peakPnLPct - currentPnLPct) / peakPnLPct * 100
   *
   * @returns true = 触发紧急平仓
   */
  private async checkPeakDrawdown(
    pos: {
      id: string;
      userId: string;
      apiKeyId: string | null;
      symbol: string;
      side: string;
      entryPrice: any;
      amount: any;
      peakPnlPercent?: any;
    },
    currentPnlPct: number,
    currentPrice: number,
    unrealizedPnl: number,
    existingAdapter?: ExchangeAdapter,
    riskConfig?: any,
  ): Promise<boolean> {
    if (!pos.apiKeyId) return false;

    // 从 DB 恢复峰值（持久化，进程重启安全）
    const storedPeak = pos.peakPnlPercent ? Number(pos.peakPnlPercent) : null;
    const peakPnlPct = storedPeak !== null ? Math.max(storedPeak, currentPnlPct) : currentPnlPct;

    // 更新峰值到 DB（仅当新高时写入）
    if (storedPeak === null || currentPnlPct > storedPeak) {
      await this.prisma.position.update({
        where: { id: pos.id },
        data: { peakPnlPercent: new Decimal(currentPnlPct) },
      });
    }

    // 从策略配置读取参数，默认值对齐 nofx（盈利>5% 且回撤≥40%）
    const peakProfitThreshold = riskConfig?.peakProfitThreshold ?? 5.0;
    const peakDrawdownThreshold = riskConfig?.peakDrawdownThreshold ?? 40.0;

    // 检查触发条件：只要峰值曾超过阈值，无论当前盈亏如何都继续检查回撤
    // Bug fix: 原来用 currentPnlPct 判断，当价格快速回落时 currentPnl 立刻低于阈值导致保护永久失效
    // 正确逻辑：用 peakPnlPct（历史最高盈利）判断，峰值达标则始终检查回撤
    if (peakPnlPct <= peakProfitThreshold || peakPnlPct <= 0) return false;

    const drawdownPct = ((peakPnlPct - currentPnlPct) / peakPnlPct) * 100;

    if (drawdownPct >= peakDrawdownThreshold) {
      this.logger.warn(
        `[AI监控] Peak-Drawdown 紧急平仓触发: ${pos.symbol} ${pos.side} | 当前盈利: ${currentPnlPct.toFixed(2)}% | 峰值: ${peakPnlPct.toFixed(2)}% | 回撤: ${drawdownPct.toFixed(2)}% (阈值: 盈利>${peakProfitThreshold}% 回撤≥${peakDrawdownThreshold}%)`,
      );

      await this.autoClosePosition(
        pos,
        `Peak-Drawdown 紧急平仓：盈利 ${currentPnlPct.toFixed(1)}%，峰值 ${peakPnlPct.toFixed(1)}%，回撤 ${drawdownPct.toFixed(1)}% (阈值: >${peakProfitThreshold}%/≥${peakDrawdownThreshold}%)`,
        currentPrice,
        'peak_drawdown',
        existingAdapter,
      );

      return true;
    }

    // 接近触发时记录调试日志（盈利>5% 且回撤>20%）
    if (drawdownPct > 20.0) {
      this.logger.debug(
        `[AI监控] Peak-Drawdown 监控: ${pos.symbol} ${pos.side} | 盈利: ${currentPnlPct.toFixed(2)}% | 峰值: ${peakPnlPct.toFixed(2)}% | 回撤: ${drawdownPct.toFixed(2)}%`,
      );
    }

    return false;
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
    closeReason: string = 'trailing_stop',
    existingAdapter?: ExchangeAdapter,
  ): Promise<void> {
    if (!pos.apiKeyId) return;

    if (!existingAdapter && !this.adapterFactory) {
      this.logger.warn('[AI监控] 自动平仓: 无可用 adapter，跳过');
      return;
    }

    const ownsAdapter = !existingAdapter;
    let adapter: ExchangeAdapter | undefined = existingAdapter;
    try {
      if (!adapter) adapter = await this.adapterFactory!.createAdapter(pos.userId, pos.apiKeyId);
      // CCXT adapter 不支持 0=平全部，使用 DB 数量
      const closeAmount = parseFloat(pos.amount.toString());
      let result;
      if (pos.side === 'long') {
        result = await adapter.closeLong(pos.symbol, closeAmount);
      } else {
        result = await adapter.closeShort(pos.symbol, closeAmount);
      }

      const entryPrice = parseFloat(pos.entryPrice.toString());
      const amount = parseFloat(pos.amount.toString());

      // 1. exitPrice 优先级：交易所实际成交均价 > 从 realizedPnl 反推 > 下单前标记价（最不准确）
      let exitPrice = result.avgPrice || 0;
      if (exitPrice <= 0 && result.realizedPnl !== undefined) {
        // 从交易所返回的 realizedPnl 反推成交价，避免用标记价产生偏差
        exitPrice = pos.side === 'long'
          ? entryPrice + result.realizedPnl / amount
          : entryPrice - result.realizedPnl / amount;
        this.logger.debug(`[AI监控] avgPrice=0，从 realizedPnl 反推 exitPrice=$${exitPrice.toFixed(4)}`);
      }
      if (exitPrice <= 0) {
        exitPrice = currentPrice;
        this.logger.warn(`[AI监控] avgPrice=0 且无 realizedPnl，使用标记价 $${currentPrice} 作为退出价（可能轻微偏差）`);
      }

      // 2. PnL 优先级：交易所直接返回的 realizedPnl（最准确）> 本地从价格计算
      let pnl: number;
      if (result.realizedPnl !== undefined && result.realizedPnl !== 0) {
        pnl = result.realizedPnl;
      } else if (pos.side === 'long') {
        pnl = (exitPrice - entryPrice) * amount;
      } else {
        pnl = (entryPrice - exitPrice) * amount;
      }

      await this.prisma.position.update({
        where: { id: pos.id },
        data: {
          status: 'closed',
          exitPrice: new Decimal(exitPrice),
          closePrice: new Decimal(exitPrice),   // 双写兼容：exitPrice 供前端读取，closePrice 供历史查询
          realizedPnl: new Decimal(pnl),
          closedAt: new Date(),
          closeReason,
          peakPnlPercent: null, // 对齐 nofx ClearPeakPnLCache：平仓后清除峰值
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

      // 对齐 nofx CloseLong/CloseShort: 平仓后清理 SL/TP 条件单（Algo+普通）
      try { await adapter!.cancelStopOrders(pos.symbol); } catch { /* 非致命 */ }

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
      // adapter 生命周期由 factory 管理，不 dispose
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
