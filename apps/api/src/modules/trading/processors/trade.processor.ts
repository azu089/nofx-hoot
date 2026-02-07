import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingService, TradingConfig } from '../trading.service';
import { RiskControlService } from '../risk-control.service';
import { PositionMonitorService } from '../position-monitor.service';
import { DcaService } from '../dca.service';
import { FeeService } from '../fee.service';
import { RedisLockService } from '../../../common/redis/redis-lock.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SignalsService } from '../../signals/signals.service';
import { TradeJobData, TradeAction } from '../../signals/dto/signal.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { DailyPnlService } from '../daily-pnl.service';
import { MarketMonitorService } from '../market-monitor.service';
import { isSameSymbol } from '../../../common/utils/symbol.util';

@Processor('trade')
export class TradeProcessor extends WorkerHost {
  private readonly logger = new Logger(TradeProcessor.name);

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
    private riskControlService: RiskControlService,
    private positionMonitorService: PositionMonitorService,
    private dcaService: DcaService,
    private feeService: FeeService,
    private redisLock: RedisLockService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => SignalsService))
    private signalsService: SignalsService,
    private dailyPnlService: DailyPnlService,
    private marketMonitorService: MarketMonitorService,
  ) {
    super();
  }

  async process(
    job: Job<TradeJobData>,
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    const {
      signalId,
      userId,
      subscriptionId,
      apiKeyId,
      exchange,
      symbol,
      side,
      price,
      amountPerTrade,
      tradingConfig,
    } = job.data;

    // 解析交易动作: 优先使用 action，否则从 side 推断（向后兼容）
    const action: TradeAction = job.data.action || (side === 'buy' ? 'entry_long' : 'exit_long');

    // 构建 TradingService 需要的配置
    const config: TradingConfig = {
      tradingType: tradingConfig?.tradingType || 'spot',
      leverage: tradingConfig?.leverage || 1,
      marginMode: tradingConfig?.marginMode || 'cross',
      slippageTolerance: tradingConfig?.slippageTolerance || 0.5,
      maxRetries: tradingConfig?.maxRetries || 3,
      retryDelayMs: tradingConfig?.retryDelayMs || 1000,
    };

    this.logger.log(
      `执行交易任务: 用户 ${userId} ${action} ${symbol} @ ${price} (${config.tradingType})`,
    );

    try {
      // ===== 日亏损限制检查 =====
      if (this.dailyPnlService.isUserLocked(userId)) {
        this.logger.warn(`用户 ${userId} 已达日亏损限制，拒绝交易`);
        await this.signalsService.markExecutionFailed(
          signalId,
          userId,
          'DAILY_LOSS_LOCKED',
          '已达单日亏损限制，今日交易已暂停',
        );
        return { success: false, error: 'daily_loss_locked' };
      }

      // ===== 黑天鹅保护检查 =====
      if (this.marketMonitorService.isUserPaused(userId)) {
        this.logger.warn(`用户 ${userId} 因黑天鹅保护已暂停交易`);
        await this.signalsService.markExecutionFailed(
          signalId,
          userId,
          'BLACK_SWAN_PAUSED',
          '黑天鹅保护已触发，交易暂停中',
        );
        return { success: false, error: 'black_swan_paused' };
      }

      // ===== 标记执行开始 =====
      await this.signalsService.markExecutionStarted(signalId, userId, exchange);

      // 现货模式不支持做空 — 在路由层统一拦截
      if (config.tradingType === 'spot' && (action === 'entry_short' || action === 'exit_short')) {
        this.logger.log(`用户 ${userId} 使用现货模式，跳过空头信号 ${action}`);
        await this.signalsService.markExecutionSkipped(signalId, userId, '现货模式不支持做空');
        return { success: false, error: 'spot_short_not_supported' };
      }

      // 根据 action 类型决定操作（支持4种: 开多/平多/开空/平空）
      switch (action) {
        case 'entry_long':
          return await this.handleEntryLong(
            userId, apiKeyId, signalId, exchange, symbol, price,
            parseFloat(amountPerTrade), config, subscriptionId,
          );
        case 'exit_long':
          return await this.handleExitPosition(
            userId, apiKeyId, signalId, exchange, symbol, config,
            tradingConfig?.autoClose !== false, subscriptionId, 'long',
          );
        case 'entry_short':
          return await this.handleEntryShort(
            userId, apiKeyId, signalId, exchange, symbol, price,
            parseFloat(amountPerTrade), config, subscriptionId,
          );
        case 'exit_short':
          return await this.handleExitPosition(
            userId, apiKeyId, signalId, exchange, symbol, config,
            tradingConfig?.autoClose !== false, subscriptionId, 'short',
          );
        default:
          this.logger.error(`未知的交易动作: ${action}`);
          return { success: false, error: `unknown_action: ${action}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorCode = this.extractErrorCode(error);

      this.logger.error(`交易失败: 用户 ${userId} - ${errorMessage}`);

      // ===== 记录执行失败状态 =====
      try {
        await this.signalsService.markExecutionFailed(
          signalId,
          userId,
          errorCode,
          errorMessage,
        );
      } catch (e) {
        this.logger.warn(`更新执行状态失败: ${e.message}`);
      }

      // 记录失败的持仓（根据 action 判断方向）
      const failedSide = (action === 'entry_long' || action === 'exit_short') ? 'long' : 'short';
      await this.prisma.position.create({
        data: {
          userId,
          exchange,
          symbol,
          side: failedSide,
          entryPrice: new Decimal(price),
          amount: new Decimal(0),
          status: 'failed',
          signalId,
        },
      });

      // 发送交易失败通知
      await this.sendTradeFailedNotification(
        userId,
        symbol,
        action,
        errorMessage,
      );

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      // ===== 释放交易锁 =====
      // 无论交易成功还是失败，都要释放锁，让下一个信号可以执行
      try {
        await this.redisLock.releaseTradeLock(userId, apiKeyId);
        this.logger.log(`已释放用户 ${userId} 的交易锁 (API Key: ${apiKeyId})`);
      } catch (lockError) {
        this.logger.error(
          `释放交易锁失败: 用户 ${userId} - ${lockError.message}`,
        );
      }
    }
  }

  // 处理开多信号（开多仓）
  private async handleEntryLong(
    userId: string,
    apiKeyId: string,
    signalId: string,
    exchange: string,
    symbol: string,
    price: string,
    requiredAmount: number,
    config: TradingConfig,
    subscriptionId?: string,
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    // 执行全面风控检查（传入交易配置以正确查询余额）
    const riskCheck = await this.riskControlService.check(
      userId,
      apiKeyId,
      symbol,
      requiredAmount,
      { tradingConfig: config, side: 'long' },
    );

    if (!riskCheck.allowed) {
      this.logger.warn(`用户 ${userId} 风控检查未通过: ${riskCheck.reason}`);

      // 标记执行失败（风控拒绝）
      try {
        await this.signalsService.markExecutionFailed(
          signalId,
          userId,
          `RISK_${riskCheck.reason?.toUpperCase() || 'UNKNOWN'}`,
          this.getRiskReasonMessage(riskCheck.reason, riskCheck.details),
        );
      } catch (e) {
        this.logger.warn(`更新执行状态失败: ${e.message}`);
      }

      await this.riskControlService.logRejection(
        userId,
        signalId,
        riskCheck.reason || 'unknown',
        riskCheck.details || {},
      );

      await this.sendTradeFailedNotification(
        userId,
        symbol,
        'buy',
        this.getRiskReasonMessage(riskCheck.reason, riskCheck.details),
      );

      return { success: false, error: riskCheck.reason };
    }

    // 执行交易
    const result = await this.tradingService.executeOrder(
      userId,
      apiKeyId,
      symbol,
      'buy',
      requiredAmount,
      config,
    );

    // 获取订阅配置（用于注册监控）- 使用精确的 subscriptionId
    const subscription = subscriptionId
      ? await this.prisma.strategySubscription.findUnique({
          where: { id: subscriptionId },
          select: {
            id: true,
            stopLossPercent: true,
            takeProfitPercent: true,
            trailingStopEnabled: true,
            trailingStopActivation: true,
            trailingStopCallback: true,
            dcaEnabled: true,
            dcaMaxCount: true,
            dcaTrigger: true,
            dcaMultiplier: true,
            amountPerTrade: true,
          },
        })
      : await this.prisma.strategySubscription.findFirst({
          where: { userId, isActive: true },
          select: {
            id: true,
            stopLossPercent: true,
            takeProfitPercent: true,
            trailingStopEnabled: true,
            trailingStopActivation: true,
            trailingStopCallback: true,
            dcaEnabled: true,
            dcaMaxCount: true,
            dcaTrigger: true,
            dcaMultiplier: true,
            amountPerTrade: true,
          },
        });

    // 创建持仓记录（包含完整交易配置）
    const position = await this.prisma.position.create({
      data: {
        userId,
        exchange,
        symbol,
        side: 'long',
        entryPrice: new Decimal(result.price),
        amount: new Decimal(result.amount),
        exchangeOrderId: result.orderId,
        status: 'open',
        signalId,
        subscriptionId: subscription?.id,
        apiKeyId,
        // 交易配置
        tradingType: config.tradingType || 'spot',
        leverage: config.leverage || 1,
        margin: new Decimal(requiredAmount), // 保证金 = amountPerTrade
        marginMode: config.marginMode || 'cross',
      },
    });

    this.logger.log(`开仓成功: 用户 ${userId} 持仓 ${position.id}`);

    // ===== 合约交易：从交易所获取实际杠杆和标记价格 =====
    if (config.tradingType === 'futures') {
      try {
        const exchangePositions = await this.tradingService.fetchPositions(
          userId,
          apiKeyId,
          symbol,
        );
        const matchedPos = exchangePositions.find(
          (p: any) => isSameSymbol(p.symbol || '', symbol),
        );
        if (matchedPos) {
          const actualLeverage = parseInt(
            matchedPos.leverage || matchedPos.info?.leverage || config.leverage || 1,
          );
          const actualMarkPrice = parseFloat(
            matchedPos.markPrice || matchedPos.info?.markPrice || 0,
          );
          const actualLiqPrice = parseFloat(
            matchedPos.liquidationPrice || matchedPos.info?.liquidationPrice || 0,
          );

          const updateData: any = {};
          if (actualLeverage !== (config.leverage || 1)) {
            updateData.leverage = actualLeverage;
            this.logger.warn(
              `杠杆校正: 配置 ${config.leverage}x → 交易所实际 ${actualLeverage}x`,
            );
          }
          if (actualMarkPrice > 0) {
            updateData.markPrice = new Decimal(actualMarkPrice);
          }
          if (actualLiqPrice > 0) {
            updateData.liquidationPrice = new Decimal(actualLiqPrice);
          }

          if (Object.keys(updateData).length > 0) {
            updateData.lastSyncAt = new Date();
            await this.prisma.position.update({
              where: { id: position.id },
              data: updateData,
            });
            this.logger.log(
              `持仓 ${position.id} 已校正: leverage=${updateData.leverage || config.leverage}, markPrice=${actualMarkPrice}`,
            );
          }
        }
      } catch (e) {
        this.logger.warn(`获取交易所实际持仓数据失败: ${e.message}`);
      }
    }

    // ===== 标记执行成功 =====
    try {
      await this.signalsService.markExecutionSuccess(
        signalId,
        userId,
        result.orderId,
        result.price.toString(),
        result.amount.toString(),
      );
    } catch (e) {
      this.logger.warn(`更新执行状态失败: ${e.message}`);
    }

    // ===== 注册到持仓监控服务（止盈/止损/移动止损）=====
    this.positionMonitorService.trackPosition({
      positionId: position.id,
      userId,
      apiKeyId,
      symbol,
      side: 'long',
      entryPrice: result.price,
      amount: result.amount,
      config: {
        stopLossPercent: subscription?.stopLossPercent
          ? parseFloat(subscription.stopLossPercent.toString())
          : undefined,
        takeProfitPercent: subscription?.takeProfitPercent
          ? parseFloat(subscription.takeProfitPercent.toString())
          : undefined,
        trailingStopEnabled: subscription?.trailingStopEnabled || false,
        trailingStopActivation: subscription?.trailingStopActivation
          ? parseFloat(subscription.trailingStopActivation.toString())
          : undefined,
        trailingStopCallback: subscription?.trailingStopCallback
          ? parseFloat(subscription.trailingStopCallback.toString())
          : undefined,
      },
    });
    this.logger.log(`持仓 ${position.id} 已注册到止盈/止损监控`);

    // ===== 注册到 DCA 服务（补仓）=====
    if (subscription?.dcaEnabled) {
      this.dcaService.trackPosition({
        positionId: position.id,
        userId,
        apiKeyId,
        symbol,
        side: 'long',
        entryPrice: result.price,
        amount: result.amount,
        baseAmount: parseFloat(subscription.amountPerTrade.toString()),
        dcaCount: 0,
        lastDcaPrice: result.price,
        config: {
          dcaEnabled: true,
          dcaMaxCount: subscription.dcaMaxCount || 3,
          dcaTrigger: subscription.dcaTrigger
            ? parseFloat(subscription.dcaTrigger.toString())
            : 5,
          dcaMultiplier: subscription.dcaMultiplier
            ? parseFloat(subscription.dcaMultiplier.toString())
            : 1.5,
          waterfallProtection: true,
          waterfallTriggerPercent: 20,
        },
      });
      this.logger.log(`持仓 ${position.id} 已注册到 DCA 补仓监控`);
    }

    await this.notificationsService.notifyPositionOpened(
      userId,
      symbol,
      'long',
      result.price.toString(),
    );

    return { success: true, positionId: position.id };
  }

  // 处理开空信号（开空仓）
  private async handleEntryShort(
    userId: string,
    apiKeyId: string,
    signalId: string,
    exchange: string,
    symbol: string,
    price: string,
    requiredAmount: number,
    config: TradingConfig,
    subscriptionId?: string,
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    // 执行全面风控检查
    const riskCheck = await this.riskControlService.check(
      userId,
      apiKeyId,
      symbol,
      requiredAmount,
      { tradingConfig: config, side: 'short' },
    );

    if (!riskCheck.allowed) {
      this.logger.warn(`用户 ${userId} 风控检查未通过: ${riskCheck.reason}`);

      try {
        await this.signalsService.markExecutionFailed(
          signalId,
          userId,
          `RISK_${riskCheck.reason?.toUpperCase() || 'UNKNOWN'}`,
          this.getRiskReasonMessage(riskCheck.reason, riskCheck.details),
        );
      } catch (e) {
        this.logger.warn(`更新执行状态失败: ${e.message}`);
      }

      await this.riskControlService.logRejection(
        userId,
        signalId,
        riskCheck.reason || 'unknown',
        riskCheck.details || {},
      );

      await this.sendTradeFailedNotification(
        userId,
        symbol,
        'entry_short',
        this.getRiskReasonMessage(riskCheck.reason, riskCheck.details),
      );

      return { success: false, error: riskCheck.reason };
    }

    // 执行交易（合约模式下 sell = 开空）
    const result = await this.tradingService.executeOrder(
      userId,
      apiKeyId,
      symbol,
      'sell',
      requiredAmount,
      config,
    );

    // 获取订阅配置（用于注册监控）
    const subscription = subscriptionId
      ? await this.prisma.strategySubscription.findUnique({
          where: { id: subscriptionId },
          select: {
            id: true,
            stopLossPercent: true,
            takeProfitPercent: true,
            trailingStopEnabled: true,
            trailingStopActivation: true,
            trailingStopCallback: true,
            dcaEnabled: true,
            dcaMaxCount: true,
            dcaTrigger: true,
            dcaMultiplier: true,
            amountPerTrade: true,
          },
        })
      : await this.prisma.strategySubscription.findFirst({
          where: { userId, isActive: true },
          select: {
            id: true,
            stopLossPercent: true,
            takeProfitPercent: true,
            trailingStopEnabled: true,
            trailingStopActivation: true,
            trailingStopCallback: true,
            dcaEnabled: true,
            dcaMaxCount: true,
            dcaTrigger: true,
            dcaMultiplier: true,
            amountPerTrade: true,
          },
        });

    // 创建持仓记录
    const position = await this.prisma.position.create({
      data: {
        userId,
        exchange,
        symbol,
        side: 'short',
        entryPrice: new Decimal(result.price),
        amount: new Decimal(result.amount),
        exchangeOrderId: result.orderId,
        status: 'open',
        signalId,
        subscriptionId: subscription?.id,
        apiKeyId,
        tradingType: config.tradingType || 'spot',
        leverage: config.leverage || 1,
        margin: new Decimal(requiredAmount),
        marginMode: config.marginMode || 'cross',
      },
    });

    this.logger.log(`开空成功: 用户 ${userId} 持仓 ${position.id}`);

    // ===== 合约交易：从交易所获取实际杠杆和标记价格 =====
    if (config.tradingType === 'futures') {
      try {
        const exchangePositions = await this.tradingService.fetchPositions(
          userId,
          apiKeyId,
          symbol,
        );
        const matchedPos = exchangePositions.find(
          (p: any) => isSameSymbol(p.symbol || '', symbol),
        );
        if (matchedPos) {
          const actualLeverage = parseInt(
            matchedPos.leverage || matchedPos.info?.leverage || config.leverage || 1,
          );
          const actualMarkPrice = parseFloat(
            matchedPos.markPrice || matchedPos.info?.markPrice || 0,
          );
          const actualLiqPrice = parseFloat(
            matchedPos.liquidationPrice || matchedPos.info?.liquidationPrice || 0,
          );

          const updateData: any = {};
          if (actualLeverage !== (config.leverage || 1)) {
            updateData.leverage = actualLeverage;
            this.logger.warn(
              `杠杆校正: 配置 ${config.leverage}x → 交易所实际 ${actualLeverage}x`,
            );
          }
          if (actualMarkPrice > 0) {
            updateData.markPrice = new Decimal(actualMarkPrice);
          }
          if (actualLiqPrice > 0) {
            updateData.liquidationPrice = new Decimal(actualLiqPrice);
          }

          if (Object.keys(updateData).length > 0) {
            updateData.lastSyncAt = new Date();
            await this.prisma.position.update({
              where: { id: position.id },
              data: updateData,
            });
            this.logger.log(
              `持仓 ${position.id} 已校正: leverage=${updateData.leverage || config.leverage}, markPrice=${actualMarkPrice}`,
            );
          }
        }
      } catch (e) {
        this.logger.warn(`获取交易所实际持仓数据失败: ${e.message}`);
      }
    }

    // ===== 标记执行成功 =====
    try {
      await this.signalsService.markExecutionSuccess(
        signalId,
        userId,
        result.orderId,
        result.price.toString(),
        result.amount.toString(),
      );
    } catch (e) {
      this.logger.warn(`更新执行状态失败: ${e.message}`);
    }

    // ===== 注册到持仓监控服务（止盈/止损/移动止损）=====
    this.positionMonitorService.trackPosition({
      positionId: position.id,
      userId,
      apiKeyId,
      symbol,
      side: 'short',
      entryPrice: result.price,
      amount: result.amount,
      config: {
        stopLossPercent: subscription?.stopLossPercent
          ? parseFloat(subscription.stopLossPercent.toString())
          : undefined,
        takeProfitPercent: subscription?.takeProfitPercent
          ? parseFloat(subscription.takeProfitPercent.toString())
          : undefined,
        trailingStopEnabled: subscription?.trailingStopEnabled || false,
        trailingStopActivation: subscription?.trailingStopActivation
          ? parseFloat(subscription.trailingStopActivation.toString())
          : undefined,
        trailingStopCallback: subscription?.trailingStopCallback
          ? parseFloat(subscription.trailingStopCallback.toString())
          : undefined,
      },
    });
    this.logger.log(`持仓 ${position.id} 已注册到止盈/止损监控`);

    // ===== 注册到 DCA 服务（补仓）=====
    if (subscription?.dcaEnabled) {
      this.dcaService.trackPosition({
        positionId: position.id,
        userId,
        apiKeyId,
        symbol,
        side: 'short',
        entryPrice: result.price,
        amount: result.amount,
        baseAmount: parseFloat(subscription.amountPerTrade.toString()),
        dcaCount: 0,
        lastDcaPrice: result.price,
        config: {
          dcaEnabled: true,
          dcaMaxCount: subscription.dcaMaxCount || 3,
          dcaTrigger: subscription.dcaTrigger
            ? parseFloat(subscription.dcaTrigger.toString())
            : 5,
          dcaMultiplier: subscription.dcaMultiplier
            ? parseFloat(subscription.dcaMultiplier.toString())
            : 1.5,
          waterfallProtection: true,
          waterfallTriggerPercent: 20,
        },
      });
      this.logger.log(`持仓 ${position.id} 已注册到 DCA 补仓监控`);
    }

    await this.notificationsService.notifyPositionOpened(
      userId,
      symbol,
      'short',
      result.price.toString(),
    );

    return { success: true, positionId: position.id };
  }

  // 处理平仓信号（平多 or 平空，由 positionSide 决定）
  private async handleExitPosition(
    userId: string,
    apiKeyId: string,
    signalId: string,
    exchange: string,
    symbol: string,
    config: TradingConfig,
    autoClose: boolean,
    subscriptionId: string | undefined,
    positionSide: 'long' | 'short',
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    // 如果不启用自动平仓，跳过
    if (!autoClose) {
      this.logger.log(`用户 ${userId} 未启用自动平仓，跳过平仓信号`);
      return { success: true, error: 'auto_close_disabled' };
    }

    // 查找该用户该币种指定方向的开放持仓（按 subscriptionId + side 精确匹配）
    const openPosition = await this.prisma.position.findFirst({
      where: {
        userId,
        symbol,
        side: positionSide,
        status: 'open',
        ...(subscriptionId ? { subscriptionId } : {}),
      },
    });

    if (!openPosition) {
      this.logger.log(`用户 ${userId} 没有 ${symbol} ${positionSide} 持仓，跳过平仓`);
      return { success: true, error: 'no_position_to_close' };
    }

    this.logger.log(
      `自动平仓: 用户 ${userId} 持仓 ${openPosition.id} ${symbol} (${positionSide})`,
    );

    // 执行平仓
    const result = await this.tradingService.closePosition(
      userId,
      apiKeyId,
      symbol,
      parseFloat(openPosition.amount.toString()),
      openPosition.side as 'long' | 'short',
      config,
    );

    // 计算盈亏
    const entryPrice = new Decimal(openPosition.entryPrice.toString());
    const closePrice = new Decimal(result.price);
    const amount = new Decimal(openPosition.amount.toString());

    let pnl: Decimal;
    if (openPosition.side === 'long') {
      pnl = closePrice.minus(entryPrice).times(amount);
    } else {
      pnl = entryPrice.minus(closePrice).times(amount);
    }

    // 更新持仓状态
    await this.prisma.position.update({
      where: { id: openPosition.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closePrice: closePrice,
        closeReason: 'signal',
        pnl: pnl,
      },
    });

    // ===== 移除监控 =====
    this.positionMonitorService.untrackPosition(openPosition.id);
    this.dcaService.untrackPosition(openPosition.id);

    this.logger.log(`平仓成功: 持仓 ${openPosition.id} PnL: ${pnl.toString()}`);

    // ===== 记录已实现盈亏到日亏损监控 =====
    try {
      await this.dailyPnlService.recordRealizedPnl(
        userId,
        parseFloat(pnl.toString()),
        symbol,
        openPosition.id,
      );
    } catch (e) {
      this.logger.warn(`记录日盈亏失败: ${e.message}`);
    }

    // ===== 标记执行成功 =====
    try {
      await this.signalsService.markExecutionSuccess(
        signalId,
        userId,
        result.orderId || '',
        result.price.toString(),
        result.amount?.toString() || '0',
      );
    } catch (e) {
      this.logger.warn(`更新平仓执行状态失败: ${e.message}`);
    }

    // ===== 燃油费扣除（仅盈利时） =====
    if (pnl.gt(0)) {
      try {
        const feeCalc = await this.feeService.calculateFee(
          userId,
          pnl.toString(),
        );
        this.logger.log(
          `燃油费计算: 盈利 ${feeCalc.profit}, 费率 ${feeCalc.finalFeeRate}, 费用 ${feeCalc.feeAmount}`,
        );

        if (parseFloat(feeCalc.feeAmount) > 0) {
          const uniqueOrderId = this.feeService.generateUniqueOrderId(
            'GAS_FEE',
            userId,
            openPosition.id,
          );

          await this.feeService.chargeFee({
            userId,
            positionId: openPosition.id,
            profit: feeCalc.profit,
            feeRate: feeCalc.finalFeeRate,
            feeAmount: feeCalc.feeAmount,
            uniqueOrderId,
          });

          this.logger.log(`燃油费已扣除: ${feeCalc.feeAmount} USDT`);
        }
      } catch (error) {
        this.logger.error(`燃油费扣除失败: ${error.message}`);
        // 燃油费扣除失败不影响平仓结果
      }
    }

    // 发送平仓通知
    await this.notificationsService.notifyPositionClosed(
      userId,
      symbol,
      closePrice.toString(),
      pnl.toString(),
    );

    return { success: true, positionId: openPosition.id };
  }

  // 发送交易失败通知
  private async sendTradeFailedNotification(
    userId: string,
    symbol: string,
    side: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.notificationsService.send({
        userId,
        type: 'TRADE_FAILED' as any,
        title: '❌ 交易失败',
        message: '',
        data: { symbol, side, reason },
      });
    } catch (error) {
      this.logger.error(`发送失败通知时出错: ${error.message}`);
    }
  }

  // 获取风控拒绝原因的用户友好消息
  private getRiskReasonMessage(
    reason?: string,
    details?: Record<string, any>,
  ): string {
    switch (reason) {
      case 'max_positions_reached':
        return `已达最大持仓数限制 (${details?.current || '?'}/${details?.max || '?'})`;
      case 'symbol_already_open':
        return `${details?.symbol || '该币种'} 已有持仓，不允许重复开仓`;
      case 'daily_limit_reached':
        return `已达每日交易次数限制 (${details?.current || '?'}/${details?.max || '?'})`;
      case 'insufficient_balance':
        return `余额不足: ${(details?.balance || 0).toFixed(2)} < ${(details?.required || 0).toFixed(2)} USDT`;
      case 'balance_below_minimum':
        return `交易后余额将低于最小要求 ${details?.minRequired || 10} USDT`;
      case 'balance_check_failed':
        return `余额查询失败: ${details?.error || '未知错误'}`;
      default:
        return reason || '未知风控限制';
    }
  }

  // 从错误中提取错误码
  private extractErrorCode(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message;
      // Binance 错误格式: {"code":-2019,"msg":"Margin is insufficient."}
      const binanceMatch = message.match(/"code":(-?\d+)/);
      if (binanceMatch) {
        return `EXCHANGE_${binanceMatch[1]}`;
      }
      // CCXT 错误
      if (message.includes('InsufficientFunds')) return 'INSUFFICIENT_FUNDS';
      if (message.includes('InvalidOrder')) return 'INVALID_ORDER';
      if (message.includes('NetworkError')) return 'NETWORK_ERROR';
      if (message.includes('ExchangeError')) return 'EXCHANGE_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }
}
