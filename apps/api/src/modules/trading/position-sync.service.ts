import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService } from './trading.service';
import Decimal from 'decimal.js';
import { isSameSymbol } from '../../common/utils/symbol.util';

interface ExchangePosition {
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  markPrice: number;
  amount: number;
  leverage: number;
  margin: number;
  marginMode: 'cross' | 'isolated';
  unrealizedPnl: number;
  roe: number; // 收益率
  liquidationPrice: number;
  notionalValue: number;
}

export interface SyncedPosition {
  id: string;
  symbol: string;
  side: string;
  // 价格数据
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  // 数量与金额
  amount: string;
  notionalValue: string;
  margin: string;
  // 杠杆与保证金
  leverage: number;
  marginMode: string;
  // 盈亏
  unrealizedPnl: string;
  roe: string; // 收益率百分比
  // 状态
  status: string;
  tradingType: string;
  // 策略信息
  strategyName?: string;
  createdAt: Date;
  // 同步状态
  syncedAt: Date;
  syncSource: 'exchange' | 'database';
}

@Injectable()
export class PositionSyncService {
  private readonly logger = new Logger(PositionSyncService.name);

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
  ) {}

  /**
   * 同步用户的所有持仓数据
   */
  async syncUserPositions(
    userId: string,
    apiKeyId: string,
  ): Promise<SyncedPosition[]> {
    this.logger.log(`开始同步用户 ${userId} 的持仓数据`);

    // 1. 从交易所获取持仓
    const exchangePositions = await this.fetchExchangePositions(
      userId,
      apiKeyId,
    );

    // 2. 获取数据库中的持仓
    const dbPositions = await this.prisma.position.findMany({
      where: { userId, status: 'open' },
      include: {
        subscription: {
          include: {
            strategy: true,
          },
        },
        aiStrategy: { select: { name: true } },
      },
    });

    // 3. 合并与更新数据
    const syncedPositions: SyncedPosition[] = [];

    for (const dbPos of dbPositions) {
      // 在交易所持仓中查找匹配的持仓
      const exchangePos = exchangePositions.find(
        (ep) => isSameSymbol(ep.symbol, dbPos.symbol),
      );

      if (exchangePos) {
        // 更新数据库中的持仓数据
        await this.updatePositionFromExchange(dbPos.id, exchangePos);

        syncedPositions.push({
          id: dbPos.id,
          symbol: dbPos.symbol,
          side: dbPos.side,
          // 使用交易所的实时数据
          entryPrice: exchangePos.entryPrice.toString(),
          markPrice: exchangePos.markPrice.toString(),
          liquidationPrice: exchangePos.liquidationPrice.toString(),
          amount: exchangePos.amount.toString(),
          notionalValue: exchangePos.notionalValue.toString(),
          margin: exchangePos.margin.toString(),
          leverage: exchangePos.leverage,
          marginMode: exchangePos.marginMode,
          unrealizedPnl: exchangePos.unrealizedPnl.toString(),
          roe: (exchangePos.roe * 100).toFixed(2), // 转为百分比
          status: 'open',
          tradingType: 'futures',
          strategyName: dbPos.aiStrategy?.name || dbPos.subscription?.strategy?.name,
          createdAt: dbPos.createdAt,
          syncedAt: new Date(),
          syncSource: 'exchange',
        });
      } else {
        // 交易所没有此持仓，可能已被平仓
        this.logger.warn(
          `数据库持仓 ${dbPos.id} (${dbPos.symbol}) 在交易所未找到`,
        );

        // 标记为关闭（可选）
        // await this.markPositionClosed(dbPos.id, 'exchange_not_found');

        // 返回数据库数据
        syncedPositions.push({
          id: dbPos.id,
          symbol: dbPos.symbol,
          side: dbPos.side,
          entryPrice: dbPos.entryPrice.toString(),
          markPrice: dbPos.entryPrice.toString(), // 没有实时价格
          liquidationPrice: '0',
          amount: dbPos.amount.toString(),
          notionalValue: new Decimal(dbPos.amount.toString())
            .times(dbPos.entryPrice.toString())
            .toString(),
          margin: dbPos.margin?.toString() || '0',
          leverage: dbPos.leverage || 1,
          marginMode: dbPos.marginMode || 'cross',
          unrealizedPnl: dbPos.pnl?.toString() || '0',
          roe: '0',
          status: dbPos.status,
          tradingType: dbPos.tradingType || 'spot',
          strategyName: dbPos.aiStrategy?.name || dbPos.subscription?.strategy?.name,
          createdAt: dbPos.createdAt,
          syncedAt: new Date(),
          syncSource: 'database',
        });
      }
    }

    this.logger.log(`同步完成，共 ${syncedPositions.length} 个持仓`);
    return syncedPositions;
  }

  /**
   * 从交易所获取持仓数据
   */
  private async fetchExchangePositions(
    userId: string,
    apiKeyId: string,
  ): Promise<ExchangePosition[]> {
    try {
      // 使用 TradingService 获取交易所持仓
      const positions = await this.tradingService.fetchPositions(userId, apiKeyId);

      return positions.map((pos: any) => {
        const side =
          pos.side ||
          (parseFloat(pos.info?.positionAmt || 0) > 0 ? 'long' : 'short');
        const amount = Math.abs(
          parseFloat(pos.contracts || pos.info?.positionAmt || 0),
        );
        const entryPrice = parseFloat(
          pos.entryPrice || pos.info?.entryPrice || 0,
        );
        const markPrice = parseFloat(pos.markPrice || pos.info?.markPrice || 0);
        const leverage = parseInt(pos.leverage || pos.info?.leverage || 1);
        const unrealizedPnl = parseFloat(
          pos.unrealizedPnl || pos.info?.unRealizedProfit || 0,
        );
        const notionalValue = parseFloat(
          pos.notional || pos.info?.notional || amount * markPrice,
        );
        const margin = parseFloat(
          pos.initialMargin ||
            pos.info?.isolatedWallet ||
            pos.info?.isolatedMargin ||
            notionalValue / leverage,
        );
        const liquidationPrice = parseFloat(
          pos.liquidationPrice || pos.info?.liquidationPrice || 0,
        );

        // 计算收益率 (ROE)
        const roe = margin > 0 ? unrealizedPnl / margin : 0;

        return {
          symbol: pos.symbol,
          side,
          entryPrice,
          markPrice,
          amount,
          leverage,
          margin,
          marginMode: pos.marginMode || pos.info?.marginType || 'cross',
          unrealizedPnl,
          roe,
          liquidationPrice,
          notionalValue,
        };
      });
    } catch (error) {
      this.logger.error(`获取交易所持仓失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 更新数据库持仓数据（含标记价格、杠杆、盈亏等实时数据）
   */
  private async updatePositionFromExchange(
    positionId: string,
    exchangePos: ExchangePosition,
  ): Promise<void> {
    const margin = new Decimal(exchangePos.margin);
    const notional = new Decimal(exchangePos.notionalValue);
    // 保证金比率 = 保证金 / 名义价值 * 100
    const marginRatio = notional.gt(0)
      ? margin.div(notional).times(100)
      : new Decimal(0);

    await this.prisma.position.update({
      where: { id: positionId },
      data: {
        // 基础数据
        entryPrice: new Decimal(exchangePos.entryPrice),
        amount: new Decimal(exchangePos.amount),
        leverage: exchangePos.leverage,
        margin: margin,
        marginMode: exchangePos.marginMode,
        tradingType: 'futures',
        // 实时价格与盈亏（新增字段）
        markPrice: new Decimal(exchangePos.markPrice),
        liquidationPrice: exchangePos.liquidationPrice > 0
          ? new Decimal(exchangePos.liquidationPrice)
          : null,
        unrealizedPnl: new Decimal(exchangePos.unrealizedPnl),
        marginRatio: marginRatio,
        lastSyncAt: new Date(),
      },
    });
  }

  // normalizeSymbol 已迁移到 common/utils/symbol.util.ts (isSameSymbol)

  /**
   * 获取单个持仓的实时数据
   */
  async getPositionWithRealTimeData(
    positionId: string,
    userId: string,
  ): Promise<SyncedPosition | null> {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, userId },
      include: {
        subscription: {
          include: { strategy: true },
        },
      },
    });

    if (!position || !position.apiKeyId) {
      return null;
    }

    const synced = await this.syncUserPositions(userId, position.apiKeyId);
    return synced.find((p) => p.id === positionId) || null;
  }
}
