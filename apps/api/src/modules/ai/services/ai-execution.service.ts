import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { FeeService } from '../../trading/fee.service';
import { toFuturesSymbol } from '../../../common/utils/symbol.util';
import { AiMemoryService } from './memory.service';
import { AdapterFactoryService } from '../../exchange-adapters/adapter-factory.service';
import { ExchangeAdapter } from '../../exchange-adapters/types/adapter.interface';
import { OrderResult } from '../../exchange-adapters/types/exchange.types';

// ========================= 类型定义 =========================

/**
 * AI 交易决策
 */
export interface AiDecision {
  symbol: string;
  action: 'open_long' | 'open_short' | 'close_long' | 'close_short' | 'hold' | 'wait';
  confidence: number; // 0-100
  leverage?: number;
  positionSizeUSD?: number; // 开仓大小（USDT）或百分比（<=20 视为百分比）
  stopLoss?: number | null; // 止损价
  takeProfit?: number | null; // 止盈价
  reasoning?: string;
  maxTradeAmountUSD?: number; // 单笔交易金额上限（来自策略 riskControlConfig）
  allocatedCapital?: number; // AI 资金池上限（USDT），百分比计算基于此值而非交易所全部余额
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  action: string;
  price?: number;
  amount?: number;
  positionId?: string;
  pnl?: number;
  error?: string;
}

/**
 * AI 持仓来源类型
 */
export type AiSource = 'ai_research' | 'ai_strategy';

// ========================= 常量: NoFx 代码强制风控 =========================

const MAX_POSITIONS = 3; // 最大同时持仓数
const MIN_POSITION_SIZE = 12; // 最小仓位 USDT
const BTC_ETH_MAX_RATIO = 5.0; // BTC/ETH 最大仓位/权益比
const ALT_MAX_RATIO = 1.0; // 山寨币最大仓位/权益比

/**
 * AI 交易执行服务
 *
 * 独立执行层 — 通过 ExchangeAdapter 接口执行 AI 决策
 * 支持 CEX (Binance/OKX/Bybit via CCXT) 和 DEX (Hyperliquid/Lighter/Aster)
 * 不走 BullMQ trade 队列，与 Freqtrade 信号系统完全隔离
 * 通过 Position.source 字段区分来源
 *
 * Phase 8.1 重构: ccxt.Exchange → ExchangeAdapter 统一接口
 *
 * 参考 NoFx auto_trader.go 设计：
 * - 3 个代码强制风控（MaxPositions, MinPositionSize, PositionValueRatio）
 * - 余额适配公式
 * - 决策排序（平仓优先）
 * - FIFO 平仓
 */
@Injectable()
export class AiExecutionService {
  private readonly logger = new Logger(AiExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterFactory: AdapterFactoryService,
    private readonly feeService: FeeService,
    private readonly memoryService: AiMemoryService,
  ) {}

  /**
   * 通用重试包装器（应对网络间歇性故障）
   */
  private async retryCall<T>(
    label: string,
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 2000,
  ): Promise<T> {
    let lastError: Error = new Error(`${label} failed`);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < maxRetries) {
          this.logger.warn(`${label} 失败(${attempt}/${maxRetries}): ${lastError.message}，重试中`);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    throw lastError;
  }

  // ========================= 核心方法 =========================

  /**
   * 统一入口：执行 AI 决策
   * 对应 NoFx executeDecisionWithRecord
   */
  async executeDecision(
    userId: string,
    apiKeyId: string,
    decision: AiDecision,
    source: AiSource,
    aiStrategyId?: string,
  ): Promise<ExecutionResult> {
    const { symbol, action } = decision;

    this.logger.log(
      `[AI执行] 用户=${userId} ${action} ${symbol} confidence=${decision.confidence}`,
    );

    try {
      // hold/wait 不执行交易
      if (action === 'hold' || action === 'wait') {
        return { success: true, symbol, action, error: undefined };
      }

      // 创建适配器（统一 CEX/DEX 接口）
      const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);

      // 路由到对应执行方法
      switch (action) {
        case 'open_long':
          return await this.openPosition(
            adapter, userId, apiKeyId, symbol, 'long', decision, source, aiStrategyId,
          );
        case 'open_short':
          return await this.openPosition(
            adapter, userId, apiKeyId, symbol, 'short', decision, source, aiStrategyId,
          );
        case 'close_long':
          return await this.closePosition(
            adapter, userId, symbol, 'long', source,
          );
        case 'close_short':
          return await this.closePosition(
            adapter, userId, symbol, 'short', source,
          );
        default:
          return { success: false, symbol, action, error: `不支持的动作: ${action}` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`[AI执行] 失败: ${symbol} ${action} - ${msg}`);
      return { success: false, symbol, action, error: msg };
    }
  }

  /**
   * 开仓
   * 对应 NoFx executeOpenLongWithRecord / executeOpenShortWithRecord
   */
  private async openPosition(
    adapter: ExchangeAdapter,
    userId: string,
    apiKeyId: string,
    symbol: string,
    side: 'long' | 'short',
    decision: AiDecision,
    source: AiSource,
    aiStrategyId?: string,
  ): Promise<ExecutionResult> {
    const futuresSymbol = toFuturesSymbol(symbol);
    const leverage = decision.leverage || 5;
    const rawPositionSize = decision.positionSizeUSD || 50;

    // 1. 获取当前 AI 持仓数
    const currentPositions = await this.prisma.position.count({
      where: {
        userId,
        source: { in: ['ai_research', 'ai_strategy', 'ai_analysis'] },
        status: 'open',
      },
    });

    // 2. 代码强制风控
    this.enforceMaxPositions(currentPositions);

    // 3. 获取期货账户余额（通过适配器，带重试）
    const balance = await this.retryCall('getBalance', () => adapter.getBalance());
    const exchangeBalance = balance.availableBalance;

    // 3.2 AI 资金池限制
    // 用户设定 allocatedCapital（如 $500），百分比计算基于此值而非交易所全部余额
    // 未设定时使用交易所全部可用余额
    const allocatedCapital = decision.allocatedCapital;
    const availableBalance = (allocatedCapital && allocatedCapital > 0)
      ? Math.min(exchangeBalance, allocatedCapital)
      : exchangeBalance;

    if (allocatedCapital && allocatedCapital > 0 && exchangeBalance > allocatedCapital) {
      this.logger.log(
        `[AI执行] 资金池限制: 交易所余额 $${exchangeBalance.toFixed(2)}, AI 资金池 $${allocatedCapital}, 使用 $${availableBalance.toFixed(2)}`,
      );
    }

    // 3.5 百分比 → USD 转换
    // 上游输出 positionSizePercent（1-20 范围），<= 20 视为百分比并基于 availableBalance 转换
    let positionSizeUSD = rawPositionSize;
    if (rawPositionSize <= 20) {
      positionSizeUSD = availableBalance * (rawPositionSize / 100);
      this.logger.log(
        `[AI执行] 仓位百分比转换: ${rawPositionSize}% × $${availableBalance.toFixed(2)} = $${positionSizeUSD.toFixed(2)}`,
      );
    }
    // 保底：如果计算后仓位低于最小限制，自动提升到最小限制
    // 后续的 enforcePositionValueRatio + adaptPositionToBalance 会确保不超过可承受范围
    if (positionSizeUSD < MIN_POSITION_SIZE) {
      this.logger.log(
        `[AI执行] 仓位 $${positionSizeUSD.toFixed(2)} 低于最小 $${MIN_POSITION_SIZE}，自动提升`,
      );
      positionSizeUSD = MIN_POSITION_SIZE;
    }

    // 3.8 单笔交易金额上限（用户可配置）
    // 来源: 策略 riskControlConfig.maxTradeAmountUSD → 通过 decision.maxTradeAmountUSD 传入
    // 未设置时由后续的 enforcePositionValueRatio + adaptPositionToBalance 自然约束
    const maxTradeAmountUSD = decision.maxTradeAmountUSD;
    if (maxTradeAmountUSD && maxTradeAmountUSD > 0 && positionSizeUSD > maxTradeAmountUSD) {
      this.logger.log(
        `[AI执行] 仓位 $${positionSizeUSD.toFixed(2)} 超过用户设定上限 $${maxTradeAmountUSD}，截断`,
      );
      positionSizeUSD = maxTradeAmountUSD;
    }

    // 4. 仓位价值比约束
    const cappedSize = this.enforcePositionValueRatio(
      positionSizeUSD, availableBalance, symbol,
    );

    // 5. 余额适配（NoFx 精确公式）
    const adaptedSize = this.adaptPositionToBalance(
      availableBalance, cappedSize, leverage,
    );

    // 6. 最小仓位检查
    this.enforceMinPositionSize(adaptedSize);

    // 7. 开仓前取消该币种已有订单（防止重复下单）
    try {
      await adapter.cancelAllOrders(futuresSymbol);
    } catch (e: any) {
      this.logger.warn(`取消已有订单失败(非致命): ${e.message}`);
    }

    // 8. 设置杠杆和保证金模式（适配器内部处理"已设置"等错误）
    try {
      await adapter.setLeverage(futuresSymbol, leverage);
    } catch (e: any) {
      this.logger.warn(`设置杠杆失败(可忽略): ${e.message}`);
    }
    try {
      await adapter.setMarginMode(futuresSymbol, true); // true = cross
    } catch (e: any) {
      this.logger.warn(`设置保证金模式失败(可忽略): ${e.message}`);
    }

    // 9. 获取当前价格并计算下单数量
    const currentPrice = await this.retryCall('getMarketPrice', () =>
      adapter.getMarketPrice(futuresSymbol),
    );
    const rawQuantity = adaptedSize / currentPrice;
    const formattedQty = await adapter.formatQuantity(futuresSymbol, rawQuantity);
    const quantity = parseFloat(formattedQty);

    if (quantity <= 0) {
      throw new Error(`计算后下单数量为 0: size=${adaptedSize} price=${currentPrice}`);
    }

    // 10. 通过适配器下单（适配器内部处理 leverage + 订单创建）
    this.logger.log(
      `[AI执行] 下单: ${futuresSymbol} ${side} qty=${quantity} leverage=${leverage}`,
    );
    const result = await this.retryCall<OrderResult>('openPosition', () =>
      side === 'long'
        ? adapter.openLong(futuresSymbol, quantity, leverage)
        : adapter.openShort(futuresSymbol, quantity, leverage),
    );

    const filledPrice = result.avgPrice || currentPrice;
    const filledAmount = result.filledQuantity || quantity;

    // 11. 部分成交检查
    if (filledAmount < quantity * 0.95) {
      this.logger.warn(
        `[AI执行] 部分成交: 预期=${quantity} 实际=${filledAmount} (${(filledAmount / quantity * 100).toFixed(1)}%)`,
      );
    }

    // 如果成交不足 50%，视为执行失败并中止
    if (filledAmount > 0 && filledAmount < quantity * 0.5) {
      throw new Error(
        `部分成交不足 50%: 预期=${quantity} 实际=${filledAmount} (${(filledAmount / quantity * 100).toFixed(1)}%)，中止开仓`,
      );
    }

    // 如果完全未成交（极端情况），中止
    if (filledAmount <= 0) {
      throw new Error(`订单未成交: orderId=${result.orderId} status=${result.status}`);
    }

    // 12. 计算保证金
    const margin = new Decimal(filledPrice).times(filledAmount).div(leverage);

    // 13. 创建 Position 记录（exchange 从适配器获取，支持 CEX/DEX）
    const position = await this.prisma.position.create({
      data: {
        userId,
        exchange: adapter.exchangeType,
        symbol: futuresSymbol,
        side,
        entryPrice: new Decimal(filledPrice).toFixed(8),
        amount: new Decimal(filledAmount).toFixed(8),
        tradingType: 'futures',
        leverage,
        margin: margin.toFixed(8),
        marginMode: 'cross',
        exchangeOrderId: result.orderId,
        apiKeyId,
        source,
        status: 'open',
        ...(result.txHash ? { txHash: result.txHash } : {}),
        ...(aiStrategyId ? { aiStrategyId } : {}),
      },
    });

    // 14. 设置止损/止盈（通过适配器）
    if (decision.stopLoss) {
      try {
        await adapter.setStopLoss(futuresSymbol, side, filledAmount, decision.stopLoss);
      } catch (e: any) {
        this.logger.warn(`设置止损失败: ${e.message}`);
      }
    }

    if (decision.takeProfit) {
      try {
        await adapter.setTakeProfit(futuresSymbol, side, filledAmount, decision.takeProfit);
      } catch (e: any) {
        this.logger.warn(`设置止盈失败: ${e.message}`);
      }
    }

    this.logger.log(
      `[AI执行] 开仓成功: ${futuresSymbol} ${side} price=${filledPrice} qty=${filledAmount} positionId=${position.id}`,
    );

    return {
      success: true,
      orderId: result.orderId,
      symbol: futuresSymbol,
      action: `open_${side}`,
      price: filledPrice,
      amount: filledAmount,
      positionId: position.id,
    };
  }

  /**
   * 平仓（FIFO — 先开先平）
   * 对应 NoFx executeCloseLongWithRecord / executeCloseShortWithRecord
   */
  private async closePosition(
    adapter: ExchangeAdapter,
    userId: string,
    symbol: string,
    side: 'long' | 'short',
    source: AiSource,
  ): Promise<ExecutionResult> {
    const futuresSymbol = toFuturesSymbol(symbol);

    // FIFO: 查找最早的同方向持仓
    const position = await this.prisma.position.findFirst({
      where: {
        userId,
        symbol: futuresSymbol,
        side,
        source: { in: ['ai_research', 'ai_strategy', 'ai_analysis'] },
        status: 'open',
      },
      orderBy: { createdAt: 'asc' }, // FIFO
    });

    if (!position) {
      this.logger.warn(`[AI执行] 未找到可平仓持仓: ${futuresSymbol} ${side}`);
      return {
        success: false,
        symbol: futuresSymbol,
        action: `close_${side}`,
        error: `未找到 ${side} 方向的开放持仓`,
      };
    }

    // 通过适配器反向下单平仓
    const amount = Number(position.amount);

    this.logger.log(
      `[AI执行] 平仓: ${futuresSymbol} ${side} qty=${amount} positionId=${position.id}`,
    );

    const result = await this.retryCall<OrderResult>('closePosition', () =>
      side === 'long'
        ? adapter.closeLong(futuresSymbol, amount)
        : adapter.closeShort(futuresSymbol, amount),
    );

    const exitPrice = result.avgPrice || 0;

    // 平仓后清理残留的 SL/TP 订单（防止被二次触发）
    try {
      await adapter.cancelStopOrders(futuresSymbol);
    } catch (e: any) {
      this.logger.warn(`清理 SL/TP 订单失败(非致命): ${e.message}`);
    }

    // 计算 PnL
    const entryPrice = Number(position.entryPrice);
    let pnl: number;
    if (side === 'long') {
      pnl = (exitPrice - entryPrice) * amount;
    } else {
      pnl = (entryPrice - exitPrice) * amount;
    }

    // 更新 Position 记录
    await this.prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'closed',
        closePrice: new Decimal(exitPrice).toFixed(8),
        closedAt: new Date(),
        closeReason: 'ai_decision',
        pnl: new Decimal(pnl).toFixed(8),
        realizedPnl: new Decimal(pnl).toFixed(8),
        ...(result.txHash ? { txHash: result.txHash } : {}),
      },
    });

    // 盈利时计算燃油费
    if (pnl > 0) {
      try {
        await this.feeService.calculateFee(userId, new Decimal(pnl).toFixed(8));
        this.logger.log(`[AI执行] 盈利平仓燃油费计算完成: PnL=$${pnl.toFixed(2)}`);
      } catch (e: any) {
        this.logger.warn(`燃油费计算失败(非致命): ${e.message}`);
      }
    }

    // 自动存 BM25 记忆（关键自学习机制）
    try {
      const marginVal = Number(position.margin);
      const pnlPercent = marginVal > 0 ? (pnl / marginVal) * 100 : 0;

      await this.memoryService.storeMemory({
        userId,
        analysisId: position.id, // 用 positionId 作为记录关联
        symbol: futuresSymbol,
        sceneText: `${futuresSymbol} ${side} entry=${entryPrice} exit=${exitPrice}`,
        action: `close_${side}`,
        pnl,
        pnlPercent,
      });
    } catch (e: any) {
      this.logger.warn(`存储 BM25 记忆失败(非致命): ${e.message}`);
    }

    this.logger.log(
      `[AI执行] 平仓成功: ${futuresSymbol} ${side} PnL=$${pnl.toFixed(2)} positionId=${position.id}`,
    );

    return {
      success: true,
      orderId: result.orderId,
      symbol: futuresSymbol,
      action: `close_${side}`,
      price: exitPrice,
      amount,
      positionId: position.id,
      pnl,
    };
  }

  // ========================= NoFx 余额适配公式 =========================

  /**
   * 余额适配
   * 精确复制 NoFx 公式:
   *   marginFactor = 1.01 / leverage + 0.001
   *   maxAffordable = availableBalance / marginFactor
   *   if positionSizeUSD > maxAffordable: return maxAffordable * 0.98
   */
  adaptPositionToBalance(
    availableBalance: number,
    positionSizeUSD: number,
    leverage: number,
  ): number {
    const marginFactor = 1.01 / leverage + 0.001;
    const maxAffordable = availableBalance / marginFactor;

    if (positionSizeUSD > maxAffordable) {
      const adjusted = maxAffordable * 0.98; // 2% 缓冲
      this.logger.warn(
        `仓位适配: 请求=$${positionSizeUSD.toFixed(2)} 可负担=$${maxAffordable.toFixed(2)} 调整后=$${adjusted.toFixed(2)}`,
      );
      return adjusted;
    }

    return positionSizeUSD;
  }

  // ========================= 决策排序（NoFx sortDecisionsByPriority） =========================

  /**
   * 排序决策：平仓(1) → 开仓(2) → hold/wait(3)
   */
  sortDecisions(decisions: AiDecision[]): AiDecision[] {
    const priority = (action: string): number => {
      if (action === 'close_long' || action === 'close_short') return 1;
      if (action === 'open_long' || action === 'open_short') return 2;
      return 3; // hold, wait
    };

    return [...decisions].sort((a, b) => priority(a.action) - priority(b.action));
  }

  // ========================= 3 个代码强制风控（NoFx 风格） =========================

  /**
   * 最大持仓数检查
   */
  private enforceMaxPositions(currentCount: number): void {
    if (currentCount >= MAX_POSITIONS) {
      throw new Error(
        `AI 持仓数已达上限 (${currentCount}/${MAX_POSITIONS})，请先平仓后再开新仓`,
      );
    }
  }

  /**
   * 最小仓位检查
   */
  private enforceMinPositionSize(positionSizeUSD: number): void {
    if (positionSizeUSD < MIN_POSITION_SIZE) {
      throw new Error(
        `仓位大小 $${positionSizeUSD.toFixed(2)} 低于最小限制 $${MIN_POSITION_SIZE}`,
      );
    }
  }

  /**
   * 仓位价值比约束
   * BTC/ETH: position ≤ equity × 5.0
   * 山寨:    position ≤ equity × 1.0
   */
  private enforcePositionValueRatio(
    positionSizeUSD: number,
    equity: number,
    symbol: string,
  ): number {
    const ratio = this.isBTCETH(symbol) ? BTC_ETH_MAX_RATIO : ALT_MAX_RATIO;
    const maxValue = equity * ratio;

    if (positionSizeUSD > maxValue) {
      this.logger.warn(
        `仓位价值比约束: ${symbol} 请求=$${positionSizeUSD.toFixed(2)} 上限=$${maxValue.toFixed(2)} (ratio=${ratio})`,
      );
      return maxValue;
    }

    return positionSizeUSD;
  }

  // ========================= 辅助方法 =========================

  /**
   * 判断是否为 BTC 或 ETH
   */
  private isBTCETH(symbol: string): boolean {
    const upper = symbol.toUpperCase();
    return upper.includes('BTC') || upper.includes('ETH');
  }
}
