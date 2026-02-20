import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingService, TradingConfig } from '../../trading/trading.service';
import { Decimal } from '@prisma/client/runtime/library';
import { isSameSymbol } from '../../../common/utils/symbol.util';
import { AiMemoryService } from '../services/memory.service';

// AI 交易任务数据接口
export interface AiTradeJobData {
  analysisId: string; // AI 分析记录 ID
  signalId: string; // 信号 ID
  userId: string;
  apiKeyId: string; // 用户的交易所 API Key ID
  exchange: string; // 交易所名称 (binance)
  symbol: string; // 交易对 (BTC/USDT:USDT)
  side: 'buy' | 'sell';
  action: 'entry_long' | 'entry_short' | 'close_long' | 'close_short';
  price: string; // 当前市场价格
  amountPerTrade: string; // 下单金额 (USDT)
  leverage: number; // 杠杆倍数
  takeProfitPercent?: number; // 止盈百分比
  stopLossPercent?: number; // 止损百分比
  source: 'ai_analysis';
}

@Processor('trade-ai')
export class AiTradeProcessor extends WorkerHost {
  private readonly logger = new Logger(AiTradeProcessor.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TradingService))
    private tradingService: TradingService,
    private memoryService: AiMemoryService,
  ) {
    super();
  }

  async process(
    job: Job<AiTradeJobData>,
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    const { action } = job.data;

    // 路由到对应处理方法
    if (action === 'close_long' || action === 'close_short') {
      return this.handleClosePosition(job);
    }
    return this.handleOpenPosition(job);
  }

  /**
   * 处理开仓 (entry_long / entry_short)
   */
  private async handleOpenPosition(
    job: Job<AiTradeJobData>,
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    const {
      analysisId,
      signalId,
      userId,
      apiKeyId,
      exchange,
      symbol,
      side,
      action,
      price,
      amountPerTrade,
      leverage,
    } = job.data;

    this.logger.log(
      `[AI交易] 开仓: 用户 ${userId} ${action} ${symbol} @ ${price}, 金额 ${amountPerTrade} USDT`,
    );

    const config: TradingConfig = {
      tradingType: 'futures',
      leverage: leverage || 3,
      marginMode: 'cross',
      slippageTolerance: 0.5,
      maxRetries: 3,
      retryDelayMs: 1000,
    };

    try {
      // 执行交易
      const result = await this.tradingService.executeOrder(
        userId,
        apiKeyId,
        symbol,
        side,
        parseFloat(amountPerTrade),
        config,
      );

      // 创建持仓记录
      const position = await this.prisma.position.create({
        data: {
          userId,
          exchange,
          symbol,
          side: action === 'entry_long' ? 'long' : 'short',
          entryPrice: new Decimal(result.price),
          amount: new Decimal(result.amount),
          exchangeOrderId: result.orderId,
          status: 'open',
          signalId,
          apiKeyId,
          tradingType: 'futures',
          leverage: config.leverage,
          margin: new Decimal(parseFloat(amountPerTrade)),
          marginMode: config.marginMode,
          source: 'ai_analysis',
        },
      });

      // 更新 AI 分析状态
      await this.prisma.aiAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'executed',
          executedAt: new Date(),
        },
      });

      // 合约交易：从交易所获取实际杠杆和标记价格
      try {
        const exchangePositions = await this.tradingService.fetchPositions(
          userId,
          apiKeyId,
          symbol,
        );
        const matchedPos = exchangePositions.find((p: any) =>
          isSameSymbol(p.symbol || '', symbol),
        );
        if (matchedPos) {
          const updateData: any = {};
          const actualLeverage = parseInt(
            matchedPos.leverage ||
              matchedPos.info?.leverage ||
              config.leverage,
          );
          const actualMarkPrice = parseFloat(
            matchedPos.markPrice || matchedPos.info?.markPrice || 0,
          );
          const actualLiqPrice = parseFloat(
            matchedPos.liquidationPrice ||
              matchedPos.info?.liquidationPrice ||
              0,
          );

          if (actualLeverage !== config.leverage)
            updateData.leverage = actualLeverage;
          if (actualMarkPrice > 0)
            updateData.markPrice = new Decimal(actualMarkPrice);
          if (actualLiqPrice > 0)
            updateData.liquidationPrice = new Decimal(actualLiqPrice);

          if (Object.keys(updateData).length > 0) {
            updateData.lastSyncAt = new Date();
            await this.prisma.position.update({
              where: { id: position.id },
              data: updateData,
            });
          }
        }
      } catch (e) {
        this.logger.warn(
          `[AI交易] 获取交易所实际持仓数据失败: ${e.message}`,
        );
      }

      this.logger.log(
        `[AI交易] 开仓成功: ${position.id} ${symbol} ${action === 'entry_long' ? 'LONG' : 'SHORT'}`,
      );
      return { success: true, positionId: position.id };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '未知错误';
      this.logger.error(`[AI交易] 开仓失败: ${errorMessage}`);

      // 更新 AI 分析状态为失败
      await this.prisma.aiAnalysis.update({
        where: { id: analysisId },
        data: { status: 'failed' },
      });

      // 创建失败的持仓记录
      await this.prisma.position.create({
        data: {
          userId,
          exchange,
          symbol,
          side: action === 'entry_long' ? 'long' : 'short',
          entryPrice: new Decimal(price),
          amount: new Decimal(0),
          status: 'failed',
          signalId,
          apiKeyId,
        },
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 处理平仓 (close_long / close_short)
   */
  private async handleClosePosition(
    job: Job<AiTradeJobData>,
  ): Promise<{ success: boolean; positionId?: string; error?: string }> {
    const {
      analysisId,
      userId,
      apiKeyId,
      symbol,
      side,
      action,
      price,
    } = job.data;

    const positionSide = action === 'close_long' ? 'long' : 'short';

    this.logger.log(
      `[AI交易] 平仓: 用户 ${userId} ${action} ${symbol} @ ${price}`,
    );

    // 查找目标持仓
    const position = await this.prisma.position.findFirst({
      where: {
        userId,
        symbol,
        side: positionSide,
        status: 'open',
        source: 'ai_analysis',
      },
      orderBy: { createdAt: 'asc' }, // 先开先平 (FIFO)
    });

    if (!position) {
      this.logger.warn(
        `[AI交易] 未找到可平仓的 ${positionSide} 持仓: ${symbol}`,
      );
      return { success: false, error: `无 ${positionSide} 持仓可平` };
    }

    const config: TradingConfig = {
      tradingType: 'futures',
      leverage: position.leverage || 3,
      marginMode: (position.marginMode as 'cross' | 'isolated') || 'cross',
      slippageTolerance: 0.5,
      maxRetries: 3,
      retryDelayMs: 1000,
    };

    try {
      // 执行平仓交易
      const result = await this.tradingService.executeOrder(
        userId,
        apiKeyId,
        symbol,
        side, // close_long → sell, close_short → buy
        parseFloat(position.amount.toString()),
        config,
      );

      // 计算盈亏
      const exitPrice = result.price || parseFloat(price);
      const entryPrice = parseFloat(position.entryPrice.toString());
      const amount = parseFloat(position.amount.toString());
      let pnl: number;

      if (positionSide === 'long') {
        pnl = (exitPrice - entryPrice) * amount;
      } else {
        pnl = (entryPrice - exitPrice) * amount;
      }

      // 更新持仓记录
      await this.prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'closed',
          exitPrice: new Decimal(exitPrice),
          realizedPnl: new Decimal(pnl),
          closedAt: new Date(),
        },
      });

      // 更新 AI 分析状态
      await this.prisma.aiAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'executed',
          executedAt: new Date(),
        },
      });

      this.logger.log(
        `[AI交易] 平仓成功: ${position.id} ${symbol} ${positionSide.toUpperCase()} PnL: ${pnl > 0 ? '+' : ''}${pnl.toFixed(4)} USDT`,
      );

      // 存储交易记忆（用于 BM25 检索）
      try {
        const margin = parseFloat((position as any).margin?.toString() || '1');
        const pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;
        const sceneText = this.memoryService.buildSceneText({
          symbol,
          timeframe: '4h',
        });
        await this.memoryService.storeMemory({
          userId,
          analysisId,
          symbol,
          sceneText,
          action: positionSide === 'long' ? 'open_long' : 'open_short',
          pnl,
          pnlPercent,
        });
      } catch (e) {
        this.logger.warn(`[AI交易] 记忆存储失败: ${e.message}`);
      }

      return { success: true, positionId: position.id };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '未知错误';
      this.logger.error(`[AI交易] 平仓失败: ${errorMessage}`);

      // 更新 AI 分析状态为失败
      await this.prisma.aiAnalysis.update({
        where: { id: analysisId },
        data: { status: 'failed' },
      });

      return { success: false, error: errorMessage };
    }
  }
}
