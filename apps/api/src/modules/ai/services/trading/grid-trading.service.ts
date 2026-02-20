import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MarketDataService } from '../market-data.service';
import { IndicatorsService, OHLCV } from '../indicators.service';
import { LLMService, UserApiKeys } from '../llm.service';
import { AdapterFactoryService } from '../../../exchange-adapters/adapter-factory.service';
import {
  ExchangeAdapter,
  GridExchangeAdapter,
  isGridAdapter,
  LimitOrderRequest,
} from '../../../exchange-adapters/types/adapter.interface';
import { GRID_SYSTEM_PROMPT, buildGridUserPrompt, type GridContext } from '../../constants/trading-prompts';

// ========================= 类型定义（对齐 NoFx GridState） =========================

/** 网格配置（用户输入，存储在 gridConfig，不可变） */
export interface GridConfig {
  symbol: string;
  gridCount: number;           // 网格数量（2-100，默认 10）
  totalInvestment: number;     // 总投资额（USDT）
  upperBound?: number;         // 手动上界（useATRBounds=true 时可省略）
  lowerBound?: number;         // 手动下界
  leverage: number;            // 杠杆倍数（默认 1）
  distribution?: 'uniform' | 'gaussian' | 'pyramid'; // 分布（默认 uniform）
  direction?: GridDirection;   // 方向（默认 neutral）
  useATRBounds?: boolean;      // 使用 ATR 自动边界
  atrMultiplier?: number;      // ATR 乘数（默认 2.0）
  maxDrawdownPct?: number;     // 最大回撤%（默认 15）
  dailyLossLimitPct?: number;  // 日内亏损限额%（默认 5）
  enableDirectionAdjust?: boolean; // 启用方向自适应
  useMakerOnly?: boolean;      // PostOnly 限价单
  modelId?: string;            // AI 模型（默认 deepseek-chat）
}

/** 网格方向 — 对齐 NoFx market.GridDirection */
export type GridDirection = 'neutral' | 'long' | 'short' | 'long_bias' | 'short_bias';

/** 市场状态 — 对齐 NoFx grid_regime.go */
export type RegimeLevel = 'narrow' | 'standard' | 'wide' | 'volatile';

/** 突破级别 — 对齐 NoFx BreakoutLevel */
export type BreakoutLevel = 'none' | 'short' | 'mid' | 'long';

/** 突破动作 — 对齐 NoFx BreakoutAction */
export type BreakoutAction = 'none' | 'reduce_position' | 'adjust_direction' | 'pause_grid' | 'close_all';

/** 网格线 — 对齐 NoFx kernel.GridLevelInfo */
export interface GridLine {
  index: number;
  price: number;
  state: 'empty' | 'pending' | 'filled' | 'stopped';
  side: 'buy' | 'sell';
  orderId?: string;
  orderQuantity: number;
  positionSize: number;
  positionEntry: number;
  allocatedUSD: number;
  unrealizedPnl: number;
}

/** 网格运行时状态（存储在 gridRuntimeState，可变） — 对齐 NoFx GridState */
export interface GridState {
  strategyId: string;
  symbol: string;
  gridLines: GridLine[];
  upperPrice: number;
  lowerPrice: number;
  gridSpacing: number;
  totalInvestment: number;
  leverage: number;
  distribution: string;
  isInitialized: boolean;
  isPaused: boolean;
  pauseReason?: string;
  lastPrice: number;

  // 绩效追踪
  totalProfit: number;
  totalTrades: number;
  winningTrades: number;
  maxDrawdown: number;
  peakEquity: number;
  dailyPnl: number;
  dailyPnlResetDate: string; // YYYY-MM-DD

  // 订单簿追踪（orderId → levelIndex）
  orderBook: Record<string, number>;

  // 箱体状态（Donchian 多周期）
  shortBoxUpper: number;
  shortBoxLower: number;
  midBoxUpper: number;
  midBoxLower: number;
  longBoxUpper: number;
  longBoxLower: number;

  // 突破状态
  breakoutLevel: BreakoutLevel;
  breakoutDirection: string; // 'up' | 'down' | ''
  breakoutConfirmCount: number;

  // 仓位缩减（虚假突破恢复后）
  positionReductionPct: number;

  // 市场状态分类
  currentRegime: RegimeLevel;

  // 方向调节
  currentDirection: GridDirection;

  createdAt: string;
}

/** AI 返回的网格决策 */
export interface GridDecision {
  symbol: string;
  action: string;
  price?: number;
  quantity?: number;
  level_index?: number;
  order_id?: string;
  confidence: number;
  reasoning: string;
}

// ========================= 常量 =========================

const BREAKOUT_CONFIRM_REQUIRED = 3;
const DEFAULT_ATR_MULTIPLIER = 2.0;
const DEFAULT_MAX_DRAWDOWN_PCT = 15;
const DEFAULT_DAILY_LOSS_LIMIT_PCT = 5;
const DIRECTION_BIAS_RATIO = 0.7; // 70/30 分配
const POSITION_SAFETY_MULTIPLIER = 2; // 仓位绝对安全上限 = TotalInvestment × Leverage × 2

/**
 * 网格交易服务（V2 — 对齐 NoFx auto_trader_grid.go）
 *
 * 核心增强（相对 V1）:
 * 1. 三种网格分布: uniform / gaussian / pyramid
 * 2. ATR 自动边界计算
 * 3. 五种方向: neutral / long / short / long_bias / short_bias
 * 4. AI 决策: 每周期 1 次 LLM 调用，返回 JSON 数组决策
 * 5. 限价单: 通过 GridExchangeAdapter 下限价单（非市价单）
 * 6. 多级风控: 最大回撤 / 日内亏损 / 箱体突破
 * 7. 突破检测: 三级 Donchian（3d/10d/21d）+ 3 次确认
 * 8. 市场状态: Bollinger + ATR → narrow/standard/wide/volatile
 * 9. 方向自适应: 突破后自动调整方向 + 虚假突破恢复
 */
@Injectable()
export class GridTradingService {
  private readonly logger = new Logger(GridTradingService.name);

  // 内存缓存（热路径），变更时同步持久化到 gridRuntimeState
  private gridStates = new Map<string, GridState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    @Optional() private readonly indicators: IndicatorsService,
    @Optional() private readonly llm: LLMService,
    @Optional() private readonly adapterFactory: AdapterFactoryService,
  ) {}

  // ========================= 初始化 =========================

  /**
   * 初始化网格（对齐 NoFx InitializeGrid）
   */
  async initializeGrid(
    strategyId: string,
    userId: string,
    apiKeyId: string,
    config: GridConfig,
    apiKeys: UserApiKeys = {},
  ): Promise<GridState> {
    const {
      symbol,
      gridCount,
      totalInvestment,
      leverage,
      distribution = 'uniform',
      direction = 'neutral',
      useATRBounds = false,
      atrMultiplier = DEFAULT_ATR_MULTIPLIER,
    } = config;

    if (gridCount < 2 || gridCount > 100) {
      throw new Error('网格数量必须在 2-100 之间');
    }

    // 获取当前价格
    const currentPrice = await this.getCurrentPrice(symbol);

    // Step 1: 计算边界
    let upperPrice: number;
    let lowerPrice: number;

    if (useATRBounds && this.indicators) {
      // ATR 自动边界
      const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, '4h', 20);
      const highs = ohlcvRaw.map((c: any) => Number(c[2]));
      const lows = ohlcvRaw.map((c: any) => Number(c[3]));
      const closes = ohlcvRaw.map((c: any) => Number(c[4]));
      const atr = this.indicators.calculateATR(highs, lows, closes, 14);

      if (atr && atr > 0) {
        const mult = atrMultiplier > 0 ? atrMultiplier : DEFAULT_ATR_MULTIPLIER;
        const halfRange = atr * mult;
        upperPrice = currentPrice + halfRange;
        lowerPrice = currentPrice - halfRange;
      } else {
        // ATR 计算失败，使用默认范围
        const mult = 0.03 * gridCount / 10;
        upperPrice = currentPrice * (1 + mult);
        lowerPrice = currentPrice * (1 - mult);
      }
    } else if (config.upperBound && config.lowerBound) {
      upperPrice = config.upperBound;
      lowerPrice = config.lowerBound;
    } else {
      // 默认范围
      const mult = 0.03 * gridCount / 10;
      upperPrice = currentPrice * (1 + mult);
      lowerPrice = currentPrice * (1 - mult);
    }

    if (upperPrice <= lowerPrice) {
      throw new Error('上界必须大于下界');
    }

    // Step 2: 网格间距
    const gridSpacing = (upperPrice - lowerPrice) / (gridCount - 1);

    // Step 3: 三种分布权重
    const weights = this.calculateWeights(gridCount, distribution);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    // Step 4: 创建网格线
    const gridLines: GridLine[] = [];
    for (let i = 0; i < gridCount; i++) {
      const price = lowerPrice + i * gridSpacing;
      const allocatedUSD = totalInvestment * (weights[i] / weightSum);
      gridLines.push({
        index: i,
        price: Math.round(price * 100) / 100,
        state: 'empty',
        side: price <= currentPrice ? 'buy' : 'sell',
        orderQuantity: 0,
        positionSize: 0,
        positionEntry: 0,
        allocatedUSD,
        unrealizedPnl: 0,
      });
    }

    // Step 5: 方向分配
    this.applyGridDirection(gridLines, currentPrice, direction);

    // Step 6: 设置杠杆（如果有 adapter）
    if (this.adapterFactory && apiKeyId) {
      try {
        const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
        await adapter.setLeverage(symbol, leverage);
        await adapter.dispose();
      } catch (e: any) {
        this.logger.warn(`[网格] 设置杠杆失败: ${e.message}`);
      }
    }

    // 获取初始权益
    let initialEquity = totalInvestment;
    if (this.adapterFactory && apiKeyId) {
      try {
        const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
        const balance = await adapter.getBalance();
        initialEquity = balance.totalEquity;
        await adapter.dispose();
      } catch {
        // 使用默认值
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const state: GridState = {
      strategyId,
      symbol,
      gridLines,
      upperPrice,
      lowerPrice,
      gridSpacing,
      totalInvestment,
      leverage,
      distribution,
      isInitialized: true,
      isPaused: false,
      lastPrice: currentPrice,

      totalProfit: 0,
      totalTrades: 0,
      winningTrades: 0,
      maxDrawdown: 0,
      peakEquity: initialEquity,
      dailyPnl: 0,
      dailyPnlResetDate: today,

      orderBook: {},

      shortBoxUpper: 0,
      shortBoxLower: 0,
      midBoxUpper: 0,
      midBoxLower: 0,
      longBoxUpper: 0,
      longBoxLower: 0,

      breakoutLevel: 'none',
      breakoutDirection: '',
      breakoutConfirmCount: 0,
      positionReductionPct: 0,
      currentRegime: 'standard',
      currentDirection: direction,

      createdAt: new Date().toISOString(),
    };

    this.gridStates.set(strategyId, state);
    await this.persistGridState(strategyId, state);

    this.logger.log(
      `[网格] 初始化: ${symbol}, ${gridCount} 格, 分布=${distribution}, 方向=${direction}, ` +
        `范围 ${lowerPrice.toFixed(2)}-${upperPrice.toFixed(2)}, 间距 ${gridSpacing.toFixed(2)}, ` +
        `每格 $${(totalInvestment / gridCount).toFixed(2)}, 当前价 ${currentPrice}`,
    );

    return state;
  }

  // ========================= 核心周期（对齐 NoFx RunGridCycle 9 步） =========================

  /**
   * 运行网格周期
   */
  async runGridCycle(
    strategyId: string,
    userId: string,
    apiKeyId: string,
    apiKeys: UserApiKeys = {},
    gridConfig?: GridConfig,
  ): Promise<{ trades: number; errors: number }> {
    // Step 1: 获取/恢复状态
    let state = this.gridStates.get(strategyId);
    if (!state) {
      state = await this.loadGridState(strategyId) ?? undefined;
      if (state) {
        // 从 DB 恢复，需要 reconcile
        await this.reconcileGridState(strategyId, userId, apiKeyId, state);
      }
    }

    if (!state || !state.isInitialized) {
      // 尝试自动初始化
      if (gridConfig) {
        state = await this.initializeGrid(strategyId, userId, apiKeyId, gridConfig, apiKeys);
      } else {
        this.logger.warn(`[网格] 策略 ${strategyId} 未初始化`);
        return { trades: 0, errors: 0 };
      }
    }

    const currentPrice = await this.getCurrentPrice(state.symbol);
    let trades = 0;
    let errors = 0;

    // Step 2: 简单边界突破检查
    const breakoutPct = this.checkSimpleBreakout(currentPrice, state);
    if (breakoutPct >= 2.0) {
      this.logger.warn(`[网格] 价格突破网格边界 ${breakoutPct.toFixed(1)}%，暂停网格`);
      state.isPaused = true;
      state.pauseReason = `价格突破网格边界 ${breakoutPct.toFixed(1)}%`;
      await this.persistGridState(strategyId, state);
      return { trades: 0, errors: 0 };
    }

    // Step 3: 最大回撤检查
    let currentEquity = state.peakEquity;
    if (this.adapterFactory && apiKeyId) {
      try {
        const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
        const balance = await adapter.getBalance();
        currentEquity = balance.totalEquity;
        await adapter.dispose();
      } catch { /* 使用缓存值 */ }
    }

    if (currentEquity > state.peakEquity) {
      state.peakEquity = currentEquity;
    }

    const maxDrawdownPct = gridConfig?.maxDrawdownPct ?? DEFAULT_MAX_DRAWDOWN_PCT;
    if (state.peakEquity > 0) {
      const drawdown = ((state.peakEquity - currentEquity) / state.peakEquity) * 100;
      if (drawdown > state.maxDrawdown) state.maxDrawdown = drawdown;
      if (drawdown >= maxDrawdownPct) {
        await this.emergencyExit(state, userId, apiKeyId, `最大回撤超限: ${drawdown.toFixed(1)}% ≥ ${maxDrawdownPct}%`);
        await this.persistGridState(strategyId, state);
        return { trades: 0, errors: 0 };
      }
    }

    // Step 4: 日内亏损检查
    const today = new Date().toISOString().split('T')[0];
    if (state.dailyPnlResetDate !== today) {
      state.dailyPnl = 0;
      state.dailyPnlResetDate = today;
    }
    const dailyLossLimitPct = gridConfig?.dailyLossLimitPct ?? DEFAULT_DAILY_LOSS_LIMIT_PCT;
    if (state.dailyPnl < 0 && state.totalInvestment > 0) {
      const dailyLossPct = (Math.abs(state.dailyPnl) / state.totalInvestment) * 100;
      if (dailyLossPct >= dailyLossLimitPct) {
        state.isPaused = true;
        state.pauseReason = `日内亏损超限: ${dailyLossPct.toFixed(1)}% ≥ ${dailyLossLimitPct}%`;
        this.logger.warn(`[网格] ${state.pauseReason}`);
        await this.persistGridState(strategyId, state);
        return { trades: 0, errors: 0 };
      }
    }

    // Step 5: 箱体突破检测（Donchian 多周期）
    if (this.indicators) {
      try {
        await this.updateBoxData(state);
        const { level, direction } = this.detectBoxBreakout(currentPrice, state);
        if (level !== 'none') {
          const confirmed = this.confirmBreakout(state, level, direction);
          if (confirmed) {
            const action = this.getBreakoutAction(level, gridConfig?.enableDirectionAdjust ?? false);
            await this.executeBreakoutAction(state, action, direction, userId, apiKeyId);
            if (state.isPaused) {
              await this.persistGridState(strategyId, state);
              return { trades: 0, errors: 0 };
            }
          }
        } else {
          // 虚假突破恢复检查
          this.checkFalseBreakoutRecovery(state, currentPrice, gridConfig?.enableDirectionAdjust ?? false);
        }
      } catch (e: any) {
        this.logger.warn(`[网格] 箱体分析失败: ${e.message}`);
      }
    }

    // Step 6: 市场状态分类
    if (this.indicators) {
      try {
        state.currentRegime = await this.classifyRegime(state.symbol);
      } catch { /* 保持上次值 */ }
    }

    // Step 7: 暂停检查
    if (state.isPaused) {
      this.logger.debug(`[网格] ${state.symbol} 已暂停: ${state.pauseReason || '未知'}`);
      await this.persistGridState(strategyId, state);
      return { trades: 0, errors: 0 };
    }

    // Step 8: AI 决策
    if (this.llm && this.adapterFactory) {
      try {
        const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);

        // 同步订单状态 + 成交后立即下反向单
        if (isGridAdapter(adapter)) {
          const { filledLines } = await this.syncOrderFills(state, adapter as GridExchangeAdapter);
          if (filledLines.length > 0) {
            const reversePlaced = await this.placeReverseOrders(
              state, filledLines, adapter as GridExchangeAdapter,
              gridConfig?.useMakerOnly ?? false,
            );
            trades += reversePlaced;
          }
        }

        // 构建 AI 上下文
        const context = await this.buildGridContext(state, adapter, currentPrice);
        const modelId = gridConfig?.modelId || 'deepseek-chat';

        const response = await this.llm.chat(
          modelId,
          GRID_SYSTEM_PROMPT(state.symbol, state.gridLines.length, state.totalInvestment, state.leverage, state.distribution),
          buildGridUserPrompt(context),
          apiKeys,
          { temperature: 0.3, maxTokens: 1500 },
        );

        // 解析 AI 决策
        const decisions = this.parseGridDecisions(response.content);

        // 执行决策
        for (const d of decisions) {
          try {
            await this.executeGridDecision(state, d, adapter, userId, apiKeyId, gridConfig?.useMakerOnly ?? false);
            if (d.action.includes('place_')) trades++;
          } catch (e: any) {
            errors++;
            this.logger.warn(`[网格] 执行决策失败: ${d.action} - ${e.message}`);
          }
        }

        // 记录到 AiStrategyLog
        if (decisions.length > 0) {
          await this.saveGridDecisionLog(strategyId, decisions, response.cost);
        }

        await adapter.dispose();
      } catch (e: any) {
        errors++;
        this.logger.error(`[网格] AI 决策周期失败: ${e.message}`);
      }
    }

    // Step 9: 更新状态
    state.lastPrice = currentPrice;
    await this.persistGridState(strategyId, state);

    if (trades > 0 || errors > 0) {
      this.logger.log(`[网格] ${state.symbol}: ${trades} 笔交易, ${errors} 个错误, 状态=${state.currentRegime}`);
    }

    return { trades, errors };
  }

  // ========================= 突破检测（对齐 NoFx grid_regime.go） =========================

  /** 简单边界突破检查 */
  private checkSimpleBreakout(price: number, state: GridState): number {
    if (price > state.upperPrice) {
      return ((price - state.upperPrice) / state.upperPrice) * 100;
    }
    if (price < state.lowerPrice) {
      return ((state.lowerPrice - price) / state.lowerPrice) * 100;
    }
    return 0;
  }

  /** 更新 Donchian 箱体数据（3 个周期） */
  private async updateBoxData(state: GridState): Promise<void> {
    const ohlcvRaw = await this.marketData.fetchOHLCV(state.symbol, '1h', 504);
    const highs = ohlcvRaw.map((c: any) => Number(c[2]));
    const lows = ohlcvRaw.map((c: any) => Number(c[3]));

    // 短期 3d = 72h
    const shortDonchian = this.indicators!.calculateDonchianChannel(highs, lows, 72);
    state.shortBoxUpper = shortDonchian.upper ?? 0;
    state.shortBoxLower = shortDonchian.lower ?? 0;

    // 中期 10d = 240h
    const midDonchian = this.indicators!.calculateDonchianChannel(highs, lows, 240);
    state.midBoxUpper = midDonchian.upper ?? 0;
    state.midBoxLower = midDonchian.lower ?? 0;

    // 长期 21d = 504h
    const longDonchian = this.indicators!.calculateDonchianChannel(highs, lows, 504);
    state.longBoxUpper = longDonchian.upper ?? 0;
    state.longBoxLower = longDonchian.lower ?? 0;
  }

  /** 检测箱体突破（优先级：长期>中期>短期） */
  private detectBoxBreakout(
    price: number,
    state: GridState,
  ): { level: BreakoutLevel; direction: string } {
    // 长期箱体
    if (state.longBoxUpper > 0 && state.longBoxLower > 0) {
      if (price > state.longBoxUpper) return { level: 'long', direction: 'up' };
      if (price < state.longBoxLower) return { level: 'long', direction: 'down' };
    }
    // 中期箱体
    if (state.midBoxUpper > 0 && state.midBoxLower > 0) {
      if (price > state.midBoxUpper) return { level: 'mid', direction: 'up' };
      if (price < state.midBoxLower) return { level: 'mid', direction: 'down' };
    }
    // 短期箱体
    if (state.shortBoxUpper > 0 && state.shortBoxLower > 0) {
      if (price > state.shortBoxUpper) return { level: 'short', direction: 'up' };
      if (price < state.shortBoxLower) return { level: 'short', direction: 'down' };
    }
    return { level: 'none', direction: '' };
  }

  /** 确认突破（需要连续 3 次） */
  private confirmBreakout(state: GridState, level: BreakoutLevel, direction: string): boolean {
    if (level === 'none') {
      state.breakoutConfirmCount = 0;
      state.breakoutLevel = 'none';
      state.breakoutDirection = '';
      return false;
    }

    if (state.breakoutLevel === level && state.breakoutDirection === direction) {
      state.breakoutConfirmCount++;
    } else {
      state.breakoutLevel = level;
      state.breakoutDirection = direction;
      state.breakoutConfirmCount = 1;
    }

    return state.breakoutConfirmCount >= BREAKOUT_CONFIRM_REQUIRED;
  }

  /** 突破动作映射 */
  private getBreakoutAction(level: BreakoutLevel, enableDirectionAdjust: boolean): BreakoutAction {
    if (enableDirectionAdjust) {
      switch (level) {
        case 'short': return 'adjust_direction';
        case 'mid': return 'adjust_direction';
        case 'long': return 'close_all';
        default: return 'none';
      }
    }
    switch (level) {
      case 'short': return 'reduce_position';
      case 'mid': return 'pause_grid';
      case 'long': return 'close_all';
      default: return 'none';
    }
  }

  /** 执行突破动作 */
  private async executeBreakoutAction(
    state: GridState,
    action: BreakoutAction,
    direction: string,
    userId: string,
    apiKeyId: string,
  ): Promise<void> {
    this.logger.warn(`[网格] 突破动作: ${action}, 方向=${direction}, 级别=${state.breakoutLevel}`);

    switch (action) {
      case 'reduce_position':
        state.positionReductionPct = 50;
        break;

      case 'adjust_direction':
        state.currentDirection = this.determineGridDirection(
          state.breakoutLevel,
          direction,
          state.currentDirection,
        );
        this.applyGridDirection(state.gridLines, state.lastPrice, state.currentDirection);
        break;

      case 'pause_grid':
        state.isPaused = true;
        state.pauseReason = `${state.breakoutLevel} 级别突破 (${direction})`;
        break;

      case 'close_all':
        await this.emergencyExit(state, userId, apiKeyId,
          `长期箱体突破 (${direction})，紧急平仓`);
        break;
    }
  }

  /** 虚假突破恢复检查 */
  private checkFalseBreakoutRecovery(
    state: GridState,
    price: number,
    enableDirectionAdjust: boolean,
  ): void {
    // 价格回到长期箱体内
    if (
      state.longBoxUpper > 0 && state.longBoxLower > 0 &&
      price >= state.longBoxLower && price <= state.longBoxUpper
    ) {
      if (state.isPaused || state.positionReductionPct > 0) {
        state.breakoutLevel = 'none';
        state.breakoutDirection = '';
        state.breakoutConfirmCount = 0;
        state.positionReductionPct = 50; // 恢复到 50%
        state.isPaused = false;
        state.pauseReason = undefined;
        this.logger.log('[网格] 虚假突破恢复: 价格回到长期箱体内');
      }
    }

    // 方向恢复（价格回到短期箱体内，逐步回归中性）
    if (
      enableDirectionAdjust &&
      state.currentDirection !== 'neutral' &&
      state.shortBoxUpper > 0 && state.shortBoxLower > 0 &&
      price >= state.shortBoxLower && price <= state.shortBoxUpper
    ) {
      const recovered = this.determineRecoveryDirection(state.currentDirection);
      if (recovered !== state.currentDirection) {
        state.currentDirection = recovered;
        this.applyGridDirection(state.gridLines, price, recovered);
        this.logger.log(`[网格] 方向恢复: ${state.currentDirection} → ${recovered}`);
      }
    }
  }

  /** 突破后方向调整 */
  private determineGridDirection(
    level: BreakoutLevel,
    direction: string,
    current: GridDirection,
  ): GridDirection {
    switch (level) {
      case 'short':
        return direction === 'up' ? 'long_bias' : 'short_bias';
      case 'mid':
        return direction === 'up' ? 'long' : 'short';
      case 'long':
        return current; // 长期突破由 emergencyExit 处理
      default:
        return current;
    }
  }

  /** 虚假突破后逐步回归中性 */
  private determineRecoveryDirection(current: GridDirection): GridDirection {
    switch (current) {
      case 'long': return 'long_bias';
      case 'long_bias': return 'neutral';
      case 'short': return 'short_bias';
      case 'short_bias': return 'neutral';
      default: return 'neutral';
    }
  }

  // ========================= 市场状态分类 =========================

  /** 分类市场状态（对齐 NoFx classifyRegimeLevel） */
  private async classifyRegime(symbol: string): Promise<RegimeLevel> {
    const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, '1h', 50);
    const closes = ohlcvRaw.map((c: any) => Number(c[4]));
    const highs = ohlcvRaw.map((c: any) => Number(c[2]));
    const lows = ohlcvRaw.map((c: any) => Number(c[3]));
    const currentPrice = closes[closes.length - 1] || 0;

    if (!currentPrice || !this.indicators) return 'standard';

    const bb = this.indicators.calculateBollingerBands(closes, 20);
    const atr = this.indicators.calculateATR(highs, lows, closes, 14);

    const bbWidth = (bb.upper && bb.middle && bb.lower && bb.middle > 0)
      ? ((bb.upper - bb.lower) / bb.middle) * 100
      : 3; // 默认 standard
    const atrPct = (atr && currentPrice > 0) ? (atr / currentPrice) * 100 : 2;

    if (bbWidth < 2.0 && atrPct < 1.0) return 'narrow';
    if (bbWidth <= 3.0 && atrPct <= 2.0) return 'standard';
    if (bbWidth <= 4.0 && atrPct <= 3.0) return 'wide';
    return 'volatile';
  }

  // ========================= AI 上下文 & 决策 =========================

  /** 构建网格 AI 上下文（对齐 NoFx GridContext） */
  private async buildGridContext(
    state: GridState,
    adapter: ExchangeAdapter,
    currentPrice: number,
  ): Promise<GridContext> {
    // 获取市场指标
    const ohlcvRaw = await this.marketData.fetchOHLCV(state.symbol, '5m', 50);
    const ohlcv: OHLCV[] = ohlcvRaw.map((c: any) => ({
      timestamp: c[0],
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    }));

    let ind: any = {};
    if (this.indicators) {
      ind = this.indicators.calculateAll(ohlcv);
    }

    // 获取账户状态
    let totalEquity = state.peakEquity;
    let availableBalance = 0;
    let currentPosition = 0;
    let unrealizedPnl = 0;

    try {
      const balance = await adapter.getBalance();
      totalEquity = balance.totalEquity;
      availableBalance = balance.availableBalance;
      unrealizedPnl = balance.unrealizedPnl;

      const positions = await adapter.getPositions();
      const symPos = positions.find((p) => p.symbol.includes(state.symbol.split('/')[0]));
      if (symPos) {
        currentPosition = symPos.side === 'long' ? symPos.quantity : -symPos.quantity;
      }
    } catch { /* 使用默认值 */ }

    // 资金费率
    let fundingRate = 0;
    try {
      const fr = await this.marketData.fetchFundingRate(state.symbol);
      if (fr) fundingRate = fr.fundingRate;
    } catch { /* 忽略 */ }

    // 价格变化
    const priceChange1h = ohlcv.length >= 12
      ? ((currentPrice - ohlcv[ohlcv.length - 12].close) / ohlcv[ohlcv.length - 12].close) * 100
      : 0;
    const priceChange4h = ohlcv.length >= 48
      ? ((currentPrice - ohlcv[ohlcv.length - 48].close) / ohlcv[ohlcv.length - 48].close) * 100
      : 0;

    // 布林带宽度
    const bbUpper = ind.bollingerBands?.upper ?? 0;
    const bbMiddle = ind.bollingerBands?.middle ?? currentPrice;
    const bbLower = ind.bollingerBands?.lower ?? 0;
    const bbWidth = bbMiddle > 0 ? ((bbUpper - bbLower) / bbMiddle) * 100 : 0;

    // EMA 距离
    const ema20 = ind.ema?.ema20 ?? 0;
    const ema50 = ind.ema?.ema50 ?? 0;
    const emaDistance = ema50 > 0 ? ((ema20 - ema50) / ema50) * 100 : 0;

    return {
      symbol: state.symbol,
      currentTime: new Date().toISOString(),
      currentPrice,
      gridCount: state.gridLines.length,
      totalInvestment: state.totalInvestment,
      leverage: state.leverage,
      upperPrice: state.upperPrice,
      lowerPrice: state.lowerPrice,
      gridSpacing: state.gridSpacing,
      distribution: state.distribution,
      levels: state.gridLines.map((l) => ({
        price: l.price,
        side: l.side,
        quantity: l.orderQuantity,
        state: (l.state === 'empty' || l.state === 'stopped' ? 'cancelled' : l.state) as 'pending' | 'filled' | 'cancelled',
        orderId: l.orderId,
        fillPrice: l.positionEntry > 0 ? l.positionEntry : undefined,
        profit: l.unrealizedPnl !== 0 ? l.unrealizedPnl : undefined,
      })),
      activeOrderCount: state.gridLines.filter((l) => l.state === 'pending').length,
      filledLevelCount: state.gridLines.filter((l) => l.state === 'filled').length,
      isPaused: state.isPaused,
      atr14: ind.atr ?? 0,
      bollingerUpper: bbUpper,
      bollingerMiddle: bbMiddle,
      bollingerLower: bbLower,
      bollingerWidth: bbWidth,
      ema20,
      ema50,
      emaDistance,
      rsi14: ind.rsi ?? 50,
      macd: ind.macd?.macd ?? 0,
      macdSignal: ind.macd?.signal ?? 0,
      macdHistogram: ind.macd?.histogram ?? 0,
      fundingRate,
      volume24h: ohlcv.reduce((s, c) => s + c.volume, 0),
      priceChange1h,
      priceChange4h,
      totalEquity,
      availableBalance,
      currentPosition,
      unrealizedPnl,
      totalProfit: state.totalProfit,
      totalTrades: state.totalTrades,
      winningTrades: state.winningTrades,
      maxDrawdown: state.maxDrawdown,
      dailyPnl: state.dailyPnl,
      boxData: (state.shortBoxUpper > 0) ? {
        shortUpper: state.shortBoxUpper,
        shortLower: state.shortBoxLower,
        midUpper: state.midBoxUpper,
        midLower: state.midBoxLower,
        longUpper: state.longBoxUpper,
        longLower: state.longBoxLower,
      } : undefined,
      currentDirection: state.currentDirection,
    };
  }

  /** 解析 AI 返回的 JSON 决策数组 */
  private parseGridDecisions(content: string): GridDecision[] {
    try {
      // 提取 JSON 数组
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((d: any) => d && d.action);
    } catch (e: any) {
      this.logger.warn(`[网格] AI 决策解析失败: ${e.message}`);
      return [];
    }
  }

  /** 执行单条网格决策 */
  private async executeGridDecision(
    state: GridState,
    decision: GridDecision,
    adapter: ExchangeAdapter,
    userId: string,
    apiKeyId: string,
    useMakerOnly = false,
  ): Promise<void> {
    const { action } = decision;

    switch (action) {
      case 'place_buy_limit':
      case 'place_sell_limit':
        if (!isGridAdapter(adapter)) {
          this.logger.warn('[网格] 适配器不支持限价单');
          return;
        }
        await this.placeGridLimitOrder(
          state,
          decision,
          action === 'place_buy_limit' ? 'buy' : 'sell',
          adapter as GridExchangeAdapter,
          useMakerOnly,
        );
        break;

      case 'cancel_order':
        if (decision.order_id && isGridAdapter(adapter)) {
          await (adapter as GridExchangeAdapter).cancelOrder(state.symbol, decision.order_id);
          // 更新本地状态
          const levelIdx = state.orderBook[decision.order_id];
          if (levelIdx !== undefined && state.gridLines[levelIdx]) {
            state.gridLines[levelIdx].state = 'empty';
            state.gridLines[levelIdx].orderId = undefined;
          }
          delete state.orderBook[decision.order_id];
        }
        break;

      case 'cancel_all_orders':
        await adapter.cancelAllOrders(state.symbol);
        for (const line of state.gridLines) {
          if (line.state === 'pending') {
            line.state = 'empty';
            line.orderId = undefined;
          }
        }
        state.orderBook = {};
        break;

      case 'pause_grid':
        await adapter.cancelAllOrders(state.symbol);
        state.isPaused = true;
        state.pauseReason = decision.reasoning || 'AI 决策暂停';
        break;

      case 'resume_grid':
        state.isPaused = false;
        state.pauseReason = undefined;
        break;

      case 'adjust_grid': {
        await adapter.cancelAllOrders(state.symbol);
        const newPrice = decision.price || state.lastPrice;
        this.reinitializeGridLevels(state, newPrice);
        break;
      }

      case 'hold':
        // 不操作
        break;

      default:
        this.logger.debug(`[网格] 未知 AI 动作: ${action}`);
    }
  }

  /** 下网格限价单（含仓位限制检查，对齐 NoFx placeGridLimitOrder） */
  private async placeGridLimitOrder(
    state: GridState,
    decision: GridDecision,
    side: 'buy' | 'sell',
    adapter: GridExchangeAdapter,
    useMakerOnly = false,
  ): Promise<void> {
    const levelIndex = decision.level_index ?? -1;
    let quantity = decision.quantity ?? 0;
    const price = decision.price ?? 0;

    if (price <= 0 || quantity <= 0) return;

    const level = levelIndex >= 0 ? state.gridLines[levelIndex] : undefined;

    // Step 1: 仓位上限检查
    if (price > 0 && state.totalInvestment > 0) {
      const maxMarginPerLevel = state.totalInvestment / state.gridLines.length;
      let maxQuantityPerLevel = (maxMarginPerLevel * state.leverage) / price;

      // 使用 level-specific 分配
      if (level && level.allocatedUSD > 0) {
        const levelMax = (level.allocatedUSD * state.leverage) / price;
        maxQuantityPerLevel = Math.min(maxQuantityPerLevel, levelMax);
      }

      // 仓位缩减（突破恢复后）
      if (state.positionReductionPct > 0) {
        maxQuantityPerLevel *= (1 - state.positionReductionPct / 100);
      }

      quantity = Math.min(quantity, maxQuantityPerLevel);

      // 绝对安全上限
      const positionValue = quantity * price;
      const absoluteMax = state.totalInvestment * state.leverage * POSITION_SAFETY_MULTIPLIER;
      if (positionValue > absoluteMax) {
        this.logger.warn(`[网格] 仓位超安全上限，跳过: ${positionValue.toFixed(2)} > ${absoluteMax.toFixed(2)}`);
        return;
      }
    }

    // Step 2: 格式化数量
    const formattedQty = await adapter.formatQuantity(state.symbol, quantity);
    const finalQty = parseFloat(formattedQty);
    if (finalQty <= 0) return;

    // Step 3: 下单
    const positionSide = side === 'buy' ? 'long' : 'short';
    const clientId = level ? `grid-${levelIndex}-${Date.now()}` : undefined;

    const result = await adapter.placeLimitOrder({
      symbol: state.symbol,
      side,
      positionSide,
      price,
      quantity: finalQty,
      leverage: state.leverage,
      postOnly: useMakerOnly,
      clientId,
    });

    // Step 4: 更新本地状态
    if (level) {
      level.state = 'pending';
      level.orderId = result.orderId;
      level.orderQuantity = finalQty;
      state.orderBook[result.orderId] = levelIndex;
    }

    this.logger.log(`[网格] 限价单: ${side} ${finalQty} @ ${price} (level=${levelIndex}, orderId=${result.orderId})`);
  }

  // ========================= 紧急退出 =========================

  /** 紧急平仓（对齐 NoFx emergencyExit） */
  private async emergencyExit(
    state: GridState,
    userId: string,
    apiKeyId: string,
    reason: string,
  ): Promise<void> {
    this.logger.error(`[网格] 紧急退出: ${reason}`);

    if (!this.adapterFactory) return;

    try {
      const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);

      // 取消所有订单
      await adapter.cancelAllOrders(state.symbol);

      // 平掉所有持仓
      const positions = await adapter.getPositions();
      for (const pos of positions) {
        if (!pos.symbol.includes(state.symbol.split('/')[0])) continue;
        try {
          if (pos.side === 'long') {
            await adapter.closeLong(pos.symbol, pos.quantity);
          } else {
            await adapter.closeShort(pos.symbol, pos.quantity);
          }
        } catch (e: any) {
          this.logger.warn(`[网格] 平仓失败: ${pos.symbol} ${pos.side} - ${e.message}`);
        }
      }

      await adapter.dispose();
    } catch (e: any) {
      this.logger.error(`[网格] 紧急退出执行失败: ${e.message}`);
    }

    state.isPaused = true;
    state.pauseReason = reason;

    // 清理订单状态
    for (const line of state.gridLines) {
      if (line.state === 'pending') {
        line.state = 'empty';
        line.orderId = undefined;
      }
    }
    state.orderBook = {};
  }

  // ========================= 订单同步 =========================

  /** 同步交易所订单到本地状态（对齐 NoFx syncGridState） */
  private async syncOrderFills(
    state: GridState,
    adapter: GridExchangeAdapter,
  ): Promise<{ filledLines: GridLine[] }> {
    const filledLines: GridLine[] = [];
    try {
      const openOrders = await adapter.getOpenOrders(state.symbol);
      const activeIds = new Set(openOrders.map((o) => o.orderId));

      for (const line of state.gridLines) {
        if (line.state !== 'pending' || !line.orderId) continue;

        if (!activeIds.has(line.orderId)) {
          // 订单消失 = 已成交
          const prevSide = line.side;
          line.state = 'filled';
          line.positionSize = line.orderQuantity;
          line.positionEntry = line.price;
          line.orderId = undefined;

          state.totalTrades++;

          // 计算 realizedPnl（卖单成交 = 平买仓的利润，买单成交 = 平卖仓的利润）
          // 网格利润 ≈ 网格间距 × 数量（每次翻转一个间距的利润）
          if (line.positionEntry > 0) {
            const gridProfit = state.gridSpacing * line.orderQuantity;
            line.unrealizedPnl = gridProfit;
            state.totalProfit += gridProfit;
            state.dailyPnl += gridProfit;
            if (gridProfit > 0) state.winningTrades++;
          }

          // 翻转方向（网格核心逻辑：买成交后放卖单，卖成交后放买单）
          line.side = line.side === 'buy' ? 'sell' : 'buy';

          filledLines.push(line);
          this.logger.log(
            `[网格] 订单成交: level=${line.index}, 价格=${line.price}, ` +
            `${prevSide}→${line.side}, 利润≈${(state.gridSpacing * line.orderQuantity).toFixed(4)}`,
          );
        }
      }

      // 清理 orderBook 中已不存在的订单
      for (const orderId of Object.keys(state.orderBook)) {
        if (!activeIds.has(orderId)) {
          delete state.orderBook[orderId];
        }
      }
    } catch (e: any) {
      this.logger.warn(`[网格] 订单同步失败: ${e.message}`);
    }
    return { filledLines };
  }

  /**
   * 成交后立即下反向限价单（对齐 NoFx placeReverseOrder）
   *
   * 网格核心：买单成交 → 在上一格放卖单，卖单成交 → 在下一格放买单
   */
  private async placeReverseOrders(
    state: GridState,
    filledLines: GridLine[],
    adapter: GridExchangeAdapter,
    useMakerOnly: boolean,
  ): Promise<number> {
    let placed = 0;
    for (const line of filledLines) {
      if (line.state !== 'filled') continue;

      const quantity = line.orderQuantity > 0 ? line.orderQuantity : line.allocatedUSD * state.leverage / line.price;
      if (quantity <= 0 || line.price <= 0) continue;

      try {
        const formattedQty = await adapter.formatQuantity(state.symbol, quantity);
        const finalQty = parseFloat(formattedQty);
        if (finalQty <= 0) continue;

        const positionSide = line.side === 'buy' ? 'long' : 'short';
        const clientId = `grid-rev-${line.index}-${Date.now()}`;

        const result = await adapter.placeLimitOrder({
          symbol: state.symbol,
          side: line.side,
          positionSide,
          price: line.price,
          quantity: finalQty,
          leverage: state.leverage,
          postOnly: useMakerOnly,
          clientId,
        });

        line.state = 'pending';
        line.orderId = result.orderId;
        line.orderQuantity = finalQty;
        state.orderBook[result.orderId] = line.index;
        placed++;

        this.logger.log(`[网格] 反向挂单: ${line.side} ${finalQty} @ ${line.price} (level=${line.index})`);
      } catch (e: any) {
        this.logger.warn(`[网格] 反向挂单失败 level=${line.index}: ${e.message}`);
      }
    }
    return placed;
  }

  // ========================= 启动恢复（T4: reconcileGridState） =========================

  /**
   * 网格状态启动恢复（对齐 NoFx position_snapshot.go）
   *
   * 从 DB 恢复后，与交易所实际状态同步
   */
  async reconcileGridState(
    strategyId: string,
    userId: string,
    apiKeyId: string,
    state?: GridState | null,
  ): Promise<void> {
    if (!state) {
      state = this.gridStates.get(strategyId) || await this.loadGridState(strategyId);
    }
    if (!state || !this.adapterFactory) return;

    this.logger.log(`[网格] 恢复状态: ${strategyId}`);

    try {
      const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);

      // 同步活跃订单
      if (isGridAdapter(adapter)) {
        const openOrders = await adapter.getOpenOrders(state.symbol);
        const activeIds = new Set(openOrders.map((o) => o.orderId));

        for (const line of state.gridLines) {
          if (line.state === 'pending' && line.orderId && !activeIds.has(line.orderId)) {
            // DB 记录有挂单，但交易所已不存在 → 标记为 empty
            line.state = 'empty';
            line.orderId = undefined;
          }
        }

        // 重建 orderBook
        state.orderBook = {};
        for (const line of state.gridLines) {
          if (line.orderId) {
            state.orderBook[line.orderId] = line.index;
          }
        }
      }

      // 同步持仓状态
      const positions = await adapter.getPositions();
      const symPos = positions.find((p) => p.symbol.includes(state!.symbol.split('/')[0]));

      if (symPos) {
        // 找到交易所持仓，检查 DB 是否有对应 Position
        const dbPos = await this.prisma.position.findFirst({
          where: {
            userId,
            symbol: { contains: state.symbol.split('/')[0] },
            status: 'open',
            source: { in: ['ai_strategy', 'snapshot'] },
          },
        });

        if (!dbPos) {
          // 交易所有但 DB 无 → 创建快照记录
          await this.prisma.position.create({
            data: {
              userId,
              exchange: adapter.exchangeType,
              symbol: symPos.symbol,
              side: symPos.side,
              amount: symPos.quantity,
              entryPrice: symPos.entryPrice,
              margin: symPos.margin,
              leverage: symPos.leverage,
              status: 'open',
              source: 'snapshot',
              apiKeyId,
            },
          });
          this.logger.log(`[网格] 创建快照持仓: ${symPos.symbol} ${symPos.side}`);
        }
      }

      await adapter.dispose();
      this.gridStates.set(strategyId, state);
      await this.persistGridState(strategyId, state);
    } catch (e: any) {
      this.logger.warn(`[网格] 状态恢复失败: ${e.message}`);
    }
  }

  // ========================= 辅助方法 =========================

  /** 计算分布权重（对齐 NoFx initializeGridLevels 3 种分布） */
  private calculateWeights(gridCount: number, distribution: string): number[] {
    const weights: number[] = [];

    switch (distribution) {
      case 'gaussian': {
        // 高斯分布（中间密集）
        const center = (gridCount - 1) / 2;
        const sigma = gridCount / 4;
        for (let i = 0; i < gridCount; i++) {
          weights.push(Math.exp(-Math.pow(i - center, 2) / (2 * sigma * sigma)));
        }
        break;
      }
      case 'pyramid': {
        // 金字塔分布（底部加重）
        for (let i = 0; i < gridCount; i++) {
          weights.push(gridCount - i);
        }
        break;
      }
      default: {
        // uniform 均匀分布
        for (let i = 0; i < gridCount; i++) {
          weights.push(1);
        }
      }
    }

    return weights;
  }

  /** 应用方向到网格线（对齐 NoFx applyGridDirection） */
  private applyGridDirection(
    gridLines: GridLine[],
    currentPrice: number,
    direction: GridDirection,
  ): void {
    const totalLevels = gridLines.length;

    switch (direction) {
      case 'long':
        gridLines.forEach((l) => (l.side = 'buy'));
        break;

      case 'short':
        gridLines.forEach((l) => (l.side = 'sell'));
        break;

      case 'long_bias': {
        const targetBuy = Math.round(totalLevels * DIRECTION_BIAS_RATIO);
        let buyCount = 0;
        for (const line of gridLines) {
          if (buyCount < targetBuy) {
            line.side = 'buy';
            buyCount++;
          } else {
            line.side = 'sell';
          }
        }
        break;
      }

      case 'short_bias': {
        const targetSell = Math.round(totalLevels * DIRECTION_BIAS_RATIO);
        let sellCount = 0;
        for (let i = gridLines.length - 1; i >= 0; i--) {
          if (sellCount < targetSell) {
            gridLines[i].side = 'sell';
            sellCount++;
          } else {
            gridLines[i].side = 'buy';
          }
        }
        break;
      }

      default: // neutral
        for (const line of gridLines) {
          line.side = line.price <= currentPrice ? 'buy' : 'sell';
        }
    }
  }

  /** 重新初始化网格层级（保持边界，更新价格中心） */
  private reinitializeGridLevels(state: GridState, centerPrice: number): void {
    const gridCount = state.gridLines.length;
    const halfRange = (state.upperPrice - state.lowerPrice) / 2;

    state.upperPrice = centerPrice + halfRange;
    state.lowerPrice = centerPrice - halfRange;
    state.gridSpacing = (state.upperPrice - state.lowerPrice) / (gridCount - 1);

    const weights = this.calculateWeights(gridCount, state.distribution);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < gridCount; i++) {
      const line = state.gridLines[i];
      line.price = Math.round((state.lowerPrice + i * state.gridSpacing) * 100) / 100;
      line.allocatedUSD = state.totalInvestment * (weights[i] / weightSum);
      if (line.state !== 'filled') {
        line.state = 'empty';
        line.orderId = undefined;
        line.orderQuantity = 0;
      }
    }

    this.applyGridDirection(state.gridLines, centerPrice, state.currentDirection);
    state.orderBook = {};

    this.logger.log(`[网格] 重建网格: 范围 ${state.lowerPrice.toFixed(2)}-${state.upperPrice.toFixed(2)}`);
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const ohlcv = await this.marketData.fetchOHLCV(symbol, '1m', 1);
    if (ohlcv && ohlcv.length > 0) {
      return Number(ohlcv[ohlcv.length - 1][4]);
    }
    throw new Error(`无法获取 ${symbol} 当前价格`);
  }

  // ========================= 持久化 =========================

  private async persistGridState(strategyId: string, state: GridState): Promise<void> {
    try {
      await this.prisma.aiStrategy.update({
        where: { id: strategyId },
        data: { gridRuntimeState: state as any },
      });
    } catch (error: any) {
      this.logger.warn(`[网格] 持久化失败 ${strategyId}: ${error.message}`);
    }
  }

  private async loadGridState(strategyId: string): Promise<GridState | null> {
    try {
      const strategy = await this.prisma.aiStrategy.findUnique({
        where: { id: strategyId },
        select: { gridRuntimeState: true },
      });

      if (!strategy?.gridRuntimeState) return null;

      const state = strategy.gridRuntimeState as unknown as GridState;
      if (state && state.isInitialized) {
        this.gridStates.set(strategyId, state);
        this.logger.log(`[网格] 从数据库恢复状态: ${strategyId}`);
        return state;
      }
      return null;
    } catch (error: any) {
      this.logger.warn(`[网格] 加载状态失败 ${strategyId}: ${error.message}`);
      return null;
    }
  }

  private async saveGridDecisionLog(
    strategyId: string,
    decisions: GridDecision[],
    cost: number,
  ): Promise<void> {
    try {
      await this.prisma.aiStrategyLog.create({
        data: {
          strategyId,
          symbol: decisions[0]?.symbol || '',
          decision: { decisions, cost } as any,
          executed: true,
        },
      });
    } catch (e: any) {
      this.logger.warn(`[网格] 日志保存失败: ${e.message}`);
    }
  }

  // ========================= 公开查询接口 =========================

  async getGridState(strategyId: string): Promise<GridState | null> {
    const cached = this.gridStates.get(strategyId);
    if (cached) return cached;
    return this.loadGridState(strategyId);
  }

  async closeGrid(strategyId: string): Promise<void> {
    this.gridStates.delete(strategyId);
    try {
      await this.prisma.aiStrategy.update({
        where: { id: strategyId },
        data: { gridRuntimeState: null as any, gridConfig: null as any },
      });
    } catch { /* 忽略 */ }
    this.logger.log(`[网格] 关闭: ${strategyId}`);
  }
}
