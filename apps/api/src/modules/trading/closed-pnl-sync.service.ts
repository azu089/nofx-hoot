import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeeService } from './fee.service';
import type { ExchangeAdapter } from '../exchange-adapters/types/adapter.interface';

/**
 * 交易所历史持仓同步服务（全量对齐模式）
 *
 * 核心原则：交易所是唯一真相源
 *
 * 对齐逻辑（每次调用）：
 *   1. 从交易所拉取已平仓记录 → exchangeSet
 *   2. 从 DB 查询同一 user+apiKey 的 exchangeRef 记录 → dbSet
 *   3. 交易所有、DB 没有 → INSERT（新增）
 *   4. DB 有、交易所没有 → DELETE（清理）
 *   5. 两边都有 → 不动（交易所历史不变）
 */
@Injectable()
export class ClosedPnlSyncService {
  private readonly logger = new Logger(ClosedPnlSyncService.name);

  constructor(
    private prisma: PrismaService,
    private feeService: FeeService,
  ) {}

  /**
   * 全量对齐某用户某 apiKey 的已平仓记录
   * 在策略主循环周期末尾调用，失败不影响策略运行
   */
  async syncClosedPositions(
    userId: string,
    apiKeyId: string,
    exchange: string,
    adapter: ExchangeAdapter,
  ): Promise<{ synced: number; deleted: number; charged: number; balanceDepleted: boolean }> {
    // ─── Step 1: 从交易所拉取已平仓记录 ───
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 最近 24h
    let exchangeRecords;
    try {
      exchangeRecords = await adapter.getClosedPnl(since, 100);
    } catch (e: any) {
      this.logger.debug(`[历史持仓同步] 拉取失败(非致命): ${e.message}`);
      return { synced: 0, deleted: 0, charged: 0, balanceDepleted: false };
    }

    if (!exchangeRecords || exchangeRecords.length === 0) {
      // 交易所返回空 → 清理 DB 中该 apiKey 最近 24h 的所有 exchangeRef 记录
      const deleted = await this.cleanupStaleRecords(userId, apiKeyId, since, new Set());
      return { synced: 0, deleted, charged: 0, balanceDepleted: false };
    }

    // 交易所记录集合（exchangeId → record）
    const exchangeMap = new Map<string, typeof exchangeRecords[0]>();
    for (const r of exchangeRecords) {
      if (r.exchangeId) exchangeMap.set(r.exchangeId, r);
    }

    this.logger.debug(`[历史持仓同步] 交易所返回 ${exchangeMap.size} 条有效记录 (exchange=${exchange})`);

    // ─── Step 2: 从 DB 查询同 user+apiKey 的 exchangeRef 记录 ───
    const dbRecords = await this.prisma.position.findMany({
      where: {
        userId,
        apiKeyId,
        status: 'closed',
        exchangeRef: { not: null },
        closedAt: { gte: since },
      },
      select: { id: true, exchangeRef: true },
    });

    const dbMap = new Map<string, string>(); // exchangeRef → positionId
    for (const p of dbRecords) {
      if (p.exchangeRef) dbMap.set(p.exchangeRef, p.id);
    }

    // ─── Step 3: 对齐 — 交易所有、DB 没有 → INSERT ───
    const toInsert = [...exchangeMap.entries()].filter(([ref]) => !dbMap.has(ref));

    let synced = 0;
    let charged = 0;
    let balanceDepleted = false;

    for (const [, record] of toInsert) {
      try {
        const strategy = await this.matchStrategy(userId, apiKeyId, record.symbol);

        const position = await this.prisma.position.create({
          data: {
            userId,
            exchange,
            symbol: record.symbol,
            side: record.side || 'long',
            entryPrice: record.entryPrice || 0,
            amount: record.quantity || 0,
            tradingType: 'futures',
            leverage: record.leverage || 1,
            status: 'closed',
            closedAt: (record.exitTime && !isNaN(record.exitTime.getTime())) ? record.exitTime : new Date(),
            closePrice: record.exitPrice || 0,
            pnl: record.realizedPnl || 0,
            realizedPnl: record.realizedPnl || 0,
            closeReason: record.closeType || 'unknown',
            source: strategy ? 'ai_strategy' : 'exchange_sync',
            aiStrategyId: strategy?.id || null,
            apiKeyId,
            exchangeRef: record.exchangeId!,
          },
        });
        synced++;

        // 盈利 > 0 → GAS 扣费
        if (record.realizedPnl > 0 && strategy) {
          try {
            const feeCalc = await this.feeService.calculateFee(userId, record.realizedPnl.toFixed(8));
            if (parseFloat(feeCalc.feeAmount) > 0) {
              const uniqueOrderId = `EXSYNC_FEE_${userId}_${record.exchangeId}`;
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
            }
          } catch (feeErr: any) {
            this.logger.warn(`[历史持仓同步] 扣费失败(非致命): ${record.symbol} pnl=${record.realizedPnl} err=${feeErr.message}`);
          }
        }
      } catch (e: any) {
        if (e?.code === 'P2002') continue; // 唯一约束冲突，静默跳过
        this.logger.warn(`[历史持仓同步] 写入失败(非致命): ${record.symbol} ref=${record.exchangeId} err=${e.message}`);
      }
    }

    // ─── Step 4: 对齐 — DB 有、交易所没有 → DELETE ───
    const exchangeRefSet = new Set(exchangeMap.keys());
    const deleted = await this.cleanupStaleRecords(userId, apiKeyId, since, exchangeRefSet);

    // ─── 汇总 ───
    if (synced > 0 || deleted > 0) {
      this.logger.log(`[历史持仓同步] 完成: 新增=${synced}, 删除=${deleted}, 扣费=${charged}, 交易所=${exchangeMap.size}`);
    }

    // GAS 余额不足 → 停止所有策略
    if (balanceDepleted) {
      this.logger.warn(`[历史持仓同步] GAS余额不足，停止用户 ${userId} 所有活跃策略`);
      await this.prisma.aiStrategy.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    return { synced, deleted, charged, balanceDepleted };
  }

  /**
   * 清理 DB 中交易所已不存在的记录
   * 只清理最近 24h 窗口内的记录（更早的记录交易所 API 可能不再返回，保留不动）
   */
  private async cleanupStaleRecords(
    userId: string,
    apiKeyId: string,
    since: Date,
    validExchangeRefs: Set<string>,
  ): Promise<number> {
    // 查出时间窗口内的 DB 记录
    const dbRecords = await this.prisma.position.findMany({
      where: {
        userId,
        apiKeyId,
        status: 'closed',
        exchangeRef: { not: null },
        closedAt: { gte: since },
      },
      select: { id: true, exchangeRef: true, symbol: true },
    });

    // DB 有、交易所没有 → 删除
    const toDelete = dbRecords.filter(p => p.exchangeRef && !validExchangeRefs.has(p.exchangeRef));

    if (toDelete.length === 0) return 0;

    const deleteIds = toDelete.map(p => p.id);
    await this.prisma.position.deleteMany({
      where: { id: { in: deleteIds } },
    });

    this.logger.log(`[历史持仓同步] 清理 ${toDelete.length} 条过期记录: ${toDelete.map(p => `${p.symbol}(${p.exchangeRef})`).join(', ')}`);
    return toDelete.length;
  }

  /**
   * 匹配策略：userId + apiKeyId + symbol
   * 优先匹配活跃策略，其次匹配最近的非活跃策略
   */
  private async matchStrategy(
    userId: string,
    apiKeyId: string,
    symbol: string,
  ): Promise<{ id: string; name: string } | null> {
    const strategies = await this.prisma.aiStrategy.findMany({
      where: { userId, exchangeApiKeyId: apiKeyId },
      select: { id: true, name: true, isActive: true, gridConfig: true, coinSourceConfig: true },
      orderBy: { isActive: 'desc' },
    });

    for (const s of strategies) {
      const gc = s.gridConfig as any;
      if (gc?.symbol === symbol) return { id: s.id, name: s.name };

      const cc = s.coinSourceConfig as any;
      if (cc?.coins?.includes(symbol)) return { id: s.id, name: s.name };
    }

    return null;
  }
}
