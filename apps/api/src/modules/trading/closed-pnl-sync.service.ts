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
  ): Promise<{ synced: number; deleted: number; charged: number; balanceDepleted: boolean; incomePnl24h: number; incomePnlToday: number }> {
    // ─── Step 0: 从 income API 拿准确 PnL（不依赖仓位重建）───
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 北京时间今天零点
    const UTC8_OFFSET = 8 * 60 * 60 * 1000;
    const nowUtc8 = Date.now() + UTC8_OFFSET;
    const todayStartUtc8 = nowUtc8 - (nowUtc8 % (24 * 60 * 60 * 1000));
    const todayStart = new Date(todayStartUtc8 - UTC8_OFFSET);

    let incomePnl24h = 0;
    let incomePnlToday = 0;
    try {
      incomePnl24h = await adapter.getIncomePnl(since);
      incomePnlToday = await adapter.getIncomePnl(todayStart);
    } catch (e: any) {
      this.logger.debug(`[历史持仓同步] getIncomePnl 失败(非致命): ${e.message}`);
    }

    // ─── Step 1: 从交易所拉取已平仓记录 ───
    let exchangeRecords;
    try {
      exchangeRecords = await adapter.getClosedPnl(since, 100);
    } catch (e: any) {
      this.logger.warn(`[历史持仓同步] 拉取失败(非致命): ${e.message}`);
      return { synced: 0, deleted: 0, charged: 0, balanceDepleted: false, incomePnl24h, incomePnlToday };
    }

    if (!exchangeRecords || exchangeRecords.length === 0) {
      return { synced: 0, deleted: 0, charged: 0, balanceDepleted: false, incomePnl24h, incomePnlToday };
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
          openedAt: (record.entryTime && !isNaN(record.entryTime.getTime())) ? record.entryTime : undefined,
          closedAt: (record.exitTime && !isNaN(record.exitTime.getTime())) ? record.exitTime : new Date(),
          closePrice: record.exitPrice || 0,
          pnl: record.realizedPnl || 0,
          realizedPnl: record.realizedPnl || 0,
          // Binance getClosedPnl 不返回平仓原因，hardcode 'manual' 不准确
          // 如果匹配到 AI 策略，用 'exchange_close'；否则用 adapter 返回的 closeType
          closeReason: strategy ? 'exchange_close' : (record.closeType || 'unknown'),
          source: strategy ? 'ai_strategy' : 'exchange_sync',
          aiStrategyId: strategy?.id || null,
          apiKeyId,
          exchangeRef,
        };

        // 防重复：先检查是否已有 AI 记录（open 或 closed，exchangeRef=null）
        // AI 开仓创建的记录 status=open，AI/SL/TP 平仓后变 closed，都需要匹配
        const closedAtTime = posData.closedAt instanceof Date ? posData.closedAt : new Date(posData.closedAt);
        const existingAiPos = await this.prisma.position.findFirst({
          where: {
            userId,
            symbol: record.symbol,
            side: posData.side,
            exchangeRef: null,
            source: 'ai_strategy',
            OR: [
              // 已平仓：closedAt ±30 分钟窗口内匹配
              {
                status: 'closed',
                closedAt: {
                  gte: new Date(closedAtTime.getTime() - 30 * 60 * 1000),
                  lte: new Date(closedAtTime.getTime() + 30 * 60 * 1000),
                },
              },
              // 未平仓：AI 开的仓还没被 AI 平（手动/SL/TP 触发），createdAt 在平仓时间之前
              {
                status: 'open',
                createdAt: { lte: closedAtTime },
              },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        let position;
        if (existingAiPos) {
          // 关联 exchangeRef 到已有 AI 记录，补充交易所数据
          // 如果是 open 状态，同时更新为 closed（手动平仓/SL/TP 触发的情况）
          const isOpenPos = existingAiPos.status === 'open';
          position = await this.prisma.position.update({
            where: { id: existingAiPos.id },
            data: {
              exchangeRef,
              closePrice: posData.closePrice || existingAiPos.closePrice,
              ...(!existingAiPos.exitPrice && record.exitPrice ? { exitPrice: record.exitPrice } : {}),
              // open → closed: 补充平仓信息
              ...(isOpenPos ? {
                status: 'closed',
                closedAt: posData.closedAt,
                realizedPnl: posData.realizedPnl,
                pnl: posData.pnl,
                closeReason: posData.closeReason || 'exchange_close',
                entryPrice: posData.entryPrice || existingAiPos.entryPrice, // 交易所均价更准
              } : {}),
              // 补充开仓时间（如果原记录没有）
              ...(!existingAiPos.openedAt && posData.openedAt ? { openedAt: posData.openedAt } : {}),
            },
          });
          this.logger.debug(
            `[历史持仓同步] ${isOpenPos ? '关闭+' : ''}关联 AI 记录: ${record.symbol} ${posData.side} → ${existingAiPos.id}` +
            (isOpenPos ? ' (open→closed)' : ''),
          );
        } else {
          // upsert: 存在则更新价格/PnL（交易所可能修正），不存在则创建
          position = await this.prisma.position.upsert({
            where: { exchangeRef },
            create: posData,
            update: {
              entryPrice: posData.entryPrice,
              closePrice: posData.closePrice,
              amount: posData.amount,
              pnl: posData.pnl,
              realizedPnl: posData.realizedPnl,
              closedAt: posData.closedAt,
              aiStrategyId: strategy?.id || null,
              source: strategy ? 'ai_strategy' : 'exchange_sync',
            },
          });
        }
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

    return { synced, deleted: 0, charged, balanceDepleted, incomePnl24h, incomePnlToday };
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
      // Grid 策略：活跃的才精确匹配（已停用的 grid 不抢占新交易）
      const gc = s.gridConfig as any;
      if (s.isActive && gc?.symbol && norm(gc.symbol) === normSymbol) return { id: s.id, name: s.name };

      // 固定币种策略：活跃的才匹配
      const cc = s.coinSourceConfig as any;
      const coins: string[] = cc?.coins || [];
      if (s.isActive && coins.length > 0 && coins.some(c => norm(c) === normSymbol)) return { id: s.id, name: s.name };

      // AI 自动选币策略（mode=ai, coins 为空）：活跃的作为兜底
      if (s.isActive && cc?.mode === 'ai' && coins.length === 0 && !aiModeStrategy) {
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
