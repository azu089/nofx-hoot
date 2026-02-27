import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdapterFactoryService } from '../exchange-adapters/adapter-factory.service';
import { ExchangePosition as AdapterPosition } from '../exchange-adapters/types/exchange.types';
import Decimal from 'decimal.js';
import { isSameSymbol } from '../../common/utils/symbol.util';

/** 从持仓记录推导策略名称 */
function resolveStrategyName(
  aiStrategyName?: string | null,
  subscriptionStrategyName?: string | null,
  source?: string | null,
  symbol?: string,
): string | undefined {
  if (aiStrategyName) return aiStrategyName;
  if (subscriptionStrategyName) return subscriptionStrategyName;
  const coin = symbol?.split('/')[0] || '';
  if (source === 'ai_research') return `深研-${coin}`;
  if (source === 'ai_strategy') return `AI策略-${coin}`;
  return undefined;
}

interface ExchangePosition {
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  markPrice: number;
  amount: number;
  leverage: number;
  margin: number;
  /** 交易所原始保证金比率（维持保证金/保证金余额），越接近 100% 越危险 */
  marginRatio?: number;
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
  /** 交易所原始保证金比率（%），直接用于显示，不需要前端重算 */
  marginRatio?: string;
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
    @Optional() private readonly adapterFactory?: AdapterFactoryService,
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
    // 只查同一 apiKey 的持仓 + 未关联 apiKey 的旧持仓，避免跨交易所干扰
    const dbPositions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'open',
        OR: [{ apiKeyId }, { apiKeyId: null }],
      },
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
    const matchedExchangeSymbols = new Set<string>();

    for (const dbPos of dbPositions) {
      // 在交易所持仓中查找匹配的持仓
      const exchangePos = exchangePositions.find(
        (ep) => isSameSymbol(ep.symbol, dbPos.symbol) && ep.side === dbPos.side,
      );

      if (exchangePos) {
        matchedExchangeSymbols.add(`${exchangePos.symbol}:${exchangePos.side}`);
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
          // 交易所原始 marginRatio（小数形式 × 100 → 百分比字符串）
          marginRatio: exchangePos.marginRatio != null
            ? (exchangePos.marginRatio * 100).toFixed(2)
            : undefined,
          unrealizedPnl: exchangePos.unrealizedPnl.toString(),
          roe: (exchangePos.roe * 100).toFixed(2), // 转为百分比
          status: 'open',
          tradingType: 'futures',
          strategyName: resolveStrategyName(dbPos.aiStrategy?.name, dbPos.subscription?.strategy?.name, dbPos.source, dbPos.symbol),
          createdAt: dbPos.createdAt,
          syncedAt: new Date(),
          syncSource: 'exchange',
        });
      } else {
        // 交易所没有此持仓，可能已被平仓
        this.logger.warn(
          `数据库持仓 ${dbPos.id} (${dbPos.symbol}) 在交易所未找到`,
        );

        // 返回数据库数据
        // 若 DB leverage=1（可能是早期 CCXT bug 写入的错误值），尝试从 margin/notional 反推真实杠杆
        const dbNotional = new Decimal(dbPos.amount.toString()).times(dbPos.entryPrice.toString());
        let effectiveLeverage = dbPos.leverage || 1;
        if (effectiveLeverage <= 1 && dbPos.margin) {
          const dbMargin = new Decimal(dbPos.margin.toString());
          if (dbMargin.gt(0) && dbNotional.gt(0)) {
            const derived = Math.round(dbNotional.div(dbMargin).toNumber());
            if (derived > 1 && derived <= 200) effectiveLeverage = derived;
          }
        }
        syncedPositions.push({
          id: dbPos.id,
          symbol: dbPos.symbol,
          side: dbPos.side,
          entryPrice: dbPos.entryPrice.toString(),
          markPrice: dbPos.entryPrice.toString(), // 没有实时价格
          liquidationPrice: '0',
          amount: dbPos.amount.toString(),
          notionalValue: dbNotional.toString(),
          margin: dbPos.margin?.toString() || '0',
          leverage: effectiveLeverage,
          marginMode: dbPos.marginMode || 'cross',
          unrealizedPnl: dbPos.pnl?.toString() || '0',
          roe: '0',
          status: dbPos.status,
          tradingType: dbPos.tradingType || 'spot',
          strategyName: resolveStrategyName(dbPos.aiStrategy?.name, dbPos.subscription?.strategy?.name, dbPos.source, dbPos.symbol),
          createdAt: dbPos.createdAt,
          syncedAt: new Date(),
          syncSource: 'database',
        });
      }
    }

    // 4. 交易所存在但 DB 中没有对应 open 记录的持仓（手动开仓/DB未记录/SL触发后DB未同步）
    for (const ep of exchangePositions) {
      const key = `${ep.symbol}:${ep.side}`;
      if (!matchedExchangeSymbols.has(key)) {
        this.logger.log(
          `交易所持仓 ${ep.symbol} ${ep.side} 在数据库中未找到，添加为 exchange-only`,
        );
        syncedPositions.push({
          id: `exchange_${ep.symbol}_${ep.side}`,
          symbol: ep.symbol,
          side: ep.side,
          entryPrice: ep.entryPrice.toString(),
          markPrice: ep.markPrice.toString(),
          liquidationPrice: ep.liquidationPrice.toString(),
          amount: ep.amount.toString(),
          notionalValue: ep.notionalValue.toString(),
          margin: ep.margin.toString(),
          leverage: ep.leverage,
          marginMode: ep.marginMode,
          marginRatio: ep.marginRatio != null
            ? (ep.marginRatio * 100).toFixed(2)
            : undefined,
          unrealizedPnl: ep.unrealizedPnl.toString(),
          roe: (ep.roe * 100).toFixed(2),
          status: 'open',
          tradingType: 'futures',
          createdAt: new Date(),
          syncedAt: new Date(),
          syncSource: 'exchange',
        });
      }
    }

    this.logger.log(`同步完成，共 ${syncedPositions.length} 个持仓（DB=${dbPositions.length}, 交易所=${exchangePositions.length}）`);
    return syncedPositions;
  }

  /**
   * 从交易所获取持仓数据
   * 使用 AdapterFactoryService (CcxtAdapter) — binance 自动映射 binanceusdm
   */
  private async fetchExchangePositions(
    userId: string,
    apiKeyId: string,
  ): Promise<ExchangePosition[]> {
    try {
      if (!this.adapterFactory) {
        this.logger.warn('AdapterFactoryService 未注入，无法同步交易所持仓');
        return [];
      }

      const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      const positions: AdapterPosition[] = await adapter.getPositions();

      this.logger.log(`交易所返回 ${positions.length} 个持仓`);

      return positions.map((pos) => {
        const notionalValue = pos.quantity * pos.markPrice;
        const margin = pos.margin > 0 ? pos.margin : notionalValue / (pos.leverage || 1);
        const roe = margin > 0 ? pos.unrealizedPnl / margin : 0;

        return {
          symbol: pos.symbol,
          side: pos.side,
          entryPrice: pos.entryPrice,
          markPrice: pos.markPrice,
          amount: pos.quantity,
          leverage: pos.leverage,
          margin,
          // 直接透传交易所原始 marginRatio，不重算
          marginRatio: pos.marginRatio,
          marginMode: pos.marginMode,
          unrealizedPnl: pos.unrealizedPnl,
          roe,
          liquidationPrice: pos.liquidationPrice || 0,
          notionalValue,
        };
      });
    } catch (error: any) {
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
    // 优先使用交易所原始 marginRatio（维持保证金/保证金余额，Binance 风险指标）
    // 无交易所值时降级为 margin/notional*100（等价于 1/leverage，仅表示保证金占用率）
    const marginRatio = exchangePos.marginRatio != null && exchangePos.marginRatio > 0
      ? new Decimal(exchangePos.marginRatio).times(100)  // 交易所返回小数形式（0.05 = 5%）
      : notional.gt(0)
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
