import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService } from './trading.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  PositionResponse,
  PositionListResponse,
  TradeHistoryResponse,
  TradeHistoryQueryDto,
  ExecutionLogResponse,
  PnlStatsResponse,
} from './dto/position.dto';

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
  ) {}

  // 获取用户持仓列表（仅开仓状态）
  async findAll(userId: string): Promise<PositionListResponse> {
    const positions = await this.prisma.position.findMany({
      where: { userId, status: 'open' },
      orderBy: { createdAt: 'desc' },
    });

    // 计算总 PnL
    let totalPnl = new Decimal(0);

    const items: PositionResponse[] = positions.map((p) => {
      const pnl = p.pnl ? new Decimal(p.pnl.toString()) : new Decimal(0);
      if (p.status === 'closed') {
        totalPnl = totalPnl.plus(pnl);
      }

      return {
        id: p.id,
        exchange: p.exchange,
        symbol: p.symbol,
        side: p.side,
        entryPrice: p.entryPrice.toString(),
        amount: p.amount.toString(),
        pnl: p.pnl?.toString(),
        status: p.status,
        exchangeOrderId: p.exchangeOrderId || undefined,
        createdAt: p.createdAt,
        // 交易配置
        tradingType: p.tradingType || 'spot',
        leverage: p.leverage || 1,
        margin: p.margin?.toString() || '0',
        marginMode: p.marginMode || 'cross',
        // 实时数据（同步自交易所）
        markPrice: p.markPrice?.toString() || undefined,
        liquidationPrice: p.liquidationPrice?.toString() || undefined,
        unrealizedPnl: p.unrealizedPnl?.toString() || undefined,
        marginRatio: p.marginRatio?.toString() || undefined,
        lastSyncAt: p.lastSyncAt || undefined,
      };
    });

    return {
      items,
      total: positions.length,
      totalPnl: totalPnl.toString(),
    };
  }

  // 获取活跃持仓
  async getOpenPositions(userId: string): Promise<PositionResponse[]> {
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'open',
      },
      orderBy: { createdAt: 'desc' },
    });

    return positions.map((p) => ({
      id: p.id,
      exchange: p.exchange,
      symbol: p.symbol,
      side: p.side,
      entryPrice: p.entryPrice.toString(),
      amount: p.amount.toString(),
      status: p.status,
      exchangeOrderId: p.exchangeOrderId || undefined,
      createdAt: p.createdAt,
      // 交易配置
      tradingType: p.tradingType || 'spot',
      leverage: p.leverage || 1,
      margin: p.margin?.toString() || '0',
      marginMode: p.marginMode || 'cross',
      // 实时数据（同步自交易所）
      markPrice: p.markPrice?.toString() || undefined,
      liquidationPrice: p.liquidationPrice?.toString() || undefined,
      unrealizedPnl: p.unrealizedPnl?.toString() || undefined,
      marginRatio: p.marginRatio?.toString() || undefined,
      lastSyncAt: p.lastSyncAt || undefined,
    }));
  }

  // 通过 Telegram ID 获取持仓（TG Bot 使用）
  async getPositionsByTelegramId(
    telegramId: string,
  ): Promise<PositionResponse[]> {
    // 先查找用户
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });

    if (!user) {
      return [];
    }

    // 获取活跃持仓
    const positions = await this.prisma.position.findMany({
      where: {
        userId: user.id,
        status: 'open',
      },
      orderBy: { createdAt: 'desc' },
    });

    return positions.map((p) => ({
      id: p.id,
      exchange: p.exchange,
      symbol: p.symbol,
      side: p.side,
      entryPrice: p.entryPrice.toString(),
      amount: p.amount.toString(),
      pnl: p.pnl?.toString(),
      status: p.status,
      exchangeOrderId: p.exchangeOrderId || undefined,
      createdAt: p.createdAt,
    }));
  }

  // 通过 Telegram ID 获取收益统计（TG Bot 使用）
  async getEarningsByTelegramId(telegramId: string) {
    // 先查找用户
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });

    if (!user) {
      return {
        todayPnl: '0',
        weekPnl: '0',
        monthPnl: '0',
        totalPnl: '0',
        tradeCount: 0,
        winRate: '0',
      };
    }

    // 获取所有已平仓的持仓
    const closedPositions = await this.prisma.position.findMany({
      where: {
        userId: user.id,
        status: 'closed',
        pnl: { not: null },
      },
      select: {
        pnl: true,
        closedAt: true,
      },
    });

    // 计算时间范围
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    let todayPnl = new Decimal(0);
    let weekPnl = new Decimal(0);
    let monthPnl = new Decimal(0);
    let totalPnl = new Decimal(0);
    let winCount = 0;

    for (const pos of closedPositions) {
      const pnl = new Decimal(pos.pnl!.toString());
      totalPnl = totalPnl.plus(pnl);

      if (pnl.gt(0)) {
        winCount++;
      }

      if (pos.closedAt) {
        if (pos.closedAt >= todayStart) {
          todayPnl = todayPnl.plus(pnl);
        }
        if (pos.closedAt >= weekStart) {
          weekPnl = weekPnl.plus(pnl);
        }
        if (pos.closedAt >= monthStart) {
          monthPnl = monthPnl.plus(pnl);
        }
      }
    }

    const tradeCount = closedPositions.length;
    const winRate =
      tradeCount > 0 ? ((winCount / tradeCount) * 100).toFixed(1) : '0';

    return {
      todayPnl: todayPnl.toFixed(2),
      weekPnl: weekPnl.toFixed(2),
      monthPnl: monthPnl.toFixed(2),
      totalPnl: totalPnl.toFixed(2),
      tradeCount,
      winRate,
    };
  }

  // 手动平仓
  async closePosition(
    userId: string,
    positionId: string,
    apiKeyId: string,
  ): Promise<PositionResponse> {
    // 查找持仓
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new NotFoundException('持仓不存在');
    }

    if (position.userId !== userId) {
      throw new ForbiddenException('无权操作此持仓');
    }

    if (position.status !== 'open') {
      throw new ForbiddenException('持仓已关闭');
    }

    this.logger.log(`手动平仓: ${positionId}`);

    try {
      // 执行平仓
      const result = await this.tradingService.closePosition(
        userId,
        apiKeyId,
        position.symbol,
        parseFloat(position.amount.toString()),
        position.side as 'long' | 'short',
      );

      // 计算盈亏
      const entryPrice = new Decimal(position.entryPrice.toString());
      const closePrice = new Decimal(result.price);
      const amount = new Decimal(position.amount.toString());

      let pnl: Decimal;
      if (position.side === 'long') {
        pnl = closePrice.minus(entryPrice).times(amount);
      } else {
        pnl = entryPrice.minus(closePrice).times(amount);
      }

      // 更新持仓状态
      const updated = await this.prisma.position.update({
        where: { id: positionId },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closePrice: closePrice,
          pnl: pnl,
        },
      });

      return {
        id: updated.id,
        exchange: updated.exchange,
        symbol: updated.symbol,
        side: updated.side,
        entryPrice: updated.entryPrice.toString(),
        amount: updated.amount.toString(),
        pnl: updated.pnl?.toString(),
        status: updated.status,
        exchangeOrderId: updated.exchangeOrderId || undefined,
        createdAt: updated.createdAt,
      };
    } catch (error) {
      this.logger.error(`平仓失败: ${error}`);
      throw error;
    }
  }

  // 紧急清仓所有持仓
  async emergencyCloseAll(
    userId: string,
    apiKeyId: string,
  ): Promise<{ closed: number; failed: number; results: PositionResponse[] }> {
    // 获取所有活跃持仓
    const openPositions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'open',
      },
    });

    if (openPositions.length === 0) {
      return { closed: 0, failed: 0, results: [] };
    }

    this.logger.warn(
      `紧急清仓: 用户 ${userId} 共 ${openPositions.length} 个持仓`,
    );

    let closed = 0;
    let failed = 0;
    const results: PositionResponse[] = [];

    // 逐个平仓
    for (const position of openPositions) {
      try {
        const result = await this.closePosition(userId, position.id, apiKeyId);
        closed++;
        results.push(result);
      } catch (error) {
        failed++;
        this.logger.error(`清仓失败 ${position.id}: ${error}`);
        // 继续处理其他持仓
      }
    }

    this.logger.warn(`紧急清仓完成: 成功 ${closed}, 失败 ${failed}`);
    return { closed, failed, results };
  }

  // 获取交易历史（已平仓的持仓）
  async getTradeHistory(
    userId: string,
    query: TradeHistoryQueryDto,
  ): Promise<{ items: TradeHistoryResponse[]; total: number }> {
    const { page = 1, limit = 20, symbol, side, startDate, endDate } = query;

    const where: any = {
      userId,
      status: 'closed',
    };

    if (symbol) {
      where.symbol = { contains: symbol, mode: 'insensitive' };
    }

    if (side) {
      where.side = side;
    }

    if (startDate || endDate) {
      where.closedAt = {};
      if (startDate) {
        where.closedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.closedAt.lte = new Date(endDate);
      }
    }

    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
        where,
        orderBy: { closedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          subscription: {
            include: {
              strategy: true,
            },
          },
        },
      }),
      this.prisma.position.count({ where }),
    ]);

    const items: TradeHistoryResponse[] = positions.map((p) => {
      const entryPrice = new Decimal(p.entryPrice.toString());
      const closePrice = p.closePrice
        ? new Decimal(p.closePrice.toString())
        : entryPrice;
      const amount = new Decimal(p.amount.toString());
      const pnl = p.pnl ? new Decimal(p.pnl.toString()) : new Decimal(0);

      // 计算名义价值
      const margin = p.margin
        ? new Decimal(p.margin.toString())
        : new Decimal(0);
      const leverage = p.leverage || 1;
      const notional = margin.times(leverage);

      // 计算收益率：PnL / 保证金 * 100%
      const pnlPercent = margin.gt(0)
        ? pnl.div(margin).times(100).toFixed(2)
        : '0';

      return {
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        type: 'market', // 目前都是市价单
        price: closePrice.toString(), // 保持兼容
        entryPrice: entryPrice.toString(),
        closePrice: closePrice.toString(),
        amount: amount.toString(),
        total: notional.toFixed(2),
        pnl: pnl.toString(),
        pnlPercent,
        fee: '0', // 手续费需要从其他表获取
        status: 'filled',
        closedAt: p.closedAt || p.updatedAt,
        createdAt: p.createdAt,
        // 交易配置
        tradingType: p.tradingType || 'futures',
        leverage: leverage,
        margin: margin.toString(),
        marginMode: p.marginMode || 'cross',
        closeReason: p.closeReason || undefined,
        strategyName: p.subscription?.strategy?.name || undefined,
      };
    });

    return { items, total };
  }

  // 获取执行日志
  async getExecutionLogs(
    userId: string,
    limit = 50,
  ): Promise<ExecutionLogResponse[]> {
    // 从 SignalExecution 获取执行日志
    const executions = await this.prisma.signalExecution.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        signal: {
          include: {
            strategy: true,
          },
        },
      },
    });

    // 批量查询关联的 TradeExecutionLog（获取滑点、耗时等）
    const signalIds = executions.map((e) => e.signalId).filter(Boolean);
    const tradeLogs =
      signalIds.length > 0
        ? await this.prisma.tradeExecutionLog.findMany({
            where: { signalId: { in: signalIds }, userId },
            select: {
              signalId: true,
              slippagePercent: true,
              durationMs: true,
              configSnapshot: true,
            },
          })
        : [];
    const tradeLogMap = new Map(
      tradeLogs.map((log) => [log.signalId, log]),
    );

    return executions.map((exec) => {
      let status: 'success' | 'warning' | 'error' = 'success';
      let action = '执行';
      let message = '';

      if (exec.status === 'success') {
        status = 'success';
        action = exec.signal.side === 'buy' ? '开多' : '平仓';
        message = exec.signal.side === 'buy'
          ? `信号触发，已开多 ${exec.executedAmount || '?'} ${exec.signal.symbol}`
          : `信号触发，已平仓 ${exec.executedAmount || '?'} ${exec.signal.symbol}`;
      } else if (exec.status === 'skipped') {
        status = 'warning';
        action = '跳过';
        message = exec.skipReason || '信号已跳过';
      } else if (exec.status === 'failed') {
        status = 'error';
        action = '失败';
        message = this.translateExchangeError(exec.errorMessage) || '执行失败';
      } else {
        status = 'warning';
        action = '等待';
        message = '等待执行';
      }

      // 合并 TradeExecutionLog 数据
      const tradeLog = tradeLogMap.get(exec.signalId);

      return {
        id: exec.id,
        time: exec.completedAt || exec.createdAt,
        strategy: exec.signal.strategy?.name || '未知策略',
        action,
        symbol: exec.signal.symbol,
        status,
        message,
        // 执行详情（来自 SignalExecution）
        orderId: exec.orderId || undefined,
        executedPrice: exec.executedPrice?.toString() || undefined,
        executedAmount: exec.executedAmount?.toString() || undefined,
        errorCode: exec.errorCode || undefined,
        skipReason: exec.skipReason || undefined,
        // 执行详情（来自 TradeExecutionLog）
        slippage: tradeLog?.slippagePercent?.toString() || undefined,
        durationMs: tradeLog?.durationMs || undefined,
      };
    });
  }

  // 将交易所英文错误消息翻译为中文
  private translateExchangeError(errorMessage: string | null): string {
    if (!errorMessage) return '执行失败';

    const msg = errorMessage.toLowerCase();

    // 常见交易所错误翻译映射
    if (msg.includes('insufficient balance') || msg.includes('insufficient fund')) {
      return '交易所账户余额不足';
    }
    if (msg.includes('not all sent parameters were read')) {
      return '交易所接口参数错误（已修复）';
    }
    if (msg.includes('invalid symbol') || msg.includes('symbol not found')) {
      return '无效的交易对';
    }
    if (msg.includes('order would immediately trigger')) {
      return '订单会立即触发（价格超出范围）';
    }
    if (msg.includes('market is closed') || msg.includes('trading is not active')) {
      return '市场已关闭，暂停交易';
    }
    if (msg.includes('too many request') || msg.includes('rate limit')) {
      return '请求频率过高，已被限流';
    }
    if (msg.includes('api key') || msg.includes('apikey') || msg.includes('invalid key')) {
      return 'API Key 无效或已过期';
    }
    if (msg.includes('signature') || msg.includes('authentication')) {
      return 'API 签名验证失败';
    }
    if (msg.includes('permission') || msg.includes('unauthorized')) {
      return 'API Key 权限不足';
    }
    if (msg.includes('minimum') || msg.includes('min notional') || msg.includes('lot size')) {
      return '下单数量低于最小限额';
    }
    if (msg.includes('maximum') || msg.includes('max')) {
      return '下单数量超过最大限额';
    }
    if (msg.includes('position side does not match')) {
      return '持仓方向不匹配';
    }
    if (msg.includes('reduce only')) {
      return '仅限减仓操作';
    }
    if (msg.includes('leverage') && msg.includes('not valid')) {
      return '杠杆倍数设置无效';
    }
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnreset')) {
      return '网络连接超时，请重试';
    }
    if (msg.includes('no position') || msg.includes('position not found')) {
      return '未找到持仓';
    }

    // 未匹配的保留原文
    return errorMessage;
  }

  // 获取盈亏统计
  async getPnlStats(userId: string): Promise<PnlStatsResponse> {
    // 获取所有已平仓的持仓
    const closedPositions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'closed',
        pnl: { not: null },
      },
      select: {
        pnl: true,
        closedAt: true,
      },
    });

    // 获取所有活跃持仓计算未实现盈亏（优先用 unrealizedPnl，兜底用 pnl）
    const openPositions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'open',
      },
      select: {
        pnl: true,
        unrealizedPnl: true,
      },
    });

    // 计算时间范围
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    let todayPnl = new Decimal(0);
    let weekPnl = new Decimal(0);
    let monthPnl = new Decimal(0);
    let totalPnl = new Decimal(0);
    let winCount = 0;

    for (const pos of closedPositions) {
      const pnl = new Decimal(pos.pnl!.toString());
      totalPnl = totalPnl.plus(pnl);

      if (pnl.gt(0)) {
        winCount++;
      }

      if (pos.closedAt) {
        if (pos.closedAt >= todayStart) {
          todayPnl = todayPnl.plus(pnl);
        }
        if (pos.closedAt >= weekStart) {
          weekPnl = weekPnl.plus(pnl);
        }
        if (pos.closedAt >= monthStart) {
          monthPnl = monthPnl.plus(pnl);
        }
      }
    }

    // 计算未实现盈亏（优先使用同步的 unrealizedPnl）
    let unrealizedPnl = new Decimal(0);
    for (const pos of openPositions) {
      const upnl = pos.unrealizedPnl || pos.pnl;
      if (upnl) {
        unrealizedPnl = unrealizedPnl.plus(new Decimal(upnl.toString()));
      }
    }

    const tradeCount = closedPositions.length;
    const winRate =
      tradeCount > 0 ? ((winCount / tradeCount) * 100).toFixed(1) : '0';

    return {
      totalPnl: totalPnl.toFixed(2),
      todayPnl: todayPnl.toFixed(2),
      weekPnl: weekPnl.toFixed(2),
      monthPnl: monthPnl.toFixed(2),
      unrealizedPnl: unrealizedPnl.toFixed(2),
      tradeCount,
      winRate,
    };
  }
}
