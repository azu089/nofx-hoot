import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeeService } from './fee.service';
import { ReferralService } from '../referral/referral.service';
import { Decimal } from '@prisma/client/runtime/library';
import type { ExchangeAdapter } from '../exchange-adapters/types/adapter.interface';

/**
 * 交易所历史持仓同步服务 v2（upsert 模式）
 *
 * 核心原则：
 *   1. exchangeRef = 交易所原生 ID → 永不变 → 1:1 对应交易所仓位历史
 *   2. Position 用 upsert（不再 delete+insert）→ 不丢数据
 *   3. GAS uniqueOrderId = "GAS_{exchangeRef}" → 和 position 1:1 → 永不重复
 *
 * exchangeRef 来源：
 *   - OKX:     okx_{posId}                        ← 原生 API
 *   - Bybit:   bybit_{orderId}                    ← 原生 API
 *   - Binance: binance_{SYMBOL}_{side}_{tradeId}  ← 首笔平仓 tradeId（确定性）
 *   - Gate:    gate_{SYMBOL}_{side}_{tradeId}     ← 同 Binance 算法
 */
@Injectable()
export class ClosedPnlSyncService {
  private readonly logger = new Logger(ClosedPnlSyncService.name);

  constructor(
    private prisma: PrismaService,
    private feeService: FeeService,
    @Optional() private referralService?: ReferralService,
  ) {}

  /**
   * 同步某用户某 apiKey 的已平仓记录
   * 在策略主循环周期末尾调用，失败不影响策略运行
   */
  async syncClosedPositions(
    userId: string,
    apiKeyId: string,
    exchange: string,
    adapter: ExchangeAdapter,
  ): Promise<{ synced: number; deleted: number; charged: number; balanceDepleted: boolean }> {
    // ─── Step 1: 从交易所拉取已平仓记录 ───
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let exchangeRecords;
    try {
      exchangeRecords = await adapter.getClosedPnl(since, 100);
    } catch (e: any) {
      this.logger.warn(`[历史持仓同步] 拉取失败(非致命): ${e.message}`);
      return { synced: 0, deleted: 0, charged: 0, balanceDepleted: false };
    }

    if (!exchangeRecords || exchangeRecords.length === 0) {
      return { synced: 0, deleted: 0, charged: 0, balanceDepleted: false };
    }

    // 去重（同一 exchangeId 只取最新）
    const exchangeMap = new Map<string, typeof exchangeRecords[0]>();
    for (const r of exchangeRecords) {
      if (r.exchangeId) exchangeMap.set(r.exchangeId, r);
    }

    this.logger.debug(`[历史持仓同步] 交易所返回 ${exchangeMap.size} 条有效记录 (exchange=${exchange})`);

    // ─── Step 2: Upsert 每条记录 ───
    let synced = 0;
    let charged = 0;
    let balanceDepleted = false;

    for (const [exchangeRef, record] of exchangeMap) {
      try {
        const strategy = await this.matchStrategy(userId, apiKeyId, record.symbol);

        const posData = {
          userId,
          exchange,
          symbol: record.symbol,
          side: record.side || 'long',
          entryPrice: record.entryPrice || 0,
          amount: record.quantity || 0,
          tradingType: 'futures' as const,
          leverage: record.leverage || 1,
          status: 'closed' as const,
          closedAt: (record.exitTime && !isNaN(record.exitTime.getTime())) ? record.exitTime : new Date(),
          closePrice: record.exitPrice || 0,
          pnl: record.realizedPnl || 0,
          realizedPnl: record.realizedPnl || 0,
          closeReason: record.closeType || 'unknown',
          source: strategy ? 'ai_strategy' : 'exchange_sync',
          aiStrategyId: strategy?.id || null,
          apiKeyId,
          exchangeRef,
        };

        // upsert: 存在则更新价格/PnL（交易所可能修正），不存在则创建
        const position = await this.prisma.position.upsert({
          where: { exchangeRef },
          create: posData,
          update: {
            entryPrice: posData.entryPrice,
            closePrice: posData.closePrice,
            amount: posData.amount,
            pnl: posData.pnl,
            realizedPnl: posData.realizedPnl,
            closedAt: posData.closedAt,
            // 如果之前没匹配到策略但现在匹配到了，更新
            ...(strategy ? { aiStrategyId: strategy.id, source: 'ai_strategy' } : {}),
          },
        });
        synced++;

        // ─── Step 3: 盈利 → GAS 扣费（幂等，uniqueOrderId = GAS_{exchangeRef}）───
        if (record.realizedPnl > 0 && strategy) {
          try {
            const feeCalc = await this.feeService.calculateFee(userId, record.realizedPnl.toFixed(8));
            if (parseFloat(feeCalc.feeAmount) > 0) {
              const uniqueOrderId = `GAS_${exchangeRef}`;
              const feeResult = await this.feeService.chargeFee({
                userId,
                positionId: position.id,
                profit: feeCalc.profit,
                feeRate: feeCalc.finalFeeRate,
                feeAmount: feeCalc.feeAmount,
                uniqueOrderId,
                strategyName: strategy.name || record.symbol,
              });
              charged++;
              if (feeResult.balanceDepleted) balanceDepleted = true;

              // GAS 扣费成功 → 触发上级返佣
              if (feeResult.ok && parseFloat(feeResult.actualDeduction) > 0) {
                await this.processReferralCommission(userId, position.id, feeResult.actualDeduction);
              }
            }
          } catch (feeErr: any) {
            // 幂等保护：P2002 = 已扣过，静默跳过
            if (feeErr?.code === 'P2002') continue;
            this.logger.warn(`[历史持仓同步] 扣费失败(非致命): ${record.symbol} pnl=${record.realizedPnl} err=${feeErr.message}`);
          }
        }
      } catch (e: any) {
        if (e?.code === 'P2002') continue; // upsert 并发冲突，静默跳过
        this.logger.warn(`[历史持仓同步] 写入失败(非致命): ${record.symbol} ref=${exchangeRef} err=${e.message}`);
      }
    }

    // ─── 汇总（不再有 cleanup 删除逻辑）───
    if (synced > 0) {
      this.logger.log(`[历史持仓同步] 完成: upsert=${synced}, 扣费=${charged}, 交易所=${exchangeMap.size}`);
    }

    // GAS 余额不足 → 停止所有策略
    if (balanceDepleted) {
      this.logger.warn(`[历史持仓同步] GAS余额不足，停止用户 ${userId} 所有活跃策略`);
      await this.prisma.aiStrategy.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    return { synced, deleted: 0, charged, balanceDepleted };
  }

  /**
   * 匹配策略：userId + apiKeyId + symbol
   *
   * 匹配优先级：
   * 1. Grid 策略：gridConfig.symbol 精确匹配
   * 2. 固定币种策略：coinSourceConfig.coins 包含该 symbol
   * 3. AI 自动选币策略（mode=ai, coins 为空）：兜底匹配（该 apiKey 下唯一活跃策略）
   */
  private async matchStrategy(
    userId: string,
    apiKeyId: string,
    symbol: string,
  ): Promise<{ id: string; name: string } | null> {
    const norm = (s: string) => s?.replace(/:[\w]+$/, '') || s;
    const normSymbol = norm(symbol);

    const strategies = await this.prisma.aiStrategy.findMany({
      where: { userId, exchangeApiKeyId: apiKeyId },
      select: { id: true, name: true, isActive: true, gridConfig: true, coinSourceConfig: true },
      orderBy: { isActive: 'desc' },
    });

    let aiModeStrategy: { id: string; name: string } | null = null;

    for (const s of strategies) {
      // Grid 策略：symbol 精确匹配
      const gc = s.gridConfig as any;
      if (gc?.symbol && norm(gc.symbol) === normSymbol) return { id: s.id, name: s.name };

      // 固定币种策略：coins 列表匹配
      const cc = s.coinSourceConfig as any;
      const coins: string[] = cc?.coins || [];
      if (coins.length > 0 && coins.some(c => norm(c) === normSymbol)) return { id: s.id, name: s.name };

      // AI 自动选币策略（mode=ai, coins 为空）：记录为兜底
      if (cc?.mode === 'ai' && coins.length === 0 && !aiModeStrategy) {
        aiModeStrategy = { id: s.id, name: s.name };
      }
    }

    // 没有精确匹配时，返回 AI 自动选币策略作为兜底
    return aiModeStrategy;
  }

  /**
   * GAS 扣费后触发上级返佣
   * 返佣基数 = 实际扣除的 GAS 费用（非应扣金额）
   */
  private async processReferralCommission(
    userId: string,
    positionId: string,
    feeAmount: string,
  ): Promise<void> {
    try {
      if (!this.referralService) return;

      const fee = new Decimal(feeAmount);
      if (fee.lte(0)) return;

      const config = await this.prisma.referralConfig.findUnique({
        where: { id: 'default' },
      });
      if (!config || !config.isActive) return;

      const enabledTypes = config.enabledTypes as string[];
      if (!enabledTypes.includes('trading')) return;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { invitedBy: true },
      });
      if (!user?.invitedBy) return;

      const levels: Array<{ inviterId: string; rate: Decimal; level: number }> = [
        { inviterId: user.invitedBy, rate: new Decimal(config.level1Rate.toString()).div(100), level: 1 },
      ];

      const level1User = await this.prisma.user.findUnique({
        where: { id: user.invitedBy },
        select: { invitedBy: true },
      });
      if (level1User?.invitedBy) {
        levels.push({
          inviterId: level1User.invitedBy,
          rate: new Decimal(config.level2Rate.toString()).div(100),
          level: 2,
        });
      }

      for (const { inviterId, rate, level } of levels) {
        const commission = fee.times(rate);
        if (commission.lte(0)) continue;

        const uniqueOrderId = `ref_${inviterId}_gas_${positionId}_L${level}`;

        const existing = await this.prisma.referralReward.findUnique({
          where: { uniqueOrderId },
        });
        if (existing) continue;

        await this.prisma.$transaction(async (tx) => {
          await tx.referralReward.create({
            data: {
              userId: inviterId,
              fromUserId: userId,
              type: 'trading',
              amount: commission,
              asset: 'USDT',
              uniqueOrderId,
              status: 'paid',
            },
          });

          await tx.user.update({
            where: { id: inviterId },
            data: { usdtBalance: { increment: commission } },
          });

          await tx.transaction.create({
            data: {
              userId: inviterId,
              type: 'referral',
              asset: 'USDT',
              amount: commission,
              uniqueOrderId: `referral_pay_${uniqueOrderId}`,
              status: 'completed',
              remark: `L${level}邀请返佣 - GAS费 ${feeAmount} × ${rate.times(100)}%`,
            },
          });
        });

        this.logger.log(
          `[返佣] L${level}: ${inviterId} 从 ${userId} 获得 ${commission.toFixed(8)} USDT（GAS ${feeAmount} × ${rate.times(100)}%）`,
        );
      }
    } catch (error: any) {
      this.logger.warn(`[返佣] 处理失败(非致命): ${error.message}`);
    }
  }
}
