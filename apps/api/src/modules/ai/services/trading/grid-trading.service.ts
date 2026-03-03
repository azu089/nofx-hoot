import { Injectable, Logger, Optional, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MarketDataService } from '../market-data.service';
import { IndicatorsService, OHLCV } from '../indicators.service';
import { LLMService, UserApiKeys } from '../llm.service';
import { AdapterFactoryService } from '../../../exchange-adapters/adapter-factory.service';
import { FeeService } from '../../../trading/fee.service';
import {
  ExchangeAdapter,
  GridExchangeAdapter,
  isGridAdapter,
  LimitOrderRequest,
} from '../../../exchange-adapters/types/adapter.interface';
import { ExchangeBalance } from '../../../exchange-adapters/types/exchange.types';
import {
  GRID_SYSTEM_PROMPT,
  buildGridUserPrompt,
  GRID_RANGE_SYSTEM_PROMPT,
  buildGridRangeUserPrompt,
  type GridContext,
} from '../../constants/trading-prompts';

// ========================= 类型定义 =========================

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
  breakoutPct?: number;        // 价格突破网格边界暂停阈值%（默认 2）
  enableDirectionAdjust?: boolean; // 启用方向自适应
  useMakerOnly?: boolean;      // PostOnly 限价单
  modelId?: string;            // AI 模型（默认 deepseek-chat）
  flashBreakoutPct?: number;          // 单周期价格变化超过此值立即行动（默认 5%）
  maxHourlyChangePct?: number;        // 1H 价格变化超过此值触发紧急退出（默认 10%）
  directionalCloseOnBreakout?: boolean; // 突破上界时平 short、突破下界时平 long（默认 true）
  takerFeeRate?: number;    // 交易所 Taker 手续费率（默认 DEFAULT_TAKER_FEE_RATE）
  makerFeeRate?: number;    // 交易所 Maker 手续费率（默认 DEFAULT_MAKER_FEE_RATE）
  stopLossPct?: number;          // 单格止损阈值%（默认 5）：价格偏离 ≥ 此值平掉该格
}

/** 网格方向 */
export type GridDirection = 'neutral' | 'long' | 'short' | 'long_bias' | 'short_bias';

/** 市场状态 */
export type RegimeLevel = 'narrow' | 'standard' | 'wide' | 'volatile';

/** 突破级别 */
export type BreakoutLevel = 'none' | 'short' | 'mid' | 'long';

/** 突破动作 */
export type BreakoutAction = 'none' | 'reduce_position' | 'adjust_direction' | 'pause_grid' | 'close_all';

/** 网格线 */
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
  unrealizedPnl: number;  // 实为已实现网格利润估算 (gridSpacing×qty)，命名遗留，勿误用
}

/** 网格运行时状态（存储在 gridRuntimeState，可变） */
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
  pauseSource?: 'ai' | 'risk_control'; // 'risk_control' 时 AI 无法通过 resume_grid 解除
  lastPrice: number;

  // 绩效追踪
  totalProfit: number;
  totalTrades: number;
  winningTrades: number;
  maxDrawdown: number;
  peakEquity: number;
  dailyPnl: number;
  dailyPnlResetDate: string; // YYYY-MM-DD
  dailyStartEquity: number;  // 每日开始时的账户权益，用于计算真实日内亏损

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

  // 价格速度检测（黑天鹅早期预警）
  lastCyclePrice: number;     // 上一周期末价格（用于计算单周期速度）
  priceVelocityPct: number;  // 当前周期价格变化幅度 %

  // 手续费率（从 GridConfig 复制，供 syncOrderFills 使用）
  takerFeeRate: number;
  makerFeeRate: number;

  // 燃油费结算（点卡扣费基准）
  chargedProfit: number;    // 已结算扣费的利润累计，防止重复扣费

  // 策略权益追踪
  startEquity: number;      // 策略启动时的账户权益，永不变更（用于计算策略总收益率）
  lastEquity: number;       // 最近一次成功获取的账户权益（用于计算总盈亏）

  // OI 持仓量追踪（用于计算周期间变化，区分真假突破）
  lastOI: number;           // 上一周期的持仓量，0 表示未知

  // 动态杠杆（Regime 联动）
  effectiveLeverage: number;  // 当前生效杠杆 = min(leverage, regimeCap)，运行时由市场状态压低

  // 范围锁定（用户明确填写了上下界 → AI 不得通过 adjust_grid 修改）
  userLockedRange: boolean;

  // 逐层止损临时标记（不持久化，_前缀表示运行时临时字段）
  _pendingStopLoss?: number[];  // 需要止损的格线 index 数组

  // 实时可用保证金（每轮从交易所更新，供 placeGridLimitOrder 精确预检）
  availableBalance: number;
  // 单格止损阈值%（从 GridConfig 复制，供 buildGridContext 使用）
  stopLossPct: number;
}

/** AI 返回的网格决策 */
export interface GridDecision {
  symbol: string;
  action: string;
  price?: number;
  upperPrice?: number;
  lowerPrice?: number;
  quantity?: number;
  level_index?: number; // 旧字段名，兼容保留
  level?: number;       // Prompt 中使用的字段名（AI 返回此字段）
  order_id?: string;    // 内部统一字段名
  orderId?: string;     // AI 实际返回的字段名（由 parseGridDecisions 规范化）
  confidence?: number;
  reasoning: string;
}

// ========================= 常量 =========================

const BREAKOUT_CONFIRM_REQUIRED = 3;
const DEFAULT_ATR_MULTIPLIER = 5.0; // 5x ATR ≈ 覆盖 2-3 天波幅（原2x过窄，易被行情突破）
const DEFAULT_MAX_DRAWDOWN_PCT = 15;
const DEFAULT_DAILY_LOSS_LIMIT_PCT = 10; // 日损上限 10%
const DEFAULT_BREAKOUT_PCT = 2;
const DIRECTION_BIAS_RATIO = 0.7; // 70/30 分配
const POSITION_SAFETY_MULTIPLIER = 2; // 仓位绝对安全上限 = TotalInvestment × Leverage × 2
// 黑天鹅防护常量
const DEFAULT_FLASH_BREAKOUT_PCT = 5;         // 单周期 ≥5% 闪速突破，立即行动
const DEFAULT_MAX_HOURLY_CHANGE_PCT = 10;     // 1H ≥10% 极端行情，触发紧急退出
const FLASH_BREAKOUT_CONFIRM_OVERRIDE_PCT = 5; // 箱体突破幅度 ≥5% 跳过3次确认
// 手续费与 cancel_all 守卫常量
const DEFAULT_TAKER_FEE_RATE = 0.0005;      // 0.05% — Binance/OKX 默认 Taker 费率
const DEFAULT_MAKER_FEE_RATE = 0.0002;      // 0.02% — Binance/OKX 默认 Maker 费率
const MIN_GRID_PROFIT_MULTIPLIER = 1.5;     // 网格间距必须 ≥ 手续费来回 × 1.5 才有盈利空间
const CANCEL_ALL_MAX_DEVIATION_PCT = 40;    // cancel_all_orders 最小允许偏离度（%）
// 市场状态 → 杠杆上限映射
const REGIME_LEVERAGE_CAP: Record<RegimeLevel, number> = {
  narrow: 2,
  standard: 4,
  wide: 3,
  volatile: 2,
};
// 逐层止损默认值
const DEFAULT_STOP_LOSS_PCT = 5;

// ========================= 错误分类工具函数 =========================

/** 交易所错误类型枚举 */
type ExchangeErrorCategory =
  | '网络问题'      // fetch failed / timeout / ECONNREFUSED
  | 'API限流'      // -1003 / 429 / too many requests
  | '保证金不足'    // -2019 Margin is insufficient / -2018 insufficient balance
  | '风控限制'      // -4161 杠杆限制 / position side / maximum position
  | '数量不足'      // -4164 min notional / -4003 qty too small / -1111 precision
  | '认证失败'      // Invalid API key / signature error
  | '账户配置错误'   // OKX 51010：账户模式不支持合约交易，需用户手动开通
  | '交易所拒绝';   // 其他交易所错误

/**
 * 分类交易所错误，用于日志中明确标注失败原因
 */
function classifyExchangeError(e: any): ExchangeErrorCategory {
  const msg = (e?.message ?? '').toLowerCase();
  let code: number | string | undefined = e?.code;
  if (code === undefined && typeof e === 'object') {
    try {
      code = JSON.parse(msg.match(/\{[^}]+\}/)?.[0] ?? '{}')?.code;
    } catch {
      // 忽略解析失败，code 保持 undefined
    }
  }

  // OKX 账户模式不支持合约交易（最高优先级，精确匹配）
  // sCode:51010 "You can't complete this request under your current account mode"
  if (msg.includes('"scode":"51010"') || msg.includes('"scode": "51010"') ||
      msg.includes("account mode")) {
    return '账户配置错误';
  }

  // 网络/连接问题
  if (
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('socket hang up') ||
    msg.includes('network error') ||
    msg.includes('connect error')
  ) return '网络问题';

  // API 限流
  if (
    msg.includes('-1003') || msg.includes('1003') && msg.includes('too many') ||
    msg.includes('rate limit') ||
    msg.includes('too many request') ||
    msg.includes('429')
  ) return 'API限流';

  // 数量/精度不足（必须在风控前检测，避免被 insufficient 误归类）
  if (
    msg.includes('-4164') || msg.includes('min notional') ||
    msg.includes('-4003') || msg.includes('quantity less') ||
    msg.includes('-1111') || msg.includes('precision is over the maximum') ||
    msg.includes('lot_size') || msg.includes('lot size') ||
    msg.includes('filter failure') && msg.includes('lot')
  ) return '数量不足';

  // 保证金/余额不足（用户能理解的直接原因）
  // 包含 CCXT 封装的 InsufficientFunds 类名、Binance 错误码及常见英文表述
  if (
    msg.includes('-2019') || msg.includes('margin is insufficient') ||
    msg.includes('-2018') || msg.includes('insufficient balance') ||
    e?.constructor?.name === 'InsufficientFunds' ||
    msg.includes('insufficientfunds') ||
    (msg.includes('insufficient') && (msg.includes('margin') || msg.includes('balance') || msg.includes('fund')))
  ) return '保证金不足';

  // 风控/杠杆/仓位限制
  if (
    msg.includes('-4161') || msg.includes('leverage reduction is not supported') ||
    (msg.includes('position') && msg.includes('side')) ||
    msg.includes('maximum')
  ) return '风控限制';

  // 认证/签名错误
  if (
    msg.includes('authenticate') ||
    msg.includes('invalid api') ||
    msg.includes('signature') ||
    msg.includes('-1021') || msg.includes('timestamp') ||
    msg.includes('-2014') || msg.includes('api-key')
  ) return '认证失败';

  return '交易所拒绝';
}

/**
 * 网格交易服务（V2）
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

  // 并发保护：记录正在运行的策略 ID，防止同一策略多 job 并发执行
  private readonly runningStrategies = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    @Optional() private readonly indicators: IndicatorsService,
    @Optional() private readonly llm: LLMService,
    @Optional() private readonly adapterFactory: AdapterFactoryService,
    @Optional() private readonly feeService: FeeService,
  ) {}

  // ========================= 初始化 =========================

  /**
   * 初始化网格
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

    // Step 1: 计算边界（初始化为 ±8% 兜底，后续可被更精确算法覆盖）
    let upperPrice: number = currentPrice * 1.08;
    let lowerPrice: number = currentPrice * 0.92;
    let rangeSource = '±8%兜底';          // 追踪范围决策来源
    let rangeReasoning = '';               // AI 给出的理由

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
        rangeSource = `ATR×${mult}`;
      } else {
        // ATR 计算失败，使用 ±8% 兜底（原方案 ±1.5% 过窄）
        upperPrice = currentPrice * 1.08;
        lowerPrice = currentPrice * 0.92;
        rangeSource = '±8%兜底';
      }
    } else if (config.upperBound && config.lowerBound) {
      upperPrice = config.upperBound;
      lowerPrice = config.lowerBound;
      rangeSource = '用户指定';
    } else {
      // 用户未填写边界 → 让 AI 根据市场数据决策最优范围
      let aiRangeSet = false;

      if (this.llm && this.indicators && this.marketData) {
        try {
          // 收集市场数据（1h + 5m 并行拉取）
          const [ohlcv1hRaw, ohlcv5mRaw] = await Promise.all([
            this.marketData.fetchOHLCV(symbol, '1h', 50),
            this.marketData.fetchOHLCV(symbol, '5m', 30),
          ]);

          const mapOHLCV = (raw: any[]): OHLCV[] => raw.map((c: any) => ({
            timestamp: c[0], open: Number(c[1]), high: Number(c[2]),
            low: Number(c[3]), close: Number(c[4]), volume: Number(c[5]),
          }));

          const ohlcv1h = mapOHLCV(ohlcv1hRaw);
          const ohlcv5m = mapOHLCV(ohlcv5mRaw);

          const ind1h = this.indicators.calculateAll(ohlcv1h);
          const ind5m = this.indicators.calculateAll(ohlcv5m);

          // 24h 高低价
          const last24 = ohlcv1h.slice(-24);
          const high24h = Math.max(...last24.map(c => c.high));
          const low24h = Math.min(...last24.map(c => c.low));

          // 价格变动
          const priceChange1h = ohlcv1h.length >= 2
            ? ((currentPrice - ohlcv1h[ohlcv1h.length - 2].close) / ohlcv1h[ohlcv1h.length - 2].close) * 100
            : 0;
          const priceChange4h = ohlcv1h.length >= 5
            ? ((currentPrice - ohlcv1h[ohlcv1h.length - 5].close) / ohlcv1h[ohlcv1h.length - 5].close) * 100
            : 0;

          // 布林带宽度
          const bbUpper = ind5m.bollingerBands?.upper ?? currentPrice;
          const bbMiddle = ind5m.bollingerBands?.middle ?? currentPrice;
          const bbLower = ind5m.bollingerBands?.lower ?? currentPrice;
          const bbWidth = bbMiddle > 0 ? ((bbUpper - bbLower) / bbMiddle) * 100 : 0;

          // 调用 AI 决策范围
          const rangeResp = await this.llm.chat(
            config.modelId || 'deepseek-chat',
            GRID_RANGE_SYSTEM_PROMPT(symbol, gridCount, totalInvestment, leverage),
            buildGridRangeUserPrompt({
              currentPrice,
              atr14_1h: ind1h.atr ?? 0,
              atr14_5m: ind5m.atr ?? 0,
              high24h,
              low24h,
              rsi14: ind5m.rsi ?? 50,
              bollingerUpper: bbUpper,
              bollingerLower: bbLower,
              bollingerWidth: bbWidth,
              priceChange1h,
              priceChange4h,
              ohlcv30: ohlcv1h.slice(-30).map(c => ({
                open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
              })),
            }),
            apiKeys,
            { temperature: 0.3, maxTokens: 500 },
          );

          // 解析 AI 响应（容错：去 markdown 反引号 + 提取 JSON 对象）
          const cleanContent = rangeResp.content
            .replace(/```json?\s*/g, '').replace(/```/g, '').trim();
          const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('AI 响应中未找到 JSON 对象');
          const parsed = JSON.parse(jsonMatch[0]);

          if (parsed.upperPrice > parsed.lowerPrice &&
              parsed.upperPrice > currentPrice &&
              parsed.lowerPrice < currentPrice) {
            upperPrice = parsed.upperPrice;
            lowerPrice = parsed.lowerPrice;
            aiRangeSet = true;
            rangeSource = 'AI决策';
            rangeReasoning = parsed.reasoning || '';
            const rangePct = ((upperPrice - lowerPrice) / currentPrice * 100).toFixed(1);
            this.logger.log(
              `[网格] AI 决策范围: ${lowerPrice.toFixed(2)} ~ ${upperPrice.toFixed(2)} ` +
              `(总幅 ${rangePct}%) 理由: ${parsed.reasoning || '无'}`,
            );
          } else {
            this.logger.warn(`[网格] AI 返回无效范围: upper=${parsed.upperPrice}, lower=${parsed.lowerPrice}, 使用兜底`);
          }
        } catch (e: any) {
          this.logger.warn(`[网格] AI 范围决策失败，使用 ATR 兜底: ${e.message}`);
        }
      }

      // 兜底：ATR×5 + ±8%
      if (!aiRangeSet) {
        let atrFallbackSet = false;
        if (this.indicators) {
          try {
            const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, '4h', 20);
            const highs = ohlcvRaw.map((c: any) => Number(c[2]));
            const lows = ohlcvRaw.map((c: any) => Number(c[3]));
            const closes = ohlcvRaw.map((c: any) => Number(c[4]));
            const atr = this.indicators.calculateATR(highs, lows, closes, 14);
            if (atr && atr > 0) {
              const halfRange = atr * DEFAULT_ATR_MULTIPLIER;
              upperPrice = currentPrice + halfRange;
              lowerPrice = currentPrice - halfRange;
              atrFallbackSet = true;
              rangeSource = `ATR×${DEFAULT_ATR_MULTIPLIER}兜底`;
              this.logger.log(
                `[网格] 兜底宽度 (ATR×${DEFAULT_ATR_MULTIPLIER}): 当前价=${currentPrice.toFixed(2)}, ` +
                `ATR(4H,14)=${atr.toFixed(2)}, 范围=[${lowerPrice.toFixed(2)}, ${upperPrice.toFixed(2)}]`,
              );
            }
          } catch (_e) {
            // ATR 获取失败
          }
        }
        if (!atrFallbackSet) {
          upperPrice = currentPrice * 1.08;
          lowerPrice = currentPrice * 0.92;
          this.logger.log(
            `[网格] 兜底宽度 (±8%): 当前价=${currentPrice.toFixed(2)}, ` +
            `范围=[${lowerPrice.toFixed(2)}, ${upperPrice.toFixed(2)}]`,
          );
        }
      }
    }

    if (upperPrice <= lowerPrice) {
      throw new Error('上界必须大于下界');
    }

    // Step 2: 网格间距
    const gridSpacing = (upperPrice - lowerPrice) / (gridCount - 1);

    // Step 2.5: 最小盈利间距校验（手续费守卫）
    const effectiveFeeRate = config.useMakerOnly
      ? (config.makerFeeRate ?? DEFAULT_MAKER_FEE_RATE)
      : (config.takerFeeRate ?? DEFAULT_TAKER_FEE_RATE);
    const minRequiredSpacingRate = effectiveFeeRate * 2 * MIN_GRID_PROFIT_MULTIPLIER;
    const actualSpacingRate = gridSpacing / currentPrice;
    if (actualSpacingRate < minRequiredSpacingRate) {
      this.logger.warn(
        `[网格] 间距过小警告: 实际=${(actualSpacingRate * 100).toFixed(4)}% < 最小所需=${(minRequiredSpacingRate * 100).toFixed(4)}%，` +
        `预计每格利润将被手续费吃掉（taker=${(effectiveFeeRate * 100).toFixed(4)}%）`,
      );
    }

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
      dailyStartEquity: initialEquity,

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

      lastCyclePrice: 0,
      priceVelocityPct: 0,

      takerFeeRate: config.takerFeeRate ?? DEFAULT_TAKER_FEE_RATE,
      makerFeeRate: config.makerFeeRate ?? DEFAULT_MAKER_FEE_RATE,

      chargedProfit: 0,

      startEquity: initialEquity,
      lastEquity: initialEquity,
      lastOI: 0,
      effectiveLeverage: leverage, // 初始 = 用户配置值，运行时由 regime 压低
      userLockedRange: rangeSource === '用户指定', // 用户填了具体数值 → AI 不得调整范围
      availableBalance: 0, // 初始为 0，首轮 buildGridContext 后从交易所更新
      stopLossPct: config.stopLossPct ?? DEFAULT_STOP_LOSS_PCT,
    };

    this.gridStates.set(strategyId, state);
    await this.persistGridState(strategyId, state);

    this.logger.log(
      `[网格] 初始化: ${symbol}, ${gridCount} 格, 分布=${distribution}, 方向=${direction}, ` +
        `范围 ${lowerPrice.toFixed(2)}-${upperPrice.toFixed(2)}, 间距 ${gridSpacing.toFixed(2)}, ` +
        `每格 $${(totalInvestment / gridCount).toFixed(2)}, 当前价 ${currentPrice}`,
    );

    // 写入策略日志，让用户在前端能看到初始化信息（含 AI 范围决策）
    const rangePctTotal = ((upperPrice - lowerPrice) / currentPrice * 100).toFixed(1);
    await this.prisma.aiStrategyLog.create({
      data: {
        strategyId,
        symbol,
        decision: {
          action: 'grid_initialized',
          gridSummary: `初始化/${gridCount}格`,
          reasoning: `网格初始化完成 [${rangeSource}]` +
            `\n范围: $${lowerPrice.toFixed(2)} ~ $${upperPrice.toFixed(2)} (${rangePctTotal}%)` +
            `\n间距: $${gridSpacing.toFixed(4)}, 每格 $${(totalInvestment / gridCount).toFixed(2)}` +
            `\n当前价: $${currentPrice.toFixed(4)}` +
            (rangeReasoning ? `\nAI理由: ${rangeReasoning}` : ''),
          gridSnapshot: {
            upperPrice,
            lowerPrice,
            gridSpacing,
            direction,
            totalLevels: gridCount,
            totalInvestment,
            lastPrice: currentPrice,
            rangeSource,
          },
        } as any,
        executed: true,
      },
    }).catch((e) => {
      this.logger.warn(`[网格] 初始化日志写入失败: ${e.message}`);
    });

    return state;
  }

  // ========================= 核心周期（9 步） =========================

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
    // 并发保护：同一策略上一周期仍在运行时直接跳过，避免状态竞争和重复下单
    if (this.runningStrategies.has(strategyId)) {
      this.logger.warn(`[网格] ${strategyId} 上一周期仍在执行，跳过本轮`);
      return { trades: 0, errors: 0 };
    }
    this.runningStrategies.add(strategyId);
    try {
      return await this._runGridCycleInner(strategyId, userId, apiKeyId, apiKeys, gridConfig);
    } finally {
      this.runningStrategies.delete(strategyId);
    }
  }

  /** runGridCycle 内部实现（由并发保护包装层调用） */
  private async _runGridCycleInner(
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
        // 兼容旧数据：确保 fee 字段有默认值
        state.takerFeeRate ??= DEFAULT_TAKER_FEE_RATE;
        state.makerFeeRate ??= DEFAULT_MAKER_FEE_RATE;
        // 兼容旧数据：effectiveLeverage 不存在时 fallback 到 leverage
        state.effectiveLeverage ??= state.leverage;
        // 兼容旧数据：stopLossPct 不存在时 fallback 到默认值
        state.stopLossPct ??= DEFAULT_STOP_LOSS_PCT;
        // 从 DB 恢复，需要 reconcile
        await this.reconcileGridState(strategyId, userId, apiKeyId, state);
      }
    }

    // Step 1.5: 配置变更检测 — 用户修改参数后自动重建网格
    if (state && state.isInitialized && gridConfig) {
      const configChanged = this.detectGridConfigChange(state, gridConfig);
      if (configChanged) {
        this.logger.warn(
          `[网格] 检测到配置变更: ${configChanged}，清理旧网格并重新初始化`,
        );
        // 取消交易所上的所有挂单
        await this.cleanupExistingOrders(state, userId, apiKeyId);
        // 清除内存和 DB 状态
        this.gridStates.delete(strategyId);
        state = undefined;
      }
    }

    if (!state || !state.isInitialized) {
      // 尝试自动初始化（首次 or 配置变更后重建）
      if (gridConfig) {
        state = await this.initializeGrid(strategyId, userId, apiKeyId, gridConfig, apiKeys);
      } else {
        this.logger.warn(`[网格] 策略 ${strategyId} 未初始化`);
        return { trades: 0, errors: 0 };
      }
    }

    // 每轮从 gridConfig 重新评估 userLockedRange（参照 nofx: 不持久化锁定标志，每次读配置）
    // 用户在前端清空上下界 → upperBound=0, lowerBound=0 → 应解锁
    if (gridConfig) {
      const configHasManualBounds = !!(gridConfig.upperBound && gridConfig.lowerBound);
      if (state.userLockedRange !== configHasManualBounds) {
        this.logger.log(
          `[网格] userLockedRange 重新评估: ${state.userLockedRange} → ${configHasManualBounds}` +
            ` (upperBound=${gridConfig.upperBound}, lowerBound=${gridConfig.lowerBound})`,
        );
        state.userLockedRange = configHasManualBounds;
      }
    }

    let currentPrice: number;
    try {
      currentPrice = await this.getCurrentPrice(state.symbol);
    } catch (e: any) {
      this.logger.error(`[网格] 获取当前价格失败，跳过本轮: ${e.message}`);
      return { trades: 0, errors: 1 };
    }
    let trades = 0;
    let errors = 0;

    // Step 2: 简单边界突破检查
    const breakoutPct = this.checkSimpleBreakout(currentPrice, state);
    const breakoutThreshold = gridConfig?.breakoutPct ?? DEFAULT_BREAKOUT_PCT;
    if (breakoutPct >= breakoutThreshold) {
      const direction = currentPrice > state.upperPrice ? 'up' : 'down';
      this.logger.warn(`[网格] 价格突破网格边界 ${breakoutPct.toFixed(1)}% ≥ ${breakoutThreshold}%（${direction}），暂停网格`);

      // 方向性平仓：突破上界平 short，突破下界平 long（默认启用）
      if (gridConfig?.directionalCloseOnBreakout !== false) {
        await this.directionalCloseOnBreakout(state, direction, userId, apiKeyId);
      }

      state.isPaused = true;
      state.pauseReason = `价格突破网格边界 ${breakoutPct.toFixed(1)}% (${direction})`;
      await this.persistGridState(strategyId, state);
      return { trades: 0, errors: 0 };
    }

    // Step 2.5: 价格速度检测（黑天鹅早期预警）
    // flashBreakoutPct: 单周期价格变化超过此值触发闪速突破保护（默认 5%）
    // maxHourlyChangePct: 保留配置字段，由 AI 提示词层面响应，代码层依赖单周期速度
    const flashBreakoutThreshold = gridConfig?.flashBreakoutPct ?? DEFAULT_FLASH_BREAKOUT_PCT;

    if (state.lastCyclePrice > 0) {
      state.priceVelocityPct = Math.abs(
        (currentPrice - state.lastCyclePrice) / state.lastCyclePrice * 100,
      );

      // 单周期闪崩/闪涨 → 立即触发方向性平仓 + 紧急退出
      if (state.priceVelocityPct >= flashBreakoutThreshold) {
        const direction = currentPrice > state.lastCyclePrice ? 'up' : 'down';
        this.logger.warn(
          `[网格] 闪速突破: 单周期价格变化 ${state.priceVelocityPct.toFixed(1)}% ≥ ${flashBreakoutThreshold}%（${direction}）`,
        );
        await this.directionalCloseOnBreakout(state, direction, userId, apiKeyId);
        await this.emergencyExit(state, userId, apiKeyId,
          `闪速突破: 单周期价格变化 ${state.priceVelocityPct.toFixed(1)}% ≥ ${flashBreakoutThreshold}%`);
        state.lastCyclePrice = currentPrice;
        await this.persistGridState(strategyId, state);
        return { trades: 0, errors: 0 };
      }
    }

    // Step 3: 最大回撤检查（同时预取余额+持仓快照，供 Step 8 buildGridContext 复用，避免重复 API 调用）
    let currentEquity = state.peakEquity;
    let equityFetched = false;      // 只有真实获取权益成功才设为 true，失败时不更新 dailyPnl
    let livePositions: any[] | undefined; // 持仓快照，传给 buildGridContext 避免重复调用
    let liveBalance: ExchangeBalance | undefined; // 余额快照，传给 buildGridContext 避免重复调用
    if (this.adapterFactory && apiKeyId) {
      try {
        const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
        const balance = await adapter.getBalance();
        liveBalance = balance;       // 保存余额快照，Step 8 buildGridContext 直接复用
        currentEquity = balance.totalEquity;
        equityFetched = true;        // 成功才设为 true
        state.lastEquity = currentEquity; // 记录最新权益用于总盈亏计算
        livePositions = await adapter.getPositions(); // 预取持仓，Step 8 直接复用
        await adapter.dispose();
      } catch (e: any) {
        this.logger.warn(`[网格] Step3 权益获取失败，使用缓存值 (peakEquity=${state.peakEquity}): ${e.message}`);
      }
    }

    if (currentEquity > state.peakEquity) {
      state.peakEquity = currentEquity;
    }

    // ★ 日内 P&L 跟踪 — 权益获取成功后立即更新，不受后续 return 影响
    // 放在这里确保 Step 3.5/Step 4 的提前 return 也能正确保存日内基准
    if (equityFetched && currentEquity > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (state.dailyPnlResetDate !== todayStr) {
        state.dailyPnlResetDate = todayStr;
        state.dailyPnl = 0;
        state.dailyStartEquity = currentEquity;
      } else if (!state.dailyStartEquity) {
        state.dailyStartEquity = currentEquity;
        state.dailyPnl = 0;
      } else {
        state.dailyPnl = currentEquity - state.dailyStartEquity;
      }
    }

    const maxDrawdownPct = gridConfig?.maxDrawdownPct ?? DEFAULT_MAX_DRAWDOWN_PCT;
    if (state.peakEquity > 0) {
      const drawdown = ((state.peakEquity - currentEquity) / state.peakEquity) * 100;
      if (drawdown > state.maxDrawdown) state.maxDrawdown = drawdown;
      if (drawdown >= maxDrawdownPct) {
        await this.emergencyExit(state, userId, apiKeyId,
          `最大回撤保护触发\n` +
          `保护规则: 从最高点回撤超过 ${maxDrawdownPct}% 时紧急平仓\n` +
          `实际情况: 当前回撤 ${drawdown.toFixed(1)}%`);
        await this.persistGridState(strategyId, state);
        return { trades: 0, errors: 0 };
      }
    }

    // Step 3.7: 逐层止损检查（单格亏损 ≥ stopLossPct% 标记，在 Step 8 执行平仓）
    const stopLossPct = gridConfig?.stopLossPct ?? DEFAULT_STOP_LOSS_PCT;
    if (currentPrice > 0 && stopLossPct > 0) {
      const stopLossLines: GridLine[] = [];
      for (const line of state.gridLines) {
        if (line.state !== 'filled' || line.positionSize <= 0 || line.positionEntry <= 0) continue;
        // 价格偏离%（基于价格变化）
        const priceDelta = Math.abs(currentPrice - line.positionEntry) / line.positionEntry * 100;
        // 方向判断：side='buy' 填充 = 持多头（怕跌）；side='sell' 填充 = 持空头（怕涨）
        const isLosing = line.side === 'buy'
          ? currentPrice < line.positionEntry    // 持多头，价格下跌 = 亏损
          : currentPrice > line.positionEntry;   // 持空头，价格上涨 = 亏损
        if (isLosing && priceDelta >= stopLossPct) {
          stopLossLines.push(line);
        }
      }
      if (stopLossLines.length > 0) {
        state._pendingStopLoss = stopLossLines.map(l => l.index);
        this.logger.warn(
          `[网格] 逐层止损: ${stopLossLines.length} 格超过 ${stopLossPct}% 阈值，` +
          `格号=[${stopLossLines.map(l => l.index).join(',')}]`,
        );
      }
    }

    // Step 4: 日内亏损触发检查（dailyPnl 已在 Step 3 权益获取后更新）
    const dailyLossLimitPct = gridConfig?.dailyLossLimitPct ?? DEFAULT_DAILY_LOSS_LIMIT_PCT;
    const dailyBase = state.dailyStartEquity > 0 ? state.dailyStartEquity : state.totalInvestment;
    if (state.dailyPnl < 0 && dailyBase > 0) {
      const dailyLossPct = (Math.abs(state.dailyPnl) / dailyBase) * 100;
      if (dailyLossPct >= dailyLossLimitPct) {
        const dailyReason =
          `日内亏损保护触发\n` +
          `保护规则: 今日亏损超过 ${dailyLossLimitPct}% 时平仓退出\n` +
          `实际情况: 今日已亏损 ${dailyLossPct.toFixed(1)}%（$${Math.abs(state.dailyPnl).toFixed(2)}）`;
        // 软暂停：撤单但不平仓（对齐 nofx dailyLoss 行为，避免浮亏变实亏，持仓等待价格恢复）
        await this.softPauseGrid(state, userId, apiKeyId, dailyReason);
        await this.persistGridState(strategyId, state);
        return { trades: 0, errors: 0 };
      }
    }

    // Step 5: 箱体突破检测（Donchian 多周期）
    if (this.indicators) {
      try {
        await this.updateBoxData(state);
        const { level, direction, magnitude } = this.detectBoxBreakout(currentPrice, state);
        if (level !== 'none') {
          // Flash 模式：大幅突破（magnitude > FLASH_BREAKOUT_CONFIRM_OVERRIDE_PCT）跳过 3 次确认
          const isFlash = magnitude >= FLASH_BREAKOUT_CONFIRM_OVERRIDE_PCT;
          const confirmed = isFlash || this.confirmBreakout(state, level, direction);
          if (confirmed) {
            if (isFlash) {
              this.logger.warn(
                `[网格] 闪速箱体突破: ${magnitude.toFixed(1)}% ≥ ${FLASH_BREAKOUT_CONFIRM_OVERRIDE_PCT}%，跳过确认直接执行`,
              );
            }
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

    // Step 6.5: 动态杠杆 — 市场状态联动上限
    // 防御性 fallback：旧数据可能无 effectiveLeverage 字段
    if (!state.effectiveLeverage) state.effectiveLeverage = state.leverage;
    const regimeCap = REGIME_LEVERAGE_CAP[state.currentRegime] ?? state.leverage;
    const newEffective = Math.min(state.leverage, regimeCap);
    if (state.effectiveLeverage !== newEffective) {
      this.logger.log(
        `[网格] 杠杆调整: ${state.effectiveLeverage}x → ${newEffective}x ` +
        `(市场=${state.currentRegime}, 配置=${state.leverage}x, 上限=${regimeCap}x)`,
      );
      state.effectiveLeverage = newEffective;
    }

    // Step 7: 暂停检查
    if (state.isPaused) {
      this.logger.warn(`[网格] ${state.symbol} 已暂停 [${state.pauseSource ?? 'unknown'}]: ${state.pauseReason || '未知原因'}`);
      await this.persistGridState(strategyId, state);
      return { trades: 0, errors: 0 };
    }

    // Step 8: AI 决策
    {
      const currentProfitPct = state.startEquity > 0
        ? (currentEquity - state.startEquity) / state.startEquity * 100
        : 0;
      const activeOrders = Object.keys(state.orderBook).length;
      this.logger.log(
        `[网格] ▶ ${state.symbol} | 价格=${currentPrice} | 市场=${state.currentRegime} | ` +
        `日内=${state.dailyPnl >= 0 ? '+' : ''}${state.dailyPnl.toFixed(2)} USDT | ` +
        `策略收益=${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}% | ` +
        `挂单=${activeOrders} 累计=${state.totalProfit.toFixed(2)} USDT`,
      );
    }
    if (this.llm && this.adapterFactory) {
      let adapter: ExchangeAdapter | null = null;
      try {
        adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);

        // 同步订单状态 + 成交后立即下反向单
        if (isGridAdapter(adapter)) {
          const { filledLines } = await this.syncOrderFills(state, adapter as GridExchangeAdapter);
          if (filledLines.length > 0) {
            const profitDelta = filledLines.reduce((s, l) => s + (l.unrealizedPnl || 0), 0);
            this.logger.log(
              `[网格] 成交同步: ${filledLines.length} 笔 | ` +
              `本批利润 ${profitDelta >= 0 ? '+' : ''}${profitDelta.toFixed(4)} USDT | ` +
              `累计 +${state.totalProfit.toFixed(2)} USDT`,
            );
            // 新成交格线 → 在交易所挂止损单（兜底：API 宕机时止损仍可触发）
            if (stopLossPct > 0) {
              for (const line of filledLines) {
                if (line.state !== 'filled' || line.positionEntry <= 0 || line.positionSize <= 0) continue;
                try {
                  // syncOrderFills 后 side 已翻转：'sell' = 原BUY成交(持多头)，'buy' = 原SELL成交(持空头)
                  const isLong = line.side === 'sell';
                  const positionSide = isLong ? 'long' : 'short';
                  const stopPrice = isLong
                    ? line.positionEntry * (1 - stopLossPct / 100)
                    : line.positionEntry * (1 + stopLossPct / 100);
                  await (adapter as GridExchangeAdapter).setStopLoss(
                    state.symbol, positionSide, line.positionSize, stopPrice,
                  );
                  this.logger.log(
                    `[网格] 交易所止损单: level=${line.index} ${positionSide} entry=${line.positionEntry.toFixed(4)} stop=${stopPrice.toFixed(4)}`,
                  );
                } catch (e: any) {
                  this.logger.warn(`[网格] 设置交易所止损单失败(非致命，软件止损兜底): ${e.message}`);
                }
              }
            }
            const reversePlaced = await this.placeReverseOrders(
              state, filledLines, adapter as GridExchangeAdapter,
              gridConfig?.useMakerOnly ?? false,
            );
            trades += reversePlaced;
          }
        }

        // 执行逐层止损（在 AI 决策之前，adapter 已就绪）
        if (state._pendingStopLoss?.length && isGridAdapter(adapter)) {
          // 软件市价止损前：先撤销交易所止损单，避免软件平仓后交易所止损单重复触发
          if (stopLossPct > 0) {
            try {
              await (adapter as GridExchangeAdapter).cancelStopOrders(state.symbol);
              this.logger.log('[网格] 软件止损前：已撤销交易所止损单');
            } catch (e: any) {
              this.logger.warn(`[网格] 撤销交易所止损单失败(忽略，继续软件止损): ${e.message}`);
            }
          }
          for (const idx of state._pendingStopLoss) {
            const line = state.gridLines[idx];
            if (!line || line.state !== 'filled') continue;
            try {
              // 市价平仓：side='buy' 填充 = 持多头(long)，side='sell' 填充 = 持空头(short)
              const closeSide = line.side === 'buy' ? 'long' : 'short';
              closeSide === 'long'
                ? await (adapter as GridExchangeAdapter).closeLong(state.symbol, line.positionSize)
                : await (adapter as GridExchangeAdapter).closeShort(state.symbol, line.positionSize);
              // 取消关联挂单
              if (line.orderId) {
                try { await (adapter as GridExchangeAdapter).cancelOrder(state.symbol, line.orderId); } catch {}
                delete state.orderBook[line.orderId];
              }
              // 重置格线
              line.state = 'empty';
              line.positionSize = 0;
              line.positionEntry = 0;
              line.orderId = undefined;
              this.logger.warn(`[网格] 逐层止损执行: level=${idx} 已平仓`);
              trades++;
            } catch (e: any) {
              this.logger.error(`[网格] 逐层止损失败: level=${idx} - ${e.message}`);
              errors++;
            }
          }
          delete state._pendingStopLoss;
        }

        // 动态杠杆同步到交易所（effectiveLeverage 降低时重设）
        // 逐仓模式下有持仓时 Binance 不允许降杠杆，跳过避免每周期重复报错
        const hasOpenPositions = state.gridLines.some(l => l.state === 'filled' && l.positionSize > 0);
        if (state.effectiveLeverage < state.leverage && !hasOpenPositions && isGridAdapter(adapter)) {
          try {
            await (adapter as GridExchangeAdapter).setLeverage(state.symbol, state.effectiveLeverage);
          } catch (e: any) {
            this.logger.warn(`[网格] setLeverage(${state.effectiveLeverage}x) 失败: ${e.message}`);
          }
        }

        // 构建 AI 上下文（传入 Step 3 预取的余额+持仓快照，避免重复 API 调用）
        const context = await this.buildGridContext(state, adapter, currentPrice, livePositions, liveBalance);

        // Fix-A: 全局网格倾斜计算（基于全量 gridLines，非瞬时 filledLines）
        const filledAll = state.gridLines.filter(l => l.state === 'filled');
        const skewBuy = filledAll.filter(l => l.side === 'sell').length; // 持多头（原buy成交，side已翻转为sell）
        const skewSell = filledAll.filter(l => l.side === 'buy').length; // 持空头（原sell成交，side已翻转为buy）
        const skewTotal = skewBuy + skewSell;
        let skewLevel: 'none' | 'light' | 'severe' = 'none';
        if (skewTotal >= 3) {
          const heavy = Math.max(skewBuy, skewSell);
          const light = Math.min(skewBuy, skewSell);
          if (light === 0 || heavy >= 5 * light) skewLevel = 'severe';
          else if (heavy >= 2 * light) skewLevel = 'light';
        }
        (context as any).gridSkewLevel = skewLevel;
        (context as any).gridSkewBuyFilled = skewBuy;
        (context as any).gridSkewSellFilled = skewSell;
        if (skewLevel !== 'none') {
          this.logger.warn(`[网格] 全局倾斜: ${skewLevel} buy=${skewBuy} sell=${skewSell}`);
        }

        // Step 5.5: 1H 价格变化代码层硬检查（A1/A2 提升为硬规则，防止 AI 漏判）
        // --- 黑天鹅级别：≥10%，直接 emergencyExit 平仓 ---
        const maxHourlyChangePct = gridConfig?.maxHourlyChangePct ?? DEFAULT_MAX_HOURLY_CHANGE_PCT;
        if (Math.abs(context.priceChange1h) >= maxHourlyChangePct) {
          const dir = context.priceChange1h > 0 ? '上涨' : '下跌';
          await this.emergencyExit(state, userId, apiKeyId,
            `1H 极端行情: 价格${dir} ${Math.abs(context.priceChange1h).toFixed(1)}% ≥ ${maxHourlyChangePct}%，紧急平仓退出`);
          await this.persistGridState(strategyId, state);
          return { trades: 0, errors: 0 };
        }
        // --- 单边快速行情：≥6% + RSI 确认，取消订单并暂停（不强平，可手动恢复）---
        const rapidRise = context.priceChange1h > 6 && context.rsi14 > 70;
        const rapidFall = context.priceChange1h < -6 && context.rsi14 < 30;
        if (rapidRise || rapidFall) {
          const dir = rapidRise
            ? `上涨 ${context.priceChange1h.toFixed(1)}%（RSI ${context.rsi14.toFixed(0)}）`
            : `下跌 ${Math.abs(context.priceChange1h).toFixed(1)}%（RSI ${context.rsi14.toFixed(0)}）`;
          this.logger.warn(`[网格] 单边快速行情: 1H ${dir}，取消订单并暂停`);
          try {
            await adapter.cancelAllOrders(state.symbol);
          } catch (e: any) {
            this.logger.warn(`[网格] 快速行情撤单失败: ${e.message}`);
          }
          state.isPaused = true;
          state.pauseSource = 'risk_control';
          state.pauseReason = `单边快速行情\n保护规则: 1H 价格变化超过 6% 且 RSI 超出合理区间时暂停\n实际情况: 1H ${dir}`;
          await this.persistGridState(strategyId, state);
          return { trades: 0, errors: 0 };
        }

        const modelId = gridConfig?.modelId || 'deepseek-chat';

        const response = await this.llm.chat(
          modelId,
          GRID_SYSTEM_PROMPT(state.symbol, state.gridLines.length, state.totalInvestment, state.leverage, state.distribution),
          buildGridUserPrompt(context),
          apiKeys,
          { temperature: 0.3, maxTokens: 1500 },
        );

        // 解析 AI 决策（新格式：{analysis, actions}，兼容旧格式 [...]）
        const { decisions, analysis: marketAnalysis } = this.parseGridDecisions(response.content);

        // Fix-A: 严重倾斜时代码层注入 adjust_grid（优先于 AI 决策执行）
        if (skewLevel === 'severe' && !state.userLockedRange && !state.isPaused) {
          const rangeWidth = state.upperPrice - state.lowerPrice;
          const newLower = parseFloat((currentPrice - rangeWidth / 2).toFixed(8));
          const newUpper = parseFloat((currentPrice + rangeWidth / 2).toFixed(8));
          decisions.unshift({
            symbol: state.symbol,
            action: 'adjust_grid',
            upperPrice: newUpper,
            lowerPrice: newLower,
            confidence: 95,
            reasoning: `[代码层] 严重倾斜自动居中: 多${skewBuy}格 vs 空${skewSell}格`,
          });
          this.logger.warn(`[网格] 严重倾斜自动注入 adjust_grid: ${newLower.toFixed(4)}~${newUpper.toFixed(4)}`);
        }

        // Fix-B: confidence 过滤（未提供 confidence 的决策默认通过，兼容旧格式）
        const CONFIDENCE_THRESHOLD = 40;
        const filteredDecisions = decisions.filter(d => {
          if (d.action === 'hold') return true;
          if (d.confidence === undefined) return true;
          if (d.confidence >= CONFIDENCE_THRESHOLD) return true;
          this.logger.warn(
            `[网格] 低置信决策跳过: action=${d.action} confidence=${d.confidence} reasoning=${d.reasoning}`,
          );
          return false;
        });

        // 执行决策（收集每条执行结果，供日志记录）
        const execResults: Array<{ action: string; success: boolean; skipped?: boolean; skipReason?: string; error?: string }> = [];
        let accountConfigError: string | null = null; // OKX 51010 等账户配置错误（需用户手动修复）
        for (const d of filteredDecisions) {
          // 账户配置错误已确认（如 OKX 51010）→ 跳过后续下单，避免刷屏重试
          if (accountConfigError) {
            execResults.push({ action: d.action, success: false, error: accountConfigError });
            errors++;
            continue;
          }
          try {
            const result = await this.executeGridDecision(state, d, adapter, userId, apiKeyId, gridConfig?.useMakerOnly ?? false, currentPrice);
            if (result.executed && d.action.includes('place_')) trades++;
            execResults.push({ action: d.action, success: true, skipped: !result.executed, skipReason: result.skipReason });
          } catch (e: any) {
            errors++;
            const errCategory = classifyExchangeError(e);
            const rawCode = e?.code ?? e?.id ?? '';
            this.logger.warn(`[网格] 执行决策失败: ${d.action} [${errCategory}${rawCode ? '/' + rawCode : ''}] - ${e.message}`);
            const errEntry = `[${errCategory}${rawCode ? '/' + rawCode : ''}] ${e.message}`;
            execResults.push({ action: d.action, success: false, error: errEntry });
            // 账户配置错误（如 OKX 51010）是持久性错误，后续订单无需再试
            if (errCategory === '账户配置错误') {
              accountConfigError = errEntry;
              this.logger.error(`[网格] 账户配置错误（如 OKX 未开通合约交易），本轮停止下单: ${e.message}`);
            }
          }
        }

        // 检测空转：AI 下达了 place 指令但 0 笔实际成功执行（被拦截 or 交易所拒绝）
        const placeActions = execResults.filter(r => r.action.includes('place_'));
        const noneExecuted = placeActions.length > 0 && trades === 0;

        // 记录到 AiStrategyLog（含 GridState 快照和执行结果）
        if (decisions.length > 0) {
          const hasIssues = execResults.some(r => !r.success || r.skipped);
          await this.saveGridDecisionLog(
            strategyId, state.symbol, decisions, response.cost, state, response.thinking,
            hasIssues ? execResults : undefined, marketAnalysis,
          );
        }

        // 写一条前端可见的日志（空转 or 执行失败）
        if (noneExecuted) {
          // 汇总错误类别（去重）
          const failedErrors = execResults.filter(r => !r.success && r.error).map(r => r.error!);
          const uniqueCategories = [...new Set(failedErrors.map(e => e.match(/^\[([^\]]+)\]/)?.[1] ?? '交易所拒绝'))];

          // 汇总所有 skip 原因（去重，取第一条作为代表）
          const skippedReasons = execResults
            .filter(r => r.success && r.skipped && r.skipReason)
            .map(r => r.skipReason!);
          const allSkipped = skippedReasons.length > 0 && skippedReasons.length === placeActions.length;
          // 提取关键词作为用户可见摘要（如"保证金不足"、"每层资金不足"、"价格偏低"等）
          const uniqueSkipKeywords = [...new Set(skippedReasons.map(r => {
            if (r.includes('保证金不足')) return '保证金不足';
            if (r.includes('每层资金不足')) return '每层资金不足';
            if (r.includes('价格偏低')) return '卖单价格偏低';
            if (r.includes('价格偏高')) return '买单价格偏高';
            if (r.includes('仓位超安全上限')) return '仓位超限';
            if (r.includes('数量不足')) return '数量不足';
            if (r.includes('聚合保证金超限')) return '保证金超限';
            return r.split(':')[0];
          }))];

          // 区分：有真实交易所错误 = 执行失败；全部是内部拦截（skipped）= 空转
          const hasExchangeErrors = failedErrors.length > 0;
          const logAction = hasExchangeErrors ? 'grid_exec_failed' : 'grid_idle';
          const logTitle = hasExchangeErrors
            ? `执行失败: AI 建议 ${placeActions.length} 笔下单，全部被交易所拒绝`
            : allSkipped
              ? `网格空转: ${uniqueSkipKeywords.join('、')}`
              : `网格空转: AI 建议 ${placeActions.length} 笔下单，0 笔执行成功`;
          const summaryPrefix = hasExchangeErrors ? '执行失败' : '空转';
          const fullReasonSuffix = hasExchangeErrors
            ? (uniqueCategories.length > 0 ? ` | 失败原因: ${uniqueCategories.join('、')}` : '')
            : (allSkipped ? ` | ${uniqueSkipKeywords.join('、')}` : '');

          await this.prisma.aiStrategyLog.create({
            data: {
              strategyId,
              symbol: state.symbol,
              decision: {
                action: logAction,
                reasoning: logTitle +
                  (allSkipped ? '' : ` (市场=${state.currentRegime}, 杠杆=${state.effectiveLeverage}x)`) +
                  fullReasonSuffix,
                gridSummary: `${summaryPrefix}/${placeActions.length}笔未执行${fullReasonSuffix}`,
                gridSnapshot: {
                  regime: state.currentRegime,
                  effectiveLeverage: state.effectiveLeverage,
                  filledLevels: state.gridLines.filter(l => l.state === 'filled').length,
                  pendingLevels: state.gridLines.filter(l => l.state === 'pending' && l.orderQuantity > 0).length,
                  totalInvestment: state.totalInvestment,
                  lastPrice: state.lastPrice,
                },
              } as any,
              executed: false,
            },
          }).catch(() => {});
        }
      } catch (e: any) {
        errors++;
        this.logger.error(`[网格] AI 决策周期失败: ${e.message}`);
        // 交易所凭证问题（key不存在/被删/禁用/鉴权失败/解密失败）写前端可见日志
        const isAuthError =
          e.message?.includes('authenticate') ||
          e.message?.includes('Unsupported state') ||
          e.message?.includes('Invalid API') ||
          e.message?.includes('API-key format invalid') ||
          e.message?.includes('Signature') ||
          e.message?.includes('解密') ||
          e.message?.includes('AuthenticationError') ||
          e.message?.includes('凭证不存在') ||
          e.message?.includes('凭证已禁用') ||
          e.message?.includes('无权使用此凭证') ||
          e.message?.includes('API Key') && e.message?.includes('不存在');
        if (isAuthError && state) {
          await this.prisma.aiStrategyLog.create({
            data: {
              strategyId,
              symbol: state.symbol,
              decision: {
                action: 'auto_disabled_failure',
                reason: '交易所 API Key 失效或已被删除，本轮执行中断',
                lastError: e.message,
              },
              executed: false,
            },
          }).catch(() => {});
        }
      } finally {
        // 无论成功/异常，都确保释放 adapter 连接资源
        if (adapter) {
          try { await adapter.dispose(); } catch { /* 忽略 dispose 本身的异常 */ }
        }
      }
    }

    // Step 9: 更新状态
    state.lastPrice = currentPrice;
    state.lastCyclePrice = currentPrice; // 用于下一周期的速度检测
    await this.persistGridState(strategyId, state);

    {
      const currentProfitPct = state.startEquity > 0
        ? (currentEquity - state.startEquity) / state.startEquity * 100
        : 0;
      this.logger.log(
        `[网格] ◀ ${state.symbol} | 本轮=${trades}笔${errors > 0 ? ` 错误=${errors}` : ' ✓'} | ` +
        `日内=${state.dailyPnl >= 0 ? '+' : ''}${state.dailyPnl.toFixed(2)} / ` +
        `策略=${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}% | ` +
        `市场=${state.currentRegime} 方向=${state.currentDirection}`,
      );
    }

    return { trades, errors };
  }

  // ========================= 突破检测 =========================

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

  /** 检测箱体突破（优先级：长期>中期>短期），返回值包含突破幅度 magnitude */
  private detectBoxBreakout(
    price: number,
    state: GridState,
  ): { level: BreakoutLevel; direction: string; magnitude: number } {
    // 长期箱体
    if (state.longBoxUpper > 0 && state.longBoxLower > 0) {
      if (price > state.longBoxUpper) {
        return { level: 'long', direction: 'up', magnitude: ((price - state.longBoxUpper) / state.longBoxUpper) * 100 };
      }
      if (price < state.longBoxLower) {
        return { level: 'long', direction: 'down', magnitude: ((state.longBoxLower - price) / state.longBoxLower) * 100 };
      }
    }
    // 中期箱体
    if (state.midBoxUpper > 0 && state.midBoxLower > 0) {
      if (price > state.midBoxUpper) {
        return { level: 'mid', direction: 'up', magnitude: ((price - state.midBoxUpper) / state.midBoxUpper) * 100 };
      }
      if (price < state.midBoxLower) {
        return { level: 'mid', direction: 'down', magnitude: ((state.midBoxLower - price) / state.midBoxLower) * 100 };
      }
    }
    // 短期箱体
    if (state.shortBoxUpper > 0 && state.shortBoxLower > 0) {
      if (price > state.shortBoxUpper) {
        return { level: 'short', direction: 'up', magnitude: ((price - state.shortBoxUpper) / state.shortBoxUpper) * 100 };
      }
      if (price < state.shortBoxLower) {
        return { level: 'short', direction: 'down', magnitude: ((state.shortBoxLower - price) / state.shortBoxLower) * 100 };
      }
    }
    return { level: 'none', direction: '', magnitude: 0 };
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
        state.pauseSource = 'ai';  // 允许 checkFalseBreakoutRecovery 在价格回归后自动恢复
        state.pauseReason = `${state.breakoutLevel} 级别突破 (${direction})，等待价格回归`;
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
        state.positionReductionPct = 0; // 完全恢复，不再缩减仓位
        // 只释放突破类暂停，风控类暂停（pauseSource=risk_control）不能被恢复函数解除
        if (state.pauseSource !== 'risk_control') {
          state.isPaused = false;
          state.pauseReason = undefined;
          state.pauseSource = undefined;
        }
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

  /** 分类市场状态 */
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

  /** 构建网格 AI 上下文 */
  private async buildGridContext(
    state: GridState,
    adapter: ExchangeAdapter,
    currentPrice: number,
    prefetchedPositions?: any[], // Step 3 已预取的持仓，避免重复 API 调用
    prefetchedBalance?: ExchangeBalance, // Step 3 已预取的余额，避免重复 API 调用
  ): Promise<GridContext> {
    // 双周期 OHLCV 并行拉取（不增加串行等待时间）
    const [ohlcvFastRaw, ohlcvSlowRaw] = await Promise.all([
      this.marketData.fetchOHLCV(state.symbol, '5m', 50),   // 快速：RSI/MACD/短期信号
      this.marketData.fetchOHLCV(state.symbol, '1h', 100),  // 慢速：趋势/ATR/价格变化/24h范围
    ]);

    const mapOHLCV = (raw: any[]): OHLCV[] => raw.map((c: any) => ({
      timestamp: c[0],
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    }));

    const ohlcv5m = mapOHLCV(ohlcvFastRaw);
    const ohlcvHourly = mapOHLCV(ohlcvSlowRaw);

    // 快速指标（5m）：RSI、MACD、布林带、EMA 等短期信号
    let indFast: any = {};
    // 慢速指标（1h）：ATR 趋势可靠性
    let indSlow: any = {};
    if (this.indicators) {
      indFast = this.indicators.calculateAll(ohlcv5m);
      indSlow = this.indicators.calculateAll(ohlcvHourly);
    }

    // 获取账户状态
    let totalEquity = state.peakEquity;
    let availableBalance = 0;
    let currentPosition = 0;
    let unrealizedPnl = 0;
    let marginUsedPct = 0;
    let positionLong: GridContext['positionLong'];
    let positionShort: GridContext['positionShort'];

    try {
      // 优先使用 Step 3 预取的余额快照，避免重复 API 调用（节省 ~1s）
      const balance = prefetchedBalance ?? await adapter.getBalance();
      totalEquity = balance.totalEquity;
      availableBalance = balance.availableBalance;
      state.availableBalance = availableBalance; // 同步到 state，供 placeGridLimitOrder 精确预检
      unrealizedPnl = balance.unrealizedPnl;
      marginUsedPct = balance.marginUsedPct ?? 0;

      // 优先使用 Step 3 预取的持仓，避免重复 API 调用
      const positions = prefetchedPositions ?? await adapter.getPositions();
      const baseSymbol = state.symbol.split('/')[0];
      const symPositions = positions.filter((p: any) => p.symbol.includes(baseSymbol));
      const longPos = symPositions.find((p: any) => p.side === 'long');
      const shortPos = symPositions.find((p: any) => p.side === 'short');

      // 净持仓（兼容原有逻辑）
      currentPosition = (longPos?.quantity ?? 0) - (shortPos?.quantity ?? 0);

      // 双向持仓详情
      if (longPos) {
        positionLong = {
          quantity: longPos.quantity,
          entryPrice: longPos.entryPrice,
          margin: longPos.margin,
          unrealizedPnl: longPos.unrealizedPnl,
          liquidationPrice: longPos.liquidationPrice,
          marginRatio: longPos.marginRatio,
        };
      }
      if (shortPos) {
        positionShort = {
          quantity: shortPos.quantity,
          entryPrice: shortPos.entryPrice,
          margin: shortPos.margin,
          unrealizedPnl: shortPos.unrealizedPnl,
          liquidationPrice: shortPos.liquidationPrice,
          marginRatio: shortPos.marginRatio,
        };
      }
    } catch { /* 使用默认值 */ }

    // 资金费率
    let fundingRate = 0;
    try {
      const fr = await this.marketData.fetchFundingRate(state.symbol);
      if (fr) fundingRate = fr.fundingRate;
    } catch { /* 忽略 */ }

    // OI 持仓量变化（graceful fallback，不支持的交易所/错误时跳过）
    let oiChange1h = 0;
    try {
      if ('fetchTicker' in adapter && typeof (adapter as any).fetchTicker === 'function') {
        const ticker = await (adapter as any).fetchTicker(state.symbol);
        const currentOI = Number(ticker?.info?.openInterest ?? ticker?.openInterest ?? 0);
        if (currentOI > 0 && state.lastOI > 0) {
          oiChange1h = (currentOI - state.lastOI) / state.lastOI * 100;
        }
        if (currentOI > 0) state.lastOI = currentOI;
      }
    } catch { /* 不支持则跳过，保持 oiChange1h = 0 */ }

    // 价格变化（改用 1h K 线，精确且无临界问题）
    const priceChange1h = ohlcvHourly.length >= 2
      ? ((currentPrice - ohlcvHourly[ohlcvHourly.length - 2].close) / ohlcvHourly[ohlcvHourly.length - 2].close) * 100
      : 0;
    const priceChange4h = ohlcvHourly.length >= 5
      ? ((currentPrice - ohlcvHourly[ohlcvHourly.length - 5].close) / ohlcvHourly[ohlcvHourly.length - 5].close) * 100
      : 0;

    // 24h 高低价（从 1h K 线计算，反映真实支撑阻力）
    const last24Candles = ohlcvHourly.slice(-24);
    const high24h = last24Candles.length > 0 ? Math.max(...last24Candles.map(c => c.high)) : 0;
    const low24h  = last24Candles.length > 0 ? Math.min(...last24Candles.map(c => c.low))  : 0;

    // 布林带宽度（基于 5m 快速数据）
    const bbUpper = indFast.bollingerBands?.upper ?? 0;
    const bbMiddle = indFast.bollingerBands?.middle ?? currentPrice;
    const bbLower = indFast.bollingerBands?.lower ?? 0;
    const bbWidth = bbMiddle > 0 ? ((bbUpper - bbLower) / bbMiddle) * 100 : 0;

    // EMA 距离（基于 5m 快速数据）
    const ema20 = indFast.ema?.ema20 ?? 0;
    const ema50 = indFast.ema?.ema50 ?? 0;
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
      atr14: indFast.atr ?? 0,
      bollingerUpper: bbUpper,
      bollingerMiddle: bbMiddle,
      bollingerLower: bbLower,
      bollingerWidth: bbWidth,
      ema20,
      ema50,
      emaDistance,
      rsi14: indFast.rsi ?? 50,
      macd: indFast.macd?.macd ?? 0,
      macdSignal: indFast.macd?.signal ?? 0,
      macdHistogram: indFast.macd?.histogram ?? 0,
      fundingRate,
      volume24h: ohlcvHourly.slice(-24).reduce((s, c) => s + c.volume, 0),
      priceChange1h,
      priceChange4h,
      // 补充指标
      rsi7: indFast.rsi7 ?? undefined,
      atr3: indFast.atr3 ?? undefined,
      atrHourly: indSlow.atr ?? undefined,
      high24h,
      low24h,
      totalEquity,
      availableBalance,
      currentPosition,
      unrealizedPnl,
      positionLong,
      positionShort,
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
      startEquity: state.startEquity,
      currentProfitPct: state.startEquity > 0 ? (totalEquity - state.startEquity) / state.startEquity * 100 : 0,
      marginUsedPct,
      oiChange1h,
      // K线历史（最近30根1h蜡烛，供AI判断趋势/支撑阻力）
      ohlcv: ohlcvHourly.slice(-30).map(c => ({
        open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      })),
      userLockedRange: state.userLockedRange ?? false,
      stopLossPct: state.stopLossPct > 0 ? state.stopLossPct : undefined,
    };
  }

  /** 解析 AI 返回的 JSON，支持新格式 {analysis, actions} 和旧格式 [...] */
  private parseGridDecisions(content: string): { decisions: GridDecision[]; analysis?: string } {
    try {
      // 优先提取 ```json ... ``` 代码块
      let jsonStr: string | null = null;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // 尝试匹配 JSON 对象 {...}
        const objStart = content.indexOf('{');
        const objEnd = content.lastIndexOf('}');
        if (objStart !== -1 && objEnd > objStart) {
          jsonStr = content.slice(objStart, objEnd + 1);
        } else {
          // 回退：匹配 JSON 数组 [...]
          const arrStart = content.indexOf('[');
          const arrEnd = content.lastIndexOf(']');
          if (arrStart !== -1 && arrEnd > arrStart) jsonStr = content.slice(arrStart, arrEnd + 1);
        }
      }
      if (!jsonStr) return { decisions: [] };

      const parsed = JSON.parse(jsonStr);

      // 新格式：{ analysis: string, actions: [...] }
      if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
        const analysis: string | undefined = typeof parsed.analysis === 'string' ? parsed.analysis.trim() : undefined;
        const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
        const decisions = rawActions
          .filter((d: any) => d && d.action)
          .map((d: any) => {
            if (d.orderId && !d.order_id) d.order_id = d.orderId;
            return d as GridDecision;
          });
        return { decisions, analysis };
      }

      // 旧格式：[...]
      if (Array.isArray(parsed)) {
        const decisions = parsed
          .filter((d: any) => d && d.action)
          .map((d: any) => {
            if (d.orderId && !d.order_id) d.order_id = d.orderId;
            return d as GridDecision;
          });
        return { decisions };
      }

      return { decisions: [] };
    } catch (e: any) {
      this.logger.warn(`[网格] AI 决策解析失败: ${e.message}`);
      return { decisions: [] };
    }
  }

  /** 执行单条网格决策 */
  /** @returns { executed: true } = 操作已执行, { executed: false, skipReason? } = 被跳过/拦截 */
  private async executeGridDecision(
    state: GridState,
    decision: GridDecision,
    adapter: ExchangeAdapter,
    userId: string,
    apiKeyId: string,
    useMakerOnly = false,
    currentPrice?: number,
  ): Promise<{ executed: boolean; skipReason?: string }> {
    const { action } = decision;

    const aiLevel = decision.level_index ?? decision.level;
    this.logger.debug(`[网格] 执行决策: action=${action}, AI层号=${aiLevel}, qty=${decision.quantity}, price=${decision.price}`);

    switch (action) {
      case 'place_buy_limit':
      case 'place_sell_limit':
        if (!isGridAdapter(adapter)) {
          const skipReason = `适配器不支持限价单`;
          this.logger.warn(`[网格] ${skipReason}, adapter类型=${adapter.constructor.name}`);
          return { executed: false, skipReason };
        }
        return await this.placeGridLimitOrder(
          state,
          decision,
          action === 'place_buy_limit' ? 'buy' : 'sell',
          adapter as GridExchangeAdapter,
          useMakerOnly,
        );

      case 'cancel_order':
        if (decision.order_id && isGridAdapter(adapter)) {
          // 校验 orderId 是否存在于本地 orderBook（防止 AI 编造无效 ID 发给交易所）
          if (state.orderBook[decision.order_id] === undefined) {
            this.logger.warn(`[网格] cancel_order 跳过: orderId=${decision.order_id} 不在 orderBook 中`);
            break;
          }
          try {
            await (adapter as GridExchangeAdapter).cancelOrder(state.symbol, decision.order_id);
          } catch (e: any) {
            // 交易所返回"订单不存在/已成交"类错误 — 本地状态仍需清理
            this.logger.warn(`[网格] cancel_order 交易所调用失败: ${e.message}，仍清理本地状态（幂等）`);
          } finally {
            // 无论交易所取消是否成功，都清理本地状态（幂等操作）
            // 若订单其实未被取消，下次 syncOrderFills 会重新发现并处理
            const levelIdx = state.orderBook[decision.order_id];
            if (levelIdx !== undefined && state.gridLines[levelIdx]) {
              state.gridLines[levelIdx].state = 'empty';
              state.gridLines[levelIdx].orderId = undefined;
            }
            delete state.orderBook[decision.order_id];
          }
        }
        break;

      case 'cancel_all_orders': {
        // 代码层守卫：仅当价格严重偏离网格中心才允许全部取消
        const gridCenter = (state.upperPrice + state.lowerPrice) / 2;
        const deviationPct = gridCenter > 0
          ? Math.abs((currentPrice ?? state.lastPrice) - gridCenter) / gridCenter * 100
          : 100;
        if (deviationPct < CANCEL_ALL_MAX_DEVIATION_PCT) {
          this.logger.warn(
            `[网格] cancel_all_orders 被拦截: 价格偏离中心仅 ${deviationPct.toFixed(1)}% < ${CANCEL_ALL_MAX_DEVIATION_PCT}%。AI 理由: ${decision.reasoning}`,
          );
          break;
        }
        await adapter.cancelAllOrders(state.symbol);
        for (const line of state.gridLines) {
          if (line.state === 'pending') {
            line.state = 'empty';
            line.orderId = undefined;
          }
        }
        state.orderBook = {};
        break;
      }

      case 'pause_grid':
        await adapter.cancelAllOrders(state.symbol);
        state.isPaused = true;
        state.pauseSource = 'ai';
        state.pauseReason = decision.reasoning || 'AI 决策暂停';
        break;

      case 'resume_grid':
        if (state.pauseSource === 'risk_control') {
          this.logger.warn(`[网格] AI 尝试解除风控暂停被拦截: ${state.pauseReason}`);
          break;
        }
        state.isPaused = false;
        state.pauseReason = undefined;
        state.pauseSource = undefined;
        break;

      case 'adjust_grid': {
        await adapter.cancelAllOrders(state.symbol);
        // 优先使用 AI 返回的 upperPrice/lowerPrice，否则 fallback 到中心价格重算
        if (decision.upperPrice && decision.lowerPrice && decision.upperPrice > decision.lowerPrice) {
          state.upperPrice = decision.upperPrice;
          state.lowerPrice = decision.lowerPrice;
          state.gridSpacing = (state.upperPrice - state.lowerPrice) / Math.max(state.gridLines.length - 1, 1);
          // 重算各格线价格并重置状态（订单已取消，state 须与边界保持一致）
          const weights = this.calculateWeights(state.gridLines.length, state.distribution);
          const weightSum = weights.reduce((a, b) => a + b, 0);
          for (let i = 0; i < state.gridLines.length; i++) {
            const line = state.gridLines[i];
            line.price = Math.round((state.lowerPrice + i * state.gridSpacing) * 100000) / 100000;
            line.allocatedUSD = state.totalInvestment * (weights[i] / weightSum);
            if (line.state !== 'filled') {
              line.state = 'empty';
              line.orderId = undefined;
              line.orderQuantity = 0;
            }
          }
          this.applyGridDirection(state.gridLines, currentPrice ?? state.lastPrice, state.currentDirection);
          state.orderBook = {};
          this.logger.log(`[网格] AI 调整网格边界: ${state.lowerPrice.toFixed(4)}-${state.upperPrice.toFixed(4)}, 格线已重算`);
        } else {
          const newPrice = decision.price || state.lastPrice;
          this.reinitializeGridLevels(state, newPrice);
        }
        break;
      }

      case 'hold':
        // 不操作
        return { executed: true };

      default:
        this.logger.debug(`[网格] 未知 AI 动作: ${action}`);
        return { executed: true };
    }
    return { executed: true };
  }

  /**
   * 用户手动解除风控暂停
   * - 清除 isPaused / pauseSource / pauseReason
   * - 重置最大回撤峰值（防止立即重新触发）
   * - 重置 dailyPnl（日内亏损保护也需要重置）
   */
  async manualResumeFromRiskControl(
    strategyId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const strategy = await this.prisma.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new NotFoundException('策略不存在');
    if (strategy.strategyType !== 'grid') throw new BadRequestException('仅网格策略支持此操作');

    const state = strategy.gridRuntimeState as unknown as GridState | null;
    if (!state) throw new BadRequestException('网格未初始化');
    if (!state.isPaused || state.pauseSource !== 'risk_control') {
      throw new BadRequestException('策略未处于风控暂停状态');
    }

    // 重置峰值到基准线（防止立即重新触发最大回撤保护）
    state.isPaused = false;
    state.pauseSource = undefined;
    state.pauseReason = undefined;
    state.peakEquity = state.startEquity;   // 回撤检测从基准重新开始
    state.maxDrawdown = 0;                  // 历史最大回撤归零
    state.dailyPnl = 0;
    state.dailyPnlResetDate = new Date().toISOString().slice(0, 10);

    await this.persistGridState(strategyId, state);

    // 同步更新内存缓存，防止下个周期从 gridStates Map 读到旧的 peakEquity
    this.gridStates.set(strategyId, state);

    this.logger.log(`[网格] 用户手动恢复风控暂停: ${strategyId}, 峰值/回撤已归零（从基准重新开始）`);

    return { success: true, message: '网格已恢复，峰值与回撤已归零' };
  }

  /** 下网格限价单（含仓位限制检查）
   *  @returns true=订单已提交, false=被仓位限制/参数异常跳过
   */
  private async placeGridLimitOrder(
    state: GridState,
    decision: GridDecision,
    side: 'buy' | 'sell',
    adapter: GridExchangeAdapter,
    useMakerOnly = false,
  ): Promise<{ executed: boolean; skipReason?: string }> {
    // Prompt 中 level 从 1 开始（用户友好），转为 0-based 数组下标
    const rawLevel = decision.level_index ?? decision.level ?? 0;
    const levelIndex = rawLevel > 0 ? rawLevel - 1 : -1;
    let quantity = decision.quantity ?? 0;

    const level = levelIndex >= 0 ? state.gridLines[levelIndex] : undefined;

    // Step 0: 防重复下单 — 如果该层已有 pending 挂单，先取消旧单再下新单
    // 防止 orderBook 中累积孤儿 orderId，导致挂单计数虚高和 syncOrderFills 误判成交
    if (level && level.state === 'pending' && level.orderId) {
      const oldOrderId = level.orderId;
      this.logger.warn(
        `[网格] 防重复下单: level=${levelIndex} 已有 pending 订单 ${oldOrderId}，先取消旧单再下新单`,
      );
      try {
        await adapter.cancelOrder(state.symbol, oldOrderId);
        this.logger.log(`[网格] 旧单 ${oldOrderId} 已取消（防重复下单）`);
      } catch (e: any) {
        // 取消失败（旧单可能已成交或已不存在）— 清理本地状态，由 syncOrderFills 下次循环处理
        this.logger.warn(`[网格] 取消旧单 ${oldOrderId} 失败（可能已成交或不存在）: ${e.message}`);
      }
      // 无论取消是否成功，清理本地状态（幂等操作）
      delete state.orderBook[oldOrderId];
      level.state = 'empty';
      level.orderId = undefined;
    }

    // Fix-3: 优先使用网格预设价格（由 initGrid/adjust_grid 数学计算），AI 价格仅作 fallback
    // 防止 adjust_grid 与 place 同批次时 AI 旧价格覆盖刚重算的正确价格
    const price = (level && level.price > 0) ? level.price : (decision.price ?? 0);

    if (price <= 0 || quantity <= 0) {
      const skipReason = `无效参数: price=${price}, quantity=${quantity}`;
      this.logger.warn(`[网格] 跳过下单: ${skipReason} (level=${levelIndex})`);
      return { executed: false, skipReason };
    }

    // Step 0.5: 保证金预检 — 参照 nofx: 削减数量适配可用保证金（而非直接拒绝）
    {
      const leverage0 = state.effectiveLeverage || state.leverage;
      const newOrderMargin = (quantity * price) / leverage0;
      const EARLY_MIN_NOTIONAL = 5; // 保守下限（Step 2 有精确值，此处仅做快速判断）

      if (state.availableBalance > 5) {
        // 优先路径：直接用交易所返回的可用余额做精确判断（每轮 buildGridContext 更新）
        if (newOrderMargin > state.availableBalance * 0.9) {
          // nofx 做法: 削减 qty 适配可用保证金，不直接拒绝
          const maxQtyForMargin = (state.availableBalance * 0.9 * leverage0) / price;
          const cappedNotional = maxQtyForMargin * price;
          if (cappedNotional < EARLY_MIN_NOTIONAL) {
            // 削减后仍低于最小下单额 — 真正资金不足，此时才拒绝
            const skipReason =
              `保证金不足: 可用 $${state.availableBalance.toFixed(2)},` +
              ` 削减后名义值 $${cappedNotional.toFixed(2)} < 最低 $${EARLY_MIN_NOTIONAL}`;
            this.logger.warn(`[网格] 跳过下单: ${skipReason}`);
            return { executed: false, skipReason };
          }
          this.logger.debug(
            `[网格] 保证金适配: qty ${quantity.toFixed(4)} → ${maxQtyForMargin.toFixed(4)}` +
            ` (可用 $${state.availableBalance.toFixed(2)}, 需 $${newOrderMargin.toFixed(2)}, level=${levelIndex})`,
          );
          quantity = maxQtyForMargin;
        }
      } else {
        // 兜底路径：availableBalance 未获取时，退回聚合估算逻辑
        const pendingMargin = state.gridLines
          .filter(l => l.state === 'pending' && l.orderQuantity > 0)
          .reduce((s, l) => s + (l.orderQuantity * price) / leverage0, 0);
        const filledMargin = state.gridLines
          .filter(l => l.state === 'filled' && l.positionSize > 0)
          .reduce((s, l) => s + (l.positionSize * price) / leverage0, 0);
        const totalEstimated = pendingMargin + filledMargin + newOrderMargin;
        const marginLimit = state.totalInvestment * 1.1;
        if (totalEstimated > marginLimit) {
          // 尝试削减数量适配剩余保证金空间（与优先路径 L2054 对齐，避免 all-or-nothing 拒绝）
          const remainingMargin = Math.max(0, marginLimit - pendingMargin - filledMargin);
          const maxQtyForMargin = (remainingMargin * leverage0) / price;
          const cappedNotional = maxQtyForMargin * price;
          if (cappedNotional < EARLY_MIN_NOTIONAL) {
            // 削减后仍低于最小下单额 — 真正保证金不足
            const skipReason =
              `聚合保证金超限(兜底): 挂单=$${pendingMargin.toFixed(2)} + 持仓=$${filledMargin.toFixed(2)}` +
              ` + 新单=$${newOrderMargin.toFixed(2)} = $${totalEstimated.toFixed(2)} > 上限=$${marginLimit.toFixed(2)}` +
              `，削减后名义值 $${cappedNotional.toFixed(2)} < 最低 $${EARLY_MIN_NOTIONAL}`;
            this.logger.warn(`[网格] 跳过下单: ${skipReason}`);
            return { executed: false, skipReason };
          }
          this.logger.debug(
            `[网格] 兜底保证金适配: qty ${quantity.toFixed(4)} → ${maxQtyForMargin.toFixed(4)}` +
            ` (剩余保证金 $${remainingMargin.toFixed(2)}, level=${levelIndex})`,
          );
          quantity = maxQtyForMargin;
        }
      }
    }

    // Step 1: 仓位上限检查（使用 effectiveLeverage 代替 leverage）
    const leverage = state.effectiveLeverage || state.leverage; // fallback 兼容旧数据
    if (price > 0 && state.totalInvestment > 0) {
      const maxMarginPerLevel = state.totalInvestment / state.gridLines.length;
      let maxQuantityPerLevel = (maxMarginPerLevel * leverage) / price;

      // 使用 level-specific 分配
      if (level && level.allocatedUSD > 0) {
        const levelMax = (level.allocatedUSD * leverage) / price;
        maxQuantityPerLevel = Math.min(maxQuantityPerLevel, levelMax);
      }

      // 仓位缩减（突破恢复后）
      if (state.positionReductionPct > 0) {
        maxQuantityPerLevel *= (1 - state.positionReductionPct / 100);
      }

      quantity = Math.min(quantity, maxQuantityPerLevel);

      // 绝对安全上限（totalInvestment 本身已是用户配置的最大资金，此处仅做兜底）
      const positionValue = quantity * price;
      const absoluteMax = state.totalInvestment * leverage * POSITION_SAFETY_MULTIPLIER;
      if (positionValue > absoluteMax) {
        const skipReason = `仓位超安全上限: $${positionValue.toFixed(2)} > $${absoluteMax.toFixed(2)}`;
        this.logger.warn(`[网格] 跳过下单: ${skipReason}`);
        return { executed: false, skipReason };
      }
    }

    // Step 2: 格式化数量 + 最小下单量检查 + 获取交易所精度信息
    const formattedQty = await adapter.formatQuantity(state.symbol, quantity);
    let finalQty = parseFloat(formattedQty);
    let minQty = 0;
    let exchangeMinNotional = 0;
    let stepSize = 0;
    let percentPriceDown: number | undefined;
    let percentPriceUp: number | undefined;
    try {
      const precision = await adapter.getMarketPrecision(state.symbol);
      minQty = precision.minQuantity ?? 0;
      exchangeMinNotional = precision.minNotional ?? 0;
      stepSize = precision.stepSize ?? 0;
      percentPriceDown = precision.percentPriceDown;
      percentPriceUp = precision.percentPriceUp;
    } catch { /* 获取失败则跳过，交由交易所兜底 */ }

    // Step 2.5: 价格偏差保护（动态读取交易所 PERCENT_PRICE，替代硬编码）
    // Binance PERCENT_PRICE 因品种而异（如 multiplierDown=0.95 表示不低于标记价×0.95）
    // 加 2% 安全余量：lastPrice ≠ markPrice，防止下单瞬间标记价微移导致被拒
    const marketPrice = state.lastPrice;
    if (marketPrice > 0) {
      const sellFloor = percentPriceDown
        ? marketPrice * percentPriceDown * 1.02   // 动态值 + 2% 安全余量（向上收紧）
        : marketPrice * 0.95;                      // 无数据时回退默认 5%
      const buyCeiling = percentPriceUp
        ? marketPrice * percentPriceUp * 0.98     // 动态值 - 2% 安全余量（向下收紧）
        : marketPrice * 1.10;                      // 无数据时回退默认 10%

      if (side === 'sell' && price < sellFloor) {
        const devPct = ((marketPrice - price) / marketPrice * 100).toFixed(1);
        const limitPct = percentPriceDown ? ((1 - percentPriceDown) * 100).toFixed(1) : '5.0';
        const skipReason = `卖单价格偏低: ${price.toFixed(4)} 低于市价 ${devPct}%（交易所限制约 ${limitPct}%）`;
        this.logger.warn(`[网格] 价格偏差跳过: SELL level=${levelIndex} price=${price.toFixed(4)} < floor=${sellFloor.toFixed(4)} (market=${marketPrice.toFixed(4)}, ppDown=${percentPriceDown ?? 'N/A'})`);
        return { executed: false, skipReason };
      }
      if (side === 'buy' && price > buyCeiling) {
        const devPct = ((price - marketPrice) / marketPrice * 100).toFixed(1);
        const limitPct = percentPriceUp ? ((percentPriceUp - 1) * 100).toFixed(1) : '10.0';
        const skipReason = `买单价格偏高: ${price.toFixed(4)} 高于市价 ${devPct}%（交易所限制约 ${limitPct}%）`;
        this.logger.warn(`[网格] 价格偏差跳过: BUY level=${levelIndex} price=${price.toFixed(4)} > ceiling=${buyCeiling.toFixed(4)} (market=${marketPrice.toFixed(4)}, ppUp=${percentPriceUp ?? 'N/A'})`);
        return { executed: false, skipReason };
      }
    }
    // floor 取整可能导致 finalQty=0（如 BTC 0.000914 → 0）
    // 当原始数量 >= minQty 的 80% 时，snap up 到 minQty，避免因精度丢失空转
    if (finalQty <= 0 && minQty > 0 && quantity >= minQty * 0.8) {
      this.logger.debug(
        `[网格] 数量向上取整: 原始=${quantity.toFixed(6)} → minQty=${minQty} (level=${levelIndex})`,
      );
      finalQty = minQty;
    }
    if (finalQty <= 0 || (minQty > 0 && finalQty < minQty)) {
      const skipReason = `数量不足: ${finalQty} < 最小 ${minQty}`;
      this.logger.debug(
        `[网格] 跳过下单: ${skipReason} (原始=${quantity.toFixed(6)}, level=${levelIndex})`,
      );
      return { executed: false, skipReason };
    }
    // 最小名义价值预检：直接使用交易所真实值（SOL=$5, ETH=$20, BTC=$100）
    const MIN_NOTIONAL = exchangeMinNotional > 0 ? exchangeMinNotional : 5;
    let notional = finalQty * price;
    // 名义值 snap-up：floor 取整后 notional 略低于最低要求（如 $4.96 < $5）
    // 当缺口 < 10%（即在最低值的 90%-100% 之间）时，qty 加一个步长补足
    if (notional < MIN_NOTIONAL && notional >= MIN_NOTIONAL * 0.9 && stepSize > 0) {
      const snappedQty = parseFloat((finalQty + stepSize).toFixed(8));
      const snappedNotional = snappedQty * price;
      this.logger.debug(
        `[网格] 名义值snap-up: ${finalQty}→${snappedQty}, notional $${notional.toFixed(2)}→$${snappedNotional.toFixed(2)} (level=${levelIndex})`,
      );
      finalQty = snappedQty;
      notional = snappedNotional;
    }
    if (notional < MIN_NOTIONAL) {
      const coinSymbol = state.symbol.replace(/USDT.*/, '').replace(/\/.*/, '');
      const perLevelNotional = (state.totalInvestment / state.gridLines.length) * leverage;
      const recommendedLevels = Math.floor((state.totalInvestment * leverage) / MIN_NOTIONAL);
      const recommendedInvestment = Math.ceil((MIN_NOTIONAL * state.gridLines.length) / leverage);
      const skipReason =
        `每层资金不足: 每层约 $${perLevelNotional.toFixed(2)}，` +
        `低于 ${coinSymbol} 最低下单额 $${MIN_NOTIONAL.toFixed(0)} | ` +
        `建议: 减少层数(${state.gridLines.length}→${recommendedLevels})` +
        `或增加投资额($${state.totalInvestment}→$${recommendedInvestment})`;
      this.logger.warn(
        `[网格] 跳过下单: notional $${notional.toFixed(2)} < 交易所最低 $${MIN_NOTIONAL}` +
        ` (level=${levelIndex}, qty=${finalQty}, price=${price}) | ${skipReason}`,
      );
      return { executed: false, skipReason };
    }

    // Step 3: 下单（单向持仓模式不传 positionSide，避免 Binance -4061）
    // OKX 要求 clOrdId 纯字母数字（无连字符），格式 g{idx}t{ts}，最长 17 字符
    const clientId = level ? `g${levelIndex}t${Date.now()}` : undefined;

    const result = await adapter.placeLimitOrder({
      symbol: state.symbol,
      side,
      price,
      quantity: finalQty,
      leverage,
      postOnly: useMakerOnly,
      clientId,
    });

    // Step 4: 更新本地状态
    if (level) {
      // 如果层上仍残留旧 orderId（极端并发情况），先从 orderBook 清理，防止孤儿条目
      if (level.orderId && level.orderId !== result.orderId) {
        delete state.orderBook[level.orderId];
      }
      level.state = 'pending';
      level.price = price;           // 与实际下单价保持一致
      level.orderId = result.orderId;
      level.orderQuantity = finalQty;
      state.orderBook[result.orderId] = levelIndex;

      // 下单成功：从可用余额中扣除本单保证金（防止同轮次重复占用）
      if (state.availableBalance > 0) {
        const leverage0 = state.effectiveLeverage || state.leverage;
        const usedMargin = (finalQty * price) / leverage0;
        state.availableBalance = Math.max(0, state.availableBalance - usedMargin);
      }
    }

    this.logger.log(`[网格] 限价单: ${side} ${finalQty} @ ${price} (level=${levelIndex}, orderId=${result.orderId})`);
    return { executed: true };
  }

  // ========================= 方向性平仓 =========================

  /**
   * 方向性平仓（单边平仓，不全平）
   * 上涨突破 → 只平 SHORT 持仓；下跌突破 → 只平 LONG 持仓
   * 减少不必要的双向损失，同时不影响盈利方向的持仓
   */
  private async directionalCloseOnBreakout(
    state: GridState,
    direction: 'up' | 'down',
    userId: string,
    apiKeyId: string,
  ): Promise<void> {
    if (!this.adapterFactory) return;
    const sideToClose = direction === 'up' ? 'short' : 'long';

    let adapter: ExchangeAdapter | null = null;
    try {
      adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      const positions = await adapter.getPositions();

      for (const pos of positions) {
        if (!pos.symbol.includes(state.symbol.split('/')[0])) continue;
        if (pos.side !== sideToClose) continue;

        try {
          sideToClose === 'long'
            ? await adapter.closeLong(pos.symbol, pos.quantity)
            : await adapter.closeShort(pos.symbol, pos.quantity);
          this.logger.warn(
            `[网格] 方向性平仓: ${pos.symbol} ${sideToClose} ${pos.quantity} (${direction}向突破)`,
          );
        } catch (e: any) {
          this.logger.warn(`[网格] 方向性平仓失败: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`[网格] 方向性平仓执行失败: ${e.message}`);
    } finally {
      if (adapter) { try { await adapter.dispose(); } catch { /* 忽略 */ } }
    }
  }

  // ========================= 紧急退出 =========================

  /** 紧急平仓 */
  private async emergencyExit(
    state: GridState,
    userId: string,
    apiKeyId: string,
    reason: string,
  ): Promise<void> {
    this.logger.error(`[网格] 紧急退出: ${reason}`);

    if (!this.adapterFactory) return;

    let adapter: ExchangeAdapter | null = null;
    try {
      adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);

      // 取消所有订单
      await adapter.cancelAllOrders(state.symbol);

      // 平掉所有持仓
      const positions = await adapter.getPositions();
      for (const pos of positions) {
        if (!pos.symbol.includes(state.symbol.split('/')[0])) continue;
        try {
          pos.side === 'long'
            ? await adapter.closeLong(pos.symbol, pos.quantity)
            : await adapter.closeShort(pos.symbol, pos.quantity);
        } catch (e: any) {
          this.logger.warn(`[网格] 平仓失败: ${pos.symbol} ${pos.side} - ${e.message}`);
        }
      }

      // 平仓完成后结算燃油费（基于已实现网格利润，失败不阻塞后续状态更新）
      await this.settleGridFee(state, userId);
    } catch (e: any) {
      this.logger.error(`[网格] 紧急退出执行失败: ${e.message}`);
    } finally {
      if (adapter) { try { await adapter.dispose(); } catch { /* 忽略 */ } }
    }

    state.isPaused = true;
    state.pauseSource = 'risk_control';
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

  /**
   * 软暂停：只取消挂单，不平仓（对齐 nofx dailyLoss 行为）
   * 适用于日内亏损等可能自然恢复的场景，避免把浮亏变实亏
   */
  private async softPauseGrid(
    state: GridState,
    userId: string,
    apiKeyId: string,
    reason: string,
  ): Promise<void> {
    this.logger.warn(`[网格] 软暂停（取消挂单/保留持仓）: ${reason}`);

    if (!this.adapterFactory) {
      state.isPaused = true;
      state.pauseSource = 'risk_control';
      state.pauseReason = reason;
      return;
    }

    let adapter: ExchangeAdapter | null = null;
    try {
      adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      await adapter.cancelAllOrders(state.symbol);
    } catch (e: any) {
      this.logger.warn(`[网格] 软暂停撤单失败（忽略继续暂停）: ${e.message}`);
    } finally {
      if (adapter) { try { await adapter.dispose(); } catch { /* 忽略 */ } }
    }

    // 清理本地挂单状态
    for (const line of state.gridLines) {
      if (line.state === 'pending') {
        line.state = 'empty';
        line.orderId = undefined;
      }
    }
    state.orderBook = {};

    state.isPaused = true;
    state.pauseSource = 'risk_control';
    state.pauseReason = reason;
  }

  // ========================= 燃油费结算 =========================

  /**
   * 结算网格策略的点卡燃油费
   * - 只在有新增盈利时扣费（高水位标记，防止重复扣费）
   * - 失败不影响平仓流程（非致命错误）
   */
  private async settleGridFee(state: GridState, userId: string): Promise<void> {
    if (!this.feeService) return;
    const pendingProfit = state.totalProfit - (state.chargedProfit ?? 0);
    if (pendingProfit <= 0) return;

    try {
      const feeCalc = await this.feeService.calculateFee(userId, pendingProfit.toFixed(8));
      if (parseFloat(feeCalc.feeAmount) > 0) {
        const uniqueOrderId = this.feeService.generateUniqueOrderId(
          'GRID_FEE',
          userId,
          state.strategyId,
        );
        const result = await this.feeService.chargeFee({
          userId,
          positionId: state.strategyId,
          profit: feeCalc.profit,
          feeRate: feeCalc.finalFeeRate,
          feeAmount: feeCalc.feeAmount,
          uniqueOrderId,
        });
        state.chargedProfit = state.totalProfit; // 更新高水位，防止重复扣费
        this.logger.log(
          `[网格] 燃油费结算: 利润=${pendingProfit.toFixed(2)} USDT, ` +
          `扣费=${feeCalc.feeAmount} 点, 费率=${(parseFloat(feeCalc.finalFeeRate) * 100).toFixed(1)}%`,
        );
        if (result.balanceDepleted) {
          this.logger.warn(`[网格] 点卡余额不足，策略将在下次周期自动停止`);
        }
      }
    } catch (e: any) {
      this.logger.error(`[网格] 燃油费结算失败（非致命，平仓继续）: ${e.message}`);
    }
  }

  // ========================= 订单同步 =========================

  /** 同步交易所订单到本地状态 */
  private async syncOrderFills(
    state: GridState,
    adapter: GridExchangeAdapter,
  ): Promise<{ filledLines: GridLine[] }> {
    const filledLines: GridLine[] = [];
    try {
      const openOrders = await adapter.getOpenOrders(state.symbol);
      const activeIds = new Set(openOrders.map((o) => o.orderId));

      // 收集所有"消失"的挂单
      const disappearedLines = state.gridLines.filter(
        (line) => line.state === 'pending' && line.orderId && !activeIds.has(line.orderId),
      );

      // 批量并行查询真实状态（避免串行 N 个 API 调用）
      const statusResults = await Promise.all(
        disappearedLines.map((line) =>
          adapter
            .getOrderStatus(state.symbol, line.orderId!)
            .catch((e: any) => {
              const msg = (e?.message ?? '').toLowerCase();
              // "订单不存在"类错误（Binance -2011 / unknown order）— 视为已取消，清理状态
              const isNotFound = msg.includes('-2011') ||
                msg.includes('order does not exist') ||
                msg.includes('unknown order') ||
                msg.includes('no order found');
              if (isNotFound) {
                return { status: 'CANCELED' as const, avgPrice: 0, filledQuantity: 0, fee: 0 };
              }
              // 网络错误/超时 — 返回 null，保留 pending 状态等待下次重试
              return null;
            }),
        ),
      );

      for (let i = 0; i < disappearedLines.length; i++) {
        const line = disappearedLines[i];
        const detail = statusResults[i];
        // detail 为 null 表示网络错误，保留 pending 状态等待下次循环重试
        if (!detail) {
          this.logger.warn(`[网格] 查询订单 ${line.orderId} 失败（网络错误），保留 pending 状态等下次重试`);
          continue;
        }
        const isFilled = detail.status === 'FILLED' || detail.status === 'PARTIALLY_FILLED';

        if (!isFilled) {
          // 订单被取消（CANCELED/REJECTED/EXPIRED）—— 仅清理本地状态
          delete state.orderBook[line.orderId!];  // 先用 orderId 删 orderBook
          line.orderId = undefined;               // 再清空 orderId
          line.state = 'empty';
          this.logger.debug(`[网格] 订单已取消: level=${line.index}, status=${detail.status}`);
          continue;
        }

        // === 真实成交处理 ===
        const prevSide = line.side;           // 记录成交方向（成交前的方向）
        line.state = 'filled';
        line.positionSize = line.orderQuantity;
        line.positionEntry = detail.avgPrice > 0 ? detail.avgPrice : line.price;
        line.orderId = undefined;

        state.totalTrades++;

        // 只在 SELL 成交时计利润（卖出 = 完成一个买→卖循环，真正盈利）
        // BUY 成交只是建仓，尚未获利
        if (prevSide === 'sell' && line.positionEntry > 0) {
          const grossProfit = state.gridSpacing * line.orderQuantity;
          // 双边手续费：卖出价 × qty × 费率 + 买入价 × qty × 费率
          // 买入价 ≈ 卖出价 - gridSpacing（中性网格每格等距）
          const sellFee = line.positionEntry * line.orderQuantity * state.takerFeeRate;
          const buyFee = (line.positionEntry - state.gridSpacing) * line.orderQuantity * state.takerFeeRate;
          const netProfit = grossProfit - sellFee - buyFee;
          line.unrealizedPnl = netProfit;     // 字段名遗留，实为该格完成盈亏
          state.totalProfit += netProfit;
          if (netProfit > 0) state.winningTrades++;
        } else {
          line.unrealizedPnl = 0;            // 买入成交，盈亏待卖出确认
        }

        // 翻转方向：买→卖，卖→买
        line.side = prevSide === 'buy' ? 'sell' : 'buy';

        filledLines.push(line);
        this.logger.log(
          `[网格] 订单成交: level=${line.index}, 价格=${line.positionEntry.toFixed(4)}, ` +
          `${prevSide}→${line.side}, avgPrice=${detail.avgPrice}`,
        );
      }

      // 清理 orderBook 中已不存在的订单（处理其他意外消失的条目）
      for (const orderId of Object.keys(state.orderBook)) {
        if (!activeIds.has(orderId)) {
          delete state.orderBook[orderId];
        }
      }
    } catch (e: any) {
      this.logger.warn(`[网格] 订单同步失败: ${e.message}`);
    }

    // 倾斜检测（瞬时批次，仅供调试参考；全局倾斜检测已移至主循环 Fix-A）
    // line.side 在 syncOrderFills 中已翻转：原 buy 成交 → side 变 sell；原 sell 成交 → side 变 buy
    if (filledLines.length >= 3) {
      const buyFilled = filledLines.filter(l => l.side === 'sell').length; // 原 buy 成交
      const sellFilled = filledLines.filter(l => l.side === 'buy').length; // 原 sell 成交
      const skew = Math.abs(buyFilled - sellFilled);
      if (skew >= 3 || (buyFilled === 0 && sellFilled > 0) || (sellFilled === 0 && buyFilled > 0)) {
        this.logger.debug(
          `[网格] 批次倾斜(瞬时): buy_filled=${buyFilled}, sell_filled=${sellFilled}，单向聚集 ${skew} 格`,
        );
      }
    }

    return { filledLines };
  }

  /**
   * 成交后立即下反向限价单
   *
   * 网格核心逻辑：
   *   买单在 level i 成交 → line.side 已翻转为 sell → 在 level i+1（上格）下卖单
   *   卖单在 level j 成交 → line.side 已翻转为 buy  → 在 level j-1（下格）下买单
   *
   * 注意：syncOrderFills 已将 line.side 翻转，此处 line.side 表示"下一步要挂的方向"
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

      // 确定目标格线：sell（原 buy 成交）→ 上格(index+1)；buy（原 sell 成交）→ 下格(index-1)
      const targetIdx = line.side === 'sell' ? line.index + 1 : line.index - 1;
      if (targetIdx < 0 || targetIdx >= state.gridLines.length) {
        this.logger.debug(`[网格] 反向挂单跳过: level=${line.index} 已在边界，无相邻格`);
        continue;
      }

      const targetLine = state.gridLines[targetIdx];
      // 相邻格线已有挂单或持仓，跳过（避免重复下单）
      if (targetLine.state === 'pending' || targetLine.state === 'filled') {
        this.logger.debug(`[网格] 反向挂单跳过: level=${targetIdx} 已有 ${targetLine.state} 订单`);
        continue;
      }

      const quantity = line.orderQuantity > 0 ? line.orderQuantity : line.allocatedUSD * state.leverage / targetLine.price;
      if (quantity <= 0 || targetLine.price <= 0) continue;

      try {
        const formattedQty = await adapter.formatQuantity(state.symbol, quantity);
        const finalQty = Number(formattedQty);
        if (finalQty <= 0) continue;

        // OKX 要求 clOrdId 纯字母数字（无连字符），格式 gr{idx}t{ts}，最长 18 字符
        const clientId = `gr${targetIdx}t${Date.now()}`;

        const result = await adapter.placeLimitOrder({
          symbol: state.symbol,
          side: line.side,          // 已翻转的方向
          price: targetLine.price,  // 相邻格线的价格（非成交价）
          quantity: finalQty,
          leverage: state.leverage,
          postOnly: useMakerOnly,
          clientId,
        });

        // 更新目标格线状态（不是成交格线）
        targetLine.state = 'pending';
        targetLine.orderId = result.orderId;
        targetLine.orderQuantity = finalQty;
        targetLine.side = line.side; // 确保方向与实际挂单一致
        state.orderBook[result.orderId] = targetLine.index;
        placed++;

        this.logger.log(
          `[网格] 反向挂单: ${line.side} ${finalQty} @ ${targetLine.price}` +
          ` (目标 level=${targetIdx}, 触发 level=${line.index})`,
        );
      } catch (e: any) {
        this.logger.warn(`[网格] 反向挂单失败 触发level=${line.index} 目标level=${targetIdx}: ${e.message}`);
      }
    }
    return placed;
  }

  // ========================= 启动恢复（T4: reconcileGridState） =========================

  /**
   * 网格状态启动恢复
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
          // 幂等检查：防止多次重启产生重复快照记录
          const existingSnapshot = await this.prisma.position.findFirst({
            where: { userId, symbol: symPos.symbol, aiStrategyId: strategyId, status: 'open' },
          });
          if (!existingSnapshot) {
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
                aiStrategyId: strategyId,
              },
            });
            this.logger.log(`[网格] 创建快照持仓: ${symPos.symbol} ${symPos.side} → 策略 ${strategyId}`);
          }
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

  /** 计算分布权重（uniform / gaussian / pyramid 三种分布） */
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

  /** 应用方向到网格线 */
  private applyGridDirection(
    gridLines: GridLine[],
    currentPrice: number,
    direction: GridDirection,
  ): void {
    const totalLevels = gridLines.length;

    switch (direction) {
      case 'long':
        // long 方向：以当前价为界，低于当前价的格线买（建仓），高于当前价的格线卖（止盈），避免上格买单立即触发
        for (const line of gridLines) {
          line.side = line.price <= currentPrice ? 'buy' : 'sell';
        }
        break;

      case 'short':
        // short 方向：以当前价为界，高于当前价的格线卖（建仓），低于当前价的格线买（止盈）
        for (const line of gridLines) {
          line.side = line.price <= currentPrice ? 'buy' : 'sell';
        }
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
    // 防御: 边界为 null/NaN 时用中心价格 ±5% 作为默认范围
    const validUpper = state.upperPrice && isFinite(state.upperPrice);
    const validLower = state.lowerPrice && isFinite(state.lowerPrice);
    const halfRange = (validUpper && validLower)
      ? (state.upperPrice - state.lowerPrice) / 2
      : centerPrice * 0.05;

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
      // 同步 total_pnl（权益差，非累计网格利润）和 win_rate 到策略主表
      const equityPnl = state.lastEquity && state.startEquity > 0
        ? state.lastEquity - state.startEquity
        : 0;
      const winRate = state.totalTrades > 0
        ? Math.round((state.winningTrades / state.totalTrades) * 100 * 100) / 100
        : 0;
      await this.prisma.aiStrategy.update({
        where: { id: strategyId },
        data: { gridRuntimeState: state as any },
      });
      // 原始 SQL 更新 PnL 字段（绕过 Prisma 客户端类型缓存问题）
      await this.prisma.$executeRawUnsafe(
        `UPDATE ai_strategies SET total_pnl = $1, win_rate = $2, total_trades = $3 WHERE id = $4`,
        equityPnl, winRate, state.totalTrades ?? 0, strategyId,
      );
      this.logger.debug(
        `[网格] 持久化: pnl=${equityPnl.toFixed(4)}, trades=${state.totalTrades}, winRate=${winRate}%`,
      );
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
        // 向后兼容：旧版状态可能缺少新字段
        if (state.startEquity === undefined) state.startEquity = state.peakEquity;
        if (state.lastOI === undefined) state.lastOI = 0;
        if (state.lastEquity === undefined) state.lastEquity = state.peakEquity;
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
    symbol: string,
    decisions: GridDecision[],
    cost: number,
    state?: GridState,
    thinking?: string,
    execResults?: Array<{ action: string; success: boolean; skipped?: boolean; skipReason?: string; error?: string }>,
    marketAnalysis?: string,
  ): Promise<void> {
    try {
      // 统计各操作类型数量，生成摘要
      const counts: Record<string, number> = {};
      for (const d of decisions) {
        counts[d.action] = (counts[d.action] || 0) + 1;
      }
      const buyCount = (counts['place_buy_limit'] || 0);
      const sellCount = (counts['place_sell_limit'] || 0);
      const cancelCount = (counts['cancel_order'] || 0);
      const parts: string[] = [];
      if (buyCount) parts.push(`${buyCount}B`);
      if (sellCount) parts.push(`${sellCount}S`);
      if (cancelCount) parts.push(`${cancelCount}C`);
      for (const [act, cnt] of Object.entries(counts)) {
        if (!['place_buy_limit', 'place_sell_limit', 'cancel_order'].includes(act)) {
          parts.push(`${act}×${cnt}`);
        }
      }
      const gridSummary = parts.join('/') || `${decisions.length}ops`;

      // 构建 GridState 快照
      const gridSnapshot = state ? {
        upperPrice: state.upperPrice,
        lowerPrice: state.lowerPrice,
        gridSpacing: state.gridSpacing,
        direction: state.currentDirection,
        regime: state.currentRegime,
        totalLevels: state.gridLines.length,
        filledLevels: state.gridLines.filter(l => l.state === 'filled').length,
        pendingLevels: state.gridLines.filter(l => l.state === 'pending').length,
        activeOrders: Object.keys(state.orderBook).length,
        totalInvestment: state.totalInvestment,   // 用于前端展示每层成本估算
        totalProfit: state.totalProfit,
        totalTrades: state.totalTrades,
        winRate: state.totalTrades > 0
          ? Math.round((state.winningTrades / state.totalTrades) * 100)
          : 0,
        maxDrawdown: state.maxDrawdown,
        dailyPnl: state.dailyPnl,
        // 总盈亏 = 最新权益 - 启动权益（含已实现 + 未实现）
        totalPnl: state.lastEquity && state.startEquity > 0
          ? state.lastEquity - state.startEquity
          : undefined,
        breakoutLevel: state.breakoutLevel,
        lastPrice: state.lastPrice,
        startEquity: state.startEquity,
        currentProfitPct: state.startEquity > 0 && state.lastEquity
          ? (state.lastEquity - state.startEquity) / state.startEquity * 100
          : 0,
      } : undefined;

      // 统计执行结果：有错误则 executed=false，errors + skipped 列表写入 execution_result
      const failedResults = execResults?.filter(r => !r.success) ?? [];
      const skippedResults = execResults?.filter(r => r.success && r.skipped) ?? [];
      const allSucceeded = failedResults.length === 0;
      const hasExecDetails = failedResults.length > 0 || skippedResults.length > 0;

      await this.prisma.aiStrategyLog.create({
        data: {
          strategyId,
          symbol,
          decision: {
            action: decisions[0]?.action ?? 'grid_cycle',
            gridSummary,
            // 优先使用整体市场分析，回退到第一条操作的 reasoning
            reasoning: marketAnalysis || decisions[0]?.reasoning || '',
            decisions,
            cost,
            ...(thinking && { aiThinking: thinking }),
            ...(gridSnapshot && { gridSnapshot }),
          } as any,
          executed: allSucceeded,
          ...(hasExecDetails && {
            executionResult: {
              ...(failedResults.length > 0 && {
                errors: failedResults.map(r => ({ action: r.action, error: r.error })),
              }),
              ...(skippedResults.length > 0 && {
                skipped: skippedResults.map(r => ({ action: r.action })),
              }),
            } as any,
          }),
        },
      });
    } catch (e: any) {
      this.logger.warn(`[网格] 日志保存失败: ${e.message}`);
    }
  }

  // ========================= 配置变更检测 =========================

  /** 检测 gridConfig 关键参数是否与运行中的 state 不一致，返回变更描述 or null */
  private detectGridConfigChange(state: GridState, config: GridConfig): string | null {
    const diffs: string[] = [];
    // 交易对变更 — 必须首位检测，symbol 改变整个网格必须重建
    if (config.symbol && config.symbol !== state.symbol) {
      diffs.push(`交易对 ${state.symbol}→${config.symbol}`);
    }
    if (config.gridCount && config.gridCount !== state.gridLines.length) {
      diffs.push(`层数 ${state.gridLines.length}→${config.gridCount}`);
    }
    if (config.leverage && config.leverage !== state.leverage) {
      diffs.push(`杠杆 ${state.leverage}x→${config.leverage}x`);
    }
    if (config.totalInvestment && config.totalInvestment !== state.totalInvestment) {
      diffs.push(`投资额 ${state.totalInvestment}→${config.totalInvestment}`);
    }
    if (config.direction && config.direction !== state.currentDirection) {
      diffs.push(`方向 ${state.currentDirection}→${config.direction}`);
    }
    if (config.distribution && config.distribution !== state.distribution) {
      diffs.push(`分布 ${state.distribution}→${config.distribution}`);
    }
    return diffs.length > 0 ? diffs.join(', ') : null;
  }

  /** 清理交易所上的旧挂单（配置变更重建前调用） */
  private async cleanupExistingOrders(
    state: GridState,
    userId: string,
    apiKeyId: string,
  ): Promise<void> {
    if (!this.adapterFactory) return;
    let adapter: ExchangeAdapter | null = null;
    try {
      adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      await adapter.cancelAllOrders(state.symbol);
      this.logger.log(`[网格] 配置变更: 已取消 ${state.symbol} 所有挂单`);
    } catch (e: any) {
      this.logger.warn(`[网格] 清理旧挂单失败: ${e.message}`);
    } finally {
      if (adapter) { try { await adapter.dispose(); } catch { /* 忽略 */ } }
    }
  }

  // ========================= 公开查询接口 =========================

  async getGridState(strategyId: string): Promise<GridState | null> {
    const cached = this.gridStates.get(strategyId);
    if (cached) return cached;
    return this.loadGridState(strategyId);
  }

  /**
   * 外部触发止盈/止损/最大周期退出：
   * 取消所有挂单 → 平所有持仓 → 结算燃油费 → 标记 isPaused
   * 调用方负责将 isActive 设为 false 并移除 BullMQ 任务
   */
  async stopGridForCondition(
    strategyId: string,
    userId: string,
    apiKeyId: string,
    reason: string,
  ): Promise<void> {
    const state = await this.getGridState(strategyId);
    if (!state) {
      this.logger.warn(`[网格] stopGridForCondition: 未找到 ${strategyId} 的状态，跳过平仓`);
      return;
    }
    // 复用 emergencyExit：取消挂单 + 平仓 + 结算燃油费 + 设置 isPaused/pauseSource/pauseReason
    await this.emergencyExit(state, userId, apiKeyId, reason);
    await this.persistGridState(strategyId, state);
    this.logger.log(`[网格] stopGridForCondition 完成: ${strategyId} | ${reason}`);
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
