import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FreqtradeService } from '../freqtrade/freqtrade.service';
import { NetworkWhitelistService } from '../../common/services/network-whitelist.service';
import { PointsService } from '../points/points.service';
import { TradeStatsDto } from './dto/trade-stats.dto';
import {
  QueryTradesDto,
  PnlStatus,
  PaginatedTradesResponseDto,
} from './dto/trade-response.dto';
import {
  PeriodStatsQueryDto,
  PeriodStatsResponseDto,
  PeriodType,
} from './dto/period-stats.dto';
import Decimal from 'decimal.js';

/**
 * 交易历史服务
 * 负责同步、查询和统计交易数据
 *
 * 注意事项:
 * - 使用 Decimal.js 处理资金计算
 * - 交易同步采用增量处理，避免重复
 * - 沙盒模式返回模拟数据
 *
 * 积分联动:
 * - 新交易同步后自动调用 PointsService.earnFromTrade()
 * - 规则: 每 100 USDT 交易量 = 1 积分
 */
@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly freqtradeService: FreqtradeService,
    private readonly pointsService: PointsService,
    private readonly networkWhitelistService: NetworkWhitelistService,
  ) {}

  /**
   * 从 Freqtrade 同步交易数据到数据库
   * @param instanceId 实例 ID
   */
  async syncTrades(instanceId: string) {
    this.logger.log(`开始同步实例 ${instanceId} 的交易数据`);

    // 1. 查询实例信息
    const instance = await this.prisma.client.instances.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new NotFoundException('实例不存在');
    }

    if (!instance.ip_address) {
      this.logger.warn(`实例 ${instanceId} 没有 IP 地址，跳过同步`);
      return { synced: 0, message: '实例没有 IP 地址' };
    }

    if (instance.status === 'destroyed') {
      this.logger.warn(`实例 ${instanceId} 已销毁，跳过同步`);
      return { synced: 0, message: '实例已销毁' };
    }

    try {
      // 2. 调用 Freqtrade API 获取交易数据
      const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
      const trades = await this.freqtradeService.getTrades(
        instance.ip_address,
        apiToken,
      );

      this.logger.debug(`获取到 ${trades.length} 条交易记录`);

      let syncedCount = 0;

      // 3. 逐条同步到数据库（使用 upsert 避免重复）
      for (const trade of trades) {
        // 检查是否已存在（通过 sync_data.trade_id 判断）
        const existing = await this.prisma.client.trade_history.findFirst({
          where: {
            instance_id: instanceId,
            // @ts-ignore - Prisma JSON 查询
            sync_data: {
              path: ['trade_id'],
              equals: trade.trade_id,
            },
          },
        });

        if (existing) {
          // 已存在，更新状态和价格
          await this.prisma.client.trade_history.update({
            where: { id: existing.id },
            data: {
              status: trade.is_open ? 'open' : 'closed',
              exit_price: trade.close_rate || existing.exit_price,
              pnl: trade.profit_abs || existing.pnl,
              pnl_percentage: trade.profit_pct || existing.pnl_percentage,
              closed_at: trade.close_date
                ? new Date(trade.close_date)
                : existing.closed_at,
              sync_data: trade as any,
              synced_at: new Date(),
              updated_at: new Date(),
            },
          });

          this.logger.debug(`更新交易记录: ${existing.id}`);
        } else {
          // 不存在，新增
          const newTrade = await this.prisma.client.trade_history.create({
            data: {
              user_id: instance.user_id,
              instance_id: instanceId,
              strategy_id: null, // TODO: 后续关联策略
              exchange: 'binance', // 从 Freqtrade 配置获取
              symbol: trade.pair.replace('/', ''), // BTC/USDT -> BTCUSDT
              side: 'buy', // Freqtrade 交易默认是 buy
              order_type: 'limit',
              entry_price: trade.open_rate,
              exit_price: trade.close_rate || null,
              quantity: trade.amount,
              leverage: trade.leverage || 1,
              pnl: trade.profit_abs || null,
              pnl_percentage: trade.profit_pct || null,
              gas_fee: '0', // TODO: 计算手续费
              status: trade.is_open ? 'open' : 'closed',
              opened_at: new Date(trade.open_date),
              closed_at: trade.close_date ? new Date(trade.close_date) : null,
              sync_data: trade as any,
              synced_at: new Date(),
            },
          });

          syncedCount++;
          this.logger.debug(`新增交易记录: ${trade.pair} - ${trade.trade_id}`);

          // 积分联动：新交易自动获取积分
          // 计算交易量 = 数量 * 入场价格
          try {
            const tradeVolume = new Decimal(trade.amount)
              .times(new Decimal(trade.open_rate))
              .toString();
            const earnedPoints = await this.pointsService.earnFromTrade(
              instance.user_id,
              tradeVolume,
              newTrade.id,
            );
            if (parseFloat(earnedPoints) > 0) {
              this.logger.log(
                `交易 ${newTrade.id} 获得 ${earnedPoints} 积分 (交易量: ${tradeVolume} USDT)`,
              );
            }
          } catch (error) {
            // 积分获取失败不影响交易同步
            this.logger.warn(
              `交易 ${newTrade.id} 积分获取失败: ${error.message}`,
            );
          }
        }
      }

      this.logger.log(
        `同步完成: 实例 ${instanceId}, 新增 ${syncedCount} 条交易`,
      );

      return {
        synced: syncedCount,
        total: trades.length,
        message: '同步成功',
      };
    } catch (error) {
      this.logger.error(
        `同步交易数据失败: ${error.message}`,
        error.stack,
      );
      return {
        synced: 0,
        message: `同步失败: ${error.message}`,
      };
    }
  }

  /**
   * 获取用户的交易历史（支持分页和筛选）
   * @param userId 用户 ID
   * @param query 查询参数
   * @returns 分页的交易列表
   */
  async findByUser(
    userId: string,
    query: QueryTradesDto,
  ): Promise<PaginatedTradesResponseDto> {
    const where: any = {
      user_id: userId,
    };

    // 实例筛选（验证实例归属）
    if (query.instance_id) {
      // 安全：验证实例是否属于当前用户
      const instance = await this.prisma.client.instances.findFirst({
        where: { id: query.instance_id, user_id: userId },
        select: { id: true },
      });
      if (!instance) {
        // 返回空结果而不是错误，避免泄露实例存在性
        return {
          trades: [],
          total: 0,
          limit: query.limit || 20,
          offset: query.offset || 0,
          has_more: false,
        };
      }
      where.instance_id = query.instance_id;
    }

    // 策略筛选
    if (query.strategy_id) {
      where.strategy_id = query.strategy_id;
    }

    // 状态筛选
    if (query.status) {
      where.status = query.status;
    }

    // 精确交易对筛选
    if (query.symbol) {
      where.symbol = query.symbol;
    }

    // 模糊交易对搜索 (pair 参数)
    if (query.pair) {
      where.symbol = {
        contains: query.pair.toUpperCase(),
        mode: 'insensitive',
      };
    }

    // 盈亏状态筛选
    if (query.pnl_status && query.pnl_status !== PnlStatus.ALL) {
      if (query.pnl_status === PnlStatus.PROFIT) {
        where.pnl = { gt: '0' };
      } else if (query.pnl_status === PnlStatus.LOSS) {
        where.pnl = { lt: '0' };
      }
    }

    // 日期范围筛选 (基于关闭时间或开仓时间)
    if (query.start_date || query.end_date) {
      where.OR = [
        // 已关闭交易：按关闭时间筛选
        {
          status: 'closed',
          closed_at: {
            ...(query.start_date && { gte: new Date(query.start_date) }),
            ...(query.end_date && {
              lte: new Date(query.end_date + 'T23:59:59.999Z'),
            }),
          },
        },
        // 未关闭交易：按开仓时间筛选
        {
          status: 'open',
          opened_at: {
            ...(query.start_date && { gte: new Date(query.start_date) }),
            ...(query.end_date && {
              lte: new Date(query.end_date + 'T23:59:59.999Z'),
            }),
          },
        },
      ];
    }

    // 分页参数
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    // 并行查询数据和总数
    const [trades, total] = await Promise.all([
      this.prisma.client.trade_history.findMany({
        where,
        orderBy: { opened_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.client.trade_history.count({ where }),
    ]);

    return {
      trades: trades as any,
      total,
      limit,
      offset,
      has_more: offset + trades.length < total,
    };
  }

  /**
   * 获取实例的交易历史
   */
  async findByInstance(instanceId: string) {
    return this.prisma.client.trade_history.findMany({
      where: { instance_id: instanceId },
      orderBy: { opened_at: 'desc' },
      take: 100,
    });
  }

  /**
   * 计算用户盈亏统计
   */
  async calculatePnL(userId: string): Promise<TradeStatsDto> {
    const trades = await this.prisma.client.trade_history.findMany({
      where: { user_id: userId },
    });

    // 使用 Decimal.js 计算
    let totalPnl = new Decimal(0);
    let totalProfit = new Decimal(0);
    let totalLoss = new Decimal(0);
    let totalGasFee = new Decimal(0);
    let winTrades = 0;
    let lossTrades = 0;
    let bestTrade = new Decimal(0);
    let worstTrade = new Decimal(0);

    const openTrades = trades.filter((t) => t.status === 'open').length;
    const closedTrades = trades.filter((t) => t.status === 'closed').length;

    for (const trade of trades) {
      if (trade.status === 'closed' && trade.pnl) {
        const pnl = new Decimal(trade.pnl);
        totalPnl = totalPnl.plus(pnl);

        if (pnl.greaterThan(0)) {
          totalProfit = totalProfit.plus(pnl);
          winTrades++;

          if (pnl.greaterThan(bestTrade)) {
            bestTrade = pnl;
          }
        } else if (pnl.lessThan(0)) {
          totalLoss = totalLoss.plus(pnl);
          lossTrades++;

          if (pnl.lessThan(worstTrade)) {
            worstTrade = pnl;
          }
        }
      }

      if (trade.gas_fee) {
        totalGasFee = totalGasFee.plus(new Decimal(trade.gas_fee));
      }
    }

    const winRate =
      closedTrades > 0
        ? new Decimal(winTrades).dividedBy(closedTrades).times(100)
        : new Decimal(0);

    const avgPnl =
      closedTrades > 0
        ? totalPnl.dividedBy(closedTrades)
        : new Decimal(0);

    return {
      total_trades: trades.length,
      open_trades: openTrades,
      closed_trades: closedTrades,
      win_trades: winTrades,
      loss_trades: lossTrades,
      win_rate: winRate.toFixed(2),
      total_pnl: totalPnl.toFixed(8),
      total_profit: totalProfit.toFixed(8),
      total_loss: totalLoss.toFixed(8),
      total_gas_fee: totalGasFee.toFixed(8),
      avg_pnl_per_trade: avgPnl.toFixed(8),
      best_trade: bestTrade.toFixed(8),
      worst_trade: worstTrade.toFixed(8),
    };
  }

  /**
   * 按时间段计算用户盈亏统计
   * @param userId 用户 ID
   * @param query 时间段查询参数
   */
  async calculatePnLByPeriod(
    userId: string,
    query: PeriodStatsQueryDto,
  ): Promise<PeriodStatsResponseDto> {
    // 1. 计算时间范围
    const { startDate, endDate } = this.calculateDateRange(query);

    this.logger.debug(
      `计算盈亏统计: 用户 ${userId}, 时间段 ${query.period}, ${startDate.toISOString()} - ${endDate.toISOString()}`,
    );

    // 2. 查询时间范围内的已关闭交易
    const trades = await this.prisma.client.trade_history.findMany({
      where: {
        user_id: userId,
        status: 'closed',
        closed_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // 3. 使用 Decimal.js 计算统计数据
    let totalPnl = new Decimal(0);
    let totalProfit = new Decimal(0);
    let totalLoss = new Decimal(0);
    let totalGasFee = new Decimal(0);
    let winTrades = 0;
    let lossTrades = 0;
    let bestTrade = new Decimal(0);
    let worstTrade = new Decimal(0);

    for (const trade of trades) {
      if (trade.pnl) {
        const pnl = new Decimal(trade.pnl);
        totalPnl = totalPnl.plus(pnl);

        if (pnl.greaterThan(0)) {
          totalProfit = totalProfit.plus(pnl);
          winTrades++;

          if (pnl.greaterThan(bestTrade)) {
            bestTrade = pnl;
          }
        } else if (pnl.lessThan(0)) {
          totalLoss = totalLoss.plus(pnl);
          lossTrades++;

          if (pnl.lessThan(worstTrade)) {
            worstTrade = pnl;
          }
        }
      }

      if (trade.gas_fee) {
        totalGasFee = totalGasFee.plus(new Decimal(trade.gas_fee));
      }
    }

    const totalTrades = trades.length;
    const winRate =
      totalTrades > 0
        ? new Decimal(winTrades).dividedBy(totalTrades)
        : new Decimal(0);

    const avgPnl =
      totalTrades > 0 ? totalPnl.dividedBy(totalTrades) : new Decimal(0);

    return {
      period: query.period,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_trades: totalTrades,
      win_trades: winTrades,
      loss_trades: lossTrades,
      win_rate: winRate.toFixed(4),
      total_pnl: totalPnl.toFixed(8),
      total_profit: totalProfit.toFixed(8),
      total_loss: totalLoss.toFixed(8),
      best_trade: bestTrade.toFixed(8),
      worst_trade: worstTrade.toFixed(8),
      avg_pnl_per_trade: avgPnl.toFixed(8),
      total_gas_fee: totalGasFee.toFixed(8),
    };
  }

  /**
   * 根据时间段类型计算日期范围
   */
  private calculateDateRange(query: PeriodStatsQueryDto): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    // 设置结束时间为今天的 23:59:59
    endDate.setHours(23, 59, 59, 999);

    switch (query.period) {
      case PeriodType.TODAY:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;

      case PeriodType.WEEK:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;

      case PeriodType.MONTH:
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;

      case PeriodType.CUSTOM:
        if (!query.start_date || !query.end_date) {
          throw new Error('自定义时间段必须指定开始日期和结束日期');
        }
        startDate = new Date(query.start_date);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(query.end_date);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        // 默认今日
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }
}
