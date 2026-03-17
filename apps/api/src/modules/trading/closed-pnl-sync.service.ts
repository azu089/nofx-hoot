import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeeService } from './fee.service';
import type { ExchangeAdapter } from '../exchange-adapters/types/adapter.interface';

/**
 * 交易所历史持仓同步服务
 *
 * 核心职责：
 * 1. 从交易所拉取已平仓记录（getClosedPnl）
 * 2. 和 DB Position 表去重（exchangeRef 唯一键）
 * 3. 新增记录写入 DB + 匹配策略
 * 4. 盈利记录执行点卡扣费（唯一扣费入口）
 */
@Injectable()
export class ClosedPnlSyncService {
  private readonly logger = new Logger(ClosedPnlSyncService.name);

  constructor(
    private prisma: PrismaService,
    private feeService: FeeService,
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
  ): Promise<{ synced: number; charged: number; balanceDepleted: boolean }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 最近 24h
    let closedRecords;
    try {
      closedRecords = await adapter.getClosedPnl(since, 100);
    } catch (e: any) {
      this.logger.debug(`[历史持仓同步] 拉取失败(非致命): ${e.message}`);
      return { synced: 0, charged: 0, balanceDepleted: false };
    }

    if (!closedRecords || closedRecords.length === 0) {
      return { synced: 0, charged: 0, balanceDepleted: false };
    }

    // 批量去重：查询已存在的 exchangeRef
    const exchangeRefs = closedRecords
      .filter(r => r.exchangeId)
      .map(r => r.exchangeId!);

    if (exchangeRefs.length === 0) {
      return { synced: 0, charged: 0, balanceDepleted: false };
    }

    const existing = await this.prisma.position.findMany({
      where: { exchangeRef: { in: exchangeRefs } },
      select: { exchangeRef: true },
    });
    const existingSet = new Set(existing.map(e => e.exchangeRef));

    // 过滤出新记录
    const newRecords = closedRecords.filter(
      r => r.exchangeId && !existingSet.has(r.exchangeId),
    );

    if (newRecords.length === 0) {
      return { synced: 0, charged: 0, balanceDepleted: false };
    }

    let synced = 0;
    let charged = 0;
    let balanceDepleted = false;

    for (const record of newRecords) {
      try {
        // 匹配策略
        const strategy = await this.matchStrategy(userId, apiKeyId, record.symbol);

        // 写入 Position 表
        const position = await this.prisma.position.create({
          data: {
            userId,
            exchange,
            symbol: record.symbol,
            side: record.side,
            entryPrice: record.entryPrice || 0,
            amount: record.quantity || 0,
            tradingType: 'futures',
            leverage: record.leverage || 1,
            status: 'closed',
            closedAt: record.exitTime || new Date(),
            closePrice: record.exitPrice || 0,
            pnl: record.realizedPnl || 0,
            realizedPnl: record.realizedPnl || 0,
            closeReason: record.closeType || 'unknown',
            source: strategy ? 'ai_strategy' : 'exchange_sync',
            aiStrategyId: strategy?.id || null,
            apiKeyId,
            exchangeRef: record.exchangeId,
          },
        });
        synced++;

        // 盈利 > 0 → 点卡扣费
        if (record.realizedPnl > 0 && strategy) {
          try {
            const feeCalc = await this.feeService.calculateFee(
              userId,
              record.realizedPnl.toFixed(8),
            );
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
              if (feeResult.balanceDepleted) {
                balanceDepleted = true;
              }
            }
          } catch (feeErr: any) {
            this.logger.warn(
              `[历史持仓同步] 扣费失败(非致命): ${record.symbol} pnl=${record.realizedPnl} err=${feeErr.message}`,
            );
          }
        }
      } catch (e: any) {
        // 单条记录失败不影响其他
        this.logger.warn(
          `[历史持仓同步] 写入失败(非致命): ${record.symbol} ref=${record.exchangeId} err=${e.message}`,
        );
      }
    }

    if (synced > 0) {
      this.logger.log(
        `[历史持仓同步] 完成: 新增=${synced}, 扣费=${charged}, 总拉取=${closedRecords.length}`,
      );
    }

    // 点卡余额不足 → 停止用户所有活跃策略
    if (balanceDepleted) {
      this.logger.warn(`[历史持仓同步] 点卡余额不足，停止用户 ${userId} 所有活跃策略`);
      await this.prisma.aiStrategy.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    return { synced, charged, balanceDepleted };
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
    // 查找使用同一 apiKey 的策略
    const strategies = await this.prisma.aiStrategy.findMany({
      where: { userId, exchangeApiKeyId: apiKeyId },
      select: {
        id: true,
        name: true,
        isActive: true,
        gridConfig: true,
        coinSourceConfig: true,
      },
      orderBy: { isActive: 'desc' }, // 活跃的排前面
    });

    for (const s of strategies) {
      // 网格策略：gridConfig.symbol 匹配
      const gc = s.gridConfig as any;
      if (gc?.symbol === symbol) return { id: s.id, name: s.name };

      // 普通策略：coinSourceConfig.coins 包含
      const cc = s.coinSourceConfig as any;
      if (cc?.coins?.includes(symbol)) return { id: s.id, name: s.name };
    }

    return null;
  }
}
