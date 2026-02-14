import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiExecutionService } from './ai-execution.service';
import { MarketDataService } from './market-data.service';

/**
 * 网格配置（V1 简化版）
 *
 * V1 仅支持:
 * - uniform 均匀分布
 * - neutral 方向（多空对称）
 * - 手动边界
 *
 * V2 扩展（延后）:
 * - 3 种分布: uniform / gaussian / pyramid
 * - 5 种方向: neutral / long / short / long_bias / short_bias
 * - ATR 自动边界
 * - 多周期箱体突破检测
 */
export interface GridConfig {
  symbol: string;
  gridCount: number; // 网格数量（默认 10）
  totalInvestment: number; // 总投资额（USDT）
  upperBound: number; // 上界价格
  lowerBound: number; // 下界价格
  leverage: number; // 杠杆倍数（默认 1）
}

/**
 * 网格线
 */
interface GridLine {
  price: number;
  side: 'buy' | 'sell'; // 当前价格以下 = buy，以上 = sell
  amount: number; // 每格数量
  filled: boolean; // 是否已成交
  orderId?: string; // 交易所订单 ID
}

/**
 * 网格状态
 */
export interface GridState {
  strategyId: string;
  symbol: string;
  gridLines: GridLine[];
  upperBound: number;
  lowerBound: number;
  gridSpacing: number; // 网格间距
  amountPerGrid: number; // 每格金额
  totalInvestment: number;
  leverage: number;
  isInitialized: boolean;
  lastPrice: number;
  createdAt: string;
}

/**
 * 网格交易服务（V1 简化版）
 *
 * 参考 NoFx auto_trader_grid.go 但大幅简化
 *
 * V1 核心逻辑:
 * 1. 初始化: 在 upper-lower 范围内均匀分布 N 条网格线
 * 2. 每个周期: 获取当前价格，检查哪些网格线被穿越
 * 3. 穿越上方网格 → 卖出（做空），穿越下方网格 → 买入（做多）
 * 4. 成交后在对侧放置反向订单
 */
@Injectable()
export class GridTradingService {
  private readonly logger = new Logger(GridTradingService.name);

  // 内存缓存（热路径使用），变更时同步持久化到 AiStrategy.gridConfig
  private gridStates = new Map<string, GridState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiExecution: AiExecutionService,
    private readonly marketData: MarketDataService,
  ) {}

  /**
   * 初始化网格
   */
  async initializeGrid(
    strategyId: string,
    userId: string,
    config: GridConfig,
  ): Promise<GridState> {
    const { symbol, gridCount, totalInvestment, upperBound, lowerBound, leverage } = config;

    if (upperBound <= lowerBound) {
      throw new Error('上界必须大于下界');
    }

    if (gridCount < 2 || gridCount > 100) {
      throw new Error('网格数量必须在 2-100 之间');
    }

    // 计算网格间距
    const gridSpacing = (upperBound - lowerBound) / gridCount;

    // 每格金额
    const amountPerGrid = totalInvestment / gridCount;

    // 获取当前价格
    const currentPrice = await this.getCurrentPrice(symbol);

    // 生成网格线（均匀分布）
    const gridLines: GridLine[] = [];
    for (let i = 0; i <= gridCount; i++) {
      const price = lowerBound + i * gridSpacing;
      gridLines.push({
        price: Math.round(price * 100) / 100,
        side: price < currentPrice ? 'buy' : 'sell',
        amount: amountPerGrid,
        filled: false,
      });
    }

    const state: GridState = {
      strategyId,
      symbol,
      gridLines,
      upperBound,
      lowerBound,
      gridSpacing,
      amountPerGrid,
      totalInvestment,
      leverage,
      isInitialized: true,
      lastPrice: currentPrice,
      createdAt: new Date().toISOString(),
    };

    this.gridStates.set(strategyId, state);

    // 持久化到数据库
    await this.persistGridState(strategyId, state);

    this.logger.log(
      `[网格] 初始化: ${symbol}, ${gridCount} 格, ` +
        `范围 ${lowerBound}-${upperBound}, 间距 ${gridSpacing.toFixed(2)}, ` +
        `每格 $${amountPerGrid.toFixed(2)}, 当前价 ${currentPrice}`,
    );

    return state;
  }

  /**
   * 运行网格周期
   *
   * 每个周期检查价格是否穿越了网格线:
   * - 价格上穿网格线 → 卖出
   * - 价格下穿网格线 → 买入
   */
  async runGridCycle(
    strategyId: string,
    userId: string,
    apiKeyId: string,
  ): Promise<{ trades: number; errors: number }> {
    // 优先从内存取，没有则从数据库恢复
    let state: GridState | undefined | null = this.gridStates.get(strategyId);
    if (!state) {
      state = await this.loadGridState(strategyId);
    }

    if (!state || !state.isInitialized) {
      this.logger.warn(`[网格] 策略 ${strategyId} 未初始化`);
      return { trades: 0, errors: 0 };
    }

    const currentPrice = await this.getCurrentPrice(state.symbol);
    const lastPrice = state.lastPrice;

    let trades = 0;
    let errors = 0;

    // 检查每条网格线
    for (const line of state.gridLines) {
      if (line.filled) continue;

      // 价格从下方穿越到上方 → 触发卖出
      if (lastPrice < line.price && currentPrice >= line.price && line.side === 'sell') {
        try {
          await this.executeGridTrade(
            userId,
            apiKeyId,
            state.symbol,
            'open_short',
            line.amount,
            state.leverage,
          );
          line.filled = true;
          trades++;
          this.logger.log(`[网格] 卖出: ${state.symbol} @ ${line.price}`);
        } catch (error) {
          errors++;
          this.logger.error(`[网格] 卖出失败: ${error.message}`);
        }
      }

      // 价格从上方穿越到下方 → 触发买入
      if (lastPrice > line.price && currentPrice <= line.price && line.side === 'buy') {
        try {
          await this.executeGridTrade(
            userId,
            apiKeyId,
            state.symbol,
            'open_long',
            line.amount,
            state.leverage,
          );
          line.filled = true;
          trades++;
          this.logger.log(`[网格] 买入: ${state.symbol} @ ${line.price}`);
        } catch (error) {
          errors++;
          this.logger.error(`[网格] 买入失败: ${error.message}`);
        }
      }
    }

    // 更新最后价格
    state.lastPrice = currentPrice;

    // 重置已成交网格（反向挂单 — V1 简化为等待下次穿越）
    for (const line of state.gridLines) {
      if (line.filled) {
        // 翻转方向，等待反向触发
        line.side = line.side === 'buy' ? 'sell' : 'buy';
        line.filled = false;
      }
    }

    // 持久化状态变更
    if (trades > 0) {
      await this.persistGridState(strategyId, state);
    }

    if (trades > 0 || errors > 0) {
      this.logger.log(
        `[网格] ${state.symbol}: 价格 ${lastPrice} → ${currentPrice}, ` +
          `${trades} 笔成交, ${errors} 个错误`,
      );
    }

    return { trades, errors };
  }

  /**
   * 获取网格状态（内存优先，回退数据库）
   */
  async getGridState(strategyId: string): Promise<GridState | null> {
    const cached = this.gridStates.get(strategyId);
    if (cached) return cached;
    return this.loadGridState(strategyId);
  }

  /**
   * 关闭网格（清理内存 + 数据库）
   */
  async closeGrid(strategyId: string): Promise<void> {
    this.gridStates.delete(strategyId);
    try {
      await this.prisma.aiStrategy.update({
        where: { id: strategyId },
        data: { gridConfig: null as any },
      });
    } catch {
      // 策略可能已被删除，忽略
    }
    this.logger.log(`[网格] 关闭: ${strategyId}`);
  }

  /**
   * 调整网格边界
   */
  async adjustGrid(
    strategyId: string,
    userId: string,
    newConfig: Partial<GridConfig>,
  ): Promise<GridState | null> {
    const state = this.gridStates.get(strategyId) || await this.loadGridState(strategyId);
    if (!state) return null;

    // 关闭旧网格
    await this.closeGrid(strategyId);

    // 用新配置重新初始化
    const config: GridConfig = {
      symbol: state.symbol,
      gridCount: state.gridLines.length - 1,
      totalInvestment: state.totalInvestment,
      upperBound: newConfig.upperBound || state.upperBound,
      lowerBound: newConfig.lowerBound || state.lowerBound,
      leverage: newConfig.leverage || state.leverage,
    };

    return this.initializeGrid(strategyId, userId, config);
  }

  // ========================= 持久化方法 =========================

  /**
   * 将网格状态持久化到 AiStrategy.gridConfig JSON 字段
   */
  private async persistGridState(strategyId: string, state: GridState): Promise<void> {
    try {
      await this.prisma.aiStrategy.update({
        where: { id: strategyId },
        data: { gridConfig: state as any },
      });
    } catch (error) {
      this.logger.warn(`[网格] 持久化失败 ${strategyId}: ${error.message}`);
    }
  }

  /**
   * 从数据库恢复网格状态（服务重启后恢复）
   */
  private async loadGridState(strategyId: string): Promise<GridState | null> {
    try {
      const strategy = await this.prisma.aiStrategy.findUnique({
        where: { id: strategyId },
        select: { gridConfig: true },
      });

      if (!strategy?.gridConfig) return null;

      const state = strategy.gridConfig as unknown as GridState;
      if (state && state.isInitialized) {
        this.gridStates.set(strategyId, state);
        this.logger.log(`[网格] 从数据库恢复状态: ${strategyId}`);
        return state;
      }

      return null;
    } catch (error) {
      this.logger.warn(`[网格] 加载状态失败 ${strategyId}: ${error.message}`);
      return null;
    }
  }

  // ========================= 内部方法 =========================

  private async getCurrentPrice(symbol: string): Promise<number> {
    // 从 market-data 获取最新 ticker
    const ohlcv = await this.marketData.fetchOHLCV(symbol, '1m', 1);
    if (ohlcv && ohlcv.length > 0) {
      return ohlcv[ohlcv.length - 1][4] as number; // close price
    }
    throw new Error(`无法获取 ${symbol} 当前价格`);
  }

  private async executeGridTrade(
    userId: string,
    apiKeyId: string,
    symbol: string,
    action: 'open_long' | 'open_short',
    positionSizeUSD: number,
    leverage: number,
  ): Promise<void> {
    await this.aiExecution.executeDecision(
      userId,
      apiKeyId,
      {
        symbol,
        action,
        confidence: 100, // 网格交易无信心度概念
        leverage,
        positionSizeUSD,
        reasoning: 'Grid trading signal',
      },
      'ai_strategy',
    );
  }
}
