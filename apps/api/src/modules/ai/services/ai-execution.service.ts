import { Injectable, Logger, Optional } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { FeeService } from '../../trading/fee.service';
import { toFuturesSymbol } from '../../../common/utils/symbol.util';
import { AiMemoryService } from './memory.service';
import { AdapterFactoryService } from '../../exchange-adapters/adapter-factory.service';
import { ExchangeAdapter } from '../../exchange-adapters/types/adapter.interface';
import { OrderResult } from '../../exchange-adapters/types/exchange.types';
import { AI_SAFETY_DEFAULTS } from '../constants/safety-defaults';
import { TradingGateway } from '../../../gateways/trading.gateway';
import { PositionMonitorService } from '../../trading/position-monitor.service';

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
  maxPositionPct?: number;   // R4: 百分比判定阈值（默认 20），来自策略 riskControlConfig.maxPositionPct
  currentPrice?: number;     // 可选：R3 已获取的最新价格，避免 executeDecision 内重复 getMarketPrice 调用
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

// 硬编码常量已移至:
// - 用户可配置: AiConfig (maxPositions, minPositionSizeUSD, maxMarginUsage)
// - 代码强制: AI_SAFETY_DEFAULTS (btcEthMaxRatio, altMaxRatio, defaultLeverage, ...)

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
 * 核心设计：
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
    @Optional() private readonly tradingGateway?: TradingGateway,
    @Optional() private readonly positionMonitor?: PositionMonitorService,
  ) {}

  /**
   * 通用重试包装器（应对网络间歇性故障）
   */
  private async retryCall<T>(
    label: string,
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
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
   * 获取交易所可用余额（考虑 allocatedCapital 上限）
   * 供 auto-trader E4 预检使用，避免 allocatedCapital >> 实际余额 导致误放行
   */
  async getAvailableBalance(
    userId: string,
    apiKeyId: string,
    allocatedCapital?: number,
  ): Promise<number> {
    try {
      const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      const balance = await this.retryCall('getBalance', () => adapter.getBalance());
      const exchangeBalance = balance.availableBalance;
      if (allocatedCapital && allocatedCapital > 0) {
        return Math.min(exchangeBalance, allocatedCapital);
      }
      return exchangeBalance;
    } catch (error) {
      this.logger.warn(`[AI执行] 获取余额失败: ${error instanceof Error ? error.message : error}，回退到 allocatedCapital`);
      return allocatedCapital || 1000;
    }
  }

  /**
   * 获取交易所完整余额（不截断 allocatedCapital，供 Prompt 注入真实账户信息）
   * 失败时抛出异常，由调用方 try/catch 降级
   */
  async getFullBalance(
    userId: string,
    apiKeyId: string,
  ): Promise<{ totalEquity: number; availableBalance: number; usedMargin: number }> {
    const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
    const balance = await this.retryCall('getBalance', () => adapter.getBalance());
    return {
      totalEquity: balance.totalEquity,
      availableBalance: balance.availableBalance,
      usedMargin: balance.usedMargin,
    };
  }

  /**
   * 统一入口：执行 AI 决策
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
      `[AI执行] ======== 开始执行 ========\n` +
      `  用户=${userId}\n` +
      `  ${symbol} ${action} (confidence=${decision.confidence}%)\n` +
      `  leverage=${decision.leverage || 'default'} positionSize=${decision.positionSizeUSD || 'default'}\n` +
      `  SL=${decision.stopLoss ?? 'none'} TP=${decision.takeProfit ?? 'none'}\n` +
      `  allocatedCapital=${decision.allocatedCapital ?? 'none'} maxTrade=${decision.maxTradeAmountUSD ?? 'none'}`,
    );

    try {
      // hold/wait 不执行交易
      if (action === 'hold' || action === 'wait') {
        this.logger.log(`[AI执行] ${symbol} action=${action}，不执行交易`);
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

    // 0. 读取用户 AI 配置（用户可配置风控参数）
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId },
    });
    const maxPositions = aiConfig?.maxPositions ?? 3;
    const minPositionSize = Number(aiConfig?.minPositionSizeUSD ?? 12);

    const leverage = decision.leverage || (aiConfig?.maxLeverage ?? AI_SAFETY_DEFAULTS.defaultLeverage);
    const rawPositionSize = decision.positionSizeUSD || Number(aiConfig?.amountPerTrade ?? AI_SAFETY_DEFAULTS.defaultPositionSizeUSD);

    // 1. 获取当前 AI 持仓数
    const currentPositions = await this.prisma.position.count({
      where: {
        userId,
        source: { in: ['ai_research', 'ai_strategy', 'ai_analysis'] },
        status: 'open',
      },
    });

    // 2. 代码强制风控（使用用户配置，回退到默认值）
    this.logger.log(
      `[AI执行] 风控检查: 当前持仓=${currentPositions}/${maxPositions}, 最小仓位=$${minPositionSize}`,
    );
    this.enforceMaxPositions(currentPositions, maxPositions);

    // 3. 获取期货账户余额（通过适配器，带重试）
    const balance = await this.retryCall('getBalance', () => adapter.getBalance());
    const exchangeBalance = balance.availableBalance;
    this.logger.log(`[AI执行] 交易所余额: $${exchangeBalance.toFixed(2)}`);

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
    // positionSizePercent = 保证金占预算的百分比，乘以杠杆得到名义仓位（对齐 nofx position_size_usd）
    // 例: 预算$120, pct=20%, leverage=3x → 保证金=$24 → 名义=$72 → qty=$72/$89=0.81 SOL
    const maxPctThreshold = decision.maxPositionPct ?? 100;
    let positionSizeUSD = rawPositionSize;
    if (rawPositionSize <= maxPctThreshold) {
      const marginUSD = availableBalance * (rawPositionSize / 100);
      positionSizeUSD = marginUSD * leverage;
      this.logger.log(
        `[AI执行] 仓位百分比转换: ${rawPositionSize}% × $${availableBalance.toFixed(2)} = $${marginUSD.toFixed(2)} 保证金 × ${leverage}x = $${positionSizeUSD.toFixed(2)} 名义仓位`,
      );
    }
    // 保底：如果计算后仓位低于最小限制，自动提升到最小限制
    // 后续的 enforcePositionValueRatio + adaptPositionToBalance 会确保不超过可承受范围
    if (positionSizeUSD < minPositionSize) {
      this.logger.log(
        `[AI执行] 仓位 $${positionSizeUSD.toFixed(2)} 低于最小 $${minPositionSize}，自动提升`,
      );
      positionSizeUSD = minPositionSize;
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

    // 5. 余额适配（防止下单超出可用资金）
    const adaptedSize = this.adaptPositionToBalance(
      availableBalance, cappedSize, leverage,
    );

    this.logger.log(
      `[AI执行] 仓位计算链: raw=$${rawPositionSize} → pct转换=$${positionSizeUSD.toFixed(2)} → 价值比约束=$${cappedSize.toFixed(2)} → 余额适配=$${adaptedSize.toFixed(2)}`,
    );

    // 6. 最小仓位检查（使用用户配置）
    this.enforceMinPositionSize(adaptedSize, minPositionSize);

    // 7. 开仓前取消该币种已有订单（防止重复下单）
    try {
      await adapter.cancelAllOrders(futuresSymbol);
    } catch (e: any) {
      this.logger.warn(`取消已有订单失败(非致命): ${e.message}`);
    }

    // 8. 设置杠杆（先查当前杠杆，已匹配则跳过 API 调用，减少不必要请求）
    let actualLeverage = leverage;
    try {
      const positions = await adapter.getPositions();
      const existing = positions.find((p: any) => p.symbol === futuresSymbol);
      if (existing?.leverage && existing.leverage === leverage) {
        this.logger.log(`[AI执行] 杠杆已是 ${leverage}x，跳过设置`);
        // actualLeverage 已正确，无需调用 setLeverage
      } else {
        // 杠杆不匹配或无持仓，调用 setLeverage
        for (let levAttempt = 1; levAttempt <= 3; levAttempt++) {
          try {
            await adapter.setLeverage(futuresSymbol, leverage);
            break;
          } catch (e: any) {
            if (e.message?.includes('No need to change leverage')) break; // 交易所已是目标杠杆
            this.logger.warn(`[AI执行] 设置杠杆失败(${levAttempt}/3): ${e.message}`);
            if (levAttempt === 3) {
              if (existing?.leverage) {
                actualLeverage = existing.leverage;
                this.logger.warn(`[AI执行] 使用交易所实际杠杆: ${actualLeverage}x (请求 ${leverage}x)`);
              }
            }
            if (levAttempt < 3) await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    } catch (_) {
      // getPositions 失败，降级到直接调用 setLeverage（原有流程）
      for (let levAttempt = 1; levAttempt <= 3; levAttempt++) {
        try {
          await adapter.setLeverage(futuresSymbol, leverage);
          break;
        } catch (e: any) {
          if (e.message?.includes('No need to change leverage')) break;
          this.logger.warn(`[AI执行] 设置杠杆失败(${levAttempt}/3): ${e.message}`);
          if (levAttempt < 3) await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    // 8b. 设置保证金模式（常见错误为"已有持仓无法切换"，直接 warn 继续，不重试）
    try {
      await adapter.setMarginMode(futuresSymbol, true);
    } catch (e: any) {
      this.logger.warn(`[AI执行] 设置保证金模式跳过: ${e.message}`);
    }

    // 9. 获取当前价格并计算下单数量（优先复用 R3 已刷新的价格，避免重复 API 调用）
    const currentPrice = (decision.currentPrice && decision.currentPrice > 0)
      ? decision.currentPrice
      : await this.retryCall('getMarketPrice', () => adapter.getMarketPrice(futuresSymbol));
    const rawQuantity = adaptedSize / currentPrice;
    const formattedQty = await adapter.formatQuantity(futuresSymbol, rawQuantity);
    const quantity = parseFloat(formattedQty);

    if (quantity <= 0) {
      throw new Error(`计算后下单数量为 0: size=${adaptedSize} price=${currentPrice}`);
    }

    // 10. 通过适配器下单（使用 actualLeverage，杠杆设置失败时可能与 leverage 不同）
    this.logger.log(
      `[AI执行] ======== 下单参数 ========\n` +
      `  ${futuresSymbol} ${side.toUpperCase()}\n` +
      `  数量=${quantity} (raw=${rawQuantity.toFixed(6)})\n` +
      `  价格=$${currentPrice} 杠杆=${actualLeverage}x${actualLeverage !== leverage ? ` (请求${leverage}x)` : ''}\n` +
      `  仓位=$${adaptedSize.toFixed(2)} 保证金=$${(adaptedSize / actualLeverage).toFixed(2)}\n` +
      `  SL=${decision.stopLoss ?? 'none'} TP=${decision.takeProfit ?? 'none'}`,
    );
    const result = await this.retryCall<OrderResult>('openPosition', () =>
      side === 'long'
        ? adapter.openLong(futuresSymbol, quantity, actualLeverage)
        : adapter.openShort(futuresSymbol, quantity, actualLeverage),
    );

    const filledPrice = result.avgPrice || currentPrice;
    const filledAmount = result.filledQuantity || quantity;

    this.logger.log(
      `[AI执行] 订单结果: orderId=${result.orderId} status=${result.status} ` +
      `filledPrice=$${filledPrice} filledQty=${filledAmount}/${quantity} (${(filledAmount / quantity * 100).toFixed(1)}%)`,
    );

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

    // 12. 计算保证金（使用 actualLeverage）
    const margin = new Decimal(filledPrice).times(filledAmount).div(actualLeverage);

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
        leverage: actualLeverage,
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

    // 13.5 注册到持仓监控（开仓即监控，无论 SL/TP 是否在交易所设置）
    if (this.positionMonitor) {
      this.positionMonitor.trackPosition({
        positionId: position.id,
        userId,
        apiKeyId,
        symbol: futuresSymbol,
        side,
        entryPrice: filledPrice,
        amount: filledAmount,
        config: {}, // 交易所侧 SL/TP 为主，monitor 作为二级保护
      });
    }

    // 14. 设置止损（3次重试 → 降级到软监控）
    // 开仓无 SL/TP 防御检查（正常情况 safety L9 已拦截，此处为最终防线 WARN）
    if (!decision.stopLoss || decision.stopLoss <= 0) {
      this.logger.warn(
        `[AI执行] ⚠ 开仓无止损: ${futuresSymbol} ${side} orderId=${result.orderId} — SL 缺失，仅依赖软监控`,
      );
    }
    let slSet = false;
    if (decision.stopLoss != null && decision.stopLoss > 0) {
      for (let slAttempt = 1; slAttempt <= 3; slAttempt++) {
        try {
          await adapter.setStopLoss(futuresSymbol, side, filledAmount, decision.stopLoss);
          this.logger.log(`[AI执行] 止损设置成功: SL=$${decision.stopLoss}`);
          slSet = true;
          break;
        } catch (e: any) {
          this.logger.warn(`[AI执行] 设置止损失败(${slAttempt}/3): ${e.message}`);
          if (slAttempt < 3) await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (!slSet) {
        this.logger.error(`[AI执行] ⚠ 止损设置3次全部失败，降级到软监控: SL=$${decision.stopLoss}`);
      }
    }

    // 14b. 设置止盈（3次重试 → 降级到软监控）
    let tpSet = false;
    if (decision.takeProfit != null && decision.takeProfit > 0) {
      for (let tpAttempt = 1; tpAttempt <= 3; tpAttempt++) {
        try {
          await adapter.setTakeProfit(futuresSymbol, side, filledAmount, decision.takeProfit);
          this.logger.log(`[AI执行] 止盈设置成功: TP=$${decision.takeProfit}`);
          tpSet = true;
          break;
        } catch (e: any) {
          this.logger.warn(`[AI执行] 设置止盈失败(${tpAttempt}/3): ${e.message}`);
          if (tpAttempt < 3) await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (!tpSet) {
        this.logger.error(`[AI执行] ⚠ 止盈设置3次全部失败，降级到软监控: TP=$${decision.takeProfit}`);
      }
    }

    // 15. 如果交易所 SL/TP 未设置成功，降级到 position-monitor 软监控
    if (this.positionMonitor && (((decision.stopLoss != null && decision.stopLoss > 0) && !slSet) || ((decision.takeProfit != null && decision.takeProfit > 0) && !tpSet))) {
      const slPercent = (decision.stopLoss != null && decision.stopLoss > 0)
        ? Math.abs((decision.stopLoss - filledPrice) / filledPrice) * 100
        : undefined;
      const tpPercent = decision.takeProfit
        ? Math.abs((decision.takeProfit - filledPrice) / filledPrice) * 100
        : undefined;

      this.positionMonitor!.trackPosition({
        positionId: position.id,
        userId,
        apiKeyId,
        symbol: futuresSymbol,
        side,
        entryPrice: filledPrice,
        amount: filledAmount,
        config: {
          stopLossPercent: !slSet ? slPercent : undefined,
          takeProfitPercent: !tpSet ? tpPercent : undefined,
        },
      });
      this.logger.warn(
        `[AI执行] 降级软监控已注册: positionId=${position.id} ` +
        `SL=${!slSet && slPercent ? slPercent.toFixed(2) + '%' : '交易所已设'} ` +
        `TP=${!tpSet && tpPercent ? tpPercent.toFixed(2) + '%' : '交易所已设'}`,
      );
    }

    this.logger.log(
      `[AI执行] ======== 开仓成功 ========\n` +
      `  ${futuresSymbol} ${side.toUpperCase()}\n` +
      `  成交价=$${filledPrice} 数量=${filledAmount}\n` +
      `  杠杆=${actualLeverage}x 保证金=$${margin.toFixed(2)}\n` +
      `  SL=$${decision.stopLoss ?? 'none'}${slSet ? '✓' : '⚠降级'} TP=$${decision.takeProfit ?? 'none'}${tpSet ? '✓' : '⚠降级'}\n` +
      `  orderId=${result.orderId} positionId=${position.id}\n` +
      `  ================================`,
    );

    // 推送 WebSocket 持仓更新（前端交易页实时刷新）
    try {
      this.tradingGateway?.sendPositionUpdate(userId, {
        id: position.id,
        symbol: futuresSymbol,
        side,
        entryPrice: new Decimal(filledPrice).toFixed(8),
        amount: new Decimal(filledAmount).toFixed(8),
        status: 'open',
        action: 'opened',
      });
    } catch { /* 非致命 */ }

    // 推送 TG 开仓通知（fire-and-forget）
    (async () => {
      let strategyName: string | undefined;
      if (aiStrategyId) {
        const strat = await this.prisma.aiStrategy.findUnique({
          where: { id: aiStrategyId },
          select: { name: true },
        });
        strategyName = strat?.name;
      }
      await this.sendTgAiNotify(userId, {
        type: 'decision_open',
        symbol: futuresSymbol,
        side,
        leverage: actualLeverage,
        confidence: decision.confidence,
        strategyName,
        tradingMode: source === 'ai_research' ? 'research' : 'solo',
      });
    })().catch(() => {});

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
      `[AI执行] ======== 平仓 ========\n` +
      `  ${futuresSymbol} ${side.toUpperCase()}\n` +
      `  数量=${amount} positionId=${position.id}\n` +
      `  入场价=$${position.entryPrice} 杠杆=${position.leverage}x`,
    );

    const result = await this.retryCall<OrderResult>('closePosition', () =>
      side === 'long'
        ? adapter.closeLong(futuresSymbol, amount)
        : adapter.closeShort(futuresSymbol, amount),
    );

    const exitPrice = result.avgPrice || 0;

    this.logger.log(
      `[AI执行] 平仓订单结果: orderId=${result.orderId} exitPrice=$${exitPrice}`,
    );

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

    // 平仓后移除持仓监控
    if (this.positionMonitor) {
      this.positionMonitor.untrackPosition(position.id);
    }

    // 推送 WebSocket 平仓更新（前端交易页实时刷新）
    try {
      this.tradingGateway?.sendPositionUpdate(userId, {
        id: position.id,
        symbol: futuresSymbol,
        side,
        entryPrice: position.entryPrice.toString(),
        amount: position.amount.toString(),
        pnl: new Decimal(pnl).toFixed(8),
        status: 'closed',
        action: 'closed',
      });
    } catch { /* 非致命 */ }

    // 仅产品 A (ai_research) 存储 BM25 记忆
    // 产品 B (ai_strategy) 不使用 BM25（快速模式无状态设计）
    if (source === 'ai_research') {
      try {
        const marginVal = Number(position.margin);
        const pnlPercent = marginVal > 0 ? (pnl / marginVal) * 100 : 0;

        await this.memoryService.storeMemory({
          userId,
          analysisId: position.id,
          symbol: futuresSymbol,
          sceneText: `${futuresSymbol} ${side} entry=${entryPrice} exit=${exitPrice}`,
          action: `close_${side}`,
          pnl,
          pnlPercent,
        });
      } catch (e: any) {
        this.logger.warn(`存储 BM25 记忆失败(非致命): ${e.message}`);
      }
    }

    this.logger.log(
      `[AI执行] 平仓成功: ${futuresSymbol} ${side} PnL=$${pnl.toFixed(2)} positionId=${position.id}`,
    );

    // 推送 TG 平仓通知（fire-and-forget）
    const pnlSign = pnl >= 0 ? '+' : '';
    (async () => {
      let strategyName: string | undefined;
      if (position.aiStrategyId) {
        const strat = await this.prisma.aiStrategy.findUnique({
          where: { id: position.aiStrategyId },
          select: { name: true },
        });
        strategyName = strat?.name;
      }
      await this.sendTgAiNotify(userId, {
        type: 'decision_close',
        symbol: futuresSymbol,
        side,
        pnl: `${pnlSign}${pnl.toFixed(2)} USDT`,
        strategyName,
        tradingMode: source === 'ai_research' ? 'research' : 'solo',
      });
    })().catch(() => {});

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

  /**
   * 批量平仓：关闭该策略所有开放持仓
   * 用于止盈/止损/风控熔断时，确保持仓被实际平掉而非仅停止策略
   * 内部复用 closePosition()：FIFO 平仓 + 盈利时自动扣燃油费
   */
  async closeAllStrategyPositions(
    userId: string,
    strategyId: string,
    apiKeyId: string,
  ): Promise<void> {
    const openPositions = await this.prisma.position.findMany({
      where: {
        userId,
        aiStrategyId: strategyId,
        status: 'open',
        source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
      },
      select: { id: true, symbol: true, side: true },
      orderBy: { createdAt: 'asc' }, // FIFO
    });

    if (openPositions.length === 0) {
      this.logger.log(`[AI执行] 策略 ${strategyId} 无开放持仓，跳过批量平仓`);
      return;
    }

    this.logger.log(`[AI执行] 批量平仓启动: 策略 ${strategyId} 共 ${openPositions.length} 笔持仓`);

    let adapter: ExchangeAdapter | null = null;
    try {
      adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      for (const pos of openPositions) {
        try {
          const r = await this.closePosition(adapter, userId, pos.symbol, pos.side as 'long' | 'short', 'ai_strategy');
          if (r.success) {
            this.logger.log(`[AI执行] 批量平仓 ✅ ${pos.symbol} ${pos.side} pnl=${r.pnl != null ? r.pnl.toFixed(4) : 'N/A'}`);
          } else {
            this.logger.warn(`[AI执行] 批量平仓失败: ${pos.symbol} ${pos.side} - ${r.error}`);
          }
        } catch (e: any) {
          this.logger.warn(`[AI执行] 批量平仓单笔异常: ${pos.symbol} ${pos.side} - ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`[AI执行] 批量平仓 adapter 创建失败: ${e.message}`);
    } finally {
      if (adapter) { try { await adapter.dispose(); } catch { /* 忽略 */ } }
    }
  }

  // ========================= 余额适配公式 =========================

  /**
   * 余额适配
   * 公式:
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

  // ========================= 决策排序 =========================

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

  // ========================= 3 个代码强制风控 =========================

  /**
   * 最大持仓数检查
   * @param maxPositions 来自用户 aiConfig.maxPositions，默认 3
   */
  private enforceMaxPositions(currentCount: number, maxPositions: number = 3): void {
    if (currentCount >= maxPositions) {
      throw new Error(
        `AI 持仓数已达上限 (${currentCount}/${maxPositions})，请先平仓后再开新仓`,
      );
    }
  }

  /**
   * 最小仓位检查
   * @param minSize 来自用户 aiConfig.minPositionSizeUSD，默认 12
   */
  private enforceMinPositionSize(positionSizeUSD: number, minSize: number = 12): void {
    if (positionSizeUSD < minSize) {
      throw new Error(
        `仓位大小 $${positionSizeUSD.toFixed(2)} 低于最小限制 $${minSize}`,
      );
    }
  }

  /**
   * 仓位价值比约束（代码强制，非用户可配置）
   * BTC/ETH: position ≤ equity × 5.0
   * 山寨:    position ≤ equity × 1.0
   */
  private enforcePositionValueRatio(
    positionSizeUSD: number,
    equity: number,
    symbol: string,
  ): number {
    const ratio = this.isBTCETH(symbol)
      ? AI_SAFETY_DEFAULTS.btcEthMaxRatio
      : AI_SAFETY_DEFAULTS.altMaxRatio;
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

  /**
   * 向 TG Bot 推送 AI 通知（fire-and-forget）
   * 查询用户 telegramId，然后调用 TG Bot HTTP API
   */
  private async sendTgAiNotify(
    userId: string,
    data: Record<string, any>,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true },
      });

      if (!user?.telegramId) return;

      const tgBotApiUrl = process.env.TG_BOT_API_URL || 'http://localhost:4002';
      await fetch(`${tgBotApiUrl}/notify-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId,
          ...data,
        }),
      });
    } catch (e) {
      this.logger.debug(`TG AI 通知发送失败(非致命): ${(e as Error).message}`);
    }
  }
}
