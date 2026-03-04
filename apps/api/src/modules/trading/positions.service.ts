import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { TradingService } from './trading.service';
import { FeeService } from './fee.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  PositionResponse,
  PositionListResponse,
  TradeHistoryResponse,
  TradeHistoryQueryDto,
  ExecutionLogResponse,
  PnlStatsResponse,
} from './dto/position.dto';

/**
 * 从持仓记录推导策略名称（统一 fallback 逻辑）
 * 优先级: aiStrategy.name > subscription.strategy.name > source fallback
 */
function resolveStrategyName(
  aiStrategyName?: string | null,
  subscriptionStrategyName?: string | null,
  source?: string | null,
  symbol?: string,
): string | undefined {
  if (aiStrategyName) return aiStrategyName;
  if (subscriptionStrategyName) return subscriptionStrategyName;
  const coin = symbol?.split('/')[0] || '';
  if (source === 'ai_research') return `Research-${coin}`;
  if (source === 'ai_strategy') return `AI-${coin}`;
  return undefined;
}

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
    private feeService: FeeService,
  ) {}

  // 获取用户持仓列表（仅开仓状态）
  async findAll(userId: string): Promise<PositionListResponse> {
    const positions = await this.prisma.position.findMany({
      where: { userId, status: 'open' },
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: { include: { strategy: { select: { name: true } } } },
        aiStrategy: { select: { name: true } },
      },
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
        strategyName: resolveStrategyName(p.aiStrategy?.name, p.subscription?.strategy?.name, p.source, p.symbol),
        source: p.source || undefined,
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
      include: {
        subscription: { include: { strategy: { select: { name: true } } } },
        aiStrategy: { select: { name: true } },
      },
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
      strategyName: resolveStrategyName(p.aiStrategy?.name, p.subscription?.strategy?.name, p.source, p.symbol),
      source: p.source || undefined,
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

  /**
   * 解析 exchange-only 合成持仓 ID
   * 格式: exchange_{symbol}_{side}，其中 symbol 可含 / 和 :（如 ETH/USDT:USDT）
   */
  private parseExchangeOnlyId(positionId: string): { symbol: string; side: 'long' | 'short' } {
    const withoutPrefix = positionId.slice('exchange_'.length);
    if (withoutPrefix.endsWith('_long')) {
      return { symbol: withoutPrefix.slice(0, -5), side: 'long' };
    } else if (withoutPrefix.endsWith('_short')) {
      return { symbol: withoutPrefix.slice(0, -6), side: 'short' };
    }
    throw new NotFoundException(`无效的持仓 ID: ${positionId}`);
  }

  // 手动平仓
  async closePosition(
    userId: string,
    positionId: string,
    apiKeyId: string,
  ): Promise<PositionResponse> {
    // 处理 exchange-only 合成持仓（DB 中无记录，symbol 含 / 和 :）
    if (positionId.startsWith('exchange_')) {
      const { symbol, side } = this.parseExchangeOnlyId(positionId);
      this.logger.log(`手动平仓 exchange-only 持仓: ${symbol} ${side}`);

      // 从交易所获取最新持仓数据以确认存在并获取数量
      const exchangePositions = await this.tradingService.fetchPositions(userId, apiKeyId, symbol);
      const ep = exchangePositions.find((p: any) => (p.side as string) === side);

      if (!ep || Math.abs(parseFloat(ep.contracts || '0')) === 0) {
        throw new NotFoundException('交易所持仓不存在或已平仓');
      }

      const amount = Math.abs(parseFloat(ep.contracts));
      const result = await this.tradingService.closePosition(
        userId, apiKeyId, symbol, amount, side,
        { tradingType: 'futures' },
      );

      this.logger.log(`Exchange-only 平仓成功: ${symbol} ${side} 数量=${amount}`);
      return {
        id: positionId,
        exchange: result.exchange || 'binance',
        symbol,
        side,
        entryPrice: ep.entryPrice?.toString() || '0',
        amount: amount.toString(),
        status: 'closed',
        exchangeOrderId: result.orderId,
        createdAt: new Date(),
      };
    }

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

      // ===== 燃油费扣除（仅盈利时） =====
      if (pnl.gt(0)) {
        try {
          const feeCalc = await this.feeService.calculateFee(userId, pnl.toFixed(8));
          if (parseFloat(feeCalc.feeAmount) > 0) {
            const uniqueOrderId = this.feeService.generateUniqueOrderId('GAS_FEE', userId, positionId);
            await this.feeService.chargeFee({
              userId,
              positionId,
              profit: feeCalc.profit,
              feeRate: feeCalc.finalFeeRate,
              feeAmount: feeCalc.feeAmount,
              uniqueOrderId,
            });
            this.logger.log(`燃油费已扣除: ${position.symbol} 盈利=$${pnl.toFixed(2)} 费用=$${feeCalc.feeAmount}`);
          }
        } catch (feeErr) {
          this.logger.error(`燃油费扣除失败(非致命): ${(feeErr as Error).message}`);
        }
      }

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

  // 紧急清仓所有持仓（含 exchange-only 持仓）
  async emergencyCloseAll(
    userId: string,
    apiKeyId: string,
  ): Promise<{ closed: number; failed: number; results: PositionResponse[] }> {
    // 1. 获取 DB 活跃持仓
    const openPositions = await this.prisma.position.findMany({
      where: { userId, status: 'open' },
    });

    // 2. 获取交易所实际持仓（用于找出 exchange-only 的仓位）
    type ExchangeOnlyEntry = { symbol: string; side: 'long' | 'short'; contracts: number; entryPrice: number };
    let exchangeOnlyToClose: ExchangeOnlyEntry[] = [];
    try {
      const allExchangePositions = await this.tradingService.fetchPositions(userId, apiKeyId);
      const dbSymbolSideSet = new Set(openPositions.map(p => `${p.symbol}_${p.side}`));
      exchangeOnlyToClose = allExchangePositions
        .filter((ep: any) => !dbSymbolSideSet.has(`${ep.symbol}_${ep.side}`))
        .map((ep: any) => ({
          symbol: ep.symbol as string,
          side: ep.side as 'long' | 'short',
          contracts: Math.abs(parseFloat(ep.contracts || '0')),
          entryPrice: parseFloat(ep.entryPrice || '0'),
        }))
        .filter((ep: ExchangeOnlyEntry) => ep.contracts > 0);
    } catch (err) {
      this.logger.warn(`紧急清仓: 获取交易所持仓失败，仅清 DB 持仓: ${(err as Error).message}`);
    }

    const totalCount = openPositions.length + exchangeOnlyToClose.length;
    if (totalCount === 0) {
      return { closed: 0, failed: 0, results: [] };
    }

    this.logger.warn(
      `紧急清仓: 用户 ${userId} — DB持仓 ${openPositions.length} 个 + exchange-only ${exchangeOnlyToClose.length} 个`,
    );

    let closed = 0;
    let failed = 0;
    const results: PositionResponse[] = [];

    // 3. 逐个平仓 DB 持仓
    for (const position of openPositions) {
      try {
        const result = await this.closePosition(userId, position.id, apiKeyId);
        closed++;
        results.push(result);
      } catch (error) {
        failed++;
        this.logger.error(`清仓失败 ${position.id}: ${error}`);
      }
    }

    // 4. 逐个平仓 exchange-only 持仓
    for (const ep of exchangeOnlyToClose) {
      try {
        const result = await this.tradingService.closePosition(
          userId, apiKeyId, ep.symbol, ep.contracts, ep.side,
          { tradingType: 'futures' },
        );
        closed++;
        results.push({
          id: `exchange_${ep.symbol}_${ep.side}`,
          exchange: result.exchange || 'binance',
          symbol: ep.symbol,
          side: ep.side,
          entryPrice: ep.entryPrice.toString(),
          amount: ep.contracts.toString(),
          status: 'closed',
          exchangeOrderId: result.orderId,
          createdAt: new Date(),
        });
      } catch (error) {
        failed++;
        this.logger.error(`Exchange-only 清仓失败 ${ep.symbol} ${ep.side}: ${error}`);
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

    const where: Prisma.PositionWhereInput = {
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
        where.closedAt = { ...((where.closedAt as Prisma.DateTimeNullableFilter) ?? {}), gte: new Date(startDate) };
      }
      if (endDate) {
        where.closedAt = { ...((where.closedAt as Prisma.DateTimeNullableFilter) ?? {}), lte: new Date(endDate) };
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
          aiStrategy: { select: { name: true } },
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
        strategyName: resolveStrategyName(p.aiStrategy?.name, p.subscription?.strategy?.name, p.source, p.symbol),
        source: p.source || undefined,
      };
    });

    return { items, total };
  }

  // 获取执行日志（合并 SignalExecution + AiStrategyLog + AI Research 持仓记录）
  async getExecutionLogs(
    userId: string,
    limit = 50,
    actionsOnly = true,
  ): Promise<ExecutionLogResponse[]> {
    const logs: ExecutionLogResponse[] = [];

    // === 来源 1: SignalExecution（Freqtrade 信号系统）===
    const executions = await this.prisma.signalExecution.findMany({
      where: {
        userId,
        ...(actionsOnly ? { status: { in: ['success', 'failed'] } } : {}),
      },
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

    for (const exec of executions) {
      let status: 'success' | 'warning' | 'error' = 'success';
      let action = 'execute';
      let message = '';

      if (exec.status === 'success') {
        status = 'success';
        action = exec.signal.side === 'buy' ? 'open_long' : 'close';
        message = `Signal: ${action} ${exec.executedAmount || '?'} ${exec.signal.symbol}`;
      } else if (exec.status === 'skipped') {
        status = 'warning';
        action = 'skip';
        message = exec.skipReason || 'Signal skipped';
      } else if (exec.status === 'failed') {
        status = 'error';
        action = 'fail';
        message = this.translateExchangeError(exec.errorMessage) || 'Execution failed';
      } else {
        status = 'warning';
        action = 'wait';
        message = 'Waiting for execution';
      }

      const tradeLog = tradeLogMap.get(exec.signalId);
      logs.push({
        id: exec.id,
        time: exec.completedAt || exec.createdAt,
        strategy: exec.signal.strategy?.name || 'Unknown',
        action,
        symbol: exec.signal.symbol,
        status,
        message,
        orderId: exec.orderId || undefined,
        executedPrice: exec.executedPrice?.toString() || undefined,
        executedAmount: exec.executedAmount?.toString() || undefined,
        errorCode: exec.errorCode || undefined,
        skipReason: exec.skipReason || undefined,
        slippage: tradeLog?.slippagePercent?.toString() || undefined,
        durationMs: tradeLog?.durationMs || undefined,
        strategyType: 'signal',
      });
    }

    // === 来源 2: AiStrategyLog（AI 产品 B 策略日志）===
    // 注意：不在 DB 层做 JSON path 过滤（部分 PostgreSQL 版本会报错），改为取回后在代码里过滤
    const aiLogs = await this.prisma.aiStrategyLog.findMany({
      where: {
        strategy: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 3, // 多取一些，代码过滤后再截取
      include: { strategy: { select: { name: true, coinSourceConfig: true } } },
    });

    // 规范化 symbol: "ETH/USDT:USDT" → "ETH/USDT"
    const normSym = (s: string) => s?.replace(/:[\w]+$/, '') || s;

    for (const log of aiLogs) {
      const decision = log.decision as Record<string, any> || {};
      const execResult = log.executionResult as Record<string, any> || {};
      // 兼容旧 Grid 日志（无 action 字段但有 decisions 数组）
      const isGridLog = Array.isArray(decision.decisions);
      const actionStr = decision.action || (isGridLog ? 'adjust_grid' : 'unknown');

      // actionsOnly 过滤：wait/hold 跳过（在代码层处理，避免 DB JSON path 兼容性问题）
      if (actionsOnly && (actionStr === 'wait' || actionStr === 'hold')) continue;
      const isOpen = actionStr.startsWith('open');
      const isClose = actionStr.startsWith('close');
      // symbol 回退: 日志字段 → 策略的第一个 coin
      const coinCfg = log.strategy?.coinSourceConfig as Record<string, any> | null;
      const fallbackSym = (coinCfg?.coins as string[])?.[0] || '';
      const sym = normSym(log.symbol || fallbackSym);

      let status: 'success' | 'warning' | 'error';
      let action: string;
      let message: string;

      if (log.executed) {
        status = 'success';
        action = actionStr;

        if (isGridLog) {
          // Grid 日志: 显示操作摘要（语言无关格式）
          let summary = decision.gridSummary;
          if (!summary && Array.isArray(decision.decisions)) {
            const buys = decision.decisions.filter((d: any) => d.action === 'place_buy_limit').length;
            const sells = decision.decisions.filter((d: any) => d.action === 'place_sell_limit').length;
            const cancels = decision.decisions.filter((d: any) => d.action === 'cancel_order').length;
            const parts: string[] = [];
            if (buys) parts.push(`${buys}B`);
            if (sells) parts.push(`${sells}S`);
            if (cancels) parts.push(`${cancels}C`);
            summary = parts.join('/') || `${decision.decisions.length}ops`;
          }
          message = `AI: ${actionStr} ${sym} ${summary || ''}`.trim();
        } else {
          message = `AI: ${actionStr} ${sym}` +
            (execResult.orderId ? ` #${execResult.orderId}` : '') +
            (decision.confidence ? ` conf=${decision.confidence}%` : '');
        }
      } else if (execResult?.error) {
        status = 'error';
        action = 'fail';
        message = `${sym} ${this.translateExchangeError(execResult.error) || execResult.error}`;
      } else if (actionStr === 'hold' || actionStr === 'wait') {
        status = 'warning';
        action = actionStr;
        message = `AI: ${actionStr} ${sym}`;
      } else {
        status = 'warning';
        action = actionStr;
        message = `AI: ${actionStr} ${sym}`;
      }

      logs.push({
        id: log.id,
        time: log.createdAt,
        strategy: log.strategy?.name || 'AI Strategy',
        action,
        symbol: log.symbol,
        status,
        message,
        orderId: execResult?.orderId || undefined,
        executedPrice: execResult?.price?.toString() || undefined,
        executedAmount: execResult?.amount?.toString() || undefined,
        // AI 决策详情
        confidence: decision.confidence || undefined,
        leverage: decision.leverage || undefined,
        positionSizePercent: decision.positionSizePercent || undefined,
        stopLoss: decision.stopLoss || undefined,
        takeProfit: decision.takeProfit || undefined,
        reasoning: decision.reasoning || undefined,
        blockedBy: execResult?.blockedBy || undefined,
        blockReason: execResult?.blocked ? (execResult.reason || undefined) : undefined,
        votes: decision.votes?.map((v: any) => ({
          modelId: v.modelId,
          action: v.action,
          confidence: v.confidence,
          reasoning: v.reasoning,
        })) || undefined,
        // Grid 专属字段
        ...(isGridLog ? (() => {
          const decs = decision.decisions as any[] || [];
          const buys = decs.filter((d: any) => d.action === 'place_buy_limit');
          const sells = decs.filter((d: any) => d.action === 'place_sell_limit');
          const fmtRange = (orders: any[]) => {
            if (!orders.length) return undefined;
            const prices = orders.map((o: any) => Number(o.price)).filter(Boolean).sort((a, b) => a - b);
            if (!prices.length) return undefined;
            return prices.length === 1
              ? `$${prices[0]}`
              : `$${prices[0]}~$${prices[prices.length - 1]}`;
          };
          return {
            gridSummary: decision.gridSummary || undefined,
            gridBuyRange: fmtRange(buys),
            gridSellRange: fmtRange(sells),
            gridOrderCount: decs.length,
          };
        })() : {}),
        // 策略类型标识
        strategyType: isGridLog ? 'grid' as const : decision.votes ? 'debate' as const : 'solo' as const,
      });
    }

    // === 来源 3: Position（AI Research 产品 A 的开仓/平仓记录）===
    const aiPositions = await this.prisma.position.findMany({
      where: {
        userId,
        source: { in: ['ai_research', 'ai_analysis'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { aiStrategy: { select: { name: true } } },
    });

    for (const pos of aiPositions) {
      const sym = normSym(pos.symbol);
      // 开仓日志
      logs.push({
        id: `pos_open_${pos.id}`,
        time: pos.createdAt,
        strategy: 'AI Research',
        action: pos.side === 'long' ? 'open_long' : 'open_short',
        symbol: pos.symbol,
        status: 'success',
        message: `Research: ${pos.side === 'long' ? 'open_long' : 'open_short'} ${sym} ×${pos.leverage || 1} qty=${pos.amount}`,
        orderId: pos.exchangeOrderId || undefined,
        executedPrice: pos.entryPrice?.toString(),
        executedAmount: pos.amount?.toString(),
        strategyType: 'research',
      });

      // 平仓日志（如果已平仓）
      if (pos.status === 'closed' && pos.closedAt) {
        const pnl = pos.pnl ? Number(pos.pnl) : 0;
        const pnlSign = pnl >= 0 ? '+' : '';
        logs.push({
          id: `pos_close_${pos.id}`,
          time: pos.closedAt,
          strategy: 'AI Research',
          action: 'close',
          symbol: pos.symbol,
          status: pnl >= 0 ? 'success' : 'error',
          message: `Research: close ${sym} PnL: ${pnlSign}${pnl.toFixed(2)} USDT` +
            (pos.closeReason ? ` (${pos.closeReason})` : ''),
          executedPrice: pos.closePrice?.toString(),
          executedAmount: pos.amount?.toString(),
          strategyType: 'research',
        });
      }
    }

    // 按时间降序排序，截取 limit 条
    logs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return logs.slice(0, limit);
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
    if (msg.includes('初始化') || msg.includes('initialize')) {
      return '交易所适配器初始化失败，请检查 API Key';
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
      todayRealizedPnl: todayPnl.toFixed(2),
      weekPnl: weekPnl.toFixed(2),
      monthPnl: monthPnl.toFixed(2),
      unrealizedPnl: unrealizedPnl.toFixed(2),
      tradeCount,
      winRate,
    };
  }
}
