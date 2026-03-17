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
import { Prisma } from '@prisma/client';
import { DailyPnlService } from '../daily-pnl.service';
import { MarketMonitorService } from '../market-monitor.service';
import { ReferralService } from '../../referral/referral.service';
import { AirdropService } from '../../airdrop/airdrop.service';
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
    private referralService: ReferralService,
    private airdropService: AirdropService,
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

    const processStart = Date.now();

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

      // ===== 写入失败的 TradeExecutionLog =====
      await this.writeExecutionLog({
        userId,
        signalId,
        exchange,
        symbol,
        side: (action === 'entry_long' || action === 'exit_short') ? 'buy' : 'sell',
        orderType: action,
        requestedAmountUsdt: parseFloat(amountPerTrade || '0'),
        requestedPrice: parseFloat(price),
        status: 'failed',
        errorCode,
        errorMessage,
        startedAt: new Date(processStart),
        durationMs: Date.now() - processStart,
        configSnapshot: config,
      });

      // 记录失败的持仓（根据 action 判断方向：entry/exit_long 对应 long，entry/exit_short 对应 short）
      const failedSide = (action === 'entry_long' || action === 'exit_long') ? 'long' : 'short';
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
          subscriptionId,
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
        'entry_long',
        this.getRiskReasonMessage(riskCheck.reason, riskCheck.details),
      );

      return { success: false, error: riskCheck.reason };
    }

    // 执行交易
    const executionStart = Date.now();
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
        source: 'signal',
        // 交易配置
        tradingType: config.tradingType || 'spot',
        leverage: config.leverage || 1,
        margin: new Decimal(requiredAmount), // 保证金 = amountPerTrade
        marginMode: config.marginMode || 'cross',
      },
    });

    this.logger.log(`开仓成功: 用户 ${userId} 持仓 ${position.id}`);

    // ===== 写入 TradeExecutionLog =====
    await this.writeExecutionLog({
      userId,
      positionId: position.id,
      signalId,
      exchange,
      symbol,
      side: 'buy',
      orderType: 'market',
      requestedAmountUsdt: requiredAmount,
      requestedPrice: parseFloat(price),
      executedAmount: result.amount,
      executedPrice: result.price,
      status: 'filled',
      startedAt: new Date(executionStart),
      durationMs: Date.now() - executionStart,
      configSnapshot: config,
    });

    // ===== 合约交易：从交易所获取实际杠杆和标记价格 =====
    if (config.tradingType === 'futures') {
      try {
        const exchangePositions = await this.tradingService.fetchPositions(
          userId,
          apiKeyId,
          symbol,
        );
        const matchedPos = exchangePositions.find(
          (p: Record<string, unknown>) => isSameSymbol((p.symbol as string) || '', symbol),
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

          const updateData: Prisma.PositionUpdateInput & { lastSyncAt?: Date } = {};
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

    // 首次成功交易 → 触发邀请人的 HOOT 代币奖励
    await this.tryGrantReferralAirdrop(userId);

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
    const executionStart = Date.now();
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
        source: 'signal',
        tradingType: config.tradingType || 'spot',
        leverage: config.leverage || 1,
        margin: new Decimal(requiredAmount),
        marginMode: config.marginMode || 'cross',
      },
    });

    this.logger.log(`开空成功: 用户 ${userId} 持仓 ${position.id}`);

    // ===== 写入 TradeExecutionLog =====
    await this.writeExecutionLog({
      userId,
      positionId: position.id,
      signalId,
      exchange,
      symbol,
      side: 'sell',
      orderType: 'market',
      requestedAmountUsdt: requiredAmount,
      requestedPrice: parseFloat(price),
      executedAmount: result.amount,
      executedPrice: result.price,
      status: 'filled',
      startedAt: new Date(executionStart),
      durationMs: Date.now() - executionStart,
      configSnapshot: config,
    });

    // ===== 合约交易：从交易所获取实际杠杆和标记价格 =====
    if (config.tradingType === 'futures') {
      try {
        const exchangePositions = await this.tradingService.fetchPositions(
          userId,
          apiKeyId,
          symbol,
        );
        const matchedPos = exchangePositions.find(
          (p: Record<string, unknown>) => isSameSymbol((p.symbol as string) || '', symbol),
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

          const updateData: Prisma.PositionUpdateInput & { lastSyncAt?: Date } = {};
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

    // 首次成功交易 → 触发邀请人的 HOOT 代币奖励
    await this.tryGrantReferralAirdrop(userId);

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
    const executionStart = Date.now();
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

    // ===== 写入 TradeExecutionLog =====
    await this.writeExecutionLog({
      userId,
      positionId: openPosition.id,
      signalId,
      exchange,
      symbol,
      side: openPosition.side === 'long' ? 'sell' : 'buy',
      orderType: 'close_position',
      requestedAmountUsdt: parseFloat(openPosition.amount.toString()) * result.price,
      requestedPrice: parseFloat(openPosition.entryPrice.toString()),
      executedAmount: result.amount,
      executedPrice: result.price,
      status: 'filled',
      startedAt: new Date(executionStart),
      durationMs: Date.now() - executionStart,
      configSnapshot: { ...config, closeReason: 'signal', pnl: pnl.toString() },
    });

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

    // 发送平仓通知
    await this.notificationsService.notifyPositionClosed(
      userId,
      symbol,
      closePrice.toString(),
      pnl.toString(),
    );

    return { success: true, positionId: openPosition.id };
  }

  /**
   * 处理推荐返佣（二级分佣）
   * 返佣基数：燃油费金额
   * 一级返佣：燃油费 × level1Rate%（默认10%）
   * 二级返佣：燃油费 × level2Rate%（默认5%）
   */
  private async processReferralCommission(
    userId: string,
    positionId: string,
    feeAmount: string,
  ): Promise<void> {
    try {
      const fee = new Decimal(feeAmount);
      if (fee.lte(0)) return;

      // 获取返佣配置
      const config = await this.prisma.referralConfig.findUnique({
        where: { id: 'default' },
      });

      // 未配置或未启用，跳过
      if (!config || !config.isActive) return;

      // 检查是否启用了 trading 类型返佣
      const enabledTypes = config.enabledTypes as string[];
      if (!enabledTypes.includes('trading')) {
        this.logger.debug('交易类型返佣未启用，跳过');
        return;
      }

      // 查找邀请链：当前用户 → 一级邀请人 → 二级邀请人 → 三级邀请人
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { invitedBy: true },
      });

      if (!user?.invitedBy) return; // 没有邀请人，跳过

      const levels = [
        { inviterId: user.invitedBy, rate: new Decimal(config.level1Rate.toString()).div(100), level: 1 },
      ];

      // 查找二级邀请人
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

      // 为每一级创建返佣记录
      for (const { inviterId, rate, level } of levels) {
        const commission = fee.times(rate);
        if (commission.lte(0)) continue;

        const uniqueOrderId = `ref_${inviterId}_gas_${positionId}_L${level}_${Date.now()}`;

        await this.referralService.createReward(
          inviterId,
          userId,
          'trading',
          commission.toFixed(8),
          'USDT',
          uniqueOrderId,
        );

        this.logger.log(
          `推荐返佣 L${level}: ${inviterId} 从 ${userId} 获得 ${commission.toFixed(8)} USDT（费用 ${feeAmount} × ${rate.times(100)}%）`,
        );
      }
    } catch (error) {
      this.logger.error(`推荐返佣处理失败: ${error.message}`);
      // 返佣失败不影响交易结果
    }
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
  /**
   * 首次成功交易时，给邀请人发放 HOOT 代币奖励
   * 条件：被邀请人有 invitedBy 且之前未发放过该奖励
   * grantReferralAirdrop 内部有幂等检查（不会重复发放）
   */
  private async tryGrantReferralAirdrop(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { invitedBy: true },
      });

      if (!user?.invitedBy) return;

      await this.airdropService.grantReferralAirdrop(user.invitedBy, userId);
      this.logger.log(
        `邀请奖励已发放: 邀请人 ${user.invitedBy} ← 被邀请人 ${userId} 首次成功交易`,
      );
    } catch (error) {
      // 奖励失败不影响交易
      this.logger.warn(`邀请奖励发放失败: ${error.message}`);
    }
  }

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

  /**
   * 写入 TradeExecutionLog — 记录每次交易的完整执行信息
   * 包含：请求价格、成交价格、滑点、耗时、配置快照等
   */
  private async writeExecutionLog(params: {
    userId: string;
    positionId?: string;
    signalId?: string;
    exchange: string;
    symbol: string;
    side: string;
    orderType: string;
    requestedAmountUsdt: number;
    requestedPrice?: number;
    executedAmount?: number;
    executedPrice?: number;
    status: string;
    errorCode?: string;
    errorMessage?: string;
    startedAt?: Date;
    durationMs?: number;
    configSnapshot?: any;
  }): Promise<void> {
    try {
      const slippagePercent =
        params.requestedPrice && params.executedPrice && params.requestedPrice > 0
          ? ((params.executedPrice - params.requestedPrice) / params.requestedPrice) * 100
          : undefined;

      const executedVolumeUsdt =
        params.executedAmount && params.executedPrice
          ? params.executedAmount * params.executedPrice
          : undefined;

      await this.prisma.tradeExecutionLog.create({
        data: {
          userId: params.userId,
          positionId: params.positionId,
          signalId: params.signalId,
          exchange: params.exchange,
          symbol: params.symbol,
          side: params.side,
          orderType: params.orderType,
          requestedAmountUsdt: new Decimal(params.requestedAmountUsdt),
          requestedPrice: params.requestedPrice != null ? new Decimal(params.requestedPrice) : undefined,
          executedAmount: params.executedAmount != null ? new Decimal(params.executedAmount) : undefined,
          executedPrice: params.executedPrice != null ? new Decimal(params.executedPrice) : undefined,
          executedVolumeUsdt: executedVolumeUsdt != null ? new Decimal(executedVolumeUsdt) : undefined,
          slippagePercent: slippagePercent != null ? new Decimal(slippagePercent) : undefined,
          status: params.status,
          errorCode: params.errorCode,
          errorMessage: params.errorMessage,
          startedAt: params.startedAt,
          completedAt: new Date(),
          durationMs: params.durationMs,
          configSnapshot: params.configSnapshot ? JSON.stringify(params.configSnapshot) : undefined,
        },
      });
    } catch (e) {
      this.logger.warn(`写入 TradeExecutionLog 失败: ${(e as Error).message}`);
    }
  }
}
