import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeeService } from './fee.service';
import { ReferralService } from '../referral/referral.service';
import { Decimal } from '@prisma/client/runtime/library';
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
 *   6. 盈利仓位 → GAS 扣费 → 上级返佣（自动入账）
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
      this.logger.warn(`[历史持仓同步] 拉取失败(非致命): ${e.message}`);
      return { synced: 0, deleted: 0, charged: 0, balanceDepleted: false };
    }

    if (!exchangeRecords || exchangeRecords.length === 0) {
      this.logger.log(`[历史持仓同步] 交易所返回空记录 (exchange=${exchange})`);
      return { synced: 0, deleted: 0, charged: 0, balanceDepleted: false };
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
              // 用仓位本质属性生成稳定的幂等 key，不受 exchangeId 格式变更影响
              const stablePosKey = `${record.symbol}_${record.side}_${record.exitTime?.getTime() ?? 0}_${(record.quantity ?? 0).toFixed(4)}`;
              const uniqueOrderId = `EXSYNC_FEE_${userId}_${stablePosKey}`;
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

              // GAS 扣费成功 → 触发上级返佣（非致命，失败不影响主流程）
              if (feeResult.ok) {
                await this.processReferralCommission(userId, position.id, feeCalc.feeAmount);
              }
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
    // 安全守卫：只删除与当前交易所同源的记录
    // 防止 exchangeId 格式变更时误删旧格式记录导致重复扣费
    // 旧格式记录会在 24h 窗口后自然过期
    //
    // 所有交易所 exchangeId 格式统一为 "{exchange}_..." 开头：
    //   binance_pos_SOLUSDT_long_... | gate_pos_SOLUSDT_long_...
    //   okx_123456789 | bybit_12345678
    //   lighter_abc123 | aster_12345
    // 提取交易所级前缀（第一个 _ 前 + _）用于同源匹配
    const prefixSet = new Set<string>();
    for (const ref of validExchangeRefs) {
      const idx = ref.indexOf('_');
      if (idx > 0) {
        prefixSet.add(ref.substring(0, idx + 1)); // e.g. "binance_", "okx_", "lighter_"
      }
    }

    const toDelete = dbRecords.filter(p => {
      if (!p.exchangeRef || validExchangeRefs.has(p.exchangeRef)) return false;
      // 只删除同交易所的记录，跳过不同交易所或旧格式无前缀的记录
      return [...prefixSet].some(prefix => p.exchangeRef!.startsWith(prefix));
    });

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

  /**
   * GAS 扣费后触发上级返佣
   * 返佣基数 = 实际扣除的 GAS 费用
   * 一级返佣 = GAS × level1Rate%（默认 10%）
   * 二级返佣 = GAS × level2Rate%（默认 5%）
   * 返佣立即入账（创建 reward + 更新余额 + 写 Transaction，原子事务）
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

      // 获取返佣配置
      const config = await this.prisma.referralConfig.findUnique({
        where: { id: 'default' },
      });
      if (!config || !config.isActive) return;

      const enabledTypes = config.enabledTypes as string[];
      if (!enabledTypes.includes('trading')) return;

      // 查找邀请链：用户 → 一级邀请人 → 二级邀请人
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { invitedBy: true },
      });
      if (!user?.invitedBy) return;

      const levels: Array<{ inviterId: string; rate: Decimal; level: number }> = [
        { inviterId: user.invitedBy, rate: new Decimal(config.level1Rate.toString()).div(100), level: 1 },
      ];

      // 二级邀请人
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

      // 为每一级创建返佣并立即入账
      for (const { inviterId, rate, level } of levels) {
        const commission = fee.times(rate);
        if (commission.lte(0)) continue;

        const uniqueOrderId = `ref_${inviterId}_gas_${positionId}_L${level}`;

        // 幂等检查
        const existing = await this.prisma.referralReward.findUnique({
          where: { uniqueOrderId },
        });
        if (existing) continue;

        // 原子事务：创建 reward（paid） + 更新余额 + 写 Transaction
        await this.prisma.$transaction(async (tx) => {
          // 1. 创建返佣记录（直接标记 paid）
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

          // 2. 上级余额立即增加
          await tx.user.update({
            where: { id: inviterId },
            data: { usdtBalance: { increment: commission } },
          });

          // 3. 写入交易记录
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
      // 返佣失败不影响主流程
      this.logger.warn(`[返佣] 处理失败(非致命): ${error.message}`);
    }
  }
}
